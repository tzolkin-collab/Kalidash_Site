package main

import (
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// Entrada do connect.js e da API direta (WP2). Um endpoint só, que cria um LEAD v2 (tabela Lead) na
// pipeline do projeto, com fonte e formulário do projeto. Não cria Oportunidade (POST /api/public/leads
// continua como está até o WP3 migrá-lo; decisão D6).
//
//	POST /api/connect/leads   Authorization: Bearer kld_(live|test)_…   corpo: docs/inbound-leads.md §3
//	GET  /api/connect/config  mesma chave: formulários rastreados do projeto (o connect.js lê)
//	GET  /connect.js          o snippet
//
// Ordem das barreiras (a mais barata primeiro): limite por IP → token (401) → escopo forms:write e só escopos
// publicáveis (403) → projeto ativo e Origin do projeto (403) → limite por token (429) → corpo → honeypot → validação.
// Sem cabeçalho Origin (servidor para servidor) a checagem de origem não se aplica: a chave vale como o segredo
// do projeto, e quem a tem num HTML tem o mesmo poder que o snippet (por isso ela só escreve leads, e há limites).

//go:embed connect_script.js
var connectScript []byte

var (
	connectRateIP    = envInt("CONNECT_RATE_IP", 10)     // envios por minuto por IP
	connectRateToken = envInt("CONNECT_RATE_TOKEN", 60)  // envios por minuto por chave
	connectRateCfg   = envInt("CONNECT_RATE_CONFIG", 60) // leituras de configuração por minuto por IP
)

func envInt(name string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(name)); err == nil && n > 0 {
		return n
	}
	return def
}

const connectBodyLimit = 16 << 10

// connectCORS responde o preflight (que não leva o token) e marca a origem permitida nas respostas reais.
func connectCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Vary", "Origin")
	if origin := r.Header.Get("Origin"); origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "600")
	}
}

func connectErr(w http.ResponseWriter, status int, msg string) {
	if status == http.StatusUnauthorized {
		w.Header().Set("WWW-Authenticate", `Bearer realm="kalidash-connect"`)
	}
	if status == http.StatusTooManyRequests {
		w.Header().Set("Retry-After", "60")
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

// connectAuth confere o token e o projeto. Escreve a resposta de erro e devolve ok=false se algo falhar.
// Quando passa, o CORS fica restrito à origem do projeto.
func connectAuth(w http.ResponseWriter, r *http.Request, ipBucket string, ipLimit int) (APIToken, Project, bool) {
	now := time.Now()
	if !allowRateLimit(ipBucket+clientIP(r), ipLimit, now) {
		connectErr(w, http.StatusTooManyRequests, "muitas tentativas, tente em instantes")
		return APIToken{}, Project{}, false
	}
	secret, has := bearerToken(r)
	if !has || secret == "" {
		connectErr(w, http.StatusUnauthorized, "envie a chave em Authorization: Bearer")
		return APIToken{}, Project{}, false
	}
	_, tok, err := tokenPrincipal(r, secret)
	if err != nil {
		if err == errTokenInvalid {
			connectErr(w, http.StatusUnauthorized, "chave inválida, expirada ou revogada")
		} else {
			log.Println("❌ connect:", err)
			connectErr(w, http.StatusInternalServerError, "erro interno")
		}
		return APIToken{}, Project{}, false
	}
	if !hasScope(tok.Scopes, "forms:write") {
		connectErr(w, http.StatusForbidden, "a chave não tem o escopo forms:write")
		return tok, Project{}, false
	}
	for _, s := range tok.Scopes {
		if !publishableScope(s) {
			// Defesa: o servidor nem emite uma chave assim (validateTokenScopes), mas o banco pode ter sido editado.
			connectErr(w, http.StatusForbidden, "chave com escopo de leitura não pode ser usada no snippet nem na entrada de formulários")
			return tok, Project{}, false
		}
	}
	if tok.ProjectID == "" {
		connectErr(w, http.StatusForbidden, "a chave não está ligada a um projeto")
		return tok, Project{}, false
	}
	p, err := connectDB.ProjectByID(tok.ProjectID)
	if err != nil || p.ArchivedAt != nil {
		connectErr(w, http.StatusForbidden, "projeto desconectado")
		return tok, Project{}, false
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		if !p.originAllowed(origin) {
			connectErr(w, http.StatusForbidden, "origem não permitida para este projeto")
			return tok, p, false
		}
		connectCORS(w, r)
	}
	return tok, p, true
}

func handleConnectConfig(w http.ResponseWriter, r *http.Request) {
	if !connectEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method == http.MethodOptions {
		connectCORS(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	tok, p, ok := connectAuth(w, r, "connect-cfg:", connectRateCfg)
	if !ok {
		return
	}
	forms, err := connectDB.FormsOf(p.ID)
	if err != nil {
		writeErr(w, err)
		return
	}
	type pubForm struct {
		ID              string            `json:"id"`
		Name            string            `json:"name"`
		Selector        string            `json:"selector"`
		Fields          map[string]string `json:"fields"`
		ConsentSelector string            `json:"consentSelector,omitempty"`
	}
	out := make([]pubForm, 0, len(forms))
	for _, f := range forms {
		out = append(out, pubForm{f.ID, f.Name, f.Selector, f.Fields, f.ConsentSelector})
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"project": map[string]string{"id": p.ID, "name": p.Name}, "env": tok.Env, "forms": out})
}

func handleConnectScript(w http.ResponseWriter, r *http.Request) {
	if !connectEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		methodNotAllowed(w)
		return
	}
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if r.Method == http.MethodGet {
		w.Write(connectScript)
	}
}

// strOf lê um valor de texto do JSON (número e booleano viram texto; o resto, vazio).
func strOf(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(x)
	}
	return ""
}

// firstOf devolve o primeiro valor não vazio entre as chaves (nomes em português e os equivalentes em inglês).
func firstOf(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s := strings.TrimSpace(strOf(m[k])); s != "" {
			return s
		}
	}
	return ""
}

var attributionKeys = map[string]bool{"utm_source": true, "utm_medium": true, "utm_campaign": true, "utm_content": true, "utm_term": true, "referrer": true, "device": true, "page_url": true}

func handleConnectLead(w http.ResponseWriter, r *http.Request) {
	if !connectEnabled() {
		http.NotFound(w, r)
		return
	}
	if r.Method == http.MethodOptions {
		connectCORS(w, r)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	tok, p, ok := connectAuth(w, r, "connect-ip:", connectRateIP)
	if !ok {
		return
	}
	if !allowRateLimit("connect-tok:"+tok.ID, connectRateToken, time.Now()) {
		connectErr(w, http.StatusTooManyRequests, "limite de envios desta chave atingido, tente em instantes")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, connectBodyLimit)
	var in struct {
		Form        string         `json:"form"`
		Lead        map[string]any `json:"lead"`
		Website     string         `json:"website"` // honeypot
		Attribution map[string]any `json:"attribution"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		connectErr(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	// Honeypot: responde sucesso para o robô não insistir, mas não grava nada.
	if strings.TrimSpace(in.Website) != "" || strings.TrimSpace(strOf(in.Lead["website"])) != "" || strings.TrimSpace(strOf(in.Lead["_hp"])) != "" {
		writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
		return
	}

	name := clean(firstOf(in.Lead, "nome", "name"), 255)
	email := strings.ToLower(clean(firstOf(in.Lead, "email"), 255))
	phone := clean(firstOf(in.Lead, "telefone", "phone"), 40)
	switch {
	case name == "":
		connectErr(w, http.StatusUnprocessableEntity, "informe o nome")
		return
	case email != "" && !emailRe.MatchString(email):
		connectErr(w, http.StatusUnprocessableEntity, "e-mail inválido")
		return
	case phone != "" && (len(digits(phone)) < 8 || len(digits(phone)) > 15):
		connectErr(w, http.StatusUnprocessableEntity, "telefone inválido")
		return
	case email == "" && phone == "":
		connectErr(w, http.StatusUnprocessableEntity, "informe ao menos um contato (e-mail ou telefone)")
		return
	}

	var form *TrackedForm
	formSel := clean(in.Form, 255)
	if forms, err := connectDB.FormsOf(p.ID); err == nil {
		for i := range forms {
			if formSel != "" && forms[i].Selector == formSel {
				form = &forms[i]
				break
			}
		}
	}

	custom := map[string]any{"projectId": p.ID, "projectName": p.Name, "env": tok.Env, "tokenId": tok.ID}
	if r.Header.Get("Origin") != "" {
		custom["via"] = "connect.js"
	} else {
		custom["via"] = "api"
	}
	if form != nil {
		custom["formId"], custom["formName"] = form.ID, form.Name
	} else if formSel != "" {
		custom["formSelector"] = formSel
	}
	for _, k := range []string{"empresa", "cargo", "interesse"} {
		if v := clean(firstOf(in.Lead, k), 255); v != "" {
			custom[k] = v
		}
	}
	attr := map[string]string{}
	for k, v := range in.Attribution {
		if attributionKeys[k] {
			if s := clean(strOf(v), 500); s != "" {
				attr[k] = s
			}
		}
	}
	if len(attr) > 0 {
		custom["attribution"] = attr
	}
	if tok.Env == "test" {
		custom["test"] = true
	}

	tags := []string{"Inbound", p.Name}
	if form != nil {
		tags = append(tags, form.Name)
	}
	if tok.Env == "test" {
		tags = append(tags, "Teste")
	}
	lead, err := connectDB.IngestLead(inboundLead{
		Project: p, Form: form, Name: name, Email: email, Phone: phone,
		Message: clean(firstOf(in.Lead, "mensagem", "message"), 2000), Tags: cleanStrings(tags, 60), Custom: custom,
		Test: tok.Env == "test", Actor: "Connect: " + p.Name, ClientIP: clientIP(r),
	})
	if err != nil {
		log.Println("❌ connect: lead do projeto", p.ID, "-", err)
		connectErr(w, http.StatusInternalServerError, "não foi possível registrar agora")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "id": lead.ID})
}
