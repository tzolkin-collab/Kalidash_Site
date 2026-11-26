package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// Links de divulgação (tagueamento orgânico). No admin (página Links) a equipe escolhe um conteúdo do site e recebe,
// para cada canal orgânico (bio e stories do Instagram, post do LinkedIn, WhatsApp...), o link com as UTMs da
// convenção (docs/tracking.md) e um link curto no domínio do site: kalidash.com.br/l/<código>.
//
// O link curto é resolvido pelo site (apps/site/src/app/l/[code]/route.ts), que pergunta aqui o destino e redireciona
// (302) para a página com as UTMs, onde o tracking do site guarda a atribuição como em qualquer link de campanha.
//
// Rotas:
//   GET    /api/blog/links           lista com cliques e leads (blog:read)
//   POST   /api/blog/links           cria; o mesmo destino com as mesmas UTMs devolve o link que já existe (blog:write)
//   DELETE /api/blog/links/{id}      arquiva: o link curto passa a levar para a home, sem UTMs (blog:write)
//   GET    /api/public/links/{code}  pública, chamada pelo site: destino + UTMs, e conta um clique
//
// Destino é sempre um caminho do próprio site ("/blog/x?y"), nunca um endereço completo: o link curto não vira
// redirecionamento aberto para outros domínios.

const campaignLinkSchema = `
CREATE TABLE IF NOT EXISTS CampaignLink (
	id VARCHAR(64) PRIMARY KEY,
	code VARCHAR(16) NOT NULL UNIQUE,
	fingerprint CHAR(64) NOT NULL UNIQUE,
	destination VARCHAR(500) NOT NULL,
	utmSource VARCHAR(80) NOT NULL,
	utmMedium VARCHAR(80) NOT NULL,
	utmCampaign VARCHAR(120) NOT NULL,
	utmContent VARCHAR(120) NOT NULL DEFAULT '',
	utmTerm VARCHAR(120) NOT NULL DEFAULT '',
	label VARCHAR(160) NOT NULL DEFAULT '',
	clicks INT NOT NULL DEFAULT 0,
	lastClickAt DATETIME NULL,
	createdBy VARCHAR(160) NOT NULL DEFAULT '',
	archivedAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	INDEX idx_campaignlink_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

func ensureCampaignLinkSchema() {
	if _, err := db.Exec(campaignLinkSchema); err != nil {
		log.Fatal("❌ Erro ao criar tabela CampaignLink:", err)
	}
}

type CampaignLink struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Destination string    `json:"destination"`
	UTMSource   string    `json:"utm_source"`
	UTMMedium   string    `json:"utm_medium"`
	UTMCampaign string    `json:"utm_campaign"`
	UTMContent  string    `json:"utm_content"`
	UTMTerm     string    `json:"utm_term"`
	Label       string    `json:"label"`
	Clicks      int       `json:"clicks"`
	Leads       *int      `json:"leads,omitempty"` // leads com estas UTMs (último toque); ausente sem a tabela Lead
	LastClickAt *FlexTime `json:"lastClickAt,omitempty"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   *FlexTime `json:"createdAt,omitempty"`
	fingerprint string
}

// utmKey identifica as UTMs de um link para casar com a atribuição gravada nos leads.
type utmKey struct{ source, medium, campaign, content string }

func (l CampaignLink) key() utmKey {
	return utmKey{l.UTMSource, l.UTMMedium, l.UTMCampaign, l.UTMContent}
}

// linkStore: MySQL em produção, memória nos testes.
type linkStore interface {
	List() ([]CampaignLink, error)
	ByFingerprint(fp string) (CampaignLink, error)
	Create(l *CampaignLink) error
	Resolve(code string, count bool) (CampaignLink, error) // só ativos; count soma o clique
	Archive(id string) error
	LeadCounts() (map[utmKey]int, error)
}

var campaignLinks linkStore = sqlLinkStore{}

// ---- normalização e validação ----

var linkCodeRe = regexp.MustCompile(`^[a-z0-9]{4,16}$`)

// normalizeDestination aceita um caminho do site ("/blog/x", "blog/x", ou o endereço completo do próprio site) e
// devolve só caminho + query + âncora, sem UTMs (as do link entram no redirecionamento).
func normalizeDestination(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "/", nil
	}
	if strings.Contains(raw, "\\") || strings.HasPrefix(raw, "//") {
		return "", errors.New("destino inválido")
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", errors.New("destino inválido")
	}
	if u.Scheme != "" || u.Host != "" {
		if (u.Scheme != "http" && u.Scheme != "https") || !siteHost(u.Hostname()) {
			return "", errors.New("o destino precisa ser uma página do site (ex.: /blog/artigo)")
		}
	}
	path := u.EscapedPath()
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if strings.HasPrefix(path, "//") {
		return "", errors.New("destino inválido")
	}
	q := u.Query()
	for k := range q {
		if strings.HasPrefix(strings.ToLower(k), "utm_") {
			q.Del(k)
		}
	}
	out := path
	if enc := q.Encode(); enc != "" {
		out += "?" + enc
	}
	if u.Fragment != "" {
		out += "#" + u.EscapedFragment()
	}
	if len(out) > 500 {
		return "", errors.New("destino longo demais")
	}
	return out, nil
}

// siteHost: endereços completos só do próprio site (kalidash.com.br, www., previews e localhost em dev).
func siteHost(h string) bool {
	h = strings.ToLower(h)
	return h == "localhost" || h == "kalidash.com.br" || strings.HasSuffix(h, ".kalidash.com.br") ||
		h == "kalidash.com" || strings.HasSuffix(h, ".kalidash.com")
}

func linkFingerprint(l CampaignLink) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{l.Destination, l.UTMSource, l.UTMMedium, l.UTMCampaign, l.UTMContent, l.UTMTerm}, "\x00")))
	return hex.EncodeToString(sum[:])
}

const linkAlphabet = "abcdefghjkmnpqrstuvwxyz23456789" // sem 0/o, 1/l/i: o código é lido e digitado de stories

func newLinkCode(n int) string {
	b := make([]byte, n)
	max := big.NewInt(int64(len(linkAlphabet)))
	for i := range b {
		v, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic(err)
		}
		b[i] = linkAlphabet[v.Int64()]
	}
	return string(b)
}

type linkInput struct {
	Destination string `json:"destination"`
	UTMSource   string `json:"utm_source"`
	UTMMedium   string `json:"utm_medium"`
	UTMCampaign string `json:"utm_campaign"`
	UTMContent  string `json:"utm_content"`
	UTMTerm     string `json:"utm_term"`
	Label       string `json:"label"`
}

func (in linkInput) toLink() (CampaignLink, error) {
	dest, err := normalizeDestination(in.Destination)
	if err != nil {
		return CampaignLink{}, err
	}
	l := CampaignLink{
		Destination: dest,
		UTMSource:   clean(normalizeUTM(in.UTMSource), 80),
		UTMMedium:   clean(normalizeUTM(in.UTMMedium), 80),
		UTMCampaign: clean(normalizeUTM(in.UTMCampaign), 120),
		UTMContent:  clean(normalizeUTM(in.UTMContent), 120),
		UTMTerm:     clean(normalizeUTM(in.UTMTerm), 120),
		Label:       clean(in.Label, 160),
	}
	if l.UTMSource == "" || l.UTMMedium == "" || l.UTMCampaign == "" {
		return CampaignLink{}, errors.New("utm_source, utm_medium e utm_campaign são obrigatórios")
	}
	l.fingerprint = linkFingerprint(l)
	return l, nil
}

// ---- rotas ----

func registerCampaignLinkRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/blog/links", enableCORS(handleCampaignLinks))
	mux.HandleFunc("/api/blog/links/{id}", enableCORS(handleCampaignLinkByID))
	mux.HandleFunc("/api/public/links/{code}", handlePublicLink) // servidor a servidor (site), sem CORS
}

func handleCampaignLinks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := campaignLinks.List()
		if err != nil {
			writeErr(w, err)
			return
		}
		if counts, err := campaignLinks.LeadCounts(); err == nil {
			for i := range list {
				n := counts[list[i].key()]
				list[i].Leads = &n
			}
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var in linkInput
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		l, err := in.toLink()
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if cur, err := campaignLinks.ByFingerprint(l.fingerprint); err == nil {
			writeJSON(w, http.StatusOK, cur) // já existe: o mesmo link curto, sem duplicar
			return
		} else if !errors.Is(err, errNotFound) {
			writeErr(w, err)
			return
		}
		l.CreatedBy = clean(actorName(r), 160)
		if err := campaignLinks.Create(&l); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, l)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func handleCampaignLinkByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	if r.Method != http.MethodDelete {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err := campaignLinks.Archive(id); err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// previewBot: robôs que abrem o link para montar a prévia (WhatsApp, LinkedIn, Instagram...) ou indexar. Eles seguem
// o redirecionamento normalmente, mas não contam como clique.
var previewBot = regexp.MustCompile(`(?i)bot|crawler|spider|facebookexternalhit|facebookcatalog|whatsapp|telegram|slack|discord|skype|preview|embedly|vkshare|pinterest`)

// handlePublicLink: o site resolve /l/<código>. Só GET de gente conta clique (o site repassa o navegador em
// X-Client-User-Agent); robôs de prévia e HEAD de verificadores não contam.
func handlePublicLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	code := strings.ToLower(r.PathValue("code"))
	if !linkCodeRe.MatchString(code) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "não encontrado"})
		return
	}
	ua := firstNonEmpty(r.Header.Get("X-Client-User-Agent"), r.Header.Get("User-Agent"))
	l, err := campaignLinks.Resolve(code, !previewBot.MatchString(ua))
	if err != nil {
		if !errors.Is(err, errNotFound) {
			log.Println("⚠️ link curto:", err)
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "não encontrado"})
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{
		"destination": l.Destination,
		"utm": map[string]string{
			"utm_source": l.UTMSource, "utm_medium": l.UTMMedium, "utm_campaign": l.UTMCampaign,
			"utm_content": l.UTMContent, "utm_term": l.UTMTerm,
		},
	})
}

// ---- MySQL ----

type sqlLinkStore struct{}

const linkCols = `id, code, fingerprint, destination, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, label, clicks, lastClickAt, createdBy, createdAt`

func scanLink(sc interface{ Scan(...any) error }) (CampaignLink, error) {
	var l CampaignLink
	var last, created sql.NullString
	err := sc.Scan(&l.ID, &l.Code, &l.fingerprint, &l.Destination, &l.UTMSource, &l.UTMMedium, &l.UTMCampaign, &l.UTMContent, &l.UTMTerm, &l.Label, &l.Clicks, &last, &l.CreatedBy, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return l, errNotFound
	}
	l.LastClickAt, l.CreatedAt = flexFrom(last.String), flexFrom(created.String)
	return l, err
}

func (sqlLinkStore) List() ([]CampaignLink, error) {
	rows, err := db.Query(`SELECT ` + linkCols + ` FROM CampaignLink WHERE archivedAt IS NULL ORDER BY createdAt DESC LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CampaignLink{}
	for rows.Next() {
		l, err := scanLink(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (sqlLinkStore) ByFingerprint(fp string) (CampaignLink, error) {
	return scanLink(db.QueryRow(`SELECT `+linkCols+` FROM CampaignLink WHERE fingerprint = ? AND archivedAt IS NULL`, fp))
}

func (sqlLinkStore) Create(l *CampaignLink) error {
	now := time.Now()
	// Um link arquivado com as mesmas UTMs volta à vida (fingerprint é única), com o mesmo código.
	if res, err := db.Exec(`UPDATE CampaignLink SET archivedAt = NULL, label = ?, updatedAt = ? WHERE fingerprint = ? AND archivedAt IS NOT NULL`, l.Label, now, l.fingerprint); err != nil {
		return err
	} else if n, _ := res.RowsAffected(); n > 0 {
		cur, err := scanLink(db.QueryRow(`SELECT `+linkCols+` FROM CampaignLink WHERE fingerprint = ?`, l.fingerprint))
		*l = cur
		return err
	}
	for attempt := 0; attempt < 5; attempt++ {
		l.ID, l.Code = "lnk_"+newLinkCode(12), newLinkCode(6)
		_, err := db.Exec(`INSERT INTO CampaignLink (id, code, fingerprint, destination, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, label, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			l.ID, l.Code, l.fingerprint, l.Destination, l.UTMSource, l.UTMMedium, l.UTMCampaign, l.UTMContent, l.UTMTerm, l.Label, l.CreatedBy, now, now)
		if err == nil {
			l.CreatedAt = &FlexTime{now}
			return nil
		}
		if !isDuplicateKey(err) {
			return err
		}
		if cur, err := (sqlLinkStore{}).ByFingerprint(l.fingerprint); err == nil {
			*l = cur // outra aba criou o mesmo link ao mesmo tempo
			return nil
		}
	}
	return errors.New("não consegui gerar um código livre para o link curto")
}

func (sqlLinkStore) Resolve(code string, count bool) (CampaignLink, error) {
	l, err := scanLink(db.QueryRow(`SELECT `+linkCols+` FROM CampaignLink WHERE code = ? AND archivedAt IS NULL`, code))
	if err != nil || !count {
		return l, err
	}
	if _, err := db.Exec(`UPDATE CampaignLink SET clicks = clicks + 1, lastClickAt = ? WHERE id = ?`, time.Now(), l.ID); err != nil {
		log.Println("⚠️ link curto (clique):", err)
	}
	return l, nil
}

func (sqlLinkStore) Archive(id string) error {
	res, err := db.Exec(`UPDATE CampaignLink SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now(), time.Now(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errNotFound
	}
	return nil
}

// LeadCounts: leads por UTMs do último toque (Lead.customData.attribution), para a coluna "Leads" da lista.
func (sqlLinkStore) LeadCounts() (map[utmKey]int, error) {
	rows, err := db.Query(`SELECT
		COALESCE(JSON_UNQUOTE(JSON_EXTRACT(customData, '$.attribution.utm_source')), ''),
		COALESCE(JSON_UNQUOTE(JSON_EXTRACT(customData, '$.attribution.utm_medium')), ''),
		COALESCE(JSON_UNQUOTE(JSON_EXTRACT(customData, '$.attribution.utm_campaign')), ''),
		COALESCE(JSON_UNQUOTE(JSON_EXTRACT(customData, '$.attribution.utm_content')), ''),
		COUNT(*)
		FROM Lead WHERE JSON_EXTRACT(customData, '$.attribution.utm_campaign') IS NOT NULL
		GROUP BY 1, 2, 3, 4`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[utmKey]int{}
	for rows.Next() {
		var k utmKey
		var n int
		if err := rows.Scan(&k.source, &k.medium, &k.campaign, &k.content, &n); err != nil {
			return nil, err
		}
		out[k] += n
	}
	return out, rows.Err()
}
