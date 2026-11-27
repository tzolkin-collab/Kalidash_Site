package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// Fluxo contra MySQL de verdade (só com TEST_DSN em localhost): criar, listar (com e sem parseTime), publicar e arquivar.
func TestIntegrationCreatives(t *testing.T) {
	if os.Getenv("TEST_DSN") == "" {
		t.Skip("TEST_DSN não definido: teste de integração ignorado")
	}
	bothDSN(t, func(t *testing.T) {
		db.Exec("DROP TABLE IF EXISTS Creative")
		ensureCreativeSchema()
		call := func(h http.HandlerFunc, method, id, body string) (int, string) {
			r := httptest.NewRequest(method, "/api/blog/creatives", strings.NewReader(body))
			r.SetPathValue("id", id)
			w := httptest.NewRecorder()
			h(w, r)
			return w.Code, w.Body.String()
		}
		code, body := call(handleCreatives, "POST", "", `{"title":"Peça","format":"post","campaign":"tema","destination":"/blog"}`)
		if code != 201 {
			t.Fatalf("criar: %d %s", code, body)
		}
		id := body[strings.Index(body, `"id":"`)+6:]
		id = id[:strings.Index(id, `"`)]
		if code, body = call(handleCreatives, "GET", "", ""); code != 200 || !strings.Contains(body, id) || !strings.Contains(body, `"createdAt":"2`) {
			t.Fatalf("listar: %d %s", code, body)
		}
		for i := 0; i < 2; i++ { // salvar o mesmo endereço de novo continua valendo
			if code, body = call(handleCreativeByID, "PATCH", id, `{"postUrls":["https://exemplo.com/p/1"]}`); code != 204 {
				t.Fatalf("publicar: %d %s", code, body)
			}
		}
		if code, _ = call(handleCreativeByID, "PATCH", "crnaoexiste", `{"postUrls":[]}`); code != 404 {
			t.Errorf("publicar em criativo inexistente: %d", code)
		}
		if code, _ = call(handleCreativeByID, "DELETE", id, ""); code != 204 {
			t.Errorf("arquivar: %d", code)
		}
		if _, body = call(handleCreatives, "GET", "", ""); strings.TrimSpace(body) != "[]" {
			t.Errorf("arquivado ainda listado: %s", body)
		}
	})
}
