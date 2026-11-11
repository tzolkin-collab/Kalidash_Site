package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Camada servidor do rastreamento de conversão (formulários do site, POST /api/public/leads).
//
//   - Meta: o navegador dispara fbq('track','Lead',…,{eventID}) e a API manda o MESMO evento pela API de
//     Conversões com o mesmo event_id. A Meta junta os dois (event_name + event_id) e conta 1 lead.
//   - GA4: o GA4 não junta navegador e servidor, então a conversão generate_lead sai por UMA camada só.
//     Com GA4_MEASUREMENT_ID + GA4_API_SECRET ela sai daqui (Measurement Protocol, com o client_id e o
//     session_id do navegador para manter a origem da sessão); sem eles a resposta avisa o site e ele
//     dispara pelo gtag. A resposta da rota diz qual camada valeu (serverSide.ga4).
//   - Idempotência: cada envio carrega um event_id (gerado no navegador por envio de formulário, mantido
//     nas novas tentativas). A tabela TrackingEvent guarda o id: o mesmo event_id nunca cria um 2º lead
//     nem reenvia a conversão, mesmo com clique duplo, nova tentativa de rede ou reenvio do navegador.
//
// Variáveis: META_PIXEL_ID, META_CAPI_ACCESS_TOKEN, META_TEST_EVENT_CODE (opcional), META_GRAPH_VERSION
// (opcional, padrão v21.0), GA4_MEASUREMENT_ID, GA4_API_SECRET. Sem elas o lead entra normalmente e a
// camada correspondente fica "skipped" na TrackingEvent.

var eventIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{8,64}$`)

type trackingConfig struct {
	PixelID, MetaToken, MetaTestCode, GraphVersion string
	GA4ID, GA4Secret                               string
}

func loadTrackingConfig() trackingConfig {
	c := trackingConfig{
		PixelID:      strings.TrimSpace(os.Getenv("META_PIXEL_ID")),
		MetaToken:    strings.TrimSpace(os.Getenv("META_CAPI_ACCESS_TOKEN")),
		MetaTestCode: strings.TrimSpace(os.Getenv("META_TEST_EVENT_CODE")),
		GraphVersion: strings.TrimSpace(os.Getenv("META_GRAPH_VERSION")),
		GA4ID:        strings.TrimSpace(os.Getenv("GA4_MEASUREMENT_ID")),
		GA4Secret:    strings.TrimSpace(os.Getenv("GA4_API_SECRET")),
	}
	if c.GraphVersion == "" {
		c.GraphVersion = "v21.0"
	}
	return c
}

func (c trackingConfig) metaOn() bool { return c.PixelID != "" && c.MetaToken != "" }
func (c trackingConfig) ga4On() bool  { return c.GA4ID != "" && c.GA4Secret != "" }

// serverSide: o que a camada servidor cobre, devolvido ao site para ele não duplicar no navegador.
func (c trackingConfig) serverSide() map[string]bool {
	return map[string]bool{"meta": c.metaOn(), "ga4": c.ga4On()}
}

// ---- event_id ----

// normalizeEventID aceita o id do navegador (UUID ou parecido) ou gera um no servidor.
func normalizeEventID(raw string) string {
	raw = strings.TrimSpace(raw)
	if eventIDRe.MatchString(raw) {
		return raw
	}
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("srv-%d", time.Now().UnixNano())
	}
	return "srv-" + hex.EncodeToString(b)
}

// ---- armazenamento idempotente ----

type claimResult int

const (
	claimNew   claimResult = iota // id nunca visto: grava o lead e dispara a conversão
	claimRetry                    // id visto, mas o lead não chegou a gravar: tenta gravar de novo
	claimDone                     // id já processado: responde sucesso sem gravar nem disparar nada
)

type trackingStore interface {
	Claim(eventID, name, source string) (claimResult, error)
	MarkLeadSaved(eventID string) error
	MarkDelivery(eventID, channel, status, errMsg string, attempts int) error
}

var tracking trackingStore = sqlTrackingStore{}

func ensureTrackingSchema() {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS TrackingEvent (
			eventId VARCHAR(64) PRIMARY KEY,
			name VARCHAR(40) NOT NULL,
			source VARCHAR(60) NOT NULL DEFAULT '',
			leadSaved TINYINT(1) NOT NULL DEFAULT 0,
			metaStatus VARCHAR(16) NOT NULL DEFAULT 'pending',
			metaAttempts INT NOT NULL DEFAULT 0,
			ga4Status VARCHAR(16) NOT NULL DEFAULT 'pending',
			ga4Attempts INT NOT NULL DEFAULT 0,
			lastError VARCHAR(500) NULL,
			createdAt DATETIME(3) NOT NULL,
			updatedAt DATETIME(3) NOT NULL,
			INDEX idx_tracking_created (createdAt)
		)`)
	if err != nil {
		log.Println("⚠️ TrackingEvent:", err)
	}
}

type sqlTrackingStore struct{}

var errNoTrackingDB = errors.New("sem banco")

func (sqlTrackingStore) Claim(eventID, name, source string) (claimResult, error) {
	if db == nil {
		return claimNew, errNoTrackingDB
	}
	now := time.Now().UTC()
	res, err := db.Exec(`INSERT IGNORE INTO TrackingEvent (eventId, name, source, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
		eventID, name, source, now, now)
	if err != nil {
		return claimNew, err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		return claimNew, nil
	}
	var saved bool
	if err := db.QueryRow(`SELECT leadSaved FROM TrackingEvent WHERE eventId = ?`, eventID).Scan(&saved); err != nil {
		if err == sql.ErrNoRows {
			return claimNew, nil
		}
		return claimNew, err
	}
	if saved {
		return claimDone, nil
	}
	return claimRetry, nil
}

func (sqlTrackingStore) MarkLeadSaved(eventID string) error {
	if db == nil {
		return errNoTrackingDB
	}
	_, err := db.Exec(`UPDATE TrackingEvent SET leadSaved = 1, updatedAt = ? WHERE eventId = ?`, time.Now().UTC(), eventID)
	return err
}

func (sqlTrackingStore) MarkDelivery(eventID, channel, status, errMsg string, attempts int) error {
	if db == nil {
		return errNoTrackingDB
	}
	col, att := "metaStatus", "metaAttempts"
	if channel == "ga4" {
		col, att = "ga4Status", "ga4Attempts"
	}
	var last any
	if errMsg != "" {
		last = clean(errMsg, 500)
	}
	_, err := db.Exec(`UPDATE TrackingEvent SET `+col+` = ?, `+att+` = ?, lastError = COALESCE(?, lastError), updatedAt = ? WHERE eventId = ?`,
		status, attempts, last, time.Now().UTC(), eventID)
	return err
}

// inflight barra o mesmo event_id em paralelo (clique duplo chegando junto): o 2º recebe 202 e o 1º termina.
var inflight sync.Map

func acquireEvent(id string) bool {
	_, loaded := inflight.LoadOrStore(id, struct{}{})
	return !loaded
}

func releaseEvent(id string) { inflight.Delete(id) }

// ---- evento de conversão ----

type conversionEvent struct {
	EventID   string
	Name      string // "Lead" na Meta, "generate_lead" no GA4
	Time      time.Time
	Email     string
	Phone     string
	FullName  string
	Source    string
	IP        string
	UserAgent string
	Attr      map[string]string
}

func buildConversion(in leadInput, eventID, ip, ua string) conversionEvent {
	attr := map[string]string{}
	for k, v := range in.Attribution {
		if s := clean(strOf(v), 500); s != "" {
			attr[k] = s
		}
	}
	return conversionEvent{
		EventID: eventID, Name: "Lead", Time: time.Now(),
		Email: in.Email, Phone: in.Phone, FullName: in.Name, Source: in.Source,
		IP: ip, UserAgent: clean(ua, 400), Attr: attr,
	}
}

// dispatchConversion roda em segundo plano depois que o lead gravou. Trocável nos testes.
var dispatchConversion = func(ev conversionEvent) {
	go deliverConversion(loadTrackingConfig(), ev)
}

var trackingHTTP = &http.Client{Timeout: 8 * time.Second}

func deliverConversion(cfg trackingConfig, ev conversionEvent) {
	var wg sync.WaitGroup
	run := func(channel string, on bool, send func() (bool, error)) {
		defer wg.Done()
		if !on {
			_ = tracking.MarkDelivery(ev.EventID, channel, "skipped", "", 0)
			return
		}
		status, attempts, msg := retrySend(send)
		if status != "sent" {
			log.Printf("⚠️ conversão %s (%s): %s", channel, ev.EventID, msg)
		}
		if err := tracking.MarkDelivery(ev.EventID, channel, status, msg, attempts); err != nil {
			log.Println("⚠️ TrackingEvent:", err)
		}
	}
	wg.Add(2)
	go run("meta", cfg.metaOn(), func() (bool, error) { return sendMetaCAPI(cfg, ev) })
	go run("ga4", cfg.ga4On(), func() (bool, error) { return sendGA4MP(cfg, ev) })
	wg.Wait()
}

var retryDelays = []time.Duration{0, 2 * time.Second, 8 * time.Second}

// retrySend: até 3 tentativas. send devolve (vale repetir?, erro). Erro 4xx de configuração não repete.
func retrySend(send func() (bool, error)) (status string, attempts int, msg string) {
	for i, d := range retryDelays {
		time.Sleep(d)
		retryable, err := send()
		if err == nil {
			return "sent", i + 1, ""
		}
		msg = err.Error()
		if !retryable {
			return "failed", i + 1, msg
		}
	}
	return "failed", len(retryDelays), msg
}

func postJSON(endpoint string, body any) (bool, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return false, err
	}
	resp, err := trackingHTTP.Post(endpoint, "application/json", bytes.NewReader(buf))
	if err != nil {
		return true, err // rede: vale repetir
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return false, nil
	}
	retry := resp.StatusCode == 429 || resp.StatusCode >= 500
	return retry, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
}

// ---- Meta: API de Conversões ----

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// normPhone: só dígitos, com o código do país. Número brasileiro sem DDI (10 ou 11 dígitos) ganha 55.
func normPhone(p string) string {
	d := strings.TrimLeft(digits(p), "0")
	if len(d) == 10 || len(d) == 11 {
		d = "55" + d
	}
	return d
}

// fbcFor: o _fbc do navegador; sem ele, monta a partir do fbclid (formato fb.1.<ms>.<fbclid>), usando a hora
// em que o clique chegou ao site (fbclid_at, em ms) quando o navegador mandou.
func fbcFor(attr map[string]string, at time.Time) string {
	if v := attr["_fbc"]; v != "" {
		return v
	}
	id := attr["fbclid"]
	if id == "" {
		return ""
	}
	ms := at.UnixMilli()
	if v, err := strconv.ParseInt(attr["fbclid_at"], 10, 64); err == nil && v > 0 {
		ms = v
	}
	return fmt.Sprintf("fb.1.%d.%s", ms, id)
}

func metaPayload(cfg trackingConfig, ev conversionEvent) map[string]any {
	user := map[string]any{}
	if ev.Email != "" {
		h := sha256Hex(strings.ToLower(strings.TrimSpace(ev.Email)))
		user["em"] = []string{h}
		user["external_id"] = []string{h}
	}
	if p := normPhone(ev.Phone); p != "" {
		user["ph"] = []string{sha256Hex(p)}
	}
	if parts := strings.Fields(strings.ToLower(ev.FullName)); len(parts) > 0 {
		user["fn"] = []string{sha256Hex(parts[0])}
		if len(parts) > 1 {
			user["ln"] = []string{sha256Hex(parts[len(parts)-1])}
		}
	}
	user["country"] = []string{sha256Hex("br")}
	if ev.IP != "" {
		user["client_ip_address"] = ev.IP
	}
	if ev.UserAgent != "" {
		user["client_user_agent"] = ev.UserAgent
	}
	if v := ev.Attr["_fbp"]; v != "" {
		user["fbp"] = v
	}
	if v := fbcFor(ev.Attr, ev.Time); v != "" {
		user["fbc"] = v
	}
	custom := map[string]any{"lead_source": ev.Source}
	for _, k := range []string{"utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "interest"} {
		if v := ev.Attr[k]; v != "" {
			custom[k] = v
		}
	}
	event := map[string]any{
		"event_name":    ev.Name,
		"event_time":    ev.Time.Unix(),
		"event_id":      ev.EventID,
		"action_source": "website",
		"user_data":     user,
		"custom_data":   custom,
	}
	if v := ev.Attr["page_url"]; v != "" {
		event["event_source_url"] = v
	}
	body := map[string]any{"data": []any{event}, "access_token": cfg.MetaToken}
	if cfg.MetaTestCode != "" {
		body["test_event_code"] = cfg.MetaTestCode
	}
	return body
}

var metaEndpoint = func(cfg trackingConfig) string {
	return fmt.Sprintf("https://graph.facebook.com/%s/%s/events", cfg.GraphVersion, url.PathEscape(cfg.PixelID))
}

func sendMetaCAPI(cfg trackingConfig, ev conversionEvent) (bool, error) {
	return postJSON(metaEndpoint(cfg), metaPayload(cfg, ev))
}

// ---- GA4: Measurement Protocol ----

func ga4Payload(ev conversionEvent) map[string]any {
	clientID := ev.Attr["ga_client_id"]
	if clientID == "" {
		// Sem o cookie _ga (bloqueador, consentimento negado): a conversão ainda conta, sem a origem da sessão.
		clientID = "srv." + ev.EventID
	}
	params := map[string]any{
		"engagement_time_msec": 100,
		"lead_source":          ev.Source,
		"form_name":            ev.Source,
		"event_id":             ev.EventID,
	}
	if v := ev.Attr["ga_session_id"]; v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			params["session_id"] = n
		}
	}
	if v := ev.Attr["page_url"]; v != "" {
		params["page_location"] = v
	}
	for _, k := range []string{"utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "interest"} {
		if v := ev.Attr[k]; v != "" {
			params[k] = v
		}
	}
	return map[string]any{
		"client_id":        clientID,
		"timestamp_micros": ev.Time.UnixMicro(),
		"events":           []any{map[string]any{"name": "generate_lead", "params": params}},
	}
}

var ga4Endpoint = func(cfg trackingConfig) string {
	q := url.Values{"measurement_id": {cfg.GA4ID}, "api_secret": {cfg.GA4Secret}}
	return "https://www.google-analytics.com/mp/collect?" + q.Encode()
}

func sendGA4MP(cfg trackingConfig, ev conversionEvent) (bool, error) {
	return postJSON(ga4Endpoint(cfg), ga4Payload(ev))
}
