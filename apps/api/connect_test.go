package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// Testes de unidade do WP2 (projetos conectados, chaves do snippet, entrada do connect.js), sem banco:
// armazenamento de projetos em memória, o mesmo de tokens e sessões do auth_test.go.

type memConnect struct {
	mu       sync.Mutex
	projects map[string]*Project
	forms    map[string]*TrackedForm
	leads    []inboundLead
}

func newMemConnect() *memConnect {
	return &memConnect{projects: map[string]*Project{}, forms: map[string]*TrackedForm{}}
}

func (s *memConnect) ListProjects() ([]Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Project{}
	for _, p := range s.projects {
		if p.ArchivedAt == nil {
			out = append(out, *p)
		}
	}
	return out, nil
}
func (s *memConnect) ProjectByID(id string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p, ok := s.projects[id]; ok {
		return *p, nil
	}
	return Project{}, errNotFound
}
func (s *memConnect) SaveProject(p *Project, replace bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[p.ID]; ok != replace {
		return errNotFound
	}
	c := *p
	c.CreatedAt = &FlexTime{time.Now()}
	s.projects[p.ID] = &c
	return nil
}
func (s *memConnect) ArchiveProject(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[id]
	if !ok || p.ArchivedAt != nil {
		return errNotFound
	}
	p.ArchivedAt = &FlexTime{time.Now()}
	return nil
}
func (s *memConnect) FormsOf(projectID string) ([]TrackedForm, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []TrackedForm{}
	for _, f := range s.forms {
		if f.ProjectID == projectID {
			out = append(out, *f)
		}
	}
	return out, nil
}
func (s *memConnect) FormByID(projectID, id string) (TrackedForm, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if f, ok := s.forms[id]; ok && f.ProjectID == projectID {
		return *f, nil
	}
	return TrackedForm{}, errNotFound
}
func (s *memConnect) SaveForm(f *TrackedForm, replace bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := *f
	s.forms[f.ID] = &c
	return nil
}
func (s *memConnect) DeleteForm(projectID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if f, ok := s.forms[id]; !ok || f.ProjectID != projectID {
		return errNotFound
	}
	delete(s.forms, id)
	return nil
}
func (s *memConnect) IngestLead(in inboundLead) (LeadDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.leads = append(s.leads, in)
	return LeadDTO{ID: "l-test", Name: in.Name, Email: in.Email}, nil
}

type connectEnv struct {
	*authEnv
	cs      *memConnect
	project Project
	admin   *http.Cookie
}

const testLPOrigin = "https://lp.exemplo.com.br"

func setupConnect(t *testing.T) *connectEnv {
	t.Helper()
	e := setupAuth(t)
	t.Setenv("CRM_API", "1")
	t.Setenv("WORKFLOW_API", "")
	cs := newMemConnect()
	old := connectDB
	connectDB = cs
	t.Cleanup(func() { connectDB = old })
	oi, ot, oc := connectRateIP, connectRateToken, connectRateCfg
	connectRateIP, connectRateToken, connectRateCfg = 1000, 1000, 1000
	t.Cleanup(func() { connectRateIP, connectRateToken, connectRateCfg = oi, ot, oc })
	rateMu.Lock()
	rateHits = map[string][]time.Time{}
	rateMu.Unlock()

	mux := http.NewServeMux()
	registerAuthRoutes(mux)
	registerConnectRoutes(mux)
	mux.HandleFunc("/api/crm/leads", enableCORS(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	e.h = withAuth(mux)

	adm := e.member("adm@kalidash.test", roleAdmin)
	c := &connectEnv{authEnv: e, cs: cs, admin: e.login(adm)}
	rec := c.admin2("POST", "/api/projects", `{"name":"LP Consultoria","url":"`+testLPOrigin+`/oferta","pipelineId":"pl-1","stageId":"pl-1:novos","sourceName":"LP Consultoria","origins":["https://www.exemplo.com.br"]}`)
	if rec.Code != 201 {
		t.Fatalf("criar projeto: %d %s", rec.Code, rec.Body)
	}
	json.Unmarshal(rec.Body.Bytes(), &c.project)
	return c
}

func (c *connectEnv) admin2(method, path, body string) *httptest.ResponseRecorder {
	return c.do(method, path, c.admin, map[string]string{"Origin": testAdminOrigin}, body)
}

// token cria um token pela API (como o admin faria) e devolve o segredo.
func (c *connectEnv) token(body string) (string, *httptest.ResponseRecorder) {
	rec := c.admin2("POST", "/api/tokens", body)
	var out struct {
		Token string `json:"token"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	return out.Token, rec
}

func (c *connectEnv) snippetKey(env string) string {
	c.t.Helper()
	tok, rec := c.token(`{"name":"Connect","scopes":["forms:write"],"env":"` + env + `","projectId":"` + c.project.ID + `"}`)
	if rec.Code != 201 {
		c.t.Fatalf("criar chave do snippet: %d %s", rec.Code, rec.Body)
	}
	return tok
}

func (c *connectEnv) post(key, origin, body string) *httptest.ResponseRecorder {
	h := map[string]string{"Content-Type": "application/json"}
	if key != "" {
		h["Authorization"] = "Bearer " + key
	}
	if origin != "" {
		h["Origin"] = origin
	}
	return c.do("POST", "/api/connect/leads", nil, h, body)
}

const okLead = `{"form":"#contato","lead":{"nome":"Maria Souza","email":"MARIA@exemplo.com","telefone":"11999998888","empresa":"Acme","interesse":"Consultoria","mensagem":"Quero saber mais"},"attribution":{"utm_source":"google","utm_campaign":"x","page_url":"https://lp.exemplo.com.br/oferta","evil":"drop"}}`

func TestChaveDoSnippetRegras(t *testing.T) {
	c := setupConnect(t)
	cases := []struct {
		name, body string
		want       int
	}{
		{"forms:write sem projeto", `{"name":"x","scopes":["forms:write"]}`, 422},
		{"forms:write misturado com leitura", `{"name":"x","scopes":["forms:write","leads:read"],"projectId":"` + c.project.ID + `"}`, 422},
		{"leitura ligada a projeto", `{"name":"x","scopes":["leads:read"],"projectId":"` + c.project.ID + `"}`, 422},
		{"projeto inexistente", `{"name":"x","scopes":["forms:write"],"projectId":"nao-existe"}`, 422},
		{"ambiente inválido", `{"name":"x","scopes":["forms:write"],"env":"prod","projectId":"` + c.project.ID + `"}`, 422},
		{"chave de teste do snippet", `{"name":"x","scopes":["forms:write"],"env":"test","projectId":"` + c.project.ID + `"}`, 201},
		{"chave de servidor de leitura", `{"name":"x","scopes":["leads:read"]}`, 201},
		{"ads:read sozinho", `{"name":"x","scopes":["ads:read"]}`, 201},
	}
	for _, tc := range cases {
		if _, rec := c.token(tc.body); rec.Code != tc.want {
			t.Errorf("%s: %d (%s), queria %d", tc.name, rec.Code, strings.TrimSpace(rec.Body.String()), tc.want)
		}
	}
	tok, rec := c.token(`{"name":"teste","scopes":["forms:write"],"env":"test","projectId":"` + c.project.ID + `"}`)
	if !strings.HasPrefix(tok, "kld_test_") {
		t.Errorf("prefixo da chave de teste: %q", tok)
	}
	var out struct{ Meta APIToken }
	json.Unmarshal(rec.Body.Bytes(), &out)
	if out.Meta.Env != "test" || out.Meta.ProjectID != c.project.ID || out.Meta.Prefix != tok[:tokenVisibleN] {
		t.Errorf("ficha: %+v", out.Meta)
	}
	if live := c.snippetKey("live"); !strings.HasPrefix(live, "kld_live_") {
		t.Errorf("prefixo live: %q", live)
	}
}

func TestEntradaCriaLeadV2(t *testing.T) {
	c := setupConnect(t)
	key := c.snippetKey("test")

	rec := c.post(key, testLPOrigin, okLead)
	if rec.Code != 201 {
		t.Fatalf("envio: %d %s", rec.Code, rec.Body)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != testLPOrigin {
		t.Errorf("CORS da origem do projeto: %v", rec.Header())
	}
	if len(c.cs.leads) != 1 {
		t.Fatalf("leads gravados: %d", len(c.cs.leads))
	}
	in := c.cs.leads[0]
	if in.Name != "Maria Souza" || in.Email != "maria@exemplo.com" || in.Phone != "11999998888" || in.Message != "Quero saber mais" {
		t.Errorf("campos: %+v", in)
	}
	if in.Project.PipelineID != "pl-1" || in.Project.StageID != "pl-1:novos" || in.Project.SourceName != "LP Consultoria" {
		t.Errorf("pipeline/fonte do projeto: %+v", in.Project)
	}
	if !in.Test || !contains(in.Tags, "Teste") || !contains(in.Tags, "Inbound") || !contains(in.Tags, "LP Consultoria") {
		t.Errorf("tags/teste: %v %v", in.Tags, in.Test)
	}
	attr, _ := in.Custom["attribution"].(map[string]string)
	if attr["utm_source"] != "google" || attr["evil"] != "" || in.Custom["via"] != "connect.js" || in.Custom["empresa"] != "Acme" || in.Custom["env"] != "test" {
		t.Errorf("custom: %+v", in.Custom)
	}
	// sem Origin (servidor para servidor) também entra, marcado como API
	if rec := c.post(key, "", okLead); rec.Code != 201 || c.cs.leads[1].Custom["via"] != "api" {
		t.Errorf("sem Origin: %d %v", rec.Code, c.cs.leads[1].Custom)
	}
	// origem extra do projeto
	if rec := c.post(key, "https://www.exemplo.com.br", okLead); rec.Code != 201 {
		t.Errorf("origem extra: %d", rec.Code)
	}
	// o formulário cadastrado é reconhecido pelo seletor
	c.admin2("POST", "/api/projects/"+c.project.ID+"/forms", `{"name":"Contato","selector":"#contato","fields":{"nome":"#n"}}`)
	c.post(key, testLPOrigin, okLead)
	last := c.cs.leads[len(c.cs.leads)-1]
	if last.Form == nil || last.Custom["formName"] != "Contato" || !contains(last.Tags, "Contato") {
		t.Errorf("formulário rastreado: %+v", last)
	}
}

func contains(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

func TestEntradaNegaOQueNaoDeve(t *testing.T) {
	c := setupConnect(t)
	key := c.snippetKey("live")
	before := func() int { return len(c.cs.leads) }

	if rec := c.post("", testLPOrigin, okLead); rec.Code != 401 {
		t.Errorf("sem chave: %d", rec.Code)
	}
	if rec := c.post("kld_live_inventada1234567890123456", testLPOrigin, okLead); rec.Code != 401 {
		t.Errorf("chave inventada: %d", rec.Code)
	}
	// origem fora do projeto
	rec := c.post(key, "https://malvado.example", okLead)
	if rec.Code != 403 || rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("origem fora do projeto: %d %v", rec.Code, rec.Header())
	}
	// origem do admin também não vale para o projeto
	if rec := c.post(key, testAdminOrigin, okLead); rec.Code != 403 {
		t.Errorf("origem do admin: %d", rec.Code)
	}
	// chave de leitura: sem forms:write -> 403
	read, _ := c.token(`{"name":"leitor","scopes":["leads:read"]}`)
	if rec := c.post(read, testLPOrigin, okLead); rec.Code != 403 {
		t.Errorf("leads:read na entrada: %d", rec.Code)
	}
	// chave com forms:write + leitura (banco adulterado) -> 403
	mixed, _ := c.token(`{"name":"m","scopes":["forms:write"],"projectId":"` + c.project.ID + `"}`)
	mt := tokenDB.(*memTokens)
	mt.mu.Lock()
	for i := range mt.list {
		if mt.hashes[mt.list[i].ID] == hashAPIToken(mixed) {
			mt.list[i].Scopes = []string{"forms:write", "leads:read"}
		}
	}
	mt.mu.Unlock()
	if rec := c.post(mixed, testLPOrigin, okLead); rec.Code != 403 || !strings.Contains(rec.Body.String(), "leitura") {
		t.Errorf("chave de leitura no snippet: %d %s", rec.Code, rec.Body)
	}
	// a chave do snippet não passa em nenhuma outra rota
	for _, p := range [][2]string{{"GET", "/api/crm/leads"}, {"GET", "/api/projects"}, {"GET", "/api/tokens"}} {
		if rec := c.do(p[0], p[1], nil, map[string]string{"Authorization": "Bearer " + key}, ""); rec.Code != 403 {
			t.Errorf("chave do snippet em %s: %d", p[1], rec.Code)
		}
	}
	// validação
	for _, body := range []string{`{"lead":{"email":"a@b.co"}}`, `{"lead":{"nome":"Ana","email":"ruim"}}`, `{"lead":{"nome":"Ana"}}`, `{"lead":{"nome":"Ana","telefone":"12"}}`, `nao-json`} {
		if rec := c.post(key, testLPOrigin, body); rec.Code != 422 && rec.Code != 400 {
			t.Errorf("validação %q: %d", body, rec.Code)
		}
	}
	// honeypot: sucesso de mentira, nada gravado
	n := before()
	for _, body := range []string{`{"website":"http://spam","lead":{"nome":"Bot","email":"bot@x.co"}}`, `{"lead":{"nome":"Bot","email":"bot@x.co","website":"x"}}`} {
		if rec := c.post(key, testLPOrigin, body); rec.Code != 201 {
			t.Errorf("honeypot: %d", rec.Code)
		}
	}
	if before() != n {
		t.Error("honeypot não pode gravar lead")
	}
	// corpo grande demais
	if rec := c.post(key, testLPOrigin, `{"lead":{"nome":"`+strings.Repeat("a", connectBodyLimit)+`"}}`); rec.Code != 400 {
		t.Errorf("corpo grande: %d", rec.Code)
	}
	if before() != n {
		t.Errorf("nada disso podia gravar lead: %d", before()-n)
	}
}

func TestEntradaRevogadaEProjetoDesconectado(t *testing.T) {
	c := setupConnect(t)
	key := c.snippetKey("live")
	if rec := c.post(key, testLPOrigin, okLead); rec.Code != 201 {
		t.Fatalf("antes de revogar: %d", rec.Code)
	}
	var list []APIToken
	json.Unmarshal(c.admin2("GET", "/api/tokens", "").Body.Bytes(), &list)
	var id string
	for _, tk := range list {
		if tk.ProjectID == c.project.ID {
			id = tk.ID
		}
	}
	if rec := c.admin2("DELETE", "/api/tokens/"+id, ""); rec.Code != 200 {
		t.Fatalf("revogar: %d", rec.Code)
	}
	if rec := c.post(key, testLPOrigin, okLead); rec.Code != 401 {
		t.Errorf("chave revogada: %d, queria 401", rec.Code)
	}
	// projeto arquivado: a chave nova também para de valer
	key2 := c.snippetKey("live")
	if rec := c.admin2("DELETE", "/api/projects/"+c.project.ID, ""); rec.Code != 200 {
		t.Fatalf("desconectar projeto: %d", rec.Code)
	}
	if rec := c.post(key2, testLPOrigin, okLead); rec.Code != 403 {
		t.Errorf("projeto desconectado: %d", rec.Code)
	}
}

func TestEntradaLimiteDeTaxa(t *testing.T) {
	c := setupConnect(t)
	key := c.snippetKey("test")
	connectRateIP, connectRateToken = 3, 1000
	rateMu.Lock()
	rateHits = map[string][]time.Time{}
	rateMu.Unlock()
	var codes []int
	for i := 0; i < 5; i++ {
		codes = append(codes, c.post(key, testLPOrigin, okLead).Code)
	}
	if codes[0] != 201 || codes[2] != 201 || codes[3] != 429 || codes[4] != 429 {
		t.Errorf("limite por IP (3/min): %v", codes)
	}
	if rec := c.post(key, testLPOrigin, okLead); rec.Header().Get("Retry-After") == "" {
		t.Error("429 sem Retry-After")
	}
	// IP diferente passa, até bater no limite da chave
	connectRateIP, connectRateToken = 1000, 2
	rateMu.Lock()
	rateHits = map[string][]time.Time{}
	rateMu.Unlock()
	codes = nil
	for i := 0; i < 4; i++ {
		r := httptest.NewRequest("POST", "/api/connect/leads", strings.NewReader(okLead))
		r.Header.Set("Authorization", "Bearer "+key)
		r.Header.Set("X-Forwarded-For", "203.0.113."+string(rune('1'+i)))
		rec := httptest.NewRecorder()
		c.h.ServeHTTP(rec, r)
		codes = append(codes, rec.Code)
	}
	if codes[0] != 201 || codes[1] != 201 || codes[2] != 429 || codes[3] != 429 {
		t.Errorf("limite por chave (2/min, IPs diferentes): %v", codes)
	}
}

func TestPreflightScriptEConfig(t *testing.T) {
	c := setupConnect(t)
	key := c.snippetKey("live")
	c.admin2("POST", "/api/projects/"+c.project.ID+"/forms", `{"name":"Contato","selector":"#contato","fields":{"nome":"#n"},"consentSelector":"#lgpd"}`)

	rec := c.do("OPTIONS", "/api/connect/leads", nil, map[string]string{"Origin": testLPOrigin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"}, "")
	if rec.Code != 204 || rec.Header().Get("Access-Control-Allow-Origin") != testLPOrigin || !strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Errorf("preflight: %d %v", rec.Code, rec.Header())
	}
	rec = c.do("GET", "/connect.js", nil, nil, "")
	if rec.Code != 200 || !strings.Contains(rec.Header().Get("Content-Type"), "javascript") || !strings.Contains(rec.Body.String(), "/api/connect/leads") {
		t.Errorf("connect.js: %d %v", rec.Code, rec.Header())
	}
	if strings.Contains(rec.Body.String(), "kld_live_") && strings.Count(rec.Body.String(), "kld_live_") > 3 {
		t.Error("o script não pode carregar chave nenhuma")
	}
	rec = c.do("GET", "/api/connect/config", nil, map[string]string{"Authorization": "Bearer " + key, "Origin": testLPOrigin}, "")
	var cfg struct {
		Env   string `json:"env"`
		Forms []struct{ Selector, ConsentSelector string }
	}
	json.Unmarshal(rec.Body.Bytes(), &cfg)
	if rec.Code != 200 || cfg.Env != "live" || len(cfg.Forms) != 1 || cfg.Forms[0].Selector != "#contato" || cfg.Forms[0].ConsentSelector != "#lgpd" {
		t.Errorf("config: %d %s", rec.Code, rec.Body)
	}
	if rec := c.do("GET", "/api/connect/config", nil, map[string]string{"Authorization": "Bearer " + key, "Origin": "https://malvado.example"}, ""); rec.Code != 403 {
		t.Errorf("config de origem estranha: %d", rec.Code)
	}
}

func TestProjetosSoAdminEGerente(t *testing.T) {
	c := setupConnect(t)
	ven := c.member("ven@kalidash.test", roleSeller)
	ger := c.member("ger@kalidash.test", roleManager)
	vc, gc := c.login(ven), c.login(ger)
	if rec := c.do("GET", "/api/projects", vc, nil, ""); rec.Code != 403 {
		t.Errorf("Vendedor lista projetos: %d", rec.Code)
	}
	if rec := c.do("POST", "/api/projects", vc, map[string]string{"Origin": testAdminOrigin}, `{"name":"x","url":"https://x.com.br","pipelineId":"a","stageId":"b"}`); rec.Code != 403 {
		t.Errorf("Vendedor cria projeto: %d", rec.Code)
	}
	if rec := c.do("GET", "/api/projects", gc, nil, ""); rec.Code != 200 {
		t.Errorf("Gerente lista projetos: %d", rec.Code)
	}
	if rec := c.do("POST", "/api/tokens", gc, map[string]string{"Origin": testAdminOrigin}, `{"name":"g","scopes":["forms:write"],"projectId":"`+c.project.ID+`"}`); rec.Code != 201 {
		t.Errorf("Gerente emite chave do snippet: %d %s", rec.Code, rec.Body)
	}
	if rec := c.do("POST", "/api/tokens", vc, map[string]string{"Origin": testAdminOrigin}, `{"name":"v","scopes":["forms:write"],"projectId":"`+c.project.ID+`"}`); rec.Code != 403 {
		t.Errorf("Vendedor emite chave: %d", rec.Code)
	}
	// validação do projeto
	for _, body := range []string{`{"url":"https://x.com.br","pipelineId":"a","stageId":"b"}`, `{"name":"x","url":"ftp://x","pipelineId":"a","stageId":"b"}`, `{"name":"x","url":"https://x.com.br","pipelineId":"a"}`, `{"name":"x","url":"https://x.com.br","pipelineId":"a","stageId":"b","origins":["x.com"]}`} {
		if rec := c.admin2("POST", "/api/projects", body); rec.Code != 422 {
			t.Errorf("projeto inválido %s: %d", body, rec.Code)
		}
	}
	if rec := c.admin2("PUT", "/api/projects/"+c.project.ID, `{"name":"Novo nome","url":"`+testLPOrigin+`","pipelineId":"pl-1","stageId":"pl-1:novos"}`); rec.Code != 200 {
		t.Errorf("editar projeto: %d %s", rec.Code, rec.Body)
	}
	if p, _ := c.cs.ProjectByID(c.project.ID); p.Name != "Novo nome" || p.SourceName != "Novo nome" {
		t.Errorf("projeto editado: %+v", p)
	}
}

func TestConexaoDesligadaSemAsFlags(t *testing.T) {
	t.Setenv("CRM_API", "")
	t.Setenv("AUTH_API", "")
	if connectEnabled() {
		t.Fatal("a conexão só liga com CRM_API=1 e AUTH_API=1")
	}
	for _, h := range []http.HandlerFunc{handleConnectLead, handleConnectConfig, handleConnectScript} {
		rec := httptest.NewRecorder()
		h(rec, httptest.NewRequest("POST", "/x", nil))
		if rec.Code != 404 {
			t.Errorf("com as flags desligadas devia ser 404, veio %d", rec.Code)
		}
	}
	t.Setenv("CRM_API", "1")
	if connectEnabled() {
		t.Error("CRM_API sem AUTH_API não liga")
	}
}

func TestOriginPatternsDoProjeto(t *testing.T) {
	for o, want := range map[string]bool{
		"https://a.com.br": true, "http://localhost:3000": true, "https://*.vercel.app": true, "https://a.com.br/x": false,
		"a.com": false, "ftp://a.com": false, "*.a.com": false, "https://*": false,
	} {
		if got := validOriginPattern(o); got != want {
			t.Errorf("%s: %v, queria %v", o, got, want)
		}
	}
	p := Project{URL: "https://lp.exemplo.com.br/oferta", Origins: []string{"https://*.vercel.app"}}
	for o, want := range map[string]bool{"https://lp.exemplo.com.br": true, "https://x.vercel.app": true, "https://exemplo.com.br": false, "http://lp.exemplo.com.br": false} {
		if p.originAllowed(o) != want {
			t.Errorf("origem %s: %v", o, !want)
		}
	}
}
