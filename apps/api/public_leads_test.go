package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestValidateLead(t *testing.T) {
	ok := leadInput{Name: "  Ana Souza ", Email: "ANA@Empresa.com", Phone: "(11) 99999-9999"}
	got, msg := validateLead(ok)
	if msg != "" || got.Email != "ana@empresa.com" || got.Name != "Ana Souza" || got.Source != "site" {
		t.Fatalf("válido rejeitado/normalizado errado: %+v %q", got, msg)
	}
	bad := map[string]leadInput{
		"sobrenome": {Name: "Ana", Email: "a@b.co", Phone: "11999999999"},
		"email":     {Name: "Ana Souza", Email: "ana@", Phone: "11999999999"},
		"telefone":  {Name: "Ana Souza", Email: "a@b.co", Phone: "123"},
	}
	for name, in := range bad {
		if _, msg := validateLead(in); msg == "" {
			t.Errorf("%s: deveria falhar", name)
		}
	}
}

func TestCleanLimitsAndControl(t *testing.T) {
	if got := clean("a\x00b\x07c", 10); got != "abc" {
		t.Errorf("controle não removido: %q", got)
	}
	if got := clean("ççççç", 3); got != "ççç" {
		t.Errorf("corte em runes errado: %q", got)
	}
}

func TestAllowRate(t *testing.T) {
	now := time.Now()
	for i := 0; i < leadRatePerMin; i++ {
		if !allowRate("1.2.3.4", now) {
			t.Fatalf("tentativa %d deveria passar", i+1)
		}
	}
	if allowRate("1.2.3.4", now) {
		t.Error("excedeu o limite e passou")
	}
	if !allowRate("5.6.7.8", now) {
		t.Error("outro IP não deveria ser afetado")
	}
	if !allowRate("1.2.3.4", now.Add(61*time.Second)) {
		t.Error("janela deveria ter liberado")
	}
}

func TestOriginAllowed(t *testing.T) {
	list := []string{"https://kalidash.com.br", "https://*.vercel.app"}
	cases := map[string]bool{
		"https://kalidash.com.br":            true,
		"https://kalidash-site-x.vercel.app": true,
		"https://evil.com":                   false,
		"https://vercel.app.evil.com":        false,
		"http://kalidash-site-x.vercel.app":  false,
		"https://evilvercel.app":             false,
	}
	for o, want := range cases {
		if got := originAllowed(o, list); got != want {
			t.Errorf("%s: got %v want %v", o, got, want)
		}
	}
	if !originAllowed("https://qualquer.com", nil) {
		t.Error("sem configuração deve aceitar (dev)")
	}
}

// Caminhos do handler que não tocam o banco (validação, honeypot, origem, método).
func TestHandlePublicLeadNoDB(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://kalidash.com.br")
	t.Setenv("SITE_URL", "")
	do := func(method, origin, ip, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/api/public/leads", strings.NewReader(body))
		req.Header.Set("X-Forwarded-For", ip)
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		rec := httptest.NewRecorder()
		handlePublicLead(rec, req)
		return rec
	}
	if c := do("POST", "https://evil.com", "9.0.0.1", `{}`).Code; c != 403 {
		t.Errorf("origem ruim: %d", c)
	}
	if c := do("GET", "https://kalidash.com.br", "9.0.0.2", ``).Code; c != 405 {
		t.Errorf("método: %d", c)
	}
	if c := do("POST", "https://kalidash.com.br", "9.0.0.3", `{"name":"Ana","email":"x","phone":"1"}`).Code; c != 422 {
		t.Errorf("validação: %d", c)
	}
	if c := do("POST", "https://kalidash.com.br", "9.0.0.4", `{"website":"http://spam"}`).Code; c != 201 {
		t.Errorf("honeypot deve responder 201 sem gravar: %d", c)
	}
	big := `{"challenge":"` + strings.Repeat("x", leadBodyLimit) + `"}`
	if c := do("POST", "https://kalidash.com.br", "9.0.0.5", big).Code; c != 400 {
		t.Errorf("corpo grande: %d", c)
	}
	var last int
	for i := 0; i < leadRatePerMin+1; i++ {
		last = do("POST", "https://kalidash.com.br", "9.0.0.6", `{}`).Code
	}
	if last != 429 {
		t.Errorf("limite de taxa: %d", last)
	}
	if c := do("OPTIONS", "https://kalidash.com.br", "9.0.0.7", ``).Code; c != 204 {
		t.Errorf("preflight: %d", c)
	}
}
