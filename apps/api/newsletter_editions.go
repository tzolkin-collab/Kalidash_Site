package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Edições da newsletter do blog, enviadas pelo Resend Broadcasts. Uma edição aponta um modelo salvo em E-mails
// (EmailTemplate, o mesmo editor visual), um assunto e um público (segmento do Resend). Ao enviar, o servidor tira
// uma cópia do HTML, troca as variáveis do Kalidash pelas do Resend ({{primeiro_nome}} → {{{FIRST_NAME|}}}), põe o
// rodapé de descadastro se o modelo não tiver um, cria o broadcast e manda (agora ou agendado).
//
// Vem junto com EMAIL_AUTOMATIONS=1 (mesmo esquema e mesmas rotas /api/email/*). Públicos:
//   RESEND_NEWSLETTER_SEGMENT_ID   "Newsletter do blog" (todo inscrito do site entra nele: newsletter_resend.go)
//   RESEND_MATERIAL_SEGMENT_ID     opcional: quem pediu material gratuito
//   RESEND_TEST_SEGMENT_ID         opcional: só a equipe, para ver a edição como broadcast de verdade antes
//
// O envio de teste ("Enviar para mim") vai só para o e-mail de quem está logado, como e-mail avulso.

const newsletterSchema = `
CREATE TABLE IF NOT EXISTS NewsletterEdition (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(160) NOT NULL,
	templateId VARCHAR(64) NULL,
	subject VARCHAR(200) NOT NULL,
	previewText VARCHAR(200) NOT NULL DEFAULT '',
	audience VARCHAR(16) NOT NULL,
	status VARCHAR(12) NOT NULL,
	broadcastId VARCHAR(80) NOT NULL DEFAULT '',
	html MEDIUMTEXT NULL,
	scheduledAt DATETIME NULL,
	sentAt DATETIME NULL,
	lastError VARCHAR(500) NOT NULL DEFAULT '',
	createdBy VARCHAR(160) NOT NULL DEFAULT '',
	sentBy VARCHAR(160) NOT NULL DEFAULT '',
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	INDEX idx_edition_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

type newsletterAudience struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Env   string `json:"-"`
}

var newsletterAudiences = []newsletterAudience{
	{ID: "newsletter", Label: "Newsletter do blog", Env: "RESEND_NEWSLETTER_SEGMENT_ID"},
	{ID: "material", Label: "Quem pediu material gratuito", Env: "RESEND_MATERIAL_SEGMENT_ID"},
	{ID: "teste", Label: "Teste (só a equipe)", Env: "RESEND_TEST_SEGMENT_ID"},
}

func audienceSegment(id string) (newsletterAudience, string, bool) {
	for _, a := range newsletterAudiences {
		if a.ID == id {
			return a, strings.TrimSpace(os.Getenv(a.Env)), true
		}
	}
	return newsletterAudience{}, "", false
}

type NewsletterEditionDTO struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	TemplateID  string     `json:"templateId"`
	Template    string     `json:"template"`
	Subject     string     `json:"subject"`
	PreviewText string     `json:"previewText"`
	Audience    string     `json:"audience"`
	Status      string     `json:"status"` // DRAFT, SENDING, SCHEDULED, SENT, FAILED
	BroadcastID string     `json:"broadcastId,omitempty"`
	ScheduledAt *time.Time `json:"scheduledAt,omitempty"`
	SentAt      *time.Time `json:"sentAt,omitempty"`
	LastError   string     `json:"lastError,omitempty"`
	CreatedBy   string     `json:"createdBy"`
	SentBy      string     `json:"sentBy,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

const editionCols = `e.id, e.name, COALESCE(e.templateId, ''), COALESCE(t.name, ''), e.subject, e.previewText, e.audience, e.status,
	e.broadcastId, e.scheduledAt, e.sentAt, e.lastError, e.createdBy, e.sentBy, e.createdAt, e.updatedAt`

const editionFrom = ` FROM NewsletterEdition e LEFT JOIN EmailTemplate t ON t.id = e.templateId`

func scanEdition(sc interface{ Scan(...any) error }) (NewsletterEditionDTO, error) {
	var e NewsletterEditionDTO
	var sched, sent sql.NullTime
	err := sc.Scan(&e.ID, &e.Name, &e.TemplateID, &e.Template, &e.Subject, &e.PreviewText, &e.Audience, &e.Status,
		&e.BroadcastID, &sched, &sent, &e.LastError, &e.CreatedBy, &e.SentBy, &e.CreatedAt, &e.UpdatedAt)
	if sched.Valid {
		e.ScheduledAt = &sched.Time
	}
	if sent.Valid {
		e.SentAt = &sent.Time
	}
	return e, err
}

func getEdition(id string) (NewsletterEditionDTO, error) {
	return scanEdition(db.QueryRow(`SELECT `+editionCols+editionFrom+` WHERE e.id = ?`, id))
}

func registerNewsletterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/email/newsletter", enableCORS(handleNewsletterOverview))
	mux.HandleFunc("/api/email/newsletter/editions", enableCORS(handleNewsletterEditions))
	mux.HandleFunc("/api/email/newsletter/editions/{id}", enableCORS(handleNewsletterEditionByID))
	mux.HandleFunc("/api/email/newsletter/editions/{id}/test", enableCORS(handleNewsletterEditionTest))
	mux.HandleFunc("/api/email/newsletter/editions/{id}/send", enableCORS(handleNewsletterEditionSend))
	mux.HandleFunc("/api/email/newsletter/sync", enableCORS(handleNewsletterSync))
}

// ---- visão geral ----

func handleNewsletterOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	type aud struct {
		newsletterAudience
		Configured bool `json:"configured"`
	}
	auds := []aud{}
	for _, a := range newsletterAudiences {
		auds = append(auds, aud{a, strings.TrimSpace(os.Getenv(a.Env)) != ""})
	}
	rows, err := db.Query(`SELECT ` + editionCols + editionFrom + ` ORDER BY e.createdAt DESC LIMIT 200`)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	eds := []NewsletterEditionDTO{}
	for rows.Next() {
		e, err := scanEdition(rows)
		if err != nil {
			writeErr(w, err)
			return
		}
		eds = append(eds, e)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"configured": os.Getenv("RESEND_API_KEY") != "" && os.Getenv("RESEND_FROM_EMAIL") != "",
		"from":       os.Getenv("RESEND_FROM_EMAIL"),
		"audiences":  auds,
		"editions":   eds,
		"sync":       newsletterSyncState(),
	})
}

// ---- criar, editar, apagar ----

type editionInput struct {
	Name        string `json:"name"`
	TemplateID  string `json:"templateId"`
	Subject     string `json:"subject"`
	PreviewText string `json:"previewText"`
	Audience    string `json:"audience"`
}

func validateEdition(in *editionInput) error {
	in.Name, in.Subject, in.PreviewText = strings.TrimSpace(in.Name), strings.TrimSpace(in.Subject), strings.TrimSpace(in.PreviewText)
	if in.Name == "" {
		in.Name = in.Subject
	}
	switch {
	case in.Subject == "" || len([]rune(in.Subject)) > 200 || strings.ContainsAny(in.Subject, "\r\n"):
		return errors.New("escreva o assunto (uma linha, até 200 caracteres)")
	case len([]rune(in.Name)) > 160:
		return errors.New("nome longo demais (até 160 caracteres)")
	case len([]rune(in.PreviewText)) > 200 || strings.ContainsAny(in.PreviewText, "\r\n"):
		return errors.New("texto de prévia longo demais (até 200 caracteres)")
	}
	if _, _, ok := audienceSegment(in.Audience); !ok {
		return errors.New("escolha o público")
	}
	if in.TemplateID != "" {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM EmailTemplate WHERE id = ?`, in.TemplateID).Scan(&n); err != nil || n == 0 {
			return errors.New("o modelo escolhido não existe mais")
		}
	}
	return nil
}

func decodeEdition(w http.ResponseWriter, r *http.Request) (editionInput, bool) {
	var in editionInput
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return in, false
	}
	if err := validateEdition(&in); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return in, false
	}
	return in, true
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func handleNewsletterEditions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	in, ok := decodeEdition(w, r)
	if !ok {
		return
	}
	id, now := wfID("ne"), time.Now()
	if _, err := db.Exec(`INSERT INTO NewsletterEdition (id, name, templateId, subject, previewText, audience, status, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
		id, in.Name, nullIfEmpty(in.TemplateID), in.Subject, in.PreviewText, in.Audience, actorOf(r), now, now); err != nil {
		writeErr(w, err)
		return
	}
	e, err := getEdition(id)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, e)
}

func editionNotFound(w http.ResponseWriter) {
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "edição não encontrada"})
}

func handleNewsletterEditionByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	switch r.Method {
	case http.MethodGet:
		e, err := getEdition(id)
		if errors.Is(err, sql.ErrNoRows) {
			editionNotFound(w)
			return
		}
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, e)
	case http.MethodPut:
		in, ok := decodeEdition(w, r)
		if !ok {
			return
		}
		res, err := db.Exec(`UPDATE NewsletterEdition SET name = ?, templateId = ?, subject = ?, previewText = ?, audience = ?, status = 'DRAFT', lastError = '', updatedAt = ? WHERE id = ? AND status IN ('DRAFT', 'FAILED')`,
			in.Name, nullIfEmpty(in.TemplateID), in.Subject, in.PreviewText, in.Audience, time.Now(), id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			if _, err := getEdition(id); errors.Is(err, sql.ErrNoRows) {
				editionNotFound(w)
				return
			}
			// Sem mudança de valor o MySQL também responde 0: só é conflito se a edição já saiu.
			if e, _ := getEdition(id); e.Status != "DRAFT" {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "esta edição já foi enviada ou agendada e não pode mais mudar"})
				return
			}
		}
		e, err := getEdition(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, e)
	case http.MethodDelete:
		res, err := db.Exec(`DELETE FROM NewsletterEdition WHERE id = ? AND status IN ('DRAFT', 'FAILED')`, id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			if _, err := getEdition(id); errors.Is(err, sql.ErrNoRows) {
				editionNotFound(w)
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": "só rascunhos e edições com falha podem ser apagados"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		methodNotAllowed(w)
	}
}

// ---- conteúdo ----

// editionContent devolve o assunto e o HTML do modelo da edição.
func editionContent(e NewsletterEditionDTO) (string, error) {
	if e.TemplateID == "" {
		return "", errors.New("escolha o modelo da edição antes de enviar")
	}
	var body string
	err := db.QueryRow(`SELECT html FROM EmailTemplate WHERE id = ?`, e.TemplateID).Scan(&body)
	if errors.Is(err, sql.ErrNoRows) {
		return "", errors.New("o modelo desta edição foi apagado")
	}
	return body, err
}

const unsubscribeToken = "{{{RESEND_UNSUBSCRIBE_URL}}}"

// broadcastVars: variáveis do Kalidash → variáveis de contato do Resend (preenchidas por destinatário).
var broadcastVars = map[string]string{
	"primeiro_nome": "{{{FIRST_NAME|}}}",
	"nome":          "{{{FIRST_NAME|}}} {{{LAST_NAME|}}}",
	"email":         "{{{EMAIL}}}",
	"oportunidade":  "",
}

// toResendVars troca as variáveis do Kalidash pelas do Resend (assunto, prévia e corpo). O que já está no formato
// do Resend ({{{...}}}) fica como está.
func toResendVars(text string) string {
	const open, closeTok = "\x00RS_OPEN\x00", "\x00RS_CLOSE\x00"
	text = strings.NewReplacer("{{{", open, "}}}", closeTok).Replace(text)
	text = renderTemplate(text, broadcastVars, false)
	return strings.NewReplacer(open, "{{{", closeTok, "}}}").Replace(text)
}

// toBroadcastHTML troca as variáveis e garante o link de descadastro (o Resend exige um em broadcast).
func toBroadcastHTML(body string) string {
	body = toResendVars(body)
	if !strings.Contains(body, unsubscribeToken) {
		body = withFooter(body, unsubscribeFooter(unsubscribeToken))
	}
	return body
}

// toTestHTML preenche as variáveis com os dados de quem testa; o descadastro vira um link inerte.
func toTestHTML(body string, vars map[string]string) string {
	body = strings.ReplaceAll(body, unsubscribeToken, "#")
	body = renderTemplate(body, vars, true)
	if !strings.Contains(body, `data-unsubscribe`) {
		body = withFooter(body, unsubscribeFooter("#"))
	}
	return body
}

func unsubscribeFooter(href string) string {
	return `<div data-unsubscribe style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#8a8a8a;text-align:center;padding:24px 16px">` +
		`Você recebe este e-mail porque se inscreveu na newsletter do blog. <a href="` + href + `" style="color:#8a8a8a;text-decoration:underline">Cancelar inscrição</a></div>`
}

func withFooter(body, footer string) string {
	if i := strings.LastIndex(strings.ToLower(body), "</body>"); i >= 0 {
		return body[:i] + footer + body[i:]
	}
	return body + footer
}

// ---- envio de teste ----

func handleNewsletterEditionTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	m, ok := principalOf(r)
	if !ok || m.Email == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "o teste vai para o e-mail de quem está logado, e esta API está sem login"})
		return
	}
	e, err := getEdition(r.PathValue("id"))
	if errors.Is(err, sql.ErrNoRows) {
		editionNotFound(w)
		return
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	body, err := editionContent(e)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	vars := map[string]string{"nome": m.Name, "email": m.Email}
	if parts := strings.Fields(m.Name); len(parts) > 0 {
		vars["primeiro_nome"] = parts[0]
	}
	subject := "[Teste] " + renderTemplate(e.Subject, vars, false)
	key := fmt.Sprintf("newsletter-test:%s:%d", e.ID, time.Now().UnixNano())
	if _, err := resendSendJob(m.Email, truncRunes(subject, 200), toTestHTML(body, vars), key); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"to": m.Email})
}

// ---- envio de verdade (broadcast) ----

// resendJSON é trocável nos testes: chama a API do Resend e decodifica a resposta.
var resendJSON = func(method, path string, body, out any) (int, string, error) {
	var rd io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, resendAPI+path, rd)
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("RESEND_API_KEY"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return 0, "", errors.New("sem conexão com o Resend")
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 256<<10))
	var msg struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(raw, &msg)
	if out != nil && resp.StatusCode < 300 {
		_ = json.Unmarshal(raw, out)
	}
	return resp.StatusCode, msg.Message, nil
}

func resendFail(step string, status int, msg string) error {
	s := fmt.Sprintf("o Resend recusou %s (%d)", step, status)
	if msg != "" {
		s += ": " + truncRunes(msg, 300)
	}
	return errors.New(s)
}

// sendBroadcast cria o broadcast no segmento e manda (scheduledAt vazio = agora). Devolve o id do broadcast.
func sendBroadcast(segment, name, subject, preview, htmlBody string, scheduledAt *time.Time) (string, error) {
	from := os.Getenv("RESEND_FROM_EMAIL")
	if os.Getenv("RESEND_API_KEY") == "" || from == "" {
		return "", errors.New("falta RESEND_API_KEY ou RESEND_FROM_EMAIL na API")
	}
	body := map[string]any{"segment_id": segment, "from": from, "subject": subject, "html": htmlBody, "name": name}
	if preview != "" {
		body["preview_text"] = preview
	}
	if rt := strings.TrimSpace(os.Getenv("EMAIL_REPLY_TO")); rt != "" {
		body["reply_to"] = rt
	}
	var created struct {
		ID string `json:"id"`
	}
	st, msg, err := resendJSON(http.MethodPost, "/broadcasts", body, &created)
	if err != nil {
		return "", err
	}
	if st >= 300 || created.ID == "" {
		return "", resendFail("criar a edição", st, msg)
	}
	send := map[string]any{}
	if scheduledAt != nil {
		send["scheduled_at"] = scheduledAt.UTC().Format(time.RFC3339)
	}
	st, msg, err = resendJSON(http.MethodPost, "/broadcasts/"+created.ID+"/send", send, nil)
	if err != nil {
		return created.ID, err
	}
	if st >= 300 {
		return created.ID, resendFail("enviar a edição", st, msg)
	}
	return created.ID, nil
}

func handleNewsletterEditionSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var in struct {
		ScheduledAt string `json:"scheduledAt"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4<<10)
	_ = json.NewDecoder(r.Body).Decode(&in)
	var when *time.Time
	if s := strings.TrimSpace(in.ScheduledAt); s != "" {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "data de agendamento inválida"})
			return
		}
		if t.Before(time.Now().Add(2*time.Minute)) || t.After(time.Now().Add(30*24*time.Hour)) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "agende entre alguns minutos e 30 dias a partir de agora"})
			return
		}
		when = &t
	}
	id := r.PathValue("id")
	e, err := getEdition(id)
	if errors.Is(err, sql.ErrNoRows) {
		editionNotFound(w)
		return
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	_, segment, _ := audienceSegment(e.Audience)
	if segment == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "o segmento deste público não está configurado na API"})
		return
	}
	body, err := editionContent(e)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	// Trava: só um envio por edição, mesmo com clique duplo ou duas abas.
	res, err := db.Exec(`UPDATE NewsletterEdition SET status = 'SENDING', updatedAt = ? WHERE id = ? AND status IN ('DRAFT', 'FAILED')`, time.Now(), id)
	if err != nil {
		writeErr(w, err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "esta edição já foi enviada ou está sendo enviada"})
		return
	}
	final := toBroadcastHTML(body)
	bid, sendErr := sendBroadcast(segment, e.Name, toResendVars(e.Subject), toResendVars(e.PreviewText), final, when)
	now := time.Now()
	switch {
	case sendErr != nil:
		_, _ = db.Exec(`UPDATE NewsletterEdition SET status = 'FAILED', broadcastId = ?, lastError = ?, updatedAt = ? WHERE id = ?`, bid, truncRunes(sendErr.Error(), 500), now, id)
	case when != nil:
		_, _ = db.Exec(`UPDATE NewsletterEdition SET status = 'SCHEDULED', broadcastId = ?, html = ?, scheduledAt = ?, sentBy = ?, lastError = '', updatedAt = ? WHERE id = ?`, bid, final, *when, actorOf(r), now, id)
	default:
		_, _ = db.Exec(`UPDATE NewsletterEdition SET status = 'SENT', broadcastId = ?, html = ?, sentAt = ?, sentBy = ?, lastError = '', updatedAt = ? WHERE id = ?`, bid, final, now, actorOf(r), now, id)
	}
	got, err := getEdition(id)
	if err != nil {
		writeErr(w, err)
		return
	}
	if sendErr != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": sendErr.Error(), "edition": got})
		return
	}
	writeJSON(w, http.StatusOK, got)
}

// ---- sincronizar inscritos antigos com o segmento ----

type syncState struct {
	Running  bool       `json:"running"`
	Total    int        `json:"total"`
	Done     int        `json:"done"`
	Failed   int        `json:"failed"`
	Finished *time.Time `json:"finishedAt,omitempty"`
	Error    string     `json:"error,omitempty"`
}

var (
	syncMu  sync.Mutex
	syncNow syncState
)

func newsletterSyncState() syncState {
	syncMu.Lock()
	defer syncMu.Unlock()
	return syncNow
}

// syncPause respeita o limite de requisições por segundo do Resend (trocável nos testes).
var syncPause = 600 * time.Millisecond

func newsletterSubscribers() ([]leadInput, error) {
	rows, err := db.Query(`SELECT name, email, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(customData, '$.formSource')), '') FROM ` + leadTbl + `
		WHERE archivedAt IS NULL AND email <> '' AND (JSON_UNQUOTE(JSON_EXTRACT(customData, '$.formSource')) LIKE 'blog-newsletter%' OR JSON_CONTAINS(tags, '"Newsletter"'))
		ORDER BY createdAt`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[string]int{}
	out := []leadInput{}
	for rows.Next() {
		var in leadInput
		if err := rows.Scan(&in.Name, &in.Email, &in.Source); err != nil {
			return nil, err
		}
		key := strings.ToLower(strings.TrimSpace(in.Email))
		if i, ok := seen[key]; ok {
			// Mesma pessoa em mais de um formulário: o material gratuito vence (entra nos dois segmentos).
			if strings.HasPrefix(in.Source, newsletterSource+"-material") {
				out[i].Source = in.Source
			}
			continue
		}
		seen[key] = len(out)
		out = append(out, in)
	}
	return out, rows.Err()
}

func handleNewsletterSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) == "" || strings.TrimSpace(os.Getenv("RESEND_NEWSLETTER_SEGMENT_ID")) == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "falta RESEND_API_KEY ou RESEND_NEWSLETTER_SEGMENT_ID na API"})
		return
	}
	subs, err := newsletterSubscribers()
	if err != nil {
		writeErr(w, err)
		return
	}
	syncMu.Lock()
	if syncNow.Running {
		syncMu.Unlock()
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a sincronização já está rodando"})
		return
	}
	syncNow = syncState{Running: true, Total: len(subs)}
	syncMu.Unlock()
	go runNewsletterSync(subs)
	writeJSON(w, http.StatusAccepted, newsletterSyncState())
}

func runNewsletterSync(subs []leadInput) {
	var lastErr string
	for i, in := range subs {
		c, ok := newsletterContactFor(in)
		failed := false
		if ok {
			if err := syncNewsletterContact(c); err != nil {
				failed, lastErr = true, err.Error()
			}
		}
		syncMu.Lock()
		syncNow.Done++
		if failed {
			syncNow.Failed++
		}
		syncMu.Unlock()
		if i < len(subs)-1 {
			time.Sleep(syncPause)
		}
	}
	now := time.Now()
	syncMu.Lock()
	syncNow.Running, syncNow.Finished, syncNow.Error = false, &now, lastErr
	n, f := syncNow.Done, syncNow.Failed
	syncMu.Unlock()
	log.Printf("📬 newsletter → Resend: %d inscritos sincronizados, %d com falha", n, f)
}
