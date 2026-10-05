package main

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func jpegBytes(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 120, 255})
		}
	}
	var b bytes.Buffer
	_ = jpeg.Encode(&b, img, &jpeg.Options{Quality: 90})
	return b.Bytes()
}

func pngBytes(w, h int, alpha uint8) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.NRGBA{200, 30, 30, alpha})
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

// withExifOrientation insere um APP1/Exif com a orientação logo depois do SOI do JPEG.
func withExifOrientation(jpg []byte, orientation uint16) []byte {
	tiff := []byte{'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1} // cabeçalho big-endian, IFD0 com 1 entrada
	entry := make([]byte, 12)
	binary.BigEndian.PutUint16(entry[0:], 0x0112) // Orientation
	binary.BigEndian.PutUint16(entry[2:], 3)      // SHORT
	binary.BigEndian.PutUint32(entry[4:], 1)
	binary.BigEndian.PutUint16(entry[8:], orientation)
	tiff = append(tiff, entry...)
	tiff = append(tiff, 0, 0, 0, 0) // sem próximo IFD
	payload := append([]byte("Exif\x00\x00"), tiff...)
	seg := []byte{0xFF, 0xE1, byte((len(payload) + 2) >> 8), byte((len(payload) + 2) & 0xFF)}
	seg = append(seg, payload...)
	return append(append(append([]byte{}, jpg[:2]...), seg...), jpg[2:]...)
}

// pngHeaderOnly: assinatura + IHDR declarando w×h (o suficiente para o DecodeConfig).
func pngHeaderOnly(w, h uint32) []byte {
	var b bytes.Buffer
	b.Write([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], w)
	binary.BigEndian.PutUint32(ihdr[4:], h)
	ihdr[8], ihdr[9] = 8, 2 // 8 bits, RGB
	_ = binary.Write(&b, binary.BigEndian, uint32(13))
	chunk := append([]byte("IHDR"), ihdr...)
	b.Write(chunk)
	_ = binary.Write(&b, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return b.Bytes()
}

func dims(t *testing.T, data []byte) (int, int, string) {
	t.Helper()
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("saída não é imagem: %v", err)
	}
	return cfg.Width, cfg.Height, format
}

func TestSniffImage(t *testing.T) {
	var g bytes.Buffer
	_ = gif.Encode(&g, image.NewPaletted(image.Rect(0, 0, 4, 4), color.Palette{color.Black, color.White}), nil)
	cases := map[string]struct {
		data []byte
		want string
	}{
		"jpeg":  {jpegBytes(10, 10), "image/jpeg"},
		"png":   {pngBytes(4, 4, 255), "image/png"},
		"gif":   {g.Bytes(), "image/gif"},
		"webp":  {append([]byte("RIFF\x24\x00\x00\x00WEBPVP8 "), make([]byte, 40)...), "image/webp"},
		"svg":   {[]byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`), ""},
		"html":  {[]byte(`<html><script>alert(1)</script></html>`), ""},
		"txt":   {[]byte("só texto"), ""},
		"vazio": {nil, ""},
	}
	for name, c := range cases {
		if got := sniffImage(c.data); got != c.want {
			t.Errorf("%s: %q (queria %q)", name, got, c.want)
		}
	}
}

func TestProcessImage(t *testing.T) {
	// JPEG largo é reduzido a 2000 px e continua JPEG
	out := processImage(jpegBytes(3000, 1000), "image/jpeg")
	if w, h, f := dims(t, out.Data); w != 2000 || h != 667 || f != "jpeg" || out.ContentType != "image/jpeg" || out.Ext != "jpg" {
		t.Errorf("jpeg largo: %dx%d %s %+v", w, h, f, out.ContentType)
	}
	// JPEG pequeno não é ampliado
	if w, _, _ := dims(t, processImage(jpegBytes(300, 200), "image/jpeg").Data); w != 300 {
		t.Errorf("não deve ampliar: %d", w)
	}
	// PNG com transparência continua PNG e mantém o alfa
	tr := processImage(pngBytes(50, 50, 0), "image/png")
	if _, _, f := dims(t, tr.Data); f != "png" || tr.ContentType != "image/png" || tr.Ext != "png" {
		t.Errorf("png transparente deveria seguir png: %s %s", f, tr.ContentType)
	}
	img, _ := png.Decode(bytes.NewReader(tr.Data))
	if _, _, _, a := img.At(10, 10).RGBA(); a != 0 {
		t.Errorf("a transparência se perdeu (alfa %d)", a)
	}
	// PNG opaco vira JPEG
	op := processImage(pngBytes(50, 50, 255), "image/png")
	if _, _, f := dims(t, op.Data); f != "jpeg" || op.ContentType != "image/jpeg" || op.Ext != "jpg" {
		t.Errorf("png opaco deveria virar jpeg: %s", f)
	}
	// GIF sobe como veio (pode ser animado)
	var g bytes.Buffer
	_ = gif.EncodeAll(&g, &gif.GIF{Image: []*image.Paletted{image.NewPaletted(image.Rect(0, 0, 8, 8), color.Palette{color.Black, color.White}), image.NewPaletted(image.Rect(0, 0, 8, 8), color.Palette{color.Black, color.White})}, Delay: []int{5, 5}})
	if gi := processImage(g.Bytes(), "image/gif"); !bytes.Equal(gi.Data, g.Bytes()) || gi.Ext != "gif" {
		t.Error("GIF deve subir intacto")
	}
	// ilegível: devolve o original em vez de recusar
	junk := []byte("\xff\xd8\xff\xe0 não é um jpeg de verdade")
	if r := processImage(junk, "image/jpeg"); !bytes.Equal(r.Data, junk) {
		t.Error("ilegível deve voltar como veio")
	}
}

func TestOrientacaoEXIF(t *testing.T) {
	// 200×100 com orientação 6 (girar 90° horário): a foto de celular "em pé" precisa sair 100×200
	in := withExifOrientation(jpegBytes(200, 100), 6)
	if w, h, _ := dims(t, in); w != 200 || h != 100 {
		t.Fatalf("pré-condição: %dx%d", w, h)
	}
	out := processImage(in, "image/jpeg")
	if w, h, _ := dims(t, out.Data); w != 100 || h != 200 {
		t.Errorf("a orientação EXIF deveria ser aplicada: saiu %dx%d", w, h)
	}
}

func TestBombaDeDescompressao(t *testing.T) {
	if err := checkDimensions(pngHeaderOnly(30000, 30000)); err == nil {
		t.Error("PNG de 900 megapixels deveria ser recusado")
	}
	if err := checkDimensions(pngHeaderOnly(6000, 6000)); err != nil {
		t.Errorf("36 megapixels cabe no limite: %v", err)
	}
	if err := checkDimensions(jpegBytes(100, 100)); err != nil {
		t.Errorf("imagem comum: %v", err)
	}
	if err := checkDimensions([]byte("não é imagem")); err != nil {
		t.Errorf("formato que a stdlib não lê segue para o limite de bytes: %v", err)
	}
}

// ---- handler contra um S3 falso (a requisição vem assinada de verdade pelo SDK) ----

type fakeS3 struct {
	mu     sync.Mutex
	puts   []fakePut
	status int
}
type fakePut struct {
	path, contentType, cacheControl, auth string
	body                                  []byte
}

func newFakeS3(t *testing.T) (*fakeS3, *httptest.Server) {
	t.Helper()
	f := &fakeS3{status: 200}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		f.mu.Lock()
		defer f.mu.Unlock()
		if r.Method == http.MethodPut && f.status == 200 {
			f.puts = append(f.puts, fakePut{r.URL.Path, r.Header.Get("Content-Type"), r.Header.Get("Cache-Control"), r.Header.Get("Authorization"), body})
		}
		w.WriteHeader(f.status)
	}))
	t.Cleanup(srv.Close)
	return f, srv
}

func uploadReq(t *testing.T, ip, field, name string, data []byte, partType string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	h := make(map[string][]string)
	h["Content-Disposition"] = []string{`form-data; name="` + field + `"; filename="` + name + `"`}
	h["Content-Type"] = []string{partType}
	part, _ := mw.CreatePart(h)
	part.Write(data)
	mw.Close()
	r := httptest.NewRequest(http.MethodPost, "/api/blog/upload", &buf)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	r.Header.Set("X-Forwarded-For", ip)
	return r
}

func TestHandlerDeUpload(t *testing.T) {
	fake, srv := newFakeS3(t)
	t.Cleanup(func() { s3Client = nil })
	do := func(r *http.Request) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		handleBlogUpload(rec, r)
		return rec
	}

	// desligado: sem as variáveis do R2
	s3Client = nil
	if c := do(uploadReq(t, "7.0.0.1", "file", "a.jpg", jpegBytes(10, 10), "image/jpeg")).Code; c != 503 {
		t.Errorf("sem R2: %d", c)
	}
	if !configureStorage(storageConfig{Endpoint: srv.URL, AccessKey: "AKTESTE", SecretKey: "segredo", Bucket: "kalidash-blog", PublicURL: "https://cdn.exemplo.com/"}) {
		t.Fatal("configureStorage deveria aceitar o endpoint de teste")
	}
	if configureStorage(storageConfig{AccessKey: "a", SecretKey: "b", Bucket: "c", PublicURL: "d"}) || s3Client != nil {
		t.Error("sem conta nem endpoint deve ficar desligado")
	}
	configureStorage(storageConfig{Endpoint: srv.URL, AccessKey: "AKTESTE", SecretKey: "segredo", Bucket: "kalidash-blog", PublicURL: "https://cdn.exemplo.com/"})

	// caminho feliz: JPEG de 3000 px vira 2000 px, sobe com cache longo e devolve a URL pública
	rec := do(uploadReq(t, "7.0.0.2", "file", "foto.jpg", jpegBytes(3000, 1000), "image/jpeg"))
	if rec.Code != 200 {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body)
	}
	if len(fake.puts) != 1 {
		t.Fatalf("esperava 1 PUT, vieram %d", len(fake.puts))
	}
	p := fake.puts[0]
	if !strings.HasPrefix(p.path, "/kalidash-blog/blog/") || !strings.HasSuffix(p.path, ".jpg") || p.contentType != "image/jpeg" || p.cacheControl != "public, max-age=31536000, immutable" || !strings.HasPrefix(p.auth, "AWS4-HMAC-SHA256") {
		t.Errorf("PUT inesperado: %+v", p)
	}
	if w, _, _ := dims(t, p.body); w != 2000 {
		t.Errorf("a imagem deveria ter sido reduzida: %d", w)
	}
	key := strings.TrimPrefix(p.path, "/kalidash-blog/")
	if !strings.Contains(rec.Body.String(), `"url":"https://cdn.exemplo.com/`+key+`"`) {
		t.Errorf("URL pública errada: %s (chave %s)", rec.Body, key)
	}

	// PNG com transparência sobe como PNG
	fake.puts = nil
	if c := do(uploadReq(t, "7.0.0.3", "file", "logo.png", pngBytes(40, 40, 0), "image/png")).Code; c != 200 || !strings.HasSuffix(fake.puts[0].path, ".png") || fake.puts[0].contentType != "image/png" {
		t.Errorf("png transparente: %d %+v", c, fake.puts)
	}

	// o que não é imagem aceita é recusado SEM chegar no storage, mesmo mentindo no cabeçalho
	fake.puts = nil
	bad := map[string][]byte{
		"svg com script": []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"html":           []byte(`<html><script>alert(1)</script></html>`),
		"texto":          []byte("não sou imagem"),
	}
	for name, data := range bad {
		if c := do(uploadReq(t, "7.0.0.4", "file", "x.png", data, "image/png")).Code; c != 415 {
			t.Errorf("%s: %d (queria 415)", name, c)
		}
	}
	if c := do(uploadReq(t, "7.0.0.4", "file", "bomba.png", pngHeaderOnly(30000, 30000), "image/png")).Code; c != 413 {
		t.Errorf("bomba de descompressão: %d", c)
	}
	if len(fake.puts) != 0 {
		t.Errorf("nada disso podia chegar ao storage: %d PUTs", len(fake.puts))
	}

	// campo errado, método errado, arquivo grande demais
	if c := do(uploadReq(t, "7.0.0.5", "outro", "a.jpg", jpegBytes(10, 10), "image/jpeg")).Code; c != 400 {
		t.Errorf("campo errado: %d", c)
	}
	get := httptest.NewRequest(http.MethodGet, "/api/blog/upload", nil)
	if c := do(get).Code; c != 405 {
		t.Errorf("GET: %d", c)
	}
	big := append(jpegBytes(10, 10), make([]byte, 9<<20)...)
	if c := do(uploadReq(t, "7.0.0.6", "file", "grande.jpg", big, "image/jpeg")).Code; c != 413 {
		t.Errorf("9 MB: %d", c)
	}

	// storage recusando (credencial errada, bucket inexistente): 502, sem vazar detalhe
	fake.status = 403
	rec = do(uploadReq(t, "7.0.0.7", "file", "a.jpg", jpegBytes(10, 10), "image/jpeg"))
	if rec.Code != 502 || strings.Contains(rec.Body.String(), "403") {
		t.Errorf("falha do storage: %d %s", rec.Code, rec.Body)
	}
	fake.status = 200

	// limite por IP: o 31º envio no minuto leva 429; outro IP não é afetado
	for i := 0; i < uploadsPerMinute; i++ {
		if c := do(uploadReq(t, "7.0.0.8", "file", "a.jpg", jpegBytes(8, 8), "image/jpeg")).Code; c != 200 {
			t.Fatalf("envio %d: %d", i+1, c)
		}
	}
	if c := do(uploadReq(t, "7.0.0.8", "file", "a.jpg", jpegBytes(8, 8), "image/jpeg")).Code; c != 429 {
		t.Errorf("deveria limitar: %d", c)
	}
	if c := do(uploadReq(t, "7.0.0.9", "file", "a.jpg", jpegBytes(8, 8), "image/jpeg")).Code; c != 200 {
		t.Errorf("outro IP: %d", c)
	}
}

func TestChavesDeUploadNaoRepetem(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 2000; i++ {
		k := uploadKey("jpg")
		if seen[k] || !strings.HasPrefix(k, "blog/") || !strings.HasSuffix(k, ".jpg") {
			t.Fatalf("chave repetida ou mal formada: %s", k)
		}
		seen[k] = true
	}
}
