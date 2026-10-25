package main

import "testing"

// Escopos "own" (WP3b, D4), sem banco: o catálogo, os presets e o que abre as rotas de leads.

func TestEscopoOwnNoCatalogoEPresets(t *testing.T) {
	for _, id := range []string{"leads:own", "opportunities:own"} {
		d, ok := scopeIndex[id]
		if !ok || !d.HumanOnly {
			t.Errorf("%s deve existir e ser só de pessoas (token não tem 'dono'): %+v", id, d)
		}
		if !hasScope(sellerScopes, id) || !hasScope(managerScopes, id) {
			t.Errorf("%s deve estar nos presets do Vendedor e (por herança) do Gerente", id)
		}
	}
	for _, id := range []string{"leads:read", "leads:write"} {
		if hasScope(sellerScopes, id) {
			t.Errorf("o Vendedor não tem mais %s: vê só o que é dele", id)
		}
		if !hasScope(managerScopes, id) {
			t.Errorf("o Gerente continua vendo tudo (%s)", id)
		}
	}
}

func TestScopeSatisfiedAbreLeadsSoPeloOwnDaArea(t *testing.T) {
	cases := []struct {
		have  []string
		scope string
		path  string
		want  bool
	}{
		{[]string{"opportunities:own"}, "leads:read", "/api/leads", true},
		{[]string{"opportunities:own"}, "leads:write", "/api/leads/move", true},
		{[]string{"opportunities:own"}, "leads:read", "/api/crm/leads", false}, // o "own" de oportunidades não abre os leads v2
		{[]string{"leads:own"}, "leads:read", "/api/crm/leads/l1", true},
		{[]string{"leads:own"}, "leads:read", "/api/leads", false},
		{[]string{"leads:read"}, "leads:read", "/api/leads", true},
		{[]string{"leads:own"}, "people:read", "/api/crm/people", false}, // "own" só vale para leads e oportunidades
		{nil, "leads:read", "/api/leads", false},
	}
	for _, c := range cases {
		if got := scopeSatisfied(c.have, c.scope, c.path); got != c.want {
			t.Errorf("scopeSatisfied(%v, %s, %s) = %v, queria %v", c.have, c.scope, c.path, got, c.want)
		}
	}
}

func TestOwnScopeNaoVaiParaToken(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	for _, sc := range []string{"leads:own", "opportunities:own"} {
		if _, rec := e.newToken(adm, `{"name":"x","scopes":["`+sc+`"]}`); rec.Code != 422 {
			t.Errorf("token com %s: %d, queria 422", sc, rec.Code)
		}
	}
}

// Sem login ligado ninguém é restringido.
func TestOwnRestrictionSemAuthNaoRestringe(t *testing.T) {
	t.Setenv("AUTH_API", "")
	if me, restricted := ownRestriction(nil, "leads", false); restricted || me != "" {
		t.Errorf("sem AUTH_API não há restrição: %q %v", me, restricted)
	}
}
