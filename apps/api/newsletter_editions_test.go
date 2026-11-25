package main

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestToBroadcastHTMLTrocaVariaveisEPoeDescadastro(t *testing.T) {
	got := toBroadcastHTML(`<html><body><p>Oi, {{primeiro_nome}} ({{ email }})</p>{{oportunidade}}</body></html>`)
	for _, want := range []string{"Oi, {{{FIRST_NAME|}}} ({{{EMAIL}}})", unsubscribeToken, "data-unsubscribe"} {
		if !strings.Contains(got, want) {
			t.Errorf("faltou %q em %s", want, got)
		}
	}
	if strings.Index(got, "data-unsubscribe") > strings.Index(got, "</body>") {
		t.Error("o rodapé deve entrar antes de </body>")
	}
	if strings.Contains(got, "{{primeiro_nome}}") {
		t.Error("variável do Kalidash sobrou")
	}
}

func TestToResendVarsNoAssunto(t *testing.T) {
	if got := toResendVars("{{primeiro_nome}}, saiu o guia {{{FIRST_NAME|}}}"); got != "{{{FIRST_NAME|}}}, saiu o guia {{{FIRST_NAME|}}}" {
		t.Errorf("assunto: %q", got)
	}
}

func TestToBroadcastHTMLRespeitaDescadastroDoModelo(t *testing.T) {
	in := `<p>{{{FIRST_NAME|amigo}}}</p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">sair</a>`
	got := toBroadcastHTML(in)
	if got != in {
		t.Errorf("modelo já no formato do Resend não deve mudar: %s", got)
	}
}

func TestToTestHTMLPreencheComQuemTesta(t *testing.T) {
	got := toTestHTML(`<p>Oi, {{primeiro_nome}}</p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">sair</a>`, map[string]string{"primeiro_nome": "Ana <x>"})
	if !strings.Contains(got, "Oi, Ana &lt;x&gt;") || strings.Contains(got, "RESEND_UNSUBSCRIBE_URL") || !strings.Contains(got, `href="#"`) {
		t.Errorf("teste mal montado: %s", got)
	}
}

func TestSendBroadcastCriaEEnviaOuAgenda(t *testing.T) {
	t.Setenv("RESEND_API_KEY", "re_test")
	t.Setenv("RESEND_FROM_EMAIL", "Blog <blog@exemplo.com>")
	orig := resendJSON
	defer func() { resendJSON = orig }()
	var calls []string
	var sendBody map[string]any
	resendJSON = func(method, path string, body, out any) (int, string, error) {
		calls = append(calls, method+" "+path)
		if path == "/broadcasts" {
			b := body.(map[string]any)
			if b["segment_id"] != "seg1" || b["preview_text"] != "prévia" {
				t.Errorf("corpo do broadcast: %v", b)
			}
			out.(*struct {
				ID string `json:"id"`
			}).ID = "b1"
			return 201, "", nil
		}
		sendBody = body.(map[string]any)
		return 200, "", nil
	}
	when := time.Date(2030, 1, 2, 12, 0, 0, 0, time.UTC)
	id, err := sendBroadcast("seg1", "Edição 1", "Assunto", "prévia", "<p>x</p>", &when)
	if err != nil || id != "b1" {
		t.Fatalf("id=%q err=%v", id, err)
	}
	if strings.Join(calls, ",") != "POST /broadcasts,POST /broadcasts/b1/send" {
		t.Errorf("chamadas: %v", calls)
	}
	if sendBody["scheduled_at"] != "2030-01-02T12:00:00Z" {
		t.Errorf("agendamento: %v", sendBody)
	}

	resendJSON = func(method, path string, body, out any) (int, string, error) { return 422, "segment not found", nil }
	if _, err := sendBroadcast("seg1", "E", "A", "", "<p>x</p>", nil); err == nil || !strings.Contains(err.Error(), "segment not found") {
		t.Errorf("erro do Resend deve chegar à tela: %v", err)
	}
	resendJSON = func(method, path string, body, out any) (int, string, error) { return 0, "", errors.New("sem conexão com o Resend") }
	if _, err := sendBroadcast("seg1", "E", "A", "", "<p>x</p>", nil); err == nil {
		t.Error("falha de rede deve virar erro")
	}
}

func TestSendBroadcastSemConfiguracao(t *testing.T) {
	t.Setenv("RESEND_API_KEY", "")
	if _, err := sendBroadcast("seg1", "E", "A", "", "<p>x</p>", nil); err == nil {
		t.Error("sem chave não deve enviar")
	}
}

func TestValidateEditionPublicoEAssunto(t *testing.T) {
	in := editionInput{Subject: "Linha\nquebrada", Audience: "newsletter"}
	if err := validateEdition(&in); err == nil {
		t.Error("assunto com quebra de linha")
	}
	in = editionInput{Subject: "Ok", Audience: "todo-mundo"}
	if err := validateEdition(&in); err == nil {
		t.Error("público desconhecido")
	}
}
