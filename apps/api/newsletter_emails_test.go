package main

import (
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func newsletterMailEnv(t *testing.T) {
	t.Setenv("RESEND_API_KEY", "re_test")
	t.Setenv("NEWSLETTER_FROM", "Carol, da Kalidash <carol@kalidash.com>")
	t.Setenv("NEWSLETTER_REPLY_TO", "")
	t.Setenv("SITE_URL", "https://kalidash.com/")
	t.Setenv("NEWSLETTER_MATERIAL_URLS", "como-calcular-roi-de-ia=https://notion.so/kit ; agentes-de-ia=javascript:alert(1)")
	t.Setenv("RESEND_NEWSLETTER_SEGMENT_ID", "seg-news")
	t.Setenv("RESEND_MATERIAL_SEGMENT_ID", "")
}

func TestNewsletterMailOffWithoutSender(t *testing.T) {
	newsletterMailEnv(t)
	t.Setenv("NEWSLETTER_FROM", "")
	if _, ok := newsletterMailFor(leadInput{Name: "Ana Ribeiro", Source: "blog-newsletter-topo"}); ok {
		t.Fatal("sem NEWSLETTER_FROM nada deve ser enviado")
	}
}

func TestNewsletterMailWelcome(t *testing.T) {
	newsletterMailEnv(t)
	m, ok := newsletterMailFor(leadInput{Name: "Ana Maria Ribeiro", Source: "blog-newsletter-artigo"})
	if !ok || m.Material != nil {
		t.Fatalf("queria boas-vindas: ok=%v %+v", ok, m)
	}
	if m.First != "Ana" || len(m.Reads) != 3 {
		t.Fatalf("nome ou leituras: %+v", m)
	}
	if !strings.HasPrefix(m.Reads[0].URL, "https://kalidash.com/blog/") || !strings.Contains(m.Reads[0].URL, "utm_campaign=boas-vindas") {
		t.Fatalf("link sem base ou UTM: %s", m.Reads[0].URL)
	}
	html, text, err := renderNewsletterMail(m)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Que bom ter você por aqui", "Olá, Ana", "Para começar", "#diagnostico"} {
		if !strings.Contains(html, want) {
			t.Fatalf("HTML sem %q", want)
		}
	}
	if !strings.Contains(text, "Olá, Ana") || strings.Contains(text, "<") {
		t.Fatalf("versão em texto: %s", text)
	}
	if len(html) > 102<<10 {
		t.Fatalf("HTML com %d bytes: o Gmail corta acima de 102 KB", len(html))
	}
}

func TestNewsletterMailMaterial(t *testing.T) {
	newsletterMailEnv(t)
	m, ok := newsletterMailFor(leadInput{Name: "Ana", Source: "blog-newsletter-material-como-calcular-roi-de-ia"})
	if !ok || m.Material == nil {
		t.Fatalf("queria o e-mail do material: ok=%v", ok)
	}
	if m.Material.URL != "https://notion.so/kit" || !strings.Contains(m.Subject, "Kit de Priorização") {
		t.Fatalf("material: %+v / %s", m.Material, m.Subject)
	}
	html, _, err := renderNewsletterMail(m)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(html, `href="https://notion.so/kit"`) || !strings.Contains(html, "Abrir o material") {
		t.Fatal("HTML sem o link do material")
	}
}

// Material sem link (ou com link que não é http/https) segue como hoje: a equipe manda à mão.
func TestNewsletterMailMaterialWithoutLink(t *testing.T) {
	newsletterMailEnv(t)
	for _, src := range []string{"blog-newsletter-material-agentes-de-ia", "blog-newsletter-material-engenharia-de-prompt", "blog-newsletter-material-nao-existe"} {
		if _, ok := newsletterMailFor(leadInput{Name: "Ana", Source: src}); ok {
			t.Fatalf("%s: não deveria mandar e-mail sem link válido", src)
		}
	}
}

func TestNewsletterMailEscapesName(t *testing.T) {
	newsletterMailEnv(t)
	m, _ := newsletterMailFor(leadInput{Name: `<script>x</script> Silva`, Source: "blog-newsletter-topo"})
	html, _, err := renderNewsletterMail(m)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(html, "<script>x") {
		t.Fatal("nome do inscrito precisa sair escapado no HTML")
	}
}

func TestSendNewsletterMailPayload(t *testing.T) {
	newsletterMailEnv(t)
	calls := stubResendContacts(t, http.StatusOK)
	m, _ := newsletterMailFor(leadInput{Name: "Ana", Source: "blog-newsletter-topo"})
	if err := sendNewsletterMail("ana@empresa.com", m); err != nil {
		t.Fatal(err)
	}
	if len(*calls) != 1 || (*calls)[0].path != "/emails" {
		t.Fatalf("chamadas: %+v", *calls)
	}
	body := (*calls)[0].body.(map[string]any)
	if body["reply_to"] != "Carol, da Kalidash <carol@kalidash.com>" || body["text"] == "" {
		t.Fatalf("payload: %+v", body)
	}
	if h := body["headers"].(map[string]string)["List-Unsubscribe"]; h != "<mailto:carol@kalidash.com?subject=sair>" {
		t.Fatalf("List-Unsubscribe: %q", h)
	}
}

// Boas-vindas só para quem é novo no Resend; material vai sempre.
func TestDispatchNewsletterWelcomeOnlyForNewContact(t *testing.T) {
	newsletterMailEnv(t)
	run := func(source string, contactStatus int) []string {
		var mu sync.Mutex
		var paths []string
		done := make(chan struct{}, 4)
		orig := resendDo
		t.Cleanup(func() { resendDo = orig })
		resendDo = func(method, path string, body any) (int, error) {
			mu.Lock()
			paths = append(paths, path)
			mu.Unlock()
			done <- struct{}{}
			if path == "/contacts" {
				return contactStatus, nil
			}
			return http.StatusOK, nil
		}
		dispatchNewsletter(leadInput{Name: "Ana", Email: "ana@empresa.com", Source: source})
		want := 2
		if contactStatus == http.StatusConflict {
			want = 2 // contato + inclusão no segmento
			if strings.Contains(source, "material") {
				want = 3
			}
		}
		for i := 0; i < want; i++ {
			select {
			case <-done:
			case <-time.After(2 * time.Second):
				t.Fatalf("%s: esperava %d chamadas, veio %v", source, want, paths)
			}
		}
		time.Sleep(50 * time.Millisecond) // nada além do esperado
		mu.Lock()
		defer mu.Unlock()
		return append([]string(nil), paths...)
	}

	if got := run("blog-newsletter-topo", http.StatusOK); len(got) != 2 || got[1] != "/emails" {
		t.Fatalf("novo: %v", got)
	}
	if got := run("blog-newsletter-topo", http.StatusConflict); len(got) != 2 || got[1] == "/emails" {
		t.Fatalf("já inscrito não recebe boas-vindas de novo: %v", got)
	}
	if got := run("blog-newsletter-material-como-calcular-roi-de-ia", http.StatusConflict); len(got) != 3 || got[2] != "/emails" {
		t.Fatalf("material vai mesmo para quem já era inscrito: %v", got)
	}
}

func TestNewsletterEmailsPayload(t *testing.T) {
	newsletterMailEnv(t)
	t.Setenv("NEWSLETTER_FROM", "")
	p, err := newsletterEmailsPayload()
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Emails) != 3 || p.Emails[0].ID != "edicao" || p.Emails[1].ID != "boas-vindas" || p.Emails[2].ID != "material" {
		t.Fatalf("e-mails: %+v", p.Emails)
	}
	if !strings.Contains(p.Emails[0].HTML, "{{{RESEND_UNSUBSCRIBE_URL}}}") {
		t.Fatal("o modelo da edição precisa sair cru, com as variáveis do Resend")
	}
	if p.Emails[1].Active || len(p.Emails[1].Missing) == 0 {
		t.Fatal("sem remetente as boas-vindas ficam desligadas e dizem o que falta")
	}
	if !strings.Contains(p.Emails[2].HTML, "Kit de Priorização") {
		t.Fatal("a prévia do material usa o material que tem link")
	}
	if len(p.Materials) != len(newsletterMaterials) {
		t.Fatalf("materiais: %+v", p.Materials)
	}
	t.Setenv("NEWSLETTER_FROM", "Carol <carol@kalidash.com>")
	if p, _ = newsletterEmailsPayload(); !p.Emails[1].Active || !p.Emails[2].Active {
		t.Fatalf("com remetente e um link, os automáticos ficam ligados: %+v", p.Emails[1:])
	}
}
