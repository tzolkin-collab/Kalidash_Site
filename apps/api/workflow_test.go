package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func intp(v int) *int { return &v }

func goodPipeline() *PipelineDTO {
	return &PipelineDTO{
		Name: "  Q4 Sales  ", Offer: "Consultoria",
		Stages: []PStage{
			{ID: "p:novos", Name: "Novos", Kind: "LEAD"},
			{ID: "p:assinatura", Name: "Assinatura", Kind: "OPEN", Probability: intp(90)},
			{ID: "p:ganho", Name: "Ganho", Kind: "WON"},
		{ID: "p:perdido", Name: "Perdido", Kind: "LOST"},
		},
		Requirements: []PRequirement{{ID: "p:r-cnpj", StageID: "p:assinatura", Label: "Informar CNPJ", Kind: "FIELD", Gate: "ENTER"}},
	}
}

func TestValidatePipelineOK(t *testing.T) {
	p := goodPipeline()
	if err := validatePipeline(p); err != nil {
		t.Fatal(err)
	}
	if p.Name != "Q4 Sales" {
		t.Errorf("nome não foi aparado: %q", p.Name)
	}
	p.Requirements[0].Gate = ""
	if err := validatePipeline(p); err != nil || p.Requirements[0].Gate != "NONE" {
		t.Errorf("gate vazio deveria virar NONE: %v %q", err, p.Requirements[0].Gate)
	}
}

func TestValidatePipelineRejects(t *testing.T) {
	cases := map[string]func(p *PipelineDTO){
		"sem nome":             func(p *PipelineDTO) { p.Name = "  " },
		"sem etapas":           func(p *PipelineDTO) { p.Stages = nil },
		"etapa repetida":       func(p *PipelineDTO) { p.Stages[1].ID = "p:novos" },
		"id com espaço":        func(p *PipelineDTO) { p.Stages[0].ID = "p novos" },
		"tipo de etapa":        func(p *PipelineDTO) { p.Stages[0].Kind = "XX" },
		"probabilidade 101":    func(p *PipelineDTO) { p.Stages[1].Probability = intp(101) },
		"gate inválido":        func(p *PipelineDTO) { p.Requirements[0].Gate = "ALWAYS" },
		"tipo de requisito":    func(p *PipelineDTO) { p.Requirements[0].Kind = "X" },
		"requisito sem etapa":  func(p *PipelineDTO) { p.Requirements[0].StageID = "p:inexistente" },
		"requisito sem título": func(p *PipelineDTO) { p.Requirements[0].Label = "" },
		"prazo negativo":       func(p *PipelineDTO) { p.Requirements[0].DueDays = intp(-1) },
		"config enorme": func(p *PipelineDTO) {
			p.Steps = json.RawMessage(`"` + strings.Repeat("x", (maxConfigKB+1)<<10) + `"`)
		},
	}
	for name, mutate := range cases {
		p := goodPipeline()
		mutate(p)
		if err := validatePipeline(p); err == nil {
			t.Errorf("%s: deveria ser recusado", name)
		}
	}
}

func TestFillIDs(t *testing.T) {
	p := &PipelineDTO{Stages: []PStage{{Name: "A", Kind: "OPEN"}, {Name: "B", Kind: "WON"}}, Requirements: []PRequirement{{}}}
	fillIDs(p)
	if p.ID == "" || p.Stages[0].ID == p.Stages[1].ID || !strings.HasPrefix(p.Stages[0].ID, p.ID+":") || p.Requirements[0].ID == "" {
		t.Errorf("ids mal gerados: %+v", p)
	}
	for _, id := range []string{p.ID, p.Stages[0].ID, p.Requirements[0].ID} {
		if !idRe.MatchString(id) {
			t.Errorf("id gerado não passa na validação: %q", id)
		}
	}
}

// O JSON da API precisa ter a mesma forma do tipo Pipeline do admin (campos de config no nível de cima).
func TestPipelineJSONShape(t *testing.T) {
	in := `{"id":"p","name":"N","offer":"O","stages":[],"requirements":[],"taskTags":["Comercial"],"qualifyRequires":["value"],"steps":[{"id":"s"}],"templateId":"tpl"}`
	var p PipelineDTO
	if err := json.Unmarshal([]byte(in), &p); err != nil {
		t.Fatal(err)
	}
	if string(p.TaskTags) != `["Comercial"]` || string(p.TemplateID) != `"tpl"` {
		t.Fatalf("config não foi lida no nível de cima: %+v", p.pipelineConfig)
	}
	out, _ := json.Marshal(p)
	var back map[string]json.RawMessage
	if err := json.Unmarshal(out, &back); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"id", "name", "offer", "stages", "requirements", "counts", "values", "taskTags", "qualifyRequires", "steps", "templateId"} {
		if _, ok := back[k]; !ok {
			t.Errorf("campo %q sumiu do JSON", k)
		}
	}
}

func TestApplicableGates(t *testing.T) {
	reqs := []gateReq{
		{ID: "enter-ass", StageID: "ass", Gate: "ENTER"},
		{ID: "enter-ass-2", StageID: "ass", Gate: "ENTER"}, // duas travas na mesma fronteira
		{ID: "exit-neg", StageID: "neg", Gate: "EXIT"},
		{ID: "enter-neg", StageID: "neg", Gate: "ENTER"},
	}
	ids := func(l []gateReq) string {
		var s []string
		for _, r := range l {
			s = append(s, r.ID)
		}
		return strings.Join(s, ",")
	}
	if got := ids(applicableGates(reqs, "neg", "ass")); got != "enter-ass,enter-ass-2,exit-neg" {
		t.Errorf("neg→ass: %s", got)
	}
	if got := ids(applicableGates(reqs, "", "neg")); got != "enter-neg" {
		t.Errorf("entrada sem origem: %s", got)
	}
	if got := ids(applicableGates(reqs, "ass", "ganho")); got != "" {
		t.Errorf("nada deveria travar ass→ganho: %s", got)
	}
}

func TestValidateTask(t *testing.T) {
	ok := TaskDTO{Title: " Ligar ", Entity: "opportunity", EntityID: "123"}
	if err := validateTask(&ok); err != nil || ok.Title != "Ligar" || ok.Source != "manual" {
		t.Fatalf("válida rejeitada: %v %+v", err, ok)
	}
	for name, tk := range map[string]TaskDTO{
		"sem título": {Entity: "lead", EntityID: "1"},
		"entidade":   {Title: "x", Entity: "banana", EntityID: "1"},
		"id":         {Title: "x", Entity: "lead", EntityID: "a b"},
		"origem":     {Title: "x", Entity: "lead", EntityID: "1", Source: "hack"},
	} {
		tk := tk
		if err := validateTask(&tk); err == nil {
			t.Errorf("%s: deveria falhar", name)
		}
	}
}

func TestParseDTAndSplit(t *testing.T) {
	if d := parseDT("2026-10-05 14:30:00"); d.Year() != 2026 || d.Hour() != 14 {
		t.Errorf("parseDT: %v", d)
	}
	if d := parseDT("2026-10-05 14:30:00.123456"); d.IsZero() {
		t.Error("parseDT com fração")
	}
	if !parseDT("lixo").Equal(time.Time{}) {
		t.Error("lixo deveria dar zero")
	}
	stmts := splitStatements(workflowSchema)
	if len(stmts) != 4 {
		t.Fatalf("esperava 4 CREATE TABLE, achei %d", len(stmts))
	}
	for _, s := range stmts {
		if !strings.HasPrefix(s, "CREATE TABLE IF NOT EXISTS") {
			t.Errorf("instrução inesperada: %.40s", s)
		}
	}
}

// Caminhos que respondem antes de tocar no banco.
func TestWorkflowHandlersNoDB(t *testing.T) {
	do := func(h http.HandlerFunc, method, path, id, body string) int {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if id != "" {
			req.SetPathValue("id", id)
		}
		rec := httptest.NewRecorder()
		h(rec, req)
		return rec.Code
	}
	if c := do(handlePipelines, "PATCH", "/api/pipelines", "", ""); c != 405 {
		t.Errorf("método: %d", c)
	}
	if c := do(handlePipelines, "POST", "/api/pipelines", "", `{"name":""}`); c != 422 {
		t.Errorf("funil inválido: %d", c)
	}
	if c := do(handlePipelines, "POST", "/api/pipelines", "", `não é json`); c != 400 {
		t.Errorf("json ruim: %d", c)
	}
	if c := do(handlePipelineByID, "GET", "/api/pipelines/x", "x y", ""); c != 400 {
		t.Errorf("id inválido: %d", c)
	}
	if c := do(handlePipelineByID, "PUT", "/api/pipelines/p", "p", `{"name":"x","stages":[]}`); c != 422 {
		t.Errorf("PUT inválido: %d", c)
	}
	if c := do(handleTasks, "POST", "/api/tasks", "", `{"title":""}`); c != 422 {
		t.Errorf("tarefa inválida: %d", c)
	}
	if c := do(handleTaskByID, "PUT", "/api/tasks/a", "a b", `{}`); c != 400 {
		t.Errorf("id de tarefa inválido: %d", c)
	}
	if c := do(handleGateCheck, "GET", "/api/gate/check", "", ""); c != 405 {
		t.Errorf("gate método: %d", c)
	}
	if c := do(handleGateCheck, "POST", "/api/gate/check", "", `{"entity":"x"}`); c != 400 {
		t.Errorf("gate corpo: %d", c)
	}
}

func TestWorkflowOffByDefault(t *testing.T) {
	t.Setenv("WORKFLOW_API", "")
	if workflowEnabled() {
		t.Error("deve vir desligado")
	}
	t.Setenv("WORKFLOW_API", "1")
	if !workflowEnabled() {
		t.Error("WORKFLOW_API=1 deveria ligar")
	}
}
