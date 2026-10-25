package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

var db *sql.DB

// Opportunity representa o card principal no Kanban e Tabela
type Opportunity struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Value         *float64  `json:"value"`
	Stage         string    `json:"stage"` // correspondia ao column_id
	Priority      string    `json:"priority"`
	Tags          []string  `json:"tags"`
	
	// Dados Relacionais
	CompanyID     *string   `json:"companyId,omitempty"`
	CompanyName   *string   `json:"companyName,omitempty"`
	CompanyLogo   *string   `json:"companyLogo,omitempty"`
	
	ContactID     *string   `json:"contactId,omitempty"`
	ContactName   *string   `json:"contactName,omitempty"`
	ContactAvatar *string   `json:"contactAvatar,omitempty"`
	
	OwnerID       *string   `json:"ownerId,omitempty"`
	OwnerName     *string   `json:"ownerName,omitempty"`
	OwnerAvatar   *string   `json:"ownerAvatar,omitempty"`
	// Responsável na equipe (TeamMember), só com CRM_API=1; ownerId é o vínculo antigo com User.
	OwnerMemberID *string   `json:"ownerMemberId,omitempty"`
	
	WonAt         *time.Time `json:"wonAt"`
	CreatedAt     time.Time `json:"created_at"`
}

type Note struct {
	ID            string    `json:"id"`
	Content       string    `json:"content"`
	Type          string    `json:"type"`
	OpportunityID string    `json:"opportunityId"`
	AuthorName    *string   `json:"authorName,omitempty"`
	AuthorAvatar  *string   `json:"authorAvatar,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

func initDB() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: arquivo .env não encontrado.")
	}

	dsn := os.Getenv("DSN")
	if dsn == "" {
		log.Fatal("❌ ERRO: A variável DSN não está configurada no .env!")
	}

	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("❌ Erro ao instanciar conexão MySQL:", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatal("❌ Erro ao conectar com o banco de dados:", err)
	}

	fmt.Println("✅ Banco de Dados conectado (MySQL) via DSN!")

	ensureOpportunitySchema()
	if workflowEnabled() {
		ensureWorkflowSchema()
	}
	if crmEnabled() {
		ensureCRMSchema()
	}
	if authEnabled() {
		ensureAuthSchema()
	}
	if connectEnabled() {
		ensureConnectSchema()
	}
	ensureBlogSchema()
	initStorage()
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if authEnabled() {
			// com login: só as origens de ALLOWED_ORIGINS, com cookie (auth_middleware.go)
			setAuthCORS(w, r)
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next(w, r)
			return
		}

		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		// sem isto o navegador não deixa o admin ler o total das listas (paginação do CRM)
		w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func handleOpportunities(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		listOpportunities(w, r) // opportunity_links.go (JOIN com Company, Contact, User e a equipe)
	case http.MethodPost:
		createOpportunity(w, r) // Oportunidade avulsa
	case http.MethodPut:
		updateOpportunity(w, r) // título, valor, prioridade, tags e vínculos
	default:
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
	}
}

func validPriority(p string) bool { return p == "LOW" || p == "MEDIUM" || p == "HIGH" }

func handleMoveOpportunity(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		ID    string `json:"lead_id"` // mantido lead_id no payload pra compatibilidade rápida
		Stage string `json:"column_id"`
		Won   bool   `json:"won"` // o admin sabe que a etapa é do tipo Ganho; a API só vê o id
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if !canTouchOpportunity(w, r, payload.ID, true) { // opportunities:own (WP3b, D4)
		return
	}
	updateQuery := `UPDATE Opportunity SET stage = ?, wonAt = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(wonAt, ?) END WHERE id = ?`
	won := wonAtFor(payload.Stage, payload.Won, time.Now())
	args := []any{payload.Stage, won, won, payload.ID}
	if workflowEnabled() {
		// WP4-1: a etapa de destino precisa existir (422), o gate vale nas duas pontas (inclusive entre funis)
		// e a oportunidade passa a guardar o funil (Opportunity.pipelineId).
		var title, from string
		var curPipeline sql.NullString
		err := db.QueryRow(`SELECT title, stage, pipelineId FROM Opportunity WHERE id = ?`, payload.ID).Scan(&title, &from, &curPipeline)
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		curPid, err := oppPipeline(curPipeline, from)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		gateStage, destPid, err := destStage(payload.Stage, curPid)
		if err != nil {
			writeLinkErr(w, err)
			return
		}
		fromStage, err := effectiveStage(from, curPid)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		blockers, err := gateForMove(payload.ID, title, fromStage, gateStage)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if len(blockers) > 0 {
			writeGate409(w, blockers)
			return
		}
		if destPid != "" {
			updateQuery = `UPDATE Opportunity SET stage = ?, pipelineId = ?, wonAt = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(wonAt, ?) END WHERE id = ?`
			args = []any{payload.Stage, destPid, won, won, payload.ID}
		}
	}

	// wonAt: data do ganho (nula ao sair de Ganho); mantém a original se já estava ganha.
	res, err := db.Exec(updateQuery, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 0 linhas afetadas também é "nada mudou" (mover para a etapa em que já está: o MySQL sem clientFoundRows
	// não conta linha igual). Só é 404 se a oportunidade de fato não existe.
	if affected, _ := res.RowsAffected(); affected == 0 {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM Opportunity WHERE id = ?`, payload.ID).Scan(&n); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if n == 0 {
			http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"success"}`)
}

func handleNotes(w http.ResponseWriter, r *http.Request) {
	oppID := r.URL.Query().Get("opportunityId")
	var posted *Note // no POST o id também pode vir no corpo (é assim que a ficha do admin envia)
	if oppID == "" && r.Method == http.MethodPost {
		var n Note
		if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		posted, oppID = &n, n.OpportunityID
	}
	if oppID == "" {
		http.Error(w, "opportunityId is required", http.StatusBadRequest)
		return
	}
	if !canTouchOpportunity(w, r, oppID, r.Method != http.MethodGet) { // opportunities:own (WP3b, D4)
		return
	}

	switch r.Method {
	case http.MethodGet:
		query := `
			SELECT n.id, n.content, n.type, n.opportunityId, n.createdAt,
			       u.name, u.avatarUrl
			FROM Note n
			LEFT JOIN User u ON n.authorId = u.id
			WHERE n.opportunityId = ?
			ORDER BY n.createdAt DESC
		`
		rows, err := db.Query(query, oppID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var notes []Note
		for rows.Next() {
			var n Note
			var createdAt string
			if err := rows.Scan(&n.ID, &n.Content, &n.Type, &n.OpportunityID, &createdAt, &n.AuthorName, &n.AuthorAvatar); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			n.CreatedAt = parseDT(createdAt)
			notes = append(notes, n)
		}
		if notes == nil {
			notes = []Note{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(notes)

	case http.MethodPost:
		var n Note
		if posted != nil {
			n = *posted
		} else if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		n.OpportunityID = oppID
		n.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		n.CreatedAt = time.Now()
		if n.Type == "" {
			n.Type = "NOTE"
		}

		// Insert Note
		insertQuery := `INSERT INTO Note (id, content, type, opportunityId, createdAt) VALUES (?, ?, ?, ?, ?)`
		_, err := db.Exec(insertQuery, n.ID, n.Content, n.Type, n.OpportunityID, n.CreatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(n)
	default:
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
	}
}

func handleSendEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		OpportunityID string `json:"opportunityId"`
		Subject       string `json:"subject"`
		Body          string `json:"body"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if !canTouchOpportunity(w, r, req.OpportunityID, true) { // opportunities:own (WP3b, D4)
		return
	}
	resendKey := os.Getenv("RESEND_API_KEY")
	if resendKey == "" {
		http.Error(w, "API Key do Resend não configurada na VPS", http.StatusInternalServerError)
		return
	}

	// Buscar o email do contato vinculado a essa oportunidade
	var toEmail sql.NullString
	query := `
		SELECT c.email 
		FROM Opportunity o
		JOIN Contact c ON o.contactId = c.id
		WHERE o.id = ?
	`
	err := db.QueryRow(query, req.OpportunityID).Scan(&toEmail)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Oportunidade não encontrada ou não possui contato vinculado", http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	if !toEmail.Valid || toEmail.String == "" {
		http.Error(w, "O contato desta oportunidade não possui um email cadastrado", http.StatusBadRequest)
		return
	}

	// Enviar via Resend
	resendPayload := map[string]interface{}{
		"from":    "Kalidash CRM <onboarding@resend.dev>",
		"to":      []string{toEmail.String},
		"subject": req.Subject,
		"html":    req.Body,
	}
	
	payloadBytes, _ := json.Marshal(resendPayload)
	httpReq, _ := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(payloadBytes))
	httpReq.Header.Set("Authorization", "Bearer "+resendKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		http.Error(w, "Erro ao conectar com Resend: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		http.Error(w, "Erro na API do Resend", resp.StatusCode)
		return
	}

	// Sucesso! Grava a nota do tipo EMAIL na timeline
	noteID := fmt.Sprintf("%d", time.Now().UnixNano())
	content := fmt.Sprintf("Assunto: %s\n\n%s", req.Subject, req.Body)
	insertQuery := `INSERT INTO Note (id, content, type, opportunityId, createdAt) VALUES (?, ?, ?, ?, ?)`
	_, err = db.Exec(insertQuery, noteID, content, "EMAIL", req.OpportunityID, time.Now())
	
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"success", "message": "Email enviado e logado com sucesso!"}`)
}

func main() {
	initDB()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/leads", enableCORS(handleOpportunities)) // mantendo a rota por compatibilidade
	mux.HandleFunc("/api/leads/move", enableCORS(handleMoveOpportunity))
	mux.HandleFunc("/api/leads/notes", enableCORS(handleNotes))
	mux.HandleFunc("/api/emails/send", enableCORS(handleSendEmail))
	mux.HandleFunc("/api/emails/test", enableCORS(handleTestEmail)) // só para o e-mail de quem está logado (emails.go)
	mux.HandleFunc("/api/blog/articles", enableCORS(handleBlogArticles))
	mux.HandleFunc("/api/blog/article", enableCORS(handleBlogArticleBySlug))
	mux.HandleFunc("/api/blog/slug-available", enableCORS(handleBlogSlugAvailable))
	mux.HandleFunc("/api/blog/upload", enableCORS(handleBlogUpload))
	mux.HandleFunc("/api/blog/settings", enableCORS(handleBlogSettings))
	mux.HandleFunc("/api/public/leads", handlePublicLead) // pública: CORS e limites próprios (public_leads.go)

	if workflowEnabled() {
		registerWorkflowRoutes(mux)
	}
	if crmEnabled() {
		registerCRMRoutes(mux)
	}

	if authEnabled() {
		registerAuthRoutes(mux)
	}
	if connectEnabled() {
		registerConnectRoutes(mux)
	}
	var handler http.Handler = mux
	if authEnabled() {
		handler = withAuth(mux) // protege /api/* e restringe o CORS (auth_middleware.go)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if port[0] == ':' {
		port = port[1:]
	}
	fmt.Printf("🚀 API do Kalidash (Go + MySQL) rodando em http://localhost:%s\n", port)
	
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Erro ao iniciar API: %v", err)
	}
}
