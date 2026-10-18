package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
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
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: secureCookie(),
		SameSite: http.SameSiteLaxMode, Expires: now.Add(sessionTTL), MaxAge: int(sessionTTL.Seconds())})
	return nil
}

func endSession(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
		_ = authDB.DeleteSession(hashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", HttpOnly: true, Secure: secureCookie(),
		SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(0, 0)})
}

func sessionMember(r *http.Request) (Member, bool) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return Member{}, false
	}
	m, err := authDB.SessionMember(hashToken(c.Value), time.Now())
	return m, err == nil
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

type access int

const (
	accPublic  access = iota // sem login, de propósito (lista abaixo)
	accAny                   // qualquer pessoa logada
	accManager               // Admin ou Gerente
	accAdmin                 // só Admin
)

// routeAccess é a ÚNICA tabela de quem pode o quê por rota. Cada exceção pública tem o motivo.
// Regras mais finas (origem do lead, CPF em escrita) ficam no handler: ver requireManagerFor.
func routeAccess(r *http.Request) access {
	p, m := r.URL.Path, r.Method
	switch {
	case !strings.HasPrefix(p, "/api/"):
		// /auth/* tem login/callback/logout/me, que se autenticam por conta própria. O resto nem existe (404).
		return accPublic
	case p == "/api/public/leads":
		// Captura de lead pelos formulários das LPs. Tem origem permitida, limite por IP e honeypot próprios.
		return accPublic
	case m == http.MethodGet && (p == "/api/blog/article" || p == "/api/blog/settings"):
		// O site (Next) lê o artigo publicado por slug e os textos da galeria sem login.
		return accPublic
	case m == http.MethodGet && p == "/api/blog/articles" && r.URL.Query().Get("published") == "true":
		// Lista do site: só publicados. Sem ?published=true entram rascunhos e exige login.
		return accPublic
	case strings.HasPrefix(p, "/api/team"):
		if m == http.MethodGet {
			return accAny // a lista (nome, e-mail, perfil) alimenta os seletores de responsável de qualquer tela
		}
		return accAdmin // convidar, trocar perfil e desativar
	case strings.HasPrefix(p, "/api/blog/"):
		return accManager // rascunhos, escrita e upload: Blog não é do Vendedor (docs/system-core.md)
	case strings.HasPrefix(p, "/api/pipelines") && m != http.MethodGet:
		return accManager // managePipelines: funis, fontes, tags e templates
	case strings.HasSuffix(p, "/document") && strings.HasPrefix(p, "/api/crm/people/"):
		return accManager // revealCpf
	}
	return accAny
}

func writeAuthErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func isWrite(method string) bool {
	return method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch || method == http.MethodDelete
}

// withAuth envolve TODO o mux. Ordem: CORS → preflight → anti-CSRF → sessão → perfil.
func withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		acc := routeAccess(r)
		if r.URL.Path == "/api/public/leads" {
			next.ServeHTTP(w, r) // CORS próprio (public_leads.go)
			return
		}
		setAuthCORS(w, r)
		if origin := r.Header.Get("Origin"); origin != "" && !authOriginOK(origin) && acc != accPublic {
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
		if acc == accPublic {
			next.ServeHTTP(w, r)
			return
		}
		m, ok := sessionMember(r)
		if !ok {
			writeAuthErr(w, http.StatusUnauthorized, "faça login")
			return
		}
		if (acc == accManager && !isManager(m.Role)) || (acc == accAdmin && m.Role != roleAdmin) {
			writeAuthErr(w, http.StatusForbidden, "seu perfil não tem permissão para isto")
			return
		}
		next.ServeHTTP(w, r.WithContext(withPrincipal(r.Context(), m)))
	})
}

// requireManagerFor é a checagem fina dentro do handler: com login ligado, só Admin/Gerente passam.
// Sem login ligado (AUTH_API desligado) devolve true e nada muda. Escreve o 403 quando nega.
func requireManagerFor(w http.ResponseWriter, r *http.Request, what string) bool {
	if !authEnabled() {
		return true
	}
	if m, ok := principalOf(r); ok && isManager(m.Role) {
		return true
	}
	writeAuthErr(w, http.StatusForbidden, "só Admin e Gerente podem "+what)
	return false
}

// actorFor: com login, o autor do histórico é a pessoa da sessão (o cliente não escolhe).
func actorFor(r *http.Request, sent string) string {
	if m, ok := principalOf(r); ok {
		if m.Name != "" {
			return m.Name
		}
		return m.Email
	}
	return sent
}
