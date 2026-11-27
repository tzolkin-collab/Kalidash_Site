package main

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"strings"
)

// E-mails automáticos da newsletter (escopo do MVP, docs/newsletter/README.md):
//   - boas-vindas: para quem se inscreve pela primeira vez (contato novo no Resend), em forma de carta;
//   - material: para quem pediu um "Material gratuito" num artigo, com o link do material.
// As edições mensais NÃO saem daqui: são Broadcasts no Resend, com o modelo emails/edicao.html (o admin mostra e copia
// os três em Newsletter > E-mails, pela rota GET /api/newsletter/emails, newsletter_admin.go).
//
// Variáveis (sem RESEND_API_KEY ou NEWSLETTER_FROM nenhum destes e-mails é enviado):
//   NEWSLETTER_FROM            remetente, ex.: "Carol, da Kalidash <carol@kalidash.com>" (domínio verificado no Resend)
//   NEWSLETTER_REPLY_TO        opcional: para onde vão as respostas (padrão: o próprio remetente)
//   NEWSLETTER_MATERIAL_URLS   opcional: "slug=url;slug=url" com o link de cada material. Material sem link segue
//                              como hoje: a equipe manda à mão (a página Newsletter do admin lista quem pediu).
//   SITE_URL                   base dos links para o blog (padrão https://kalidash.com)

//go:embed emails/newsletter.html emails/edicao.html
var newsletterEmailFS embed.FS

var newsletterTmpl = template.Must(template.ParseFS(newsletterEmailFS, "emails/newsletter.html"))

type newsletterLink struct{ Kicker, Title, Line, URL string }

type newsletterMaterial struct{ Title, Line, URL, ArticleURL string }

type newsletterMail struct {
	Subject   string
	Preheader string
	First     string
	SiteURL   string
	Material  *newsletterMaterial // nil = boas-vindas
	Reads     []newsletterLink
	DiagURL   string
}

// newsletterMaterials: os "Material gratuito" publicados nos artigos (o slug do artigo é o sufixo da origem
// blog-newsletter-material-<slug>). Material novo num artigo: acrescente aqui e o link em NEWSLETTER_MATERIAL_URLS.
var newsletterMaterials = map[string]newsletterMaterial{
	"por-que-projetos-de-ia-falham": {Title: "Como preparar sua operação para a era dos agentes", Line: "O guia executivo em 7 módulos, na ordem em que as decisões precisam ser tomadas."},
	"como-calcular-roi-de-ia":       {Title: "O Kit de Priorização de IA", Line: "As quatro ferramentas que a Kalidash usa em todo diagnóstico, para duplicar no seu Notion."},
	"agentes-de-ia":                 {Title: "Playbook de Construção de Agentes de IA", Line: "O resumo visual do guia, em PDF de alta resolução, para levar para a reunião com o time."},
	"chatgpt-vs-claude-vs-gemini":   {Title: "Guia de Uso das Principais LLMs do Mercado para Líderes", Line: "O mapa de 8 IAs, com recorte Brasil e LGPD: forte, fraco e caso ideal de cada uma."},
	"engenharia-de-prompt":          {Title: "O Guia Completo de Técnicas de Prompt", Line: "O infográfico com as 9 técnicas, para consultar sempre que for escrever um prompt importante."},
}

// newsletterStarter: os três artigos das boas-vindas (escolha editorial; troque quando houver um melhor).
var newsletterStarter = []newsletterLink{
	{Kicker: "Advisory", Title: "Por que projetos de IA falham (e como evitar)", Line: "Os erros que travam a adoção antes de qualquer resultado.", URL: "/blog/por-que-projetos-de-ia-falham"},
	{Kicker: "Advisory", Title: "Como calcular o ROI de IA", Line: "Com a calculadora grátis para levar um número à diretoria.", URL: "/blog/como-calcular-roi-de-ia"},
	{Kicker: "AI Culture", Title: "Agentes de IA: o que são e como criar um", Line: "Do conceito ao primeiro agente rodando na operação.", URL: "/blog/agentes-de-ia"},
}

func newsletterSiteURL() string {
	if u := strings.TrimRight(strings.TrimSpace(os.Getenv("SITE_URL")), "/"); u != "" {
		return u
	}
	return "https://kalidash.com"
}

func utm(u, campaign string) string {
	sep := "?"
	if strings.Contains(u, "?") {
		sep = "&"
	}
	return u + sep + "utm_source=newsletter&utm_medium=email&utm_campaign=" + campaign
}

// materialURLs lê NEWSLETTER_MATERIAL_URLS ("slug=url;slug=url"). Só aceita http(s).
func materialURLs() map[string]string {
	out := map[string]string{}
	for _, pair := range strings.Split(os.Getenv("NEWSLETTER_MATERIAL_URLS"), ";") {
		slug, u, ok := strings.Cut(strings.TrimSpace(pair), "=")
		slug, u = strings.TrimSpace(slug), strings.TrimSpace(u)
		if ok && slug != "" && (strings.HasPrefix(u, "https://") || strings.HasPrefix(u, "http://")) {
			out[slug] = u
		}
	}
	return out
}

// newsletterMailFor monta o e-mail automático da inscrição; ok=false quando não há o que mandar (sem remetente,
// sem chave, ou material sem link configurado).
func newsletterMailFor(in leadInput) (newsletterMail, bool) {
	if !newsletterMailOn() {
		return newsletterMail{}, false
	}
	return buildNewsletterMail(in, materialURLs())
}

// newsletterMailOn: os automáticos só saem com a chave do Resend e o remetente configurados.
func newsletterMailOn() bool {
	return strings.TrimSpace(os.Getenv("RESEND_API_KEY")) != "" && strings.TrimSpace(os.Getenv("NEWSLETTER_FROM")) != ""
}

// buildNewsletterMail monta o e-mail sem olhar a configuração de envio (o admin usa para a pré-visualização).
func buildNewsletterMail(in leadInput, links map[string]string) (newsletterMail, bool) {
	site := newsletterSiteURL()
	m := newsletterMail{SiteURL: site}
	if parts := strings.Fields(in.Name); len(parts) > 0 {
		m.First = parts[0]
	}
	if slug, isMaterial := strings.CutPrefix(in.Source, newsletterSource+"-material-"); isMaterial {
		mat, known := newsletterMaterials[slug]
		link := links[slug]
		if !known || link == "" {
			return newsletterMail{}, false
		}
		mat.URL = link
		mat.ArticleURL = utm(site+"/blog/"+slug, "material")
		m.Material = &mat
		m.Subject = "Seu material: " + mat.Title
		m.Preheader = "O link está aqui dentro. Bom proveito."
		m.DiagURL = utm(site+"/", "material") + "#diagnostico"
		return m, true
	}
	m.Subject = "Boas-vindas à newsletter da Kalidash"
	m.Preheader = "Uma vez por mês, o que importa para preparar sua operação para IA."
	for _, r := range newsletterStarter {
		r.URL = utm(site+r.URL, "boas-vindas")
		m.Reads = append(m.Reads, r)
	}
	m.DiagURL = utm(site+"/", "boas-vindas") + "#diagnostico"
	return m, true
}

// renderNewsletterMail devolve o HTML e a versão em texto (o texto ajuda na entrega e em leitores de tela).
func renderNewsletterMail(m newsletterMail) (html, text string, err error) {
	var buf bytes.Buffer
	if err := newsletterTmpl.Execute(&buf, m); err != nil {
		return "", "", err
	}
	var t strings.Builder
	hello := "Olá"
	if m.First != "" {
		hello = "Olá, " + m.First
	}
	fmt.Fprintf(&t, "%s,\n\n", hello)
	if m.Material != nil {
		fmt.Fprintf(&t, "Aqui está o material que você pediu: %s.\n%s\n\nAbrir o material: %s\n\nO artigo de onde ele saiu: %s\n\n", m.Material.Title, m.Material.Line, m.Material.URL, m.Material.ArticleURL)
		t.WriteString("Você também passa a receber a newsletter da Kalidash: uma vez por mês, o que importa para preparar sua operação para IA.\n\n")
	} else {
		t.WriteString("Que bom ter você por aqui. Uma vez por mês, eu mando o que importa para preparar sua operação para IA: o que estamos vendo nos clientes, os artigos novos do blog e um material para usar no dia a dia. Leitura de 3 minutos.\n\nPara começar, três textos que os leitores mais usam:\n\n")
		for _, r := range m.Reads {
			fmt.Fprintf(&t, "- %s: %s\n  %s\n", r.Title, r.Line, r.URL)
		}
		t.WriteString("\nSe quiser me contar qual desafio da sua operação você quer ver por aqui, é só responder este e-mail.\n\n")
	}
	fmt.Fprintf(&t, "Carol, Kalidash\n\nQuer saber onde a IA traz retorno primeiro na sua operação? Agende um diagnóstico: %s\n\nNão quer mais receber? Responda com \"sair\" e tiramos você da lista.\n", m.DiagURL)
	return buf.String(), t.String(), nil
}

// sendNewsletterMail envia um e-mail automático pelo Resend. "sair" por resposta é o descadastro destes e-mails
// (as edições têm o link de descadastro do próprio Resend).
func sendNewsletterMail(to string, m newsletterMail) error {
	html, text, err := renderNewsletterMail(m)
	if err != nil {
		return err
	}
	from := strings.TrimSpace(os.Getenv("NEWSLETTER_FROM"))
	reply := strings.TrimSpace(os.Getenv("NEWSLETTER_REPLY_TO"))
	if reply == "" {
		reply = from
	}
	body := map[string]any{
		"from": from, "to": []string{to}, "reply_to": reply,
		"subject": m.Subject, "html": html, "text": text,
	}
	if addr := mailAddress(reply); addr != "" {
		body["headers"] = map[string]string{"List-Unsubscribe": "<mailto:" + addr + "?subject=sair>"}
	}
	status, err := resendDo(http.MethodPost, "/emails", body)
	if err != nil {
		return err
	}
	if status >= 300 {
		return fmt.Errorf("o Resend recusou o e-mail (%d)", status)
	}
	return nil
}

// mailAddress tira o endereço de "Nome <a@b.com>" (ou devolve o próprio endereço).
func mailAddress(s string) string {
	if i, j := strings.LastIndex(s, "<"), strings.LastIndex(s, ">"); i >= 0 && j > i {
		s = s[i+1 : j]
	}
	s = strings.TrimSpace(s)
	if !strings.Contains(s, "@") {
		return ""
	}
	return s
}
