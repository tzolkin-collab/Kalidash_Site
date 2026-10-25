package main

import (
	"database/sql"
	"time"
)

// PipelineStats: os números do card de um funil (WP4-1, B-11). O Kanban e o card passam a ler a mesma conta.
type PipelineStats struct {
	Records   int `json:"records"`   // oportunidades do funil (legadas incluídas)
	OpenTasks int `json:"openTasks"` // tarefas abertas dos registros do funil (manuais, de passo e de requisito)
	Overdue   int `json:"overdue"`   // dessas, as de prazo vencido (inclui as manuais)
	Blocked   int `json:"blocked"`   // REGISTROS com ao menos uma tarefa aberta de requisito que trava (não tarefas)
}

// fillCountsAndStats preenche counts/values por etapa e stats de cada funil carregado.
//
// O funil de uma oportunidade é, nesta ordem: o dono da etapa gravada; a coluna Opportunity.pipelineId; o primeiro
// funil ativo (valores antigos como INBOUND/WON nunca movidos — o admin faz o mesmo em stages.ts). A etapa efetiva é a
// gravada, ou a equivalente do valor antigo dentro do funil (legacyStageFrom). Oportunidade em etapa que não existe
// em nenhum funil e não é valor antigo não entra em contagem nenhuma.
func fillCountsAndStats(out []PipelineDTO, index map[string]int, reqIdx map[string][2]int, stageOwner map[string]string, stagesByPipe map[string][]PStage) error {
	first, err := firstActivePipeline()
	if err != nil {
		return err
	}
	rows, err := db.Query(`SELECT id, stage, pipelineId, COALESCE(value, 0) FROM Opportunity`)
	if err != nil {
		return err
	}
	defer rows.Close()
	oppPipe := map[string]string{}
	for rows.Next() {
		var id, stage string
		var col sql.NullString
		var value float64
		if err := rows.Scan(&id, &stage, &col, &value); err != nil {
			return err
		}
		pid, ok := stageOwner[stage]
		if !ok {
			switch {
			case col.Valid && len(stagesByPipe[col.String]) > 0:
				pid = col.String
			case legacyOppStages[stage]:
				pid = first
			}
		}
		if pid == "" {
			continue
		}
		oppPipe[id] = pid
		eff := stage
		if stageOwner[stage] != pid {
			eff = legacyStageFrom(stagesByPipe[pid], stage)
			if !legacyOppStages[stage] {
				eff = ""
			}
		}
		i, loaded := index[pid]
		if !loaded {
			continue
		}
		out[i].Stats.Records++
		if eff != "" {
			out[i].Counts[eff]++
			out[i].Values[eff] += value
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	leadPipe := map[string]string{}
	if crmEnabled() {
		lr, err := db.Query(`SELECT id, pipelineId FROM ` + leadTbl + ` WHERE archivedAt IS NULL`)
		if err != nil {
			return err
		}
		defer lr.Close()
		for lr.Next() {
			var id, pid string
			if err := lr.Scan(&id, &pid); err != nil {
				return err
			}
			leadPipe[id] = pid
		}
	}

	tr, err := db.Query(`SELECT requirementId, pipelineId, entityKind, entityId, dueAt FROM Task WHERE done = 0`)
	if err != nil {
		return err
	}
	defer tr.Close()
	now := time.Now()
	blocked := map[string]map[string]bool{}
	for tr.Next() {
		var req, taskPipe, due sql.NullString
		var kind, entity string
		if err := tr.Scan(&req, &taskPipe, &kind, &entity, &due); err != nil {
			return err
		}
		pid := ""
		switch kind {
		case "opportunity":
			pid = oppPipe[entity]
		case "lead":
			pid = leadPipe[entity]
		case "pipeline":
			pid = entity
		default:
			pid = taskPipe.String
		}
		i, loaded := index[pid]
		if pid == "" || !loaded {
			continue
		}
		out[i].Stats.OpenTasks++
		if due.Valid {
			if d := parseDT(due.String); !d.IsZero() && d.Before(now) {
				out[i].Stats.Overdue++
			}
		}
		if req.Valid {
			if loc, ok := reqIdx[req.String]; ok && out[loc[0]].Requirements[loc[1]].Gate != "NONE" {
				if blocked[pid] == nil {
					blocked[pid] = map[string]bool{}
				}
				blocked[pid][kind+":"+entity] = true
			}
		}
	}
	for pid, set := range blocked {
		out[index[pid]].Stats.Blocked = len(set)
	}
	return tr.Err()
}
