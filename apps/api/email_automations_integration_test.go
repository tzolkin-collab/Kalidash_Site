package main

import (
	"strings"
	"testing"
	"time"
)

// Automações de e-mail contra um MySQL de verdade (TEST_DSN, só localhost; ver workflow_integration_test.go).
// O Resend é sempre falso aqui (resendSendJob trocado).

func emailDB(t *testing.T) {
	t.Helper()
	crmDB(t)
	t.Setenv("EMAIL_AUTOMATIONS", "1")
	for _, tbl := range []string{"EmailJob", "EmailAutomation", "EmailTemplate"} {
		db.Exec("DROP TABLE IF EXISTS " + tbl)
	}
	ensureEmailSchema()
	ensureEmailSchema() // idempotente
}

type queuedMail struct{ to, subject, html, key string }

func fakeResend(t *testing.T, fail func(n int) error) *[]queuedMail {
	t.Helper()
	var sent []queuedMail
	old := resendSendJob
	resendSendJob = func(to, subject, html, key string) (string, error) {
		if fail != nil {
			if err := fail(len(sent)); err != nil {
				return "", err
			}
		}
		sent = append(sent, queuedMail{to, subject, html, key})
		return "re_" + key, nil
	}
	t.Cleanup(func() { resendSendJob = old })
	return &sent
}

func jobStatus(t *testing.T, flow, entityID string) (status string, attempts int, lastError string) {
	t.Helper()
	if err := db.QueryRow(`SELECT status, attempts, lastError FROM EmailJob WHERE automationId = ? AND entityId = ?`, flow, entityID).Scan(&status, &attempts, &lastError); err != nil {
		t.Fatalf("job %s/%s: %v", flow, entityID, err)
	}
	return
}

func TestIntegrationEmailAutomations(t *testing.T) {
	emailDB(t)
	sent := fakeResend(t, nil)

	// Modelo e fluxo: ligar sem modelo é recusado.
	var tpl EmailTemplateDTO
	res := call(handleEmailTemplates, "POST", "/api/email/templates", "", map[string]any{
		"name": "Boas-vindas", "subject": "Oi, {{primeiro_nome}}", "html": "<p>Olá {{nome}}</p>", "design": map[string]any{"a": 1},
	})
	if res.code != 201 {
		t.Fatalf("criar modelo: %d %s", res.code, res.body)
	}
	res.into(t, &tpl)
	if res := call(handleEmailAutomationByID, "PUT", "/api/email/automations/lead-boas-vindas", "lead-boas-vindas", map[string]any{"active": true}); res.code != 422 {
		t.Errorf("ligar sem modelo: %d", res.code)
	}
	if res := call(handleEmailAutomationByID, "PUT", "/api/email/automations/nao-existe", "nao-existe", map[string]any{"active": false}); res.code != 404 {
		t.Errorf("fluxo inexistente: %d", res.code)
	}
	if res := call(handleEmailAutomationByID, "PUT", "/api/email/automations/lead-boas-vindas", "lead-boas-vindas", map[string]any{"active": true, "templateId": tpl.ID}); res.code != 200 {
		t.Fatalf("ligar fluxo: %d %s", res.code, res.body)
	}
	// Modelo em uso não é apagado.
	if res := call(handleEmailTemplateByID, "DELETE", "/api/email/templates/x", tpl.ID, nil); res.code != 409 {
		t.Errorf("apagar modelo em uso: %d", res.code)
	}

	// Lead do formulário: o job entra na transação do lead.
	lead, err := (sqlConnectStore{}).IngestLead(inboundLead{
		Project: Project{PipelineID: "q4", StageID: "q4:novos", SourceName: "Site"},
		Name:    "Ana <Souza>", Email: "ana@example.com", Actor: "Site",
	})
	if err != nil {
		t.Fatal(err)
	}
	if st, _, _ := jobStatus(t, "lead-boas-vindas", lead.ID); st != "QUEUED" {
		t.Fatalf("job do lead: %s", st)
	}
	// Envio de teste (connect.js em modo teste) não dispara nada.
	testLead, err := (sqlConnectStore{}).IngestLead(inboundLead{Project: Project{PipelineID: "q4", StageID: "q4:novos", SourceName: "Site"}, Name: "T", Email: "t@example.com", Test: true})
	if err != nil {
		t.Fatal(err)
	}
	var n int
	db.QueryRow(`SELECT COUNT(*) FROM EmailJob WHERE entityId = ?`, testLead.ID).Scan(&n)
	if n != 0 {
		t.Errorf("lead de teste entrou na fila")
	}
	// Repetir o evento não duplica (chave de idempotência).
	if got, err := enqueueEmailEvent(db, emailEvent{Event: "lead.criado", EntityKind: "lead", EntityID: lead.ID, To: "ana@example.com"}, time.Now()); err != nil || got != 0 {
		t.Errorf("evento repetido: %d %v", got, err)
	}

	now := time.Now()
	if got := runEmailWorkerOnce(now); got != 1 {
		t.Fatalf("worker processou %d", got)
	}
	if len(*sent) != 1 || (*sent)[0].subject != "Oi, Ana" || !strings.Contains((*sent)[0].html, "Ana &lt;Souza&gt;") || (*sent)[0].key != "lead-boas-vindas:lead:"+lead.ID {
		t.Fatalf("envio: %+v", *sent)
	}
	if st, _, _ := jobStatus(t, "lead-boas-vindas", lead.ID); st != "SENT" {
		t.Errorf("depois do envio: %s", st)
	}
	if got := runEmailWorkerOnce(now.Add(time.Hour)); got != 0 {
		t.Errorf("enviado não volta: %d", got)
	}

	// Follow-up com atraso: não sai antes da hora e desiste se o lead teve contato.
	if res := call(handleEmailAutomationByID, "PUT", "/api/email/automations/lead-follow-up", "lead-follow-up", map[string]any{"active": true, "templateId": tpl.ID, "delayMinutes": 60}); res.code != 200 {
		t.Fatalf("ligar follow-up: %d %s", res.code, res.body)
	}
	lead2, err := (sqlConnectStore{}).IngestLead(inboundLead{Project: Project{PipelineID: "q4", StageID: "q4:novos", SourceName: "Site"}, Name: "Bia", Email: "bia@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	runEmailWorkerOnce(time.Now()) // sai só o de boas-vindas da Bia
	if st, _, _ := jobStatus(t, "lead-follow-up", lead2.ID); st != "QUEUED" {
		t.Errorf("follow-up saiu antes da hora: %s", st)
	}
	if _, err := db.Exec(`UPDATE `+leadTbl+` SET firstContactAt = ? WHERE id = ?`, time.Now(), lead2.ID); err != nil {
		t.Fatal(err)
	}
	before := len(*sent)
	runEmailWorkerOnce(time.Now().Add(2 * time.Hour))
	if st, _, why := jobStatus(t, "lead-follow-up", lead2.ID); st != "CANCELED" || !strings.Contains(why, "primeiro contato") {
		t.Errorf("follow-up com contato: %s (%s)", st, why)
	}
	if len(*sent) != before {
		t.Errorf("follow-up cancelado não pode sair")
	}

	// Falha temporária volta para a fila com espera; falha definitiva fica FAILED e o reenvio manual devolve à fila.
	call(handleEmailAutomationByID, "PUT", "/api/email/automations/lead-follow-up", "lead-follow-up", map[string]any{"active": false, "templateId": tpl.ID})
	resendSendJob = func(to, subject, html, key string) (string, error) {
		return "", &sendError{msg: "o Resend recusou (503)", retryable: true}
	}
	lead3, _ := (sqlConnectStore{}).IngestLead(inboundLead{Project: Project{PipelineID: "q4", StageID: "q4:novos", SourceName: "Site"}, Name: "Caio", Email: "caio@example.com"})
	t0 := time.Now()
	runEmailWorkerOnce(t0)
	if st, att, _ := jobStatus(t, "lead-boas-vindas", lead3.ID); st != "QUEUED" || att != 1 {
		t.Errorf("falha temporária: %s %d", st, att)
	}
	if got := runEmailWorkerOnce(t0.Add(30 * time.Second)); got != 0 {
		t.Errorf("nova tentativa antes da espera")
	}
	resendSendJob = func(to, subject, html, key string) (string, error) {
		return "", &sendError{msg: "o Resend recusou (422): domínio não verificado", retryable: false}
	}
	runEmailWorkerOnce(t0.Add(2 * time.Minute))
	st, _, why := jobStatus(t, "lead-boas-vindas", lead3.ID)
	if st != "FAILED" || !strings.Contains(why, "domínio") {
		t.Errorf("falha definitiva: %s (%s)", st, why)
	}
	var jobID string
	db.QueryRow(`SELECT id FROM EmailJob WHERE automationId = 'lead-boas-vindas' AND entityId = ?`, lead3.ID).Scan(&jobID)
	if res := call(handleEmailJobRetry, "POST", "/api/email/jobs/x/retry", jobID, nil); res.code != 200 {
		t.Errorf("reenviar: %d %s", res.code, res.body)
	}
	if res := call(handleEmailJobRetry, "POST", "/api/email/jobs/x/retry", jobID, nil); res.code != 409 {
		t.Errorf("reenviar o que já está na fila: %d", res.code)
	}

	// Oportunidade ganha → e-mail ao contato.
	if _, err := db.Exec(`INSERT INTO Opportunity (id, title, stage, priority, contactId, createdAt, updatedAt) VALUES ('op-mail', 'Projeto Acme', 'q4:neg', 'MEDIUM', 'cont1', NOW(), NOW())`); err != nil {
		t.Fatal(err)
	}
	if !movedToWon("q4:ganho", nil) || movedToWon("q4:neg", nil) {
		t.Errorf("movedToWon pelo tipo da etapa")
	}
	cliente := EmailTemplateDTO{}
	call(handleEmailTemplates, "POST", "/api/email/templates", "", map[string]any{"name": "Cliente", "subject": "Bem-vindo, {{primeiro_nome}}", "html": "<p>{{oportunidade}}</p>"}).into(t, &cliente)
	call(handleEmailAutomationByID, "PUT", "/api/email/automations/cliente-boas-vindas", "cliente-boas-vindas", map[string]any{"active": true, "templateId": cliente.ID})
	emitOpportunityWon("op-mail")
	emitOpportunityWon("op-mail") // de novo: continua um só
	db.QueryRow(`SELECT COUNT(*) FROM EmailJob WHERE automationId = 'cliente-boas-vindas' AND entityId = 'op-mail'`).Scan(&n)
	if n != 1 {
		t.Errorf("ganho: %d jobs", n)
	}
	sent = fakeResend(t, nil)
	runEmailWorkerOnce(time.Now().Add(3 * time.Hour))
	found := false
	for _, m := range *sent {
		if m.to == "joao@acme.com" && m.subject == "Bem-vindo, João" && strings.Contains(m.html, "Projeto Acme") {
			found = true
		}
	}
	if !found {
		t.Errorf("e-mail do ganho não saiu: %+v", *sent)
	}

	// Listas da tela.
	var listed struct {
		Flows []EmailAutomationDTO `json:"flows"`
	}
	call(handleEmailAutomations, "GET", "/api/email/automations", "", nil).into(t, &listed)
	if len(listed.Flows) != len(emailFlows) {
		t.Fatalf("fluxos: %d", len(listed.Flows))
	}
	for _, f := range listed.Flows {
		if f.ID == "lead-boas-vindas" && (!f.Active || f.Sent < 2) {
			t.Errorf("contagem do fluxo: %+v", f)
		}
	}
	var jobs []EmailJobDTO
	call(handleEmailJobs, "GET", "/api/email/jobs", "", nil).into(t, &jobs)
	if len(jobs) < 5 || jobs[0].Automation == "" {
		t.Errorf("histórico: %d", len(jobs))
	}
}
