package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// D6 (WP3b): o destino da captura pública depende de CRM_API. Sem banco: troca o `leadSaver`
// pelo despachante real com as duas gravações substituídas por espiões.

func TestLeadSaverEscolhePeloFlag(t *testing.T) {
	orig := leadSaver
	t.Cleanup(func() { leadSaver = orig })

	var v2, legacy int
	oldV2, oldLegacy := saveV2Fn, saveLegacyFn
	saveV2Fn = func(leadInput, string) error { v2++; return nil }
	saveLegacyFn = func(leadInput) error { legacy++; return nil }
	t.Cleanup(func() { saveV2Fn, saveLegacyFn = oldV2, oldLegacy })

	t.Setenv("CRM_API", "")
	if err := leadSaver(leadInput{}, "1.1.1.1"); err != nil || legacy != 1 || v2 != 0 {
		t.Fatalf("sem flag deve usar o caminho antigo: legacy=%d v2=%d err=%v", legacy, v2, err)
	}
	t.Setenv("CRM_API", "1")
	if err := leadSaver(leadInput{}, "1.1.1.1"); err != nil || legacy != 1 || v2 != 1 {
		t.Fatalf("com flag deve criar Lead v2: legacy=%d v2=%d err=%v", legacy, v2, err)
	}
}

// O handler grava pelo despachante e responde 201; o IP repassado é o do cliente.
func TestHandlePublicLeadChamaODestino(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "https://kalidash.com.br")
	t.Setenv("SITE_URL", "")
	orig := leadSaver
	t.Cleanup(func() { leadSaver = orig })
	var got leadInput
	var gotIP string
	leadSaver = func(in leadInput, ip string) error { got, gotIP = in, ip; return nil }

	body := `{"name":" Ana Souza ","email":"ANA@x.com","phone":"(11) 99999-9999","challenge":"quero vender mais","source":"home"}`
	req := httptest.NewRequest("POST", "/api/public/leads", strings.NewReader(body))
	req.Header.Set("Origin", "https://kalidash.com.br")
	req.Header.Set("X-Forwarded-For", "9.9.9.1")
	rec := httptest.NewRecorder()
	handlePublicLead(rec, req)
	if rec.Code != 201 || got.Email != "ana@x.com" || got.Name != "Ana Souza" || got.Source != "home" || gotIP != "9.9.9.1" {
		t.Fatalf("handler: %d %+v ip=%q", rec.Code, got, gotIP)
	}
}
