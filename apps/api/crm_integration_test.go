package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Integração do CRM contra um MySQL de verdade (mesmas regras do workflow_integration_test.go:
// só com TEST_DSN, só localhost, apaga e recria as tabelas Contact, Company, CompanyStakeholder e Lead).

func crmDB(t *testing.T) {
	t.Helper()
	integrationDB(t) // abre `db` e exige localhost; também recria as tabelas do workflow
	t.Setenv("DATA_KEY", testKey)
	for _, tbl := range []string{leadTbl, "CompanyStakeholder", "Contact", "Company", "ChangeLog"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	// Tabelas como o Prisma as criou (antes das colunas novas).
	for _, ddl := range []string{
		`CREATE TABLE Company (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, logoUrl VARCHAR(500) NULL, website VARCHAR(255) NULL)`,
		`CREATE TABLE Contact (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NULL, phone VARCHAR(40) NULL, avatarUrl VARCHAR(500) NULL, companyId VARCHAR(64) NULL)`,
		`INSERT INTO Contact (id, name, email) VALUES ('cont1', 'João Antigo', 'joao@acme.com')`,
		`INSERT INTO Company (id, name, website) VALUES ('comp1', 'Acme Antiga', 'https://acme.com')`,
	} {
		if _, err := db.Exec(ddl); err != nil {
			t.Fatal(err)
		}
	}
	// Opportunity e Note como o Prisma os criou: vínculos com pessoa/empresa/responsável e as anotações (WP4-2)
	for _, c := range []string{"contactId", "companyId", "ownerId"} {
		if ok, _ := columnExists("Opportunity", c); !ok {
			if _, err := db.Exec("ALTER TABLE Opportunity ADD COLUMN " + c + " VARCHAR(64) NULL"); err != nil {
				t.Fatal(err)
			}
		}
	}
	db.Exec("DROP TABLE IF EXISTS Note")
	if _, err := db.Exec(`CREATE TABLE Note (id VARCHAR(64) PRIMARY KEY, content TEXT NOT NULL, type VARCHAR(16) NOT NULL DEFAULT 'NOTE', opportunityId VARCHAR(64) NOT NULL, authorId VARCHAR(64) NULL, createdAt DATETIME NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	ensureCRMSchema()
	ensureCRMSchema() // idempotente: a segunda rodada não pode falhar nem duplicar
	seedBasePipeline(t) // o funil "q4" de pano de fundo (WP4-1: etapa inexistente é recusada)
}

type crmReply struct {
	code   int
	body   []byte
	header http.Header
}

func crmCall(h http.HandlerFunc, method, path, id string, body any) crmReply {
	var r *http.Request
	if body == nil {
		r = httptest.NewRequest(method, path, nil)
	} else {
		b, _ := json.Marshal(body)
		r = httptest.NewRequest(method, path, strings.NewReader(string(b)))
	}
	if id != "" {
		r.SetPathValue("id", id)
	}
	rec := httptest.NewRecorder()
	h(rec, r)
	return crmReply{rec.Code, rec.Body.Bytes(), rec.Header()}
}

func (r crmReply) into(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.body, v); err != nil {
		t.Fatalf("JSON inválido (%d): %s", r.code, r.body)
	}
}

func TestIntegrationCRM(t *testing.T) {
	crmDB(t)

	// 0. linhas antigas (sem createdAt, sem as colunas novas) continuam legíveis
	var old PersonDTO
	if r := crmCall(handlePersonByID, "GET", "/x", "cont1", nil); r.code != 200 {
		t.Fatalf("pessoa antiga: %d %s", r.code, r.body)
	} else {
		r.into(t, &old)
	}
	if old.Name != "João Antigo" || old.Lifecycle != "LEAD" || old.Tags == nil || old.CreatedAt != nil {
		t.Errorf("pessoa antiga mal lida: %+v", old)
	}
	var oldCo CompanyDTO
	crmCall(handleCompanyByID, "GET", "/x", "comp1", nil).into(t, &oldCo)
	if oldCo.Name != "Acme Antiga" || oldCo.Website != "https://acme.com" || oldCo.Status != "REVIEW" || oldCo.Stakeholders == nil {
		t.Errorf("empresa antiga mal lida: %+v", oldCo)
	}

	// 1. pessoas
	ana := map[string]any{"id": "p1", "name": "Ana Souza", "email": "ANA@acme.com", "phone": "(11) 99999-0000", "document": "111.444.777-35", "role": "Diretora",
		"tags": []string{"Decisor"}, "lifecycle": "PROSPECT", "extraEmails": []map[string]string{{"value": "ana@gmail.com", "label": "Pessoal"}}, "customData": map[string]any{"porte": "médio"}}
	r := crmCall(handlePeople, "POST", "/x", "", ana)
	if r.code != 201 {
		t.Fatalf("criar pessoa: %d %s", r.code, r.body)
	}
	var got PersonDTO
	r.into(t, &got)
	if got.Document != "•••.•••.•••-35" || got.Email != "ana@acme.com" || len(got.ExtraEmails) != 1 || got.CustomData["porte"] != "médio" || got.CreatedAt == nil {
		t.Fatalf("pessoa devolvida: %+v", got)
	}
	var enc, hash sql.NullString
	db.QueryRow(`SELECT documentEnc, documentHash FROM Contact WHERE id = 'p1'`).Scan(&enc, &hash)
	if !enc.Valid || strings.Contains(enc.String, "111") || len(hash.String) != 64 {
		t.Errorf("CPF deve estar cifrado e com hash no banco: %q %q", enc.String, hash.String)
	}
	var rev map[string]string
	crmCall(handlePersonDocument, "GET", "/x", "p1", nil).into(t, &rev)
	if rev["document"] != "111.444.777-35" {
		t.Errorf("revelar CPF: %v", rev)
	}
	if r := crmCall(handlePeople, "POST", "/x", "", map[string]any{"id": "p2", "name": "Outra Ana", "document": "11144477735"}); r.code != 409 {
		t.Errorf("CPF repetido deveria dar 409: %d %s", r.code, r.body)
	}
	if r := crmCall(handlePeople, "POST", "/x", "", ana); r.code != 409 {
		t.Errorf("id repetido deveria dar 409: %d", r.code)
	}
	if r := crmCall(handlePeople, "POST", "/x", "", map[string]any{"name": "Zé", "document": "111.444.777-34"}); r.code != 422 {
		t.Errorf("CPF inválido: %d", r.code)
	}
	// o que a API devolve (CPF mascarado) volta no PUT sem apagar nem trocar o CPF
	got.Role = "Diretora comercial"
	if r := crmCall(handlePersonByID, "PUT", "/x", "p1", got); r.code != 200 {
		t.Fatalf("PUT com CPF mascarado: %d %s", r.code, r.body)
	}
	crmCall(handlePersonDocument, "GET", "/x", "p1", nil).into(t, &rev)
	if rev["document"] != "111.444.777-35" {
		t.Errorf("CPF não deveria ter mudado: %v", rev)
	}
	got.Document = ""
	crmCall(handlePersonByID, "PUT", "/x", "p1", got)
	crmCall(handlePersonDocument, "GET", "/x", "p1", nil).into(t, &rev)
	if rev["document"] != "" {
		t.Errorf("document vazio deveria apagar: %v", rev)
	}
	// sem chave no servidor, CPF novo é recusado com mensagem clara
	t.Setenv("DATA_KEY", "")
	if r := crmCall(handlePeople, "POST", "/x", "", map[string]any{"name": "Sem Chave", "document": "529.982.247-25"}); r.code != 422 || !strings.Contains(string(r.body), "DATA_KEY") {
		t.Errorf("sem DATA_KEY: %d %s", r.code, r.body)
	}
	t.Setenv("DATA_KEY", testKey)
	// vários sem CPF coexistem (NULL não conta como duplicado)
	for _, id := range []string{"p3", "p4", "p5"} {
		if r := crmCall(handlePeople, "POST", "/x", "", map[string]any{"id": id, "name": "Pessoa " + id, "email": id + "@x.co", "lifecycle": "CLIENT"}); r.code != 201 {
			t.Fatalf("pessoa sem CPF %s: %d %s", id, r.code, r.body)
		}
	}
	var list []PersonDTO
	lr := crmCall(handlePeople, "GET", "/api/crm/people?lifecycle=CLIENT&limit=2", "", nil)
	lr.into(t, &list)
	if len(list) != 2 || lr.header.Get("X-Total-Count") != "3" {
		t.Errorf("filtro/paginação: %d itens, total %s", len(list), lr.header.Get("X-Total-Count"))
	}
	crmCall(handlePeople, "GET", "/api/crm/people?q=ana", "", nil).into(t, &list)
	if len(list) != 1 || list[0].ID != "p1" {
		t.Errorf("busca por nome: %+v", list)
	}
	if r := crmCall(handlePersonByID, "DELETE", "/x", "p3", nil); r.code != 200 {
		t.Fatalf("arquivar: %d", r.code)
	}
	lr = crmCall(handlePeople, "GET", "/api/crm/people?lifecycle=CLIENT", "", nil)
	lr.into(t, &list)
	if len(list) != 2 {
		t.Errorf("arquivada não deve listar: %d", len(list))
	}
	crmCall(handlePeople, "GET", "/api/crm/people?lifecycle=CLIENT&archived=1", "", nil).into(t, &list)
	if len(list) != 3 {
		t.Errorf("archived=1 lista todas: %d", len(list))
	}
	var p3 PersonDTO
	crmCall(handlePersonByID, "GET", "/x", "p3", nil).into(t, &p3)
	p3.ArchivedAt = nil
	crmCall(handlePersonByID, "PUT", "/x", "p3", p3)
	crmCall(handlePeople, "GET", "/api/crm/people?lifecycle=CLIENT", "", nil).into(t, &list)
	if len(list) != 3 {
		t.Errorf("desarquivar via PUT: %d", len(list))
	}

	// 2. empresas
	co := map[string]any{"id": "c1", "name": "Acme Corp", "document": "11.222.333/0001-81", "segment": "Tecnologia", "lifecycle": "PROSPECT", "state": "sp", "defaultContactId": "p1",
		"stakeholders": []map[string]string{{"personId": "p1", "description": "Decide o orçamento", "tag": "Decisor"}, {"personId": "p4", "description": "Técnico", "tag": "Técnico"}}}
	r = crmCall(handleCompanies, "POST", "/x", "", co)
	if r.code != 201 {
		t.Fatalf("criar empresa: %d %s", r.code, r.body)
	}
	var c CompanyDTO
	r.into(t, &c)
	if c.Document != "11222333000181" || c.Status != "ACTIVE" || c.State != "SP" || len(c.Stakeholders) != 2 || c.Stakeholders[0].PersonID != "p1" || c.Stakeholders[1].Tag != "Técnico" {
		t.Fatalf("empresa devolvida: %+v", c)
	}
	if r := crmCall(handleCompanies, "POST", "/x", "", map[string]any{"id": "c2", "name": "Outra", "document": "11222333000181"}); r.code != 409 {
		t.Errorf("CNPJ repetido: %d %s", r.code, r.body)
	}
	if r := crmCall(handleCompanies, "POST", "/x", "", map[string]any{"id": "c3", "name": "Alfa", "document": "12.ABC.345/01DE-35"}); r.code != 201 {
		t.Errorf("CNPJ alfanumérico: %d %s", r.code, r.body)
	}
	for _, id := range []string{"c4", "c5"} { // sem CNPJ: em análise, e várias podem coexistir
		if r := crmCall(handleCompanies, "POST", "/x", "", map[string]any{"id": id, "name": "Sem CNPJ " + id}); r.code != 201 {
			t.Fatalf("empresa sem CNPJ %s: %d %s", id, r.code, r.body)
		}
	}
	c.Stakeholders = []StakeholderDTO{{PersonID: "p5", Description: "Novo contato", Tag: "Compras"}}
	c.Website = "https://acme.com.br"
	if r := crmCall(handleCompanyByID, "PUT", "/x", "c1", c); r.code != 200 {
		t.Fatalf("PUT empresa: %d %s", r.code, r.body)
	}
	var after CompanyDTO
	crmCall(handleCompanyByID, "GET", "/x", "c1", nil).into(t, &after)
	if len(after.Stakeholders) != 1 || after.Stakeholders[0].PersonID != "p5" || after.Website != "https://acme.com.br" {
		t.Errorf("stakeholders deveriam ter sido substituídos: %+v", after)
	}
	var cl []CompanyDTO
	crmCall(handleCompanies, "GET", "/api/crm/companies", "", nil).into(t, &cl)
	byID := map[string]CompanyDTO{}
	for _, x := range cl {
		byID[x.ID] = x
	}
	if len(cl) != 5 || len(byID["c1"].Stakeholders) != 1 || byID["c4"].Status != "REVIEW" || byID["comp1"].Name != "Acme Antiga" {
		t.Errorf("lista de empresas: %d itens, %+v", len(cl), byID["c4"])
	}
	crmCall(handleCompanyByID, "DELETE", "/x", "c4", nil)
	crmCall(handleCompanies, "GET", "/api/crm/companies", "", nil).into(t, &cl)
	if len(cl) != 4 {
		t.Errorf("empresa arquivada não deve listar: %d", len(cl))
	}

	// 3. leads
	lead := map[string]any{"id": "l1", "name": "Renata Moura", "email": "renata@x.co", "personId": "p1", "companyId": "c1", "pipelineId": "q4", "stageId": "q4:novos", "origin": "INBOUND",
		"sourceName": "LP Consultoria", "estimatedValue": 4500.5, "expectedCloseAt": "2026-11-30", "tags": []string{"Quente"}, "message": "Quero um diagnóstico", "customData": map[string]any{"cargo": "CEO"}}
	r = crmCall(handleCRMLeads, "POST", "/x", "", lead)
	if r.code != 201 {
		t.Fatalf("criar lead: %d %s", r.code, r.body)
	}
	var l LeadDTO
	r.into(t, &l)
	if l.Status != "ACTIVE" || l.WasSeen || *l.EstimatedValue != 4500.5 || l.ExpectedCloseAt == nil || l.ExpectedCloseAt.Format("2006-01-02") != "2026-11-30" || l.CustomData["cargo"] != "CEO" || l.Tags[0] != "Quente" {
		t.Fatalf("lead devolvido: %+v", l)
	}
	if r := crmCall(handleCRMLeads, "POST", "/x", "", lead); r.code != 409 {
		t.Errorf("lead repetido: %d", r.code)
	}
	crmCall(handleCRMLeads, "POST", "/x", "", map[string]any{"id": "l2", "name": "Outro", "phone": "11999990000", "pipelineId": "b2b", "stageId": "b2b:novos", "origin": "OUTBOUND", "sourceName": "Carol"})
	var ll []LeadDTO
	lr = crmCall(handleCRMLeads, "GET", "/api/crm/leads?pipelineId=q4", "", nil)
	lr.into(t, &ll)
	if len(ll) != 1 || ll[0].ID != "l1" || lr.header.Get("X-Total-Count") != "1" {
		t.Errorf("filtro por funil: %+v", ll)
	}
	crmCall(handleCRMLeads, "GET", "/api/crm/leads?personId=p1&status=ACTIVE", "", nil).into(t, &ll)
	if len(ll) != 1 {
		t.Errorf("filtro por pessoa e situação: %d", len(ll))
	}
	// mover para "Em contato" e marcar como visto; depois qualificar
	l.StageID, l.WasSeen = "q4:contato", true
	if r := crmCall(handleCRMLeadByID, "PUT", "/x", "l1", l); r.code != 200 {
		t.Fatalf("mover lead: %d %s", r.code, r.body)
	}
	// WP4-2: o PUT não qualifica mais (era o B-01: o lead virava QUALIFIED apontando para uma oportunidade inexistente)
	l.Status, l.ConvertedOpportunityID = "QUALIFIED", "1790000000000000009"
	if r := crmCall(handleCRMLeadByID, "PUT", "/x", "l1", l); r.code != 422 {
		t.Errorf("PUT com status QUALIFIED deveria ser 422: %d %s", r.code, r.body)
	}
	l.Status, l.ConvertedOpportunityID = "ACTIVE", ""
	if r := crmCall(handleQualifyLead, "POST", "/api/crm/leads/l1/qualify", "l1", nil); r.code != 201 {
		t.Fatalf("qualificar: %d %s", r.code, r.body)
	}
	var back LeadDTO
	crmCall(handleCRMLeadByID, "GET", "/x", "l1", nil).into(t, &back)
	if back.StageID != "q4:contato" || !back.WasSeen || back.Status != "QUALIFIED" || back.ConvertedOpportunityID == "" {
		t.Errorf("lead depois de mover e qualificar: %+v", back)
	}
	if countWhere(t, "Opportunity", "id = ?", back.ConvertedOpportunityID) != 1 {
		t.Errorf("a oportunidade do lead qualificado precisa existir: %q", back.ConvertedOpportunityID)
	}
	crmCall(handleCRMLeads, "GET", "/api/crm/leads?status=ACTIVE", "", nil).into(t, &ll)
	if len(ll) != 1 || ll[0].ID != "l2" {
		t.Errorf("só l2 segue ativo: %+v", ll)
	}
	crmCall(handleCRMLeadByID, "DELETE", "/x", "l2", nil)
	crmCall(handleCRMLeads, "GET", "/api/crm/leads", "", nil).into(t, &ll)
	if len(ll) != 1 {
		t.Errorf("lead arquivado não deve listar: %d", len(ll))
	}
	if r := crmCall(handleCRMLeadByID, "GET", "/x", "nao-existe", nil); r.code != 404 {
		t.Errorf("lead inexistente: %d", r.code)
	}
}
