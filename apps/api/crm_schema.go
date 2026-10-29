package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

// API de pessoas, empresas e leads (docs/plano-schema.md §3 e §4, recorte do que o admin usa:
// Person, Company e Lead de apps/admin/src/domain.ts). DESLIGADA por padrão: com CRM_API=1 a API
//   - acrescenta colunas às tabelas Contact (pessoa) e Company, que já existem. Só ADD COLUMN e
//     índice único, nada é alterado nem apagado; linhas antigas continuam valendo;
//   - cria CompanyStakeholder e Lead.
// Também cria ChangeLog, o histórico de mudanças (só-acréscimo; crm_history.go).
// Sem a variável a API não toca no banco nem expõe as rotas. Faça backup antes de ligar.

func crmEnabled() bool { return os.Getenv("CRM_API") == "1" }

type colSpec struct{ table, col, ddl string }

// Colunas novas de Contact (pessoa) e Company, todas com padrão ou NULL.
var crmColumns = []colSpec{
	{"Contact", "role", "VARCHAR(120) NULL"},
	{"Contact", "lifecycle", "VARCHAR(12) NOT NULL DEFAULT 'LEAD'"},
	{"Contact", "legacyClient", "TINYINT(1) NOT NULL DEFAULT 0"},
	{"Contact", "inactiveReason", "VARCHAR(255) NULL"},
	{"Contact", "firstWonAt", "DATETIME NULL"},
	{"Contact", "lgpdBasis", "VARCHAR(120) NULL"},
	{"Contact", "lgpdAt", "DATETIME NULL"},
	{"Contact", "documentEnc", "TEXT NULL"},
	{"Contact", "documentHash", "VARCHAR(64) NULL"},
	{"Contact", "tags", "JSON NULL"},
	{"Contact", "extra", "JSON NULL"},
	{"Contact", "archivedAt", "DATETIME NULL"},
	{"Contact", "createdAt", "DATETIME NULL"},
	{"Contact", "updatedAt", "DATETIME NULL"},

	{"Company", "legalName", "VARCHAR(255) NULL"},
	{"Company", "document", "VARCHAR(14) NULL"},
	{"Company", "defaultContactId", "VARCHAR(64) NULL"},
	{"Company", "lifecycle", "VARCHAR(12) NOT NULL DEFAULT 'LEAD'"},
	{"Company", "segment", "VARCHAR(120) NOT NULL DEFAULT ''"},
	{"Company", "sizeRange", "VARCHAR(40) NULL"},
	{"Company", "city", "VARCHAR(120) NULL"},
	{"Company", "state", "VARCHAR(2) NULL"},
	{"Company", "legacyClient", "TINYINT(1) NOT NULL DEFAULT 0"},
	{"Company", "inactiveReason", "VARCHAR(255) NULL"},
	{"Company", "firstWonAt", "DATETIME NULL"},
	{"Company", "extra", "JSON NULL"},
	{"Company", "archivedAt", "DATETIME NULL"},
	{"Company", "createdAt", "DATETIME NULL"},
	{"Company", "updatedAt", "DATETIME NULL"},
}

// Responsável como pessoa da equipe (TeamMember.id), WP3b. A coluna Opportunity.ownerId aponta para a tabela
// User do Prisma (com chave estrangeira), que não é a equipe do login, então o vínculo novo é outra coluna.
var crmOwnerColumns = []colSpec{
	{"Opportunity", "ownerMemberId", "VARCHAR(64) NULL"},
	{leadTbl, "ownerMemberId", "VARCHAR(64) NULL"},
	// WP4-2 (D28): motivo de perda da oportunidade (lista do funil + "Outro" com nota) e a nota do descarte do lead.
	{"Opportunity", "lostReason", "VARCHAR(120) NULL"},
	{"Opportunity", "lostReasonNote", "VARCHAR(500) NULL"},
	{leadTbl, "discardNote", "VARCHAR(500) NULL"},
}

var crmIndexes = []struct{ name, table, col string }{
	{"uq_contact_dochash", "Contact", "documentHash"},
	{"uq_company_document", "Company", "document"},
}

const crmTables = `
CREATE TABLE IF NOT EXISTS CompanyStakeholder (
	companyId VARCHAR(64) NOT NULL,
	personId VARCHAR(64) NOT NULL,
	description VARCHAR(255) NOT NULL DEFAULT '',
	tag VARCHAR(80) NOT NULL DEFAULT '',
	position INT NOT NULL DEFAULT 0,
	PRIMARY KEY (companyId, personId),
	INDEX idx_stakeholder_person (personId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ` + leadTbl + ` (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	email VARCHAR(255) NOT NULL DEFAULT '',
	phone VARCHAR(40) NULL,
	personId VARCHAR(64) NULL,
	companyId VARCHAR(64) NULL,
	pipelineId VARCHAR(64) NOT NULL,
	stageId VARCHAR(128) NOT NULL,
	origin VARCHAR(8) NOT NULL,
	sourceName VARCHAR(255) NOT NULL DEFAULT '',
	owner VARCHAR(120) NULL,
	estimatedValue DECIMAL(14,2) NULL,
	expectedCloseAt DATETIME NULL,
	tags JSON NULL,
	message TEXT NULL,
	status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
	discardReason VARCHAR(255) NULL,
	wasSeen TINYINT(1) NOT NULL DEFAULT 0,
	firstContactAt DATETIME NULL,
	convertedOpportunityId VARCHAR(64) NULL,
	returningClient TINYINT(1) NOT NULL DEFAULT 0,
	customData JSON NULL,
	archivedAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	INDEX idx_lead_pipeline (pipelineId, stageId, status),
	INDEX idx_lead_person (personId),
	INDEX idx_lead_company (companyId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ChangeLog (
	id VARCHAR(64) PRIMARY KEY,
	at DATETIME(3) NOT NULL,
	actor VARCHAR(120) NOT NULL,
	entity VARCHAR(16) NOT NULL,
	entityId VARCHAR(64) NOT NULL,
	entityName VARCHAR(255) NOT NULL DEFAULT '',
	kind VARCHAR(12) NOT NULL,
	field VARCHAR(120) NULL,
	fromValue TEXT NULL,
	toValue TEXT NULL,
	note TEXT NULL,
	ip VARCHAR(45) NULL,
	INDEX idx_log_entity (entity, entityId, at),
	INDEX idx_log_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

func columnExists(table, col string) (bool, error) {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, table, col).Scan(&n)
	return n > 0, err
}

func indexExists(table, name string) (bool, error) {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, table, name).Scan(&n)
	return n > 0, err
}

// ensureCRMSchema é idempotente. Falha alta (Fatal): com CRM_API=1 o operador pediu o recurso.
func ensureCRMSchema() {
	for _, c := range crmColumns {
		ok, err := columnExists(c.table, c.col)
		if err != nil {
			log.Fatalf("❌ CRM: não consegui ler %s.%s: %v", c.table, c.col, err)
		}
		if ok {
			continue
		}
		if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", c.table, c.col, c.ddl)); err != nil {
			log.Fatalf("❌ CRM: não consegui adicionar %s.%s: %v", c.table, c.col, err)
		}
	}
	for _, ix := range crmIndexes {
		ok, err := indexExists(ix.table, ix.name)
		if err != nil {
			log.Fatalf("❌ CRM: não consegui ler o índice %s: %v", ix.name, err)
		}
		if ok {
			continue
		}
		if _, err := db.Exec(fmt.Sprintf("CREATE UNIQUE INDEX %s ON %s (%s)", ix.name, ix.table, ix.col)); err != nil {
			log.Fatalf("❌ CRM: não consegui criar o índice %s: %v", ix.name, err)
		}
	}
	for _, stmt := range splitStatements(crmTables) {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("❌ CRM: erro ao criar tabelas: %v", err)
		}
	}
	for _, c := range crmOwnerColumns { // depois das tabelas: Lead nasce acima
		name := strings.Trim(c.table, "`")
		ok, err := columnExists(name, c.col)
		if err != nil {
			log.Fatalf("❌ CRM: não consegui ler %s.%s: %v", name, c.col, err)
		}
		if ok {
			continue
		}
		if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", c.table, c.col, c.ddl)); err != nil {
			log.Fatalf("❌ CRM: não consegui adicionar %s.%s: %v", name, c.col, err)
		}
	}
	if _, err := dataKey(); err != nil {
		log.Println("⚠️ CRM:", err, "— CPF de pessoas será recusado até configurar.")
	}
	log.Println("✅ Tabelas de pessoas, empresas e leads prontas (CRM_API=1)")
}

// registerCRMRoutes só é chamada com CRM_API=1. Prefixo /api/crm: /api/leads segue sendo as
// oportunidades (compatibilidade), então não há colisão.
func registerCRMRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/crm/people", enableCORS(handlePeople))
	mux.HandleFunc("/api/crm/people/{id}", enableCORS(handlePersonByID))
	mux.HandleFunc("/api/crm/people/{id}/document", enableCORS(handlePersonDocument))
	mux.HandleFunc("/api/crm/companies", enableCORS(handleCompanies))
	mux.HandleFunc("/api/crm/companies/{id}", enableCORS(handleCompanyByID))
	mux.HandleFunc("/api/crm/leads", enableCORS(handleCRMLeads))
	mux.HandleFunc("/api/crm/leads/{id}", enableCORS(handleCRMLeadByID))
	mux.HandleFunc("/api/crm/leads/{id}/qualify", enableCORS(handleQualifyLead))
	mux.HandleFunc("/api/crm/history", enableCORS(handleHistory))
}
