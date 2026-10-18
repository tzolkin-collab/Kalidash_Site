package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
)

// Tokens de API (AUTH_API=1): acesso de sistemas e automações, com escopos escolhidos na criação.
//
//   - formato  kld_live_<32 caracteres aleatórios>  (256 bits; o gancho do WP2 acrescenta kld_test_)
//   - guardado só o SHA-256 do token (a entropia alta dispensa sal/HMAC e não depende de SESSION_SECRET),
//     mais um prefixo e os 4 últimos caracteres para a pessoa reconhecer qual é qual
//   - o token completo aparece UMA vez, na resposta da criação
//   - NÃO expira por padrão; expiresAt é opcional
//   - revogação é imediata: cada requisição consulta o banco (sem cache)
//   - vai em  Authorization: Bearer <token>; o escopo exigido por rota é o de auth_scopes.go (routeScope)
//   - token nunca recebe escopos "humanOnly" (team:manage, keys:manage) nem alcança /api/team (escrita) e /api/tokens
//   - os escopos de um token são limitados aos que quem o criou tem na hora da criação
// O que sobra para o WP2: chaves kld_test_, projetos conectados, endpoint de entrada do connect.js,
// limite de taxa por chave e escopos forms:write/analytics:write/ads:read (acrescentar em scopeCatalog).

const (
	tokenPrefix    = "kld_live_"
	tokenTouchGap  = time.Minute // "último uso" é gravado no máximo 1x por minuto por token
	tokenNameMax   = 120
	tokenVisibleN  = len(tokenPrefix) + 4 // prefixo + 4 primeiros caracteres aleatórios
	tokenAuthLabel = "API: "
)

var (
	errTokenNotFound = errors.New("token não encontrado")
	errTokenInvalid  = errors.New("token inválido")
)

// APIToken é a ficha de um token (nunca contém o segredo).
type APIToken struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Prefix        string    `json:"prefix"`
	Last4         string    `json:"last4"`
	Scopes        []string  `json:"scopes"`
	CreatedBy     string    `json:"createdBy,omitempty"`
	CreatedByName string    `json:"createdByName,omitempty"`
	CreatedAt     FlexTime  `json:"createdAt"`
	ExpiresAt     *FlexTime `json:"expiresAt,omitempty"`
	LastUsedAt    *FlexTime `json:"lastUsedAt,omitempty"`
	LastUsedIP    string    `json:"lastUsedIp,omitempty"`
	RevokedAt     *FlexTime `json:"revokedAt,omitempty"`
	Status        string    `json:"status"` // ACTIVE | EXPIRED | REVOKED
}

func (t *APIToken) derive(now time.Time) {
	switch {
	case t.RevokedAt != nil:
		t.Status = "REVOKED"
	case t.ExpiresAt != nil && !t.ExpiresAt.After(now):
		t.Status = "EXPIRED"
	default:
		t.Status = "ACTIVE"
	}
}

type tokenStore interface {
	CreateToken(t APIToken, hash string) error
	ListTokens() ([]APIToken, error)
	TokenByHash(hash string) (APIToken, error)
	// RevokeToken é idempotente: revogar de novo devolve a ficha como está.
	RevokeToken(id, by string, at time.Time) (APIToken, error)
	// TouchToken grava o último uso, no máximo uma vez por `gap`.
	TouchToken(id, ip string, now time.Time, gap time.Duration) error
}

var tokenDB tokenStore = sqlTokenStore{}

type sqlTokenStore struct{}

const tokenCols = `t.id, t.name, t.prefix, t.last4, t.scopes, COALESCE(t.createdBy, ''), COALESCE(m.name, ''), COALESCE(m.email, ''), t.createdAt, t.expiresAt, t.lastUsedAt, t.lastUsedIp, t.revokedAt`
const tokenFrom = ` FROM ApiToken t LEFT JOIN TeamMember m ON m.id = t.createdBy`

func scanToken(sc interface{ Scan(...any) error }) (APIToken, error) {
	var t APIToken
	var scopes, byName, byEmail, created string
	var exp, used, ip, rev sql.NullString
	if err := sc.Scan(&t.ID, &t.Name, &t.Prefix, &t.Last4, &scopes, &t.CreatedBy, &byName, &byEmail, &created, &exp, &used, &ip, &rev); err != nil {
		return APIToken{}, err
	}
	t.Scopes = splitScopes(scopes)
	t.CreatedByName = byName
	if t.CreatedByName == "" {
		t.CreatedByName = byEmail
	}
	if c := flexFrom(created); c != nil {
		t.CreatedAt = *c
	}
	t.ExpiresAt, t.LastUsedAt, t.RevokedAt, t.LastUsedIP = flexFrom(exp.String), flexFrom(used.String), flexFrom(rev.String), ip.String
	t.derive(time.Now())
	return t, nil
}

func (sqlTokenStore) CreateToken(t APIToken, hash string) error {
	_, err := db.Exec(`INSERT INTO ApiToken (id, name, prefix, last4, tokenHash, scopes, createdBy, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.Name, t.Prefix, t.Last4, hash, strings.Join(t.Scopes, ","), nullStr(t.CreatedBy), t.CreatedAt.Time, ptrTime(t.ExpiresAt))
	return err
}

func (sqlTokenStore) ListTokens() ([]APIToken, error) {
	rows, err := db.Query(`SELECT ` + tokenCols + tokenFrom + ` ORDER BY t.createdAt DESC, t.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []APIToken{}
	for rows.Next() {
		t, err := scanToken(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (sqlTokenStore) TokenByHash(hash string) (APIToken, error) {
	t, err := scanToken(db.QueryRow(`SELECT `+tokenCols+tokenFrom+` WHERE t.tokenHash = ?`, hash))
	if errors.Is(err, sql.ErrNoRows) {
		return APIToken{}, errTokenNotFound
	}
	return t, err
}

func (sqlTokenStore) RevokeToken(id, by string, at time.Time) (APIToken, error) {
	if _, err := db.Exec(`UPDATE ApiToken SET revokedAt = ?, revokedBy = ? WHERE id = ? AND revokedAt IS NULL`, at, nullStr(by), id); err != nil {
		return APIToken{}, err
	}
	t, err := scanToken(db.QueryRow(`SELECT `+tokenCols+tokenFrom+` WHERE t.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return APIToken{}, errTokenNotFound
	}
	return t, err
}

func (sqlTokenStore) TouchToken(id, ip string, now time.Time, gap time.Duration) error {
	_, err := db.Exec(`UPDATE ApiToken SET lastUsedAt = ?, lastUsedIp = ? WHERE id = ? AND (lastUsedAt IS NULL OR lastUsedAt < ?)`,
		now, nullStr(clip(ip, 45)), id, now.Add(-gap))
	return err
}

func hashAPIToken(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// newAPIToken devolve o segredo completo; só o hash e o prefixo vão para o banco.
func newAPIToken() (secret string, err error) {
	b := make([]byte, 24)
	if _, err = rand.Read(b); err != nil {
		return "", err
	}
	return tokenPrefix + base64.RawURLEncoding.EncodeToString(b), nil
}

// bearerToken extrai o segredo de "Authorization: Bearer ...". ok=false se o cabeçalho não existe.
func bearerToken(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", false
	}
	if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
		return strings.TrimSpace(h[7:]), true
	}
	return "", true // cabeçalho presente mas que não é Bearer: tratado como credencial inválida
}

// tokenPrincipal valida o token (existe, não revogado, não expirado) e devolve a "pessoa" que o handler vê.
// A cada chamada consulta o banco: revogar vale na hora.
func tokenPrincipal(r *http.Request, secret string) (Member, APIToken, error) {
	if !strings.HasPrefix(secret, tokenPrefix) || len(secret) > 200 {
		return Member{}, APIToken{}, errTokenInvalid
	}
	t, err := tokenDB.TokenByHash(hashAPIToken(secret))
	if err != nil {
		if errors.Is(err, errTokenNotFound) {
			return Member{}, APIToken{}, errTokenInvalid
		}
		return Member{}, APIToken{}, err
	}
	t.derive(time.Now())
	if t.Status != "ACTIVE" {
		return Member{}, APIToken{}, errTokenInvalid
	}
	_ = tokenDB.TouchToken(t.ID, clientIP(r), time.Now(), tokenTouchGap)
	// escopos humanOnly nunca valem num token, mesmo que o banco tenha sido editado à mão
	scopes := []string{}
	for _, s := range t.Scopes {
		if d, ok := scopeIndex[s]; ok && !d.HumanOnly {
			scopes = append(scopes, s)
		}
	}
	return Member{ID: "token:" + t.ID, Name: tokenAuthLabel + t.Name, Active: true, Status: "ACTIVE", Scopes: scopes}, t, nil
}

func isTokenPrincipal(m Member) bool { return strings.HasPrefix(m.ID, "token:") }

// ---- catálogo: GET /api/access/catalog ----

func handleAccessCatalog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}
	presets := map[string][]string{}
	for role := range validRoles {
		presets[role] = presetScopes(role)
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"groups": scopeGroups, "scopes": scopeCatalog, "presets": presets})
}

// ---- tokens: GET/POST /api/tokens, DELETE /api/tokens/{id} (escopo keys:manage, só pessoas) ----

func handleTokens(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := tokenDB.ListTokens()
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		createToken(w, r)
	default:
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
	}
}

func createToken(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name      string    `json:"name"`
		Scopes    []string  `json:"scopes"`
		ExpiresAt *FlexTime `json:"expiresAt"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeAuthErr(w, http.StatusBadRequest, "corpo inválido")
		return
	}
	name := clean(in.Name, tokenNameMax)
	if name == "" {
		writeAuthErr(w, http.StatusUnprocessableEntity, "dê um nome ao token")
		return
	}
	if bad := unknownScopes(in.Scopes); len(bad) > 0 {
		writeAuthErr(w, http.StatusUnprocessableEntity, "escopo desconhecido: "+strings.Join(bad, ", "))
		return
	}
	scopes := normScopes(in.Scopes)
	if len(scopes) == 0 {
		writeAuthErr(w, http.StatusUnprocessableEntity, "escolha ao menos um escopo")
		return
	}
	me, _ := principalOf(r)
	for _, s := range scopes {
		if scopeIndex[s].HumanOnly {
			writeAuthErr(w, http.StatusUnprocessableEntity, "o escopo "+s+" é só para pessoas e não pode ir num token")
			return
		}
		if !hasScope(me.Scopes, s) {
			writeAuthErr(w, http.StatusForbidden, "você não pode dar ao token um escopo que você mesmo não tem: "+s)
			return
		}
	}
	now := time.Now()
	var exp *FlexTime
	if in.ExpiresAt != nil && !in.ExpiresAt.IsZero() {
		if !in.ExpiresAt.After(now) {
			writeAuthErr(w, http.StatusUnprocessableEntity, "a validade precisa ser uma data futura")
			return
		}
		exp = in.ExpiresAt
	}
	secret, err := newAPIToken()
	if err != nil {
		writeAuthErr(w, http.StatusInternalServerError, "erro interno")
		return
	}
	t := APIToken{ID: wfID("tk"), Name: name, Prefix: secret[:tokenVisibleN], Last4: secret[len(secret)-4:], Scopes: scopes,
		CreatedBy: me.ID, CreatedAt: FlexTime{now}, ExpiresAt: exp}
	if err := tokenDB.CreateToken(t, hashAPIToken(secret)); err != nil {
		writeErr(w, err)
		return
	}
	t.CreatedByName = me.Name
	t.Status = "ACTIVE"
	log.Printf("AUTH: %s criou o token %s (%s) com %d escopos", me.Email, t.Name, t.Prefix, len(scopes))
	w.Header().Set("Cache-Control", "no-store")
	// O segredo sai SÓ aqui.
	writeJSON(w, http.StatusCreated, map[string]any{"token": secret, "meta": t})
}

func handleTokenByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeAuthErr(w, http.StatusBadRequest, "id inválido")
		return
	}
	if r.Method != http.MethodDelete {
		writeAuthErr(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}
	me, _ := principalOf(r)
	t, err := tokenDB.RevokeToken(id, me.ID, time.Now())
	if errors.Is(err, errTokenNotFound) {
		writeAuthErr(w, http.StatusNotFound, err.Error())
		return
	} else if err != nil {
		writeErr(w, err)
		return
	}
	log.Printf("AUTH: %s revogou o token %s (%s)", me.Email, t.Name, t.Prefix)
	writeJSON(w, http.StatusOK, t)
}
