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

	_ "github.com/go-sql-driver/mysql"
)

// Teste de integração contra um MySQL de verdade. Só roda com TEST_DSN, e só em localhost:
// nunca usa o DSN do .env (que aponta para o banco real). Exemplo:
//   TEST_DSN='root:@tcp(127.0.0.1:3307)/kalidash_test' go test -run Integration -v .
// Servidor descartável: qualquer MySQL/MariaDB local vazio serve.

func integrationDB(t *testing.T) {
	t.Helper()
	dsn := os.Getenv("TEST_DSN")
	if dsn == "" {
		t.Skip("TEST_DSN não definido: teste de integração ignorado")
	}
	if !strings.Contains(dsn, "@tcp(127.0.0.1:") && !strings.Contains(dsn, "@tcp(localhost:") {
		t.Fatal("TEST_DSN precisa apontar para localhost (proteção contra rodar no banco real)")
	}
	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ping(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	for _, tbl := range []string{"Task", "StageRequirement", "PipelineStage", "Pipeline", "Opportunity"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	// Opportunity existe no banco real (Prisma); aqui só as colunas que a API usa nestes fluxos.
	if _, err := db.Exec(`CREATE TABLE Opportunity (
		id VARCHAR(64) PRIMARY KEY, title VARCHAR(255) NOT NULL, value DECIMAL(14,2) NULL,
		stage VARCHAR(128) NOT NULL, priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', tags JSON NULL,
		createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, wonAt DATETIME NULL)`); err != nil {
		t.Fatal(err)
	}
	ensureWorkflowSchema()
	t.Setenv("WORKFLOW_API", "1")
}

type reply struct {
	code int
	body []byte
}

func call(h http.HandlerFunc, method, path, id string, body any) reply {
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
	return reply{rec.Code, rec.Body.Bytes()}
}

func (r reply) into(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.body, v); err != nil {
		t.Fatalf("JSON inválido (%d): %s", r.code, r.body)
	}
}

func TestIntegrationPipelineTaskGate(t *testing.T) {
	integrationDB(t)

	// 1. cria o funil
	p := map[string]any{
		"id": "q4", "name": "Q4 Sales", "offer": "Consultoria",
		"stages": []map[string]any{
			{"id": "q4:novos", "name": "Novos", "kind": "LEAD", "color": "#94a3b8"},
			{"id": "q4:neg", "name": "Negociação", "kind": "OPEN", "color": "#3b82f6", "probability": 60, "alertDays": 10},
			{"id": "q4:ass", "name": "Assinatura", "kind": "OPEN", "color": "#0ea5e9", "probability": 90},
			{"id": "q4:ganho", "name": "Ganho", "kind": "WON", "color": "#10b981"},
		},
		"requirements": []map[string]any{
			{"id": "q4:r-cnpj", "stageId": "q4:ass", "label": "Informar CNPJ", "tag": "Dados", "kind": "FIELD", "gate": "ENTER", "assignee": "Carol", "dueDays": 2},
			{"id": "q4:r-contrato", "stageId": "q4:ass", "label": "Enviar contrato", "tag": "Comercial", "kind": "ACTION", "gate": "ENTER"},
			{"id": "q4:r-livre", "stageId": "q4:neg", "label": "Anotar reunião", "tag": "Comercial", "kind": "ACTION"},
		},
		"taskTags": []string{"Dados", "Comercial"},
		"steps":    []map[string]any{{"id": "s1", "name": "Passo"}},
	}
	r := call(handlePipelines, "POST", "/api/pipelines", "", p)
	if r.code != 201 {
		t.Fatalf("criar funil: %d %s", r.code, r.body)
	}
	var got PipelineDTO
	r.into(t, &got)
	if len(got.Stages) != 4 || got.Stages[1].Probability == nil || *got.Stages[1].Probability != 60 || len(got.Requirements) != 3 {
		t.Fatalf("funil devolvido errado: %+v", got)
	}
	if string(got.TaskTags) != `["Dados","Comercial"]` {
		t.Errorf("config não voltou: %s", got.TaskTags)
	}
	if r := call(handlePipelines, "POST", "/api/pipelines", "", p); r.code != 409 {
		t.Errorf("id repetido deveria dar 409, deu %d", r.code)
	}

	// 2. oportunidade na etapa Negociação: contagem e valor por etapa
	now := time.Now()
	if _, err := db.Exec(`INSERT INTO Opportunity (id, title, value, stage, createdAt, updatedAt) VALUES ('opp1', 'Acme', 1500.50, 'q4:neg', ?, ?)`, now, now); err != nil {
		t.Fatal(err)
	}
	var list []PipelineDTO
	call(handlePipelines, "GET", "/api/pipelines", "", nil).into(t, &list)
	if len(list) != 1 || list[0].Counts["q4:neg"] != 1 || list[0].Values["q4:neg"] != 1500.50 {
		t.Fatalf("contagem/valor: %+v %+v", list[0].Counts, list[0].Values)
	}

	// 3. gate no servidor: mover para Assinatura trava por 2 requisitos
	gate := func(from, to string) (blocked bool, blockers []Blocker) {
		var out struct {
			Blocked  bool      `json:"blocked"`
			Blockers []Blocker `json:"blockers"`
		}
		r := call(handleGateCheck, "POST", "/api/gate/check", "", map[string]any{"entity": "opportunity", "entityId": "opp1", "entityName": "Acme", "fromStageId": from, "toStageId": to})
		if r.code != 200 {
			t.Fatalf("gate/check: %d %s", r.code, r.body)
		}
		r.into(t, &out)
		return out.Blocked, out.Blockers
	}
	blocked, bl := gate("q4:neg", "q4:ass")
	if !blocked || len(bl) != 2 {
		t.Fatalf("esperava 2 travas, veio %v %+v", blocked, bl)
	}
	gate("q4:neg", "q4:ass") // idempotente: não duplica tarefa
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM Task WHERE entityId = 'opp1'`).Scan(&n)
	if n != 2 {
		t.Errorf("tarefas duplicadas: %d", n)
	}
	if b, _ := gate("q4:neg", "q4:ganho"); b {
		t.Error("neg→ganho não tem trava")
	}

	mv := func(stage string, won bool) reply {
		return call(handleMoveOpportunity, "POST", "/api/leads/move", "", map[string]any{"lead_id": "opp1", "column_id": stage, "won": won})
	}
	if r := mv("q4:ass", false); r.code != 409 || !strings.Contains(string(r.body), `"gate"`) {
		t.Fatalf("move deveria dar 409 de gate: %d %s", r.code, r.body)
	}
	var stage string
	db.QueryRow(`SELECT stage FROM Opportunity WHERE id = 'opp1'`).Scan(&stage)
	if stage != "q4:neg" {
		t.Errorf("a oportunidade não podia ter saído: %s", stage)
	}

	// blocked/overdue aparecem no funil
	call(handlePipelines, "GET", "/api/pipelines", "", nil).into(t, &list)
	for _, rq := range list[0].Requirements {
		if rq.ID == "q4:r-cnpj" && rq.Blocked != 1 {
			t.Errorf("blocked do CNPJ: %d", rq.Blocked)
		}
	}

	// 4. concluir as duas tarefas libera o movimento
	var tasks []TaskDTO
	call(handleTasks, "GET", "/api/tasks?entity=opportunity&entityId=opp1&done=0", "", nil).into(t, &tasks)
	if len(tasks) != 2 || tasks[0].Source != "requisito" || tasks[0].RequirementID == nil {
		t.Fatalf("tarefas do gate: %+v", tasks)
	}
	if r := mv("q4:ass", false); r.code != 409 {
		t.Fatalf("ainda deveria travar: %d", r.code)
	}
	for i, tk := range tasks {
		r := call(handleTaskByID, "PUT", "/api/tasks/"+tk.ID, tk.ID, map[string]any{"done": true})
		if r.code != 200 {
			t.Fatalf("concluir tarefa: %d %s", r.code, r.body)
		}
		if i == 0 { // com só uma concluída ainda trava (todas precisam fechar)
			if r := mv("q4:ass", false); r.code != 409 {
				t.Fatalf("uma tarefa concluída não basta: %d", r.code)
			}
		}
	}
	if r := mv("q4:ass", false); r.code != 200 {
		t.Fatalf("com tudo concluído deveria mover: %d %s", r.code, r.body)
	}
	// ir para Ganho grava wonAt; voltar limpa
	if r := mv("q4:ganho", true); r.code != 200 {
		t.Fatalf("mover para ganho: %d %s", r.code, r.body)
	}
	var wonAt sql.NullString
	db.QueryRow(`SELECT wonAt FROM Opportunity WHERE id = 'opp1'`).Scan(&wonAt)
	if !wonAt.Valid {
		t.Error("wonAt deveria estar preenchido")
	}
	mv("q4:neg", false)
	db.QueryRow(`SELECT wonAt FROM Opportunity WHERE id = 'opp1'`).Scan(&wonAt)
	if wonAt.Valid {
		t.Error("wonAt deveria ter sido limpo ao sair de Ganho")
	}

	// 5. tarefas manuais
	r = call(handleTasks, "POST", "/api/tasks", "", map[string]any{"title": "Ligar", "tag": "Comercial", "entity": "opportunity", "entityId": "opp1", "entityName": "Acme", "dueAt": time.Now().Add(48 * time.Hour).Format(time.RFC3339)})
	if r.code != 201 {
		t.Fatalf("tarefa manual: %d %s", r.code, r.body)
	}
	var manual TaskDTO
	r.into(t, &manual)
	if r := call(handleTaskByID, "DELETE", "/api/tasks/"+manual.ID, manual.ID, nil); r.code != 200 {
		t.Errorf("apagar tarefa manual: %d", r.code)
	}
	if r := call(handleTaskByID, "DELETE", "/api/tasks/"+tasks[0].ID, tasks[0].ID, nil); r.code != 409 {
		t.Errorf("tarefa de requisito não pode ser apagada: %d", r.code)
	}

	// 6. editar o funil: etapa com oportunidade não sai; vazia sai
	p["stages"] = []map[string]any{
		{"id": "q4:novos", "name": "Novos", "kind": "LEAD"},
		{"id": "q4:ass", "name": "Assinatura", "kind": "OPEN"},
		{"id": "q4:ganho", "name": "Ganho", "kind": "WON"},
	}
	p["requirements"] = []map[string]any{}
	if r := call(handlePipelineByID, "PUT", "/api/pipelines/q4", "q4", p); r.code != 409 {
		t.Fatalf("remover etapa com oportunidade deveria dar 409: %d %s", r.code, r.body)
	}
	db.Exec(`UPDATE Opportunity SET stage = 'q4:ass' WHERE id = 'opp1'`)
	if r := call(handlePipelineByID, "PUT", "/api/pipelines/q4", "q4", p); r.code != 200 {
		t.Fatalf("PUT depois de mover: %d %s", r.code, r.body)
	}
	var after PipelineDTO
	call(handlePipelineByID, "GET", "/api/pipelines/q4", "q4", nil).into(t, &after)
	if len(after.Stages) != 3 || len(after.Requirements) != 0 {
		t.Errorf("funil depois do PUT: %d etapas, %d requisitos", len(after.Stages), len(after.Requirements))
	}

	// 7. arquivar tira da lista (e PUT com archivedAt nulo desarquiva)
	if r := call(handlePipelineByID, "DELETE", "/api/pipelines/q4", "q4", nil); r.code != 200 {
		t.Fatalf("arquivar: %d", r.code)
	}
	call(handlePipelines, "GET", "/api/pipelines", "", nil).into(t, &list)
	if len(list) != 0 {
		t.Errorf("arquivado ainda aparece: %d", len(list))
	}
	call(handlePipelines, "GET", "/api/pipelines?archived=1", "", nil).into(t, &list)
	if len(list) != 1 || list[0].ArchivedAt == nil {
		t.Errorf("com archived=1 deveria vir 1 arquivado: %+v", list)
	}

	var arch PipelineDTO
	call(handlePipelineByID, "GET", "/api/pipelines/q4", "q4", nil).into(t, &arch)
	arch.ArchivedAt = nil
	if r := call(handlePipelineByID, "PUT", "/api/pipelines/q4", "q4", arch); r.code != 200 {
		t.Fatalf("desarquivar via PUT: %d %s", r.code, r.body)
	}
	call(handlePipelines, "GET", "/api/pipelines", "", nil).into(t, &list)
	if len(list) != 1 || list[0].ArchivedAt != nil {
		t.Errorf("desarquivado deveria voltar à lista: %+v", list)
	}
}
