package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSlugify(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"Éxito na Operação", "exito-na-operacao"},
		{"Öffnung", "offnung"},
		{"Avanço da IA na Operação!", "avanco-da-ia-na-operacao"},
		{"  espaços   extras  e   hífens--- ", "espacos-extras-e-hifens"},
		{"Crítica de Cinema & Cultura: O Retorno", "critica-de-cinema-cultura-o-retorno"},
		{"Über den Dächern", "uber-den-dachern"},
		{"À l'école des agents", "a-l-ecole-des-agents"},
		{"Straße und Fußgänger", "strasse-und-fussganger"},
		{"Caño de escape", "cano-de-escape"},
	}

	for _, c := range cases {
		got := slugify(c.in)
		if got != c.want {
			t.Errorf("slugify(%q) = %q, esperado %q", c.in, got, c.want)
		}
	}
}

func TestSlugifyDeterministicFallback(t *testing.T) {
	// Textos formados unicamente por símbolos, emojis ou pontuação devem produzir
	// um slug não vazio, determinístico e no formato artigo-<hash curto>.
	s1 := "??? !!! @@@"
	got1 := slugify(s1)
	got2 := slugify(s1)
	if got1 == "" {
		t.Errorf("slugify(%q) não deveria ser vazio", s1)
	}
	if got1 != got2 {
		t.Errorf("slugify(%q) deve ser determinístico: %q != %q", s1, got1, got2)
	}
	if len(got1) < 8 || got1[:7] != "artigo-" {
		t.Errorf("slugify(%q) deveria começar com 'artigo-', obteve %q", s1, got1)
	}

	// Emoji
	emojiSlug := slugify("🚀🤖💡")
	if emojiSlug == "" || emojiSlug[:7] != "artigo-" {
		t.Errorf("slugify emoji obteve %q", emojiSlug)
	}

	// Duas entradas diferentes produzem hashes diferentes
	s2 := "### $$$ %%%"
	if slugify(s1) == slugify(s2) {
		t.Errorf("entradas diferentes %q e %q produziram o mesmo slug determinístico", s1, s2)
	}
}

func TestReservedSlugs(t *testing.T) {
	reserved := []string{
		"blog-global",
		"novo",
		"editar",
		"preview",
		"settings",
		"feed",
		"rss",
		"categoria",
		"tag",
		"api",
		"Blog-Global",
		" NOVO ",
	}
	for _, s := range reserved {
		if !isReservedSlug(s) {
			t.Errorf("isReservedSlug(%q) deveria ser verdadeiro", s)
		}
	}

	notReserved := []string{
		"artigo-novo-sobre-ia",
		"como-editar-processos",
		"minha-configuracao",
		"exito-na-operacao",
	}
	for _, s := range notReserved {
		if isReservedSlug(s) {
			t.Errorf("isReservedSlug(%q) deveria ser falso", s)
		}
	}
}

func TestHandleBlogSlugAvailableReservedAndEmpty(t *testing.T) {
	// Slug vazio
	req := httptest.NewRequest(http.MethodGet, "/api/blog/slug-available?slug=", nil)
	w := httptest.NewRecorder()
	handleBlogSlugAvailable(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, esperado 200", w.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("erro ao decodificar resposta: %v", err)
	}
	if res["available"] != false || res["reason"] != "empty" {
		t.Errorf("esperava available:false, reason:empty; obteve %v", res)
	}

	// Slug reservado (blog-global)
	req2 := httptest.NewRequest(http.MethodGet, "/api/blog/slug-available?slug=blog-global", nil)
	w2 := httptest.NewRecorder()
	handleBlogSlugAvailable(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("status = %d, esperado 200", w2.Code)
	}
	var res2 map[string]any
	if err := json.Unmarshal(w2.Body.Bytes(), &res2); err != nil {
		t.Fatalf("erro ao decodificar resposta: %v", err)
	}
	if res2["available"] != false || res2["reason"] != "reserved" {
		t.Errorf("esperava available:false, reason:reserved; obteve %v", res2)
	}
}

func TestApplyGalleryHybridOrderEmpty(t *testing.T) {
	// Lista vazia devolve lista vazia sem erros
	out := applyGalleryHybridOrder(nil)
	if len(out) != 0 {
		t.Errorf("esperava lista vazia, obteve %d itens", len(out))
	}
}

func TestSlugAvailableExigeEscopoDoBlog(t *testing.T) {
	// slug-available cai na regra geral de /api/blog/: leitura -> blog:read, nunca pública.
	r := httptest.NewRequest(http.MethodGet, "/api/blog/slug-available?slug=x", nil)
	scope, public := routeScope(r)
	if scope != "blog:read" || public {
		t.Errorf("slug-available: scope=%q public=%v", scope, public)
	}
}

func TestSlugifyLetrasExtras(t *testing.T) {
	for in, want := range map[string]string{"Łódź": "lod", "Đà Nang": "da-nang", "Þór": "thor"} {
		if got := slugify(in); got != want {
			t.Errorf("slugify(%q) = %q, esperado %q", in, got, want)
		}
	}
}
