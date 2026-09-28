package main

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
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
)

// Upload de imagem pro Cloudflare R2 (compatível com S3). Ver docs/security-and-cms.md
// "Problema 1: Upload de Imagens Pesadas" — a solução descrita ali é exatamente esta:
// rejeitar arquivo grande demais, redimensionar e comprimir antes de subir, devolver só a URL.
const maxUploadBytes = 8 << 20 // 8MB brutos aceitos na entrada (a saída processada fica bem menor)
const maxImageWidth = 2000     // px — nenhuma imagem de blog precisa ser mais larga que isso

var s3Client *s3.Client
var r2Bucket string
var r2PublicURL string

func initStorage() {
	accountID := os.Getenv("R2_ACCOUNT_ID")
	accessKey := os.Getenv("R2_ACCESS_KEY_ID")
	secretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	r2Bucket = os.Getenv("R2_BUCKET")
	r2PublicURL = strings.TrimSuffix(os.Getenv("R2_PUBLIC_URL"), "/")

	if accountID == "" || accessKey == "" || secretKey == "" || r2Bucket == "" || r2PublicURL == "" {
		log.Println("⚠️  R2 não configurado (faltam R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET/R2_PUBLIC_URL no .env) — upload de imagem do blog fica indisponível até configurar.")
		return
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)
	s3Client = s3.New(s3.Options{
		Region:       "auto",
		BaseEndpoint: aws.String(endpoint),
		Credentials:  credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
	})
	fmt.Println("✅ Cloudflare R2 configurado (upload de imagem do blog liberado)")
}

// processImage: decodifica, redimensiona se estiver larga demais e recomprime como JPEG.
// Formatos que a stdlib não decodifica (ex.: WebP já otimizado) sobem sem processar — melhor
// aceitar como veio do que recusar uma imagem válida.
func processImage(data []byte, contentType string) ([]byte, string) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data, contentType
	}
	if img.Bounds().Dx() > maxImageWidth {
		img = imaging.Resize(img, maxImageWidth, 0, imaging.Lanczos)
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
		return data, contentType
	}
	return buf.Bytes(), "image/jpeg"
}

func handleBlogUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	if s3Client == nil {
		http.Error(w, "Upload de imagem não configurado no servidor (faltam as variáveis do R2 no .env).", http.StatusServiceUnavailable)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, "Arquivo maior que 8MB ou formulário inválido.", http.StatusRequestEntityTooLarge)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Envie o arquivo no campo 'file'.", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		http.Error(w, "Só imagens são aceitas.", http.StatusBadRequest)
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Não foi possível ler o arquivo.", http.StatusInternalServerError)
		return
	}

	processed, finalType := processImage(data, contentType)
	ext := "jpg"
	switch finalType {
	case "image/png":
		ext = "png"
	case "image/gif":
		ext = "gif"
	case "image/webp":
		ext = "webp"
	}
	key := fmt.Sprintf("blog/%d.%s", time.Now().UnixNano(), ext)

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	_, err = s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r2Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(processed),
		ContentType: aws.String(finalType),
	})
	if err != nil {
		log.Println("Erro ao subir pro R2:", err)
		http.Error(w, "Não foi possível subir a imagem pro storage.", http.StatusBadGateway)
		return
	}

	url := fmt.Sprintf("%s/%s", r2PublicURL, key)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"url":%q}`, url)
}
