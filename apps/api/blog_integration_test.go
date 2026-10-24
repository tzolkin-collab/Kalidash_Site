package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

// Integração do blog contra MySQL de verdade (só com TEST_DSN, só localhost; recria a tabela Article).

func blogDB(t *testing.T) {
	t.Helper()
	integrationDB(t)
	// A API de produção abre o banco com parseTime=true; os testes do blog leem datas assim.
	dsn := os.Getenv("TEST_DSN")
	if !strings.Contains(dsn, "parseTime") {
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		d2, err := sql.Open("mysql", dsn+sep+"parseTime=true")
		if err != nil {
			t.Fatal(err)
		}
		db.Close()
		db = d2
		t.Cleanup(func() { d2.Close() })
	}
	db.Exec("DROP TABLE IF EXISTS Article")
	db.Exec("DROP TABLE IF EXISTS BlogSettings")
	ensureBlogSchema()
}

func blogCall(h http.HandlerFunc, method, path string, body any) (int, []byte) {
	var r *http.Request
	if body == nil {
		r = httptest.NewRequest(method, path, nil)
	} else {
		b, _ := json.Marshal(body)
		r = httptest.NewRequest(method, path, strings.NewReader(string(b)))
	}
	rec := httptest.NewRecorder()
	h(rec, r)
	return rec.Code, rec.Body.Bytes()
}

func blogCreate(t *testing.T, in map[string]any) Article {
	t.Helper()
	code, body := blogCall(handleBlogArticles, "POST", "/api/blog/articles", in)
	if code != http.StatusCreated {
		t.Fatalf("POST %v: %d %s", in["title"], code, body)
	}
	var a Article
	json.Unmarshal(body, &a)
	return a
}

func TestIntegrationBlogSlugs(t *testing.T) {
	blogDB(t)

	// POST sem slug: gera do título (maiúscula acentuada e outros alfabetos).
	a := blogCreate(t, map[string]any{"title": "Éxito na Operação", "published": true})
	if a.Slug != "exito-na-operacao" {
		t.Errorf("slug gerado = %q", a.Slug)
	}
	sym := blogCreate(t, map[string]any{"title": "🚀🤖💡"})
	if !strings.HasPrefix(sym.Slug, "artigo-") {
		t.Errorf("slug de só símbolos = %q", sym.Slug)
	}

	// POST com slug repetido -> 409 claro.
	code, body := blogCall(handleBlogArticles, "POST", "/api/blog/articles", map[string]any{"title": "Outro", "slug": "Exito na Operacao"})
	if code != http.StatusConflict || !strings.Contains(string(body), "Já existe") {
		t.Errorf("POST duplicado: %d %s", code, body)
	}

	// Slug reservado -> 409 em POST (inclusive o gerado do título) e em PUT.
	for _, in := range []map[string]any{
		{"title": "Qualquer", "slug": "blog-global"},
		{"title": "Blog Global"},
		{"title": "x", "slug": " NOVO "},
	} {
		if code, body := blogCall(handleBlogArticles, "POST", "/api/blog/articles", in); code != http.StatusConflict || !strings.Contains(string(body), "reservado") {
			t.Errorf("POST reservado %v: %d %s", in, code, body)
		}
	}
	code, body = blogCall(handleBlogArticles, "PUT", "/api/blog/articles", map[string]any{"id": a.ID, "title": a.Title, "slug": "blog-global"})
	if code != http.StatusConflict {
		t.Errorf("PUT reservado: %d %s", code, body)
	}
	t.Setenv("BLOG_RESERVED_SLUGS", "contato, Sobre")
	if code, _ := blogCall(handleBlogArticles, "POST", "/api/blog/articles", map[string]any{"title": "Sobre"}); code != http.StatusConflict {
		t.Errorf("reservado configurável não valeu: %d", code)
	}

	// PUT sem slug gera do título novo e nunca grava vazio.
	code, body = blogCall(handleBlogArticles, "PUT", "/api/blog/articles", map[string]any{"id": a.ID, "title": "Öffnung do Mercado", "slug": "  "})
	var up Article
	json.Unmarshal(body, &up)
	if code != 200 || up.Slug != "offnung-do-mercado" {
		t.Errorf("PUT sem slug: %d %s", code, body)
	}
	// PUT sem slug e sem título preserva o slug que já existia.
	code, body = blogCall(handleBlogArticles, "PUT", "/api/blog/articles", map[string]any{"id": a.ID})
	json.Unmarshal(body, &up)
	if code != 200 || up.Slug != "offnung-do-mercado" {
		t.Errorf("PUT sem slug e sem título: %d %s", code, body)
	}
	// PUT de outro artigo para um slug em uso -> 409; id inexistente -> 404.
	code, body = blogCall(handleBlogArticles, "PUT", "/api/blog/articles", map[string]any{"id": sym.ID, "title": "x", "slug": "offnung-do-mercado"})
	if code != http.StatusConflict || !strings.Contains(string(body), "Já existe") {
		t.Errorf("PUT conflito: %d %s", code, body)
	}
	if code, _ := blogCall(handleBlogArticles, "PUT", "/api/blog/articles", map[string]any{"id": "nao-existe", "title": "x"}); code != http.StatusNotFound {
		t.Errorf("PUT inexistente: %d", code)
	}

	// A Galeria (já existente com slug blog-global) continua salvável.
	db.Exec(`INSERT INTO Article (id,title,slug,excerpt,body,published,authorName,createdAt,updatedAt) VALUES ('g1','Galeria','blog-global','','',1,'',NOW(),NOW())`)
	if code, body := blogCall(handleBlogArticles, "PUT", "/api/blog/articles", map[string]any{"id": "g1", "title": "Galeria", "slug": "blog-global", "published": true}); code != 200 {
		t.Errorf("PUT da Galeria: %d %s", code, body)
	}

	// slug-available: livre, em uso, em uso por ele mesmo (exceptId), reservado, vazio, normalizado.
	avail := func(q string) map[string]any {
		code, body := blogCall(handleBlogSlugAvailable, "GET", "/api/blog/slug-available?"+q, nil)
		if code != 200 {
			t.Fatalf("slug-available %s: %d %s", q, code, body)
		}
		var m map[string]any
		json.Unmarshal(body, &m)
		return m
	}
	if m := avail("slug=livre-mesmo"); m["available"] != true {
		t.Errorf("livre: %v", m)
	}
	if m := avail("slug=offnung-do-mercado"); m["available"] != false || m["reason"] != "taken" {
		t.Errorf("em uso: %v", m)
	}
	if m := avail("slug=offnung-do-mercado&exceptId=" + a.ID); m["available"] != true {
		t.Errorf("exceptId: %v", m)
	}
	if m := avail("slug=Blog-Global"); m["reason"] != "reserved" || m["slug"] != "blog-global" {
		t.Errorf("reservado: %v", m)
	}
	if m := avail("slug="); m["reason"] != "empty" {
		t.Errorf("vazio: %v", m)
	}
	if m := avail("slug=Éxito%20Novo"); m["slug"] != "exito-novo" || m["available"] != true {
		t.Errorf("normalizado: %v", m)
	}
	if code, _ := blogCall(handleBlogSlugAvailable, "POST", "/api/blog/slug-available?slug=x", nil); code != http.StatusMethodNotAllowed {
		t.Errorf("método: %d", code)
	}
}

func TestIntegrationBlogGaleriaNaoDescartaArtigoNovo(t *testing.T) {
	blogDB(t)
	old := time.Now().Add(-72 * time.Hour)
	mid := time.Now().Add(-48 * time.Hour)
	ins := func(id, slug string, published int, at time.Time, featured int) {
		if _, err := db.Exec(`INSERT INTO Article (id,title,slug,excerpt,body,published,featured,authorName,createdAt,updatedAt,publishedAt) VALUES (?,?,?,'','',?,?,'',?,?,?)`,
			id, slug, slug, published, featured, at, at, at); err != nil {
			t.Fatal(err)
		}
	}
	ins("a1", "primeiro", 1, old, 0)
	ins("a2", "segundo", 1, mid, 0)
	ins("a3", "terceiro-destaque", 1, old.Add(time.Hour), 1)
	ins("rasc", "rascunho", 0, mid, 0)

	list := func() []string {
		code, body := blogCall(handleBlogArticles, "GET", "/api/blog/articles?published=true", nil)
		if code != 200 {
			t.Fatalf("GET: %d %s", code, body)
		}
		var arts []Article
		json.Unmarshal(body, &arts)
		ids := []string{}
		for _, a := range arts {
			ids = append(ids, a.ID)
		}
		return ids
	}
	want := func(got []string, w string) {
		t.Helper()
		if strings.Join(got, ",") != w {
			t.Errorf("ordem = %v, esperado %s", got, w)
		}
	}

	// Sem Galeria / sem cartões: ordem de sempre (destaque, depois data), sem rascunho.
	want(list(), "a3,a2,a1")

	// Galeria curada [a1, a3] + artigo novo publicado depois: o novo NÃO some.
	cards, _ := json.Marshal([]map[string]any{
		{"type": "paragraph"},
		{"type": "articleCard", "props": map[string]any{"articleId": "a1"}},
		{"type": "articleCard", "props": map[string]any{"articleId": "a3"}},
		{"type": "articleCard", "props": map[string]any{"articleId": "a1"}},          // repetido
		{"type": "articleCard", "props": map[string]any{"articleId": "rasc"}},        // rascunho: fora
		{"type": "articleCard", "props": map[string]any{"articleId": "apagado-xyz"}}, // inexistente
	})
	db.Exec(`INSERT INTO Article (id,title,slug,excerpt,body,bodyJson,published,authorName,createdAt,updatedAt,publishedAt) VALUES ('g','Galeria','blog-global','','',?,1,'',?,?,?)`, string(cards), old, old, old)
	want(list(), "a1,a3,a2,g")

	// Artigo novo publicado agora entra logo depois dos curados, antes dos mais antigos.
	ins("a4", "novo-hoje", 1, time.Now(), 0)
	want(list(), "a1,a3,a4,a2,g")

	// Lista do admin (sem published=true) não é reordenada: continua trazendo rascunhos.
	code, body := blogCall(handleBlogArticles, "GET", "/api/blog/articles", nil)
	var all []Article
	json.Unmarshal(body, &all)
	if code != 200 || len(all) != 6 {
		t.Errorf("lista do admin: %d, %d artigos", code, len(all))
	}
}

func TestOrderGalleryPura(t *testing.T) {
	now := time.Now()
	mk := func(id string, d time.Duration) Article {
		at := now.Add(d)
		return Article{ID: id, Slug: id, Published: true, PublishedAt: &at}
	}
	got := orderGallery([]Article{mk("c", -1), mk("a", -3), mk("b", -2), mk("blog-global", 0)}, []string{"zzz", "b"})
	ids := ""
	for _, a := range got {
		ids += a.ID + ","
	}
	if ids != "b,c,a,blog-global," {
		t.Errorf("orderGallery = %s", ids)
	}
	if len(orderGallery(nil, []string{"x"})) != 0 {
		t.Error("vazio deveria devolver vazio")
	}
}
