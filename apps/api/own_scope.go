package main

import (
	"net/http"
	"strings"
)

// Escopos "own" (WP3b, D4): leads:own e opportunities:own. Quem tem só o "own" de uma área (e não o
// leads:read / leads:write dela) enxerga e edita APENAS os registros em que é o responsável
// (ownerMemberId = a pessoa da sessão). Quem tem leads:read/leads:write enxerga tudo, como sempre.
// Sem AUTH_API=1 nada disto age.

// ownScopeOf diz qual escopo "own" vale para uma rota: /api/crm/leads* é a área "leads" (Lead v2);
// /api/leads* é a área "opportunities" (oportunidades).
func ownScopeOf(path string) string {
	if strings.HasPrefix(path, "/api/crm/leads") {
		return "leads:own"
	}
	return "opportunities:own"
}

// scopeSatisfied: o escopo pedido pela rota, ou — nas rotas de leads e oportunidades — o "own" da área.
func scopeSatisfied(have []string, scope, path string) bool {
	if hasScope(have, scope) {
		return true
	}
	if scope == "leads:read" || scope == "leads:write" {
		return hasScope(have, ownScopeOf(path))
	}
	return false
}

// ownRestriction devolve (id da pessoa, true) quando esta chamada só pode tocar nos registros dela. area:
// "leads" ou "opportunities". write escolhe entre o escopo de escrita e o de leitura.
func ownRestriction(r *http.Request, area string, write bool) (string, bool) {
	if !authEnabled() {
		return "", false
	}
	m, ok := principalOf(r)
	if !ok {
		return "", false
	}
	full := "leads:read"
	if write {
		full = "leads:write"
	}
	if hasScope(m.Scopes, full) {
		return "", false
	}
	return m.ID, true // sem o escopo cheio: só o que é dela (o middleware já barrou quem não tem nem o "own")
}

// canTouchOpportunity: quem só enxerga as próprias oportunidades recebe 404 nas dos outros (notas, mover de
// etapa, e-mail), como se não existissem. Quem tem o escopo cheio, ou o login desligado, passa direto.
func canTouchOpportunity(w http.ResponseWriter, r *http.Request, oppID string, write bool) bool {
	me, restricted := ownRestriction(r, "opportunities", write)
	if !restricted {
		return true
	}
	owner, found, err := oppOwner(oppID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return false
	}
	if !found || owner != me {
		http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
		return false
	}
	return true
}
