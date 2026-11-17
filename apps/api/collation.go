package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"time"
)

// collation.go: as tabelas que a API cria (CREATE TABLE ... DEFAULT CHARSET=utf8mb4, sem COLLATE) nascem com a
// collation padrão do servidor, que no MySQL 8 é utf8mb4_0900_ai_ci. As tabelas do Prisma (Opportunity, Contact,
// Company, User) usam utf8mb4_unicode_ci. Comparar colunas das duas num JOIN, IN ou "=" dá
// "Error 1267: Illegal mix of collations" (17/11/2026: GET /api/leads com login, Opportunity.ownerMemberId = TeamMember.id).
//
// alignCollations converte, na subida, as tabelas da API para a collation de Opportunity. É idempotente: só mexe em
// tabela que existe e está com outra collation. Uma falha não derruba a API, só fica no log.

// collationRef é a tabela do Prisma cuja collation as tabelas da API seguem.
const collationRef = "Opportunity"

// apiTables: tabelas criadas pela própria API (CREATE TABLE IF NOT EXISTS nos ensure*Schema).
var apiTables = []string{
	"Pipeline", "PipelineStage", "StageRequirement", "Task", // workflow_schema.go
	"CompanyStakeholder", "Lead", "ChangeLog", // crm_schema.go
	"TeamMember", "AuthSession", "ApiToken", // auth_store.go
	"ConnectedProject", "TrackedForm", // connect_projects.go
	"Article", "BlogSettings", "BlogCategory", // blog.go
	"TrackingEvent", // tracking.go
}

var collationName = regexp.MustCompile(`^[a-z0-9_]+$`)

// tablesToAlign devolve, na ordem de apiTables, as tabelas existentes com collation diferente de ref.
func tablesToAlign(ref string, current map[string]string) []string {
	var out []string
	for _, t := range apiTables {
		if c, ok := current[t]; ok && c != "" && c != ref {
			out = append(out, t)
		}
	}
	return out
}

func alignCollations() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	var ref, charset string
	err := db.QueryRowContext(ctx, `SELECT t.TABLE_COLLATION, c.CHARACTER_SET_NAME
		FROM information_schema.TABLES t JOIN information_schema.COLLATIONS c ON c.COLLATION_NAME = t.TABLE_COLLATION
		WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ?`, collationRef).Scan(&ref, &charset)
	if err == sql.ErrNoRows {
		return // banco sem as tabelas do Prisma: nada para seguir
	}
	if err != nil {
		log.Printf("⚠️ Collation: não consegui ler a de %s: %v", collationRef, err)
		return
	}
	if !collationName.MatchString(ref) || !collationName.MatchString(charset) {
		log.Printf("⚠️ Collation: nome inesperado em %s (%q/%q), nada alterado", collationRef, charset, ref)
		return
	}

	rows, err := db.QueryContext(ctx, `SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`)
	if err != nil {
		log.Printf("⚠️ Collation: não consegui listar as tabelas: %v", err)
		return
	}
	current := map[string]string{}
	for rows.Next() {
		var name string
		var coll sql.NullString
		if err := rows.Scan(&name, &coll); err == nil {
			current[name] = coll.String
		}
	}
	rows.Close()

	todo := tablesToAlign(ref, current)
	if len(todo) == 0 {
		return
	}

	// Uma conexão só: as chaves estrangeiras (AuthSession -> TeamMember, PipelineStage -> Pipeline) exigem a mesma
	// collation dos dois lados, então a checagem fica desligada enquanto as duas pontas são convertidas.
	conn, err := db.Conn(ctx)
	if err != nil {
		log.Printf("⚠️ Collation: sem conexão: %v", err)
		return
	}
	defer conn.Close()
	if _, err := conn.ExecContext(ctx, "SET FOREIGN_KEY_CHECKS = 0"); err != nil {
		log.Printf("⚠️ Collation: não consegui desligar a checagem de chaves: %v", err)
		return
	}
	defer conn.ExecContext(context.Background(), "SET FOREIGN_KEY_CHECKS = 1")

	for _, t := range todo {
		stmt := fmt.Sprintf("ALTER TABLE `%s` CONVERT TO CHARACTER SET %s COLLATE %s", t, charset, ref)
		if _, err := conn.ExecContext(ctx, stmt); err != nil {
			log.Printf("⚠️ Collation: %s ficou em %s: %v", t, current[t], err)
			continue
		}
		log.Printf("✅ Collation: %s %s -> %s", t, current[t], ref)
	}
}
