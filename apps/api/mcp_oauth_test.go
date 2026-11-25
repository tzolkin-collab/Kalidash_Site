package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

// ---- armazenamento em memória (o SQL real é o mesmo contrato) ----

type memOAuth struct {
	mu      sync.Mutex
	clients map[string]oauthClient
	codes   map[string]*struct {
		c    oauthCode
		used bool
	}
	grants  map[string]*oauthGrant
	revoked map[string]bool
}

func newMemOAuth() *memOAuth {
	return &memOAuth{clients: map[string]oauthClient{}, codes: map[string]*struct {
		c    oauthCode
		used bool
	}{}, grants: map[string]*oauthGrant{}, revoked: map[string]bool{}}
}

func (s *memOAuth) CreateClient(c oauthClient) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clients[c.ID] = c
	return nil
}
func (s *memOAuth) Client(id string) (oauthClient, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.clients[id]
	if !ok {
		return c, errOAuthNotFound
	}
	return c, nil
}
func (s *memOAuth) CreateCode(c oauthCode) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.codes[c.Hash] = &struct {
		c    oauthCode
		used bool
	}{c: c}
	return nil
}
func (s *memOAuth) ConsumeCode(hash string, now time.Time) (oauthCode, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	x, ok := s.codes[hash]
	if !ok || x.used || !x.c.ExpiresAt.After(now) {
		return oauthCode{}, errOAuthNotFound
	}
	x.used = true
	return x.c, nil
}
func (s *memOAuth) fill(g oauthGrant) oauthGrant {
	c := s.clients[g.ClientID]
	g.ClientName, g.LogoURI, g.Domain = c.Name, c.LogoURI, c.Domain
	return g
}
func (s *memOAuth) CreateGrant(g oauthGrant) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.grants[g.ID] = &g
	return nil
}
func (s *memOAuth) GrantByAccess(hash string, now time.Time) (oauthGrant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, g := range s.grants {
		if g.AccessHash == hash && g.AccessExpiresAt.After(now) && !s.revoked[g.ID] {
			return s.fill(*g), nil
		}
	}
	return oauthGrant{}, errOAuthNotFound
}
func (s *memOAuth) RotateRefresh(old string, n oauthGrant, now time.Time) (oauthGrant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, g := range s.grants {
		if g.RefreshHash == old && g.RefreshExpiresAt.After(now) && !s.revoked[g.ID] {
			g.AccessHash, g.RefreshHash, g.AccessExpiresAt, g.RefreshExpiresAt = n.AccessHash, n.RefreshHash, n.AccessExpiresAt, n.RefreshExpiresAt
			return s.fill(*g), nil
		}
	}
	return oauthGrant{}, errOAuthNotFound
}
func (s *memOAuth) TouchGrant(id string, now time.Time) error { return nil }
func (s *memOAuth) ListGrants(now time.Time) ([]oauthGrant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []oauthGrant{}
	for _, g := range s.grants {
		if !s.revoked[g.ID] {
			out = append(out, s.fill(*g))
		}
	}
	return out, nil
}
func (s *memOAuth) RevokeGrant(id string, now time.Time) (oauthGrant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revoked[id] = true
	return *s.grants[id], nil
}

// ---- ambiente ----

type oauthEnv struct {
	t       *testing.T
	handler http.Handler
	person  Member
	cookie  string
}

func setupOAuth(t *testing.T) *oauthEnv {
	t.Helper()
	for k, v := range map[string]string{"AUTH_API": "1", "SESSION_SECRET": strings.Repeat("s", 40), "ALLOWED_ORIGINS": testAdminOrigin,
		"ADMIN_URL": testAdminOrigin, "PUBLIC_API_URL": testAPIOrigin} {
		t.Setenv(k, v)
	}
	store := newMemStore()
	oldDB, oldTok, oldOAuth, oldMux := authDB, tokenDB, oauthDB, mcpMux
	authDB, tokenDB, oauthDB = store, newMemTokens(), newMemOAuth()
	t.Cleanup(func() { authDB, tokenDB, oauthDB, mcpMux = oldDB, oldTok, oldOAuth, oldMux })
	person, err := store.AddMember(Member{Email: "gerente@kalidash.test", Name: "Gerente", Role: roleManager}, "")
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/mcp", handleMCP)
	mux.HandleFunc("/api/mcp/info", handleMCPInfo)
	mux.HandleFunc("/api/oauth/consent", handleOAuthConsent)
	mux.HandleFunc("/api/mcp/connections", handleMCPConnections)
	mux.HandleFunc("/api/mcp/connections/{id}", handleMCPConnectionByID)
	mux.HandleFunc("/.well-known/oauth-protected-resource", handleProtectedResourceMeta)
	mux.HandleFunc("/.well-known/oauth-authorization-server", handleAuthServerMeta)
	mux.HandleFunc("/oauth/register", handleOAuthRegister)
	mux.HandleFunc("/oauth/authorize", handleOAuthAuthorize)
	mux.HandleFunc("/oauth/token", handleOAuthToken)
	mux.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, http.StatusOK, []string{}) })
	mcpMux = mux
	e := &oauthEnv{t: t, handler: withAuth(mux), person: person}
	// sessão da pessoa no admin
	tok := "sessao-do-gerente"
	if err := store.CreateSession(hashToken(tok), person.ID, "", "", time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	e.cookie = tok
	return e
}

func (e *oauthEnv) do(r *http.Request) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	e.handler.ServeHTTP(w, r)
	return w
}

func (e *oauthEnv) asPerson(r *http.Request) *http.Request {
	r.AddCookie(&http.Cookie{Name: sessionCookie, Value: e.cookie})
	r.Header.Set("Origin", testAdminOrigin)
	return r
}

func challengeOf(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func jsonBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("resposta não é JSON (%d): %q", w.Code, w.Body.String())
	}
	return m
}

// register + authorize + consentimento + token: devolve access, refresh e client_id.
func (e *oauthEnv) connect(name string, redirect string) (access, refresh, clientID string) {
	t := e.t
	t.Helper()
	w := e.do(httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(`{"client_name":"`+name+`","redirect_uris":["`+redirect+`"]}`)))
	if w.Code != http.StatusCreated {
		t.Fatalf("register: %d %s", w.Code, w.Body.String())
	}
	clientID = jsonBody(t, w)["client_id"].(string)

	verifier := strings.Repeat("v", 50)
	q := url.Values{"response_type": {"code"}, "client_id": {clientID}, "redirect_uri": {redirect}, "state": {"xyz"},
		"code_challenge": {challengeOf(verifier)}, "code_challenge_method": {"S256"}, "resource": {testAPIOrigin + "/api/mcp"}}
	w = e.do(httptest.NewRequest(http.MethodGet, "/oauth/authorize?"+q.Encode(), nil))
	loc := w.Header().Get("Location")
	if w.Code != http.StatusFound || !strings.HasPrefix(loc, testAdminOrigin+"/autorizar-agente?") {
		t.Fatalf("authorize devia ir ao consentimento do admin: %d %q", w.Code, loc)
	}

	params := map[string]string{}
	for k := range q {
		params[k] = q.Get(k)
	}
	body, _ := json.Marshal(map[string]any{"params": params, "approve": true})
	w = e.do(e.asPerson(httptest.NewRequest(http.MethodPost, "/api/oauth/consent", strings.NewReader(string(body)))))
	if w.Code != http.StatusOK {
		t.Fatalf("consentimento: %d %s", w.Code, w.Body.String())
	}
	back, _ := url.Parse(jsonBody(t, w)["redirect"].(string))
	if back.Query().Get("state") != "xyz" || back.Query().Get("code") == "" || back.Query().Get("iss") != testAPIOrigin {
		t.Fatalf("o redirect devia levar code, state e iss: %s", back)
	}

	form := url.Values{"grant_type": {"authorization_code"}, "code": {back.Query().Get("code")}, "client_id": {clientID},
		"redirect_uri": {redirect}, "code_verifier": {verifier}}
	r := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w = e.do(r)
	if w.Code != http.StatusOK || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("token: %d %s", w.Code, w.Body.String())
	}
	tok := jsonBody(t, w)
	return tok["access_token"].(string), tok["refresh_token"].(string), clientID
}

func (e *oauthEnv) mcp(access, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/api/mcp", strings.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+access)
	return e.do(r)
}

// ---- testes ----

func TestOAuthDescoberta(t *testing.T) {
	e := setupOAuth(t)
	w := e.do(httptest.NewRequest(http.MethodPost, "/api/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"ping"}`)))
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Header().Get("WWW-Authenticate"), `resource_metadata="`+testAPIOrigin+`/.well-known/oauth-protected-resource"`) {
		t.Fatalf("sem credencial o /api/mcp devia apontar o resource_metadata: %d %q", w.Code, w.Header().Get("WWW-Authenticate"))
	}
	pr := jsonBody(t, e.do(httptest.NewRequest(http.MethodGet, "/.well-known/oauth-protected-resource", nil)))
	if pr["resource"] != testAPIOrigin+"/api/mcp" || pr["authorization_servers"].([]any)[0] != testAPIOrigin {
		t.Errorf("metadados do recurso: %v", pr)
	}
	r := httptest.NewRequest(http.MethodGet, "/.well-known/oauth-authorization-server", nil)
	r.Header.Set("Origin", "https://claude.ai") // origem de fora: precisa passar e ter CORS aberto
	w = e.do(r)
	as := jsonBody(t, w)
	if as["registration_endpoint"] != testAPIOrigin+"/oauth/register" || as["code_challenge_methods_supported"].([]any)[0] != "S256" || w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("metadados do servidor de autorização: %v", as)
	}
}

func TestOAuthFluxoCompletoComPKCE(t *testing.T) {
	e := setupOAuth(t)
	access, refresh, _ := e.connect("Claude", "https://claude.ai/api/mcp/auth_callback")
	if !strings.HasPrefix(access, oauthAccessPrefix) || !strings.HasPrefix(refresh, oauthRefreshPrefix) {
		t.Fatalf("formato dos tokens: %q %q", access, refresh)
	}

	// o agente usa o MCP como a pessoa que aprovou (Gerente tem tasks:read)
	w := e.mcp(access, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","clientInfo":{"name":"claude-ai","version":"0.1"}}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("initialize com o token OAuth: %d %s", w.Code, w.Body.String())
	}
	res, _ := mcpResult(t, e.mcp(access, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"listar_tarefas","arguments":{}}}`))
	if res["isError"] != false {
		t.Fatalf("listar_tarefas devia rodar: %v", res)
	}
	mcpCallsMu.Lock()
	last := mcpCalls[0]
	mcpCallsMu.Unlock()
	if last.Kind != "oauth" || last.Provider != "Claude" || last.Domain != "claude.ai" || last.Person != "Gerente" {
		t.Errorf("a chamada devia registrar provedor e pessoa: %+v", last)
	}

	// o token do agente não alcança outras rotas
	r := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	r.Header.Set("Authorization", "Bearer "+access)
	if w := e.do(r); w.Code != http.StatusForbidden {
		t.Errorf("token OAuth fora do /api/mcp devia dar 403, deu %d", w.Code)
	}

	// a conexão aparece na aba MCP; o refresh gira e o antigo deixa de valer
	conns := jsonBody(t, httptestJSONList(t, e.do(e.asPerson(httptest.NewRequest(http.MethodGet, "/api/mcp/connections", nil)))))
	cid := conns["0"].(map[string]any)["clientId"].(string)
	connID := conns["0"].(map[string]any)["id"].(string)
	if conns["0"].(map[string]any)["clientName"] != "Claude" {
		t.Errorf("a conexão devia listar o provedor: %v", conns)
	}
	refreshReq := func(rt string) *httptest.ResponseRecorder {
		f := url.Values{"grant_type": {"refresh_token"}, "refresh_token": {rt}, "client_id": {cid}}
		r := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(f.Encode()))
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		return e.do(r)
	}
	w = refreshReq(refresh)
	if w.Code != http.StatusOK {
		t.Fatalf("refresh: %d %s", w.Code, w.Body.String())
	}
	newAccess := jsonBody(t, w)["access_token"].(string)
	if refreshReq(refresh).Code != http.StatusBadRequest {
		t.Error("o refresh antigo não pode valer de novo (rotação)")
	}
	if e.mcp(access, `{"jsonrpc":"2.0","id":3,"method":"ping"}`).Code != http.StatusUnauthorized {
		t.Error("o access antigo devia cair após o refresh")
	}
	if e.mcp(newAccess, `{"jsonrpc":"2.0","id":4,"method":"ping"}`).Code != http.StatusOK {
		t.Error("o access novo devia valer")
	}

	// revogar derruba
	w = e.do(e.asPerson(httptest.NewRequest(http.MethodDelete, "/api/mcp/connections/"+connID, nil)))
	if w.Code != http.StatusNoContent {
		t.Fatalf("revogar: %d %s", w.Code, w.Body.String())
	}
	w = e.mcp(newAccess, `{"jsonrpc":"2.0","id":5,"method":"ping"}`)
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Header().Get("WWW-Authenticate"), `error="invalid_token"`) {
		t.Errorf("token revogado devia dar 401 invalid_token: %d %q", w.Code, w.Header().Get("WWW-Authenticate"))
	}
}

// httptestJSONList transforma a lista JSON em mapa índice→item para os asserts acima.
func httptestJSONList(t *testing.T, w *httptest.ResponseRecorder) *httptest.ResponseRecorder {
	t.Helper()
	var list []any
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("lista esperada (%d): %s", w.Code, w.Body.String())
	}
	m := map[string]any{}
	for i, x := range list {
		m[string(rune('0'+i))] = x
	}
	b, _ := json.Marshal(m)
	out := httptest.NewRecorder()
	out.Body.Write(b)
	return out
}

func TestOAuthRecusas(t *testing.T) {
	e := setupOAuth(t)
	reg := func(body string) int {
		return e.do(httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(body))).Code
	}
	for _, bad := range []string{`{"client_name":"x","redirect_uris":["javascript:alert(1)"]}`, `{"client_name":"x","redirect_uris":["http://evil.com/cb"]}`, `{"client_name":"x","redirect_uris":[]}`} {
		if reg(bad) != http.StatusBadRequest {
			t.Errorf("registro devia ser recusado: %s", bad)
		}
	}
	if reg(`{"client_name":"Cursor","redirect_uris":["cursor://anysphere.cursor-retrieval/oauth/callback"]}`) != http.StatusCreated {
		t.Error("esquema próprio de app de desktop devia ser aceito")
	}
	if reg(`{"client_name":"Claude Code","redirect_uris":["http://localhost:33418/callback"]}`) != http.StatusCreated {
		t.Error("loopback http devia ser aceito")
	}

	w := e.do(httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(`{"client_name":"Teste","redirect_uris":["https://app.test/cb"]}`)))
	cid := jsonBody(t, w)["client_id"].(string)

	// redirect diferente do registrado: erro na tela, nunca redirect
	q := url.Values{"response_type": {"code"}, "client_id": {cid}, "redirect_uri": {"https://evil.test/cb"}, "code_challenge": {"c"}, "code_challenge_method": {"S256"}}
	if w := e.do(httptest.NewRequest(http.MethodGet, "/oauth/authorize?"+q.Encode(), nil)); w.Code != http.StatusBadRequest || w.Header().Get("Location") != "" {
		t.Errorf("redirect estranho não pode ser seguido: %d %q", w.Code, w.Header().Get("Location"))
	}
	// sem PKCE: volta ao cliente com invalid_request
	q = url.Values{"response_type": {"code"}, "client_id": {cid}, "redirect_uri": {"https://app.test/cb"}, "state": {"s"}}
	if loc := e.do(httptest.NewRequest(http.MethodGet, "/oauth/authorize?"+q.Encode(), nil)).Header().Get("Location"); !strings.Contains(loc, "error=invalid_request") {
		t.Errorf("sem PKCE devia voltar invalid_request: %q", loc)
	}

	// consentimento exige pessoa logada (token de API não serve)
	params := map[string]string{"response_type": "code", "client_id": cid, "redirect_uri": "https://app.test/cb", "code_challenge": challengeOf(strings.Repeat("a", 43)), "code_challenge_method": "S256"}
	body, _ := json.Marshal(map[string]any{"params": params, "approve": true})
	if w := e.do(httptest.NewRequest(http.MethodPost, "/api/oauth/consent", strings.NewReader(string(body)))); w.Code != http.StatusUnauthorized {
		t.Errorf("consentimento sem sessão devia dar 401, deu %d", w.Code)
	}
	// recusar volta access_denied
	deny, _ := json.Marshal(map[string]any{"params": params, "approve": false})
	w = e.do(e.asPerson(httptest.NewRequest(http.MethodPost, "/api/oauth/consent", strings.NewReader(string(deny)))))
	if !strings.Contains(jsonBody(t, w)["redirect"].(string), "error=access_denied") {
		t.Errorf("recusar devia voltar access_denied: %s", w.Body.String())
	}
	// PKCE errado e código reaproveitado
	w = e.do(e.asPerson(httptest.NewRequest(http.MethodPost, "/api/oauth/consent", strings.NewReader(string(body)))))
	code := mustQuery(t, jsonBody(t, w)["redirect"].(string), "code")
	tokenReq := func(verifier string) int {
		f := url.Values{"grant_type": {"authorization_code"}, "code": {code}, "client_id": {cid}, "redirect_uri": {"https://app.test/cb"}, "code_verifier": {verifier}}
		r := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(f.Encode()))
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		return e.do(r).Code
	}
	if tokenReq(strings.Repeat("b", 43)) != http.StatusBadRequest {
		t.Error("code_verifier errado devia ser recusado")
	}
	if tokenReq(strings.Repeat("a", 43)) != http.StatusBadRequest {
		t.Error("o código já foi gasto na tentativa anterior: não vale de novo")
	}
}

func TestOAuthSemMcpUseNaoConecta(t *testing.T) {
	e := setupOAuth(t)
	if _, err := authDB.SetMemberScopes(e.person.ID, nil, []string{"mcp:use"}); err != nil {
		t.Fatal(err)
	}
	w := e.do(httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(`{"client_name":"ChatGPT","redirect_uris":["https://chatgpt.com/connector_platform_oauth_redirect"]}`)))
	cid := jsonBody(t, w)["client_id"].(string)
	params := map[string]string{"response_type": "code", "client_id": cid, "redirect_uri": "https://chatgpt.com/connector_platform_oauth_redirect", "code_challenge": "c", "code_challenge_method": "S256"}
	body, _ := json.Marshal(map[string]any{"params": params, "approve": true})
	if w := e.do(e.asPerson(httptest.NewRequest(http.MethodPost, "/api/oauth/consent", strings.NewReader(string(body))))); w.Code != http.StatusForbidden {
		t.Errorf("sem mcp:use não aprova, deu %d", w.Code)
	}
}

func TestProviderDomain(t *testing.T) {
	cases := []struct {
		name, uri string
		redirects []string
		want      string
	}{
		{"Claude", "", []string{"https://claude.ai/api/mcp/auth_callback"}, "claude.ai"},
		{"ChatGPT", "", nil, "chatgpt.com"},
		{"Cursor", "", []string{"cursor://x/cb"}, "cursor.com"},
		{"Meu App", "https://www.meuapp.com.br", nil, "meuapp.com.br"},
		{"Desconhecido", "", []string{"https://agente.exemplo.com/cb"}, "agente.exemplo.com"},
		{"Local", "", []string{"http://localhost:3000/cb"}, ""},
	}
	for _, c := range cases {
		if got := providerDomain(c.name, c.uri, c.redirects); got != c.want {
			t.Errorf("%s: %q, queria %q", c.name, got, c.want)
		}
	}
}

func mustQuery(t *testing.T, raw, k string) string {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil || u.Query().Get(k) == "" {
		t.Fatalf("%s sem %s", raw, k)
	}
	return u.Query().Get(k)
}
