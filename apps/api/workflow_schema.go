package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// Funis, etapas, requisitos de etapa e tarefas (docs/plano-schema.md §2 e §6, recorte do que o
// admin já usa: apps/admin/src/domain.ts). Tudo isto fica DESLIGADO por padrão: com
// WORKFLOW_API=1 a API cria as tabelas na subida (CREATE TABLE IF NOT EXISTS, nada é alterado nem
// apagado) e registra as rotas. Sem a variável, nada muda no banco nem na API.
//
// Decisão de modelagem: etapas e requisitos são tabelas de verdade (o gate e as contagens fazem
// join com elas); fontes, campos personalizados, tags de tarefa, passos do ciclo de vida e
// afins ficam num JSON `config` do funil até ganharem tabela própria (Source, CustomField,
// Automation no plano-schema).

func workflowEnabled() bool { return os.Getenv("WORKFLOW_API") == "1" }

const workflowSchema = `
CREATE TABLE IF NOT EXISTS Pipeline (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(160) NOT NULL,
	offer VARCHAR(160) NOT NULL DEFAULT '',
	position INT NOT NULL DEFAULT 0,
	config JSON NULL,
	archivedAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS PipelineStage (
	id VARCHAR(128) PRIMARY KEY,
	pipelineId VARCHAR(64) NOT NULL,
	name VARCHAR(120) NOT NULL,
	kind VARCHAR(8) NOT NULL,
	position INT NOT NULL,
	color VARCHAR(16) NOT NULL DEFAULT '',
	probability INT NULL,
	alertDays INT NULL,
	INDEX idx_stage_pipeline (pipelineId, position),
	CONSTRAINT fk_stage_pipeline FOREIGN KEY (pipelineId) REFERENCES Pipeline(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS StageRequirement (
	id VARCHAR(128) PRIMARY KEY,
	pipelineId VARCHAR(64) NOT NULL,
	stageId VARCHAR(128) NOT NULL,
	label VARCHAR(200) NOT NULL,
	tag VARCHAR(80) NOT NULL DEFAULT '',
	kind VARCHAR(8) NOT NULL,
	gate VARCHAR(8) NOT NULL DEFAULT 'NONE',
	assignee VARCHAR(120) NULL,
	dueDays INT NULL,
	notifyAssignee TINYINT(1) NOT NULL DEFAULT 0,
	linkedAutomationId VARCHAR(64) NULL,
	position INT NOT NULL DEFAULT 0,
	INDEX idx_req_pipeline (pipelineId, stageId, position),
	CONSTRAINT fk_req_pipeline FOREIGN KEY (pipelineId) REFERENCES Pipeline(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS Task (
	id VARCHAR(64) PRIMARY KEY,
	title VARCHAR(255) NOT NULL,
	tag VARCHAR(80) NOT NULL DEFAULT '',
	source VARCHAR(12) NOT NULL,
	entityKind VARCHAR(16) NOT NULL,
	entityId VARCHAR(64) NOT NULL,
	entityName VARCHAR(255) NOT NULL DEFAULT '',
	pipelineId VARCHAR(64) NULL,
	requirementId VARCHAR(128) NULL,
	assignee VARCHAR(120) NULL,
	dueAt DATETIME NULL,
	done TINYINT(1) NOT NULL DEFAULT 0,
	doneAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	UNIQUE KEY uq_task_req_entity (requirementId, entityKind, entityId),
	INDEX idx_task_entity (entityKind, entityId),
	INDEX idx_task_pipeline (pipelineId, done, dueAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

// ensureWorkflowSchema roda uma instrução por vez (o driver não aceita várias por Exec).
func ensureWorkflowSchema() {
	for _, stmt := range splitStatements(workflowSchema) {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("❌ Erro ao criar tabelas de funil/tarefas: %v", err)
		}
	}
	ensureWorkflowColumns()
	log.Println("✅ Tabelas de funil, requisitos e tarefas prontas (WORKFLOW_API=1)")
}

// Colunas acrescentadas depois (WP4-1), só ADD COLUMN nulo: nada é alterado nem apagado; idempotente.
//   - Task.assigneeMemberId: responsável como pessoa da equipe (TeamMember.id); o texto `assignee` segue valendo.
//   - StageRequirement.fieldKey (WP4-1b, D41): chave do dado exigido pela tarefa de campo; nulo = reconhece pelo título.
//   - Opportunity.pipelineId: o funil da oportunidade (antes deduzido do id da etapa). Preenchido na criação e no
//     move; as antigas recebem o funil pelo id da etapa (backfillOpportunityPipelines).
var workflowColumns = []colSpec{
	{"Task", "assigneeMemberId", "VARCHAR(64) NULL"},
	{"Opportunity", "pipelineId", "VARCHAR(64) NULL"},
	{"StageRequirement", "fieldKey", "VARCHAR(40) NULL"}, // D41: qual dado a tarefa de campo exige (cnpj, cpf, email, phone)
}

func ensureWorkflowColumns() {
	for _, c := range workflowColumns {
		ok, err := columnExists(c.table, c.col)
		if err != nil {
			log.Fatalf("❌ Funis: não consegui ler %s.%s: %v", c.table, c.col, err)
		}
		if ok {
			continue
		}
		if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", c.table, c.col, c.ddl)); err != nil {
			log.Fatalf("❌ Funis: não consegui adicionar %s.%s: %v", c.table, c.col, err)
		}
	}
	if err := backfillOpportunityPipelines(); err != nil {
		log.Println("⚠️ Funis: backfill de Opportunity.pipelineId falhou (as contagens usam a etapa):", err)
	}
}

// backfillOpportunityPipelines grava o funil nas oportunidades que ainda não têm, a partir do id da etapa.
// Idempotente. Valores antigos (INBOUND, WON…) não dizem de que funil são: ficam nulos e as contagens os
// atribuem ao primeiro funil ativo, como o admin faz (stages.ts).
func backfillOpportunityPipelines() error {
	rows, err := db.Query(`SELECT DISTINCT o.stage, s.pipelineId FROM Opportunity o JOIN PipelineStage s ON s.id = o.stage WHERE o.pipelineId IS NULL`)
	if err != nil {
		return err
	}
	type pair struct{ stage, pipeline string }
	var todo []pair
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.stage, &p.pipeline); err != nil {
			rows.Close()
			return err
		}
		todo = append(todo, p)
	}
	rows.Close()
	for _, p := range todo {
		if _, err := db.Exec(`UPDATE Opportunity SET pipelineId = ? WHERE pipelineId IS NULL AND stage = ?`, p.pipeline, p.stage); err != nil {
			return err
		}
	}
	return nil
}

// splitStatements separa o script em instruções (cada CREATE termina em ";" no fim da linha).
func splitStatements(sqlText string) []string {
	var out []string
	for _, s := range strings.Split(sqlText, ";\n") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

var idCounter atomic.Uint64

// wfID gera ids únicos mesmo em laços rápidos (nanossegundo + contador).
func wfID(prefix string) string {
	return fmt.Sprintf("%s-%d%d", prefix, time.Now().UnixNano(), idCounter.Add(1)%1000)
}

// registerWorkflowRoutes só é chamada com WORKFLOW_API=1.
func registerWorkflowRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/pipelines", enableCORS(handlePipelines))
	mux.HandleFunc("/api/pipelines/{id}", enableCORS(handlePipelineByID))
	mux.HandleFunc("/api/tasks", enableCORS(handleTasks))
	mux.HandleFunc("/api/tasks/{id}", enableCORS(handleTaskByID))
	mux.HandleFunc("/api/gate/check", enableCORS(handleGateCheck))
}
