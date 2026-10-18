package main

import (
	"encoding/json"
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
	for _, tbl := range []string{"ApiToken", "AuthSession", "TeamMember"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	for k, v := range map[string]string{
		"AUTH_API": "1", "SESSION_SECRET": strings.Repeat("s", 40), "ALLOWED_ORIGINS": testAdminOrigin, "AUTH_DEV_LOGIN": "1",
		"AUTH_BOOTSTRAP_ADMIN": "Adm@kalidash.test", "SITE_URL": "", "GOOGLE_HD": "",
	} {
		t.Setenv(k, v)
	}
	oldDB, oldTok := authDB, tokenDB
	authDB, tokenDB = sqlAuthStore{}, sqlTokenStore{}
	t.Cleanup(func() { authDB, tokenDB = oldDB, oldTok })

	// banco criado pelo WP1 (TeamMember sem as colunas de escopos): a subida acrescenta as colunas e mantém as linhas
	if _, err := db.Exec(`CREATE TABLE TeamMember (id VARCHAR(64) PRIMARY KEY, email VARCHAR(254) NOT NULL, name VARCHAR(200) NOT NULL DEFAULT '',
		avatarUrl VARCHAR(500) NULL, googleSub VARCHAR(64) NULL, role VARCHAR(8) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1,
		lastLoginAt DATETIME NULL, invitedBy VARCHAR(64) NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL,
		UNIQUE KEY uq_team_email (email), UNIQUE KEY uq_team_sub (googleSub)) ENGINE=InnoDB`); err != nil {
		t.Fatal(err)
	}
	db.Exec(`INSERT INTO TeamMember (id, email, role, createdAt, updatedAt) VALUES ('tm-velho', 'velho@kalidash.test', 'SELLER', NOW(), NOW())`)

	ensureAuthSchema()
	if old, err := authDB.MemberByID("tm-velho"); err != nil || old.Role != roleSeller || len(old.Scopes) != len(sellerScopes) || len(old.Extra) != 0 {
		t.Fatalf("migração do WP1: %+v %v", old, err)
	}
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
	// renovação: só renova quando vence antes do limite
	if ok, err := authDB.ExtendSession("h-ok", now.Add(7*24*time.Hour), now.Add(30*time.Minute)); err != nil || ok {
		t.Errorf("sessão com 1h restante não deveria renovar abaixo de 30min: %v %v", ok, err)
	}
	if ok, err := authDB.ExtendSession("h-ok", now.Add(7*24*time.Hour), now.Add(2*time.Hour)); err != nil || !ok {
		t.Errorf("sessão com 1h restante deveria renovar abaixo de 2h: %v %v", ok, err)
	}
	if _, err := authDB.SessionMember("h-ok", now.Add(6*24*time.Hour)); err != nil {
		t.Errorf("depois de renovar, 6 dias adiante ainda vale: %v", err)
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

	// ---- escopos (extras/removidos) no banco ----
	if m, err := authDB.SetMemberScopes(ven.ID, []string{"people:document", "blog:read", "nao:existe"}, []string{"emails:send"}); err != nil ||
		len(m.Extra) != 2 || len(m.Denied) != 1 || !hasScope(m.Scopes, "people:document") || hasScope(m.Scopes, "emails:send") {
		t.Fatalf("SetMemberScopes: %+v %v", m, err)
	}
	if _, err := authDB.SetMemberScopes("nao-existe", nil, nil); err != errMemberNotFound {
		t.Errorf("escopos de pessoa inexistente: %v", err)
	}
	if rec := do(venC, "GET", "/api/crm/people/pa/document", ""); rec.Code != 200 {
		t.Errorf("Vendedor com people:document revela o CPF: %d %s", rec.Code, rec.Body)
	}
	if rec := do(venC, "PUT", "/api/crm/people/pa", `{"name":"Ana","email":"ana@x.co","document":"529.982.247-25"}`); rec.Code != 200 {
		t.Errorf("Vendedor com people:document troca o CPF: %d %s", rec.Code, rec.Body)
	}
	if rec := do(venC, "POST", "/api/emails/send", `{}`); rec.Code != 403 {
		t.Errorf("Vendedor sem emails:send: %d", rec.Code)
	}
	authDB.SetMemberScopes(ger.ID, nil, []string{"leads:origin", "pipelines:manage"})
	if rec := do(gerC, "PUT", "/api/crm/leads/l1", lead); rec.Code != 403 { // volta Site/INBOUND, origem diferente da atual
		t.Errorf("Gerente sem leads:origin trocando a origem: %d %s", rec.Code, rec.Body)
	}
	if rec := do(gerC, "POST", "/api/pipelines", `{}`); rec.Code != 403 {
		t.Errorf("Gerente sem pipelines:manage: %d", rec.Code)
	}
	// equipe pela API com escopos
	if rec := do(admC, "PUT", "/api/team/"+ven.ID, `{"scopesExtra":[],"scopesDenied":[]}`); rec.Code != 200 {
		t.Errorf("limpar escopos: %d %s", rec.Code, rec.Body)
	}
	if m, _ := authDB.MemberByID(ven.ID); len(m.Extra) != 0 || len(m.Denied) != 0 {
		t.Errorf("escopos depois de limpar: %+v", m)
	}

	// ---- tokens no banco ----
	var secret, tokID string
	{
		rec := do(admC, "POST", "/api/tokens", `{"name":"Zapier","scopes":["leads:read","people:read"]}`)
		var out struct {
			Token string
			Meta  APIToken
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &out); rec.Code != 201 || err != nil || !strings.HasPrefix(out.Token, "kld_live_") {
			t.Fatalf("criar token: %d %s", rec.Code, rec.Body)
		}
		secret, tokID = out.Token, out.Meta.ID
		var hash, scopes string
		db.QueryRow(`SELECT tokenHash, scopes FROM ApiToken WHERE id = ?`, tokID).Scan(&hash, &scopes)
		if hash != hashAPIToken(secret) || strings.Contains(hash, secret) || scopes != "leads:read,people:read" {
			t.Errorf("guardado: hash=%q scopes=%q", hash, scopes)
		}
		var n int
		db.QueryRow(`SELECT COUNT(*) FROM ApiToken WHERE tokenHash = ? OR name = ? OR prefix = ?`, secret, secret, secret).Scan(&n)
		if n != 0 {
			t.Error("o segredo não pode estar em nenhuma coluna")
		}
	}
	bearer := func(method, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(""))
		r.Header.Set("Authorization", "Bearer "+secret)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec
	}
	if rec := bearer("GET", "/api/crm/people"); rec.Code != 200 {
		t.Errorf("token lê pessoas: %d %s", rec.Code, rec.Body)
	}
	if rec := bearer("POST", "/api/crm/people"); rec.Code != 403 {
		t.Errorf("token sem people:write: %d", rec.Code)
	}
	if rec := bearer("GET", "/api/team"); rec.Code != 403 {
		t.Errorf("token sem team:read: %d", rec.Code)
	}
	list, err := tokenDB.ListTokens()
	if err != nil || len(list) != 1 || list[0].Status != "ACTIVE" || list[0].LastUsedAt == nil || list[0].CreatedByName == "" || list[0].ExpiresAt != nil || len(list[0].Scopes) != 2 {
		t.Errorf("listar tokens: %+v %v", list, err)
	}
	if rec := do(admC, "GET", "/api/tokens", ""); rec.Code != 200 || strings.Contains(rec.Body.String(), secret) {
		t.Errorf("GET /api/tokens: %d", rec.Code)
	}
	// o último uso só regrava depois do intervalo
	first := list[0].LastUsedAt.Time
	bearer("GET", "/api/crm/people")
	if again, _ := tokenDB.ListTokens(); !again[0].LastUsedAt.Time.Equal(first) {
		t.Error("o último uso não deveria mudar dentro do intervalo")
	}
	tokenDB.TouchToken(tokID, "10.1.1.1", time.Now().Add(time.Hour), time.Minute)
	if again, _ := tokenDB.ListTokens(); !again[0].LastUsedAt.After(first) || again[0].LastUsedIP != "10.1.1.1" {
		t.Errorf("último uso depois do intervalo: %+v", again[0])
	}
	// expirado
	db.Exec(`UPDATE ApiToken SET expiresAt = ? WHERE id = ?`, time.Now().Add(-time.Hour), tokID)
	if rec := bearer("GET", "/api/crm/people"); rec.Code != 401 {
		t.Errorf("token expirado: %d", rec.Code)
	}
	db.Exec(`UPDATE ApiToken SET expiresAt = NULL WHERE id = ?`, tokID)
	if rec := bearer("GET", "/api/crm/people"); rec.Code != 200 {
		t.Errorf("sem validade de novo: %d", rec.Code)
	}
	// revogação imediata
	if rec := do(admC, "DELETE", "/api/tokens/"+tokID, ""); rec.Code != 200 {
		t.Errorf("revogar: %d %s", rec.Code, rec.Body)
	}
	if rec := bearer("GET", "/api/crm/people"); rec.Code != 401 {
		t.Errorf("token revogado: %d", rec.Code)
	}
	if rev, _ := tokenDB.ListTokens(); rev[0].Status != "REVOKED" || rev[0].RevokedAt == nil {
		t.Errorf("status após revogar: %+v", rev[0])
	}

	// logout revoga no banco
	if rec := do(venC, "POST", "/auth/logout", ""); rec.Code != 204 {
		t.Errorf("logout: %d", rec.Code)
	}
	if rec := do(venC, "GET", "/api/crm/people", ""); rec.Code != 401 {
		t.Errorf("sessão revogada: %d", rec.Code)
	}
}
