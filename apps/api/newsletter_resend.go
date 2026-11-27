package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Newsletter do blog no Resend. A inscrição continua virando lead no CRM (public_leads.go); depois de gravar, a
// pessoa também entra como contato no Resend, no segmento da newsletter, e é por lá que a equipe monta e envia as
// edições (Broadcasts), com o descadastro do próprio Resend. Quem pediu um material gratuito entra também no
// segmento de materiais, se ele estiver configurado.
//
// Variáveis (sem RESEND_API_KEY ou sem RESEND_NEWSLETTER_SEGMENT_ID nada é enviado ao Resend):
//   RESEND_API_KEY                  a mesma chave do envio de teste (emails.go)
//   RESEND_NEWSLETTER_SEGMENT_ID    segmento "Newsletter do blog"
//   RESEND_MATERIAL_SEGMENT_ID      opcional: segmento de quem pediu material gratuito
//
// O envio ao Resend roda depois da resposta ao site e nunca derruba a inscrição: se falhar, fica no log e o lead
// segue no CRM (a página Newsletter do admin exporta a lista para reimportar).

const resendAPI = "https://api.resend.com"

type newsletterContact struct {
	Email    string
	First    string
	Last     string
	Segments []string
}

// newsletterContactFor monta o contato a partir da inscrição; ok=false quando o Resend não está configurado.
func newsletterContactFor(in leadInput) (newsletterContact, bool) {
	seg := strings.TrimSpace(os.Getenv("RESEND_NEWSLETTER_SEGMENT_ID"))
	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) == "" || seg == "" {
		return newsletterContact{}, false
	}
	c := newsletterContact{Email: in.Email, Segments: []string{seg}}
	if parts := strings.Fields(in.Name); len(parts) > 0 {
		c.First, c.Last = parts[0], strings.Join(parts[1:], " ")
	}
	if mat := strings.TrimSpace(os.Getenv("RESEND_MATERIAL_SEGMENT_ID")); mat != "" && strings.HasPrefix(in.Source, newsletterSource+"-material") {
		c.Segments = append(c.Segments, mat)
	}
	return c, true
}

// resendDo é trocável nos testes: nenhum teste fala com o Resend de verdade.
var resendDo = func(method, path string, body any) (int, error) {
	var rd io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, resendAPI+path, rd)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("RESEND_API_KEY"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return 0, errors.New("sem conexão com o Resend")
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	return resp.StatusCode, nil
}

// syncNewsletterContact cria o contato já nos segmentos. Se o e-mail já existe no Resend (409/422), só o coloca nos
// segmentos: não mexe no "unsubscribed", para não reinscrever quem já saiu da lista. created diz se o contato é novo
// (só quem é novo recebe as boas-vindas, newsletter_emails.go).
func syncNewsletterContact(c newsletterContact) (created bool, err error) {
	segs := make([]map[string]string, 0, len(c.Segments))
	for _, s := range c.Segments {
		segs = append(segs, map[string]string{"id": s})
	}
	body := map[string]any{"email": c.Email, "segments": segs}
	if c.First != "" {
		body["first_name"] = c.First
	}
	if c.Last != "" {
		body["last_name"] = c.Last
	}
	status, err := resendDo(http.MethodPost, "/contacts", body)
	if err != nil {
		return false, err
	}
	switch {
	case status >= 200 && status < 300:
		return true, nil
	case status == http.StatusConflict || status == http.StatusUnprocessableEntity:
		for _, s := range c.Segments {
			st, err := resendDo(http.MethodPost, "/contacts/"+url.PathEscape(c.Email)+"/segments/"+url.PathEscape(s), nil)
			if err != nil {
				return false, err
			}
			if st >= 300 {
				return false, fmt.Errorf("o Resend recusou incluir o contato no segmento (%d)", st)
			}
		}
		return false, nil
	default:
		return false, fmt.Errorf("o Resend recusou o contato (%d)", status)
	}
}

// dispatchNewsletter roda depois da resposta ao site (trocável nos testes). O log não leva o e-mail.
// Ordem: contato no segmento e, em seguida, o e-mail automático (boas-vindas a quem é novo, ou o material pedido).
var dispatchNewsletter = func(in leadInput) {
	c, contactOK := newsletterContactFor(in)
	mail, mailOK := newsletterMailFor(in)
	if !contactOK && !mailOK {
		return
	}
	go func() {
		created := false
		if contactOK {
			var err error
			if created, err = syncNewsletterContact(c); err != nil {
				log.Printf("⚠️ newsletter → Resend (%s): %v", in.Source, err)
			}
		}
		// Boas-vindas só para contato novo; o material vai sempre que foi pedido.
		if mailOK && (mail.Material != nil || created) {
			if err := sendNewsletterMail(in.Email, mail); err != nil {
				log.Printf("⚠️ newsletter → e-mail automático (%s): %v", in.Source, err)
			}
		}
	}()
}
