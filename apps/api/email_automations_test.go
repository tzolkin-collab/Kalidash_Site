package main

import (
	"strings"
	"testing"
	"time"
)

func TestRenderTemplateEscapaHTMLESomeComChaveDesconhecida(t *testing.T) {
	vars := map[string]string{"nome": "Ana <b>", "primeiro_nome": "Ana"}
	got := renderTemplate("<p>Olá, {{ primeiro_nome }}! {{nome}} {{inexistente}}{{NOME}}</p>", vars, true)
	want := "<p>Olá, Ana! Ana &lt;b&gt; Ana &lt;b&gt;</p>"
	if got != want {
		t.Errorf("html: %q, queria %q", got, want)
	}
	if got := renderTemplate("Oi {{nome}}", map[string]string{"nome": "A\r\nBcc: x"}, false); strings.ContainsAny(got, "\r\n") {
		t.Errorf("assunto não pode ter quebra de linha: %q", got)
	}
	if got := renderTemplate("sem fim {{nome", vars, true); got != "sem fim {{nome" {
		t.Errorf("chave sem fechamento fica como está: %q", got)
	}
}

func TestRetryDelayProgressivo(t *testing.T) {
	prev := time.Duration(0)
	for i := 1; i <= emailMaxAttempts; i++ {
		d := retryDelay(i)
		if d < prev {
			t.Errorf("tentativa %d: %s menor que a anterior %s", i, d, prev)
		}
		prev = d
	}
	if retryDelay(1) != time.Minute || retryDelay(4) != 2*time.Hour {
		t.Errorf("escada esperada 1 min … 2 h")
	}
}

func TestCatalogoDeFluxos(t *testing.T) {
	seen := map[string]bool{}
	events := map[string]bool{"lead.criado": true, "newsletter.inscrito": true, "oportunidade.ganha": true}
	for _, f := range emailFlows {
		if seen[f.ID] {
			t.Errorf("fluxo repetido: %s", f.ID)
		}
		seen[f.ID] = true
		if !events[f.Event] {
			t.Errorf("%s usa um evento que o servidor não emite: %s", f.ID, f.Event)
		}
		if f.DefaultDelay < 0 || f.DefaultDelay > emailMaxDelayMinutes {
			t.Errorf("%s: atraso padrão fora do limite", f.ID)
		}
	}
}

func TestEventoDaCapturaPelaOrigem(t *testing.T) {
	if got := emailEventForSource(newsletterSource); got != "newsletter.inscrito" {
		t.Errorf("newsletter: %s", got)
	}
	if got := emailEventForSource("home-diagnostico"); got != "lead.criado" {
		t.Errorf("formulário: %s", got)
	}
}

func TestValidaModelo(t *testing.T) {
	ok := EmailTemplateDTO{Name: " Boas-vindas ", Subject: "Oi {{primeiro_nome}}", HTML: "<p>x</p>"}
	if err := validateEmailTemplate(&ok); err != nil || ok.Name != "Boas-vindas" {
		t.Fatalf("modelo válido recusado: %v", err)
	}
	for _, bad := range []EmailTemplateDTO{
		{Name: "", Subject: "a", HTML: "x"},
		{Name: "a", Subject: "linha\nquebrada", HTML: "x"},
		{Name: "a", Subject: "a", HTML: "   "},
		{Name: "a", Subject: "a", HTML: "x", Design: []byte("{quebrado")},
	} {
		b := bad
		if validateEmailTemplate(&b) == nil {
			t.Errorf("deveria recusar %+v", bad)
		}
	}
}

func TestSemFlagNadaEntraNaFila(t *testing.T) {
	t.Setenv("EMAIL_AUTOMATIONS", "")
	n, err := enqueueEmailEvent(nil, emailEvent{Event: "lead.criado", To: "a@b.com"}, time.Now())
	if n != 0 || err != nil {
		t.Errorf("sem EMAIL_AUTOMATIONS nada deveria tocar o banco: %d %v", n, err)
	}
}
