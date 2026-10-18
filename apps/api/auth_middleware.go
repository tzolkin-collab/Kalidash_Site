package main

import (
	"context"
	"errors"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"os"
	"time"
)

// Sessão, CORS e proteção das rotas (AUTH_API=1).
//
// Sessão: token aleatório de 32 bytes num cookie HttpOnly. No banco fica só o HMAC-SHA256 dele
// (chave SESSION_SECRET), então um vazamento do banco não entrega sessões. Escolhi sessão opaca
// no servidor em vez de JWT: o perfil e a desativação valem na hora (cada requisição relê o membro)
// e o logout revoga de verdade. O custo é uma consulta por requisição, irrelevante nesta escala.

const (
	sessionCookie = "kld_session"
	sessionTTL    = 7 * 24 * time.Hour
)

type ctxKey struct{}

// principalOf devolve quem está logado nesta requisição. Com AUTH_API desligado devolve (_, false).
func principalOf(r *http.Request) (Member, bool) {
	m, ok := r.Context().Value(ctxKey{}).(Member)
	return m, ok
}

func withPrincipal(ctx context.Context, m Member) context.Context {
	return context.WithValue(ctx, ctxKey{}, m)
}

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	m := hmac.New(sha256.New, []byte(os.Getenv("SESSION_SECRET")))
	m.Write([]byte(token))
	return hex.EncodeToString(m.Sum(nil))
}

func secureCookie() bool { return os.Getenv("AUTH_COOKIE_INSECURE") != "1" }

// startSession cria a sessão no servidor e escreve o cookie.
func startSession(w http.ResponseWriter, r *http.Request, memberID string) error {
	token, err := newToken()
	if err != nil {
		return err
	}
	now := time.Now()
	_ = authDB.PurgeExpired(now)
	if err := authDB.CreateSession(hashToken(token), memberID, clientIP(r), r.UserAgent(), now.Add(sessionTTL)); err != nil {
		return err
	}
	setSessionCookie(w, token, now.Add(sessionTTL))
	return nil
}

func setSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: secureCookie(),
		SameSite: http.SameSiteLaxMode, Expires: expires, MaxAge: int(time.Until(expires).Seconds())})
}

func endSession(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		_ = authDB.DeleteSession(hashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", HttpOnly: true, Secure: secureCookie(),
		SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(0, 0)})
}

// sessionMember valida o cookie e RENOVA a sessão: ela dura 7 dias a partir do último uso. Para não
// escrever no banco a cada requisição, só renova quando já passou da metade do prazo.
func sessionMember(w http.ResponseWriter, r *http.Request) (Member, bool) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return Member{}, false
	}
	now := time.Now()
	hash := hashToken(c.Value)
	m, err := authDB.SessionMember(hash, now)
	if err != nil {
		return Member{}, false
	}
	if ok, _ := authDB.ExtendSession(hash, now.Add(sessionTTL), now.Add(sessionTTL/2)); ok {
		setSessionCookie(w, c.Value, now.Add(sessionTTL))
	}
	return m, true
}

// ---- CORS ----

// authOriginOK: com login, só as origens listadas (nunca "*", nunca lista vazia).
func authOriginOK(origin string) bool {
	list := configuredOrigins()
	return len(list) > 0 && originAllowed(origin, list)
}

// setAuthCORS libera o navegador do admin a chamar com cookie. Origem fora da lista: nenhum
// cabeçalho CORS, e o navegador bloqueia a resposta.
func setAuthCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Vary", "Origin")
	origin := r.Header.Get("Origin")
	if origin == "" || !authOriginOK(origin) {
		return
	}
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", origin)
	h.Set("Access-Control-Allow-Credentials", "true")
	h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type")
	h.Set("Access-Control-Expose-Headers", "X-Total-Count")
}

// ---- política de acesso por rota ----
// A tabela de quem pode o quê por rota é routeScope (auth_scopes.go); aqui só se aplica.

func writeAuthErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func isWrite(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

// withAuth envolve TODO o mux. Ordem: CORS → preflight → anti-CSRF → credencial → escopo.
// Credencial: "Authorization: Bearer kld_live_…" (token de API) ou o cookie de sessão (pessoa logada).
func withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		scope, public := routeScope(r)
		if r.URL.Path == "/api/public/leads" {
			next.ServeHTTP(w, r) // CORS próprio (public_leads.go)
			return
		}
		setAuthCORS(w, r)
		if origin := r.Header.Get("Origin"); origin != "" && !authOriginOK(origin) && !public {
			// requisição de navegador vinda de fora da lista (inclui preflight)
			writeAuthErr(w, http.StatusForbidden, "origem não permitida")
			return
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		// Anti-CSRF além do SameSite: escrita com cookie só de origem conhecida (também nas rotas /auth).
		if isWrite(r.Method) {
			if origin := r.Header.Get("Origin"); origin != "" && !authOriginOK(origin) {
				writeAuthErr(w, http.StatusForbidden, "origem não permitida")
				return
			}
		}
		if public {
			next.ServeHTTP(w, r)
			return
		}
		var m Member
		if secret, has := bearerToken(r); has {
			var err error
			if m, _, err = tokenPrincipal(r, secret); err != nil {
				if errors.Is(err, errTokenInvalid) {
					w.Header().Set("WWW-Authenticate", `Bearer realm="kalidash"`)
					writeAuthErr(w, http.StatusUnauthorized, "token inválido, expirado ou revogado")
				} else {
					writeErr(w, err)
				}
				return
			}
			if !tokenAllowed(scope) {
				writeAuthErr(w, http.StatusForbidden, "tokens de API não alcançam esta rota")
				return
			}
		} else {
			var ok bool
			if m, ok = sessionMember(w, r); !ok {
				writeAuthErr(w, http.StatusUnauthorized, "faça login")
				return
			}
		}
		if scope != "" && !hasScope(m.Scopes, scope) {
			writeAuthErr(w, http.StatusForbidden, "falta a permissão "+scope)
			return
		}
		next.ServeHTTP(w, r.WithContext(withPrincipal(r.Context(), m)))
	})
}

// requireScopeFor é a checagem fina dentro do handler: com login ligado, só quem tem o escopo passa.
// Sem login ligado (AUTH_API desligado) devolve true e nada muda. Escreve o 403 quando nega.
func requireScopeFor(w http.ResponseWriter, r *http.Request, scope, what string) bool {
	if !authEnabled() {
		return true
	}
	if m, ok := principalOf(r); ok && hasScope(m.Scopes, scope) {
		return true
	}
	writeAuthErr(w, http.StatusForbidden, "falta a permissão "+scope+" para "+what)
	return false
}

// actorFor: com login, o autor do histórico é a pessoa da sessão (ou o token), o cliente não escolhe.
func actorFor(r *http.Request, sent string) string {
	if m, ok := principalOf(r); ok {
		if m.Name != "" {
			return m.Name
		}
		return m.Email
	}
	return sent
}
