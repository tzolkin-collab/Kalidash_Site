package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

// D10 e D9 (WP3b) em MySQL de verdade (só com TEST_DSN):
//   TEST_DSN='root:@tcp(127.0.0.1:3337)/kalidash_test' go test -run IntegrationOportunidadeVinculos -v .

// oppEnv liga CRM e login, cria Opportunity com os vínculos e devolve a pessoa da equipe (Admin raiz).
func oppEnv(t *testing.T) Member {
	t.Helper()
	crmDB(t) // Contact/Company/Lead do CRM e a Opportunity mínima do workflow
	for k, v := range map[string]string{
		"AUTH_API": "1", "CRM_API": "1", "SESSION_SECRET": strings.Repeat("s", 40), "ALLOWED_ORIGINS": testAdminOrigin,
		"AUTH_ROOT_ADMIN": "adm@kalidash.test", "AUTH_BOOTSTRAP_ADMIN": "adm@kalidash.test", "AUTH_DEV_LOGIN": "1", "SITE_URL": "", "GOOGLE_HD": "",
	} {
		t.Setenv(k, v)
	}
	oldA := authDB
	authDB = sqlAuthStore{}
	t.Cleanup(func() { authDB = oldA })
	for _, tbl := range []string{"AuthSession", "ApiToken", "TeamMember", "User"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	if _, err := db.Exec(`CREATE TABLE User (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255) NOT NULL, avatarUrl VARCHAR(500) NULL)`); err != nil {
		t.Fatal(err)
	}
	for _, col := range []string{"companyId", "contactId", "ownerId"} {
		db.Exec("ALTER TABLE Opportunity ADD COLUMN " + col + " VARCHAR(64) NULL")
	}
	ensureCRMSchema() // acrescenta Opportunity.ownerMemberId (idempotente)
	ensureAuthSchema()
	m, err := authDB.MemberByEmail("adm@kalidash.test")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, createdAt, updatedAt) VALUES ('o1','Acme',100,'q4:novos','MEDIUM','["a"]',NOW(),NOW())`); err != nil {
		t.Fatal(err)
	}
	return m
}

func putOpp(t *testing.T, body string) (int, Opportunity) {
	t.Helper()
	rec := httptest.NewRecorder()
	handleOpportunities(rec, httptest.NewRequest("PUT", "/api/leads", strings.NewReader(body)))
	var o Opportunity
	json.Unmarshal(rec.Body.Bytes(), &o)
	return rec.Code, o
}

func TestIntegrationOportunidadeVinculos(t *testing.T) {
	adm := oppEnv(t)
	wantOwner := adm.Name // sem nome cadastrado a ficha mostra o e-mail
	if wantOwner == "" {
		wantOwner = adm.Email
	}
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}

	// D10: pessoa, empresa e responsável (equipe) gravam e voltam com os nomes
	code, o := putOpp(t, `{"id":"o1","title":"Acme","value":100,"contactId":"cont1","companyId":"comp1","ownerMemberId":"`+adm.ID+`"}`)
	if code != 200 || str(o.ContactID) != "cont1" || str(o.ContactName) != "João Antigo" || str(o.CompanyName) != "Acme Antiga" || str(o.OwnerMemberID) != adm.ID || str(o.OwnerName) != wantOwner {
		t.Fatalf("vínculos: %d %+v", code, o)
	}
	rec := httptest.NewRecorder()
	handleOpportunities(rec, httptest.NewRequest("GET", "/api/leads", nil))
	var list []Opportunity
	json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 || str(list[0].ContactName) != "João Antigo" || str(list[0].OwnerName) != wantOwner || str(list[0].OwnerMemberID) != adm.ID {
		t.Fatalf("lista: %+v", list)
	}

	// campo ausente mantém; prioridade e tags (D9) gravam sem mexer nos vínculos
	code, o = putOpp(t, `{"id":"o1","title":"Acme 2","value":100,"priority":"HIGH","tags":["x","y"]}`)
	if code != 200 || o.Priority != "HIGH" || len(o.Tags) != 2 || str(o.ContactID) != "cont1" || str(o.CompanyID) != "comp1" || str(o.OwnerMemberID) != adm.ID {
		t.Fatalf("ausente deve manter: %d %+v", code, o)
	}

	// recusas: id inexistente, pessoa arquivada, responsável desconhecido ou inativo
	db.Exec(`UPDATE Contact SET archivedAt = NOW() WHERE id = 'cont1'`)
	for name, body := range map[string]string{
		"pessoa inexistente":         `{"id":"o1","title":"A","value":1,"contactId":"nao-existe"}`,
		"pessoa arquivada":           `{"id":"o1","title":"A","value":1,"contactId":"cont1"}`,
		"empresa inexistente":        `{"id":"o1","title":"A","value":1,"companyId":"nao-existe"}`,
		"responsável fora da equipe": `{"id":"o1","title":"A","value":1,"ownerMemberId":"tm-nao-existe"}`,
		"id mal formado":             `{"id":"o1","title":"A","value":1,"contactId":"a b;"}`,
	} {
		if c, _ := putOpp(t, body); c != 422 {
			t.Errorf("%s: %d", name, c)
		}
	}
	db.Exec(`UPDATE Contact SET archivedAt = NULL WHERE id = 'cont1'`)

	// limpar: null ou "" tira o vínculo
	code, o = putOpp(t, `{"id":"o1","title":"A","value":1,"contactId":null,"companyId":"","ownerMemberId":null}`)
	if code != 200 || o.ContactID != nil || o.CompanyID != nil || o.OwnerMemberID != nil || o.OwnerName != nil {
		t.Fatalf("limpar: %d %+v", code, o)
	}

	// criar já com vínculos
	rec = httptest.NewRecorder()
	handleOpportunities(rec, httptest.NewRequest("POST", "/api/leads", strings.NewReader(`{"title":"Nova","stage":"q4:novos","value":10,"contactId":"cont1","ownerMemberId":"`+adm.ID+`"}`)))
	var created Opportunity
	json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != 201 || str(created.ContactName) != "João Antigo" || str(created.OwnerMemberID) != adm.ID {
		t.Fatalf("criar com vínculos: %d %s", rec.Code, rec.Body)
	}

	// sem o login ligado, o responsável é recusado (a tabela da equipe não existe); pessoa e empresa seguem
	t.Setenv("AUTH_API", "")
	if c, _ := putOpp(t, `{"id":"o1","title":"A","value":1,"ownerMemberId":"`+adm.ID+`"}`); c != 422 {
		t.Errorf("responsável sem AUTH_API: %d", c)
	}
	if c, o := putOpp(t, `{"id":"o1","title":"A","value":1,"contactId":"cont1"}`); c != 200 || str(o.ContactName) != "João Antigo" {
		t.Errorf("pessoa sem AUTH_API: %d %+v", c, o)
	}

	// 404 continua 404
	if c, _ := putOpp(t, `{"id":"nao-existe","title":"x","value":1}`); c != 404 {
		t.Errorf("inexistente: %d", c)
	}
}
