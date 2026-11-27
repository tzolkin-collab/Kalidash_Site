package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// OAuth 2.1 do servidor MCP: qualquer provedor que fale MCP (claude.ai, ChatGPT, Cursor, Claude Code, VS Code…)
// conecta sozinho, sem token colado à mão. Segue a especificação de autorização do MCP:
//
//	GET  /.well-known/oauth-protected-resource      onde fica o servidor de autorização (RFC 9728)
//	GET  /.well-known/oauth-authorization-server    endpoints e capacidades (RFC 8414)
//	POST /oauth/register                            registro dinâmico do cliente (RFC 7591): nome, logo, redirects
//	GET  /oauth/authorize                           valida o pedido e manda para a tela de consentimento do admin
//	POST /oauth/token                               troca o código (PKCE S256) e renova tokens (refresh com rotação)
//
// O consentimento acontece no admin (/autorizar-agente), com a pessoa logada: ela vê o nome e a logo do provedor e
// aprova. O admin chama GET/POST /api/oauth/consent (sessão, nunca token) e recebe o endereço de volta com o código.
//
// O token de acesso (kmcp_at_…, 1 h) só alcança /api/mcp e age como a pessoa que aprovou: os escopos dela no momento
// da chamada (menos os de administração), então tirar um escopo da pessoa vale na hora. O refresh (kmcp_rt_…, 30 dias)
// gira a cada uso. No banco ficam só os hashes. Revogar a conexão em Configurações → MCP derruba os dois.

const (
	oauthAccessPrefix  = "kmcp_at_"
	oauthRefreshPrefix = "kmcp_rt_"
	oauthAccessTTL     = time.Hour
	oauthRefreshTTL    = 30 * 24 * time.Hour
	oauthCodeTTL       = 10 * time.Minute
	oauthScope         = "mcp"
)

// ---- modelos ----

type oauthClient struct {
	ID           string    `json:"clientId"`
	Name         string    `json:"name"`
	LogoURI      string    `json:"logoUri,omitempty"`
	ClientURI    string    `json:"clientUri,omitempty"`
	Domain       string    `json:"domain,omitempty"` // site do provedor (claude.ai, chatgpt.com…): de onde vem a logo
	RedirectURIs []string  `json:"redirectUris"`
	SecretHash   string    `json:"-"` // vazio: cliente público (só PKCE)
	CreatedAt    time.Time `json:"createdAt"`
}

type oauthCode struct {
	Hash, ClientID, MemberID, RedirectURI, Challenge, Resource string
	ExpiresAt                                                  time.Time
}

type oauthGrant struct {
	ID               string     `json:"id"`
	ClientID         string     `json:"clientId"`
	MemberID         string     `json:"memberId"`
	AccessHash       string     `json:"-"`
	RefreshHash      string     `json:"-"`
	AccessExpiresAt  time.Time  `json:"-"`
	RefreshExpiresAt time.Time  `json:"expiresAt"`
	CreatedAt        time.Time  `json:"createdAt"`
	LastUsedAt       *time.Time `json:"lastUsedAt,omitempty"`
	// preenchidos na listagem
	ClientName string `json:"clientName,omitempty"`
	LogoURI    string `json:"logoUri,omitempty"`
	Domain     string `json:"domain,omitempty"`
	MemberName string `json:"memberName,omitempty"`
}

var errOAuthNotFound = errors.New("não encontrado")

type mcpOAuthStore interface {
	CreateClient(c oauthClient) error
	Client(id string) (oauthClient, error)
	CreateCode(c oauthCode) error
	// ConsumeCode devolve o código e o marca como usado numa única operação (um código vale uma vez).
	ConsumeCode(hash string, now time.Time) (oauthCode, error)
	CreateGrant(g oauthGrant) error
	GrantByAccess(hash string, now time.Time) (oauthGrant, error)
	// RotateRefresh troca os dois hashes da concessão cujo refresh é oldHash (ativo) e devolve a concessão.
	RotateRefresh(oldHash string, g oauthGrant, now time.Time) (oauthGrant, error)
	TouchGrant(id string, now time.Time) error
	ListGrants(now time.Time) ([]oauthGrant, error)
	RevokeGrant(id string, now time.Time) (oauthGrant, error)
}

var oauthDB mcpOAuthStore = sqlOAuthStore{}

// ---- esquema ----

var mcpOAuthSchema = []string{
	`CREATE TABLE IF NOT EXISTS McpOAuthClient (
		id VARCHAR(64) PRIMARY KEY,
		name VARCHAR(120) NOT NULL,
		logoUri VARCHAR(500) NULL,
		clientUri VARCHAR(500) NULL,
		domain VARCHAR(190) NULL,
		redirectUris TEXT NOT NULL,
		secretHash VARCHAR(64) NULL,
		createdAt DATETIME(3) NOT NULL
	) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	`CREATE TABLE IF NOT EXISTS McpOAuthCode (
		codeHash VARCHAR(64) PRIMARY KEY,
		clientId VARCHAR(64) NOT NULL,
		memberId VARCHAR(191) NOT NULL,
		redirectUri VARCHAR(500) NOT NULL,
		challenge VARCHAR(128) NOT NULL,
		resource VARCHAR(500) NULL,
		expiresAt DATETIME(3) NOT NULL,
		usedAt DATETIME(3) NULL
	) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	`CREATE TABLE IF NOT EXISTS McpOAuthGrant (
		id VARCHAR(64) PRIMARY KEY,
		clientId VARCHAR(64) NOT NULL,
		memberId VARCHAR(191) NOT NULL,
		accessHash VARCHAR(64) NOT NULL,
		refreshHash VARCHAR(64) NOT NULL,
		accessExpiresAt DATETIME(3) NOT NULL,
		refreshExpiresAt DATETIME(3) NOT NULL,
		createdAt DATETIME(3) NOT NULL,
		lastUsedAt DATETIME(3) NULL,
		revokedAt DATETIME(3) NULL,
		UNIQUE KEY uq_mcp_access (accessHash),
		UNIQUE KEY uq_mcp_refresh (refreshHash),
		KEY idx_mcp_grant_client (clientId)
	) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
}

func ensureMCPOAuthSchema() {
	if db == nil {
		return
	}
	for _, q := range mcpOAuthSchema {
		if _, err := db.Exec(q); err != nil {
			log.Printf("⚠️ MCP OAuth: %v", err)
			return
		}
	}
	_, _ = db.Exec(`DELETE FROM McpOAuthCode WHERE expiresAt < ?`, time.Now().Add(-24*time.Hour))
	log.Println("✅ MCP com OAuth pronto (/.well-known/oauth-authorization-server)")
}

// ---- SQL ----

type sqlOAuthStore struct{}

func (sqlOAuthStore) CreateClient(c oauthClient) error {
	uris, _ := json.Marshal(c.RedirectURIs)
	_, err := db.Exec(`INSERT INTO McpOAuthClient (id, name, logoUri, clientUri, domain, redirectUris, secretHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Name, nullStr(c.LogoURI), nullStr(c.ClientURI), nullStr(c.Domain), string(uris), nullStr(c.SecretHash), c.CreatedAt)
	return err
}

func (sqlOAuthStore) Client(id string) (oauthClient, error) {
	var c oauthClient
	var logo, curi, dom, secret sql.NullString
	var uris string
	err := db.QueryRow(`SELECT id, name, logoUri, clientUri, domain, redirectUris, secretHash, createdAt FROM McpOAuthClient WHERE id = ?`, id).
		Scan(&c.ID, &c.Name, &logo, &curi, &dom, &uris, &secret, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return c, errOAuthNotFound
	}
	c.LogoURI, c.ClientURI, c.Domain, c.SecretHash = logo.String, curi.String, dom.String, secret.String
	_ = json.Unmarshal([]byte(uris), &c.RedirectURIs)
	return c, err
}

func (sqlOAuthStore) CreateCode(c oauthCode) error {
	_, err := db.Exec(`INSERT INTO McpOAuthCode (codeHash, clientId, memberId, redirectUri, challenge, resource, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		c.Hash, c.ClientID, c.MemberID, c.RedirectURI, c.Challenge, nullStr(c.Resource), c.ExpiresAt)
	return err
}

func (sqlOAuthStore) ConsumeCode(hash string, now time.Time) (oauthCode, error) {
	res, err := db.Exec(`UPDATE McpOAuthCode SET usedAt = ? WHERE codeHash = ? AND usedAt IS NULL AND expiresAt > ?`, now, hash, now)
	if err != nil {
		return oauthCode{}, err
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return oauthCode{}, errOAuthNotFound
	}
	var c oauthCode
	var resource sql.NullString
	err = db.QueryRow(`SELECT codeHash, clientId, memberId, redirectUri, challenge, resource, expiresAt FROM McpOAuthCode WHERE codeHash = ?`, hash).
		Scan(&c.Hash, &c.ClientID, &c.MemberID, &c.RedirectURI, &c.Challenge, &resource, &c.ExpiresAt)
	c.Resource = resource.String
	return c, err
}

func (sqlOAuthStore) CreateGrant(g oauthGrant) error {
	_, err := db.Exec(`INSERT INTO McpOAuthGrant (id, clientId, memberId, accessHash, refreshHash, accessExpiresAt, refreshExpiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		g.ID, g.ClientID, g.MemberID, g.AccessHash, g.RefreshHash, g.AccessExpiresAt, g.RefreshExpiresAt, g.CreatedAt)
	return err
}

const grantCols = `g.id, g.clientId, g.memberId, g.accessExpiresAt, g.refreshExpiresAt, g.createdAt, g.lastUsedAt, COALESCE(c.name, ''), COALESCE(c.logoUri, ''), COALESCE(c.domain, ''), COALESCE(m.name, m.email, '')`
const grantFrom = ` FROM McpOAuthGrant g LEFT JOIN McpOAuthClient c ON c.id = g.clientId LEFT JOIN TeamMember m ON m.id = g.memberId`

func scanGrant(sc interface{ Scan(...any) error }) (oauthGrant, error) {
	var g oauthGrant
	var used sql.NullTime
	err := sc.Scan(&g.ID, &g.ClientID, &g.MemberID, &g.AccessExpiresAt, &g.RefreshExpiresAt, &g.CreatedAt, &used, &g.ClientName, &g.LogoURI, &g.Domain, &g.MemberName)
	if errors.Is(err, sql.ErrNoRows) {
		return g, errOAuthNotFound
	}
	if used.Valid {
		g.LastUsedAt = &used.Time
	}
	return g, err
}

func (sqlOAuthStore) GrantByAccess(hash string, now time.Time) (oauthGrant, error) {
	return scanGrant(db.QueryRow(`SELECT `+grantCols+grantFrom+` WHERE g.accessHash = ? AND g.accessExpiresAt > ? AND g.revokedAt IS NULL`, hash, now))
}

func (sqlOAuthStore) RotateRefresh(oldHash string, g oauthGrant, now time.Time) (oauthGrant, error) {
	res, err := db.Exec(`UPDATE McpOAuthGrant SET accessHash = ?, refreshHash = ?, accessExpiresAt = ?, refreshExpiresAt = ? WHERE refreshHash = ? AND refreshExpiresAt > ? AND revokedAt IS NULL`,
		g.AccessHash, g.RefreshHash, g.AccessExpiresAt, g.RefreshExpiresAt, oldHash, now)
	if err != nil {
		return oauthGrant{}, err
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return oauthGrant{}, errOAuthNotFound
	}
	return scanGrant(db.QueryRow(`SELECT `+grantCols+grantFrom+` WHERE g.refreshHash = ?`, g.RefreshHash))
}

func (sqlOAuthStore) TouchGrant(id string, now time.Time) error {
	_, err := db.Exec(`UPDATE McpOAuthGrant SET lastUsedAt = ? WHERE id = ? AND (lastUsedAt IS NULL OR lastUsedAt < ?)`, now, id, now.Add(-time.Minute))
	return err
}

func (sqlOAuthStore) ListGrants(now time.Time) ([]oauthGrant, error) {
	rows, err := db.Query(`SELECT `+grantCols+grantFrom+` WHERE g.revokedAt IS NULL AND g.refreshExpiresAt > ? ORDER BY COALESCE(g.lastUsedAt, g.createdAt) DESC`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []oauthGrant{}
	for rows.Next() {
		g, err := scanGrant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (sqlOAuthStore) RevokeGrant(id string, now time.Time) (oauthGrant, error) {
	g, err := scanGrant(db.QueryRow(`SELECT `+grantCols+grantFrom+` WHERE g.id = ? AND g.revokedAt IS NULL`, id))
	if err != nil {
		return g, err
	}
	_, err = db.Exec(`UPDATE McpOAuthGrant SET revokedAt = ? WHERE id = ?`, now, id)
	return g, err
}

// ---- utilidades ----

func randomSecret(prefix string, n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err) // sem entropia não há o que fazer com segurança
	}
	return prefix + base64.RawURLEncoding.EncodeToString(b)
}

// publicBaseURL: o endereço público da API (issuer). PUBLIC_API_URL manda; sem ela, o host da requisição
// (atrás de proxy, X-Forwarded-Proto/Host).
func publicBaseURL(r *http.Request) string {
	if v := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_API_URL")), "/"); v != "" {
		return v
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if p := r.Header.Get("X-Forwarded-Proto"); p != "" {
		scheme = strings.TrimSpace(strings.Split(p, ",")[0])
	}
	host := r.Host
	if h := r.Header.Get("X-Forwarded-Host"); h != "" {
		host = strings.TrimSpace(strings.Split(h, ",")[0])
	}
	return scheme + "://" + host
}

func mcpResourceURL(r *http.Request) string { return publicBaseURL(r) + "/api/mcp" }

func resourceMetadataURL(r *http.Request) string {
	return publicBaseURL(r) + "/.well-known/oauth-protected-resource"
}

// mcpUnauthorized escreve o 401 que faz o cliente MCP descobrir o OAuth sozinho.
func mcpUnauthorized(w http.ResponseWriter, r *http.Request, errCode, msg string) {
	v := fmt.Sprintf(`Bearer realm="kalidash", resource_metadata="%s"`, resourceMetadataURL(r))
	if errCode != "" {
		v += fmt.Sprintf(`, error="%s"`, errCode)
	}
	w.Header().Set("WWW-Authenticate", v)
	writeAuthErr(w, http.StatusUnauthorized, msg)
}

func openCORS(w http.ResponseWriter) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version")
}

func oauthJSONError(w http.ResponseWriter, status int, code, desc string) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, status, map[string]string{"error": code, "error_description": desc})
}

func pkceOK(verifier, challenge string) bool {
	if len(verifier) < 43 || len(verifier) > 128 {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	got := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(got), []byte(challenge)) == 1
}

func isLoopbackHost(h string) bool {
	h = strings.Trim(h, "[]")
	if h == "localhost" {
		return true
	}
	ip := net.ParseIP(h)
	return ip != nil && ip.IsLoopback()
}

// validRedirectURI: https em qualquer host, http só em loopback (apps de desktop), ou esquema próprio do app
// (cursor://, vscode://). Nunca javascript:, data:, file: nem com fragmento.
func validRedirectURI(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Fragment != "" || len(raw) > 500 {
		return false
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		return u.Host != ""
	case "http":
		return isLoopbackHost(u.Hostname())
	case "javascript", "data", "file", "vbscript", "about", "blob":
		return false
	}
	return true
}

// redirectMatches: igual a um dos registrados; em loopback a porta pode mudar (RFC 8252, apps de desktop).
func redirectMatches(registered []string, got string) bool {
	for _, r := range registered {
		if r == got {
			return true
		}
	}
	gu, err := url.Parse(got)
	if err != nil || gu.Scheme != "http" || !isLoopbackHost(gu.Hostname()) {
		return false
	}
	for _, r := range registered {
		ru, err := url.Parse(r)
		if err == nil && ru.Scheme == "http" && ru.Hostname() == gu.Hostname() && ru.Path == gu.Path {
			return true
		}
	}
	return false
}

// Identidade do agente na tela de consentimento. Nome, client_uri e logo são DECLARADOS pelo próprio agente (o
// registro é aberto), então não provam nada: quem diz para onde o acesso vai é o redirect_uri. Em endereço https de
// fora, site e logo saem dele; só em app local (loopback ou esquema próprio, que não sai do computador) valem as
// informações declaradas.

// knownProviders: nome do cliente → sites do provedor (o primeiro é o usado quando só há o nome).
var knownProviders = []struct {
	match string
	hosts []string
}{
	{"claude", []string{"claude.ai", "claude.com", "anthropic.com"}}, {"anthropic", []string{"claude.ai", "claude.com", "anthropic.com"}},
	{"chatgpt", []string{"chatgpt.com", "openai.com"}}, {"openai", []string{"openai.com", "chatgpt.com"}},
	{"cursor", []string{"cursor.com", "cursor.sh"}},
	{"visual studio code", []string{"code.visualstudio.com", "vscode.dev", "github.dev"}}, {"vscode", []string{"code.visualstudio.com", "vscode.dev", "github.dev"}}, {"vs code", []string{"code.visualstudio.com", "vscode.dev", "github.dev"}},
	{"windsurf", []string{"windsurf.com", "codeium.com"}}, {"gemini", []string{"gemini.google.com", "google.com"}}, {"zed", []string{"zed.dev"}},
	{"n8n", []string{"n8n.io", "n8n.cloud"}}, {"mistral", []string{"mistral.ai"}}, {"perplexity", []string{"perplexity.ai"}},
	{"goose", []string{"block.github.io"}}, {"cline", []string{"cline.bot"}}, {"raycast", []string{"raycast.com"}},
}

func bareHost(h string) string { return strings.TrimPrefix(strings.ToLower(h), "www.") }

// sameSite: o próprio site ou um subdomínio dele (nunca o contrário, nem sufixo solto como "naoclaude.ai").
func sameSite(host, site string) bool { return host == site || strings.HasSuffix(host, "."+site) }

// claimedProvider: sites do provedor que o nome afirma ser, ou nil.
func claimedProvider(name string) []string {
	low := strings.ToLower(name)
	for _, k := range knownProviders {
		if strings.Contains(low, k.match) {
			return k.hosts
		}
	}
	return nil
}

// remoteHosts: hosts dos redirects https que saem do computador.
func remoteHosts(redirects []string) []string {
	out := []string{}
	for _, r := range redirects {
		if u, err := url.Parse(r); err == nil && strings.EqualFold(u.Scheme, "https") && u.Hostname() != "" && !isLoopbackHost(u.Hostname()) {
			out = append(out, bareHost(u.Hostname()))
		}
	}
	return out
}

// impostorHost: o primeiro destino remoto que não pertence ao provedor que o nome afirma ser ("" = nenhum).
func impostorHost(name string, redirects []string) string {
	sites := claimedProvider(name)
	if sites == nil {
		return ""
	}
	for _, h := range remoteHosts(redirects) {
		ok := false
		for _, s := range sites {
			ok = ok || sameSite(h, s)
		}
		if !ok {
			return h
		}
	}
	return ""
}

// providerDomain descobre o site mostrado para o agente: o destino remoto (o suspeito primeiro, quando há vários);
// em app local, o nome conhecido e depois o client_uri.
func providerDomain(name, clientURI string, redirects []string) string {
	if h := impostorHost(name, redirects); h != "" {
		return h
	}
	if hosts := remoteHosts(redirects); len(hosts) > 0 {
		return hosts[0]
	}
	if sites := claimedProvider(name); sites != nil {
		return sites[0]
	}
	if u, err := url.Parse(clientURI); err == nil && u.Scheme == "https" && u.Hostname() != "" {
		return bareHost(u.Hostname())
	}
	return ""
}

// providerLogo aceita a logo declarada só quando ela é do mesmo site do destino remoto (em app local não há destino
// remoto para comparar). Sem logo, a tela usa o ícone do site mostrado.
func providerLogo(logoURI string, redirects []string) string {
	hosts := remoteHosts(redirects)
	if len(hosts) == 0 {
		return logoURI
	}
	u, err := url.Parse(logoURI)
	if err != nil || u.Hostname() == "" {
		return ""
	}
	for _, h := range hosts {
		if !sameSite(bareHost(u.Hostname()), h) {
			return ""
		}
	}
	return logoURI
}

func httpsOrEmpty(raw string) string {
	raw = strings.TrimSpace(raw)
	if u, err := url.Parse(raw); err == nil && u.Scheme == "https" && u.Host != "" && len(raw) <= 500 {
		return raw
	}
	return ""
}

// limite simples por IP para o registro aberto (evita encher a tabela de clientes).
var (
	regMu   sync.Mutex
	regHits = map[string][]time.Time{}
)

func registerAllowed(ip string, now time.Time) bool {
	regMu.Lock()
	defer regMu.Unlock()
	keep := regHits[ip][:0]
	for _, t := range regHits[ip] {
		if now.Sub(t) < time.Hour {
			keep = append(keep, t)
		}
	}
	if len(keep) >= 20 {
		regHits[ip] = keep
		return false
	}
	regHits[ip] = append(keep, now)
	return true
}

// ---- rotas ----

func registerMCPOAuthRoutes(mux *http.ServeMux) {
	ensureMCPOAuthSchema()
	mux.HandleFunc("/.well-known/oauth-protected-resource", handleProtectedResourceMeta)
	mux.HandleFunc("/.well-known/oauth-protected-resource/", handleProtectedResourceMeta) // .../api/mcp
	mux.HandleFunc("/.well-known/oauth-authorization-server", handleAuthServerMeta)
	mux.HandleFunc("/.well-known/oauth-authorization-server/", handleAuthServerMeta)
	mux.HandleFunc("/.well-known/openid-configuration", handleAuthServerMeta) // alguns clientes procuram aqui
	mux.HandleFunc("/oauth/register", handleOAuthRegister)
	mux.HandleFunc("/oauth/authorize", handleOAuthAuthorize)
	mux.HandleFunc("/oauth/token", handleOAuthToken)
	mux.HandleFunc("/api/oauth/consent", handleOAuthConsent)
	mux.HandleFunc("/api/mcp/connections", handleMCPConnections)
	mux.HandleFunc("/api/mcp/connections/{id}", handleMCPConnectionByID)
}

// oauthBypass: rotas do OAuth que se protegem sozinhas (públicas por natureza, CORS aberto, sem cookie).
func oauthBypass(path string) bool {
	return strings.HasPrefix(path, "/.well-known/") || strings.HasPrefix(path, "/oauth/")
}

func handleProtectedResourceMeta(w http.ResponseWriter, r *http.Request) {
	openCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"resource":                 mcpResourceURL(r),
		"authorization_servers":    []string{publicBaseURL(r)},
		"scopes_supported":         []string{oauthScope},
		"bearer_methods_supported": []string{"header"},
		"resource_name":            "Kalidash CRM",
	})
}

func handleAuthServerMeta(w http.ResponseWriter, r *http.Request) {
	openCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	base := publicBaseURL(r)
	writeJSON(w, http.StatusOK, map[string]any{
		"issuer":                                base,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        base + "/oauth/token",
		"registration_endpoint":                 base + "/oauth/register",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":      []string{"S256"},
		"token_endpoint_auth_methods_supported": []string{"none", "client_secret_post", "client_secret_basic"},
		"scopes_supported":                      []string{oauthScope},
		"service_documentation":                 adminBase() + "/configuracoes",
	})
}

// adminBase: onde fica o admin (tela de consentimento). Sem ADMIN_URL, o admin local.
func adminBase() string {
	if u := adminURL(); u != "" {
		return u
	}
	return "http://localhost:5173"
}

// POST /oauth/register (RFC 7591).
func handleOAuthRegister(w http.ResponseWriter, r *http.Request) {
	openCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		oauthJSONError(w, http.StatusMethodNotAllowed, "invalid_request", "use POST")
		return
	}
	if !registerAllowed(clientIP(r), time.Now()) {
		oauthJSONError(w, http.StatusTooManyRequests, "invalid_request", "muitos registros deste endereço; tente mais tarde")
		return
	}
	var req struct {
		RedirectURIs []string `json:"redirect_uris"`
		ClientName   string   `json:"client_name"`
		ClientURI    string   `json:"client_uri"`
		LogoURI      string   `json:"logo_uri"`
		AuthMethod   string   `json:"token_endpoint_auth_method"`
		GrantTypes   []string `json:"grant_types"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
		oauthJSONError(w, http.StatusBadRequest, "invalid_client_metadata", "JSON inválido")
		return
	}
	if len(req.RedirectURIs) == 0 || len(req.RedirectURIs) > 10 {
		oauthJSONError(w, http.StatusBadRequest, "invalid_redirect_uri", "informe de 1 a 10 redirect_uris")
		return
	}
	for _, u := range req.RedirectURIs {
		if !validRedirectURI(u) {
			oauthJSONError(w, http.StatusBadRequest, "invalid_redirect_uri", "redirect_uri não aceito: "+u)
			return
		}
	}
	method := req.AuthMethod
	if method == "" {
		method = "none" // clientes MCP são públicos (PKCE); quem quiser segredo pede explicitamente
	}
	if method != "none" && method != "client_secret_post" && method != "client_secret_basic" {
		oauthJSONError(w, http.StatusBadRequest, "invalid_client_metadata", "token_endpoint_auth_method não suportado")
		return
	}
	name := strings.TrimSpace(req.ClientName)
	if name == "" {
		name = "Agente sem nome"
	}
	c := oauthClient{
		ID:           randomSecret("kmcp_c_", 12),
		Name:         clip(name, 120),
		LogoURI:      providerLogo(httpsOrEmpty(req.LogoURI), req.RedirectURIs),
		ClientURI:    httpsOrEmpty(req.ClientURI),
		RedirectURIs: req.RedirectURIs,
		CreatedAt:    time.Now(),
	}
	c.Domain = providerDomain(c.Name, c.ClientURI, c.RedirectURIs)
	resp := map[string]any{
		"client_id":                  c.ID,
		"client_id_issued_at":        c.CreatedAt.Unix(),
		"client_name":                c.Name,
		"redirect_uris":              c.RedirectURIs,
		"grant_types":                []string{"authorization_code", "refresh_token"},
		"response_types":             []string{"code"},
		"token_endpoint_auth_method": method,
	}
	if method != "none" {
		secret := randomSecret("kmcp_s_", 24)
		c.SecretHash = hashAPIToken(secret)
		resp["client_secret"] = secret
		resp["client_secret_expires_at"] = 0
	}
	if c.LogoURI != "" {
		resp["logo_uri"] = c.LogoURI
	}
	if c.ClientURI != "" {
		resp["client_uri"] = c.ClientURI
	}
	if err := oauthDB.CreateClient(c); err != nil {
		oauthJSONError(w, http.StatusInternalServerError, "server_error", "não foi possível registrar")
		return
	}
	log.Printf("MCP OAuth: cliente registrado %q (%s)", c.Name, c.Domain)
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusCreated, resp)
}

// authorizeParams: o pedido de autorização, como chega no /oauth/authorize e volta do admin no consentimento.
type authorizeParams struct {
	ClientID, RedirectURI, State, Challenge, Method, Resource, Scope string
}

func authorizeParamsFrom(q url.Values) authorizeParams {
	return authorizeParams{
		ClientID: q.Get("client_id"), RedirectURI: q.Get("redirect_uri"), State: q.Get("state"),
		Challenge: q.Get("code_challenge"), Method: q.Get("code_challenge_method"), Resource: q.Get("resource"), Scope: q.Get("scope"),
	}
}

// checkAuthorize valida o pedido. clientErr: não dá para devolver ao redirect (cliente ou redirect inválidos).
func checkAuthorize(p authorizeParams, responseType string) (c oauthClient, clientErr, redirectErr string) {
	c, err := oauthDB.Client(p.ClientID)
	if err != nil {
		return c, "cliente desconhecido: registre o agente de novo", ""
	}
	if p.RedirectURI == "" && len(c.RedirectURIs) == 1 {
		p.RedirectURI = c.RedirectURIs[0]
	}
	if !redirectMatches(c.RedirectURIs, p.RedirectURI) {
		return c, "redirect_uri diferente do registrado", ""
	}
	if responseType != "code" {
		return c, "", "unsupported_response_type"
	}
	if p.Challenge == "" || p.Method != "S256" {
		return c, "", "invalid_request" // PKCE S256 é obrigatório no OAuth 2.1
	}
	return c, "", ""
}

func redirectWith(base string, vals url.Values) string {
	u, err := url.Parse(base)
	if err != nil {
		return base
	}
	q := u.Query()
	for k, v := range vals {
		for _, x := range v {
			if x != "" {
				q.Set(k, x)
			}
		}
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// GET /oauth/authorize: confere o pedido e leva a pessoa à tela de consentimento do admin.
func handleOAuthAuthorize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "use GET", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query()
	p := authorizeParamsFrom(q)
	_, clientErr, redirectErr := checkAuthorize(p, q.Get("response_type"))
	if clientErr != "" {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, "Não foi possível conectar o agente ao Kalidash: %s.\n", clientErr)
		return
	}
	if redirectErr != "" {
		http.Redirect(w, r, redirectWith(p.RedirectURI, url.Values{"error": {redirectErr}, "state": {p.State}}), http.StatusFound)
		return
	}
	http.Redirect(w, r, adminBase()+"/autorizar-agente?"+q.Encode(), http.StatusFound)
}

// /api/oauth/consent: só a pessoa logada (sessão). GET mostra o pedido; POST aprova ou recusa.
func handleOAuthConsent(w http.ResponseWriter, r *http.Request) {
	m, ok := principalOf(r)
	if !ok || isTokenPrincipal(m) || isOAuthPrincipal(m) {
		writeAuthErr(w, http.StatusUnauthorized, "faça login no admin para autorizar o agente")
		return
	}
	switch r.Method {
	case http.MethodGet:
		q := r.URL.Query()
		p := authorizeParamsFrom(q)
		c, clientErr, redirectErr := checkAuthorize(p, q.Get("response_type"))
		if clientErr != "" || redirectErr != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": clientErr + redirectErr})
			return
		}
		tools := []map[string]string{}
		for i := range mcpTools {
			if mcpToolAllowed(m, &mcpTools[i]) {
				tools = append(tools, map[string]string{"name": mcpTools[i].Name, "title": mcpTools[i].Title})
			}
		}
		// A identidade vale para o destino DESTE pedido: um cliente pode registrar mais de um redirect.
		target := p.RedirectURI
		if target == "" && len(c.RedirectURIs) == 1 {
			target = c.RedirectURIs[0]
		}
		redirectHost := ""
		if u, err := url.Parse(target); err == nil {
			redirectHost = u.Scheme + "://" + u.Host
		}
		to := []string{target}
		writeJSON(w, http.StatusOK, map[string]any{
			"client":       map[string]string{"name": c.Name, "logoUri": providerLogo(c.LogoURI, to), "domain": providerDomain(c.Name, c.ClientURI, to)},
			"redirectHost": redirectHost,
			"local":        len(remoteHosts(to)) == 0,
			"mismatch":     impostorHost(c.Name, to) != "",
			"canConnect":   hasScope(m.Scopes, "mcp:use"),
			"member":       firstNonEmpty(m.Name, m.Email),
			"tools":        tools,
		})
	case http.MethodPost:
		var body struct {
			Params  map[string]string `json:"params"`
			Approve bool              `json:"approve"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		q := url.Values{}
		for k, v := range body.Params {
			q.Set(k, v)
		}
		p := authorizeParamsFrom(q)
		_, clientErr, redirectErr := checkAuthorize(p, q.Get("response_type"))
		if clientErr != "" || redirectErr != "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": clientErr + redirectErr})
			return
		}
		if !body.Approve {
			writeJSON(w, http.StatusOK, map[string]string{"redirect": redirectWith(p.RedirectURI, url.Values{"error": {"access_denied"}, "state": {p.State}})})
			return
		}
		if !hasScope(m.Scopes, "mcp:use") {
			writeAuthErr(w, http.StatusForbidden, "falta a permissão mcp:use para conectar agentes")
			return
		}
		code := randomSecret("kmcp_code_", 24)
		if err := oauthDB.CreateCode(oauthCode{
			Hash: hashAPIToken(code), ClientID: p.ClientID, MemberID: m.ID, RedirectURI: p.RedirectURI,
			Challenge: p.Challenge, Resource: p.Resource, ExpiresAt: time.Now().Add(oauthCodeTTL),
		}); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"redirect": redirectWith(p.RedirectURI, url.Values{"code": {code}, "state": {p.State}, "iss": {publicBaseURL(r)}})})
	default:
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
	}
}

// clientAuthOK confere o segredo de clientes confidenciais (post ou basic). Públicos só precisam do client_id.
func clientAuthOK(r *http.Request, c oauthClient) bool {
	if c.SecretHash == "" {
		return true
	}
	secret := r.PostForm.Get("client_secret")
	if id, s, ok := r.BasicAuth(); ok && id == c.ID {
		secret = s
	}
	return secret != "" && subtle.ConstantTimeCompare([]byte(hashAPIToken(secret)), []byte(c.SecretHash)) == 1
}

func issueTokens(w http.ResponseWriter, g oauthGrant, access, refresh string) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token":  access,
		"token_type":    "Bearer",
		"expires_in":    int(oauthAccessTTL.Seconds()),
		"refresh_token": refresh,
		"scope":         oauthScope,
	})
}

// POST /oauth/token.
func handleOAuthToken(w http.ResponseWriter, r *http.Request) {
	openCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		oauthJSONError(w, http.StatusMethodNotAllowed, "invalid_request", "use POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	if err := r.ParseForm(); err != nil {
		oauthJSONError(w, http.StatusBadRequest, "invalid_request", "corpo inválido")
		return
	}
	clientID := r.PostForm.Get("client_id")
	if id, _, ok := r.BasicAuth(); ok && clientID == "" {
		clientID = id
	}
	c, err := oauthDB.Client(clientID)
	if err != nil || !clientAuthOK(r, c) {
		oauthJSONError(w, http.StatusUnauthorized, "invalid_client", "cliente desconhecido ou segredo errado")
		return
	}
	now := time.Now()
	access, refresh := randomSecret(oauthAccessPrefix, 32), randomSecret(oauthRefreshPrefix, 32)
	next := oauthGrant{AccessHash: hashAPIToken(access), RefreshHash: hashAPIToken(refresh), AccessExpiresAt: now.Add(oauthAccessTTL), RefreshExpiresAt: now.Add(oauthRefreshTTL)}

	switch r.PostForm.Get("grant_type") {
	case "authorization_code":
		code, err := oauthDB.ConsumeCode(hashAPIToken(r.PostForm.Get("code")), now)
		if err != nil || code.ClientID != c.ID {
			oauthJSONError(w, http.StatusBadRequest, "invalid_grant", "código inválido, expirado ou já usado")
			return
		}
		if ru := r.PostForm.Get("redirect_uri"); ru != "" && ru != code.RedirectURI {
			oauthJSONError(w, http.StatusBadRequest, "invalid_grant", "redirect_uri diferente do pedido")
			return
		}
		if !pkceOK(r.PostForm.Get("code_verifier"), code.Challenge) {
			oauthJSONError(w, http.StatusBadRequest, "invalid_grant", "code_verifier não confere (PKCE)")
			return
		}
		next.ID, next.ClientID, next.MemberID, next.CreatedAt = wfID("mcpg"), c.ID, code.MemberID, now
		if err := oauthDB.CreateGrant(next); err != nil {
			oauthJSONError(w, http.StatusInternalServerError, "server_error", "não foi possível emitir o token")
			return
		}
		log.Printf("MCP OAuth: %q conectado por %s", c.Name, code.MemberID)
		issueTokens(w, next, access, refresh)
	case "refresh_token":
		g, err := oauthDB.RotateRefresh(hashAPIToken(r.PostForm.Get("refresh_token")), next, now)
		if err != nil || g.ClientID != c.ID {
			oauthJSONError(w, http.StatusBadRequest, "invalid_grant", "refresh token inválido, expirado ou revogado")
			return
		}
		issueTokens(w, g, access, refresh)
	default:
		oauthJSONError(w, http.StatusBadRequest, "unsupported_grant_type", "use authorization_code ou refresh_token")
	}
}

// ---- quem chama: o token OAuth vira a pessoa que aprovou ----

func isOAuthPrincipal(m Member) bool { return strings.HasPrefix(m.ID, "oauth:") }

func isOAuthAccessToken(secret string) bool { return strings.HasPrefix(secret, oauthAccessPrefix) }

// oauthPrincipal valida o token de acesso e devolve a pessoa (escopos de agora, sem os de administração).
func oauthPrincipal(secret string) (Member, mcpCaller, error) {
	now := time.Now()
	g, err := oauthDB.GrantByAccess(hashAPIToken(secret), now)
	if err != nil {
		return Member{}, mcpCaller{}, errTokenInvalid
	}
	person, err := authDB.MemberByID(g.MemberID)
	if err != nil || !person.Active {
		return Member{}, mcpCaller{}, errTokenInvalid
	}
	scopes := []string{}
	for _, s := range person.Scopes {
		if d, ok := scopeIndex[s]; ok && !d.HumanOnly {
			scopes = append(scopes, s)
		}
	}
	_ = oauthDB.TouchGrant(g.ID, now)
	name := g.ClientName + " · " + person.Name
	if person.Name == "" {
		name = g.ClientName + " · " + person.Email
	}
	m := Member{ID: "oauth:" + g.ID, Name: name, Email: person.Email, Role: person.Role, Active: true, Status: "ACTIVE", Scopes: scopes}
	caller := mcpCaller{Kind: "oauth", Provider: g.ClientName, LogoURI: g.LogoURI, Domain: g.Domain, Person: firstNonEmpty(person.Name, person.Email)}
	return m, caller, nil
}


// ---- conexões (aba MCP) ----

// GET /api/mcp/connections: agentes conectados por OAuth. Só pessoas (não token).
func handleMCPConnections(w http.ResponseWriter, r *http.Request) {
	m, ok := principalOf(r)
	if !ok || isTokenPrincipal(m) || isOAuthPrincipal(m) {
		writeAuthErr(w, http.StatusForbidden, "só pessoas logadas veem as conexões")
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	list, err := oauthDB.ListGrants(time.Now())
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// DELETE /api/mcp/connections/{id}: revoga. A própria conexão, ou qualquer uma com keys:manage.
func handleMCPConnectionByID(w http.ResponseWriter, r *http.Request) {
	m, ok := principalOf(r)
	if !ok || isTokenPrincipal(m) || isOAuthPrincipal(m) {
		writeAuthErr(w, http.StatusForbidden, "só pessoas logadas revogam conexões")
		return
	}
	if r.Method != http.MethodDelete {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	id := r.PathValue("id")
	list, err := oauthDB.ListGrants(time.Now())
	if err != nil {
		writeErr(w, err)
		return
	}
	var target *oauthGrant
	for i := range list {
		if list[i].ID == id {
			target = &list[i]
		}
	}
	if target == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "conexão não encontrada"})
		return
	}
	if target.MemberID != m.ID && !hasScope(m.Scopes, "keys:manage") {
		writeAuthErr(w, http.StatusForbidden, "só quem conectou, ou quem gerencia tokens, revoga esta conexão")
		return
	}
	if _, err := oauthDB.RevokeGrant(id, time.Now()); err != nil {
		writeErr(w, err)
		return
	}
	log.Printf("MCP OAuth: %s revogou a conexão %s (%s)", actorOf(r), id, target.ClientName)
	w.WriteHeader(http.StatusNoContent)
}
