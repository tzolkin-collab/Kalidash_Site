package main

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

// Testes de unidade do login e dos perfis, sem banco: authStore em memória + um "Google" falso
// (httptest). O SQL de verdade é coberto por auth_integration_test.go (precisa de TEST_DSN).

type memStore struct {
	mu       sync.Mutex
	members  map[string]*Member
	sessions map[string]memSession
	n        int
}
type memSession struct {
	memberID string
	expires  time.Time
}

func newMemStore() *memStore {
	return &memStore{members: map[string]*Member{}, sessions: map[string]memSession{}}
}

func (s *memStore) ListMembers() ([]Member, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Member{}
	for i := 1; i <= s.n; i++ {
		for _, m := range s.members {
			if m.ID == memID(i) {
				out = append(out, *m)
			}
		}
	}
	return out, nil
}
func memID(i int) string { return "tm-" + strings.Repeat("x", i) }
func (s *memStore) find(f func(*Member) bool) (Member, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, m := range s.members {
		if f(m) {
			return *m, nil
		}
	}
	return Member{}, errMemberNotFound
}
func (s *memStore) MemberByID(id string) (Member, error) {
	return s.find(func(m *Member) bool { return m.ID == id })
}
func (s *memStore) MemberByEmail(e string) (Member, error) {
	return s.find(func(m *Member) bool { return m.Email == e })
}
func (s *memStore) MemberBySub(sub string) (Member, error) {
	return s.find(func(m *Member) bool { return m.GoogleSub == sub && sub != "" })
}
func (s *memStore) AddMember(m Member, _ string) (Member, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, o := range s.members {
		if o.Email == m.Email {
			return Member{}, errMemberExists
		}
	}
	s.n++
	m.ID, m.Active = memID(s.n), true
	derive(&m)
	s.members[m.ID] = &m
	return m, nil
}
func derive(m *Member) {
	switch {
	case !m.Active:
		m.Status = "DISABLED"
	case m.LastAccess == nil:
		m.Status = "INVITED"
	default:
		m.Status = "ACTIVE"
	}
}
func (s *memStore) UpdateMember(id string, name, role *string, active *bool) (Member, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.members[id]
	if !ok {
		return Member{}, errMemberNotFound
	}
	nr, na := m.Role, m.Active
	if role != nil {
		nr = *role
	}
	if active != nil {
		na = *active
	}
	if m.Role == roleAdmin && m.Active && (nr != roleAdmin || !na) {
		n := 0
		for _, o := range s.members {
			if o.Role == roleAdmin && o.Active {
				n++
			}
		}
		if n <= 1 {
			return Member{}, errLastAdmin
		}
	}
	m.Role, m.Active = nr, na
	if name != nil {
		m.Name = *name
	}
	derive(m)
	return *m, nil
}
func (s *memStore) TouchLogin(id, sub, name, avatar string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	m := s.members[id]
	if m.GoogleSub == "" {
		m.GoogleSub = sub
	}
	if m.Name == "" {
		m.Name = name
	}
	m.AvatarURL = avatar
	t := FlexTime{time.Now()}
	m.LastAccess = &t
	derive(m)
	return nil
}
func (s *memStore) CreateSession(hash, memberID, _, _ string, exp time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[hash] = memSession{memberID, exp}
	return nil
}
func (s *memStore) SessionMember(hash string, now time.Time) (Member, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ss, ok := s.sessions[hash]
	if !ok || !ss.expires.After(now) || !s.members[ss.memberID].Active {
		return Member{}, errSessionNotFound
	}
	return *s.members[ss.memberID], nil
}
func (s *memStore) DeleteSession(hash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, hash)
	return nil
}
func (s *memStore) DeleteMemberSessions(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for h, ss := range s.sessions {
		if ss.memberID == id {
			delete(s.sessions, h)
		}
	}
	return nil
}
func (s *memStore) PurgeExpired(now time.Time) error { return nil }
func (s *memStore) CountActiveAdmins() (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, m := range s.members {
		if m.Role == roleAdmin && m.Active {
			n++
		}
	}
	return n, nil
}

const (
	testAdminOrigin = "https://admin.kalidash.test"
	testAPIOrigin   = "https://api.kalidash.test"
	testClientID    = "client-id.apps.googleusercontent.com"
)

type authEnv struct {
	t      *testing.T
	store  *memStore
	h      http.Handler
	google *httptest.Server
	idTok  func() string // o que o "Google" devolve como id_token
}

func setupAuth(t *testing.T) *authEnv {
	t.Helper()
	e := &authEnv{t: t, store: newMemStore()}
	for k, v := range map[string]string{
		"AUTH_API": "1", "SESSION_SECRET": strings.Repeat("s", 40), "ALLOWED_ORIGINS": testAdminOrigin,
		"GOOGLE_CLIENT_ID": testClientID, "GOOGLE_CLIENT_SECRET": "shh", "GOOGLE_REDIRECT_URL": testAPIOrigin + "/auth/google/callback",
		"ADMIN_URL": testAdminOrigin, "SITE_URL": "", "AUTH_DEV_LOGIN": "", "AUTH_COOKIE_INSECURE": "", "GOOGLE_HD": "", "AUTH_BOOTSTRAP_ADMIN": "",
	} {
		t.Setenv(k, v)
	}
	oldDB := authDB
	authDB = e.store
	t.Cleanup(func() { authDB = oldDB })

	e.google = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		if r.Form.Get("code") != "good-code" || r.Form.Get("client_secret") != "shh" || r.Form.Get("grant_type") != "authorization_code" {
			http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"id_token": e.idTok(), "access_token": "x"})
	}))
	t.Cleanup(e.google.Close)
	old := googleTokenURL
	googleTokenURL = e.google.URL
	t.Cleanup(func() { googleTokenURL = old })

	mux := http.NewServeMux()
	ok := func(code int) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if m, has := principalOf(r); has {
				w.Header().Set("X-Who", m.Email)
			}
			w.WriteHeader(code)
		}
	}
	mux.HandleFunc("/api/leads", enableCORS(ok(200)))
	mux.HandleFunc("/api/pipelines", enableCORS(ok(200)))
	mux.HandleFunc("/api/pipelines/{id}", enableCORS(ok(200)))
	mux.HandleFunc("/api/crm/people", enableCORS(ok(200)))
	mux.HandleFunc("/api/crm/people/{id}/document", enableCORS(ok(200)))
	mux.HandleFunc("/api/blog/articles", enableCORS(ok(200)))
	mux.HandleFunc("/api/blog/article", enableCORS(ok(200)))
	mux.HandleFunc("/api/blog/settings", enableCORS(ok(200)))
	mux.HandleFunc("/api/blog/upload", enableCORS(ok(200)))
	mux.HandleFunc("/api/public/leads", ok(201))
	registerAuthRoutes(mux)
	e.h = withAuth(mux)

	e.idTok = func() string {
		return fakeIDToken(googleClaims{Sub: "sub-1", Email: "ana@kalidash.test", EmailVerified: true, Name: "Ana", Picture: "https://img/ana.png"})
	}
	return e
}

func fakeIDToken(c googleClaims) string {
	if c.Iss == "" {
		c.Iss = "https://accounts.google.com"
	}
	if c.Aud == "" {
		c.Aud = testClientID
	}
	if c.Exp == 0 {
		c.Exp = time.Now().Add(time.Hour).Unix()
	}
	b, _ := json.Marshal(c)
	enc := base64.RawURLEncoding.EncodeToString
	return enc([]byte(`{"alg":"RS256"}`)) + "." + enc(b) + "." + enc([]byte("sig"))
}

func (e *authEnv) member(email, role string) Member {
	e.t.Helper()
	m, err := e.store.AddMember(Member{Email: email, Name: strings.Split(email, "@")[0], Role: role}, "")
	if err != nil {
		e.t.Fatal(err)
	}
	return m
}

// login cria uma sessão direto no armazenamento e devolve o cookie, como o callback faria.
func (e *authEnv) login(m Member) *http.Cookie {
	e.t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	if err := startSession(rec, req, m.ID); err != nil {
		e.t.Fatal(err)
	}
	return rec.Result().Cookies()[0]
}

func (e *authEnv) do(method, path string, c *http.Cookie, hdr map[string]string, body string) *httptest.ResponseRecorder {
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
	}
	if c != nil {
		r.AddCookie(c)
	}
	for k, v := range hdr {
		r.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, r)
	return rec
}

func TestSemSessaoRecebe401(t *testing.T) {
	e := setupAuth(t)
	for _, c := range [][2]string{
		{"GET", "/api/leads"}, {"POST", "/api/leads"}, {"GET", "/api/crm/people"}, {"GET", "/api/pipelines"},
		{"GET", "/api/team"}, {"POST", "/api/team"}, {"PUT", "/api/team/x"}, {"GET", "/api/blog/articles"},
		{"POST", "/api/blog/articles"}, {"POST", "/api/blog/upload"}, {"GET", "/api/crm/people/p1/document"},
		{"GET", "/api/blog/articles?published=false"},
	} {
		if rec := e.do(c[0], c[1], nil, nil, ""); rec.Code != 401 {
			t.Errorf("%s %s sem sessão: %d, queria 401", c[0], c[1], rec.Code)
		}
	}
	// cookie inventado / sessão desconhecida
	if rec := e.do("GET", "/api/leads", &http.Cookie{Name: sessionCookie, Value: "inventado"}, nil, ""); rec.Code != 401 {
		t.Errorf("cookie inválido: %d", rec.Code)
	}
}

func TestRotasPublicasContinuamAbertas(t *testing.T) {
	e := setupAuth(t)
	for _, c := range []struct {
		method, path string
		want         int
	}{
		{"POST", "/api/public/leads", 201},
		{"GET", "/api/blog/article?slug=x", 200},
		{"GET", "/api/blog/settings", 200},
		{"GET", "/api/blog/articles?published=true", 200},
	} {
		if rec := e.do(c.method, c.path, nil, nil, ""); rec.Code != c.want {
			t.Errorf("%s %s: %d, queria %d", c.method, c.path, rec.Code, c.want)
		}
	}
	// a captura pública não troca de CORS por causa do login: quem decide é public_leads.go
	if rec := e.do("POST", "/api/public/leads", nil, map[string]string{"Origin": "https://lp.qualquer.test"}, ""); rec.Code != 201 {
		t.Errorf("captura pública com Origin de LP: %d", rec.Code)
	}
	// escrever no blog continua protegido mesmo com ?published=true
	if rec := e.do("POST", "/api/blog/articles?published=true", nil, nil, ""); rec.Code != 401 {
		t.Errorf("POST /api/blog/articles?published=true sem sessão: %d", rec.Code)
	}
}

func TestPerfisNoServidor(t *testing.T) {
	e := setupAuth(t)
	adm := e.login(e.member("adm@kalidash.test", roleAdmin))
	ger := e.login(e.member("ger@kalidash.test", roleManager))
	ven := e.login(e.member("ven@kalidash.test", roleSeller))

	cases := []struct {
		method, path           string
		admin, manager, seller int
	}{
		{"GET", "/api/leads", 200, 200, 200},
		{"GET", "/api/crm/people", 200, 200, 200},
		{"GET", "/api/pipelines", 200, 200, 200},
		{"POST", "/api/pipelines", 200, 200, 403},
		{"PUT", "/api/pipelines/f1", 200, 200, 403},
		{"DELETE", "/api/pipelines/f1", 200, 200, 403},
		{"GET", "/api/crm/people/p1/document", 200, 200, 403},
		{"GET", "/api/blog/articles", 200, 200, 403},
		{"POST", "/api/blog/articles", 200, 200, 403},
		{"POST", "/api/blog/upload", 200, 200, 403},
		{"GET", "/api/team", 200, 403, 403},
		{"POST", "/api/team", 422, 403, 403}, // 422: Admin passou do perfil e falhou na validação (corpo vazio)
	}
	for _, c := range cases {
		for who, want := range map[string]int{"admin": c.admin, "manager": c.manager, "seller": c.seller} {
			ck := map[string]*http.Cookie{"admin": adm, "manager": ger, "seller": ven}[who]
			body := ""
			if c.path == "/api/team" && c.method == "POST" {
				body = `{}`
			}
			if rec := e.do(c.method, c.path, ck, nil, body); rec.Code != want {
				t.Errorf("%s %s como %s: %d, queria %d", c.method, c.path, who, rec.Code, want)
			}
		}
	}
	if rec := e.do("GET", "/api/leads", ven, nil, ""); rec.Header().Get("X-Who") != "ven@kalidash.test" {
		t.Errorf("o handler deve receber a pessoa da sessão: %q", rec.Header().Get("X-Who"))
	}
}

func TestPerfilEDesativacaoValemNaHora(t *testing.T) {
	e := setupAuth(t)
	e.member("adm@kalidash.test", roleAdmin)
	m := e.member("ger@kalidash.test", roleManager)
	ck := e.login(m)
	if rec := e.do("POST", "/api/pipelines", ck, nil, ""); rec.Code != 200 {
		t.Fatalf("gerente: %d", rec.Code)
	}
	seller := roleSeller
	e.store.UpdateMember(m.ID, nil, &seller, nil)
	if rec := e.do("POST", "/api/pipelines", ck, nil, ""); rec.Code != 403 {
		t.Errorf("rebaixado a Vendedor deveria perder o acesso na hora: %d", rec.Code)
	}
	off := false
	e.store.UpdateMember(m.ID, nil, nil, &off)
	if rec := e.do("GET", "/api/leads", ck, nil, ""); rec.Code != 401 {
		t.Errorf("desativado deveria dar 401: %d", rec.Code)
	}
}

func TestSessaoExpiraELogoutRevoga(t *testing.T) {
	e := setupAuth(t)
	m := e.member("a@kalidash.test", roleAdmin)
	ck := e.login(m)
	// o banco só guarda o hash, nunca o token do cookie
	for h := range e.store.sessions {
		if h == ck.Value || strings.Contains(h, ck.Value) {
			t.Fatal("o token da sessão não pode ser gravado em claro")
		}
	}
	if rec := e.do("GET", "/auth/me", ck, nil, ""); rec.Code != 200 {
		t.Fatalf("me: %d", rec.Code)
	}
	rec := e.do("POST", "/auth/logout", ck, nil, "")
	if rec.Code != 204 {
		t.Fatalf("logout: %d", rec.Code)
	}
	if c := rec.Result().Cookies(); len(c) == 0 || c[0].MaxAge >= 0 {
		t.Errorf("logout deve apagar o cookie: %+v", c)
	}
	if rec := e.do("GET", "/api/leads", ck, nil, ""); rec.Code != 401 {
		t.Errorf("sessão revogada ainda vale: %d", rec.Code)
	}
	// expirada
	ck2 := e.login(m)
	for h, s := range e.store.sessions {
		s.expires = time.Now().Add(-time.Minute)
		e.store.sessions[h] = s
	}
	if rec := e.do("GET", "/api/leads", ck2, nil, ""); rec.Code != 401 {
		t.Errorf("sessão expirada ainda vale: %d", rec.Code)
	}
}

func TestCookieDaSessao(t *testing.T) {
	e := setupAuth(t)
	ck := e.login(e.member("a@kalidash.test", roleAdmin))
	if !ck.HttpOnly || !ck.Secure || ck.SameSite != http.SameSiteLaxMode || ck.Path != "/" || ck.MaxAge != int(sessionTTL.Seconds()) {
		t.Errorf("flags do cookie: %+v", ck)
	}
	if len(ck.Value) < 40 {
		t.Errorf("token curto demais: %d", len(ck.Value))
	}
	t.Setenv("AUTH_COOKIE_INSECURE", "1") // só para http://localhost em desenvolvimento
	if ck := e.login(e.member("b@kalidash.test", roleAdmin)); ck.Secure {
		t.Error("AUTH_COOKIE_INSECURE=1 deveria tirar o Secure")
	}
}

func TestCORSRestrito(t *testing.T) {
	e := setupAuth(t)
	ck := e.login(e.member("a@kalidash.test", roleAdmin))

	rec := e.do("GET", "/api/leads", ck, map[string]string{"Origin": testAdminOrigin}, "")
	h := rec.Header()
	if h.Get("Access-Control-Allow-Origin") != testAdminOrigin || h.Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("origem do admin deveria ser aceita com credenciais: %v", h)
	}
	// origem de fora: bloqueada e sem cabeçalho CORS
	rec = e.do("GET", "/api/leads", ck, map[string]string{"Origin": "https://malvado.test"}, "")
	if rec.Code != 403 || rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("origem estranha: %d %v", rec.Code, rec.Header())
	}
	// nunca "*"
	for _, o := range []string{testAdminOrigin, "https://malvado.test", ""} {
		rec = e.do("GET", "/api/blog/settings", nil, map[string]string{"Origin": o}, "")
		if rec.Header().Get("Access-Control-Allow-Origin") == "*" {
			t.Errorf("CORS com * (origin %q)", o)
		}
	}
	// preflight
	rec = e.do("OPTIONS", "/api/leads", nil, map[string]string{"Origin": testAdminOrigin, "Access-Control-Request-Method": "PUT"}, "")
	if rec.Code != 204 || !strings.Contains(rec.Header().Get("Access-Control-Allow-Methods"), "PUT") {
		t.Errorf("preflight: %d %v", rec.Code, rec.Header())
	}
	rec = e.do("OPTIONS", "/api/leads", nil, map[string]string{"Origin": "https://malvado.test"}, "")
	if rec.Code != 403 {
		t.Errorf("preflight de origem estranha: %d", rec.Code)
	}
	// a resposta 401 também leva CORS (senão o admin não consegue ler o 401 e mostrar o login)
	rec = e.do("GET", "/api/leads", nil, map[string]string{"Origin": testAdminOrigin}, "")
	if rec.Code != 401 || rec.Header().Get("Access-Control-Allow-Origin") != testAdminOrigin {
		t.Errorf("401 sem CORS: %d %v", rec.Code, rec.Header())
	}
}

func TestAntiCSRFEmEscrita(t *testing.T) {
	e := setupAuth(t)
	ck := e.login(e.member("a@kalidash.test", roleAdmin))
	if rec := e.do("POST", "/api/leads", ck, map[string]string{"Origin": "https://malvado.test"}, ""); rec.Code != 403 {
		t.Errorf("POST de origem estranha com cookie válido: %d", rec.Code)
	}
	if rec := e.do("POST", "/auth/logout", ck, map[string]string{"Origin": "https://malvado.test"}, ""); rec.Code != 403 {
		t.Errorf("logout forjado: %d", rec.Code)
	}
	if rec := e.do("POST", "/api/leads", ck, map[string]string{"Origin": testAdminOrigin}, ""); rec.Code != 200 {
		t.Errorf("POST do admin: %d", rec.Code)
	}
}

// ---- Google ----

// startGoogle faz o /auth/google/login e devolve (state, cookie do state).
func (e *authEnv) startGoogle() (string, *http.Cookie) {
	e.t.Helper()
	rec := e.do("GET", "/auth/google/login", nil, nil, "")
	if rec.Code != 302 {
		e.t.Fatalf("login: %d %s", rec.Code, rec.Body)
	}
	loc, _ := url.Parse(rec.Header().Get("Location"))
	q := loc.Query()
	if loc.Host != "accounts.google.com" || q.Get("client_id") != testClientID || q.Get("response_type") != "code" ||
		q.Get("redirect_uri") != testAPIOrigin+"/auth/google/callback" || !strings.Contains(q.Get("scope"), "email") || q.Get("state") == "" {
		e.t.Fatalf("URL do Google: %s", loc)
	}
	var ck *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == oauthCookie {
			ck = c
		}
	}
	if ck == nil || !ck.HttpOnly || !ck.Secure || !strings.HasPrefix(ck.Value, q.Get("state")+".") {
		e.t.Fatalf("cookie do state: %+v", ck)
	}
	return q.Get("state"), ck
}

func (e *authEnv) callback(state string, ck *http.Cookie, code string) *httptest.ResponseRecorder {
	return e.do("GET", "/auth/google/callback?code="+code+"&state="+url.QueryEscape(state), ck, nil, "")
}

func sessionOf(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie && c.MaxAge > 0 {
			return c
		}
	}
	return nil
}

func TestGoogleLoginConvidadoEntra(t *testing.T) {
	e := setupAuth(t)
	e.member("ana@kalidash.test", roleManager) // convidada, ainda sem googleSub
	state, sc := e.startGoogle()
	rec := e.callback(state, sc, "good-code")
	if rec.Code != 302 || rec.Header().Get("Location") != testAdminOrigin {
		t.Fatalf("callback: %d %v %s", rec.Code, rec.Header(), rec.Body)
	}
	ck := sessionOf(rec)
	if ck == nil || !ck.HttpOnly || !ck.Secure || ck.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie de sessão: %+v", ck)
	}
	me := e.do("GET", "/auth/me", ck, nil, "")
	var m Member
	json.Unmarshal(me.Body.Bytes(), &m)
	if me.Code != 200 || m.Email != "ana@kalidash.test" || m.Role != roleManager || m.Status != "ACTIVE" || m.AvatarURL == "" {
		t.Errorf("me: %d %+v", me.Code, m)
	}
	if got, _ := e.store.MemberByEmail("ana@kalidash.test"); got.GoogleSub != "sub-1" {
		t.Errorf("googleSub deveria ser vinculado no primeiro login: %q", got.GoogleSub)
	}
	// 2º login: já pelo sub, mesmo que o e-mail do Google mude
	e.idTok = func() string {
		return fakeIDToken(googleClaims{Sub: "sub-1", Email: "ana.nova@kalidash.test", EmailVerified: true})
	}
	state, sc = e.startGoogle()
	if rec := e.callback(state, sc, "good-code"); rec.Code != 302 {
		t.Errorf("2º login pelo sub: %d", rec.Code)
	}
}

func TestGoogleLoginNegado(t *testing.T) {
	e := setupAuth(t)
	e.member("ana@kalidash.test", roleSeller)
	off := e.member("off@kalidash.test", roleSeller)
	f := false
	e.store.UpdateMember(off.ID, nil, nil, &f)
	e.member("adm@kalidash.test", roleAdmin)

	tok := func(c googleClaims) { e.idTok = func() string { return fakeIDToken(c) } }
	base := googleClaims{Sub: "sub-1", Email: "ana@kalidash.test", EmailVerified: true}
	with := func(f func(*googleClaims)) googleClaims { c := base; f(&c); return c }

	cases := []struct {
		name string
		c    googleClaims
		want int
	}{
		{"fora da equipe", with(func(c *googleClaims) { c.Email = "intruso@gmail.com"; c.Sub = "s9" }), 403},
		{"equipe desativada", with(func(c *googleClaims) { c.Email = "off@kalidash.test"; c.Sub = "s8" }), 403},
		{"e-mail não verificado", with(func(c *googleClaims) { c.EmailVerified = false }), 403},
		{"token de outro app", with(func(c *googleClaims) { c.Aud = "outro" }), 403},
		{"emissor falso", with(func(c *googleClaims) { c.Iss = "https://evil.test" }), 403},
		{"token expirado", with(func(c *googleClaims) { c.Exp = time.Now().Add(-time.Hour).Unix() }), 403},
		{"e-mail de membro com sub de outra conta Google", with(func(c *googleClaims) { c.Email = "adm@kalidash.test"; c.Sub = "sub-A" }), 302}, // 1º vínculo ok...
	}
	for _, c := range cases {
		tok(c.c)
		state, sc := e.startGoogle()
		rec := e.callback(state, sc, "good-code")
		if rec.Code != c.want {
			t.Errorf("%s: %d, queria %d", c.name, rec.Code, c.want)
		}
		if c.want == 403 && sessionOf(rec) != nil {
			t.Errorf("%s: não pode abrir sessão", c.name)
		}
	}
	// ...e uma OUTRA conta Google com o mesmo e-mail já vinculado é recusada
	tok(googleClaims{Sub: "sub-B", Email: "adm@kalidash.test", EmailVerified: true})
	state, sc := e.startGoogle()
	if rec := e.callback(state, sc, "good-code"); rec.Code != 403 || sessionOf(rec) != nil {
		t.Errorf("e-mail já vinculado a outra conta Google: %d", rec.Code)
	}
}

func TestGoogleStateAntiCSRF(t *testing.T) {
	e := setupAuth(t)
	e.member("ana@kalidash.test", roleSeller)
	state, sc := e.startGoogle()

	if rec := e.callback(state, nil, "good-code"); rec.Code != 400 || sessionOf(rec) != nil {
		t.Errorf("sem cookie do state: %d", rec.Code)
	}
	if rec := e.callback("outro-state", sc, "good-code"); rec.Code != 400 {
		t.Errorf("state diferente: %d", rec.Code)
	}
	if rec := e.callback("", sc, "good-code"); rec.Code != 400 {
		t.Errorf("state vazio: %d", rec.Code)
	}
	// cookie com assinatura forjada (atacante escolhe o state)
	forged := &http.Cookie{Name: oauthCookie, Value: "meu-state.assinaturafalsa"}
	if rec := e.callback("meu-state", forged, "good-code"); rec.Code != 400 {
		t.Errorf("state forjado: %d", rec.Code)
	}
	// code que o Google recusa
	if rec := e.callback(state, sc, "code-ruim"); rec.Code != 403 {
		t.Errorf("code recusado: %d", rec.Code)
	}
	// usuário cancelou no Google
	rec := e.do("GET", "/auth/google/callback?error=access_denied&state="+state, sc, nil, "")
	if rec.Code != 403 {
		t.Errorf("cancelado: %d", rec.Code)
	}
}

func TestGoogleDominioHD(t *testing.T) {
	e := setupAuth(t)
	t.Setenv("GOOGLE_HD", "kalidash.test")
	e.member("ana@kalidash.test", roleSeller)
	e.idTok = func() string {
		return fakeIDToken(googleClaims{Sub: "s", Email: "ana@kalidash.test", EmailVerified: true, HD: "outro.com"})
	}
	state, sc := e.startGoogle()
	if rec := e.callback(state, sc, "good-code"); rec.Code != 403 {
		t.Errorf("hd errado: %d", rec.Code)
	}
}

// ---- modo de desenvolvimento ----

func TestDevLogin(t *testing.T) {
	e := setupAuth(t)
	e.member("dev@kalidash.test", roleAdmin)
	post := func(remote, xff, email string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/auth/dev/login", strings.NewReader(`{"email":"`+email+`"}`))
		r.RemoteAddr = remote
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		rec := httptest.NewRecorder()
		e.h.ServeHTTP(rec, r)
		return rec
	}
	if rec := post("127.0.0.1:5000", "", "dev@kalidash.test"); rec.Code != 404 {
		t.Errorf("desligado deveria dar 404: %d", rec.Code)
	}
	t.Setenv("AUTH_DEV_LOGIN", "1")
	if rec := post("203.0.113.9:5000", "", "dev@kalidash.test"); rec.Code != 404 {
		t.Errorf("fora do loopback: %d", rec.Code)
	}
	if rec := post("127.0.0.1:5000", "203.0.113.9", "dev@kalidash.test"); rec.Code != 404 {
		t.Errorf("atrás de proxy (X-Forwarded-For): %d", rec.Code)
	}
	if rec := post("127.0.0.1:5000", "", "intruso@x.com"); rec.Code != 403 {
		t.Errorf("fora da equipe: %d", rec.Code)
	}
	rec := post("127.0.0.1:5000", "", "DEV@kalidash.test")
	ck := sessionOf(rec)
	if rec.Code != 200 || ck == nil {
		t.Fatalf("dev login: %d", rec.Code)
	}
	if r := e.do("GET", "/api/team", ck, nil, ""); r.Code != 200 {
		t.Errorf("sessão de dev: %d", r.Code)
	}
	// o /auth/me avisa a tela de login que o modo existe
	var me map[string]any
	json.Unmarshal(e.do("GET", "/auth/me", nil, nil, "").Body.Bytes(), &me)
	if me["dev"] != true || me["google"] != true {
		t.Errorf("/auth/me sem sessão: %v", me)
	}
}

// ---- equipe ----

func TestEquipeConvidarTrocarDesativar(t *testing.T) {
	e := setupAuth(t)
	adm := e.member("adm@kalidash.test", roleAdmin)
	ck := e.login(adm)
	send := func(method, path, body string) (*httptest.ResponseRecorder, Member) {
		rec := e.do(method, path, ck, nil, body)
		var m Member
		json.Unmarshal(rec.Body.Bytes(), &m)
		return rec, m
	}

	rec, nova := send("POST", "/api/team", `{"email":"  Nova@Kalidash.test ","name":"Nova","role":"SELLER"}`)
	if rec.Code != 201 || nova.Email != "nova@kalidash.test" || nova.Status != "INVITED" || nova.Role != roleSeller {
		t.Fatalf("convidar: %d %+v", rec.Code, nova)
	}
	for body, want := range map[string]int{
		`{"email":"nova@kalidash.test","role":"SELLER"}`: 409,
		`{"email":"sem-arroba","role":"SELLER"}`:         422,
		`{"email":"x@y.com","role":"CHEFE"}`:             422,
		`nao-e-json`:                                     400,
	} {
		if rec, _ := send("POST", "/api/team", body); rec.Code != want {
			t.Errorf("POST %s: %d, queria %d", body, rec.Code, want)
		}
	}
	if rec, m := send("PUT", "/api/team/"+nova.ID, `{"role":"MANAGER"}`); rec.Code != 200 || m.Role != roleManager {
		t.Errorf("trocar perfil: %d %+v", rec.Code, m)
	}
	// a pessoa entra e depois é removida: perde a sessão na hora
	nck := e.login(nova)
	if rec := e.do("GET", "/api/leads", nck, nil, ""); rec.Code != 200 {
		t.Fatalf("pessoa nova: %d", rec.Code)
	}
	if rec, m := send("DELETE", "/api/team/"+nova.ID, ""); rec.Code != 200 || m.Active || m.Status != "DISABLED" {
		t.Errorf("desativar: %d %+v", rec.Code, m)
	}
	if rec := e.do("GET", "/api/leads", nck, nil, ""); rec.Code != 401 {
		t.Errorf("desativada ainda entra: %d", rec.Code)
	}
	if rec, m := send("PUT", "/api/team/"+nova.ID, `{"active":true}`); rec.Code != 200 || !m.Active {
		t.Errorf("reativar: %d %+v", rec.Code, m)
	}
	if rec, _ := send("PUT", "/api/team/tm-inexistente", `{"role":"SELLER"}`); rec.Code != 404 {
		t.Errorf("inexistente: %d", rec.Code)
	}
	// proteções: ninguém muda o próprio acesso; o último Admin não sai
	if rec, _ := send("PUT", "/api/team/"+adm.ID, `{"role":"SELLER"}`); rec.Code != 409 {
		t.Errorf("rebaixar a si mesmo: %d", rec.Code)
	}
	if rec, _ := send("DELETE", "/api/team/"+adm.ID, ""); rec.Code != 409 {
		t.Errorf("desativar a si mesmo: %d", rec.Code)
	}
	outro := e.member("outro@kalidash.test", roleAdmin)
	_ = outro
	seller := roleSeller
	if _, err := e.store.UpdateMember(outro.ID, nil, &seller, nil); err != nil { // há 2 Admins: pode
		t.Errorf("com 2 Admins deveria deixar: %v", err)
	}
	if _, err := e.store.UpdateMember(adm.ID, nil, &seller, nil); err != errLastAdmin {
		t.Errorf("último Admin deveria ser protegido: %v", err)
	}
}

func TestBootstrapAdmin(t *testing.T) {
	e := setupAuth(t)
	if err := bootstrapAdmin(e.store); err != nil {
		t.Fatal(err)
	}
	if n, _ := e.store.CountActiveAdmins(); n != 0 {
		t.Fatal("sem variável não cria ninguém")
	}
	t.Setenv("AUTH_BOOTSTRAP_ADMIN", "Gustavo@Kalidash.test")
	bootstrapAdmin(e.store)
	bootstrapAdmin(e.store) // idempotente
	m, err := e.store.MemberByEmail("gustavo@kalidash.test")
	if err != nil || m.Role != roleAdmin || !m.Active {
		t.Fatalf("bootstrap: %+v %v", m, err)
	}
	// já existe Admin: a variável é ignorada (não ressuscita nem promove ninguém)
	t.Setenv("AUTH_BOOTSTRAP_ADMIN", "outro@kalidash.test")
	bootstrapAdmin(e.store)
	if _, err := e.store.MemberByEmail("outro@kalidash.test"); err == nil {
		t.Error("não deveria criar 2º Admin por bootstrap")
	}
	t.Setenv("AUTH_BOOTSTRAP_ADMIN", "lixo")
	if err := bootstrapAdmin(newMemStore()); err == nil {
		t.Error("e-mail inválido deveria falhar")
	}
}

// ---- configuração, regras finas e flag desligada ----

func TestValidateAuthConfig(t *testing.T) {
	setupAuth(t)
	if err := validateAuthConfig(); err != nil {
		t.Fatalf("config válida: %v", err)
	}
	for k, v := range map[string]string{"SESSION_SECRET": "curto", "ALLOWED_ORIGINS": "", "GOOGLE_CLIENT_SECRET": "", "ADMIN_URL": ""} {
		old := envOf(k)
		t.Setenv(k, v)
		if err := validateAuthConfig(); err == nil {
			t.Errorf("sem %s deveria recusar subir", k)
		}
		t.Setenv(k, old)
	}
	t.Setenv("GOOGLE_CLIENT_SECRET", "")
	t.Setenv("AUTH_DEV_LOGIN", "1") // dev dispensa o Google, mas não o SESSION_SECRET nem as origens
	if err := validateAuthConfig(); err != nil {
		t.Errorf("modo dev sem Google: %v", err)
	}
	t.Setenv("ALLOWED_ORIGINS", "*") // "*" não é origem: não pode virar curinga
	if authOriginOK("https://qualquer.test") {
		t.Error("ALLOWED_ORIGINS=* não pode liberar tudo")
	}
}

func envOf(k string) string { return os.Getenv(k) }

func TestRegrasFinasPorConteudo(t *testing.T) {
	e := setupAuth(t)
	call := func(role string, doc string) bool {
		m := e.member(role+doc+"@k.test", role)
		r := httptest.NewRequest("PUT", "/x", nil)
		r = r.WithContext(withPrincipal(r.Context(), m))
		return canWriteDocument(httptest.NewRecorder(), r, doc)
	}
	if !call(roleSeller, "") || !call(roleSeller, "•••.•••.•••-35") {
		t.Error("Vendedor pode salvar a pessoa com CPF vazio ou mascarado")
	}
	if call(roleSeller, "111.444.777-35") {
		t.Error("Vendedor não pode enviar CPF novo")
	}
	if !call(roleManager, "111.444.777-35") || !call(roleAdmin, "111.444.777-35") {
		t.Error("Gerente e Admin podem enviar CPF")
	}
	if got := actorFor(httptest.NewRequest("POST", "/", nil), "Cliente Mentiroso"); got != "Cliente Mentiroso" {
		t.Errorf("sem login o autor segue o que o cliente mandou: %q", got)
	}
	r := httptest.NewRequest("POST", "/", nil)
	r = r.WithContext(withPrincipal(r.Context(), Member{Name: "Carol", Email: "c@k.test"}))
	if got := actorFor(r, "Cliente Mentiroso"); got != "Carol" {
		t.Errorf("com login o autor é a sessão: %q", got)
	}
}

func TestComFlagDesligadaNadaMuda(t *testing.T) {
	t.Setenv("AUTH_API", "")
	if authEnabled() {
		t.Fatal("AUTH_API deve ser desligado por padrão")
	}
	h := enableCORS(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest("GET", "/api/leads", nil))
	if rec.Header().Get("Access-Control-Allow-Origin") != "*" || rec.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Errorf("sem AUTH_API o CORS segue como antes: %v", rec.Header())
	}
	r := httptest.NewRequest("PUT", "/x", nil)
	if !requireManagerFor(httptest.NewRecorder(), r, "x") || !canWriteDocument(httptest.NewRecorder(), r, "111.444.777-35") {
		t.Error("sem AUTH_API as regras de perfil não agem")
	}
}
