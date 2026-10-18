package main

import (
	"net/http"
)

// Regras de perfil que dependem do conteúdo do pedido (a tabela por rota está em routeAccess).
// Espelham apps/admin/src/lib/permissions.ts. Sem AUTH_API=1 nenhuma delas age.

// canWriteDocument (revealCpf): só Admin/Gerente enviam um CPF novo. O que a API devolve é
// mascarado e reenviá-lo não muda nada, então o Vendedor continua salvando a pessoa normalmente.
func canWriteDocument(w http.ResponseWriter, r *http.Request, document string) bool {
	if document == "" || isMasked(document) {
		return true
	}
	return requireManagerFor(w, r, "alterar o CPF")
}

// canChangeOrigin (editOrigin): origem e fonte de um lead existente só mudam por Admin/Gerente.
func canChangeOrigin(w http.ResponseWriter, r *http.Request, l *LeadDTO) bool {
	if !authEnabled() {
		return true
	}
	if m, ok := principalOf(r); ok && isManager(m.Role) {
		return true
	}
	cur, err := getLeadRecord(l.ID)
	if err != nil {
		return true // inexistente ou erro: o fluxo normal responde (404/500)
	}
	if cur.Origin != l.Origin || cur.SourceName != l.SourceName {
		writeAuthErr(w, http.StatusForbidden, "só Admin e Gerente podem trocar a origem do lead")
		return false
	}
	return true
}
