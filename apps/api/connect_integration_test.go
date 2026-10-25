package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Integração do WP2 contra um MySQL de verdade (mesmas regras: só com TEST_DSN, só localhost).
//   TEST_DSN='root:@tcp(127.0.0.1:3327)/kalidash_test' go test -run IntegrationConnect -v .

func TestIntegrationConnect(t *testing.T) {
	crmDB(t) // abre `db`, recria Contact/Company/Lead/ChangeLog e as tabelas do funil (WORKFLOW_API=1)
	for _, tbl := range []string{"ConnectedProject", "TrackedForm", "ApiToken", "AuthSession", "TeamMember"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	for k, v := range map[string]string{
		"AUTH_API": "1", "CRM_API": "1", "SESSION_SECRET": strings.Repeat("s", 40), "ALLOWED_ORIGINS": testAdminOrigin, "AUTH_DEV_LOGIN": "1",
		"AUTH_BOOTSTRAP_ADMIN": "adm@kalidash.test", "SITE_URL": "", "GOOGLE_HD": "",
	} {
		t.Setenv(k, v)
	}
	oldA, oldT, oldC := authDB, tokenDB, connectDB
	authDB, tokenDB, connectDB = sqlAuthStore{}, sqlTokenStore{}, sqlConnectStore{}
	t.Cleanup(func() { authDB, tokenDB, connectDB = oldA, oldT, oldC })

	// ApiToken criada antes do WP2 (sem env nem projectId): a subida acrescenta as colunas e mantém a linha
	if _, err := db.Exec(`CREATE TABLE ApiToken (id VARCHAR(64) PRIMARY KEY, name VARCHAR(120) NOT NULL, prefix VARCHAR(24) NOT NULL, last4 CHAR(4) NOT NULL,
		tokenHash CHAR(64) NOT NULL, scopes TEXT NOT NULL, createdBy VARCHAR(64) NULL, createdAt DATETIME NOT NULL, expiresAt DATETIME NULL, lastUsedAt DATETIME NULL,
		lastUsedIp VARCHAR(45) NULL, revokedAt DATETIME NULL, revokedBy VARCHAR(64) NULL, UNIQUE KEY uq_token_hash (tokenHash)) ENGINE=InnoDB`); err != nil {
		t.Fatal(err)
	}
	db.Exec(`INSERT INTO ApiToken (id, name, prefix, last4, tokenHash, scopes, createdAt) VALUES ('tk-velho', 'Velho', 'kld_live_abcd', 'wxyz', 'h', 'leads:read', NOW())`)
	ensureAuthSchema()
	ensureConnectSchema()
	ensureConnectSchema() // idempotente
	ensureAuthSchema()
	if list, err := tokenDB.ListTokens(); err != nil || len(list) != 1 || list[0].Env != "live" || list[0].ProjectID != "" {
		t.Fatalf("migração do token antigo: %+v %v", list, err)
	}

	// funil com uma coluna de leads e uma aberta
	now := "NOW()"
	db.Exec(`INSERT INTO Pipeline (id, name, offer, position, createdAt, updatedAt) VALUES ('pl-1', 'Vendas', '', 0, ` + now + `, ` + now + `)`)
	db.Exec(`INSERT INTO PipelineStage (id, pipelineId, name, kind, position) VALUES ('pl-1:novos', 'pl-1', 'Novos', 'LEAD', 0), ('pl-1:prop', 'pl-1', 'Proposta', 'OPEN', 1)`)

	mux := http.NewServeMux()
	registerCRMRoutes(mux)
	registerAuthRoutes(mux)
	registerConnectRoutes(mux)
	h := withAuth(mux)
	adm, err := authDB.MemberByEmail("adm@kalidash.test")
	if err != nil {
		t.Fatal(err)
	}
	rec0 := httptest.NewRecorder()
	if err := startSession(rec0, httptest.NewRequest("GET", "/", nil), adm.ID); err != nil {
		t.Fatal(err)
	}
	cookie := rec0.Result().Cookies()[0]
	do := func(c *http.Cookie, method, path string, hdr map[string]string, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if c != nil {
			r.AddCookie(c)
		}
		for k, v := range hdr {
			r.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec
	}
	adminHdr := map[string]string{"Origin": testAdminOrigin}
	oi, ot := connectRateIP, connectRateToken
	connectRateIP, connectRateToken = 1000, 1000
	t.Cleanup(func() { connectRateIP, connectRateToken = oi, ot })

	// ---- projeto: a coluna precisa ser de leads, do funil ----
	for _, body := range []string{
		`{"name":"P","url":"https://lp.exemplo.com.br","pipelineId":"pl-1","stageId":"pl-1:prop"}`,
		`{"name":"P","url":"https://lp.exemplo.com.br","pipelineId":"pl-1","stageId":"outra"}`,
		`{"name":"P","url":"https://lp.exemplo.com.br","pipelineId":"nao-existe","stageId":"pl-1:novos"}`,
	} {
		if rec := do(cookie, "POST", "/api/projects", adminHdr, body); rec.Code != 422 {
			t.Errorf("projeto com coluna inválida %s: %d", body, rec.Code)
		}
	}
	rec := do(cookie, "POST", "/api/projects", adminHdr, `{"name":"LP Consultoria","url":"https://lp.exemplo.com.br/oferta","stack":"Next.js","pipelineId":"pl-1","stageId":"pl-1:novos"}`)
	var proj ProjectView
	json.Unmarshal(rec.Body.Bytes(), &proj)
	if rec.Code != 201 || proj.ID == "" || proj.SourceName != "LP Consultoria" || proj.Origins == nil {
		t.Fatalf("criar projeto: %d %s", rec.Code, rec.Body)
	}
	rec = do(cookie, "POST", "/api/projects/"+proj.ID+"/forms", adminHdr, `{"name":"Contato","selector":"#contato","fields":{"nome":"#n","email":"#e"}}`)
	var form TrackedForm
	json.Unmarshal(rec.Body.Bytes(), &form)
	if rec.Code != 201 || form.Fields["email"] != "#e" {
		t.Fatalf("criar formulário: %d %s", rec.Code, rec.Body)
	}
	if rec := do(cookie, "PUT", "/api/projects/"+proj.ID+"/forms/"+form.ID, adminHdr, `{"name":"Contato 2","selector":"#contato","fields":{"nome":"#n2"}}`); rec.Code != 200 {
		t.Errorf("editar formulário: %d", rec.Code)
	}
	if rec := do(cookie, "POST", "/api/projects/"+proj.ID+"/forms", adminHdr, `{"name":"X","selector":"#x","fields":{"cpf":"#c"}}`); rec.Code != 422 {
		t.Errorf("campo desconhecido: %d", rec.Code)
	}

	// ---- chave do snippet e envio ----
	rec = do(cookie, "POST", "/api/tokens", adminHdr, `{"name":"Connect LP","scopes":["forms:write"],"env":"test","projectId":"`+proj.ID+`"}`)
	var created struct {
		Token string
		Meta  APIToken
	}
	json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != 201 || !strings.HasPrefix(created.Token, "kld_test_") || created.Meta.ProjectID != proj.ID {
		t.Fatalf("criar chave: %d %s", rec.Code, rec.Body)
	}
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM ApiToken WHERE tokenHash = ? OR name = ? OR prefix = ?`, created.Token, created.Token, created.Token).Scan(&n)
	if n != 0 {
		t.Error("o segredo da chave não pode estar no banco")
	}
	send := func(body string) *httptest.ResponseRecorder {
		return do(nil, "POST", "/api/connect/leads", map[string]string{"Authorization": "Bearer " + created.Token, "Origin": "https://lp.exemplo.com.br", "Content-Type": "application/json"}, body)
	}
	const body = `{"form":"#contato","lead":{"nome":"Maria Souza","email":"Maria@Exemplo.com","telefone":"(11) 99999-8888","empresa":"Acme","mensagem":"Oi"},"attribution":{"utm_source":"google"}}`
	rec = send(body)
	var sent struct{ ID string }
	json.Unmarshal(rec.Body.Bytes(), &sent)
	if rec.Code != 201 || sent.ID == "" {
		t.Fatalf("enviar: %d %s", rec.Code, rec.Body)
	}

	// o lead é um Lead v2 (não oportunidade), na pipeline/coluna/fonte do projeto, com fonte e formulário
	lead, err := getLeadRecord(sent.ID)
	if err != nil {
		t.Fatal(err)
	}
	if lead.Origin != "INBOUND" || lead.PipelineID != "pl-1" || lead.StageID != "pl-1:novos" || lead.SourceName != "LP Consultoria" || lead.Status != "ACTIVE" ||
		lead.Email != "maria@exemplo.com" || lead.PersonID == "" || !contains(lead.Tags, "Teste") || lead.CustomData["formName"] != "Contato 2" || lead.CustomData["projectId"] != proj.ID {
		t.Errorf("lead: %+v", lead)
	}
	var opps int
	db.QueryRow(`SELECT COUNT(*) FROM Opportunity`).Scan(&opps)
	if opps != 0 {
		t.Errorf("o connect.js não pode criar Oportunidade: %d", opps)
	}
	// aparece em /api/crm/leads para quem tem leads:read
	rec = do(cookie, "GET", "/api/crm/leads?pipelineId=pl-1", nil, "")
	var listed []LeadDTO
	json.Unmarshal(rec.Body.Bytes(), &listed)
	if rec.Code != 200 || len(listed) != 1 || listed[0].ID != sent.ID {
		t.Errorf("lista de leads: %d %s", rec.Code, rec.Body)
	}
	// mesma pessoa = não duplica o contato; mas é um lead novo
	if rec := send(body); rec.Code != 201 {
		t.Fatalf("segundo envio: %d", rec.Code)
	}
	var contacts, leads, projSub, formSub, hist int
	db.QueryRow(`SELECT COUNT(*) FROM Contact WHERE LOWER(email) = 'maria@exemplo.com'`).Scan(&contacts)
	db.QueryRow(`SELECT COUNT(*) FROM ` + leadTbl).Scan(&leads)
	db.QueryRow(`SELECT submissions FROM ConnectedProject WHERE id = ?`, proj.ID).Scan(&projSub)
	db.QueryRow(`SELECT submissions FROM TrackedForm WHERE id = ?`, form.ID).Scan(&formSub)
	db.QueryRow(`SELECT COUNT(*) FROM ChangeLog WHERE entity = 'lead' AND kind = 'create' AND actor LIKE 'Connect:%'`).Scan(&hist)
	if contacts != 1 || leads != 2 || projSub != 2 || formSub != 2 || hist != 2 {
		t.Errorf("contatos=%d leads=%d envios do projeto=%d do formulário=%d histórico=%d", contacts, leads, projSub, formSub, hist)
	}
	// o token mostra o último uso e o projeto; a listagem de projetos traz os envios
	rec = do(cookie, "GET", "/api/projects", adminHdr, "")
	var views []ProjectView
	json.Unmarshal(rec.Body.Bytes(), &views)
	if len(views) != 1 || views[0].Submissions != 2 || len(views[0].Forms) != 1 || views[0].Forms[0].Submissions != 2 || views[0].LastSubmissionAt == nil {
		t.Errorf("projetos: %d %s", rec.Code, rec.Body)
	}

	// ---- 401 revogado, 403 origem, 403 sem forms:write ----
	if rec := do(nil, "POST", "/api/connect/leads", map[string]string{"Authorization": "Bearer " + created.Token, "Origin": "https://malvado.example"}, body); rec.Code != 403 {
		t.Errorf("origem fora: %d", rec.Code)
	}
	// ---- D40: desconectar a fonte (funil e coluna nulos) ----
	if rec := do(cookie, "PUT", "/api/projects/"+proj.ID, adminHdr, `{"name":"LP Consultoria","url":"https://lp.exemplo.com.br/oferta","pipelineId":"pl-1"}`); rec.Code != 422 {
		t.Errorf("funil sem coluna: %d", rec.Code)
	}
	rec = do(cookie, "PUT", "/api/projects/"+proj.ID, adminHdr, `{"name":"LP Consultoria","url":"https://lp.exemplo.com.br/oferta","stack":"Next.js","pipelineId":null,"stageId":null}`)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"pipelineId":null`) || !strings.Contains(rec.Body.String(), `"stageId":null`) {
		t.Fatalf("desconectar fonte: %d %s", rec.Code, rec.Body)
	}
	rec = do(cookie, "GET", "/api/projects", adminHdr, "")
	if !strings.Contains(rec.Body.String(), proj.ID) {
		t.Errorf("projeto sem funil segue na lista: %s", rec.Body)
	}
	var leadsBefore, subBefore int
	db.QueryRow(`SELECT COUNT(*) FROM ` + leadTbl).Scan(&leadsBefore)
	db.QueryRow(`SELECT submissions FROM ConnectedProject WHERE id = ?`, proj.ID).Scan(&subBefore)
	rec = send(body)
	if rec.Code != 422 || !strings.Contains(rec.Body.String(), "projeto sem funil") {
		t.Errorf("envio a projeto sem funil: %d %s", rec.Code, rec.Body)
	}
	var leadsAfter, subAfter int
	db.QueryRow(`SELECT COUNT(*) FROM ` + leadTbl).Scan(&leadsAfter)
	db.QueryRow(`SELECT submissions FROM ConnectedProject WHERE id = ?`, proj.ID).Scan(&subAfter)
	if leadsAfter != leadsBefore || subAfter != subBefore {
		t.Errorf("a recusa não pode gravar nada: leads %d->%d envios %d->%d", leadsBefore, leadsAfter, subBefore, subAfter)
	}
	if _, err := connectDB.IngestLead(inboundLead{Project: Project{ID: proj.ID, Name: "x"}, Name: "Z", Email: "z@x.co"}); err == nil {
		t.Error("IngestLead direto deveria recusar projeto sem funil")
	}
	rec = do(cookie, "PUT", "/api/projects/"+proj.ID, adminHdr, `{"name":"LP Consultoria","url":"https://lp.exemplo.com.br/oferta","stack":"Next.js","pipelineId":"pl-1","stageId":"pl-1:novos"}`)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"pipelineId":"pl-1"`) {
		t.Fatalf("reconectar: %d %s", rec.Code, rec.Body)
	}
	if rec := send(body); rec.Code != 201 {
		t.Errorf("envio depois de reconectar: %d %s", rec.Code, rec.Body)
	}
	db.Exec(`DELETE FROM ` + leadTbl + ` WHERE id IN (SELECT id FROM (SELECT id FROM ` + leadTbl + ` ORDER BY createdAt DESC LIMIT 1) x)`)

	rec = do(cookie, "POST", "/api/tokens", adminHdr, `{"name":"Leitor","scopes":["leads:read"]}`)
	var reader struct{ Token string }
	json.Unmarshal(rec.Body.Bytes(), &reader)
	if rec := do(nil, "POST", "/api/connect/leads", map[string]string{"Authorization": "Bearer " + reader.Token}, body); rec.Code != 403 {
		t.Errorf("leads:read na entrada: %d", rec.Code)
	}
	if rec := do(cookie, "DELETE", "/api/tokens/"+created.Meta.ID, adminHdr, ""); rec.Code != 200 {
		t.Fatalf("revogar: %d", rec.Code)
	}
	if rec := send(body); rec.Code != 401 {
		t.Errorf("chave revogada: %d", rec.Code)
	}
	// desconectar o projeto arquiva; os leads ficam
	if rec := do(cookie, "DELETE", "/api/projects/"+proj.ID, adminHdr, ""); rec.Code != 200 {
		t.Errorf("desconectar: %d", rec.Code)
	}
	db.QueryRow(`SELECT COUNT(*) FROM ` + leadTbl).Scan(&leads)
	if leads != 2 {
		t.Errorf("os leads já criados ficam: %d", leads)
	}
	if rec := do(cookie, "GET", "/api/projects", adminHdr, ""); strings.Contains(rec.Body.String(), proj.ID) {
		t.Errorf("projeto arquivado não lista: %s", rec.Body)
	}
}

// D40: um banco criado antes (pipelineId/stageId NOT NULL) é afrouxado para NULL na subida, sem perder linhas.
func TestIntegrationConnectLegacyNotNull(t *testing.T) {
	integrationDB(t)
	db.Exec("DROP TABLE IF EXISTS ConnectedProject")
	if _, err := db.Exec(`CREATE TABLE ConnectedProject (id VARCHAR(64) PRIMARY KEY, name VARCHAR(160) NOT NULL, url VARCHAR(500) NOT NULL, origins TEXT NULL, stack VARCHAR(120) NULL,
		description VARCHAR(500) NULL, pipelineId VARCHAR(64) NOT NULL, stageId VARCHAR(128) NOT NULL, sourceName VARCHAR(255) NOT NULL, submissions INT NOT NULL DEFAULT 0,
		lastSubmissionAt DATETIME NULL, archivedAt DATETIME NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL) ENGINE=InnoDB`); err != nil {
		t.Fatal(err)
	}
	db.Exec(`INSERT INTO ConnectedProject (id, name, url, pipelineId, stageId, sourceName, createdAt, updatedAt) VALUES ('prj-velho', 'Velho', 'https://v.exemplo.com', 'pl-1', 'pl-1:novos', 'Velho', NOW(), NOW())`)
	ensureConnectSchema()
	ensureConnectSchema() // idempotente
	var pl, st sql.NullString
	if err := db.QueryRow(`SELECT pipelineId, stageId FROM ConnectedProject WHERE id = 'prj-velho'`).Scan(&pl, &st); err != nil || pl.String != "pl-1" || st.String != "pl-1:novos" {
		t.Fatalf("linha antiga preservada: %v %v %v", pl, st, err)
	}
	p := Project{ID: "prj-velho", Name: "Velho", URL: "https://v.exemplo.com", SourceName: "Velho"}
	if err := (sqlConnectStore{}).SaveProject(&p, true); err != nil {
		t.Fatalf("salvar sem funil depois da migração: %v", err)
	}
	got, err := (sqlConnectStore{}).ProjectByID("prj-velho")
	if err != nil || got.PipelineID != "" || got.StageID != "" {
		t.Errorf("projeto sem funil: %+v %v", got, err)
	}
}
