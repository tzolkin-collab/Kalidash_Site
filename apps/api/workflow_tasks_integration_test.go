package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// WP4-1, itens 3, 4 e 5: tarefas órfãs, limpar campos, entidade que existe, concluir tarefa de campo e tarefas por dono.
//   TEST_DSN='root:@tcp(127.0.0.1:3361)/kalidash_test' go test -run IntegrationTarefas -v .

func addOppColumns(t *testing.T) {
	t.Helper()
	for _, col := range []string{"companyId", "contactId", "ownerId"} {
		db.Exec("ALTER TABLE Opportunity ADD COLUMN " + col + " VARCHAR(64) NULL") // já existe em alguns ambientes
	}
}

func getTasks(t *testing.T, query string) []TaskDTO {
	t.Helper()
	var out []TaskDTO
	r := call(handleTasks, "GET", "/api/tasks"+query, "", nil)
	if r.code != 200 {
		t.Fatalf("GET /api/tasks%s: %d %s", query, r.code, r.body)
	}
	r.into(t, &out)
	return out
}

func taskByID(t *testing.T, id string) (TaskDTO, bool) {
	t.Helper()
	var all []TaskDTO
	call(handleTasks, "GET", "/api/tasks", "", nil).into(t, &all)
	for _, x := range all {
		if x.ID == id {
			return x, true
		}
	}
	return TaskDTO{}, false
}

// requirementTask devolve a tarefa de um requisito criada pela tentativa de mover/seguir o registro.
func requirementTask(t *testing.T, req, kind, id string) TaskDTO {
	t.Helper()
	var all []TaskDTO
	call(handleTasks, "GET", "/api/tasks?entity="+kind+"&entityId="+id, "", nil).into(t, &all)
	for _, x := range all {
		if x.RequirementID != nil && *x.RequirementID == req {
			return x
		}
	}
	t.Fatalf("sem tarefa do requisito %s em %s/%s", req, kind, id)
	return TaskDTO{}
}

// Item 3: B-06 (órfãs), B-07 (limpar), entidade inexistente.
func TestIntegrationTarefasOrfasELimpar(t *testing.T) {
	bothDSN(t, func(t *testing.T) {
		addOppColumns(t)
		insertOpp(t, "o1", "g:neg", "g")
		insertOpp(t, "o2", "g:prop", "g")
		moveOpp("o1", "g:ass") // 409: cria a tarefa "Informar CNPJ"
		moveOpp("o2", "q4:neg")
		openT := requirementTask(t, "g:r-cnpj", "opportunity", "o1")
		doneT := requirementTask(t, "g:r-prop", "opportunity", "o2")
		doneTask(t, doneT.ID)

		// o requisito existe: a tarefa dele não se apaga (409), como sempre foi
		if r := call(handleTaskByID, "DELETE", "/api/tasks/"+openT.ID, openT.ID, nil); r.code != 409 {
			t.Errorf("apagar tarefa de requisito vigente: %d", r.code)
		}
		// remover os requisitos leva a tarefa ABERTA; a concluída vira tarefa comum (histórico) e pode ser apagada
		p := getPipeline(t, "g")
		p.Requirements = []PRequirement{{ID: "g:r-livre", StageID: "g:neg", Label: "Anotar reunião", Kind: "ACTION", Gate: "NONE"}}
		if r := putPipeline("g", p); r.code != 200 {
			t.Fatalf("remover requisitos: %d %s", r.code, r.body)
		}
		if _, ok := taskByID(t, openT.ID); ok {
			t.Error("a tarefa aberta do requisito removido deveria ter ido embora")
		}
		kept, ok := taskByID(t, doneT.ID)
		if !ok || !kept.Done || kept.RequirementID != nil || kept.Source != "manual" {
			t.Fatalf("a tarefa concluída deveria ficar como histórico comum: %+v ok=%v", kept, ok)
		}
		if r := call(handleTaskByID, "DELETE", "/api/tasks/"+doneT.ID, doneT.ID, nil); r.code != 200 {
			t.Errorf("apagar o histórico: %d %s", r.code, r.body)
		}
		// órfã antiga (de antes desta regra): requirementId que não existe mais → apaga (não é mais 409 eterno)
		db.Exec(`INSERT INTO Task (id, title, tag, source, entityKind, entityId, entityName, requirementId, done, createdAt) VALUES ('orf1', 'Órfã', '', 'requisito', 'opportunity', 'o1', '', 'g:r-sumiu', 0, ?)`, time.Now())
		if r := call(handleTaskByID, "DELETE", "/api/tasks/orf1", "orf1", nil); r.code != 200 {
			t.Errorf("apagar órfã antiga: %d %s", r.code, r.body)
		}
		if r := call(handleTaskByID, "DELETE", "/api/tasks/nao-existe", "nao-existe", nil); r.code != 404 {
			t.Errorf("apagar tarefa inexistente: %d", r.code)
		}

		// limpar prazo e responsável com null explícito; ausente mantém (B-07)
		due := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
		r := call(handleTasks, "POST", "/api/tasks", "", map[string]any{"title": "Ligar", "tag": "Comercial", "entity": "opportunity", "entityId": "o1", "assignee": "Ana", "dueAt": due})
		var tk TaskDTO
		r.into(t, &tk)
		if r.code != 201 {
			t.Fatalf("criar tarefa: %d %s", r.code, r.body)
		}
		put := func(body string) TaskDTO {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest("PUT", "/api/tasks/"+tk.ID, strings.NewReader(body))
			req.SetPathValue("id", tk.ID)
			handleTaskByID(rec, req)
			if rec.Code != 200 {
				t.Fatalf("PUT %s: %d %s", body, rec.Code, rec.Body)
			}
			cur, _ := taskByID(t, tk.ID)
			return cur
		}
		if cur := put(`{"title":"Ligar de novo"}`); cur.DueAt == nil || cur.Assignee == nil || *cur.Assignee != "Ana" || cur.Tag != "Comercial" {
			t.Errorf("campo ausente deve manter: %+v", cur)
		}
		if cur := put(`{"dueAt":null}`); cur.DueAt != nil || cur.Assignee == nil {
			t.Errorf("dueAt:null limpa só o prazo: %+v", cur)
		}
		if cur := put(`{"assignee":null,"tag":null}`); cur.Assignee != nil || cur.Tag != "" {
			t.Errorf("assignee:null e tag:null limpam: %+v", cur)
		}
		if r := call(handleTaskByID, "PUT", "/api/tasks/"+tk.ID, tk.ID, map[string]any{"dueAt": "ontem"}); r.code != 400 {
			t.Errorf("dueAt inválido: %d", r.code)
		}

		// entidade inexistente (B-03/§6.3): 422 em todos os tipos que o servidor sabe conferir
		for _, e := range []struct{ kind, id string }{{"opportunity", "nao-existe"}, {"lead", "nao-existe"}, {"person", "nao-existe"}, {"company", "nao-existe"}, {"pipeline", "nao-existe"}} {
			if r := call(handleTasks, "POST", "/api/tasks", "", map[string]any{"title": "X", "entity": e.kind, "entityId": e.id}); r.code != 422 {
				t.Errorf("tarefa em %s inexistente: %d, esperava 422 (%s)", e.kind, r.code, r.body)
			}
		}
		if r := call(handleTasks, "POST", "/api/tasks", "", map[string]any{"title": "X", "entity": "pipeline", "entityId": "g"}); r.code != 201 {
			t.Errorf("tarefa em funil que existe: %d %s", r.code, r.body)
		}
	})
}

// Item 4: B-03e. A tarefa de requisito FIELD só conclui com o campo preenchido; ACTION e campo desconhecido são livres.
func TestIntegrationTarefaDeCampo(t *testing.T) {
	bothDSN(t, func(t *testing.T) {
		addOppColumns(t)
		db.Exec(`INSERT INTO Company (id, name) VALUES ('cx', 'Acme X')`)
		insertOpp(t, "o1", "g:neg", "g")
		db.Exec(`UPDATE Opportunity SET companyId = 'cx' WHERE id = 'o1'`)
		insertOpp(t, "o-sem", "g:neg", "g") // sem empresa
		moveOpp("o1", "g:ass")
		moveOpp("o-sem", "g:ass")
		withCo, noCo := requirementTask(t, "g:r-cnpj", "opportunity", "o1"), requirementTask(t, "g:r-cnpj", "opportunity", "o-sem")

		finish := func(id string) reply {
			return call(handleTaskByID, "PUT", "/api/tasks/"+id, id, map[string]any{"done": true})
		}
		if r := finish(noCo.ID); r.code != 422 || !strings.Contains(string(r.body), "empresa") {
			t.Errorf("sem empresa vinculada: %d %s", r.code, r.body)
		}
		if r := finish(withCo.ID); r.code != 422 || !strings.Contains(string(r.body), "CNPJ") {
			t.Errorf("empresa sem CNPJ: %d %s", r.code, r.body)
		}
		if cur, _ := taskByID(t, withCo.ID); cur.Done {
			t.Error("a tarefa não podia ter sido concluída")
		}
		if r := moveOpp("o1", "g:ass"); r.code != 409 {
			t.Errorf("sem concluir a tarefa o gate segue travado: %d", r.code)
		}
		db.Exec(`UPDATE Company SET document = '12345678000190' WHERE id = 'cx'`)
		if r := finish(withCo.ID); r.code != 200 {
			t.Errorf("com o CNPJ preenchido: %d %s", r.code, r.body)
		}
		if r := moveOpp("o1", "g:ass"); r.code != 200 {
			t.Errorf("com a tarefa concluída o gate libera: %d %s", r.code, r.body)
		}
		// reabrir nunca é barrado; ACTION (g:r-prop) conclui livre
		if r := call(handleTaskByID, "PUT", "/api/tasks/"+withCo.ID, withCo.ID, map[string]any{"done": false}); r.code != 200 {
			t.Errorf("reabrir: %d", r.code)
		}
		insertOpp(t, "o2", "g:prop", "g")
		moveOpp("o2", "q4:neg")
		if r := finish(requirementTask(t, "g:r-prop", "opportunity", "o2").ID); r.code != 200 {
			t.Errorf("ACTION é livre: %d %s", r.code, r.body)
		}
		// FIELD cujo campo o servidor não reconhece pelo título continua livre (⚠️ documentado)
		p := getPipeline(t, "g")
		p.Requirements = append(p.Requirements, PRequirement{ID: "g:r-orc", StageID: "g:neg", Label: "Informar o orçamento", Kind: "FIELD", Gate: "NONE"})
		if r := putPipeline("g", p); r.code != 200 {
			t.Fatalf("novo requisito: %d %s", r.code, r.body)
		}
		r := call(handleTasks, "POST", "/api/tasks", "", map[string]any{"title": "Informar o orçamento", "entity": "opportunity", "entityId": "o1", "source": "requisito", "requirementId": "g:r-orc"})
		var orc TaskDTO
		r.into(t, &orc)
		if r.code != 201 || finish(orc.ID).code != 200 {
			t.Errorf("FIELD desconhecido deveria concluir livre: criar=%d", r.code)
		}
		// lead: o CNPJ vem da empresa do lead; e-mail vem do próprio lead
		lead := LeadDTO{ID: "L1", Name: "Renata", PipelineID: "g", StageID: "g:novos", Origin: "INBOUND", SourceName: "Site", Phone: "11999990000", CompanyID: "cx"}
		if r := call(handleCRMLeads, "POST", "/api/crm/leads", "", lead); r.code != 201 {
			t.Fatalf("lead: %d %s", r.code, r.body)
		}
		lead.StageID = "g:ass"
		putLead("L1", lead) // 409: cria a tarefa do lead
		if r := finish(requirementTask(t, "g:r-cnpj", "lead", "L1").ID); r.code != 200 {
			t.Errorf("lead com empresa que tem CNPJ: %d %s", r.code, r.body)
		}
	})
}

// ---- item 5: tarefas por dono ----

type authedEnv struct {
	h               http.Handler
	adm, ven, ven2, ger Member
	t               *testing.T
}

func (e authedEnv) do(m Member, method, path, body string) *httptest.ResponseRecorder {
	e.t.Helper()
	rec := httptest.NewRecorder()
	if err := startSession(rec, httptest.NewRequest("GET", "/", nil), m.ID); err != nil {
		e.t.Fatal(err)
	}
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.AddCookie(rec.Result().Cookies()[0])
	r.Header.Set("Origin", testAdminOrigin)
	out := httptest.NewRecorder()
	e.h.ServeHTTP(out, r)
	return out
}

func newAuthedEnv(t *testing.T, parse bool) authedEnv {
	t.Helper()
	adm := oppEnv(t) // crmDB + login + equipe; o1 é uma oportunidade sem dono
	if parse {
		reopenWithParseTime(t)
	}
	seedGatedPipeline(t)
	db.Exec(`DELETE FROM Opportunity`)
	e := authedEnv{t: t, adm: adm}
	var err error
	if e.ven, err = authDB.AddMember(Member{Email: "ven@kalidash.test", Name: "Vera", Role: roleSeller}, adm.ID); err != nil {
		t.Fatal(err)
	}
	e.ven2, _ = authDB.AddMember(Member{Email: "ven2@kalidash.test", Name: "Vitor", Role: roleSeller}, adm.ID)
	e.ger, _ = authDB.AddMember(Member{Email: "ger@kalidash.test", Name: "Gil", Role: roleManager}, adm.ID)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/leads", enableCORS(handleOpportunities))
	mux.HandleFunc("/api/leads/move", enableCORS(handleMoveOpportunity))
	registerWorkflowRoutes(mux)
	registerCRMRoutes(mux)
	e.h = withAuth(mux)
	return e
}

func authedBoth(t *testing.T, f func(t *testing.T, e authedEnv)) {
	t.Helper()
	for _, parse := range []bool{false, true} {
		name := "sem_parseTime"
		if parse {
			name = "parseTime"
		}
		t.Run(name, func(t *testing.T) { f(t, newAuthedEnv(t, parse)) })
	}
}

func taskIDs(rec *httptest.ResponseRecorder) string {
	var list []TaskDTO
	json.Unmarshal(rec.Body.Bytes(), &list)
	var ids []string
	for _, x := range list {
		ids = append(ids, x.ID)
	}
	return strings.Join(sorted(ids), ",")
}

func sorted(s []string) []string {
	for i := range s {
		for j := i + 1; j < len(s); j++ {
			if s[j] < s[i] {
				s[i], s[j] = s[j], s[i]
			}
		}
	}
	return s
}

func TestIntegrationTarefasPorDono(t *testing.T) {
	authedBoth(t, func(t *testing.T, e authedEnv) {
		insertOpp(t, "o1", "g:neg", "g")
		insertOpp(t, "o2", "g:neg", "g")
		insertOpp(t, "o3", "g:neg", "g")
		db.Exec(`UPDATE Opportunity SET ownerMemberId = ? WHERE id = 'o1'`, e.ven.ID)
		db.Exec(`UPDATE Opportunity SET ownerMemberId = ? WHERE id = 'o2'`, e.ven2.ID)
		for _, l := range [][2]string{{"L1", e.ven.ID}, {"L2", e.ven2.ID}} {
			if _, err := db.Exec(`INSERT INTO `+leadTbl+` (id, name, email, pipelineId, stageId, origin, sourceName, status, createdAt, updatedAt, ownerMemberId) VALUES (?, ?, 'a@x.com', 'g', 'g:novos', 'INBOUND', 'Site', 'ACTIVE', NOW(), NOW(), ?)`, l[0], "Lead "+l[0], l[1]); err != nil {
				t.Fatal(err)
			}
		}
		db.Exec(`INSERT INTO Contact (id, name) VALUES ('p1', 'Pessoa')`)
		now := time.Now()
		for _, tk := range []struct{ id, kind, ent string; member any }{
			{"t-o1", "opportunity", "o1", nil}, {"t-o2", "opportunity", "o2", nil}, {"t-o3", "opportunity", "o3", nil},
			{"t-l1", "lead", "L1", nil}, {"t-l2", "lead", "L2", nil},
			{"t-p-vera", "person", "p1", e.ven.ID}, {"t-p-livre", "person", "p1", nil},
		} {
			if _, err := db.Exec(`INSERT INTO Task (id, title, tag, source, entityKind, entityId, entityName, done, createdAt, assigneeMemberId) VALUES (?, ?, '', 'manual', ?, ?, '', 0, ?, ?)`, tk.id, tk.id, tk.kind, tk.ent, now, tk.member); err != nil {
				t.Fatal(err)
			}
		}

		// o Vendedor vê só a atribuída a ele e as dos registros dele; Gerente e Admin veem tudo
		if got := taskIDs(e.do(e.ven, "GET", "/api/tasks", "")); got != "t-l1,t-o1,t-p-vera" {
			t.Errorf("Vendedor vê: %q", got)
		}
		if got := taskIDs(e.do(e.ven2, "GET", "/api/tasks", "")); got != "t-l2,t-o2" {
			t.Errorf("outro Vendedor vê: %q", got)
		}
		for _, m := range []Member{e.ger, e.adm} {
			if got := taskIDs(e.do(m, "GET", "/api/tasks", "")); len(strings.Split(got, ",")) != 7 {
				t.Errorf("%s vê tudo: %q", m.Role, got)
			}
		}
		// filtros combinam com a restrição
		if got := taskIDs(e.do(e.ven, "GET", "/api/tasks?entity=opportunity", "")); got != "t-o1" {
			t.Errorf("filtro por tipo: %q", got)
		}
		// as dos outros são 404 (editar, apagar); as dele passam
		for _, id := range []string{"t-o2", "t-l2", "t-o3", "t-p-livre"} {
			if rec := e.do(e.ven, "PUT", "/api/tasks/"+id, `{"done":true}`); rec.Code != 404 {
				t.Errorf("Vendedor editar %s: %d", id, rec.Code)
			}
			if rec := e.do(e.ven, "DELETE", "/api/tasks/"+id, ``); rec.Code != 404 {
				t.Errorf("Vendedor apagar %s: %d", id, rec.Code)
			}
		}
		for _, id := range []string{"t-o1", "t-l1", "t-p-vera"} {
			if rec := e.do(e.ven, "PUT", "/api/tasks/"+id, `{"done":true}`); rec.Code != 200 {
				t.Errorf("Vendedor editar %s: %d %s", id, rec.Code, rec.Body)
			}
		}
		if rec := e.do(e.ger, "PUT", "/api/tasks/t-o2", `{"done":true}`); rec.Code != 200 {
			t.Errorf("Gerente edita a tarefa de qualquer um: %d", rec.Code)
		}
		// criar: no registro dele passa; no do outro é 404; consultar o gate do registro alheio também
		if rec := e.do(e.ven, "POST", "/api/tasks", `{"title":"Ligar","entity":"opportunity","entityId":"o1"}`); rec.Code != 201 {
			t.Errorf("criar no registro dele: %d %s", rec.Code, rec.Body)
		}
		if rec := e.do(e.ven, "POST", "/api/tasks", `{"title":"Ligar","entity":"opportunity","entityId":"o2"}`); rec.Code != 404 {
			t.Errorf("criar no registro do outro: %d", rec.Code)
		}
		gate := `{"entity":"opportunity","entityId":"%s","fromStageId":"g:neg","toStageId":"g:ass"}`
		if rec := e.do(e.ven, "POST", "/api/gate/check", strings.Replace(gate, "%s", "o2", 1)); rec.Code != 404 {
			t.Errorf("gate/check do registro alheio: %d", rec.Code)
		}
		if rec := e.do(e.ven, "POST", "/api/gate/check", strings.Replace(gate, "%s", "o1", 1)); rec.Code != 200 {
			t.Errorf("gate/check do próprio: %d %s", rec.Code, rec.Body)
		}

		// assigneeMemberId: o servidor resolve o nome; o texto continua valendo; id inválido ou inativo é 422
		rec := e.do(e.ger, "POST", "/api/tasks", `{"title":"Reunião","entity":"opportunity","entityId":"o3","assigneeMemberId":"`+e.ven2.ID+`"}`)
		var tk TaskDTO
		json.Unmarshal(rec.Body.Bytes(), &tk)
		if rec.Code != 201 || tk.AssigneeMemberID == nil || *tk.AssigneeMemberID != e.ven2.ID || tk.Assignee == nil || *tk.Assignee != "Vitor" {
			t.Fatalf("atribuir por membro: %d %s", rec.Code, rec.Body)
		}
		if got := taskIDs(e.do(e.ven2, "GET", "/api/tasks", "")); !strings.Contains(got, tk.ID) {
			t.Errorf("a atribuída ao Vitor aparece para ele mesmo em registro sem dono: %q", got)
		}
		if rec := e.do(e.ger, "POST", "/api/tasks", `{"title":"X","entity":"opportunity","entityId":"o3","assigneeMemberId":"tm-inventado"}`); rec.Code != 422 {
			t.Errorf("membro inexistente: %d", rec.Code)
		}
		rec = e.do(e.ger, "POST", "/api/tasks", `{"title":"Texto","entity":"opportunity","entityId":"o3","assignee":"Carol (texto livre)"}`)
		var legacy TaskDTO
		json.Unmarshal(rec.Body.Bytes(), &legacy)
		if rec.Code != 201 || legacy.Assignee == nil || *legacy.Assignee != "Carol (texto livre)" || legacy.AssigneeMemberID != nil {
			t.Errorf("o texto continua valendo sem o id: %d %s", rec.Code, rec.Body)
		}
		// trocar e limpar o responsável
		if rec := e.do(e.ger, "PUT", "/api/tasks/"+legacy.ID, `{"assigneeMemberId":"`+e.ven.ID+`"}`); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"assignee":"Vera"`) {
			t.Errorf("atribuir depois: %d %s", rec.Code, rec.Body)
		}
		if rec := e.do(e.ger, "PUT", "/api/tasks/"+legacy.ID, `{"assigneeMemberId":null}`); rec.Code != 200 || strings.Contains(rec.Body.String(), "assignee") {
			t.Errorf("limpar o membro limpa o responsável: %d %s", rec.Code, rec.Body)
		}
		off := false
		authDB.UpdateMember(e.ven2.ID, nil, nil, &off)
		if rec := e.do(e.ger, "POST", "/api/tasks", `{"title":"X","entity":"opportunity","entityId":"o3","assigneeMemberId":"`+e.ven2.ID+`"}`); rec.Code != 422 {
			t.Errorf("membro desativado: %d", rec.Code)
		}
	})
}
