package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// Integração do login e dos perfis contra um MySQL de verdade (mesmas regras de
// workflow_integration_test.go: só com TEST_DSN, só localhost). Apaga e recria TeamMember e AuthSession.
//   TEST_DSN='root:@tcp(127.0.0.1:3307)/kalidash_test' go test -run IntegrationAuth -v .

func TestIntegrationAuth(t *testing.T) {
	crmDB(t) // abre `db`, recria Contact/Company/Lead/ChangeLog e as tabelas do funil
	for _, tbl := range []string{"AuthSession", "TeamMember"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	for k, v := range map[string]string{
		"AUTH_API": "1", "SESSION_SECRET": strings.Repeat("s", 40), "ALLOWED_ORIGINS": testAdminOrigin, "AUTH_DEV_LOGIN": "1",
		"AUTH_BOOTSTRAP_ADMIN": "Adm@kalidash.test", "SITE_URL": "", "GOOGLE_HD": "",
	} {
		t.Setenv(k, v)
	}
	oldDB := authDB
	authDB = sqlAuthStore{}
	t.Cleanup(func() { authDB = oldDB })

	ensureAuthSchema()
	ensureAuthSchema() // idempotente
	adm, err := authDB.MemberByEmail("adm@kalidash.test")
	if err != nil || adm.Role != roleAdmin || !adm.Active || adm.Status != "INVITED" {
		t.Fatalf("bootstrap no banco: %+v %v", adm, err)
	}

	// ---- armazenamento ----
	ger, err := authDB.AddMember(Member{Email: "ger@kalidash.test", Name: "Gerente", Role: roleManager}, adm.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := authDB.AddMember(Member{Email: "ger@kalidash.test", Role: roleSeller}, ""); err != errMemberExists {
		t.Errorf("e-mail repetido: %v", err)
	}
	ven, _ := authDB.AddMember(Member{Email: "ven@kalidash.test", Name: "Vendedora", Role: roleSeller}, adm.ID)
	if err := authDB.TouchLogin(ger.ID, "sub-ger", "", "https://img/g.png"); err != nil {
		t.Fatal(err)
	}
	if got, err := authDB.MemberBySub("sub-ger"); err != nil || got.ID != ger.ID || got.Status != "ACTIVE" || got.Name != "Gerente" || got.AvatarURL == "" {
		t.Errorf("vínculo Google: %+v %v", got, err)
	}
	if _, err := authDB.MemberBySub("nao-existe"); err != errMemberNotFound {
		t.Errorf("sub inexistente: %v", err)
	}

	now := time.Now()
	if err := authDB.CreateSession("h-ok", ger.ID, "10.0.0.1", "ua", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	authDB.CreateSession("h-velha", ger.ID, "", "", now.Add(-time.Hour))
	if m, err := authDB.SessionMember("h-ok", now); err != nil || m.ID != ger.ID {
		t.Errorf("sessão válida: %+v %v", m, err)
	}
	if _, err := authDB.SessionMember("h-velha", now); err != errSessionNotFound {
		t.Errorf("sessão expirada: %v", err)
	}
	authDB.PurgeExpired(now)
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM AuthSession WHERE tokenHash = 'h-velha'`).Scan(&n)
	if n != 0 {
		t.Error("PurgeExpired deveria apagar a expirada")
	}
	off := false
	if _, err := authDB.UpdateMember(ger.ID, nil, nil, &off); err != nil {
		t.Fatal(err)
	}
	if _, err := authDB.SessionMember("h-ok", now); err != errSessionNotFound {
		t.Errorf("desativar deve derrubar a sessão: %v", err)
	}
	on := true
	authDB.UpdateMember(ger.ID, nil, nil, &on)
	seller := roleSeller
	if _, err := authDB.UpdateMember(adm.ID, nil, &seller, nil); err != errLastAdmin {
		t.Errorf("último Admin no banco: %v", err)
	}
	if _, err := authDB.UpdateMember("nao-existe", nil, &seller, nil); err != errMemberNotFound {
		t.Errorf("update inexistente: %v", err)
	}

	// ---- HTTP com os handlers reais do CRM ----
	mux := http.NewServeMux()
	registerCRMRoutes(mux)
	registerAuthRoutes(mux)
	h := withAuth(mux)
	cookie := func(m Member) *http.Cookie {
		rec := httptest.NewRecorder()
		if err := startSession(rec, httptest.NewRequest("GET", "/", nil), m.ID); err != nil {
			t.Fatal(err)
		}
		return rec.Result().Cookies()[0]
	}
	do := func(c *http.Cookie, method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if c != nil {
			r.AddCookie(c)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec
	}
	admC, gerC, venC := cookie(adm), cookie(ger), cookie(ven)

	if rec := do(nil, "GET", "/api/crm/people", ""); rec.Code != 401 {
		t.Errorf("sem sessão: %d", rec.Code)
	}
	if rec := do(venC, "GET", "/api/crm/people", ""); rec.Code != 200 {
		t.Errorf("Vendedor lista pessoas: %d %s", rec.Code, rec.Body)
	}

	// CPF: Vendedor não cria nem troca com CPF novo, nem revela; sem CPF segue normal
	pessoa := `{"id":"pa","name":"Ana","email":"ana@x.co","document":"111.444.777-35"}`
	if rec := do(venC, "POST", "/api/crm/people", pessoa); rec.Code != 403 {
		t.Errorf("Vendedor criando com CPF: %d", rec.Code)
	}
	if rec := do(venC, "POST", "/api/crm/people", `{"id":"pb","name":"Beto","email":"beto@x.co"}`); rec.Code != 201 {
		t.Errorf("Vendedor criando sem CPF: %d %s", rec.Code, rec.Body)
	}
	if rec := do(gerC, "POST", "/api/crm/people", pessoa); rec.Code != 201 {
		t.Errorf("Gerente criando com CPF: %d %s", rec.Code, rec.Body)
	}
	if rec := do(venC, "PUT", "/api/crm/people/pa", `{"name":"Ana","email":"ana@x.co","document":"•••.•••.•••-35"}`); rec.Code != 200 {
		t.Errorf("Vendedor salvando com CPF mascarado: %d %s", rec.Code, rec.Body)
	}
	if rec := do(venC, "PUT", "/api/crm/people/pa", `{"name":"Ana","email":"ana@x.co","document":"529.982.247-25"}`); rec.Code != 403 {
		t.Errorf("Vendedor trocando o CPF: %d", rec.Code)
	}
	if rec := do(venC, "GET", "/api/crm/people/pa/document", ""); rec.Code != 403 || strings.Contains(rec.Body.String(), "111") {
		t.Errorf("Vendedor revelando o CPF: %d %s", rec.Code, rec.Body)
	}
	if rec := do(gerC, "GET", "/api/crm/people/pa/document", ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), "111.444.777-35") {
		t.Errorf("Gerente revelando o CPF: %d %s", rec.Code, rec.Body)
	}

	// origem do lead
	lead := `{"id":"l1","name":"Renata","email":"r@x.co","pipelineId":"q4","stageId":"q4:novos","origin":"INBOUND","sourceName":"Site"}`
	if rec := do(gerC, "POST", "/api/crm/leads", lead); rec.Code != 201 {
		t.Fatalf("criar lead: %d %s", rec.Code, rec.Body)
	}
	trocaOrigem := strings.Replace(strings.Replace(lead, `"INBOUND"`, `"OUTBOUND"`, 1), `"Site"`, `"Carol"`, 1)
	trocaFonte := strings.Replace(lead, `"Site"`, `"Instagram"`, 1)
	if rec := do(venC, "PUT", "/api/crm/leads/l1", trocaOrigem); rec.Code != 403 {
		t.Errorf("Vendedor trocando a origem: %d", rec.Code)
	}
	if rec := do(venC, "PUT", "/api/crm/leads/l1", trocaFonte); rec.Code != 403 {
		t.Errorf("Vendedor trocando a fonte: %d", rec.Code)
	}
	if rec := do(venC, "PUT", "/api/crm/leads/l1", strings.Replace(lead, `"Renata"`, `"Renata M."`, 1)); rec.Code != 200 {
		t.Errorf("Vendedor editando outro campo: %d %s", rec.Code, rec.Body)
	}
	if rec := do(gerC, "PUT", "/api/crm/leads/l1", trocaOrigem); rec.Code != 200 {
		t.Errorf("Gerente trocando a origem: %d %s", rec.Code, rec.Body)
	}

	// histórico: o autor é a sessão, não o que o cliente diz
	hist := `{"id":"hx-1","actor":"Falso","entity":"person","entityId":"pa","kind":"edit","field":"Cargo"}`
	if rec := do(venC, "POST", "/api/crm/history", hist); rec.Code != 201 {
		t.Fatalf("histórico: %d %s", rec.Code, rec.Body)
	}
	var actor string
	db.QueryRow(`SELECT actor FROM ChangeLog WHERE id = 'hx-1'`).Scan(&actor)
	if actor != "Vendedora" {
		t.Errorf("autor do histórico: %q", actor)
	}

	// equipe pela API
	if rec := do(gerC, "POST", "/api/team", `{"email":"x@kalidash.test","role":"SELLER"}`); rec.Code != 403 {
		t.Errorf("Gerente convidando: %d", rec.Code)
	}
	if rec := do(venC, "GET", "/api/team", ""); rec.Code != 200 {
		t.Errorf("Vendedor lendo a lista da equipe: %d", rec.Code)
	}
	if rec := do(admC, "POST", "/api/team", `{"email":"nova@kalidash.test","role":"SELLER"}`); rec.Code != 201 {
		t.Errorf("Admin convidando: %d %s", rec.Code, rec.Body)
	}
	if rec := do(admC, "GET", "/api/team", ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), "nova@kalidash.test") {
		t.Errorf("listar equipe: %d %s", rec.Code, rec.Body)
	}

	// logout revoga no banco
	if rec := do(venC, "POST", "/auth/logout", ""); rec.Code != 204 {
		t.Errorf("logout: %d", rec.Code)
	}
	if rec := do(venC, "GET", "/api/crm/people", ""); rec.Code != 401 {
		t.Errorf("sessão revogada: %d", rec.Code)
	}
}
