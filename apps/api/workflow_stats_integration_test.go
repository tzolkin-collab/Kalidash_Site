package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// WP4-1, itens 6 e 7: Opportunity.pipelineId e as contagens do funil; concorrência no PUT do funil.
//   TEST_DSN='root:@tcp(127.0.0.1:3361)/kalidash_test' go test -run "IntegrationContagens|IntegrationConcorrencia" -v .

func pipelineByID(t *testing.T, id string) PipelineDTO {
	t.Helper()
	var list []PipelineDTO
	call(handlePipelines, "GET", "/api/pipelines", "", nil).into(t, &list)
	for _, p := range list {
		if p.ID == id {
			return p
		}
	}
	t.Fatalf("funil %s não veio na lista", id)
	return PipelineDTO{}
}

func TestIntegrationContagensDoFunil(t *testing.T) {
	bothDSN(t, func(t *testing.T) {
		addOppColumns(t)
		// q4 (posição 0) é o primeiro funil ativo: para onde vão os valores antigos
		insertOpp(t, "o1", "g:neg", "g")
		insertOpp(t, "o2", "g:neg", "g")
		insertOpp(t, "leg-in", "INBOUND", nil)
		insertOpp(t, "leg-won", "WON", nil)
		insertOpp(t, "lixo", "xyz:nada", nil)
		insertOpp(t, "so-stage", "q4:ass", nil) // gravada antes da coluna existir: o funil sai do id da etapa

		q4, g := pipelineByID(t, "q4"), pipelineByID(t, "g")
		if q4.Counts["q4:neg"] != 1 || q4.Counts["q4:ganho"] != 1 || q4.Counts["q4:ass"] != 1 || q4.Stats.Records != 3 {
			t.Errorf("legados devem cair no primeiro funil, na etapa equivalente: counts=%v records=%d", q4.Counts, q4.Stats.Records)
		}
		if g.Counts["g:neg"] != 2 || g.Stats.Records != 2 || g.Values["g:neg"] != 200 {
			t.Errorf("funil g: counts=%v values=%v records=%d", g.Counts, g.Values, g.Stats.Records)
		}
		total := 0
		for _, p := range []PipelineDTO{q4, g, pipelineByID(t, "b2b")} {
			total += p.Stats.Records
		}
		if total != 5 {
			t.Errorf("a etapa inexistente (\"lixo\") não pode entrar em funil nenhum: %d registros no total", total)
		}

		// bloqueados contam REGISTROS: dois requisitos no mesmo registro = 1 bloqueado, não 2
		p := getPipeline(t, "g")
		p.Requirements = append(p.Requirements, PRequirement{ID: "g:r-contrato", StageID: "g:ass", Label: "Enviar contrato", Kind: "ACTION", Gate: "ENTER"})
		if r := putPipeline("g", p); r.code != 200 {
			t.Fatalf("novo requisito: %d %s", r.code, r.body)
		}
		moveOpp("o1", "g:ass")
		g = pipelineByID(t, "g")
		perReq := 0
		for _, r := range g.Requirements {
			perReq += r.Blocked
		}
		if g.Stats.Blocked != 1 || perReq != 2 {
			t.Errorf("1 registro bloqueado por 2 requisitos: stats.blocked=%d, soma por requisito=%d", g.Stats.Blocked, perReq)
		}
		moveOpp("o2", "g:ass")
		if g = pipelineByID(t, "g"); g.Stats.Blocked != 2 || g.Stats.OpenTasks != 4 {
			t.Errorf("2 registros / 4 tarefas: %+v", g.Stats)
		}

		// atrasadas incluem as tarefas manuais
		past := time.Now().Add(-48 * time.Hour).UTC().Format(time.RFC3339)
		if r := call(handleTasks, "POST", "/api/tasks", "", map[string]any{"title": "Ligar", "entity": "opportunity", "entityId": "o1", "dueAt": past}); r.code != 201 {
			t.Fatalf("tarefa manual: %d %s", r.code, r.body)
		}
		if g = pipelineByID(t, "g"); g.Stats.Overdue != 1 || g.Stats.OpenTasks != 5 {
			t.Errorf("a manual atrasada conta: %+v", g.Stats)
		}
		// tarefa de registro que não existe mais / que mudou de funil não conta no funil antigo
		db.Exec(`UPDATE Opportunity SET stage = 'q4:neg', pipelineId = 'q4' WHERE id = 'o2'`)
		if g = pipelineByID(t, "g"); g.Stats.Blocked != 1 || g.Stats.Records != 1 {
			t.Errorf("o2 saiu do funil: %+v", g.Stats)
		}

		// o move grava o funil de destino
		moveOpp("o1", "q4:neg") // o1 tem tarefas abertas só de ENTER em g:ass; sair de g:neg não trava
		if countWhere(t, "Opportunity", "id = 'o1' AND pipelineId = 'q4'") != 1 {
			t.Error("o move deveria gravar pipelineId = q4")
		}

		// backfill idempotente: preenche pelo id da etapa; valor antigo continua nulo
		db.Exec(`UPDATE Opportunity SET pipelineId = NULL`)
		for i := 0; i < 2; i++ {
			if err := backfillOpportunityPipelines(); err != nil {
				t.Fatal(err)
			}
		}
		if countWhere(t, "Opportunity", "id = 'o2' AND pipelineId = 'q4'") != 1 || countWhere(t, "Opportunity", "id = 'leg-in' AND pipelineId IS NULL") != 1 {
			t.Error("backfill: pelo id da etapa sim, valor antigo não")
		}
		ensureWorkflowColumns() // idempotente: segunda subida não pode falhar
	})
}

func TestIntegrationConcorrenciaDoFunil(t *testing.T) {
	bothDSN(t, func(t *testing.T) {
		a := getPipeline(t, "g")
		if a.UpdatedAt == nil {
			t.Fatal("o funil precisa devolver updatedAt")
		}
		// sem o campo: comportamento de sempre (last-write-wins), e toda gravação muda a versão
		a.Name = "Gated A"
		r1 := putPipeline("g", a)
		var v1 PipelineDTO
		r1.into(t, &v1)
		if r1.code != 200 || !v1.UpdatedAt.After(*a.UpdatedAt) {
			t.Fatalf("PUT sem expected: %d, versão %v → %v", r1.code, a.UpdatedAt, v1.UpdatedAt)
		}
		// com a versão certa (campo e cabeçalho): passa
		v1.Name = "Gated B"
		v1.ExpectedUpdatedAt = v1.UpdatedAt
		r2 := putPipeline("g", v1)
		var v2 PipelineDTO
		r2.into(t, &v2)
		if r2.code != 200 || v2.Name != "Gated B" {
			t.Fatalf("expectedUpdatedAt certo: %d %s", r2.code, r2.body)
		}
		put := func(p PipelineDTO, ifMatch string) reply {
			p.ExpectedUpdatedAt = nil
			b := new(strings.Builder)
			b.WriteString(string(mustJSON(p)))
			req := httptest.NewRequest("PUT", "/api/pipelines/g", strings.NewReader(b.String()))
			req.SetPathValue("id", "g")
			if ifMatch != "" {
				req.Header.Set("If-Match", ifMatch)
			}
			rec := httptest.NewRecorder()
			handlePipelineByID(rec, req)
			return reply{rec.Code, rec.Body.Bytes()}
		}
		v2.Name = "Gated C"
		if r := put(v2, `"`+v2.UpdatedAt.Format(time.RFC3339)+`"`); r.code != 200 {
			t.Fatalf("If-Match certo: %d %s", r.code, r.body)
		}
		// versão velha (a de a/v1): outra pessoa gravou depois → 409 conflict com o estado atual; nada é gravado
		stale := v1
		stale.Name = "Gated STALE"
		stale.ExpectedUpdatedAt = v1.UpdatedAt
		r3 := putPipeline("g", stale)
		var conflict struct {
			Error   string      `json:"error"`
			Current PipelineDTO `json:"current"`
		}
		r3.into(t, &conflict)
		if r3.code != 409 || conflict.Error != "conflict" || conflict.Current.Name != "Gated C" || conflict.Current.UpdatedAt == nil {
			t.Fatalf("campo desatualizado: %d %s", r3.code, r3.body)
		}
		if r := put(stale, `"`+v1.UpdatedAt.Format(time.RFC3339)+`"`); r.code != 409 {
			t.Errorf("If-Match desatualizado: %d %s", r.code, r.body)
		}
		if getPipeline(t, "g").Name != "Gated C" {
			t.Error("a edição desatualizada não pode ter gravado")
		}
		if r := put(stale, "lixo"); r.code != 400 {
			t.Errorf("If-Match inválido: %d", r.code)
		}
		// com o estado atual do 409 a pessoa refaz a edição e passa
		redo := conflict.Current
		redo.Name = "Gated D"
		redo.ExpectedUpdatedAt = conflict.Current.UpdatedAt
		if r := putPipeline("g", redo); r.code != 200 {
			t.Errorf("refazer sobre o estado atual: %d %s", r.code, r.body)
		}
	})
}
