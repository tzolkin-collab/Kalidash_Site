package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

// Utilidades do CRM (pessoas, empresas e leads): datas flexíveis, documentos (CPF/CNPJ) com
// validação e criptografia, listas JSON e paginação. Espelham apps/admin/src/lib/documents.ts.

// ---- datas ----

// FlexTime lê RFC3339 ou só a data (2026-10-05) e escreve sempre RFC3339 em UTC.
type FlexTime struct{ time.Time }

func (t *FlexTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		t.Time = time.Time{}
		return nil
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05", "2006-01-02"} {
		if v, err := time.Parse(layout, s); err == nil {
			t.Time = v
			return nil
		}
	}
	return fmt.Errorf("data inválida: %q", s)
}

func (t FlexTime) MarshalJSON() ([]byte, error) { return json.Marshal(t.UTC().Format(time.RFC3339)) }

// ptrTime devolve nil para a data zero (vira NULL no banco e some do JSON).
func ptrTime(t *FlexTime) any {
	if t == nil || t.IsZero() {
		return nil
	}
	return t.Time
}

func flexFrom(s string) *FlexTime {
	if s == "" {
		return nil
	}
	if t := parseDT(s); !t.IsZero() {
		return &FlexTime{t}
	}
	return nil
}

// ---- documentos ----

var altNum = regexp.MustCompile(`[^0-9A-Za-z]`)

// stripDoc deixa só letras e números em maiúsculas (CNPJ alfanumérico desde 31/07/2026).
func stripDoc(raw string) string { return strings.ToUpper(altNum.ReplaceAllString(raw, "")) }

func onlyDigits(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func allSame(s string) bool {
	for i := 1; i < len(s); i++ {
		if s[i] != s[0] {
			return false
		}
	}
	return len(s) > 0
}

func isValidCPF(raw string) bool {
	d := onlyDigits(raw)
	if len(d) != 11 || allSame(d) {
		return false
	}
	digit := func(n int) int {
		sum := 0
		for i := 0; i < n; i++ {
			sum += int(d[i]-'0') * (n + 1 - i)
		}
		r := (sum * 10) % 11
		if r == 10 {
			return 0
		}
		return r
	}
	return digit(9) == int(d[9]-'0') && digit(10) == int(d[10]-'0')
}

func isValidCNPJ(raw string) bool {
	c := stripDoc(raw)
	if len(c) != 14 || allSame(c) {
		return false
	}
	for i, r := range c {
		if i >= 12 && (r < '0' || r > '9') {
			return false
		}
		if !(r >= '0' && r <= '9') && !(r >= 'A' && r <= 'Z') {
			return false
		}
	}
	digit := func(n int) int {
		weights := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
		if n == 12 {
			weights = []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
		}
		sum := 0
		for i, w := range weights {
			sum += int(c[i]-'0') * w
		}
		r := sum % 11
		if r < 2 {
			return 0
		}
		return 11 - r
	}
	return digit(12) == int(c[12]-'0') && digit(13) == int(c[13]-'0')
}

func formatCPF(raw string) string {
	d := onlyDigits(raw)
	if len(d) != 11 {
		return raw
	}
	return d[:3] + "." + d[3:6] + "." + d[6:9] + "-" + d[9:]
}

// maskCPF: só os dois últimos dígitos aparecem ("•••.•••.•••-35").
func maskCPF(raw string) string {
	d := onlyDigits(raw)
	if len(d) != 11 {
		return "•••"
	}
	return "•••.•••.•••-" + d[9:]
}

func isMasked(s string) bool { return strings.ContainsAny(s, "•*") }

// ---- criptografia do CPF (AES-256-GCM) ----

var errNoKey = errors.New("o servidor não tem DATA_KEY configurada (32 bytes em hex ou base64)")

// dataKey lê DATA_KEY (64 caracteres hex ou base64 de 32 bytes). Sem ela, CPF não é aceito.
func dataKey() ([]byte, error) {
	raw := strings.TrimSpace(os.Getenv("DATA_KEY"))
	if raw == "" {
		return nil, errNoKey
	}
	if b, err := hex.DecodeString(raw); err == nil && len(b) == 32 {
		return b, nil
	}
	if b, err := base64.StdEncoding.DecodeString(raw); err == nil && len(b) == 32 {
		return b, nil
	}
	return nil, errors.New("DATA_KEY inválida: use 32 bytes em hex (64 caracteres) ou base64")
}

func encryptDoc(plain string) (string, error) {
	key, err := dataKey()
	if err != nil {
		return "", err
	}
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(plain), nil)), nil
}

func decryptDoc(enc string) (string, error) {
	key, err := dataKey()
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("documento corrompido")
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	return string(plain), err
}

// docHash identifica o documento sem guardá-lo (acha duplicado): HMAC-SHA256 com a mesma chave.
func docHash(digits string) (string, error) {
	key, err := dataKey()
	if err != nil {
		return "", err
	}
	m := hmac.New(sha256.New, key)
	m.Write([]byte(digits))
	return hex.EncodeToString(m.Sum(nil)), nil
}

// ---- listas e JSON opcional ----

type ContactPoint struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// jsonOrNull guarda nil/vazio como NULL e o resto como JSON.
func jsonOrNull(v any) any {
	b, err := json.Marshal(v)
	if err != nil || string(b) == "null" || string(b) == "[]" || string(b) == "{}" {
		return nil
	}
	return b
}

func decodeJSON[T any](raw []byte, def T) T {
	if len(raw) == 0 {
		return def
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		return def
	}
	return out
}

func cleanStrings(in []string, max int) []string {
	out := []string{}
	for _, s := range in {
		if s = clean(s, max); s != "" {
			out = append(out, s)
		}
	}
	return out
}

// ---- paginação ----

type page struct{ limit, offset int }

func readPage(r *http.Request) page {
	p := page{limit: 200}
	q := r.URL.Query()
	if v := atoiOr(q.Get("limit"), 0); v > 0 {
		p.limit = v
	}
	if p.limit > 500 {
		p.limit = 500
	}
	p.offset = atoiOr(q.Get("offset"), 0)
	if p.offset < 0 {
		p.offset = 0
	}
	return p
}

func atoiOr(s string, def int) int {
	n := 0
	if s == "" {
		return def
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return def
		}
		n = n*10 + int(r-'0')
		if n > 1<<30 {
			return def
		}
	}
	return n
}
