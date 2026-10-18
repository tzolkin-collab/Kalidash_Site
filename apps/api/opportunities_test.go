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

func TestParseDTAceitaOsDoisFormatosDoDriver(t *testing.T) {
	want := time.Date(2026, 10, 18, 14, 30, 5, 0, time.UTC)
	for _, in := range []string{
		"2026-10-18 14:30:05",     // DSN sem parseTime
		"2026-10-18 14:30:05.000", // DATETIME(3) do Prisma
		"2026-10-18T14:30:05Z",    // parseTime=true (database/sql converte time.Time em RFC3339)
		"2026-10-18T14:30:05.000Z",
	} {
		if got := parseDT(in); !got.Equal(want) {
			t.Errorf("parseDT(%q) = %v, queria %v", in, got, want)
		}
	}
	if got := parseDT("2026-10-18 14:30:05.123"); got.Nanosecond() != 123000000 {
		t.Errorf("milissegundos perdidos: %v", got)
	}
	for _, bad := range []string{"", "ontem", "0000-00-00 00:00:00"} {
		if got := parseDT(bad); !got.IsZero() {
			t.Errorf("parseDT(%q) devia ser zero, veio %v", bad, got)
		}
	}
}

// ---- POST /api/emails/test ----

type sentMail struct{ to, subject, html string }

func stubResend(t *testing.T, err error) *[]sentMail {
	t.Helper()
	var sent []sentMail
	old := resendSend
	resendSend = func(to, subject, html string) error {
		if err == nil {
			sent = append(sent, sentMail{to, subject, html})
		}
		return err
	}
	t.Cleanup(func() { resendSend = old })
	return &sent
}

func resetRate() {
	rateMu.Lock()
	rateHits = map[string][]time.Time{}
	rateMu.Unlock()
}

func postTestEmail(m *Member, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "/api/emails/test", strings.NewReader(body))
	if m != nil {
		r = r.WithContext(withPrincipal(r.Context(), *m))
	}
	rec := httptest.NewRecorder()
	handleTestEmail(rec, r)
	return rec
}

func TestEmailDeTesteVaiSoParaQuemEstaLogado(t *testing.T) {
	sent := stubResend(t, nil)
	resetRate()
	me := &Member{ID: "m1", Email: "ana@kalidash.test", Role: roleSeller, Active: true}

	// o cliente tenta escolher o destinatário: é ignorado
	rec := postTestEmail(me, `{"to":"vitima@fora.test","cc":"x@y.z","subject":"Olá","body":"<p>oi</p>"}`)
	if rec.Code != 200 {
		t.Fatalf("envio: %d %s", rec.Code, rec.Body)
	}
	if len(*sent) != 1 || (*sent)[0].to != "ana@kalidash.test" || (*sent)[0].subject != "Olá" {
		t.Fatalf("destinatário errado: %+v", *sent)
	}
	var out map[string]string
	json.Unmarshal(rec.Body.Bytes(), &out)
	if out["to"] != "ana@kalidash.test" {
		t.Errorf("a resposta devia dizer para onde foi: %v", out)
	}
}

func TestEmailDeTesteRecusa(t *testing.T) {
	sent := stubResend(t, nil)
	resetRate()
	me := &Member{Email: "ana@kalidash.test", Role: roleManager}
	for name, c := range map[string]struct {
		m    *Member
		body string
		want int
	}{
		"sem sessão":            {nil, `{"subject":"a","body":"b"}`, 401},
		"e-mail da conta vazio": {&Member{}, `{"subject":"a","body":"b"}`, 401},
		"assunto vazio":         {me, `{"subject":"  ","body":"b"}`, 422},
		"assunto com quebra":    {me, `{"subject":"a\r\nBcc: x@y.z","body":"b"}`, 422},
		"corpo vazio":           {me, `{"subject":"a","body":""}`, 422},
		"corpo gigante":         {me, `{"subject":"a","body":"` + strings.Repeat("x", testEmailMaxBody+10000) + `"}`, 400},
		"json quebrado":         {me, `{`, 400},
	} {
		if rec := postTestEmail(c.m, c.body); rec.Code != c.want {
			t.Errorf("%s: %d, queria %d (%s)", name, rec.Code, c.want, rec.Body)
		}
	}
	if len(*sent) != 0 {
		t.Errorf("nada devia ter sido enviado: %+v", *sent)
	}
	rec := httptest.NewRecorder()
	handleTestEmail(rec, httptest.NewRequest("GET", "/api/emails/test", nil))
	if rec.Code != 405 {
		t.Errorf("GET: %d", rec.Code)
	}
}

func TestEmailDeTesteLimiteEFalhaDoProvedor(t *testing.T) {
	resetRate()
	me := &Member{Email: "lim@kalidash.test", Role: roleAdmin}
	stubResend(t, nil)
	for i := 0; i < testEmailRatePerHr; i++ {
		if rec := postTestEmail(me, `{"subject":"a","body":"b"}`); rec.Code != 200 {
			t.Fatalf("envio %d: %d", i, rec.Code)
		}
	}
	if rec := postTestEmail(me, `{"subject":"a","body":"b"}`); rec.Code != 429 {
		t.Errorf("acima do limite: %d", rec.Code)
	}
	// falha do provedor vira 502
	stubResend(t, http.ErrHandlerTimeout)
	other := &Member{Email: "outra@kalidash.test", Role: roleAdmin}
	if rec := postTestEmail(other, `{"subject":"a","body":"b"}`); rec.Code != 502 {
		t.Errorf("falha do provedor: %d", rec.Code)
	}
}

// Qualquer perfil logado pode pedir o teste (só vai para o próprio e-mail); sem sessão o servidor nega.
func TestEmailDeTesteExigeSessaoNoServidor(t *testing.T) {
	e := setupAuth(t)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/emails/test", enableCORS(handleTestEmail))
	h := withAuth(mux)
	stubResend(t, nil)
	resetRate()

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/emails/test", strings.NewReader(`{"subject":"a","body":"b"}`)))
	if rec.Code != 401 {
		t.Errorf("sem sessão: %d", rec.Code)
	}
	ck := e.login(e.member("vend@kalidash.test", roleSeller))
	r := httptest.NewRequest("POST", "/api/emails/test", strings.NewReader(`{"to":"outro@fora.test","subject":"a","body":"b"}`))
	r.AddCookie(ck)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "vend@kalidash.test") {
		t.Errorf("Vendedor logado: %d %s", rec.Code, rec.Body)
	}
}

// ---- integração: datas e edição de oportunidade (MySQL de verdade, só com TEST_DSN) ----

func reopenWithParseTime(t *testing.T) {
	t.Helper()
	dsn := os.Getenv("TEST_DSN")
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	d, err := sql.Open("mysql", dsn+sep+"parseTime=true")
	if err != nil {
		t.Fatal(err)
	}
	if err := d.Ping(); err != nil {
		t.Fatal(err)
	}
	db.Close()
	db = d
	t.Cleanup(func() { d.Close() })
}

func listOpps(t *testing.T) []Opportunity {
	t.Helper()
	rec := httptest.NewRecorder()
	handleOpportunities(rec, httptest.NewRequest("GET", "/api/leads", nil))
	if rec.Code != 200 {
		t.Fatalf("GET /api/leads: %d %s", rec.Code, rec.Body)
	}
	var out []Opportunity
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestIntegrationOportunidadeDatasEEdicao(t *testing.T) {
	integrationDB(t)
	for _, ddl := range []string{
		`CREATE TABLE IF NOT EXISTS Company (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, logoUrl VARCHAR(500) NULL)`,
		`CREATE TABLE IF NOT EXISTS Contact (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NULL, avatarUrl VARCHAR(500) NULL)`,
		`CREATE TABLE IF NOT EXISTS User (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, avatarUrl VARCHAR(500) NULL)`,
	} {
		if _, err := db.Exec(ddl); err != nil {
			t.Fatal(err)
		}
	}
	// integrationDB cria Opportunity só com as colunas dos fluxos de funil; o GET também lê os vínculos.
	for _, col := range []string{"companyId", "contactId", "ownerId"} {
		if _, err := db.Exec("ALTER TABLE Opportunity ADD COLUMN " + col + " VARCHAR(64) NULL"); err != nil {
			t.Fatal(err)
		}
	}
	created := time.Date(2026, 3, 4, 10, 20, 30, 0, time.UTC)
	won := time.Date(2026, 5, 6, 7, 8, 9, 0, time.UTC)
	if _, err := db.Exec(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, createdAt, updatedAt, wonAt) VALUES ('o1','Acme',100,'WON','HIGH','["a","b"]',?,?,?)`, created, created, won); err != nil {
		t.Fatal(err)
	}

	check := func(label string) {
		t.Helper()
		got := listOpps(t)
		if len(got) != 1 {
			t.Fatalf("%s: %d oportunidades", label, len(got))
		}
		if !got[0].CreatedAt.Equal(created) {
			t.Errorf("%s: created_at = %v, queria %v (B-D1)", label, got[0].CreatedAt, created)
		}
		if got[0].WonAt == nil || !got[0].WonAt.Equal(won) {
			t.Errorf("%s: wonAt = %v, queria %v (B-D1)", label, got[0].WonAt, won)
		}
	}
	check("sem parseTime")

	// edição: título, valor, prioridade e tags gravam; campo ausente mantém o que estava
	put := func(body string) int {
		rec := httptest.NewRecorder()
		handleOpportunities(rec, httptest.NewRequest("PUT", "/api/leads", strings.NewReader(body)))
		return rec.Code
	}
	if c := put(`{"id":"o1","title":"Acme 2","value":250.5,"priority":"LOW","tags":["x"]}`); c != 200 {
		t.Fatalf("PUT: %d", c)
	}
	got := listOpps(t)[0]
	if got.Title != "Acme 2" || *got.Value != 250.5 || got.Priority != "LOW" || len(got.Tags) != 1 || got.Tags[0] != "x" {
		t.Errorf("PUT não persistiu: %+v", got)
	}
	if c := put(`{"id":"o1","title":"Acme 3","value":250.5}`); c != 200 {
		t.Fatalf("PUT sem prioridade/tags: %d", c)
	}
	got = listOpps(t)[0]
	if got.Title != "Acme 3" || got.Priority != "LOW" || len(got.Tags) != 1 {
		t.Errorf("campo ausente devia manter prioridade e tags: %+v", got)
	}
	if c := put(`{"id":"o1","title":"Acme 4","value":1,"priority":"QUALQUER","tags":[]}`); c != 200 {
		t.Fatalf("PUT prioridade fora do conjunto: %d", c)
	}
	got = listOpps(t)[0]
	if got.Priority != "LOW" || len(got.Tags) != 0 {
		t.Errorf("prioridade inválida deve manter a do banco e tags [] limpar: %+v", got)
	}
	if c := put(`{"id":"o1","title":"  ","value":1}`); c != 400 {
		t.Errorf("título vazio: %d", c)
	}
	if c := put(`{"id":"nao-existe","title":"x","value":1}`); c != 404 {
		t.Errorf("inexistente: %d", c)
	}

	// o PUT nunca mexe em createdAt/wonAt, e a leitura continua certa com parseTime=true
	reopenWithParseTime(t)
	check("com parseTime=true")
}
