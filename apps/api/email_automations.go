package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// Automações de e-mail no servidor (D27, D38, D39). Fluxos PRONTOS que se ligam e desligam: cada um tem um
// evento de origem, um modelo de e-mail (EmailTemplate) e um atraso. Quando o evento acontece, o servidor grava um
// EmailJob (a fila, no MySQL); um worker em goroutine envia pelo Resend, com nova tentativa progressiva. Nada
// depende de navegador aberto.
//
// Desligado por padrão: com EMAIL_AUTOMATIONS=1 a API cria EmailTemplate, EmailAutomation e EmailJob na subida
// (CREATE TABLE IF NOT EXISTS, nada é alterado nem apagado), registra /api/email/* e liga o worker.
//
// Eventos emitidos hoje:
//   lead.criado          IngestLead (formulário do site e connect.js), na MESMA transação do lead (outbox)
//   newsletter.inscrito  idem, quando a inscrição vem da newsletter do blog
//   oportunidade.ganha   mover a oportunidade para uma etapa Ganha (/api/leads/move)
//
// Um e-mail por fluxo e por registro: a chave de idempotência (fluxo:entidade:id) é única na fila e vai também
// para o Resend (Idempotency-Key), então clique duplo, nova tentativa ou reenvio do formulário não duplicam.

func emailAutomationsEnabled() bool { return os.Getenv("EMAIL_AUTOMATIONS") == "1" }

const emailSchema = `
CREATE TABLE IF NOT EXISTS EmailTemplate (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(160) NOT NULL,
	tag VARCHAR(80) NOT NULL DEFAULT '',
	subject VARCHAR(200) NOT NULL,
	html MEDIUMTEXT NOT NULL,
	design JSON NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS EmailAutomation (
	id VARCHAR(64) PRIMARY KEY,
	active TINYINT(1) NOT NULL DEFAULT 0,
	templateId VARCHAR(64) NULL,
	delayMinutes INT NOT NULL DEFAULT 0,
	updatedAt DATETIME NOT NULL,
	updatedBy VARCHAR(160) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS EmailJob (
	id VARCHAR(64) PRIMARY KEY,
	automationId VARCHAR(64) NOT NULL,
	event VARCHAR(64) NOT NULL,
	entityKind VARCHAR(16) NOT NULL,
	entityId VARCHAR(64) NOT NULL,
	entityName VARCHAR(255) NOT NULL DEFAULT '',
	toEmail VARCHAR(255) NOT NULL,
	vars JSON NULL,
	subject VARCHAR(200) NOT NULL DEFAULT '',
	status VARCHAR(12) NOT NULL,
	attempts INT NOT NULL DEFAULT 0,
	runAt DATETIME NOT NULL,
	lockedAt DATETIME NULL,
	lastError VARCHAR(500) NOT NULL DEFAULT '',
	providerId VARCHAR(80) NOT NULL DEFAULT '',
	idempotencyKey VARCHAR(200) NOT NULL,
	createdAt DATETIME NOT NULL,
	sentAt DATETIME NULL,
	UNIQUE KEY uq_emailjob_idem (idempotencyKey),
	INDEX idx_emailjob_due (status, runAt),
	INDEX idx_emailjob_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

func ensureEmailSchema() {
	for _, stmt := range splitStatements(emailSchema) {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("❌ Erro ao criar tabelas de e-mail: %v", err)
		}
	}
	log.Println("✅ Tabelas de modelos, automações e fila de e-mail prontas (EMAIL_AUTOMATIONS=1)")
}

// ---- catálogo de fluxos prontos (D27) ----

type emailFlow struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Event        string `json:"event"`
	EventLabel   string `json:"eventLabel"`
	Recipient    string `json:"recipient"`
	Detail       string `json:"detail"`
	DefaultDelay int    `json:"defaultDelayMinutes"`
	// StopIfContacted: na hora do envio, desiste se o lead já não está ativo ou já teve o primeiro contato.
	StopIfContacted bool `json:"stopIfContacted"`
}

var emailFlows = []emailFlow{
	{ID: "lead-boas-vindas", Name: "Boas-vindas ao lead", Event: "lead.criado", EventLabel: "Lead criado (formulário)",
		Recipient: "O lead", Detail: "Assim que alguém envia um formulário do site ou de um projeto conectado."},
	{ID: "lead-follow-up", Name: "Follow-up do lead sem contato", Event: "lead.criado", EventLabel: "Lead criado (formulário)",
		Recipient: "O lead", Detail: "Depois do atraso, só se o lead continua ativo e ninguém registrou o primeiro contato.",
		DefaultDelay: 2 * 24 * 60, StopIfContacted: true},
	{ID: "newsletter-boas-vindas", Name: "Boas-vindas à newsletter", Event: "newsletter.inscrito", EventLabel: "Inscrição na newsletter do blog",
		Recipient: "Quem se inscreveu", Detail: "Logo depois da inscrição pelo blog."},
	{ID: "cliente-boas-vindas", Name: "Boas-vindas ao cliente", Event: "oportunidade.ganha", EventLabel: "Oportunidade ganha",
		Recipient: "O contato da oportunidade", Detail: "Quando a oportunidade chega a uma etapa do tipo Ganha."},
}

func flowByID(id string) (emailFlow, bool) {
	for _, f := range emailFlows {
		if f.ID == id {
			return f, true
		}
	}
	return emailFlow{}, false
}

// ---- eventos → fila ----

// emailEvent é o que aconteceu e a quem escrever. Vars alimenta o modelo ({{nome}}, {{primeiro_nome}}...).
type emailEvent struct {
	Event      string
	EntityKind string // lead, opportunity
	EntityID   string
	EntityName string
	To         string
	Vars       map[string]string
}

type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
}

// enqueueEmailEvent grava na fila um job por fluxo ATIVO ligado ao evento. Com tx, entra na mesma transação da
// mudança (outbox: ou os dois, ou nenhum). Devolve quantos jobs novos entraram (repetidos são ignorados).
func enqueueEmailEvent(x execer, ev emailEvent, now time.Time) (int, error) {
	if !emailAutomationsEnabled() || strings.TrimSpace(ev.To) == "" {
		return 0, nil
	}
	rows, err := x.Query(`SELECT id, delayMinutes FROM EmailAutomation WHERE active = 1 AND templateId IS NOT NULL`)
	if err != nil {
		return 0, err
	}
	type on struct {
		id    string
		delay int
	}
	var active []on
	for rows.Next() {
		var a on
		if err := rows.Scan(&a.id, &a.delay); err != nil {
			rows.Close()
			return 0, err
		}
		active = append(active, a)
	}
	rows.Close()
	vars := map[string]string{"email": ev.To}
	for k, v := range ev.Vars {
		vars[k] = v
	}
	if _, ok := vars["primeiro_nome"]; !ok {
		if parts := strings.Fields(vars["nome"]); len(parts) > 0 {
			vars["primeiro_nome"] = parts[0]
		}
	}
	rawVars, _ := json.Marshal(vars)
	n := 0
	for _, a := range active {
		f, ok := flowByID(a.id)
		if !ok || f.Event != ev.Event {
			continue
		}
		key := fmt.Sprintf("%s:%s:%s", f.ID, ev.EntityKind, ev.EntityID)
		res, err := x.Exec(`INSERT IGNORE INTO EmailJob (id, automationId, event, entityKind, entityId, entityName, toEmail, vars, status, attempts, runAt, idempotencyKey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', 0, ?, ?, ?)`,
			wfID("ej"), f.ID, ev.Event, ev.EntityKind, ev.EntityID, truncRunes(ev.EntityName, 255), ev.To, string(rawVars),
			now.Add(time.Duration(a.delay)*time.Minute), key, now)
		if err != nil {
			return n, err
		}
		if c, _ := res.RowsAffected(); c > 0 {
			n++
		}
	}
	return n, nil
}

// emitOpportunityWon: chamado depois de mover a oportunidade para uma etapa Ganha. Melhor esforço (não derruba o
// movimento); o destinatário é o contato da oportunidade.
func emitOpportunityWon(oppID string) {
	if !emailAutomationsEnabled() {
		return
	}
	var title string
	var name, email sql.NullString
	err := db.QueryRow(`SELECT o.title, c.name, c.email FROM Opportunity o LEFT JOIN Contact c ON c.id = o.contactId WHERE o.id = ?`, oppID).Scan(&title, &name, &email)
	if err != nil {
		log.Printf("⚠️ e-mail automático (ganho %s): %v", oppID, err)
		return
	}
	if !email.Valid || strings.TrimSpace(email.String) == "" {
		return
	}
	if _, err := enqueueEmailEvent(db, emailEvent{
		Event: "oportunidade.ganha", EntityKind: "opportunity", EntityID: oppID, EntityName: title, To: email.String,
		Vars: map[string]string{"nome": name.String, "oportunidade": title},
	}, time.Now()); err != nil {
		log.Printf("⚠️ e-mail automático (ganho %s): %v", oppID, err)
	}
}

// movedToWon: o movimento levou a oportunidade a Ganho. O admin avisa (won:true); com WORKFLOW_API=1 o servidor
// confere também pelo tipo da etapa, para não depender só do que o cliente diz.
func movedToWon(stage string, wonAt any) bool {
	if wonAt != nil {
		return true
	}
	if workflowEnabled() {
		if kind, err := stageKindOf(stage); err == nil && kind == "WON" {
			return true
		}
	}
	return false
}

// ---- modelo → e-mail ----

// renderTemplate troca {{chave}} pelos valores. No HTML o valor é escapado; no assunto vai como texto (sem quebra
// de linha). Chave desconhecida vira vazio, para nunca mandar "{{nome}}" para o lead.
func renderTemplate(text string, vars map[string]string, escape bool) string {
	var b strings.Builder
	for {
		i := strings.Index(text, "{{")
		if i < 0 {
			b.WriteString(text)
			break
		}
		j := strings.Index(text[i:], "}}")
		if j < 0 {
			b.WriteString(text)
			break
		}
		b.WriteString(text[:i])
		key := strings.ToLower(strings.TrimSpace(text[i+2 : i+j]))
		val := vars[key]
		if escape {
			val = html.EscapeString(val)
		} else {
			val = strings.NewReplacer("\r", " ", "\n", " ").Replace(val)
		}
		b.WriteString(val)
		text = text[i+j+2:]
	}
	return b.String()
}

func truncRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}

// ---- worker ----

const emailMaxAttempts = 5

// retryDelay: 1 min, 5 min, 30 min, 2 h. Depois da 5ª tentativa o job fica FAILED (dá para reenviar pela tela).
func retryDelay(attempt int) time.Duration {
	switch attempt {
	case 1:
		return time.Minute
	case 2:
		return 5 * time.Minute
	case 3:
		return 30 * time.Minute
	default:
		return 2 * time.Hour
	}
}

// sendError diz se vale tentar de novo (rede, 429, 5xx) ou não (4xx: endereço inválido, domínio não verificado).
type sendError struct {
	msg       string
	retryable bool
}

func (e *sendError) Error() string { return e.msg }

// resendSendJob é trocável nos testes: nenhum teste fala com o Resend de verdade.
var resendSendJob = func(to, subject, htmlBody, idemKey string) (string, error) {
	key := os.Getenv("RESEND_API_KEY")
	if key == "" {
		return "", &sendError{msg: "RESEND_API_KEY não configurada", retryable: true}
	}
	from := os.Getenv("RESEND_FROM_EMAIL")
	if from == "" {
		return "", &sendError{msg: "RESEND_FROM_EMAIL não configurado (remetente de um domínio verificado)", retryable: true}
	}
	body := map[string]any{"from": from, "to": []string{to}, "subject": subject, "html": htmlBody}
	if rt := strings.TrimSpace(os.Getenv("EMAIL_REPLY_TO")); rt != "" {
		body["reply_to"] = rt
	}
	raw, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, resendAPI+"/emails", strings.NewReader(string(raw)))
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", truncRunes(idemKey, 256))
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return "", &sendError{msg: "sem conexão com o Resend", retryable: true}
	}
	defer resp.Body.Close()
	var out struct {
		ID      string `json:"id"`
		Message string `json:"message"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&out)
	if resp.StatusCode >= 300 {
		msg := fmt.Sprintf("o Resend recusou (%d)", resp.StatusCode)
		if out.Message != "" {
			msg += ": " + truncRunes(out.Message, 300)
		}
		return "", &sendError{msg: msg, retryable: resp.StatusCode == 429 || resp.StatusCode >= 500}
	}
	return out.ID, nil
}

type dueJob struct {
	ID, AutomationID, EntityKind, EntityID, To, Key string
	Vars                                            map[string]string
	Attempts                                        int
}

// claimDueJobs pega até `limit` jobs vencidos. O UPDATE condicional garante que duas instâncias da API não
// peguem o mesmo job. Jobs presos em SENDING há mais de 10 min (API caiu no meio) voltam para a fila.
func claimDueJobs(now time.Time, limit int) ([]dueJob, error) {
	if _, err := db.Exec(`UPDATE EmailJob SET status = 'QUEUED', lockedAt = NULL WHERE status = 'SENDING' AND lockedAt < ?`, now.Add(-10*time.Minute)); err != nil {
		return nil, err
	}
	rows, err := db.Query(`SELECT id FROM EmailJob WHERE status = 'QUEUED' AND runAt <= ? ORDER BY runAt LIMIT ?`, now, limit)
	if err != nil {
		return nil, err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	var out []dueJob
	for _, id := range ids {
		res, err := db.Exec(`UPDATE EmailJob SET status = 'SENDING', lockedAt = ?, attempts = attempts + 1 WHERE id = ? AND status = 'QUEUED'`, now, id)
		if err != nil {
			return out, err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			continue // outra instância pegou
		}
		var j dueJob
		var vars sql.NullString
		if err := db.QueryRow(`SELECT id, automationId, entityKind, entityId, toEmail, idempotencyKey, vars, attempts FROM EmailJob WHERE id = ?`, id).
			Scan(&j.ID, &j.AutomationID, &j.EntityKind, &j.EntityID, &j.To, &j.Key, &vars, &j.Attempts); err != nil {
			return out, err
		}
		j.Vars = decodeJSON(nullBytes(vars), map[string]string{})
		out = append(out, j)
	}
	return out, nil
}

func nullBytes(s sql.NullString) []byte {
	if !s.Valid {
		return nil
	}
	return []byte(s.String)
}

// stillWanted: o fluxo continua ligado e, para follow-up, o lead continua ativo e sem primeiro contato.
// Devolve o motivo de cancelar ("" = enviar).
func stillWanted(j dueJob, f emailFlow) (string, error) {
	var active int
	err := db.QueryRow(`SELECT active FROM EmailAutomation WHERE id = ?`, j.AutomationID).Scan(&active)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && active == 0) {
		return "o fluxo foi desligado antes do envio", nil
	}
	if err != nil {
		return "", err
	}
	if f.StopIfContacted && j.EntityKind == "lead" {
		var status string
		var first sql.NullTime
		err := db.QueryRow(`SELECT status, firstContactAt FROM `+leadTbl+` WHERE id = ?`, j.EntityID).Scan(&status, &first)
		if errors.Is(err, sql.ErrNoRows) {
			return "o lead não existe mais", nil
		}
		if err != nil {
			return "", err
		}
		if status != "ACTIVE" {
			return "o lead não está mais ativo", nil
		}
		if first.Valid {
			return "o lead já teve o primeiro contato", nil
		}
	}
	return "", nil
}

// processJob envia um job já reservado e grava o resultado.
func processJob(j dueJob, now time.Time) {
	finish := func(status, subject, providerID, errMsg string, runAt *time.Time) {
		var sentAt any
		if status == "SENT" {
			sentAt = now
		}
		q := `UPDATE EmailJob SET status = ?, subject = IF(? = '', subject, ?), providerId = ?, lastError = ?, lockedAt = NULL, sentAt = COALESCE(?, sentAt)`
		args := []any{status, subject, truncRunes(subject, 200), providerID, truncRunes(errMsg, 500), sentAt}
		if runAt != nil {
			q += `, runAt = ?`
			args = append(args, *runAt)
		}
		q += ` WHERE id = ?`
		args = append(args, j.ID)
		if _, err := db.Exec(q, args...); err != nil {
			log.Printf("⚠️ fila de e-mail: não gravei o resultado do job %s: %v", j.ID, err)
		}
	}
	f, ok := flowByID(j.AutomationID)
	if !ok {
		finish("CANCELED", "", "", "fluxo desconhecido", nil)
		return
	}
	reason, err := stillWanted(j, f)
	if err != nil {
		retry := now.Add(retryDelay(j.Attempts))
		finish("QUEUED", "", "", err.Error(), &retry)
		return
	}
	if reason != "" {
		finish("CANCELED", "", "", reason, nil)
		return
	}
	var subject, body string
	err = db.QueryRow(`SELECT t.subject, t.html FROM EmailAutomation a JOIN EmailTemplate t ON t.id = a.templateId WHERE a.id = ?`, j.AutomationID).Scan(&subject, &body)
	if errors.Is(err, sql.ErrNoRows) {
		finish("FAILED", "", "", "o fluxo está sem modelo de e-mail", nil)
		return
	}
	if err != nil {
		retry := now.Add(retryDelay(j.Attempts))
		finish("QUEUED", "", "", err.Error(), &retry)
		return
	}
	subject = strings.TrimSpace(renderTemplate(subject, j.Vars, false))
	body = renderTemplate(body, j.Vars, true)
	id, err := resendSendJob(j.To, subject, body, j.Key)
	if err == nil {
		finish("SENT", subject, id, "", nil)
		return
	}
	var se *sendError
	retryable := !errors.As(err, &se) || se.retryable
	if retryable && j.Attempts < emailMaxAttempts {
		retry := now.Add(retryDelay(j.Attempts))
		finish("QUEUED", subject, "", err.Error(), &retry)
		return
	}
	finish("FAILED", subject, "", err.Error(), nil)
}

// runEmailWorkerOnce processa o que estiver vencido. Exposto para os testes e para o worker.
func runEmailWorkerOnce(now time.Time) int {
	jobs, err := claimDueJobs(now, 20)
	if err != nil {
		log.Printf("⚠️ fila de e-mail: %v", err)
	}
	for _, j := range jobs {
		processJob(j, now)
	}
	return len(jobs)
}

func startEmailWorker() {
	every := time.Duration(envInt("EMAIL_WORKER_SECONDS", 20)) * time.Second
	go func() {
		t := time.NewTicker(every)
		defer t.Stop()
		for {
			runEmailWorkerOnce(time.Now())
			<-t.C
		}
	}()
	log.Printf("✅ Worker da fila de e-mail ligado (a cada %s)", every)
}

// ---- rotas: /api/email/* ----

func registerEmailRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/email/templates", enableCORS(handleEmailTemplates))
	mux.HandleFunc("/api/email/templates/{id}", enableCORS(handleEmailTemplateByID))
	mux.HandleFunc("/api/email/automations", enableCORS(handleEmailAutomations))
	mux.HandleFunc("/api/email/automations/{id}", enableCORS(handleEmailAutomationByID))
	mux.HandleFunc("/api/email/jobs", enableCORS(handleEmailJobs))
	mux.HandleFunc("/api/email/jobs/{id}/retry", enableCORS(handleEmailJobRetry))
}

type EmailTemplateDTO struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Tag       string          `json:"tag"`
	Subject   string          `json:"subject"`
	HTML      string          `json:"html"`
	Design    json.RawMessage `json:"design,omitempty"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

const emailTemplateMaxHTML = 600 << 10

func validateEmailTemplate(t *EmailTemplateDTO) error {
	t.Name = strings.TrimSpace(t.Name)
	t.Tag = strings.TrimSpace(t.Tag)
	t.Subject = strings.TrimSpace(t.Subject)
	switch {
	case t.Name == "" || len([]rune(t.Name)) > 160:
		return errors.New("dê um nome ao modelo (até 160 caracteres)")
	case len([]rune(t.Tag)) > 80:
		return errors.New("etiqueta longa demais")
	case t.Subject == "" || len([]rune(t.Subject)) > 200 || strings.ContainsAny(t.Subject, "\r\n"):
		return errors.New("assunto inválido (até 200 caracteres, sem quebra de linha)")
	case strings.TrimSpace(t.HTML) == "" || len(t.HTML) > emailTemplateMaxHTML:
		return errors.New("o conteúdo do e-mail está vazio ou grande demais")
	}
	if len(t.Design) > 0 && !json.Valid(t.Design) {
		return errors.New("layout inválido")
	}
	return nil
}

func scanTemplate(sc interface{ Scan(...any) error }) (EmailTemplateDTO, error) {
	var t EmailTemplateDTO
	var design sql.NullString
	err := sc.Scan(&t.ID, &t.Name, &t.Tag, &t.Subject, &t.HTML, &design, &t.UpdatedAt)
	if design.Valid && design.String != "" && design.String != "null" {
		t.Design = json.RawMessage(design.String)
	}
	return t, err
}

const templateCols = `id, name, tag, subject, html, design, updatedAt`

func handleEmailTemplates(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`SELECT ` + templateCols + ` FROM EmailTemplate ORDER BY name`)
		if err != nil {
			writeErr(w, err)
			return
		}
		defer rows.Close()
		out := []EmailTemplateDTO{}
		for rows.Next() {
			t, err := scanTemplate(rows)
			if err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, t)
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var t EmailTemplateDTO
		r.Body = http.MaxBytesReader(w, r.Body, 2*emailTemplateMaxHTML)
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido ou grande demais"})
			return
		}
		if err := validateEmailTemplate(&t); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		t.ID = wfID("et")
		now := time.Now()
		if _, err := db.Exec(`INSERT INTO EmailTemplate (id, name, tag, subject, html, design, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			t.ID, t.Name, t.Tag, t.Subject, t.HTML, rawOrNull(t.Design), now, now); err != nil {
			writeErr(w, err)
			return
		}
		got, err := scanTemplate(db.QueryRow(`SELECT `+templateCols+` FROM EmailTemplate WHERE id = ?`, t.ID))
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, got)
	default:
		methodNotAllowed(w)
	}
}

func rawOrNull(raw json.RawMessage) any {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return string(raw)
}

func handleEmailTemplateByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	switch r.Method {
	case http.MethodGet:
		t, err := scanTemplate(db.QueryRow(`SELECT `+templateCols+` FROM EmailTemplate WHERE id = ?`, id))
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "modelo não encontrado"})
			return
		}
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, t)
	case http.MethodPut:
		var t EmailTemplateDTO
		r.Body = http.MaxBytesReader(w, r.Body, 2*emailTemplateMaxHTML)
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido ou grande demais"})
			return
		}
		if err := validateEmailTemplate(&t); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		res, err := db.Exec(`UPDATE EmailTemplate SET name = ?, tag = ?, subject = ?, html = ?, design = ?, updatedAt = ? WHERE id = ?`,
			t.Name, t.Tag, t.Subject, t.HTML, rawOrNull(t.Design), time.Now(), id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			var one int
			if err := db.QueryRow(`SELECT 1 FROM EmailTemplate WHERE id = ?`, id).Scan(&one); errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "modelo não encontrado"})
				return
			}
		}
		got, err := scanTemplate(db.QueryRow(`SELECT `+templateCols+` FROM EmailTemplate WHERE id = ?`, id))
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, got)
	case http.MethodDelete:
		var used int
		if err := db.QueryRow(`SELECT COUNT(*) FROM EmailAutomation WHERE templateId = ?`, id).Scan(&used); err != nil {
			writeErr(w, err)
			return
		}
		if used > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "este modelo está em uso por uma automação: troque o modelo dela antes de apagar"})
			return
		}
		res, err := db.Exec(`DELETE FROM EmailTemplate WHERE id = ?`, id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "modelo não encontrado"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		methodNotAllowed(w)
	}
}

type EmailAutomationDTO struct {
	emailFlow
	Active       bool       `json:"active"`
	TemplateID   string     `json:"templateId"`
	DelayMinutes int        `json:"delayMinutes"`
	UpdatedAt    *time.Time `json:"updatedAt,omitempty"`
	UpdatedBy    string     `json:"updatedBy,omitempty"`
	Sent         int        `json:"sent"`
	Queued       int        `json:"queued"`
	Failed       int        `json:"failed"`
}

func listEmailAutomations() ([]EmailAutomationDTO, error) {
	type state struct {
		active    bool
		template  string
		delay     int
		updatedAt time.Time
		updatedBy string
	}
	saved := map[string]state{}
	rows, err := db.Query(`SELECT id, active, templateId, delayMinutes, updatedAt, updatedBy FROM EmailAutomation`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		var s state
		var tpl sql.NullString
		if err := rows.Scan(&id, &s.active, &tpl, &s.delay, &s.updatedAt, &s.updatedBy); err != nil {
			rows.Close()
			return nil, err
		}
		s.template = tpl.String
		saved[id] = s
	}
	rows.Close()
	counts := map[string]map[string]int{}
	rows, err = db.Query(`SELECT automationId, status, COUNT(*) FROM EmailJob GROUP BY automationId, status`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id, st string
		var n int
		if err := rows.Scan(&id, &st, &n); err != nil {
			rows.Close()
			return nil, err
		}
		if counts[id] == nil {
			counts[id] = map[string]int{}
		}
		counts[id][st] = n
	}
	rows.Close()
	out := make([]EmailAutomationDTO, 0, len(emailFlows))
	for _, f := range emailFlows {
		d := EmailAutomationDTO{emailFlow: f, DelayMinutes: f.DefaultDelay}
		if s, ok := saved[f.ID]; ok {
			d.Active, d.TemplateID, d.DelayMinutes, d.UpdatedBy = s.active, s.template, s.delay, s.updatedBy
			at := s.updatedAt
			d.UpdatedAt = &at
		}
		c := counts[f.ID]
		d.Sent, d.Queued, d.Failed = c["SENT"], c["QUEUED"]+c["SENDING"], c["FAILED"]
		out = append(out, d)
	}
	return out, nil
}

func handleEmailAutomations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	list, err := listEmailAutomations()
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"flows":      list,
		"configured": strings.TrimSpace(os.Getenv("RESEND_API_KEY")) != "" && strings.TrimSpace(os.Getenv("RESEND_FROM_EMAIL")) != "",
		"from":       os.Getenv("RESEND_FROM_EMAIL"),
		"variables":  []string{"nome", "primeiro_nome", "email", "oportunidade"},
	})
}

const emailMaxDelayMinutes = 60 * 24 * 60 // 60 dias

func handleEmailAutomationByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		methodNotAllowed(w)
		return
	}
	f, ok := flowByID(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "fluxo não encontrado"})
		return
	}
	var in struct {
		Active       bool   `json:"active"`
		TemplateID   string `json:"templateId"`
		DelayMinutes *int   `json:"delayMinutes"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return
	}
	delay := f.DefaultDelay
	if in.DelayMinutes != nil {
		delay = *in.DelayMinutes
	}
	if delay < 0 || delay > emailMaxDelayMinutes {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "o atraso vai de 0 a 60 dias"})
		return
	}
	in.TemplateID = strings.TrimSpace(in.TemplateID)
	if in.TemplateID != "" {
		var one int
		if err := db.QueryRow(`SELECT 1 FROM EmailTemplate WHERE id = ?`, in.TemplateID).Scan(&one); errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "modelo de e-mail não encontrado"})
			return
		} else if err != nil {
			writeErr(w, err)
			return
		}
	}
	if in.Active && in.TemplateID == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "escolha o modelo de e-mail antes de ligar o fluxo"})
		return
	}
	actor := actorName(r)
	if _, err := db.Exec(`INSERT INTO EmailAutomation (id, active, templateId, delayMinutes, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE active = VALUES(active), templateId = VALUES(templateId), delayMinutes = VALUES(delayMinutes), updatedAt = VALUES(updatedAt), updatedBy = VALUES(updatedBy)`,
		f.ID, in.Active, nullStr(in.TemplateID), delay, time.Now(), actor); err != nil {
		writeErr(w, err)
		return
	}
	log.Printf("AUTH: %s %s o fluxo de e-mail %s", actor, map[bool]string{true: "ligou", false: "desligou/ajustou"}[in.Active], f.ID)
	list, err := listEmailAutomations()
	if err != nil {
		writeErr(w, err)
		return
	}
	for _, d := range list {
		if d.ID == f.ID {
			writeJSON(w, http.StatusOK, d)
			return
		}
	}
}

type EmailJobDTO struct {
	ID           string     `json:"id"`
	AutomationID string     `json:"automationId"`
	Automation   string     `json:"automation"`
	Event        string     `json:"event"`
	EntityKind   string     `json:"entityKind"`
	EntityID     string     `json:"entityId"`
	EntityName   string     `json:"entityName"`
	To           string     `json:"to"`
	Subject      string     `json:"subject"`
	Status       string     `json:"status"`
	Attempts     int        `json:"attempts"`
	RunAt        time.Time  `json:"runAt"`
	LastError    string     `json:"lastError,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	SentAt       *time.Time `json:"sentAt,omitempty"`
}

func handleEmailJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	limit := atoiOr(r.URL.Query().Get("limit"), 100)
	if limit < 1 || limit > 500 {
		limit = 100
	}
	q := `SELECT id, automationId, event, entityKind, entityId, entityName, toEmail, subject, status, attempts, runAt, lastError, createdAt, sentAt FROM EmailJob`
	var args []any
	if st := r.URL.Query().Get("status"); st != "" {
		q += ` WHERE status = ?`
		args = append(args, st)
	}
	q += ` ORDER BY createdAt DESC LIMIT ?`
	args = append(args, limit)
	rows, err := db.Query(q, args...)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []EmailJobDTO{}
	for rows.Next() {
		var j EmailJobDTO
		var sent sql.NullTime
		if err := rows.Scan(&j.ID, &j.AutomationID, &j.Event, &j.EntityKind, &j.EntityID, &j.EntityName, &j.To, &j.Subject, &j.Status, &j.Attempts, &j.RunAt, &j.LastError, &j.CreatedAt, &sent); err != nil {
			writeErr(w, err)
			return
		}
		if sent.Valid {
			j.SentAt = &sent.Time
		}
		if f, ok := flowByID(j.AutomationID); ok {
			j.Automation = f.Name
		}
		out = append(out, j)
	}
	writeJSON(w, http.StatusOK, out)
}

// handleEmailJobRetry devolve para a fila um envio que falhou ou foi cancelado (reenvio manual).
func handleEmailJobRetry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	res, err := db.Exec(`UPDATE EmailJob SET status = 'QUEUED', attempts = 0, runAt = ?, lastError = '', lockedAt = NULL WHERE id = ? AND status IN ('FAILED', 'CANCELED')`, time.Now(), r.PathValue("id"))
	if err != nil {
		writeErr(w, err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "só um envio que falhou ou foi cancelado volta para a fila"})
		return
	}
	log.Printf("AUTH: %s reenviou o e-mail %s", actorName(r), r.PathValue("id"))
	writeJSON(w, http.StatusOK, map[string]string{"status": "QUEUED"})
}
