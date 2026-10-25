package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// WP4-1: cada linha da §6.3 e da §2.2 da auditoria (docs/po/relatorios/audit-pipelines-tarefas-automacoes.md) vira
// um teste com o resultado certo. Rodam com TEST_DSN, nos dois modos de DSN (sem e com parseTime=true):
//   TEST_DSN='root:@tcp(127.0.0.1:3361)/kalidash_test' go test -run IntegrationIntegridade -v .

// bothDSN roda f no DSN como está e com parseTime=true (o modo de produção).
func bothDSN(t *testing.T, f func(t *testing.T)) {
	t.Helper()
	for _, parse := range []bool{false, true} {
		name := "sem_parseTime"
		if parse {
			name = "parseTime"
		}
		t.Run(name, func(t *testing.T) {
			crmDB(t) // abre `db`, funis q4/b2b e as tabelas do CRM
			t.Setenv("CRM_API", "1")
			if parse {
				reopenWithParseTime(t)
			}
			seedGatedPipeline(t)
			f(t)
		})
	}
}

// seedGatedPipeline: o funil "g" com um requisito de cada tipo de trava.
//
//	g:novos (LEAD) · g:neg (OPEN, sem trava) · g:ass (OPEN, ENTER "Informar CNPJ") · g:prop (OPEN, EXIT "Enviar a proposta") · g:ganho · g:perdido
func seedGatedPipeline(t *testing.T) {
	t.Helper()
	p := &PipelineDTO{ID: "g", Name: "Gated", Position: 2, Stages: []PStage{
		{ID: "g:novos", Name: "Novos", Kind: "LEAD"},
		{ID: "g:neg", Name: "Negociação", Kind: "OPEN"},
		{ID: "g:ass", Name: "Assinatura", Kind: "OPEN"},
		{ID: "g:prop", Name: "Proposta", Kind: "OPEN"},
		{ID: "g:ganho", Name: "Ganho", Kind: "WON"},
		{ID: "g:perdido", Name: "Perdido", Kind: "LOST"},
	}, Requirements: []PRequirement{
		{ID: "g:r-cnpj", StageID: "g:ass", Label: "Informar CNPJ", Tag: "Dados", Kind: "FIELD", Gate: "ENTER"},
		{ID: "g:r-prop", StageID: "g:prop", Label: "Enviar a proposta", Tag: "Comercial", Kind: "ACTION", Gate: "EXIT"},
		{ID: "g:r-livre", StageID: "g:neg", Label: "Anotar reunião", Kind: "ACTION", Gate: "NONE"},
	}}
	if err := validatePipeline(p); err != nil {
		t.Fatal(err)
	}
	if err := writePipeline(p, false, nil); err != nil {
		t.Fatal(err)
	}
}

func insertOpp(t *testing.T, id, stage string, pipeline any) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO Opportunity (id, title, value, stage, priority, tags, createdAt, updatedAt, pipelineId) VALUES (?, ?, 100, ?, 'MEDIUM', '[]', ?, ?, ?)`, id, "Opp "+id, stage, time.Now(), time.Now(), pipeline); err != nil {
		t.Fatal(err)
	}
}

func countWhere(t *testing.T, table, where string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE `+where, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func moveOpp(id, stage string) reply {
	return call(handleMoveOpportunity, "POST", "/api/leads/move", "", map[string]any{"lead_id": id, "column_id": stage})
}

func postOpp(stage string) reply {
	return call(handleOpportunities, "POST", "/api/leads", "", map[string]any{"title": "Nova", "value": 10, "stage": stage})
}

func putLead(id string, l LeadDTO) reply {
	return call(handleCRMLeadByID, "PUT", "/api/crm/leads/"+id, id, l)
}

func doneTask(t *testing.T, id string) {
	t.Helper()
	if r := call(handleTaskByID, "PUT", "/api/tasks/"+id, id, map[string]any{"done": true}); r.code != 200 {
		t.Fatalf("concluir %s: %d %s", id, r.code, r.body)
	}
}

func blockerIDs(r reply) string {
	var out struct {
		Error    string    `json:"error"`
		Blockers []Blocker `json:"blockers"`
	}
	json.Unmarshal(r.body, &out)
	var ids []string
	for _, b := range out.Blockers {
		ids = append(ids, b.RequirementID)
	}
	return strings.Join(ids, ",")
}

// Item 1 e as linhas de gate da §6.3: criar direto, EXIT entre funis, Lead, etapa inexistente, gate/check puro.
func TestIntegrationIntegridadeGate(t *testing.T) {
	bothDSN(t, func(t *testing.T) {
		// criar oportunidade direto em etapa travada → 409 com o que falta; nada é gravado (nem tarefa órfã)
		before := countWhere(t, "Opportunity", "1=1")
		r := postOpp("g:ass")
		if r.code != 409 || blockerIDs(r) != "g:r-cnpj" || !strings.Contains(string(r.body), `"gate"`) {
			t.Fatalf("criar em etapa travada: %d %s", r.code, r.body)
		}
		if countWhere(t, "Opportunity", "1=1") != before || countWhere(t, "Task", "1=1") != 0 {
			t.Error("o 409 de criação não pode gravar oportunidade nem tarefa")
		}
		// criar em etapa livre passa e já grava o funil
		r = postOpp("g:neg")
		var created Opportunity
		r.into(t, &created)
		if r.code != 201 || countWhere(t, "Opportunity", "id = ? AND pipelineId = 'g'", created.ID) != 1 {
			t.Fatalf("criar em etapa livre: %d %s", r.code, r.body)
		}
		// etapa inexistente (criar e mover) → 422, e nada muda
		for _, st := range []string{"xyz:nada", ""} {
			if r := postOpp(st); r.code != 422 {
				t.Errorf("criar em %q: %d, esperava 422", st, r.code)
			}
		}
		insertOpp(t, "o1", "g:neg", "g")
		if r := moveOpp("o1", "lixo:zzz"); r.code != 422 {
			t.Errorf("mover para etapa inexistente: %d, esperava 422 (%s)", r.code, r.body)
		}
		if countWhere(t, "Opportunity", "id = 'o1' AND stage = 'g:neg'") != 1 {
			t.Error("o1 não podia ter saído de g:neg")
		}
		// mover para a MESMA etapa → 200 (B-04), repetido também; id que não existe segue 404
		for i := 0; i < 2; i++ {
			if r := moveOpp("o1", "g:neg"); r.code != 200 {
				t.Errorf("mesma etapa (%d): %d %s", i, r.code, r.body)
			}
		}
		if r := moveOpp("nao-existe", "g:neg"); r.code != 404 {
			t.Errorf("oportunidade inexistente: %d", r.code)
		}
		// valor antigo (INBOUND, WON…) continua válido e passa pelo gate na etapa equivalente do funil
		insertOpp(t, "o-leg", "INBOUND", nil)
		if r := moveOpp("o-leg", "g:neg"); r.code != 200 {
			t.Errorf("sair de valor antigo: %d %s", r.code, r.body)
		}

		// gate/check é consulta pura: devolve a trava e não cria tarefa
		r = call(handleGateCheck, "POST", "/api/gate/check", "", map[string]any{"entity": "opportunity", "entityId": "o1", "entityName": "Opp o1", "fromStageId": "g:neg", "toStageId": "g:ass"})
		if r.code != 200 || !strings.Contains(string(r.body), `"blocked":true`) || countWhere(t, "Task", "1=1") != 0 {
			t.Fatalf("gate/check sem efeito colateral: %d %s tarefas=%d", r.code, r.body, countWhere(t, "Task", "1=1"))
		}
		// a tentativa de mover é que cria a tarefa
		if r := moveOpp("o1", "g:ass"); r.code != 409 || countWhere(t, "Task", "requirementId = 'g:r-cnpj' AND entityId = 'o1'") != 1 {
			t.Fatalf("tentativa de mover: %d %s", r.code, r.body)
		}

		// EXIT ao mudar de FUNIL: o1 vai para g:prop (sem trava de entrada) e sai para o funil q4
		insertOpp(t, "o2", "g:prop", "g")
		r = moveOpp("o2", "q4:neg")
		if r.code != 409 || blockerIDs(r) != "g:r-prop" {
			t.Fatalf("EXIT entre funis: %d %s", r.code, r.body)
		}
		var tk TaskDTO
		var tasks []TaskDTO
		call(handleTasks, "GET", "/api/tasks?entity=opportunity&entityId=o2", "", nil).into(t, &tasks)
		if len(tasks) != 1 {
			t.Fatalf("tarefa do EXIT: %+v", tasks)
		}
		tk = tasks[0]
		doneTask(t, tk.ID)
		if r := moveOpp("o2", "q4:neg"); r.code != 200 {
			t.Fatalf("depois de concluir: %d %s", r.code, r.body)
		}
		if countWhere(t, "Opportunity", "id = 'o2' AND pipelineId = 'q4' AND stage = 'q4:neg'") != 1 {
			t.Error("o move deveria trocar também o pipelineId")
		}

		// Lead (PUT /api/crm/leads/{id}): mudar de etapa respeita o gate; etapa inexistente ou de outro funil → 422
		lead := LeadDTO{ID: "L1", Name: "Renata", Email: "r@x.co", PipelineID: "g", StageID: "g:novos", Origin: "INBOUND", SourceName: "Site"}
		if r := call(handleCRMLeads, "POST", "/api/crm/leads", "", lead); r.code != 201 {
			t.Fatalf("criar lead em etapa livre: %d %s", r.code, r.body)
		}
		lead.StageID = "g:ass"
		if r := putLead("L1", lead); r.code != 409 || blockerIDs(r) != "g:r-cnpj" {
			t.Fatalf("lead para etapa travada: %d %s", r.code, r.body)
		}
		if countWhere(t, leadTbl, "id = 'L1' AND stageId = 'g:novos'") != 1 || countWhere(t, "Task", "entityKind = 'lead' AND entityId = 'L1'") != 1 {
			t.Error("o lead não pode ter saído e a tentativa deve ter criado a tarefa")
		}
		for _, st := range []string{"g:inexistente", "q4:neg"} {
			lead.StageID = st
			if r := putLead("L1", lead); r.code != 422 {
				t.Errorf("lead para %q: %d, esperava 422 (%s)", st, r.code, r.body)
			}
		}
		lead.StageID = "g:neg" // só OPEN sem trava: passa
		if r := putLead("L1", lead); r.code != 200 {
			t.Errorf("lead para etapa livre: %d %s", r.code, r.body)
		}
		// criar lead direto em etapa travada → 409 e nada gravado
		direct := LeadDTO{ID: "L2", Name: "Direto", Email: "d@x.co", PipelineID: "g", StageID: "g:ass", Origin: "INBOUND", SourceName: "Site"}
		if r := call(handleCRMLeads, "POST", "/api/crm/leads", "", direct); r.code != 409 || countWhere(t, leadTbl, "id = 'L2'") != 0 {
			t.Errorf("lead direto em etapa travada: %d %s", r.code, r.body)
		}
		direct.StageID = "g:nao"
		if r := call(handleCRMLeads, "POST", "/api/crm/leads", "", direct); r.code != 422 {
			t.Errorf("lead em etapa inexistente: %d", r.code)
		}
	})
}

func getPipeline(t *testing.T, id string) PipelineDTO {
	t.Helper()
	var p PipelineDTO
	r := call(handlePipelineByID, "GET", "/api/pipelines/"+id, id, nil)
	if r.code != 200 {
		t.Fatalf("GET %s: %d %s", id, r.code, r.body)
	}
	r.into(t, &p)
	return p
}

func putPipeline(id string, p PipelineDTO) reply {
	return call(handlePipelineByID, "PUT", "/api/pipelines/"+id, id, p)
}

func withoutStage(p PipelineDTO, stageID string) PipelineDTO {
	var st []PStage
	for _, s := range p.Stages {
		if s.ID != stageID {
			st = append(st, s)
		}
	}
	var rq []PRequirement
	for _, r := range p.Requirements {
		if r.StageID != stageID {
			rq = append(rq, r)
		}
	}
	p.Stages, p.Requirements = st, rq
	return p
}

// Item 2: integridade da estrutura do funil (§2.2).
func TestIntegrationIntegridadeFunil(t *testing.T) {
	bothDSN(t, func(t *testing.T) {
		// etapa com LEAD dentro não sai (409); vazia sai
		lead := LeadDTO{ID: "L1", Name: "Renata", Email: "r@x.co", PipelineID: "g", StageID: "g:novos", Origin: "INBOUND", SourceName: "Site"}
		if r := call(handleCRMLeads, "POST", "/api/crm/leads", "", lead); r.code != 201 {
			t.Fatalf("lead: %d %s", r.code, r.body)
		}
		if r := putPipeline("g", withoutStage(getPipeline(t, "g"), "g:novos")); r.code != 409 || !strings.Contains(string(r.body), "lead") {
			t.Errorf("remover etapa com lead: %d %s", r.code, r.body)
		}
		if countWhere(t, "PipelineStage", "id = 'g:novos'") != 1 {
			t.Error("a etapa não podia ter sido removida")
		}
		// lead arquivado não segura a etapa; oportunidade segura
		db.Exec(`UPDATE `+leadTbl+` SET archivedAt = ? WHERE id = 'L1'`, time.Now())
		insertOpp(t, "o1", "g:prop", "g")
		if r := putPipeline("g", withoutStage(getPipeline(t, "g"), "g:prop")); r.code != 409 || !strings.Contains(string(r.body), "oportunidade") {
			t.Errorf("remover etapa com oportunidade: %d %s", r.code, r.body)
		}
		if r := putPipeline("g", withoutStage(getPipeline(t, "g"), "g:novos")); r.code != 200 {
			t.Errorf("remover etapa só com lead arquivado: %d %s", r.code, r.body)
		}

		// mudar o TIPO de etapa com registro → 409; sem registro passa
		p := getPipeline(t, "g")
		for i := range p.Stages {
			if p.Stages[i].ID == "g:prop" {
				p.Stages[i].Kind = "WON"
			}
		}
		if r := putPipeline("g", p); r.code != 409 || !strings.Contains(string(r.body), "tipo") {
			t.Errorf("mudar o tipo com registros: %d %s", r.code, r.body)
		}
		db.Exec(`UPDATE Opportunity SET stage = 'g:neg' WHERE id = 'o1'`)
		if r := putPipeline("g", p); r.code != 200 {
			t.Errorf("mudar o tipo sem registros: %d %s", r.code, r.body)
		}

		// ao menos uma Ganha e uma Perdida; ao menos uma etapa
		p = getPipeline(t, "g")
		var noLost, noWon PipelineDTO
		noLost, noWon = withoutStage(p, "g:perdido"), withoutStage(p, "g:ganho")
		noWon.Stages = append([]PStage{}, noWon.Stages...)
		for i := range noWon.Stages {
			if noWon.Stages[i].Kind == "WON" { // g:prop virou WON acima: tira o tipo Ganho de todas
				noWon.Stages[i].Kind = "OPEN"
			}
		}
		for name, bad := range map[string]PipelineDTO{"sem Perdida": noLost, "sem Ganha": noWon} {
			if r := putPipeline("g", bad); r.code != 422 {
				t.Errorf("PUT %s: %d, esperava 422 (%s)", name, r.code, r.body)
			}
		}
		for name, body := range map[string]map[string]any{
			"POST só com etapa aberta": {"name": "X", "stages": []map[string]any{{"name": "A", "kind": "OPEN"}}},
			"POST sem etapas":          {"name": "X", "stages": []map[string]any{}},
		} {
			if r := call(handlePipelines, "POST", "/api/pipelines", "", body); r.code != 422 {
				t.Errorf("%s: %d, esperava 422 (%s)", name, r.code, r.body)
			}
		}
		if countWhere(t, "Pipeline", "1=1") != 3 {
			t.Error("nenhum funil inválido podia ter sido criado")
		}
	})
}

var _ = httptest.NewRecorder
var _ = http.StatusOK
