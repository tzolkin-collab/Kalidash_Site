package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// Escopos, perfis como presets e tokens de API (auth_scopes.go, auth_tokens.go). Sem banco: authStore e
// tokenStore em memória (setupAuth). O SQL real está em auth_integration_test.go.

func TestCatalogoEPresets(t *testing.T) {
	seen := map[string]bool{}
	for _, s := range scopeCatalog {
		if seen[s.ID] {
			t.Errorf("escopo repetido: %s", s.ID)
		}
		seen[s.ID] = true
		if !strings.Contains(s.ID, ":") || s.Label == "" || s.Desc == "" || !hasScope(scopeGroups, s.Group) {
			t.Errorf("escopo mal descrito: %+v", s)
		}
	}
	for role := range validRoles {
		for _, s := range presetScopes(role) {
			if !validScope(s) {
				t.Errorf("preset %s com escopo fora do catálogo: %s", role, s)
			}
		}
	}
	if len(presetScopes(roleAdmin)) != len(scopeCatalog) {
		t.Error("o Admin deve ter todos os escopos")
	}
	// hierarquia: Vendedor ⊂ Gerente ⊂ Admin
	for _, s := range sellerScopes {
		if !hasScope(managerScopes, s) {
			t.Errorf("Gerente deveria ter %s do Vendedor", s)
		}
	}
	for _, s := range managerScopes {
		if !hasScope(presetScopes(roleAdmin), s) {
			t.Errorf("Admin deveria ter %s do Gerente", s)
		}
	}
	// o que era só de Admin/Gerente continua fora do Vendedor
	for _, s := range []string{"people:document", "leads:origin", "pipelines:manage", "blog:read", "blog:write", "team:manage", "keys:manage"} {
		if hasScope(sellerScopes, s) {
			t.Errorf("Vendedor não deveria ter %s", s)
		}
	}
	if hasScope(managerScopes, "team:manage") {
		t.Error("equipe continua só do Admin")
	}
	if presetScopes("INVENTADO") != nil || len(effectiveScopes("INVENTADO", nil, nil, false)) != 0 {
		t.Error("perfil desconhecido não tem escopo")
	}
}

func TestEfetivosSomamExtrasETiramRemovidos(t *testing.T) {
	got := effectiveScopes(roleSeller, []string{"blog:write", "inventado"}, []string{"emails:send"}, false)
	if !hasScope(got, "blog:write") || hasScope(got, "emails:send") || hasScope(got, "inventado") || !hasScope(got, "leads:own") || hasScope(got, "leads:read") {
		t.Errorf("efetivos do vendedor: %v", got)
	}
	if all := effectiveScopes(roleSeller, nil, allScopeIDs(), true); len(all) != len(scopeCatalog) {
		t.Errorf("a conta raiz sempre tem todos, mesmo com removidos: %v", all)
	}
}

// Cada linha: o escopo que a rota exige. É a tabela única de routeScope posta à prova.
func TestRotaExigeEscopo(t *testing.T) {
	cases := []struct{ method, path, scope string }{
		{"GET", "/api/leads", "leads:read"}, {"POST", "/api/leads", "leads:write"}, {"POST", "/api/leads/move", "leads:write"},
		{"GET", "/api/leads/notes", "leads:read"}, {"GET", "/api/crm/leads", "leads:read"}, {"PUT", "/api/crm/leads/l1", "leads:write"},
		{"GET", "/api/crm/people", "people:read"}, {"POST", "/api/crm/people", "people:write"}, {"DELETE", "/api/crm/people/p1", "people:write"},
		{"GET", "/api/crm/companies", "people:read"}, {"PUT", "/api/crm/companies/c1", "people:write"},
		{"GET", "/api/crm/people/p1/document", "people:document"},
		{"GET", "/api/crm/history", "history:read"}, {"POST", "/api/crm/history", "history:write"},
		{"GET", "/api/pipelines", "pipelines:read"}, {"POST", "/api/pipelines", "pipelines:manage"}, {"DELETE", "/api/pipelines/f1", "pipelines:manage"},
		{"GET", "/api/tasks", "tasks:read"}, {"POST", "/api/tasks", "tasks:write"}, {"POST", "/api/gate/check", "tasks:read"},
		{"GET", "/api/blog/articles", "blog:read"}, {"POST", "/api/blog/articles", "blog:write"}, {"POST", "/api/blog/upload", "blog:write"},
		{"POST", "/api/emails/send", "emails:send"},
		{"GET", "/api/team", "team:read"}, {"POST", "/api/team", "team:manage"}, {"PUT", "/api/team/x", "team:manage"},
		{"GET", "/api/tokens", "keys:manage"}, {"POST", "/api/tokens", "keys:manage"}, {"DELETE", "/api/tokens/x", "keys:manage"},
		{"GET", "/api/projects", "keys:manage"}, {"POST", "/api/projects", "keys:manage"}, {"PUT", "/api/projects/p1", "keys:manage"},
		{"POST", "/api/projects/p1/forms", "keys:manage"}, {"DELETE", "/api/projects/p1/forms/f1", "keys:manage"},
	}
	used := map[string]bool{}
	for _, c := range cases {
		sc, pub := routeScope(httptest.NewRequest(c.method, c.path, nil))
		if pub || sc != c.scope {
			t.Errorf("%s %s: escopo %q (público=%v), queria %q", c.method, c.path, sc, pub, c.scope)
		}
		used[c.scope] = true
	}
	for _, s := range scopeCatalog {
		if !used[s.ID] && !s.Reserved && s.ID != "leads:origin" && s.ID != "forms:write" && s.ID != "leads:own" && s.ID != "opportunities:own" { // leads:origin é checado no handler (canChangeOrigin); leads:own e opportunities:own abrem as rotas de leads_read/write só para os registros dela (own_scope.go, TestEscopoOwn...); forms:write, em connect_ingest.go (a rota é pública e autentica pelo token)
			t.Errorf("o escopo %s não protege nenhuma rota (marque Reserved se for gancho)", s.ID)
		}
	}
	for _, c := range [][2]string{{"POST", "/api/public/leads"}, {"POST", "/api/connect/leads"}, {"GET", "/api/connect/config"}, {"OPTIONS", "/api/connect/leads"}, {"GET", "/connect.js"}, {"GET", "/api/blog/article"}, {"GET", "/api/blog/settings"}, {"GET", "/api/blog/articles?published=true"}, {"GET", "/auth/me"}} {
		if _, pub := routeScope(httptest.NewRequest(c[0], c[1], nil)); !pub {
			t.Errorf("%s %s deveria seguir pública", c[0], c[1])
		}
	}
	if sc, pub := routeScope(httptest.NewRequest("GET", "/api/desconhecida", nil)); sc != "" || pub {
		t.Errorf("rota sem mapa: %q %v", sc, pub)
	}
}

// 401 sem sessão e, para cada escopo, 403 quando falta e passa quando só ele existe.
func TestCadaEscopoAbreSoSuaRota(t *testing.T) {
	e := setupAuth(t)
	e.member("adm@kalidash.test", roleAdmin)
	probes := []struct{ method, path, scope string }{
		{"GET", "/api/leads", "leads:read"}, {"POST", "/api/leads", "leads:write"},
		{"GET", "/api/crm/people", "people:read"}, {"POST", "/api/crm/people", "people:write"},
		{"GET", "/api/crm/people/p1/document", "people:document"},
		{"GET", "/api/crm/history", "history:read"}, {"POST", "/api/crm/history", "history:write"},
		{"GET", "/api/pipelines", "pipelines:read"}, {"POST", "/api/pipelines", "pipelines:manage"},
		{"GET", "/api/tasks", "tasks:read"}, {"POST", "/api/tasks", "tasks:write"},
		{"GET", "/api/blog/articles", "blog:read"}, {"POST", "/api/blog/articles", "blog:write"},
		{"POST", "/api/emails/send", "emails:send"}, {"GET", "/api/team", "team:read"},
		{"GET", "/api/tokens", "keys:manage"},
	}
	for i, p := range probes {
		if rec := e.do(p.method, p.path, nil, nil, ""); rec.Code != 401 {
			t.Errorf("%s %s sem sessão: %d", p.method, p.path, rec.Code)
		}
		// pessoa só com ESTE escopo: Vendedor sem nenhum do preset + extra
		m := e.member("so"+string(rune('a'+i))+"@x.test", roleSeller)
		var denied []string
		for _, sc := range sellerScopes {
			if sc != p.scope {
				denied = append(denied, sc)
			}
		}
		m, err := e.store.SetMemberScopes(m.ID, []string{p.scope}, denied)
		if err != nil {
			t.Fatal(err)
		}
		if len(m.Scopes) != 1 || m.Scopes[0] != p.scope {
			t.Fatalf("esperava só %s, veio %v", p.scope, m.Scopes)
		}
		ck := e.login(m)
		if rec := e.do(p.method, p.path, ck, nil, ""); rec.Code == 401 || rec.Code == 403 {
			t.Errorf("%s %s só com %s: %d, deveria passar", p.method, p.path, p.scope, rec.Code)
		}
		for _, other := range probes {
			if other.scope != p.scope {
				if rec := e.do(other.method, other.path, ck, nil, ""); rec.Code != 403 {
					t.Errorf("%s %s com só %s: %d, queria 403", other.method, other.path, p.scope, rec.Code)
				}
			}
		}
	}
}

func TestExtrasERemovidosValemNaHora(t *testing.T) {
	e := setupAuth(t)
	adm := e.member("adm@kalidash.test", roleAdmin)
	ven := e.member("ven@kalidash.test", roleSeller)
	ck, admCk := e.login(ven), e.login(adm)
	if rec := e.do("GET", "/api/blog/articles", ck, nil, ""); rec.Code != 403 {
		t.Fatalf("vendedor sem blog:read: %d", rec.Code)
	}
	rec := e.do("PUT", "/api/team/"+ven.ID, admCk, nil, `{"scopesExtra":["blog:read"],"scopesDenied":["emails:send"]}`)
	if rec.Code != 200 {
		t.Fatalf("conceder: %d %s", rec.Code, rec.Body)
	}
	var got Member
	json.Unmarshal(rec.Body.Bytes(), &got)
	if !hasScope(got.Scopes, "blog:read") || hasScope(got.Scopes, "emails:send") || got.Role != roleSeller {
		t.Errorf("efetivos: %v", got.Scopes)
	}
	if rec := e.do("GET", "/api/blog/articles", ck, nil, ""); rec.Code != 200 {
		t.Errorf("com blog:read: %d", rec.Code)
	}
	if rec := e.do("POST", "/api/emails/send", ck, nil, ""); rec.Code != 403 {
		t.Errorf("sem emails:send: %d", rec.Code)
	}
	if rec := e.do("POST", "/api/blog/articles", ck, nil, ""); rec.Code != 403 {
		t.Errorf("blog:read não escreve: %d", rec.Code)
	}
	// /auth/me devolve os escopos efetivos para o admin esconder o que daria 403
	rec = e.do("GET", "/auth/me", ck, nil, "")
	var me Member
	json.Unmarshal(rec.Body.Bytes(), &me)
	if !hasScope(me.Scopes, "blog:read") || hasScope(me.Scopes, "emails:send") {
		t.Errorf("/auth/me: %v", me.Scopes)
	}
	// voltar ao preset limpa tudo
	if rec := e.do("PUT", "/api/team/"+ven.ID, admCk, nil, `{"scopesExtra":[],"scopesDenied":[]}`); rec.Code != 200 {
		t.Fatalf("limpar: %d", rec.Code)
	}
	if rec := e.do("GET", "/api/blog/articles", ck, nil, ""); rec.Code != 403 {
		t.Errorf("depois de limpar: %d", rec.Code)
	}
}

func TestEdicaoDeEscoposRegras(t *testing.T) {
	e := setupAuth(t)
	t.Setenv("AUTH_ROOT_ADMIN", "root@kalidash.test")
	root := e.member("root@kalidash.test", roleAdmin)
	adm := e.member("adm@kalidash.test", roleAdmin)
	ger := e.member("ger@kalidash.test", roleManager)
	ven := e.member("ven@kalidash.test", roleSeller)
	rootCk, admCk, gerCk := e.login(root), e.login(adm), e.login(ger)
	put := func(ck *http.Cookie, id, body string) *httptest.ResponseRecorder {
		return e.do("PUT", "/api/team/"+id, ck, nil, body)
	}
	if rec := put(gerCk, ven.ID, `{"scopesExtra":["blog:read"]}`); rec.Code != 403 {
		t.Errorf("Gerente sem team:manage: %d", rec.Code)
	}
	if rec := put(admCk, ven.ID, `{"scopesExtra":["nao:existe"]}`); rec.Code != 422 {
		t.Errorf("escopo desconhecido: %d", rec.Code)
	}
	if rec := put(admCk, ven.ID, `{"scopesExtra":["blog:read"],"scopesDenied":["blog:read"]}`); rec.Code != 422 {
		t.Errorf("concedido e removido: %d", rec.Code)
	}
	if rec := put(admCk, adm.ID, `{"scopesDenied":["blog:read"]}`); rec.Code != 409 {
		t.Errorf("mexer nos próprios escopos: %d", rec.Code)
	}
	if rec := put(admCk, root.ID, `{"scopesDenied":["blog:read"]}`); rec.Code != 409 {
		t.Errorf("tirar escopo da conta raiz: %d", rec.Code)
	}
	if m, _ := e.store.MemberByID(root.ID); len(m.Scopes) != len(scopeCatalog) || !m.Root {
		t.Errorf("a raiz mantém todos: %v", m.Scopes)
	}
	// a raiz tem todos mesmo que o banco tenha removidos gravados à mão
	e.store.SetMemberScopes(root.ID, nil, []string{"blog:write"})
	if m, _ := e.store.MemberByID(root.ID); !hasScope(m.Scopes, "blog:write") {
		t.Error("raiz sem blog:write")
	}
	// normalização: extra que o preset já dá e removido que o preset não tem são descartados
	rec := put(rootCk, ven.ID, `{"scopesExtra":["people:read","blog:read"],"scopesDenied":["blog:write","emails:send"]}`)
	var got Member
	json.Unmarshal(rec.Body.Bytes(), &got)
	if rec.Code != 200 || len(got.Extra) != 1 || got.Extra[0] != "blog:read" || len(got.Denied) != 1 || got.Denied[0] != "emails:send" {
		t.Errorf("normalização: %d extra=%v denied=%v", rec.Code, got.Extra, got.Denied)
	}
	// ninguém concede o que não tem
	if rec := put(rootCk, adm.ID, `{"scopesDenied":["blog:write"]}`); rec.Code != 200 {
		t.Fatalf("raiz tirando blog:write do Admin: %d %s", rec.Code, rec.Body)
	}
	if rec := put(admCk, ven.ID, `{"scopesExtra":["blog:write"]}`); rec.Code != 403 {
		t.Errorf("conceder o que não tem: %d", rec.Code)
	}
	if rec := put(admCk, ven.ID, `{"role":"MANAGER"}`); rec.Code != 403 {
		t.Errorf("promover a Gerente dá blog:write que o promotor não tem: %d", rec.Code)
	}
	// convidar com escopos
	rec = e.do("POST", "/api/team", rootCk, nil, `{"email":"nova@kalidash.test","role":"SELLER","scopesExtra":["blog:read"]}`)
	json.Unmarshal(rec.Body.Bytes(), &got)
	if rec.Code != 201 || !hasScope(got.Scopes, "blog:read") {
		t.Errorf("convite com escopo: %d %s", rec.Code, rec.Body)
	}
	// trocar de perfil renormaliza: extra que o novo preset cobre some
	if rec := put(rootCk, ven.ID, `{"role":"MANAGER"}`); rec.Code != 200 {
		t.Fatalf("promover: %d %s", rec.Code, rec.Body)
	}
	if m, _ := e.store.MemberByID(ven.ID); len(m.Extra) != 0 || len(m.Denied) != 1 {
		t.Errorf("depois de virar Gerente: extra=%v denied=%v", m.Extra, m.Denied)
	}
}

func TestSemTeamManageNinguemSobra(t *testing.T) {
	e := setupAuth(t) // sem conta raiz
	a1 := e.member("a1@kalidash.test", roleAdmin)
	a2 := e.member("a2@kalidash.test", roleAdmin)
	c1, c2 := e.login(a1), e.login(a2)
	if rec := e.do("PUT", "/api/team/"+a2.ID, c1, nil, `{"scopesDenied":["team:manage"]}`); rec.Code != 200 {
		t.Fatalf("a1 tira team:manage de a2 (a1 ainda tem): %d %s", rec.Code, rec.Body)
	}
	if rec := e.do("PUT", "/api/team/"+a1.ID, c2, nil, `{"scopesDenied":["team:manage"]}`); rec.Code != 403 {
		t.Errorf("a2 sem team:manage: %d", rec.Code)
	}
	// a1 é o único com team:manage: desativar a2 (sem a permissão) pode; qualquer coisa que zere, não
	a3 := e.member("a3@kalidash.test", roleAdmin)
	if rec := e.do("PUT", "/api/team/"+a2.ID, c1, nil, `{"active":false}`); rec.Code != 200 {
		t.Errorf("desativar quem não gerencia: %d", rec.Code)
	}
	if rec := e.do("PUT", "/api/team/"+a3.ID, c1, nil, `{"role":"SELLER"}`); rec.Code != 200 {
		t.Errorf("rebaixar a3 (a1 segue gerenciando): %d", rec.Code)
	}
	if teamManagerRemains(a1.ID, roleAdmin, nil, []string{"team:manage"}, true) {
		t.Error("tirar team:manage do único que tem deveria ser recusado")
	}
	if teamManagerRemains(a1.ID, roleAdmin, nil, nil, false) {
		t.Error("desativar o único que tem team:manage deveria ser recusado")
	}
	if !teamManagerRemains(a1.ID, roleAdmin, nil, nil, true) {
		t.Error("sem mudança, segue havendo quem gerencie")
	}
}

func TestCatalogoNaAPI(t *testing.T) {
	e := setupAuth(t)
	if rec := e.do("GET", "/api/access/catalog", nil, nil, ""); rec.Code != 401 {
		t.Errorf("catálogo sem sessão: %d", rec.Code)
	}
	ck := e.login(e.member("ven@kalidash.test", roleSeller))
	rec := e.do("GET", "/api/access/catalog", ck, nil, "")
	var body struct {
		Groups  []string
		Scopes  []scopeDef
		Presets map[string][]string
	}
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &body) != nil || len(body.Scopes) != len(scopeCatalog) || len(body.Presets[roleSeller]) != len(sellerScopes) || len(body.Groups) == 0 {
		t.Errorf("catálogo: %d %s", rec.Code, rec.Body)
	}
}

// ---- tokens ----

type createdToken struct {
	Token string   `json:"token"`
	Meta  APIToken `json:"meta"`
}

func (e *authEnv) newToken(ck *http.Cookie, body string) (createdToken, *httptest.ResponseRecorder) {
	e.t.Helper()
	rec := e.do("POST", "/api/tokens", ck, nil, body)
	var out createdToken
	json.Unmarshal(rec.Body.Bytes(), &out)
	return out, rec
}

func (e *authEnv) bearer(token, method, path string) *httptest.ResponseRecorder {
	return e.do(method, path, nil, map[string]string{"Authorization": "Bearer " + token}, "")
}

func TestTokenCriacaoMostraSegredoUmaVez(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	tk, rec := e.newToken(adm, `{"name":"Zapier","scopes":["leads:read","leads:write","leads:read"]}`)
	if rec.Code != 201 || !strings.HasPrefix(tk.Token, "kld_live_") || len(tk.Token) < 30 {
		t.Fatalf("criar: %d %s", rec.Code, rec.Body)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Error("a resposta com o segredo não pode ser guardada em cache")
	}
	if tk.Meta.Prefix != tk.Token[:13] || tk.Meta.Last4 != tk.Token[len(tk.Token)-4:] || tk.Meta.Status != "ACTIVE" || tk.Meta.ExpiresAt != nil || len(tk.Meta.Scopes) != 2 {
		t.Errorf("ficha: %+v", tk.Meta)
	}
	// no armazenamento só o hash
	store := tokenDB.(*memTokens)
	if h := store.hashes[tk.Meta.ID]; h != hashAPIToken(tk.Token) || strings.Contains(h, tk.Token) || len(h) != 64 {
		t.Errorf("hash guardado: %q", h)
	}
	// a listagem nunca traz o segredo nem o hash
	rec = e.do("GET", "/api/tokens", adm, nil, "")
	if rec.Code != 200 || strings.Contains(rec.Body.String(), tk.Token) || strings.Contains(rec.Body.String(), hashAPIToken(tk.Token)) || !strings.Contains(rec.Body.String(), tk.Meta.Prefix) {
		t.Errorf("listagem: %d %s", rec.Code, rec.Body)
	}
	for body, want := range map[string]int{
		`{"name":"","scopes":["leads:read"]}`:                           422,
		`{"name":"x","scopes":[]}`:                                      422,
		`{"name":"x","scopes":["nao:existe"]}`:                          422,
		`{"name":"x","scopes":["team:manage"]}`:                         422,
		`{"name":"x","scopes":["keys:manage"]}`:                         422,
		`{"name":"x","scopes":["leads:read"],"expiresAt":"2020-01-01"}`: 422,
		`{"name":"x","scopes":["leads:read"],"expiresAt":"2999-01-01"}`: 201,
		`isto nao e json`: 400,
	} {
		if _, rec := e.newToken(adm, body); rec.Code != want {
			t.Errorf("%s: %d, queria %d (%s)", body, rec.Code, want, rec.Body)
		}
	}
}

func TestTokenNoBearerRespeitaEscopos(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	tk, _ := e.newToken(adm, `{"name":"Leitor","scopes":["leads:read","people:read"]}`)
	for _, c := range []struct {
		method, path string
		want         int
	}{
		{"GET", "/api/leads", 200}, {"GET", "/api/crm/people", 200},
		{"POST", "/api/leads", 403}, {"POST", "/api/crm/people", 403},
		{"GET", "/api/pipelines", 403}, {"GET", "/api/blog/articles", 403},
		{"GET", "/api/team", 403}, {"POST", "/api/team", 403}, {"GET", "/api/tokens", 403},
		{"GET", "/api/crm/people/p1/document", 403},
		{"GET", "/api/desconhecida", 403}, // rota sem escopo mapeado: token nunca passa
		{"GET", "/api/access/catalog", 403},
		{"GET", "/api/blog/articles?published=true", 200}, // pública
	} {
		if rec := e.bearer(tk.Token, c.method, c.path); rec.Code != c.want {
			t.Errorf("token %s %s: %d, queria %d", c.method, c.path, rec.Code, c.want)
		}
	}
	// quem escreve fica identificado como API: nome
	m, _, err := tokenPrincipal(httptest.NewRequest("GET", "/", nil), tk.Token)
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("GET", "/", nil)
	if got := actorFor(r.WithContext(withPrincipal(r.Context(), m)), "Falso"); got != "API: Leitor" {
		t.Errorf("autor do histórico: %q", got)
	}
}

func TestTokenInvalidoRevogadoExpirado(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	tk, _ := e.newToken(adm, `{"name":"A","scopes":["leads:read"]}`)
	for name, h := range map[string]string{
		"sem prefixo": "Bearer abc", "inventado": "Bearer kld_live_inventadoinventadoinventado1234", "vazio": "Bearer ", "esquema errado": "Basic " + tk.Token, "só o token": tk.Token,
	} {
		rec := e.do("GET", "/api/leads", nil, map[string]string{"Authorization": h}, "")
		if rec.Code != 401 || rec.Header().Get("WWW-Authenticate") == "" {
			t.Errorf("%s: %d", name, rec.Code)
		}
	}
	// cookie bom + token ruim: o cabeçalho manda, e é 401 (não cai na sessão)
	if rec := e.do("GET", "/api/leads", adm, map[string]string{"Authorization": "Bearer kld_live_ruim"}, ""); rec.Code != 401 {
		t.Errorf("token ruim com cookie bom: %d", rec.Code)
	}
	if rec := e.bearer(tk.Token, "GET", "/api/leads"); rec.Code != 200 {
		t.Fatalf("token válido: %d", rec.Code)
	}
	// revogação imediata
	if rec := e.do("DELETE", "/api/tokens/"+tk.Meta.ID, adm, nil, ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), "REVOKED") {
		t.Fatalf("revogar: %d %s", rec.Code, rec.Body)
	}
	if rec := e.bearer(tk.Token, "GET", "/api/leads"); rec.Code != 401 {
		t.Errorf("revogado: %d", rec.Code)
	}
	if rec := e.do("DELETE", "/api/tokens/"+tk.Meta.ID, adm, nil, ""); rec.Code != 200 {
		t.Errorf("revogar de novo é idempotente: %d", rec.Code)
	}
	if rec := e.do("DELETE", "/api/tokens/tk-naoexiste", adm, nil, ""); rec.Code != 404 {
		t.Errorf("revogar inexistente: %d", rec.Code)
	}
	// expiração opcional
	tk2, _ := e.newToken(adm, `{"name":"B","scopes":["leads:read"],"expiresAt":"2999-01-01"}`)
	if rec := e.bearer(tk2.Token, "GET", "/api/leads"); rec.Code != 200 {
		t.Fatalf("dentro da validade: %d", rec.Code)
	}
	store := tokenDB.(*memTokens)
	store.mu.Lock()
	for i := range store.list {
		if store.list[i].ID == tk2.Meta.ID {
			store.list[i].ExpiresAt = &FlexTime{time.Now().Add(-time.Minute)}
		}
	}
	store.mu.Unlock()
	if rec := e.bearer(tk2.Token, "GET", "/api/leads"); rec.Code != 401 {
		t.Errorf("expirado: %d", rec.Code)
	}
	list, _ := tokenDB.ListTokens()
	st := map[string]string{}
	for _, x := range list {
		st[x.Name] = x.Status
	}
	if st["A"] != "REVOKED" || st["B"] != "EXPIRED" {
		t.Errorf("status: %v", st)
	}
}

func TestTokenSemExpiracaoPorPadraoEUltimoUso(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	tk, _ := e.newToken(adm, `{"name":"Eterno","scopes":["leads:read"]}`)
	if tk.Meta.ExpiresAt != nil {
		t.Fatal("deveria nascer sem validade")
	}
	store := tokenDB.(*memTokens)
	store.mu.Lock()
	store.list[0].CreatedAt = FlexTime{time.Now().AddDate(-10, 0, 0)}
	store.mu.Unlock()
	if rec := e.bearer(tk.Token, "GET", "/api/leads"); rec.Code != 200 {
		t.Errorf("token de 10 anos sem validade: %d", rec.Code)
	}
	for i := 0; i < 3; i++ {
		e.bearer(tk.Token, "GET", "/api/leads")
	}
	if store.touch[tk.Meta.ID] != 1 {
		t.Errorf("o último uso grava no máximo 1x por minuto: %d", store.touch[tk.Meta.ID])
	}
	if list, _ := tokenDB.ListTokens(); list[0].LastUsedAt == nil {
		t.Error("último uso não gravado")
	}
	tokenDB.TouchToken(tk.Meta.ID, "1.2.3.4", time.Now().Add(2*time.Minute), time.Minute)
	if store.touch[tk.Meta.ID] != 2 {
		t.Errorf("passado o intervalo, grava de novo: %d", store.touch[tk.Meta.ID])
	}
}

func TestTokenNaoEscalaPrivilegio(t *testing.T) {
	e := setupAuth(t)
	e.member("adm@kalidash.test", roleAdmin)
	gerM := e.member("ger@kalidash.test", roleManager)
	ger := e.login(gerM)
	ven := e.login(e.member("ven@kalidash.test", roleSeller))
	if _, rec := e.newToken(ven, `{"name":"x","scopes":["leads:read"]}`); rec.Code != 403 {
		t.Errorf("Vendedor criando token: %d", rec.Code)
	}
	if rec := e.do("GET", "/api/tokens", ven, nil, ""); rec.Code != 403 {
		t.Errorf("Vendedor listando tokens: %d", rec.Code)
	}
	if _, rec := e.newToken(ger, `{"name":"ok","scopes":["blog:write","leads:read"]}`); rec.Code != 201 {
		t.Errorf("Gerente com escopos próprios: %d %s", rec.Code, rec.Body)
	}
	e.store.SetMemberScopes(gerM.ID, nil, []string{"blog:write"})
	if _, rec := e.newToken(ger, `{"name":"x","scopes":["blog:write"]}`); rec.Code != 403 {
		t.Errorf("Gerente sem blog:write dando blog:write: %d", rec.Code)
	}
}

func TestTokenEscopoHumanoNuncaVale(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	tk, _ := e.newToken(adm, `{"name":"x","scopes":["leads:read"]}`)
	// banco adulterado à mão com escopo humano: o servidor ignora
	store := tokenDB.(*memTokens)
	store.mu.Lock()
	store.list[0].Scopes = append(store.list[0].Scopes, "team:manage", "keys:manage")
	store.mu.Unlock()
	for _, c := range [][2]string{{"POST", "/api/team"}, {"GET", "/api/tokens"}, {"POST", "/api/tokens"}} {
		if rec := e.bearer(tk.Token, c[0], c[1]); rec.Code != 403 {
			t.Errorf("token com escopo humano %s %s: %d", c[0], c[1], rec.Code)
		}
	}
}

func TestTokenPublicoEOriginIntactos(t *testing.T) {
	e := setupAuth(t)
	if rec := e.do("POST", "/api/public/leads", nil, map[string]string{"Authorization": "Bearer lixo"}, ""); rec.Code != 201 {
		t.Errorf("captura pública com cabeçalho de lixo: %d", rec.Code)
	}
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	tk, _ := e.newToken(adm, `{"name":"x","scopes":["leads:write"]}`)
	rec := e.do("POST", "/api/leads", nil, map[string]string{"Authorization": "Bearer " + tk.Token, "Origin": "https://evil.test"}, "")
	if rec.Code != 403 {
		t.Errorf("token com Origin estranho: %d", rec.Code)
	}
	if rec := e.do("POST", "/api/leads", nil, map[string]string{"Authorization": "Bearer " + tk.Token}, ""); rec.Code != 200 {
		t.Errorf("servidor a servidor (sem Origin): %d", rec.Code)
	}
}
