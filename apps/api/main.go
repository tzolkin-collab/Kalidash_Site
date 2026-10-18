package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
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
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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
		// JOIN com Company, Contact e User (Owner)
		query := `
			SELECT 
				o.id, o.title, o.value, o.stage, o.priority, o.tags, o.createdAt, o.wonAt,
				o.companyId, c.name as companyName, c.logoUrl as companyLogo,
				o.contactId, p.name as contactName, p.avatarUrl as contactAvatar,
				o.ownerId, u.name as ownerName, u.avatarUrl as ownerAvatar
			FROM Opportunity o
			LEFT JOIN Company c ON o.companyId = c.id
			LEFT JOIN Contact p ON o.contactId = p.id
			LEFT JOIN User u ON o.ownerId = u.id
			ORDER BY o.createdAt DESC
		`
		
		rows, err := db.Query(query)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var opps []Opportunity
		for rows.Next() {
			var o Opportunity
			var tagsJSON []byte
			var createdAt string
			var wonAt sql.NullString

			if err := rows.Scan(
				&o.ID, &o.Title, &o.Value, &o.Stage, &o.Priority, &tagsJSON, &createdAt, &wonAt,
				&o.CompanyID, &o.CompanyName, &o.CompanyLogo,
				&o.ContactID, &o.ContactName, &o.ContactAvatar,
				&o.OwnerID, &o.OwnerName, &o.OwnerAvatar,
			); err != nil {
				log.Println("Scan err:", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			
			if tagsJSON != nil {
				json.Unmarshal(tagsJSON, &o.Tags)
			}
			o.CreatedAt = parseDT(createdAt)
			if wonAt.Valid {
				if t := parseDT(wonAt.String); !t.IsZero() {
					o.WonAt = &t
				}
			}
			
			opps = append(opps, o)
		}
		
		if opps == nil {
			opps = []Opportunity{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(opps)

	case http.MethodPost:
		// Cria Oportunidade Avulsa (sem contatos ainda para simplicidade de demonstração)
		var newOpp Opportunity
		if err := json.NewDecoder(r.Body).Decode(&newOpp); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		v, ok := normalizeMoney(newOpp.Value)
		if !ok {
			http.Error(w, "Valor inválido", http.StatusBadRequest)
			return
		}
		newOpp.Value = v
		newOpp.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		newOpp.CreatedAt = time.Now()

		tagsJSON, _ := json.Marshal(newOpp.Tags)
		if newOpp.Priority == "" {
			newOpp.Priority = "MEDIUM"
		}

		insertQuery := `INSERT INTO Opportunity (id, title, value, stage, priority, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		_, err := db.Exec(insertQuery, newOpp.ID, newOpp.Title, newOpp.Value, newOpp.Stage, newOpp.Priority, tagsJSON, newOpp.CreatedAt, newOpp.CreatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(newOpp)

	case http.MethodPut:
		var opp Opportunity
		if err := json.NewDecoder(r.Body).Decode(&opp); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		
		v, ok := normalizeMoney(opp.Value)
		if !ok {
			http.Error(w, "Valor inválido", http.StatusBadRequest)
			return
		}
		opp.Value = v
		if strings.TrimSpace(opp.Title) == "" {
			http.Error(w, "Título obrigatório", http.StatusBadRequest)
			return
		}
		// Persistem título, valor e, quando enviados, prioridade e tags (colunas que existem hoje).
		// Etapa muda só por /api/leads/move; contato, empresa e responsável são vínculos (ids) que
		// esta rota não grava. Campo ausente no corpo mantém o que está no banco.
		var prio any // NULL mantém a coluna (COALESCE)
		if opp.Priority != "" {
			if validPriority(opp.Priority) { // valor fora do conjunto não bloqueia a edição de título/valor: mantém o do banco
				prio = opp.Priority
			}
		}
		var tagsArg any
		if opp.Tags != nil {
			tj, _ := json.Marshal(opp.Tags)
			tagsArg = tj
		}
		updateQuery := `UPDATE Opportunity SET title = ?, value = ?, priority = COALESCE(?, priority), tags = COALESCE(?, tags), updatedAt = ? WHERE id = ?`
		res, err := db.Exec(updateQuery, opp.Title, opp.Value, prio, tagsArg, time.Now(), opp.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(opp)

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

	if workflowEnabled() {
		blockers, err := gateForMove(payload.ID, payload.Stage)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if len(blockers) > 0 {
			writeJSON(w, http.StatusConflict, map[string]any{"error": "gate", "blockers": blockers})
			return
		}
	}

	// wonAt: data do ganho (nula ao sair de Ganho); mantém a original se já estava ganha.
	updateQuery := `UPDATE Opportunity SET stage = ?, wonAt = CASE WHEN ? IS NULL THEN NULL ELSE COALESCE(wonAt, ?) END WHERE id = ?`
	won := wonAtFor(payload.Stage, payload.Won, time.Now())
	res, err := db.Exec(updateQuery, payload.Stage, won, won, payload.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"success"}`)
}

func handleNotes(w http.ResponseWriter, r *http.Request) {
	oppID := r.URL.Query().Get("opportunityId")
	if oppID == "" {
		http.Error(w, "opportunityId is required", http.StatusBadRequest)
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
		if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
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
