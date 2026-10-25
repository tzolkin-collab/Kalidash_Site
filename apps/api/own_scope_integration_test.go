package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// D4 (WP3b) em MySQL de verdade (só com TEST_DSN), pelo caminho completo (withAuth + handlers reais):
// o Vendedor (leads:own, opportunities:own) vê e mexe só no que é dele; o Gerente (leads:read/write) vê tudo.
//   TEST_DSN='root:@tcp(127.0.0.1:3337)/kalidash_test' go test -run IntegrationEscopoOwn -v .

func TestIntegrationEscopoOwn(t *testing.T) {
	adm := oppEnv(t)
	db.Exec(`DELETE FROM Opportunity`)
	ven, err := authDB.AddMember(Member{Email: "ven@kalidash.test", Name: "Vera", Role: roleSeller}, adm.ID)
	if err != nil {
		t.Fatal(err)
	}
	ven2, _ := authDB.AddMember(Member{Email: "ven2@kalidash.test", Name: "Vitor", Role: roleSeller}, adm.ID)
	ger, _ := authDB.AddMember(Member{Email: "ger@kalidash.test", Name: "Gil", Role: roleManager}, adm.ID)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/leads", enableCORS(handleOpportunities))
	mux.HandleFunc("/api/leads/move", enableCORS(handleMoveOpportunity))
	mux.HandleFunc("/api/leads/notes", enableCORS(handleNotes))
	registerCRMRoutes(mux)
	h := withAuth(mux)
	cookieOf := func(m Member) *http.Cookie {
		rec := httptest.NewRecorder()
		if err := startSession(rec, httptest.NewRequest("GET", "/", nil), m.ID); err != nil {
			t.Fatal(err)
		}
		return rec.Result().Cookies()[0]
	}
	do := func(m Member, method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.AddCookie(cookieOf(m))
		r.Header.Set("Origin", testAdminOrigin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec
	}

	// ---- oportunidades: o1 é da Vera, o2 do Vitor, o3 sem responsável ----
	for _, o := range [][2]string{{"o1", ven.ID}, {"o2", ven2.ID}} {
		db.Exec(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, createdAt, updatedAt, ownerMemberId) VALUES (?, ?, 100, 'q4:novos', 'MEDIUM', '[]', NOW(), NOW(), ?)`, o[0], "Opp "+o[0], o[1])
	}
	db.Exec(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, createdAt, updatedAt) VALUES ('o3', 'Opp o3', 100, 'q4:novos', 'MEDIUM', '[]', NOW(), NOW())`)

	ids := func(rec *httptest.ResponseRecorder) string {
		var list []Opportunity
		json.Unmarshal(rec.Body.Bytes(), &list)
		var out []string
		for _, o := range list {
			out = append(out, o.ID)
		}
		return strings.Join(out, ",")
	}
	if rec := do(ven, "GET", "/api/leads", ""); rec.Code != 200 || ids(rec) != "o1" {
		t.Errorf("Vendedor deveria ver só o1: %d %q", rec.Code, ids(rec))
	}
	if rec := do(ger, "GET", "/api/leads", ""); rec.Code != 200 || len(strings.Split(ids(rec), ",")) != 3 {
		t.Errorf("Gerente vê as 3: %d %q", rec.Code, ids(rec))
	}
	// editar: a dele passa, a do outro e a sem dono são 404
	if rec := do(ven, "PUT", "/api/leads", `{"id":"o1","title":"Renomeada","value":100,"priority":"HIGH"}`); rec.Code != 200 {
		t.Errorf("editar a própria: %d %s", rec.Code, rec.Body)
	}
	for _, id := range []string{"o2", "o3"} {
		if rec := do(ven, "PUT", "/api/leads", `{"id":"`+id+`","title":"X","value":1}`); rec.Code != 404 {
			t.Errorf("editar %s de outro: %d", id, rec.Code)
		}
	}
	// não reatribui nem se apropria
	if rec := do(ven, "PUT", "/api/leads", `{"id":"o1","title":"R","value":1,"ownerMemberId":"`+ven2.ID+`"}`); rec.Code != 403 {
		t.Errorf("reatribuir: %d", rec.Code)
	}
	if rec := do(ven, "PUT", "/api/leads", `{"id":"o1","title":"R","value":1,"ownerMemberId":null}`); rec.Code != 403 {
		t.Errorf("largar o responsável: %d", rec.Code)
	}
	// o Gerente reatribui
	if rec := do(ger, "PUT", "/api/leads", `{"id":"o3","title":"Opp o3","value":1,"ownerMemberId":"`+ven.ID+`"}`); rec.Code != 200 {
		t.Errorf("Gerente reatribui: %d %s", rec.Code, rec.Body)
	}
	if rec := do(ven, "GET", "/api/leads", ""); ids(rec) != "o1,o3" && ids(rec) != "o3,o1" {
		t.Errorf("depois de receber o3: %q", ids(rec))
	}
	// criar fica em nome dele, mesmo pedindo outro responsável
	rec := do(ven, "POST", "/api/leads", `{"title":"Nova","stage":"q4:novos","value":5,"ownerMemberId":"`+ven2.ID+`"}`)
	var created Opportunity
	json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != 201 || created.OwnerMemberID == nil || *created.OwnerMemberID != ven.ID {
		t.Errorf("criar em nome do Vendedor: %d %s", rec.Code, rec.Body)
	}
	// mover, anotar e ler notas: só nas dele
	if rec := do(ven, "POST", "/api/leads/move", `{"lead_id":"o2","column_id":"q4:ass"}`); rec.Code != 404 {
		t.Errorf("mover a do outro: %d", rec.Code)
	}
	if rec := do(ven, "POST", "/api/leads/move", `{"lead_id":"o1","column_id":"q4:ass"}`); rec.Code != 200 {
		t.Errorf("mover a própria: %d %s", rec.Code, rec.Body)
	}
	if rec := do(ven, "GET", "/api/leads/notes?opportunityId=o2", ""); rec.Code != 404 {
		t.Errorf("notas da do outro: %d", rec.Code)
	}
	if rec := do(ven, "POST", "/api/leads/notes", `{"content":"oi","type":"NOTE","opportunityId":"o2"}`); rec.Code != 404 {
		t.Errorf("anotar na do outro: %d", rec.Code)
	}
	if rec := do(ven, "POST", "/api/leads/notes", `{"content":"oi","type":"NOTE","opportunityId":"o1"}`); rec.Code != 201 {
		t.Errorf("anotar na própria (id no corpo): %d %s", rec.Code, rec.Body)
	}
	if rec := do(ven, "GET", "/api/leads/notes?opportunityId=o1", ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), "oi") {
		t.Errorf("ler notas da própria: %d %s", rec.Code, rec.Body)
	}

	// ---- leads v2 ----
	db.Exec(`DELETE FROM ` + leadTbl)
	mk := func(id, owner string) {
		var o any
		if owner != "" {
			o = owner
		}
		if _, err := db.Exec(`INSERT INTO `+leadTbl+` (id, name, email, pipelineId, stageId, origin, sourceName, status, createdAt, updatedAt, ownerMemberId) VALUES (?, ?, 'a@x.com', 'q4', 'q4:novos', 'INBOUND', 'Site', 'ACTIVE', NOW(), NOW(), ?)`, id, "Lead "+id, o); err != nil {
			t.Fatal(err)
		}
	}
	mk("l1", ven.ID)
	mk("l2", ven2.ID)
	mk("l3", "")
	leadIDs := func(rec *httptest.ResponseRecorder) string {
		var list []LeadDTO
		json.Unmarshal(rec.Body.Bytes(), &list)
		var out []string
		for _, l := range list {
			out = append(out, l.ID)
		}
		return strings.Join(out, ",")
	}
	if rec := do(ven, "GET", "/api/crm/leads", ""); rec.Code != 200 || leadIDs(rec) != "l1" || rec.Header().Get("X-Total-Count") != "1" {
		t.Errorf("Vendedor vê só o l1: %d %q total=%s", rec.Code, leadIDs(rec), rec.Header().Get("X-Total-Count"))
	}
	if rec := do(ger, "GET", "/api/crm/leads", ""); len(strings.Split(leadIDs(rec), ",")) != 3 {
		t.Errorf("Gerente vê os 3: %q", leadIDs(rec))
	}
	if rec := do(ven, "GET", "/api/crm/leads/l1", ""); rec.Code != 200 {
		t.Errorf("abrir o próprio: %d", rec.Code)
	}
	for _, id := range []string{"l2", "l3"} {
		if rec := do(ven, "GET", "/api/crm/leads/"+id, ""); rec.Code != 404 {
			t.Errorf("abrir %s de outro: %d", id, rec.Code)
		}
		if rec := do(ven, "PUT", "/api/crm/leads/"+id, `{"name":"X","email":"a@x.com","pipelineId":"q4","stageId":"q4:novos","origin":"INBOUND","sourceName":"Site"}`); rec.Code != 404 {
			t.Errorf("editar %s de outro: %d", id, rec.Code)
		}
		if rec := do(ven, "DELETE", "/api/crm/leads/"+id, ""); rec.Code != 404 {
			t.Errorf("arquivar %s de outro: %d", id, rec.Code)
		}
	}
	// editar o próprio sem mandar ownerId mantém o responsável; mandar outro é 403
	body := `{"name":"Lead l1","email":"a@x.com","pipelineId":"q4","stageId":"q4:contato","origin":"INBOUND","sourceName":"Site"}`
	if rec := do(ven, "PUT", "/api/crm/leads/l1", body); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"ownerId":"`+ven.ID+`"`) {
		t.Errorf("editar o próprio mantém o responsável: %d %s", rec.Code, rec.Body)
	}
	if rec := do(ven, "PUT", "/api/crm/leads/l1", strings.Replace(body, `"origin"`, `"ownerId":"`+ven2.ID+`","origin"`, 1)); rec.Code != 403 {
		t.Errorf("reatribuir o próprio lead: %d", rec.Code)
	}
	// criar fica em nome dele; o Gerente reatribui; responsável inventado é 422
	rec = do(ven, "POST", "/api/crm/leads", `{"name":"Novo","email":"n@x.com","pipelineId":"q4","stageId":"q4:novos","origin":"INBOUND","sourceName":"Site","ownerId":"`+ven2.ID+`"}`)
	var nl LeadDTO
	json.Unmarshal(rec.Body.Bytes(), &nl)
	if rec.Code != 201 || nl.OwnerID != ven.ID {
		t.Errorf("criar lead em nome do Vendedor: %d %s", rec.Code, rec.Body)
	}
	if rec := do(ger, "PUT", "/api/crm/leads/l3", strings.Replace(body, `"origin"`, `"ownerId":"`+ven2.ID+`","origin"`, 1)); rec.Code != 200 || !strings.Contains(rec.Body.String(), ven2.ID) {
		t.Errorf("Gerente reatribui o lead: %d %s", rec.Code, rec.Body)
	}
	if rec := do(ger, "PUT", "/api/crm/leads/l3", strings.Replace(body, `"origin"`, `"ownerId":"tm-inventado","origin"`, 1)); rec.Code != 422 {
		t.Errorf("responsável inventado: %d", rec.Code)
	}

	// Vendedor com leads:read/leads:write extras enxerga tudo (escopo cheio vence o "own")
	if _, err := authDB.SetMemberScopes(ven.ID, []string{"leads:read", "leads:write"}, nil); err != nil {
		t.Fatal(err)
	}
	ven, _ = authDB.MemberByID(ven.ID)
	if rec := do(ven, "GET", "/api/leads", ""); len(strings.Split(ids(rec), ",")) < 3 {
		t.Errorf("com leads:read vê todas: %q", ids(rec))
	}
	if rec := do(ven, "GET", "/api/crm/leads", ""); len(strings.Split(leadIDs(rec), ",")) < 3 {
		t.Errorf("com leads:read vê todos os leads: %q", leadIDs(rec))
	}
}
