package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCleanTagName(t *testing.T) {
	ok := map[string]string{
		"  Urgente  ":        "Urgente",
		"Muito   importante": "Muito importante",
		"Indicação":          "Indicação",
	}
	for in, want := range ok {
		got, err := cleanTagName(in)
		if err != nil || got != want {
			t.Errorf("cleanTagName(%q) = %q, %v; quer %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "   ", strings.Repeat("a", tagNameMax+1), "a\x00b", "tab\u0007"} {
		if _, err := cleanTagName(in); err == nil {
			t.Errorf("cleanTagName(%q) devia recusar", in)
		}
	}
	if _, err := cleanTagName(strings.Repeat("ã", tagNameMax)); err != nil {
		t.Errorf("o limite conta caracteres, não bytes: %v", err)
	}
}

func TestNormalizeCategory(t *testing.T) {
	cases := map[string]string{"": tagGeneral, "  ": tagGeneral, "profile": tagProfile, " Event ": tagEvent, "task": tagTask, " Role": tagRole, "GENERAL": tagGeneral}
	for in, want := range cases {
		got, err := normalizeCategory(in)
		if err != nil || got != want {
			t.Errorf("normalizeCategory(%q) = %q, %v; quer %q", in, got, err, want)
		}
	}
	// status, prioridade e origem são campos dos registros, não categorias de tag
	for _, c := range []string{"OUTRA", "STATUS", "PRIORITY", "SOURCE"} {
		if _, err := normalizeCategory(c); err == nil {
			t.Errorf("categoria %q devia ser recusada", c)
		}
	}
}

func tagRequest(handler http.HandlerFunc, method, path, body string, pathID string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if pathID != "" {
		req.SetPathValue("id", pathID)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

// Os caminhos de recusa respondem antes de qualquer consulta ao banco: dá para testar sem MySQL.
func TestTagHandlersRecusamEntradaInvalida(t *testing.T) {
	cases := []struct {
		name    string
		handler http.HandlerFunc
		method  string
		body    string
		id      string
		want    int
	}{
		{"POST corpo que não é JSON", handleTags, http.MethodPost, "isto não é json", "", http.StatusBadRequest},
		{"POST sem nome", handleTags, http.MethodPost, `{"name":"  ","category":"STATUS"}`, "", http.StatusBadRequest},
		{"POST nome longo demais", handleTags, http.MethodPost, `{"name":"` + strings.Repeat("x", 80) + `"}`, "", http.StatusBadRequest},
		{"POST categoria inexistente", handleTags, http.MethodPost, `{"name":"Novo","category":"XYZ"}`, "", http.StatusBadRequest},
		{"POST categoria que agora é campo", handleTags, http.MethodPost, `{"name":"Novo","category":"STATUS"}`, "", http.StatusBadRequest},
		{"método não permitido em /api/tags", handleTags, http.MethodPatch, "", "", http.StatusMethodNotAllowed},
		{"PUT com id inválido", handleTagByID, http.MethodPut, `{"category":"STATUS"}`, "id com espaço", http.StatusBadRequest},
		{"DELETE com id inválido", handleTagByID, http.MethodDelete, "", "../etc", http.StatusBadRequest},
		{"PUT corpo inválido", handleTagByID, http.MethodPut, "{", "tag-1", http.StatusBadRequest},
		{"PUT categoria inexistente", handleTagByID, http.MethodPut, `{"category":"XYZ"}`, "tag-1", http.StatusBadRequest},
		{"método não permitido em /api/tags/{id}", handleTagByID, http.MethodGet, "", "tag-1", http.StatusMethodNotAllowed},
	}
	for _, c := range cases {
		rec := tagRequest(c.handler, c.method, "/api/tags", c.body, c.id)
		if rec.Code != c.want {
			t.Errorf("%s: status %d, quer %d (%s)", c.name, rec.Code, c.want, rec.Body.String())
		}
	}
}

func TestTagSchemaEntraNaAlinhamentoDeCollation(t *testing.T) {
	found := false
	for _, tb := range apiTables {
		if tb == "Tag" {
			found = true
		}
	}
	if !found {
		t.Error("a tabela Tag precisa estar em apiTables (collation.go), senão o JOIN com tabelas do Prisma pode dar erro 1267")
	}
}

func TestTagEscopo(t *testing.T) {
	scope, public := routeScope(httptest.NewRequest(http.MethodGet, "/api/tags", nil))
	if public || scope != "leads:read" {
		t.Errorf("GET /api/tags: escopo %q público=%v; quer leads:read", scope, public)
	}
	scope, _ = routeScope(httptest.NewRequest(http.MethodPost, "/api/tags", nil))
	if scope != "leads:write" {
		t.Errorf("POST /api/tags: escopo %q; quer leads:write", scope)
	}
}
