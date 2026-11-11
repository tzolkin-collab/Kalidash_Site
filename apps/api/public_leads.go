package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"
)

// Captura pública de lead (formulário do diagnóstico da Home). É a única rota escrita por
// visitantes anônimos, então é deliberadamente estreita: só cria Contact + Opportunity (INBOUND) +
// Note, nunca lê nem altera nada, limita corpo, taxa por IP e origem, e tem honeypot.
// O contrato completo (tokens por fonte, pipelines, LeadSubmission) está em docs/inbound-leads.md
// e entra com a fase de login/segurança; este é o recorte que liga o formulário ao CRM hoje.

const (
	leadBodyLimit   = 8 << 10 // 8 KB
	leadRatePerMin  = 5
	leadMaxFieldLen = 120
	leadMaxMessage  = 2000
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type leadInput struct {
	Name        string         `json:"name"`
	Email       string         `json:"email"`
	Phone       string         `json:"phone"`
	Challenge   string         `json:"challenge"`
	Source      string         `json:"source"`
	Website     string         `json:"website"` // honeypot: humano nunca preenche
	Attribution map[string]any `json:"attribution,omitempty"`
	// EventID: id do envio, gerado no navegador e repetido nas novas tentativas. É a chave de idempotência
	// (TrackingEvent) e o event_id que junta o Pixel e a API de Conversões da Meta (tracking.go).
	EventID string `json:"event_id,omitempty"`
}

// clean tira caracteres de controle e espaços das pontas e corta no limite (em runes).
func clean(s string, max int) string {
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > max {
		s = string(r[:max])
	}
	return s
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// validateLead normaliza a entrada e devolve o 1º erro de validação (mensagem segura pro cliente).
func validateLead(in leadInput) (leadInput, string) {
	in.Name = clean(in.Name, leadMaxFieldLen)
	in.Email = strings.ToLower(clean(in.Email, leadMaxFieldLen))
	in.Phone = clean(in.Phone, 40)
	in.Challenge = clean(in.Challenge, leadMaxMessage)
	in.Source = clean(in.Source, 60)
	switch {
	case len(strings.Fields(in.Name)) < 2:
		return in, "Informe nome e sobrenome."
	case !emailRe.MatchString(in.Email):
		return in, "Informe um email válido."
	case len(digits(in.Phone)) < 10 || len(digits(in.Phone)) > 15:
		return in, "Informe o WhatsApp com DDD."
	}
	if in.Source == "" {
		in.Source = "site"
	}
	return in, ""
}

// ---- limite de taxa por IP (janela deslizante simples, em memória) ----

var (
	rateMu   sync.Mutex
	rateHits = map[string][]time.Time{}
)

func allowRate(ip string, now time.Time) bool { return allowRateLimit(ip, leadRatePerMin, now) }

// allowRateLimit: janela deslizante de 1 minuto por chave (IP da captura de lead, "upload:"+IP do upload).
func allowRateLimit(ip string, limit int, now time.Time) bool {
	rateMu.Lock()
	defer rateMu.Unlock()
	cutoff := now.Add(-time.Minute)
	kept := rateHits[ip][:0]
	for _, t := range rateHits[ip] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= limit {
		rateHits[ip] = kept
		return false
	}
	rateHits[ip] = append(kept, now)
	if len(rateHits) > 10000 { // evita crescer sem limite sob varredura de IPs
		for k, v := range rateHits {
			if len(v) == 0 || v[len(v)-1].Before(cutoff) {
				delete(rateHits, k)
			}
		}
	}
	return true
}

// clientIP: atrás do proxy do EasyPanel/Traefik o IP real vem em X-Forwarded-For.
func clientIP(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		return strings.TrimSpace(strings.Split(xf, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---- origem permitida ----

// allowedOrigins: ALLOWED_ORIGINS (vírgula) + SITE_URL. Entradas com "*." casam subdomínios
// (ex.: https://*.vercel.app, para os ambientes de visualização). Sem nenhuma configurada
// (desenvolvimento) aceita qualquer origem.
func stripWWW(host string) string {
	return strings.TrimPrefix(strings.ToLower(host), "www.")
}

func originAllowed(origin string, list []string) bool {
	if len(list) == 0 {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" {
		return false
	}
	for _, a := range list {
		if a == origin {
			return true
		}
		if i := strings.Index(a, "*."); i > 0 {
			au, err := url.Parse(a[:i] + a[i+2:])
			if err == nil && au.Scheme == u.Scheme && strings.HasSuffix(u.Host, "."+au.Host) {
				return true
			}
			continue
		}
		if au, err := url.Parse(a); err == nil && au.Scheme == u.Scheme && stripWWW(au.Host) == stripWWW(u.Host) {
			return true
		}
	}
	return false
}

func configuredOrigins() []string {
	var out []string
	for _, raw := range []string{os.Getenv("ALLOWED_ORIGINS"), os.Getenv("SITE_URL")} {
		for _, p := range strings.Split(raw, ",") {
			if p = strings.TrimRight(strings.TrimSpace(p), "/"); p != "" {
				out = append(out, p)
			}
		}
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func handlePublicLead(w http.ResponseWriter, r *http.Request) {
	origins := configuredOrigins()
	if origin := r.Header.Get("Origin"); origin != "" {
		if !originAllowed(origin, origins) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "origem não permitida"})
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
		return
	}
	if !allowRate(clientIP(r), time.Now()) {
		w.Header().Set("Retry-After", "60")
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "muitas tentativas, tente em instantes"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, leadBodyLimit)
	var in leadInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return
	}
	// Honeypot: responde sucesso para o robô não tentar de novo, mas não grava nada.
	if strings.TrimSpace(in.Website) != "" {
		writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
		return
	}
	in, msg := validateLead(in)
	if msg != "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": msg})
		return
	}

	// Idempotência por event_id (tracking.go): o mesmo envio nunca grava 2 leads nem dispara 2 conversões.
	eventID := normalizeEventID(in.EventID)
	resp := map[string]any{"ok": true, "eventId": eventID, "serverSide": loadTrackingConfig().serverSide()}
	if !acquireEvent(eventID) {
		resp["pending"] = true
		writeJSON(w, http.StatusAccepted, resp)
		return
	}
	defer releaseEvent(eventID)
	claim, err := tracking.Claim(eventID, "Lead", in.Source)
	if err != nil {
		// Sem a tabela de eventos o lead ainda entra (perder o lead é pior); só a idempotência fica de fora.
		log.Println("⚠️ TrackingEvent:", err)
		claim = claimNew
	}
	if claim == claimDone {
		resp["duplicate"] = true
		writeJSON(w, http.StatusOK, resp)
		return
	}

	ip := clientIP(r)
	if err := leadSaver(in, ip); err != nil {
		log.Println("❌ captura de lead:", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "não foi possível registrar agora"})
		return
	}
	if err := tracking.MarkLeadSaved(eventID); err != nil {
		log.Println("⚠️ TrackingEvent:", err)
	}
	ua := r.Header.Get("X-Client-User-Agent")
	if ua == "" {
		ua = r.Header.Get("User-Agent")
	}
	dispatchConversion(buildConversion(in, eventID, ip, ua))
	writeJSON(w, http.StatusCreated, resp)
}

// leadSaver escolhe o destino da captura (trocável nos testes). Com CRM_API=1 grava um Lead v2 (decisão D6,
// docs/dominio.md v2.1); sem a flag segue o caminho antigo (Oportunidade INBOUND), sem nenhuma mudança.
var leadSaver = func(in leadInput, ip string) error {
	if crmEnabled() {
		return saveV2Fn(in, ip)
	}
	return saveLegacyFn(in)
}

var (
	saveV2Fn     = saveLeadV2
	saveLegacyFn = saveLead
)

// publicLeadTarget: funil, etapa (tipo LEAD) e fonte do formulário da Home. PUBLIC_LEAD_PIPELINE_ID,
// PUBLIC_LEAD_STAGE_ID e PUBLIC_LEAD_SOURCE fixam o destino; sem eles usa a 1ª etapa do tipo LEAD do 1º funil
// ativo. A fonte padrão é "Site — <source do formulário>", ex.: "Site — site".
func publicLeadTarget(source string) (pipelineID, stageID, sourceName string, err error) {
	pipelineID, stageID = strings.TrimSpace(os.Getenv("PUBLIC_LEAD_PIPELINE_ID")), strings.TrimSpace(os.Getenv("PUBLIC_LEAD_STAGE_ID"))
	if pipelineID == "" || stageID == "" {
		err = db.QueryRow(`SELECT s.pipelineId, s.id FROM PipelineStage s JOIN Pipeline p ON p.id = s.pipelineId
			WHERE s.kind = 'LEAD' AND p.archivedAt IS NULL ORDER BY p.position, p.createdAt, s.position LIMIT 1`).Scan(&pipelineID, &stageID)
		if err != nil {
			return "", "", "", fmt.Errorf("nenhum funil com etapa do tipo Lead (ligue WORKFLOW_API ou defina PUBLIC_LEAD_PIPELINE_ID/PUBLIC_LEAD_STAGE_ID): %w", err)
		}
	}
	sourceName = strings.TrimSpace(os.Getenv("PUBLIC_LEAD_SOURCE"))
	if sourceName == "" {
		sourceName = "Site — " + source
	}
	return pipelineID, stageID, sourceName, nil
}

// saveLeadV2 cria (ou reaproveita, por e-mail) a pessoa e o Lead v2 na etapa de entrada, com fonte, tags e o
// que a pessoa escreveu na mensagem, mais a linha "create" no histórico. Mesma gravação do connect.js.
func saveLeadV2(in leadInput, ip string) error {
	pipelineID, stageID, sourceName, err := publicLeadTarget(in.Source)
	if err != nil {
		return err
	}
	message := "WhatsApp: " + in.Phone
	if in.Challenge != "" {
		message += "\n\nDesafio informado:\n" + in.Challenge
	}
	custom := map[string]any{"via": "formulário do site", "formSource": in.Source}
	if len(in.Attribution) > 0 {
		attr := map[string]string{}
		for k, v := range in.Attribution {
			if attributionKeys[k] || k == "interest" {
				if s := clean(strOf(v), 500); s != "" {
					attr[k] = s
				}
			}
		}
		if len(attr) > 0 {
			custom["attribution"] = attr
		}
	}
	_, err = connectDB.IngestLead(inboundLead{
		Project: Project{PipelineID: nullableID(pipelineID), StageID: nullableID(stageID), SourceName: sourceName},
		Name:    in.Name, Email: in.Email, Phone: in.Phone, Message: message,
		Tags:   []string{"Inbound", "Site"},
		Custom: custom,
		Actor:  "Site", ClientIP: ip,
	})
	return err
}

// attributionNote: a origem do lead (UTMs, ids de clique, página de entrada) em linhas "chave: valor", em ordem
// fixa, para o caminho antigo, que não tem campo próprio. Ids de cookie (_fbp, _fbc, ga_*) ficam de fora da nota.
func attributionNote(a map[string]any) string {
	order := []string{"utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "gbraid", "wbraid",
		"first_utm_source", "first_utm_medium", "first_utm_campaign", "landing_page", "first_seen_at", "referrer", "page_url", "device", "interest"}
	var b strings.Builder
	for _, k := range order {
		if s := clean(strOf(a[k]), 500); s != "" {
			b.WriteString(k + ": " + s + "\n")
		}
	}
	return strings.TrimSpace(b.String())
}

// saveLead cria (ou reaproveita, por e-mail) o contato, a oportunidade na coluna INBOUND e a nota
// com o que a pessoa escreveu. Tudo numa transação: ou entra completo, ou não entra.
func saveLead(in leadInput) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now()
	id := func(prefix string) string { return fmt.Sprintf("%s%d", prefix, time.Now().UnixNano()) }

	var contactID string
	err = tx.QueryRow(`SELECT id FROM Contact WHERE LOWER(email) = ? LIMIT 1`, in.Email).Scan(&contactID)
	if err != nil {
		contactID = id("c")
		if _, err := tx.Exec(`INSERT INTO Contact (id, name, email, phone) VALUES (?, ?, ?, ?)`, contactID, in.Name, in.Email, in.Phone); err != nil {
			return err
		}
	}

	oppID := id("o")
	tags, _ := json.Marshal([]string{"Inbound", "Site"})
	title := "Diagnóstico — " + in.Name
	if _, err := tx.Exec(
		`INSERT INTO Opportunity (id, title, stage, priority, tags, contactId, createdAt, updatedAt) VALUES (?, ?, 'INBOUND', 'MEDIUM', ?, ?, ?, ?)`,
		oppID, title, tags, contactID, now, now,
	); err != nil {
		return err
	}

	note := fmt.Sprintf("Lead recebido pelo formulário (%s).\nWhatsApp: %s", in.Source, in.Phone)
	if in.Challenge != "" {
		note += "\n\nDesafio informado:\n" + in.Challenge
	}
	if attr := attributionNote(in.Attribution); attr != "" {
		note += "\n\nOrigem:\n" + attr
	}
	if _, err := tx.Exec(`INSERT INTO Note (id, content, type, opportunityId, createdAt) VALUES (?, ?, 'NOTE', ?, ?)`, id("n"), note, oppID, now); err != nil {
		return err
	}
	return tx.Commit()
}
