package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"
)

// Upload de imagem pro Cloudflare R2 (compatível com S3). Ver docs/security-and-cms.md
// "Problema 1: Upload de Imagens Pesadas" e docs/r2-setup.md (como configurar o bucket e as variáveis).
// A rota é pública (sem login até a fase de segurança), então é estreita: só JPEG, PNG, GIF e WebP
// (conferidos pelo CONTEÚDO, nunca pelo cabeçalho; SVG fica de fora porque carrega script), corpo
// limitado, dimensões limitadas, limite por IP e nome de arquivo gerado pelo servidor.
const maxUploadBytes = 8 << 20 // 8MB brutos aceitos na entrada (a saída processada fica bem menor)
const maxImageWidth = 2000     // px — nenhuma imagem de blog precisa ser mais larga que isso
const maxImagePixels = 40_000_000
const uploadsPerMinute = 30

var s3Client *s3.Client
var r2Bucket string
var r2PublicURL string

type storageConfig struct {
	AccountID, AccessKey, SecretKey, Bucket, PublicURL string
	// Endpoint troca o endereço do R2 (MinIO, S3 ou um servidor de teste). Vazio = R2 da conta.
	Endpoint string
}

func storageConfigFromEnv() storageConfig {
	return storageConfig{
		AccountID: os.Getenv("R2_ACCOUNT_ID"), AccessKey: os.Getenv("R2_ACCESS_KEY_ID"), SecretKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		Bucket: os.Getenv("R2_BUCKET"), PublicURL: os.Getenv("R2_PUBLIC_URL"), Endpoint: os.Getenv("R2_ENDPOINT"),
	}
}

// configureStorage devolve false (e deixa o upload desligado) se faltar algo.
func configureStorage(c storageConfig) bool {
	s3Client = nil
	r2Bucket = c.Bucket
	r2PublicURL = strings.TrimSuffix(c.PublicURL, "/")
	// Com Endpoint próprio a conta do R2 não é necessária.
	if (c.Endpoint == "" && c.AccountID == "") || c.AccessKey == "" || c.SecretKey == "" || c.Bucket == "" || c.PublicURL == "" {
		return false
	}
	opts := s3.Options{
		Region:      "auto",
		Credentials: credentials.NewStaticCredentialsProvider(c.AccessKey, c.SecretKey, ""),
	}
	if c.Endpoint != "" {
		opts.BaseEndpoint = aws.String(c.Endpoint)
		opts.UsePathStyle = true
	} else {
		opts.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", c.AccountID))
	}
	s3Client = s3.New(opts)
	return true
}

func initStorage() {
	if !configureStorage(storageConfigFromEnv()) {
		log.Println("⚠️  R2 não configurado (faltam R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_URL no .env) — upload de imagem do blog fica indisponível até configurar. Passo a passo em docs/r2-setup.md.")
		return
	}
	fmt.Println("✅ Cloudflare R2 configurado (upload de imagem do blog liberado)")
}

// allowedImageTypes: o que a rota aceita, pelo tipo detectado no conteúdo.
var allowedImageTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true}

// sniffImage detecta o tipo pelos primeiros bytes; "" se não for uma imagem aceita.
func sniffImage(data []byte) string {
	head := data
	if len(head) > 512 {
		head = head[:512]
	}
	if t := http.DetectContentType(head); allowedImageTypes[t] {
		return t
	}
	return ""
}

type processed struct {
	Data        []byte
	ContentType string
	Ext         string
}

var extFor = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}

// processImage corrige a orientação (EXIF), limita a largura e recomprime.
//   - GIF e WebP sobem como vieram (GIF pode ser animado; o redimensionador acharia o 1º quadro).
//   - PNG com transparência continua PNG (JPEG a perderia); PNG opaco vira JPEG, bem menor.
//   - JPEG é redimensionado e recomprimido (a orientação EXIF é aplicada, já que o recode apaga o EXIF).
//
// Se algo falhar, devolve o original em vez de recusar uma imagem válida.
func processImage(data []byte, contentType string) processed {
	orig := processed{Data: data, ContentType: contentType, Ext: extFor[contentType]}
	if contentType == "image/gif" || contentType == "image/webp" {
		return orig
	}
	img, err := imaging.Decode(bytes.NewReader(data), imaging.AutoOrientation(true))
	if err != nil {
		return orig
	}
	if img.Bounds().Dx() > maxImageWidth {
		img = imaging.Resize(img, maxImageWidth, 0, imaging.Lanczos)
	}
	var buf bytes.Buffer
	if contentType == "image/png" && !isOpaque(img) {
		if err := (&png.Encoder{CompressionLevel: png.BestCompression}).Encode(&buf, img); err != nil {
			return orig
		}
		return processed{buf.Bytes(), "image/png", "png"}
	}
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
		return orig
	}
	return processed{buf.Bytes(), "image/jpeg", "jpg"}
}

func isOpaque(img image.Image) bool {
	if o, ok := img.(interface{ Opaque() bool }); ok {
		return o.Opaque()
	}
	return true
}

// checkDimensions recusa imagem com pixels demais ANTES de decodificar (bomba de descompressão:
// um PNG pequeno pode declarar 30000x30000 e consumir gigabytes ao abrir).
func checkDimensions(data []byte) error {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil // formato que a stdlib não lê (ex.: WebP): sobe sem processar, com o limite de 8MB
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > maxImagePixels {
		return fmt.Errorf("imagem grande demais (%dx%d); o limite é %d megapixels", cfg.Width, cfg.Height, maxImagePixels/1_000_000)
	}
	return nil
}

func uploadKey(ext string) string {
	r := make([]byte, 4)
	_, _ = rand.Read(r)
	return fmt.Sprintf("blog/%d-%s.%s", time.Now().UnixNano(), hex.EncodeToString(r), ext)
}

func handleBlogUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	if s3Client == nil {
		http.Error(w, "Upload de imagem não configurado no servidor (faltam as variáveis do R2).", http.StatusServiceUnavailable)
		return
	}
	if !allowRateLimit("upload:"+clientIP(r), uploadsPerMinute, time.Now()) {
		w.Header().Set("Retry-After", "60")
		http.Error(w, "Muitos envios em pouco tempo. Tente de novo em instantes.", http.StatusTooManyRequests)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes+(1<<20)) // + folga do multipart
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, "Arquivo maior que 8MB ou formulário inválido.", http.StatusRequestEntityTooLarge)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Envie o arquivo no campo 'file'.", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
	if err != nil {
		http.Error(w, "Não foi possível ler o arquivo.", http.StatusInternalServerError)
		return
	}
	if len(data) > maxUploadBytes {
		http.Error(w, "Arquivo maior que 8MB.", http.StatusRequestEntityTooLarge)
		return
	}
	contentType := sniffImage(data)
	if contentType == "" {
		http.Error(w, "Formato não aceito. Envie JPEG, PNG, GIF ou WebP.", http.StatusUnsupportedMediaType)
		return
	}
	if err := checkDimensions(data); err != nil {
		http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
		return
	}

	out := processImage(data, contentType)
	key := uploadKey(out.Ext)

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(r2Bucket),
		Key:          aws.String(key),
		Body:         bytes.NewReader(out.Data),
		ContentType:  aws.String(out.ContentType),
		CacheControl: aws.String("public, max-age=31536000, immutable"), // o nome nunca se repete
	})
	if err != nil {
		log.Println("Erro ao subir pro R2:", err)
		http.Error(w, "Não foi possível subir a imagem pro storage.", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"url":%q}`, fmt.Sprintf("%s/%s", r2PublicURL, key))
}
