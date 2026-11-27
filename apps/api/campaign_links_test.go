package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type memLinks struct {
	mu    sync.Mutex
	links []*CampaignLink
	gone  map[string]bool
	leads map[utmKey]int
}

func newMemLinks() *memLinks { return &memLinks{gone: map[string]bool{}, leads: map[utmKey]int{}} }

func (s *memLinks) List() ([]CampaignLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []CampaignLink{}
	for _, l := range s.links {
		if !s.gone[l.ID] {
			out = append(out, *l)
		}
	}
	return out, nil
}
func (s *memLinks) ByFingerprint(fp string) (CampaignLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, l := range s.links {
		if l.fingerprint == fp && !s.gone[l.ID] {
			return *l, nil
		}
	}
	return CampaignLink{}, errNotFound
}
func (s *memLinks) Create(l *CampaignLink) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	l.ID, l.Code, l.CreatedAt = "lnk_"+newLinkCode(12), newLinkCode(6), &FlexTime{time.Now()}
	c := *l
	s.links = append(s.links, &c)
	return nil
}
func (s *memLinks) Resolve(code string, count bool) (CampaignLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, l := range s.links {
		if l.Code == code && !s.gone[l.ID] {
			if count {
				l.Clicks++
			}
			return *l, nil
		}
	}
	return CampaignLink{}, errNotFound
}
func (s *memLinks) Archive(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.gone[id] = true
	return nil
}
func (s *memLinks) LeadCounts() (map[utmKey]int, error) { return s.leads, nil }

func useMemLinks(t *testing.T) *memLinks {
	old := campaignLinks
	s := newMemLinks()
	campaignLinks = s
	t.Cleanup(func() { campaignLinks = old })
	return s
}

func TestNormalizeDestination(t *testing.T) {
	ok := map[string]string{
		"":                                    "/",
		"/blog/guia-ia":                       "/blog/guia-ia",
		"blog/guia-ia":                        "/blog/guia-ia",
		"https://kalidash.com.br/diagnostico": "/diagnostico",
		"https://www.kalidash.com.br/blog/x?utm_source=velho&ref=a#topo": "/blog/x?ref=a#topo",
	}
	for in, want := range ok {
		got, err := normalizeDestination(in)
		if err != nil || got != want {
			t.Errorf("normalizeDestination(%q) = %q, %v; queria %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"https://evil.com/x", "//evil.com", "/\\evil.com", "javascript:alert(1)", "https://kalidash.com.br.evil.com/"} {
		if got, err := normalizeDestination(bad); err == nil {
			t.Errorf("normalizeDestination(%q) deveria recusar, deu %q", bad, got)
		}
	}
}

func postLink(body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", "/api/blog/links", strings.NewReader(body))
	rec := httptest.NewRecorder()
	handleCampaignLinks(rec, req)
	return rec
}

// Criar: UTMs na convenção, mesmo destino + mesmas UTMs devolve o mesmo link (sem duplicar).
func TestCampaignLinkCreateOnce(t *testing.T) {
	s := useMemLinks(t)
	body := `{"destination":"/blog/guia-ia","utm_source":"Instagram","utm_medium":"social","utm_campaign":"Guia IA","utm_content":"stories","label":"Instagram — stories"}`
	first, again := postLink(body), postLink(body)
	if first.Code != 201 || again.Code != 200 {
		t.Fatalf("códigos: %d %d (%s)", first.Code, again.Code, first.Body)
	}
	var a, b CampaignLink
	_ = json.Unmarshal(first.Body.Bytes(), &a)
	_ = json.Unmarshal(again.Body.Bytes(), &b)
	if a.Code == "" || a.Code != b.Code || len(s.links) != 1 {
		t.Errorf("deveria ser o mesmo link: %q %q (%d)", a.Code, b.Code, len(s.links))
	}
	if a.UTMSource != "instagram" || a.UTMCampaign != "guia_ia" || a.Destination != "/blog/guia-ia" {
		t.Errorf("link: %+v", a)
	}
	if rec := postLink(`{"destination":"https://evil.com","utm_source":"x","utm_medium":"y","utm_campaign":"z"}`); rec.Code != 422 {
		t.Errorf("destino de fora: %d", rec.Code)
	}
	if rec := postLink(`{"destination":"/","utm_source":"instagram"}`); rec.Code != 422 {
		t.Errorf("sem medium/campaign: %d", rec.Code)
	}

	// Lista com leads casados pelas UTMs.
	s.leads[utmKey{"instagram", "social", "guia_ia", "stories"}] = 3
	rec := httptest.NewRecorder()
	handleCampaignLinks(rec, httptest.NewRequest("GET", "/api/blog/links", nil))
	var list []CampaignLink
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 || list[0].Leads == nil || *list[0].Leads != 3 {
		t.Errorf("lista: %s", rec.Body)
	}
}

// Link curto: o site recebe destino + UTMs, o clique conta; arquivado vira 404.
func TestPublicLinkResolve(t *testing.T) {
	s := useMemLinks(t)
	rec := postLink(`{"destination":"/diagnostico","utm_source":"whatsapp","utm_medium":"messaging","utm_campaign":"diagnostico","utm_content":"grupo"}`)
	var l CampaignLink
	_ = json.Unmarshal(rec.Body.Bytes(), &l)

	get := func(code string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/api/public/links/"+code, nil)
		req.SetPathValue("code", code)
		rec := httptest.NewRecorder()
		handlePublicLink(rec, req)
		return rec
	}
	got := get(strings.ToUpper(l.Code)) // código digitado em maiúsculas também vale
	if got.Code != 200 || !strings.Contains(got.Body.String(), `"destination":"/diagnostico"`) || !strings.Contains(got.Body.String(), `"utm_content":"grupo"`) {
		t.Fatalf("resolve: %d %s", got.Code, got.Body)
	}
	if s.links[0].Clicks != 1 {
		t.Errorf("cliques: %d", s.links[0].Clicks)
	}
	bot := httptest.NewRequest("GET", "/api/public/links/"+l.Code, nil)
	bot.SetPathValue("code", l.Code)
	bot.Header.Set("X-Client-User-Agent", "WhatsApp/2.23.20.0 A")
	brec := httptest.NewRecorder()
	handlePublicLink(brec, bot)
	if brec.Code != 200 || s.links[0].Clicks != 1 {
		t.Errorf("prévia do WhatsApp segue o link mas não conta clique: %d, cliques %d", brec.Code, s.links[0].Clicks)
	}
	if rec := get("nao-existe"); rec.Code != 404 {
		t.Errorf("código inválido: %d", rec.Code)
	}
	del := httptest.NewRequest("DELETE", "/api/blog/links/"+l.ID, nil)
	del.SetPathValue("id", l.ID)
	drec := httptest.NewRecorder()
	handleCampaignLinkByID(drec, del)
	if drec.Code != 204 || get(l.Code).Code != 404 {
		t.Errorf("arquivar: %d", drec.Code)
	}
}

func TestPublicLinkRouteScope(t *testing.T) {
	if _, public := routeScope(httptest.NewRequest("GET", "/api/public/links/abc123", nil)); !public {
		t.Error("GET do link curto deveria ser público")
	}
	if _, public := routeScope(httptest.NewRequest("POST", "/api/public/links/abc123", nil)); public {
		t.Error("só GET é público")
	}
	if scope, _ := routeScope(httptest.NewRequest(http.MethodPost, "/api/blog/links", nil)); scope != "blog:write" {
		t.Errorf("criar link: %q", scope)
	}
}

// Recarregar o link não infla: mesmo IP conta uma vez em 10 minutos, e cada código tem teto por minuto.
func TestCountClickDedupeETeto(t *testing.T) {
	clickMu.Lock()
	clickSeen, clickMin = map[string]time.Time{}, map[string][]time.Time{}
	clickMu.Unlock()
	now := time.Date(2026, 11, 26, 10, 0, 0, 0, time.UTC)
	if !countClick("abc123", "1.1.1.1", now) || countClick("abc123", "1.1.1.1", now.Add(time.Minute)) {
		t.Fatal("mesmo IP devia contar uma vez")
	}
	if !countClick("abc123", "1.1.1.1", now.Add(11*time.Minute)) {
		t.Error("depois de 10 minutos conta de novo")
	}
	if !countClick("outro1", "1.1.1.1", now) {
		t.Error("outro código conta à parte")
	}
	later := now.Add(time.Hour)
	counted := 0
	for i := 0; i < clickCapPerMinute+10; i++ {
		if countClick("teto01", fmt.Sprintf("10.0.0.%d", i), later) {
			counted++
		}
	}
	if counted != clickCapPerMinute {
		t.Errorf("teto por minuto: %d", counted)
	}
}
