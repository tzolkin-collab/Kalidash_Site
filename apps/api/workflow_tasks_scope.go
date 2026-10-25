package main

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

// ---- tarefas por dono (WP4-1, D19 e D36) ----
//
// Com AUTH_API=1, quem só tem os escopos "own" (leads:own / opportunities:own, o Vendedor) e não tem leads:read
// vê em /api/tasks APENAS as tarefas atribuídas a ele (assigneeMemberId) ou ligadas a oportunidades e leads em que
// é o responsável (ownerMemberId). As dos outros são 404, como as oportunidades dos outros (own_scope.go). Gerente,
// Admin, tokens e o modo sem login enxergam tudo. Tarefas de pessoa/empresa só aparecem ao Vendedor se atribuídas a ele.

// taskOwnRestriction devolve (id da pessoa, true) quando esta chamada só pode ver as tarefas dela.
func taskOwnRestriction(r *http.Request) (string, bool) {
	if !authEnabled() {
		return "", false
	}
	m, ok := principalOf(r)
	if !ok || hasScope(m.Scopes, "leads:read") {
		return "", false
	}
	if hasScope(m.Scopes, "leads:own") || hasScope(m.Scopes, "opportunities:own") {
		return m.ID, true
	}
	return "", false
}

// taskOwnClause é o trecho de WHERE (sobre a tabela Task) que deixa passar só o que é da pessoa. O responsável do
// registro (ownerMemberId) só existe com CRM_API=1; sem ele resta a atribuição direta.
func taskOwnClause(me string) (string, []any) {
	parts := []string{`assigneeMemberId = ?`}
	args := []any{me}
	if crmEnabled() {
		parts = append(parts,
			`(entityKind = 'opportunity' AND entityId IN (SELECT id FROM Opportunity WHERE ownerMemberId = ?))`,
			`(entityKind = 'lead' AND entityId IN (SELECT id FROM `+leadTbl+` WHERE ownerMemberId = ?))`)
		args = append(args, me, me)
	}
	return `(` + strings.Join(parts, ` OR `) + `)`, args
}

// taskEntityAllowed: para criar tarefa (ou consultar o gate) num registro, o Vendedor precisa ser o responsável dele
// quando o registro é uma oportunidade ou um lead; nos demais tipos não há dono e passa.
func taskEntityAllowed(r *http.Request, kind, id string) bool {
	me, restricted := taskOwnRestriction(r)
	if !restricted || !crmEnabled() {
		return true
	}
	var owner sql.NullString
	var err error
	switch kind {
	case "opportunity":
		err = db.QueryRow(`SELECT ownerMemberId FROM Opportunity WHERE id = ?`, id).Scan(&owner)
	case "lead":
		err = db.QueryRow(`SELECT ownerMemberId FROM `+leadTbl+` WHERE id = ?`, id).Scan(&owner)
	default:
		return true
	}
	return err == nil && owner.Valid && owner.String == me
}

// ---- concluir tarefa de campo (B-03e) ----

// fieldGap diz o que falta para concluir a tarefa de um requisito FIELD: "" quando pode (campo preenchido, requisito
// ACTION, ou campo que o servidor não sabe conferir) e a mensagem para a pessoa quando o campo está vazio.
//
// O requisito não guarda a chave do campo (só o título), então o servidor reconhece o campo pelo título:
// "CNPJ" → CNPJ da empresa do registro; "CPF" → CPF da pessoa; "e-mail" → e-mail; "telefone"/"celular"/"WhatsApp" →
// telefone. Qualquer outro título FIELD continua livre (⚠️: ver o relatório do WP4-1). Só vale com CRM_API=1 (os
// campos moram nas tabelas do CRM).
func fieldGap(requirementID, entityKind, entityID string) (string, error) {
	var kind, label string
	err := db.QueryRow(`SELECT kind, label FROM StageRequirement WHERE id = ?`, requirementID).Scan(&kind, &label)
	if errors.Is(err, sql.ErrNoRows) || kind != "FIELD" || !crmEnabled() {
		return "", nil
	} else if err != nil {
		return "", err
	}
	l := strings.ToLower(label)
	switch {
	case strings.Contains(l, "cnpj"):
		company, err := companyOf(entityKind, entityID)
		if err != nil {
			return "", err
		}
		if company == "" {
			return "Vincule uma empresa ao registro e informe o CNPJ antes de concluir.", nil
		}
		var doc sql.NullString
		if err := db.QueryRow(`SELECT document FROM Company WHERE id = ?`, company).Scan(&doc); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return "", err
		}
		if strings.TrimSpace(doc.String) == "" {
			return "Informe o CNPJ da empresa antes de concluir esta tarefa.", nil
		}
	case strings.Contains(l, "cpf"):
		person, err := personOf(entityKind, entityID)
		if err != nil {
			return "", err
		}
		var doc sql.NullString
		if person != "" {
			if err := db.QueryRow(`SELECT documentHash FROM Contact WHERE id = ?`, person).Scan(&doc); err != nil && !errors.Is(err, sql.ErrNoRows) {
				return "", err
			}
		}
		if strings.TrimSpace(doc.String) == "" {
			return "Informe o CPF da pessoa antes de concluir esta tarefa.", nil
		}
	case strings.Contains(l, "e-mail") || strings.Contains(l, "email"):
		return contactFieldGap(entityKind, entityID, "email", "Informe o e-mail antes de concluir esta tarefa.")
	case strings.Contains(l, "telefone") || strings.Contains(l, "celular") || strings.Contains(l, "whatsapp"):
		return contactFieldGap(entityKind, entityID, "phone", "Informe o telefone antes de concluir esta tarefa.")
	}
	return "", nil
}

// companyOf: a empresa ligada ao registro ("" se não houver ou o tipo não tem empresa).
func companyOf(kind, id string) (string, error) {
	q := map[string]string{
		"company":     `SELECT id FROM Company WHERE id = ?`,
		"opportunity": `SELECT companyId FROM Opportunity WHERE id = ?`,
		"lead":        `SELECT companyId FROM ` + leadTbl + ` WHERE id = ?`,
		"person":      `SELECT companyId FROM Contact WHERE id = ?`,
	}[kind]
	return oneID(q, id)
}

// personOf: a pessoa ligada ao registro.
func personOf(kind, id string) (string, error) {
	q := map[string]string{
		"person":      `SELECT id FROM Contact WHERE id = ?`,
		"opportunity": `SELECT contactId FROM Opportunity WHERE id = ?`,
		"lead":        `SELECT personId FROM ` + leadTbl + ` WHERE id = ?`,
	}[kind]
	return oneID(q, id)
}

func oneID(q, id string) (string, error) {
	if q == "" {
		return "", nil
	}
	var v sql.NullString
	if err := db.QueryRow(q, id).Scan(&v); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	return v.String, nil
}

// contactFieldGap confere e-mail/telefone: no próprio lead, ou na pessoa ligada ao registro.
func contactFieldGap(kind, id, col, msg string) (string, error) {
	if kind == "lead" {
		var v sql.NullString
		if err := db.QueryRow(`SELECT `+col+` FROM `+leadTbl+` WHERE id = ?`, id).Scan(&v); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return "", err
		}
		if strings.TrimSpace(v.String) != "" {
			return "", nil
		}
	}
	person, err := personOf(kind, id)
	if err != nil {
		return "", err
	}
	if person != "" {
		var v sql.NullString
		if err := db.QueryRow(`SELECT `+col+` FROM Contact WHERE id = ?`, person).Scan(&v); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return "", err
		}
		if strings.TrimSpace(v.String) != "" {
			return "", nil
		}
	}
	if kind != "lead" && kind != "person" && kind != "opportunity" {
		return "", nil // empresa/funil: não há e-mail/telefone de pessoa para conferir
	}
	return msg, nil
}
