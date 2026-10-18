package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"time"
)

// POST /api/emails/test: envio de TESTE de um modelo de e-mail. O destinatário nunca vem do cliente:
// é o e-mail de quem está logado (sessão do AUTH_API). Sem sessão, 401. É o envio provisório via
// Resend, até a API própria de e-mail (Gmail).

const (
	testEmailMaxBody   = 600 << 10 // HTML de um modelo compilado; o resto é recusado
	testEmailMaxSubj   = 200
	testEmailRatePerHr = 10
)

// resendSend é trocável nos testes: nenhum teste chama o Resend de verdade.
var resendSend = func(to, subject, html string) error {
	key := os.Getenv("RESEND_API_KEY")
	if key == "" {
		return errors.New("RESEND_API_KEY não configurada")
	}
	payload, _ := json.Marshal(map[string]any{
		"from": "Kalidash CRM <onboarding@resend.dev>", "to": []string{to}, "subject": subject, "html": html,
	})
	req, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return errors.New("não consegui falar com o Resend")
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("o Resend recusou o envio (%d)", resp.StatusCode)
	}
	return nil
}

func handleTestEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Método não permitido"})
		return
	}
	// Só para quem está logado: o destinatário é o e-mail dessa pessoa.
	m, ok := principalOf(r)
	if !ok || m.Email == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "faça login para enviar um teste"})
		return
	}
	if _, err := mail.ParseAddress(m.Email); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "o e-mail da sua conta é inválido"})
		return
	}
	if !allowRateLimit("emailtest:"+strings.ToLower(m.Email), testEmailRatePerHr, time.Now()) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "muitos testes seguidos; tente de novo em alguns minutos"})
		return
	}
	var req struct {
		Subject string `json:"subject"`
		Body    string `json:"body"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, testEmailMaxBody+4096)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { // "to" e qualquer outro campo são ignorados de propósito
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido ou grande demais"})
		return
	}
	subject := strings.TrimSpace(req.Subject)
	if subject == "" || len([]rune(subject)) > testEmailMaxSubj || strings.ContainsAny(subject, "\r\n") {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "assunto inválido"})
		return
	}
	if strings.TrimSpace(req.Body) == "" || len(req.Body) > testEmailMaxBody {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "conteúdo vazio ou grande demais"})
		return
	}
	if err := resendSend(m.Email, subject, req.Body); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent", "to": m.Email})
}
