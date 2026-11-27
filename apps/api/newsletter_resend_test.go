package main

import (
	"net/http"
	"reflect"
	"testing"
)

type resendContactCall struct {
	method, path string
	body         any
}

func stubResendContacts(t *testing.T, statuses ...int) *[]resendContactCall {
	t.Helper()
	calls := &[]resendContactCall{}
	orig := resendDo
	t.Cleanup(func() { resendDo = orig })
	resendDo = func(method, path string, body any) (int, error) {
		*calls = append(*calls, resendContactCall{method, path, body})
		if i := len(*calls) - 1; i < len(statuses) {
			return statuses[i], nil
		}
		return http.StatusOK, nil
	}
	return calls
}

func TestNewsletterContactFor(t *testing.T) {
	in := leadInput{Name: "Ana Maria Ribeiro", Email: "ana@empresa.com", Source: "blog-newsletter-topo"}

	t.Setenv("RESEND_API_KEY", "")
	t.Setenv("RESEND_NEWSLETTER_SEGMENT_ID", "seg-news")
	if _, ok := newsletterContactFor(in); ok {
		t.Fatal("sem RESEND_API_KEY não deveria enviar")
	}

	t.Setenv("RESEND_API_KEY", "re_test")
	t.Setenv("RESEND_NEWSLETTER_SEGMENT_ID", "")
	if _, ok := newsletterContactFor(in); ok {
		t.Fatal("sem segmento não deveria enviar")
	}

	t.Setenv("RESEND_NEWSLETTER_SEGMENT_ID", "seg-news")
	t.Setenv("RESEND_MATERIAL_SEGMENT_ID", "seg-mat")
	c, ok := newsletterContactFor(in)
	if !ok || c.First != "Ana" || c.Last != "Maria Ribeiro" || !reflect.DeepEqual(c.Segments, []string{"seg-news"}) {
		t.Fatalf("contato inesperado: %+v ok=%v", c, ok)
	}

	in.Source = "blog-newsletter-material-agentes-de-ia"
	c, _ = newsletterContactFor(in)
	if !reflect.DeepEqual(c.Segments, []string{"seg-news", "seg-mat"}) {
		t.Fatalf("material deveria entrar nos dois segmentos: %v", c.Segments)
	}
}

func TestSyncNewsletterContactCreates(t *testing.T) {
	calls := stubResendContacts(t, http.StatusOK)
	created, err := syncNewsletterContact(newsletterContact{Email: "ana@empresa.com", First: "Ana", Last: "Ribeiro", Segments: []string{"seg-news"}})
	if err != nil {
		t.Fatal(err)
	}
	if !created {
		t.Fatal("contato novo deveria voltar created=true")
	}
	if len(*calls) != 1 || (*calls)[0].method != http.MethodPost || (*calls)[0].path != "/contacts" {
		t.Fatalf("chamadas: %+v", *calls)
	}
	body := (*calls)[0].body.(map[string]any)
	if _, has := body["unsubscribed"]; has {
		t.Fatal("não deve mandar unsubscribed")
	}
	if body["first_name"] != "Ana" || body["last_name"] != "Ribeiro" {
		t.Fatalf("nome: %+v", body)
	}
}

// Contato que já existe no Resend: só entra nos segmentos, sem reinscrever quem saiu.
func TestSyncNewsletterContactExisting(t *testing.T) {
	calls := stubResendContacts(t, http.StatusConflict, http.StatusOK, http.StatusOK)
	created, err := syncNewsletterContact(newsletterContact{Email: "ana@empresa.com", Segments: []string{"seg-news", "seg-mat"}})
	if err != nil {
		t.Fatal(err)
	}
	if created {
		t.Fatal("contato que já existia não é novo: não recebe boas-vindas de novo")
	}
	want := []string{"/contacts", "/contacts/ana@empresa.com/segments/seg-news", "/contacts/ana@empresa.com/segments/seg-mat"}
	if len(*calls) != len(want) {
		t.Fatalf("chamadas: %+v", *calls)
	}
	for i, p := range want {
		if (*calls)[i].path != p {
			t.Fatalf("chamada %d: %s, queria %s", i, (*calls)[i].path, p)
		}
	}
}

func TestSyncNewsletterContactRefused(t *testing.T) {
	stubResendContacts(t, http.StatusUnauthorized)
	if _, err := syncNewsletterContact(newsletterContact{Email: "ana@empresa.com", Segments: []string{"seg-news"}}); err == nil {
		t.Fatal("401 do Resend deveria virar erro")
	}
}
