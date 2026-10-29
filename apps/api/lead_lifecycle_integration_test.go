package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// WP4-2: qualificar o lead de verdade e o motivo de perda. Rodam com TEST_DSN, nos dois modos de DSN:
//   TEST_DSN='root:@tcp(127.0.0.1:3391)/kalidash_test' go test -run IntegrationCicloDoLead -v .

// seedLifecyclePipeline: o funil "ql" com qualifyRequires=[value], motivos próprios e um requisito de SAÍDA na primeira etapa.
//
//	ql:novos (LEAD, EXIT "Confirmar contato") · ql:contato (LEAD) · ql:neg (OPEN) · ql:prop (OPEN) · ql:ganho · ql:perdido
func seedLifecyclePipeline(t *testing.T) {
	t.Helper()
	p := &PipelineDTO{ID: "ql", Name: "Ciclo", Position: 3, Stages: []PStage{
		{ID: "ql:novos", Name: "Novos", Kind: "LEAD"},
		{ID: "ql:contato", Name: "Contatado", Kind: "LEAD"},
		{ID: "ql:neg", Name: "Negociação", Kind: "OPEN"},
		{ID: "ql:prop", Name: "Proposta", Kind: "OPEN"},
		{ID: "ql:ganho", Name: "Ganho", Kind: "WON"},
		{ID: "ql:perdido", Name: "Perdido", Kind: "LOST"},
	}, Requirements: []PRequirement{
		{ID: "ql:r-contato", StageID: "ql:novos", Label: "Confirmar contato", Tag: "Comercial", Kind: "ACTION", Gate: "EXIT"},
	}, pipelineConfig: pipelineConfig{
		QualifyRequires: json.RawMessage(`["value"]`),
		LostReasons:     json.RawMessage(`["Preço","Outro"]`),
	}}
	if err := validatePipeline(p); err != nil {
		t.Fatal(err)
	}
	if err := writePipeline(p, false, nil); err != nil {
		t.Fatal(err)
	}
}

func lifecycleDB(t *testing.T, f func(t *testing.T)) {
	bothDSN(t, func(t *testing.T) {
		seedLifecyclePipeline(t)
		f(t)
	})
}

func newLead(t *testing.T, l LeadDTO) LeadDTO {
	t.Helper()
	if l.Origin == "" {
		l.Origin, l.SourceName = "INBOUND", "LP"
	}
	r := call(handleCRMLeads, "POST", "/api/crm/leads", "", l)
	if r.code != 201 {
		t.Fatalf("criar lead: %d %s", r.code, r.body)
	}
	var got LeadDTO
	r.into(t, &got)
	return got
}

func qualify(id string, body any) reply {
	return call(handleQualifyLead, "POST", "/api/crm/leads/"+id+"/qualify", id, body)
}

type qualifyOut struct {
	Lead        LeadDTO     `json:"lead"`
	Opportunity Opportunity `json:"opportunity"`
	MovedTasks  int         `json:"movedTasks"`
}

func TestIntegrationCicloDoLeadQualificar(t *testing.T) {
	lifecycleDB(t, func(t *testing.T) {
		v := 0.0
		l := newLead(t, LeadDTO{ID: "lq1", Name: "Renata", Email: "renata@x.co", PersonID: "cont1", CompanyID: "comp1", PipelineID: "ql", StageID: "ql:novos", Tags: []string{"Quente"}, Message: "Quero um diagnóstico", EstimatedValue: &v})
		if _, err := db.Exec(`INSERT INTO Task (id, title, tag, source, entityKind, entityId, entityName, done, createdAt) VALUES ('tk-manual', 'Ligar', 'Comercial', 'manual', 'lead', 'lq1', 'Renata', 0, NOW())`); err != nil {
			t.Fatal(err)
		}
		untouched := func(when string) {
			t.Helper()
			var cur LeadDTO
			call(handleCRMLeadByID, "GET", "/x", "lq1", nil).into(t, &cur)
			if cur.Status != "ACTIVE" || cur.ConvertedOpportunityID != "" || countWhere(t, "Opportunity", "1=1") != 0 ||
				countWhere(t, "Task", "id = 'tk-manual' AND entityKind = 'lead'") != 1 || countWhere(t, "Note", "1=1") != 0 || countWhere(t, "ChangeLog", "kind = 'qualify'") != 0 {
				t.Errorf("%s: algo foi gravado (lead %+v)", when, cur)
			}
		}

		// campo exigido pelo funil (qualifyRequires): 422 com a lista do que falta, nada gravado
		r := qualify("lq1", nil)
		var miss struct {
			Missing []string `json:"missing"`
		}
		r.into(t, &miss)
		if r.code != 422 || len(miss.Missing) != 1 || miss.Missing[0] != "value" {
			t.Fatalf("sem valor: %d %s", r.code, r.body)
		}
		untouched("sem valor")
		if r := qualify("lq1", map[string]any{"value": -5}); r.code != 422 {
			t.Errorf("valor negativo: %d", r.code)
		}

		// gate de SAÍDA da etapa Lead: 409 com o requisito; a tarefa do requisito nasce (como num move barrado)
		r = qualify("lq1", map[string]any{"value": 8000})
		if r.code != 409 || blockerIDs(r) != "ql:r-contato" {
			t.Fatalf("gate de saída: %d %s", r.code, r.body)
		}
		var cur LeadDTO
		call(handleCRMLeadByID, "GET", "/x", "lq1", nil).into(t, &cur)
		if cur.Status != "ACTIVE" || cur.EstimatedValue == nil && false || countWhere(t, "Opportunity", "1=1") != 0 || countWhere(t, "Note", "1=1") != 0 || countWhere(t, "ChangeLog", "kind = 'qualify'") != 0 {
			t.Errorf("gate: nada da qualificação pode ter sido gravado: %+v", cur)
		}
		var taskID string
		if err := db.QueryRow(`SELECT id FROM Task WHERE requirementId = 'ql:r-contato' AND entityKind = 'lead' AND entityId = 'lq1'`).Scan(&taskID); err != nil {
			t.Fatalf("a tarefa do requisito deveria existir: %v", err)
		}
		doneTask(t, taskID)

		// agora qualifica, informando o valor na chamada
		r = qualify("lq1", map[string]any{"value": 8000})
		if r.code != 201 {
			t.Fatalf("qualificar: %d %s", r.code, r.body)
		}
		var out qualifyOut
		r.into(t, &out)
		o := out.Opportunity
		if out.Lead.Status != "QUALIFIED" || out.Lead.ConvertedOpportunityID != o.ID || o.ID == "" {
			t.Fatalf("lead e oportunidade ligados: %+v", out)
		}
		if o.Stage != "ql:neg" || o.Title != "Renata" || o.Value == nil || *o.Value != 8000 || len(o.Tags) != 1 || o.Tags[0] != "Quente" {
			t.Errorf("oportunidade na primeira etapa aberta, com valor e tags: %+v", o)
		}
		if o.ContactID == nil || *o.ContactID != "cont1" || o.CompanyID == nil || *o.CompanyID != "comp1" {
			t.Errorf("pessoa e empresa copiadas: %+v", o)
		}
		var pid string
		db.QueryRow(`SELECT pipelineId FROM Opportunity WHERE id = ?`, o.ID).Scan(&pid)
		if pid != "ql" {
			t.Errorf("pipelineId da oportunidade: %q", pid)
		}
		if out.MovedTasks != 1 || countWhere(t, "Task", "id = 'tk-manual' AND entityKind = 'opportunity' AND entityId = ?", o.ID) != 1 {
			t.Errorf("a tarefa aberta do lead tem de ir para a oportunidade: moved=%d", out.MovedTasks)
		}
		if countWhere(t, "Task", "id = ? AND entityKind = 'lead'", taskID) != 1 {
			t.Errorf("a tarefa já concluída fica com o lead")
		}
		if countWhere(t, "Note", "opportunityId = ? AND content LIKE '%Quero um diagnóstico%'", o.ID) != 1 {
			t.Errorf("a mensagem do lead vira anotação")
		}
		if countWhere(t, "ChangeLog", "kind = 'qualify' AND entity = 'lead' AND entityId = 'lq1'") != 1 || countWhere(t, "ChangeLog", "kind = 'create' AND entity = 'opportunity' AND entityId = ?", o.ID) != 1 {
			t.Errorf("histórico da qualificação")
		}
		// a oportunidade existe de verdade em GET /api/leads
		lr := call(handleOpportunities, "GET", "/api/leads", "", nil)
		var list []Opportunity
		lr.into(t, &list)
		found := false
		for _, x := range list {
			found = found || x.ID == o.ID
		}
		if !found {
			t.Errorf("GET /api/leads não lista a oportunidade %s", o.ID)
		}

		// idempotente: de novo é 409 com o id existente, sem duplicar nada
		r = qualify("lq1", nil)
		var dup struct {
			OpportunityID string `json:"opportunityId"`
		}
		r.into(t, &dup)
		if r.code != 409 || dup.OpportunityID != o.ID || countWhere(t, "Opportunity", "1=1") != 1 || countWhere(t, "Note", "1=1") != 1 {
			t.Errorf("repetir: %d %s", r.code, r.body)
		}
		if r := qualify("nao-existe", nil); r.code != 404 {
			t.Errorf("lead inexistente: %d", r.code)
		}
	})
}

func TestIntegrationCicloDoLeadAtomicoEConcorrente(t *testing.T) {
	lifecycleDB(t, func(t *testing.T) {
		v := 100.0
		newLead(t, LeadDTO{ID: "la1", Name: "Atômico", Email: "a@x.co", PipelineID: "ql", StageID: "ql:contato", EstimatedValue: &v, Message: "olá"})
		// falha NO MEIO da transação (a anotação não grava): rollback total, o lead segue ativo
		db.Exec(`DROP TABLE Note`)
		r := qualify("la1", nil)
		if r.code != 500 {
			t.Fatalf("falha no meio deveria ser 500: %d %s", r.code, r.body)
		}
		var cur LeadDTO
		call(handleCRMLeadByID, "GET", "/x", "la1", nil).into(t, &cur)
		if cur.Status != "ACTIVE" || cur.ConvertedOpportunityID != "" || countWhere(t, "Opportunity", "1=1") != 0 || countWhere(t, "ChangeLog", "kind = 'qualify'") != 0 {
			t.Fatalf("rollback: lead %+v", cur)
		}
		if _, err := db.Exec(`CREATE TABLE Note (id VARCHAR(64) PRIMARY KEY, content TEXT NOT NULL, type VARCHAR(16) NOT NULL DEFAULT 'NOTE', opportunityId VARCHAR(64) NOT NULL, authorId VARCHAR(64) NULL, createdAt DATETIME NOT NULL)`); err != nil {
			t.Fatal(err)
		}

		// duas chamadas ao mesmo tempo: uma qualifica, a outra é 409, e há uma só oportunidade
		var wg sync.WaitGroup
		codes := make([]int, 6)
		for i := range codes {
			wg.Add(1)
			go func() {
				defer wg.Done()
				codes[i] = qualify("la1", nil).code
			}()
		}
		wg.Wait()
		created, conflicts := 0, 0
		for _, c := range codes {
			switch c {
			case 201:
				created++
			case 409:
				conflicts++
			}
		}
		if created != 1 || conflicts != len(codes)-1 || countWhere(t, "Opportunity", "1=1") != 1 || countWhere(t, "Note", "1=1") != 1 {
			t.Errorf("concorrência: códigos %v, oportunidades %d", codes, countWhere(t, "Opportunity", "1=1"))
		}
	})
}

func TestIntegrationCicloDoLeadDescartarRestaurar(t *testing.T) {
	lifecycleDB(t, func(t *testing.T) {
		l := newLead(t, LeadDTO{ID: "ld1", Name: "Descartável", Email: "d@x.co", PipelineID: "ql", StageID: "ql:novos"})
		put := func(mut func(*LeadDTO)) reply {
			var cur LeadDTO
			call(handleCRMLeadByID, "GET", "/x", "ld1", nil).into(t, &cur)
			mut(&cur)
			return putLead("ld1", cur)
		}
		for name, mut := range map[string]func(*LeadDTO){
			"sem motivo":       func(x *LeadDTO) { x.Status = "DISCARDED" },
			"fora da lista":    func(x *LeadDTO) { x.Status, x.DiscardReason = "DISCARDED", "Sem orçamento" }, // o funil "ql" só tem Preço e Outro
			"Outro sem a nota": func(x *LeadDTO) { x.Status, x.DiscardReason = "DISCARDED", "Outro" },
		} {
			if r := put(mut); r.code != 422 {
				t.Errorf("descartar %s: %d %s", name, r.code, r.body)
			}
		}
		if r := put(func(x *LeadDTO) { x.Status, x.DiscardReason, x.DiscardNote = "DISCARDED", "Outro", "fechou a empresa" }); r.code != 200 {
			t.Fatalf("descartar com Outro + nota: %d %s", r.code, r.body)
		}
		var got LeadDTO
		call(handleCRMLeadByID, "GET", "/x", "ld1", nil).into(t, &got)
		if got.Status != "DISCARDED" || got.DiscardReason != "Outro" || got.DiscardNote != "fechou a empresa" {
			t.Errorf("descartado: %+v", got)
		}
		// editar outra coisa do lead já descartado não pede o motivo de novo
		if r := put(func(x *LeadDTO) { x.Phone = "11999990000" }); r.code != 200 {
			t.Errorf("editar descartado: %d %s", r.code, r.body)
		}
		if r := qualify("ld1", map[string]any{"value": 5}); r.code != 409 {
			t.Errorf("qualificar descartado: %d", r.code)
		}
		if r := put(func(x *LeadDTO) { x.Status = "ACTIVE" }); r.code != 200 {
			t.Fatalf("restaurar: %d %s", r.code, r.body)
		}
		call(handleCRMLeadByID, "GET", "/x", "ld1", nil).into(t, &got)
		if got.Status != "ACTIVE" || got.DiscardReason != "" || got.DiscardNote != "" {
			t.Errorf("restaurar volta a ACTIVE e limpa o motivo: %+v", got)
		}
		if countWhere(t, "ChangeLog", "entityId = 'ld1' AND kind = 'discard'") != 1 || countWhere(t, "ChangeLog", "entityId = 'ld1' AND kind = 'restore'") != 1 {
			t.Errorf("histórico de descarte e restauração")
		}
		// funil sem motivos próprios usa a lista padrão
		newLead(t, LeadDTO{ID: "ld2", Name: "Padrão", Email: "p@x.co", PipelineID: "q4", StageID: "q4:novos"})
		var d2 LeadDTO
		call(handleCRMLeadByID, "GET", "/x", "ld2", nil).into(t, &d2)
		d2.Status, d2.DiscardReason = "DISCARDED", "Sem resposta"
		if r := putLead("ld2", d2); r.code != 200 {
			t.Errorf("motivo padrão: %d %s", r.code, r.body)
		}
		// PUT não qualifica nem desfaz a qualificação
		d2.Status, d2.DiscardReason = "QUALIFIED", ""
		if r := putLead("ld2", d2); r.code != 422 {
			t.Errorf("PUT QUALIFIED: %d", r.code)
		}
		_ = l
	})
}

func TestIntegrationCicloDoLeadMotivoDePerda(t *testing.T) {
	lifecycleDB(t, func(t *testing.T) {
		insertOpp(t, "op1", "ql:neg", "ql")
		insertOpp(t, "op2", "q4:neg", "q4")
		move := func(id, stage string, reason, note string) reply {
			body := map[string]any{"lead_id": id, "column_id": stage}
			if reason != "" {
				body["lostReason"] = reason
			}
			if note != "" {
				body["lostReasonNote"] = note
			}
			return call(handleMoveOpportunity, "POST", "/api/leads/move", "", body)
		}
		stageOf := func(id string) (string, string, string) {
			var st string
			var reason, note *string
			db.QueryRow(`SELECT stage, lostReason, lostReasonNote FROM Opportunity WHERE id = ?`, id).Scan(&st, &reason, &note)
			s := func(p *string) string {
				if p == nil {
					return ""
				}
				return *p
			}
			return st, s(reason), s(note)
		}
		// obrigatório, da lista do funil e com a nota em "Outro"
		for name, c := range map[string][2]string{"sem motivo": {"", ""}, "fora da lista": {"Sem orçamento", ""}, "Outro sem nota": {"Outro", ""}} {
			if r := move("op1", "ql:perdido", c[0], c[1]); r.code != 422 {
				t.Errorf("perder %s: %d %s", name, r.code, r.body)
			}
		}
		if st, _, _ := stageOf("op1"); st != "ql:neg" {
			t.Errorf("movimento recusado não pode mexer na etapa: %s", st)
		}
		if r := move("op1", "ql:perdido", "Preço", ""); r.code != 200 {
			t.Fatalf("perder com motivo: %d %s", r.code, r.body)
		}
		if st, reason, _ := stageOf("op1"); st != "ql:perdido" || reason != "Preço" {
			t.Errorf("perdida: %s %q", st, reason)
		}
		// aparece na lista de oportunidades
		var list []Opportunity
		call(handleOpportunities, "GET", "/api/leads", "", nil).into(t, &list)
		for _, o := range list {
			if o.ID == "op1" && (o.LostReason == nil || *o.LostReason != "Preço") {
				t.Errorf("GET /api/leads sem o motivo: %+v", o)
			}
		}
		// permanecer na etapa Perdida mantém o motivo; sair limpa
		if r := move("op1", "ql:perdido", "", ""); r.code != 200 {
			t.Errorf("mesma etapa Perdida: %d", r.code)
		}
		if _, reason, _ := stageOf("op1"); reason != "Preço" {
			t.Errorf("mesma etapa mantém o motivo: %q", reason)
		}
		// corrigir o motivo pelo PUT (só enquanto Perdida)
		if code, _ := putOpp(t, `{"id":"op1","title":"Opp op1","value":100,"lostReason":"Outro","lostReasonNote":"mudou de ideia"}`); code != 200 {
			t.Errorf("PUT motivo: %d", code)
		}
		if _, reason, note := stageOf("op1"); reason != "Outro" || note != "mudou de ideia" {
			t.Errorf("motivo corrigido: %q %q", reason, note)
		}
		if code, _ := putOpp(t, `{"id":"op1","title":"Opp op1","value":100,"lostReason":"Inventado"}`); code != 422 {
			t.Errorf("PUT motivo fora da lista: %d", code)
		}
		if r := move("op1", "ql:neg", "", ""); r.code != 200 {
			t.Fatalf("reabrir: %d %s", r.code, r.body)
		}
		if st, reason, note := stageOf("op1"); st != "ql:neg" || reason != "" || note != "" {
			t.Errorf("sair da Perdida limpa o motivo: %s %q %q", st, reason, note)
		}
		// funil sem lista própria: padrão; valor antigo "LOST" também exige
		if r := move("op2", "LOST", "", ""); r.code != 422 {
			t.Errorf("LOST legado sem motivo: %d", r.code)
		}
		if r := move("op2", "q4:perdido", "Sem fit", ""); r.code != 200 {
			t.Errorf("motivo padrão: %d %s", r.code, r.body)
		}
		// criar já Perdida também pede o motivo
		if r := call(handleOpportunities, "POST", "/api/leads", "", map[string]any{"title": "Nasce perdida", "value": 1, "stage": "ql:perdido"}); r.code != 422 {
			t.Errorf("criar Perdida sem motivo: %d", r.code)
		}
		if r := call(handleOpportunities, "POST", "/api/leads", "", map[string]any{"title": "Nasce perdida", "value": 1, "stage": "ql:perdido", "lostReason": "Preço"}); r.code != 201 {
			t.Errorf("criar Perdida com motivo: %d %s", r.code, r.body)
		}
	})
}

// O Vendedor (leads:own) qualifica só o lead dele; o de outro é 404; o Gerente qualifica qualquer um.
func TestIntegrationCicloDoLeadEscopoOwn(t *testing.T) {
	adm := oppEnv(t)
	db.Exec(`DELETE FROM Opportunity`)
	seedLifecyclePipeline(t)
	ven, err := authDB.AddMember(Member{Email: "ven@kalidash.test", Name: "Vera", Role: roleSeller}, adm.ID)
	if err != nil {
		t.Fatal(err)
	}
	ven2, _ := authDB.AddMember(Member{Email: "ven2@kalidash.test", Name: "Vitor", Role: roleSeller}, adm.ID)
	ger, _ := authDB.AddMember(Member{Email: "ger@kalidash.test", Name: "Gil", Role: roleManager}, adm.ID)

	mux := http.NewServeMux()
	registerCRMRoutes(mux)
	h := withAuth(mux)
	do := func(m Member, method, path, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		if err := startSession(rec, httptest.NewRequest("GET", "/", nil), m.ID); err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.AddCookie(rec.Result().Cookies()[0])
		r.Header.Set("Origin", testAdminOrigin)
		out := httptest.NewRecorder()
		h.ServeHTTP(out, r)
		return out
	}
	lead := func(id, owner string) {
		newLeadAs := LeadDTO{ID: id, Name: "Lead " + id, Email: id + "@x.co", PipelineID: "ql", StageID: "ql:contato", Origin: "INBOUND", SourceName: "LP", OwnerID: owner}
		v := 500.0
		newLeadAs.EstimatedValue = &v
		if r := call(handleCRMLeads, "POST", "/api/crm/leads", "", newLeadAs); r.code != 201 {
			t.Fatalf("lead %s: %d %s", id, r.code, r.body)
		}
	}
	lead("lv1", ven.ID)
	lead("lv2", ven2.ID)
	lead("lv3", ven.ID)

	if rec := do(ven, "POST", "/api/crm/leads/lv2/qualify", ``); rec.Code != 404 {
		t.Errorf("Vendedor qualificando lead de outro: %d %s", rec.Code, rec.Body)
	}
	if countWhere(t, "Opportunity", "1=1") != 0 {
		t.Errorf("nada pode ter sido criado")
	}
	rec := do(ven, "POST", "/api/crm/leads/lv1/qualify", `{}`)
	var out qualifyOut
	json.Unmarshal(rec.Body.Bytes(), &out)
	if rec.Code != 201 || out.Opportunity.OwnerMemberID == nil || *out.Opportunity.OwnerMemberID != ven.ID {
		t.Fatalf("Vendedor qualifica o próprio: %d %s", rec.Code, rec.Body)
	}
	// o Vendedor não troca o responsável ao qualificar
	if rec := do(ven, "POST", "/api/crm/leads/lv3/qualify", `{"ownerId":"`+ven2.ID+`"}`); rec.Code != 403 {
		t.Errorf("Vendedor reatribuindo ao qualificar: %d", rec.Code)
	}
	if rec := do(ger, "POST", "/api/crm/leads/lv2/qualify", ``); rec.Code != 201 {
		t.Errorf("Gerente qualifica qualquer um: %d %s", rec.Code, rec.Body)
	}
}
