package main

import (
	"database/sql"
	"errors"
	"net/http"
)

// Integridade no servidor (WP4-1): onde uma etapa mora, o que vale como etapa de destino e o gate de
// oportunidades e leads. Antes disto as regras viviam só na tela (docs/po/relatorios/audit-pipelines-tarefas-automacoes.md).

// Valores antigos da coluna Opportunity.stage (anteriores aos funis). Continuam válidos: o admin os traduz
// para a etapa equivalente do funil (apps/admin/src/lib/stages.ts) e o servidor faz o mesmo (legacyStageFrom).
var legacyOppStages = map[string]bool{"INBOUND": true, "QUALIFICATION": true, "WON": true, "LOST": true}

// legacyStageFrom é o espelho de legacyStage() do admin: o valor antigo vira a etapa equivalente do funil.
// Devolve "" quando o funil não tem etapa que corresponda.
func legacyStageFrom(stages []PStage, value string) string {
	firstOf := func(kind string) string {
		for _, s := range stages {
			if s.Kind == kind {
				return s.ID
			}
		}
		return ""
	}
	switch value {
	case "WON":
		return firstOf("WON")
	case "LOST":
		return firstOf("LOST")
	case "QUALIFICATION":
		for _, s := range stages {
			if s.Kind == "OPEN" && s.Name == "Qualificação" {
				return s.ID
			}
		}
		return firstOf("OPEN")
	case "INBOUND":
		return firstOf("OPEN")
	}
	return ""
}

// stagePipeline devolve o funil dono da etapa.
func stagePipeline(stageID string) (pipelineID string, found bool, err error) {
	err = db.QueryRow(`SELECT pipelineId FROM PipelineStage WHERE id = ?`, stageID).Scan(&pipelineID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return pipelineID, err == nil, err
}

// firstActivePipeline é o funil para onde o admin manda o que não tem funil (valores antigos).
func firstActivePipeline() (string, error) {
	var id string
	err := db.QueryRow(`SELECT id FROM Pipeline WHERE archivedAt IS NULL ORDER BY position, createdAt, id LIMIT 1`).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, err
}

func stagesOf(pipelineID string) ([]PStage, error) {
	rows, err := db.Query(`SELECT id, name, kind FROM PipelineStage WHERE pipelineId = ? ORDER BY position`, pipelineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PStage
	for rows.Next() {
		var s PStage
		if err := rows.Scan(&s.ID, &s.Name, &s.Kind); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// effectiveStage traduz o valor gravado em Opportunity.stage para o id de uma etapa de verdade: o próprio
// valor se ele for uma etapa, ou a equivalente do valor antigo dentro do funil. "" se não houver.
func effectiveStage(value, pipelineID string) (string, error) {
	if _, ok, err := stagePipeline(value); err != nil || ok {
		return value, err
	}
	if !legacyOppStages[value] {
		return "", nil
	}
	if pipelineID == "" {
		var err error
		if pipelineID, err = firstActivePipeline(); err != nil || pipelineID == "" {
			return "", err
		}
	}
	st, err := stagesOf(pipelineID)
	if err != nil {
		return "", err
	}
	return legacyStageFrom(st, value), nil
}

// oppPipeline: funil de uma oportunidade pela coluna pipelineId; sem ela, o dono da etapa gravada; sem os dois
// (valor antigo nunca movido) devolve "" e quem chama cai no primeiro funil ativo.
func oppPipeline(col sql.NullString, stage string) (string, error) {
	if col.Valid && col.String != "" {
		return col.String, nil
	}
	pid, _, err := stagePipeline(stage)
	return pid, err
}

// destStage valida a etapa de destino de uma oportunidade (criar ou mover) e devolve a etapa que vale para o
// gate e o funil onde ela cai. Etapa que não existe e não é um valor antigo → linkError (422).
func destStage(value, currentPipeline string) (gateStage, pipelineID string, err error) {
	if pid, ok, err := stagePipeline(value); err != nil {
		return "", "", err
	} else if ok {
		return value, pid, nil
	}
	if !legacyOppStages[value] {
		return "", "", linkError("a etapa \"" + value + "\" não existe em nenhum funil")
	}
	pipelineID = currentPipeline
	if pipelineID == "" {
		if pipelineID, err = firstActivePipeline(); err != nil {
			return "", "", err
		}
	}
	if pipelineID == "" {
		return "", "", nil // nenhum funil ainda: valor antigo sem gate
	}
	st, err := effectiveStage(value, pipelineID)
	return st, pipelineID, err
}

// writeGate409 é a resposta de um movimento barrado pelo gate (a mesma do /api/leads/move).
func writeGate409(w http.ResponseWriter, blockers []Blocker) {
	writeJSON(w, http.StatusConflict, map[string]any{"error": "gate", "blockers": blockers})
}

// leadStageGuard confere a etapa de um lead (existe e é do funil dele) e aplica o gate. attempt=true grava a
// tarefa dos requisitos que travam (é uma tentativa de mover); false só consulta (criação: nada nasce antes do lead).
func leadStageGuard(l *LeadDTO, fromStage string, attempt bool) ([]Blocker, error) {
	pid, ok, err := stagePipeline(l.StageID)
	if err != nil {
		return nil, err
	}
	if !ok || pid != l.PipelineID {
		return nil, linkError("a etapa \"" + l.StageID + "\" não existe no funil do lead")
	}
	return checkGate(gateInput{EntityKind: "lead", EntityID: l.ID, EntityName: l.Name, FromStageID: fromStage, ToStageID: l.StageID}, attempt)
}
