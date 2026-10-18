package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Login com Google (OAuth 2.0, fluxo de código) — docs/auth-study.md. Só entra quem já está em
// TeamMember e ativo; qualquer outra conta Google recebe 403.
//
// O id_token é lido sem checar a assinatura porque chega direto do endpoint de token do Google, por
// TLS, na troca do `code` feita pelo servidor (OIDC Core §3.1.3.7 dispensa a verificação nesse caso).
// Conferimos iss, aud, exp e email_verified. O `code` só vale uma vez e só com o client_secret.

var (
	googleAuthURL  = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL = "https://oauth2.googleapis.com/token" // var: os testes apontam para um Google falso
	oauthCookie    = "kld_oauth"
)

func registerAuthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/auth/google/login", handleGoogleLogin)
	mux.HandleFunc("/auth/google/callback", handleGoogleCallback)
	mux.HandleFunc("/auth/logout", handleLogout)
	mux.HandleFunc("/auth/me", handleMe)
	mux.HandleFunc("/auth/dev/login", handleDevLogin)
	mux.HandleFunc("/api/team", handleTeam)
	mux.HandleFunc("/api/team/{id}", handleTeamByID)
}

func signState(state string) string {
	m := hmac.New(sha256.New, []byte(os.Getenv("SESSION_SECRET")))
	m.Write([]byte("oauth-state:" + state))
	return hex.EncodeToString(m.Sum(nil))
}

func adminURL() string { return strings.TrimRight(os.Getenv("ADMIN_URL"), "/") }

// GET /auth/google/login: gera o state anti-CSRF (cookie assinado + parâmetro) e manda para o Google.
func handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("GOOGLE_CLIENT_ID") == "" {
		writeAuthErr(w, http.StatusServiceUnavailable, "login com Google não configurado")
		return
	}
	state, err := newToken()
	if err != nil {
		writeAuthErr(w, http.StatusInternalServerError, "erro interno")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: oauthCookie, Value: state + "." + signState(state), Path: "/auth/google", HttpOnly: true,
		Secure: secureCookie(), SameSite: http.SameSiteLaxMode, MaxAge: 600})
	q := url.Values{
		"client_id":     {os.Getenv("GOOGLE_CLIENT_ID")},
		"redirect_uri":  {os.Getenv("GOOGLE_REDIRECT_URL")},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"state":         {state},
		"prompt":        {"select_account"},
	}
	if hd := os.Getenv("GOOGLE_HD"); hd != "" {
		q.Set("hd", hd)
	}
	http.Redirect(w, r, googleAuthURL+"?"+q.Encode(), http.StatusFound)
}

type googleClaims struct {
	Iss           string `json:"iss"`
	Aud           string `json:"aud"`
	Sub           string `json:"sub"`
	Exp           int64  `json:"exp"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	HD            string `json:"hd"`
}

func exchangeCode(code string) (googleClaims, error) {
	form := url.Values{
		"code":          {code},
		"client_id":     {os.Getenv("GOOGLE_CLIENT_ID")},
		"client_secret": {os.Getenv("GOOGLE_CLIENT_SECRET")},
		"redirect_uri":  {os.Getenv("GOOGLE_REDIRECT_URL")},
		"grant_type":    {"authorization_code"},
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).PostForm(googleTokenURL, form)
	if err != nil {
		return googleClaims{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return googleClaims{}, fmt.Errorf("o Google recusou o código (HTTP %d)", resp.StatusCode)
	}
	var tok struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil || tok.IDToken == "" {
		return googleClaims{}, errors.New("resposta do Google sem id_token")
	}
	return parseIDToken(tok.IDToken)
}

// parseIDToken decodifica e valida as claims (sem checar assinatura: ver o comentário do arquivo).
func parseIDToken(idToken string) (googleClaims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return googleClaims{}, errors.New("id_token malformado")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return googleClaims{}, errors.New("id_token malformado")
	}
	var c googleClaims
	if err := json.Unmarshal(raw, &c); err != nil {
		return googleClaims{}, errors.New("id_token malformado")
	}
	switch {
	case c.Iss != "https://accounts.google.com" && c.Iss != "accounts.google.com":
		return googleClaims{}, errors.New("emissor inesperado")
	case c.Aud != os.Getenv("GOOGLE_CLIENT_ID"):
		return googleClaims{}, errors.New("token de outro aplicativo")
	case c.Exp <= time.Now().Unix():
		return googleClaims{}, errors.New("token expirado")
	case c.Sub == "" || c.Email == "":
		return googleClaims{}, errors.New("token sem identidade")
	case !c.EmailVerified:
		return googleClaims{}, errors.New("e-mail não verificado pelo Google")
	}
	if hd := os.Getenv("GOOGLE_HD"); hd != "" && !strings.EqualFold(c.HD, hd) {
		return googleClaims{}, errors.New("conta fora do domínio permitido")
	}
	c.Email = normEmail(c.Email)
	return c, nil
}

func denyPage(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	back := ""
	if u := adminURL(); u != "" {
		back = `<p><a href="` + html.EscapeString(u) + `">Voltar ao login</a></p>`
	}
	fmt.Fprintf(w, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kalidash</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem"><h1>Acesso negado</h1><p>%s</p>%s`, html.EscapeString(msg), back)
}

// memberForGoogle acha a pessoa da equipe: primeiro pelo googleSub (fixo), depois pelo e-mail
// convidado (que então ganha o vínculo). Conta Google diferente da já vinculada é recusada.
func memberForGoogle(c googleClaims) (Member, error) {
	m, err := authDB.MemberBySub(c.Sub)
	if err == nil {
		return m, nil
	}
	if !errors.Is(err, errMemberNotFound) {
		return Member{}, err
	}
	m, err = authDB.MemberByEmail(c.Email)
	if err != nil {
		return Member{}, err
	}
	if m.GoogleSub != "" && m.GoogleSub != c.Sub {
		return Member{}, errMemberNotFound
	}
	return m, nil
}

// GET /auth/google/callback
func handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	ck, err := r.Cookie(oauthCookie)
	http.SetCookie(w, &http.Cookie{Name: oauthCookie, Value: "", Path: "/auth/google", MaxAge: -1, HttpOnly: true, Secure: secureCookie(), SameSite: http.SameSiteLaxMode})
	state := r.URL.Query().Get("state")
	var cookieState, sig string
	if err == nil {
		cookieState, sig, _ = strings.Cut(ck.Value, ".")
	}
	if state == "" || cookieState == "" ||
		subtle.ConstantTimeCompare([]byte(state), []byte(cookieState)) != 1 ||
		subtle.ConstantTimeCompare([]byte(sig), []byte(signState(cookieState))) != 1 {
		denyPage(w, http.StatusBadRequest, "A tentativa de login expirou ou não é válida. Tente entrar de novo.")
		return
	}
	if e := r.URL.Query().Get("error"); e != "" {
		denyPage(w, http.StatusForbidden, "O login com o Google foi cancelado.")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		denyPage(w, http.StatusBadRequest, "Resposta do Google sem código.")
		return
	}
	claims, err := exchangeCode(code)
	if err != nil {
		log.Println("⚠️ AUTH: troca de código:", err)
		denyPage(w, http.StatusForbidden, "Não foi possível confirmar sua conta Google.")
		return
	}
	m, err := memberForGoogle(claims)
	if errors.Is(err, errMemberNotFound) || (err == nil && !m.Active) {
		log.Printf("⚠️ AUTH: acesso negado a %s (fora da equipe ou desativado)", claims.Email)
		denyPage(w, http.StatusForbidden, "Esta conta não faz parte da equipe do Kalidash. Peça a um Admin para convidar o seu e-mail.")
		return
	}
	if err != nil {
		log.Println("❌ AUTH:", err)
		denyPage(w, http.StatusInternalServerError, "Erro interno. Tente de novo.")
		return
	}
	if err := authDB.TouchLogin(m.ID, claims.Sub, claims.Name, claims.Picture); err != nil {
		log.Println("❌ AUTH:", err)
		denyPage(w, http.StatusInternalServerError, "Erro interno. Tente de novo.")
		return
	}
	if err := startSession(w, r, m.ID); err != nil {
		log.Println("❌ AUTH:", err)
		denyPage(w, http.StatusInternalServerError, "Erro interno. Tente de novo.")
		return
	}
	dest := adminURL()
	if dest == "" {
		dest = "/"
	}
	http.Redirect(w, r, dest, http.StatusFound)
}

// POST /auth/logout: revoga a sessão no servidor e limpa o cookie.
func handleLogout(w http.ResponseWriter, r *http.Request) {
	setAuthCORS(w, r)
	if r.Method != http.MethodPost {
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}
	endSession(w, r)
	w.WriteHeader(http.StatusNoContent)
}

// GET /auth/me: quem sou eu. 401 diz também quais formas de entrar existem (a tela de login usa).
func handleMe(w http.ResponseWriter, r *http.Request) {
	setAuthCORS(w, r)
	if r.Method != http.MethodGet {
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	m, ok := sessionMember(w, r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "faça login", "google": os.Getenv("GOOGLE_CLIENT_ID") != "", "dev": devLoginOn()})
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func devLoginOn() bool { return os.Getenv("AUTH_DEV_LOGIN") == "1" }

func isLoopback(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback() && r.Header.Get("X-Forwarded-For") == ""
}

// POST /auth/dev/login {"email": "..."}: entrada SEM Google, só para desenvolvimento. Exige
// AUTH_DEV_LOGIN=1, conexão vinda do próprio computador (loopback, sem proxy) e que o e-mail já esteja
// na equipe e ativo (use AUTH_BOOTSTRAP_ADMIN). Nunca ligue isto em produção.
func handleDevLogin(w http.ResponseWriter, r *http.Request) {
	setAuthCORS(w, r)
	if !devLoginOn() || !isLoopback(r) {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}
	var in struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&in); err != nil {
		writeAuthErr(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	m, err := authDB.MemberByEmail(normEmail(in.Email))
	if err != nil || !m.Active {
		writeAuthErr(w, http.StatusForbidden, "e-mail fora da equipe")
		return
	}
	if err := authDB.TouchLogin(m.ID, "", m.Name, m.AvatarURL); err != nil {
		writeAuthErr(w, http.StatusInternalServerError, "erro interno")
		return
	}
	if err := startSession(w, r, m.ID); err != nil {
		writeAuthErr(w, http.StatusInternalServerError, "erro interno")
		return
	}
	m, _ = authDB.MemberByID(m.ID)
	writeJSON(w, http.StatusOK, m)
}

// ---- equipe: GET/POST /api/team e PUT/PATCH/DELETE /api/team/{id} (só Admin: routeAccess) ----

func handleTeam(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := authDB.ListMembers()
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var in struct {
			Email, Name, Role string
		}
		r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeAuthErr(w, http.StatusBadRequest, "corpo inválido")
			return
		}
		in.Email = normEmail(in.Email)
		if !validEmail(in.Email) {
			writeAuthErr(w, http.StatusUnprocessableEntity, "e-mail inválido")
			return
		}
		if !validRoles[in.Role] {
			writeAuthErr(w, http.StatusUnprocessableEntity, "perfil inválido")
			return
		}
		by, _ := principalOf(r)
		m, err := authDB.AddMember(Member{Email: in.Email, Name: clean(in.Name, 200), Role: in.Role}, by.ID)
		if errors.Is(err, errMemberExists) {
			writeAuthErr(w, http.StatusConflict, err.Error())
			return
		} else if err != nil {
			writeErr(w, err)
			return
		}
		log.Printf("AUTH: %s convidou %s como %s", by.Email, m.Email, m.Role)
		writeJSON(w, http.StatusCreated, m)
	default:
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
	}
}

func handleTeamByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeAuthErr(w, http.StatusBadRequest, "id inválido")
		return
	}
	var name, role *string
	var active *bool
	switch r.Method {
	case http.MethodGet:
		m, err := authDB.MemberByID(id)
		if err != nil {
			teamErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, m)
		return
	case http.MethodPut, http.MethodPatch:
		var in struct {
			Name   *string `json:"name"`
			Role   *string `json:"role"`
			Active *bool   `json:"active"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeAuthErr(w, http.StatusBadRequest, "corpo inválido")
			return
		}
		if in.Role != nil && !validRoles[*in.Role] {
			writeAuthErr(w, http.StatusUnprocessableEntity, "perfil inválido")
			return
		}
		if in.Name != nil {
			n := clean(*in.Name, 200)
			in.Name = &n
		}
		name, role, active = in.Name, in.Role, in.Active
	case http.MethodDelete: // remover = desativar (a pessoa fica no histórico e pode ser reativada)
		f := false
		active = &f
	default:
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}
	if target, err := authDB.MemberByID(id); err == nil && root(target) &&
		((role != nil && *role != roleAdmin) || (active != nil && !*active)) {
		writeAuthErr(w, http.StatusConflict, "esta é a conta Admin raiz, definida no servidor (AUTH_ROOT_ADMIN): não pode ser rebaixada nem desativada pela tela")
		return
	}
	me, _ := principalOf(r)
	if me.ID == id && ((role != nil && *role != me.Role) || (active != nil && !*active)) {
		writeAuthErr(w, http.StatusConflict, "você não pode mudar nem desativar o seu próprio acesso")
		return
	}
	m, err := authDB.UpdateMember(id, name, role, active)
	if err != nil {
		teamErr(w, err)
		return
	}
	if !m.Active {
		_ = authDB.DeleteMemberSessions(id)
	}
	log.Printf("AUTH: %s alterou %s (perfil %s, ativo %v)", me.Email, m.Email, m.Role, m.Active)
	writeJSON(w, http.StatusOK, m)
}

func root(m Member) bool { return rootAdminEmail() != "" && m.Email == rootAdminEmail() }

func teamErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errMemberNotFound):
		writeAuthErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errLastAdmin):
		writeAuthErr(w, http.StatusConflict, err.Error())
	default:
		writeErr(w, err)
	}
}
