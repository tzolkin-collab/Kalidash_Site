package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestValidateChange(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	ok := ChangeDTO{Entity: "person", EntityID: "p1", EntityName: "  Ana ", Kind: "edit", Field: "Cargo", From: "Dir", To: "Diretora"}
	if err := validateChange(&ok, now); err != nil || ok.Actor != "Equipe" || ok.ID == "" || ok.EntityName != "Ana" || !ok.At.Equal(now) {
		t.Fatalf("válida: %v %+v", err, ok)
	}
	for name, bad := range map[string]ChangeDTO{
		"registro":    {Entity: "banana", EntityID: "p1", Kind: "edit"},
		"id":          {Entity: "person", EntityID: "p 1", Kind: "edit"},
		"mudança":     {Entity: "person", EntityID: "p1", Kind: "hack"},
		"id da linha": {ID: "a b", Entity: "person", EntityID: "p1", Kind: "edit"},
	} {
		bad := bad
		if err := validateChange(&bad, now); err == nil {
			t.Errorf("%s: deveria falhar", name)
		}
	}
	// todo tipo de registro e de mudança que o admin usa é aceito
	for e := range entityKinds {
		for k := range changeKinds {
			c := ChangeDTO{Entity: e, EntityID: "x1", Kind: k}
			if err := validateChange(&c, now); err != nil {
				t.Errorf("%s/%s: %v", e, k, err)
			}
		}
	}
}

func TestRelogioDaEntrada(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	at := func(d time.Duration) *FlexTime { return &FlexTime{now.Add(d)} }
	cases := map[string]struct {
		in   *FlexTime
		keep bool
	}{
		"1 s atrás":        {at(-time.Second), true},
		"3 dias atrás":     {at(-72 * time.Hour), true},
		"8 dias atrás":     {at(-8 * 24 * time.Hour), false},
		"30 s no futuro":   {at(30 * time.Second), true},
		"1 hora no futuro": {at(time.Hour), false},
		"ausente":          {nil, false},
		"zero":             {&FlexTime{}, false},
	}
	for name, c := range cases {
		e := ChangeDTO{Entity: "lead", EntityID: "l1", Kind: "edit", At: c.in}
		if err := validateChange(&e, now); err != nil {
			t.Fatal(err)
		}
		kept := c.in != nil && !c.in.IsZero() && e.At.Equal(c.in.Time)
		if kept != c.keep {
			t.Errorf("%s: manteve=%v queria=%v (saiu %v)", name, kept, c.keep, e.At.Time)
		}
		if !c.keep && !e.At.Equal(now) {
			t.Errorf("%s: deveria usar a hora do servidor", name)
		}
	}
}

func TestTextosLongosSaoCortados(t *testing.T) {
	now := time.Now()
	e := ChangeDTO{Entity: "lead", EntityID: "l1", Kind: "event", Note: strings.Repeat("ç", 5000), EntityName: strings.Repeat("n", 400)}
	if err := validateChange(&e, now); err != nil || len([]rune(e.Note)) != maxHistoryText || len([]rune(e.EntityName)) != 255 {
		t.Errorf("cortes: %v %d %d", err, len([]rune(e.Note)), len([]rune(e.EntityName)))
	}
}

func TestDecodeChanges(t *testing.T) {
	one, err := decodeChanges([]byte(`  {"entity":"lead","entityId":"l1","kind":"edit"} `))
	if err != nil || len(one) != 1 {
		t.Fatalf("uma entrada: %v %d", err, len(one))
	}
	many, err := decodeChanges([]byte(`[{"entity":"lead","entityId":"l1","kind":"edit"},{"entity":"person","entityId":"p1","kind":"create"}]`))
	if err != nil || len(many) != 2 {
		t.Fatalf("lista: %v %d", err, len(many))
	}
	var big strings.Builder
	big.WriteString("[")
	for i := 0; i <= maxHistoryBatch; i++ {
		if i > 0 {
			big.WriteString(",")
		}
		big.WriteString(`{"entity":"lead","entityId":"l1","kind":"edit"}`)
	}
	big.WriteString("]")
	for name, body := range map[string]string{"vazio": "", "lista vazia": "[]", "lixo": "nada", "lote grande": big.String()} {
		if _, err := decodeChanges([]byte(body)); err == nil {
			t.Errorf("%s: deveria falhar", name)
		}
	}
}

// Caminhos que respondem antes de tocar no banco. O histórico só tem GET e POST: nada altera nem apaga.
func TestHistoricoSoAcrescenta(t *testing.T) {
	do := func(method, path, body string) int {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("X-Forwarded-For", "8.0.0."+method)
		rec := httptest.NewRecorder()
		handleHistory(rec, req)
		return rec.Code
	}
	for _, m := range []string{http.MethodPut, http.MethodPatch, http.MethodDelete} {
		if c := do(m, "/api/crm/history", `{}`); c != 405 {
			t.Errorf("%s deveria dar 405: %d", m, c)
		}
	}
	if c := do("POST", "/api/crm/history", "nada"); c != 400 {
		t.Errorf("json ruim: %d", c)
	}
	if c := do("POST", "/api/crm/history", `{"entity":"x","entityId":"1","kind":"edit"}`); c != 422 {
		t.Errorf("entrada inválida: %d", c)
	}
	if c := do("GET", "/api/crm/history?since=ontem", ""); c != 400 {
		t.Errorf("since inválido: %d", c)
	}
}
