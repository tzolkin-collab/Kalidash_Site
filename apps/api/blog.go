package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Article é o modelo real do blog (Go + MySQL) — substitui o Sanity, que não fica mais no ar.
// Sem "status"/agendamento: isso não existia no schema anterior e não tem uso real ainda; fica
// só "published" (rascunho/publicado). "categories" é JSON solto (como Opportunity.tags já faz),
// sem tabela própria — nada demais, como pedido.
type Article struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Slug           string     `json:"slug"`
	Excerpt        string     `json:"excerpt"`
	Body           string     `json:"body"` // HTML gerado pelo BlockNote (blocksToHTMLLossy), é o que o site renderiza
	// BodyJSON: o documento nativo do BlockNote (editor.document), fonte de verdade pra reedição.
	// O editor nunca reimporta o `body` (HTML) de volta pra blocos — evita degradação de ida-e-volta
	// do export "lossy". Nulo pros 4 artigos migrados do mock antigo (nunca passaram pelo BlockNote);
	// o editor detecta isso e abre o body como HTML puro na primeira edição.
	BodyJSON       *string    `json:"bodyJson,omitempty"`
	CoverImageURL  *string    `json:"coverImageUrl,omitempty"`
	CoverImagePos  int        `json:"coverImagePos"` // 0–100, object-position vertical da capa
	Featured       bool       `json:"featured"`
	Published      bool       `json:"published"`
	AuthorName     string     `json:"authorName"`
	Categories     []string   `json:"categories"`
	SeoTitle       *string    `json:"seoTitle,omitempty"`
	SeoDescription *string    `json:"seoDescription,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	PublishedAt    *time.Time `json:"publishedAt,omitempty"`
}

type BlogSettings struct {
	PreTitle    string `json:"preTitle"`
	TitlePrefix string `json:"titlePrefix"`
	TitleSpan   string `json:"titleSpan"`
	Description string `json:"description"`
}

func ensureBlogSchema() {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS Article (
			id VARCHAR(64) PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			slug VARCHAR(255) NOT NULL UNIQUE,
			excerpt TEXT,
			body LONGTEXT,
			coverImageUrl VARCHAR(500) NULL,
			coverImagePos INT NOT NULL DEFAULT 50,
			featured TINYINT(1) NOT NULL DEFAULT 0,
			published TINYINT(1) NOT NULL DEFAULT 0,
			authorName VARCHAR(255) NOT NULL DEFAULT '',
			categories JSON NULL,
			seoTitle VARCHAR(255) NULL,
			seoDescription VARCHAR(500) NULL,
			createdAt DATETIME NOT NULL,
			updatedAt DATETIME NOT NULL,
			publishedAt DATETIME NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`)
	if err != nil {
		log.Fatal("❌ Erro ao criar tabela Article:", err)
	}

	// bodyJson: documento nativo do BlockNote (fonte de verdade do editor). Tabela já existia
	// antes do BlockNote (Sanity/TipTap-era), então entra por ALTER — "Duplicate column" é o
	// caminho normal em toda subida depois da primeira.
	_, err = db.Exec(`ALTER TABLE Article ADD COLUMN bodyJson LONGTEXT NULL AFTER body`)
	if err != nil && !strings.Contains(err.Error(), "Duplicate column") {
		log.Fatal("❌ Erro ao adicionar coluna bodyJson:", err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS BlogSettings (
			id VARCHAR(10) PRIMARY KEY,
			preTitle VARCHAR(255),
			titlePrefix VARCHAR(255),
			titleSpan VARCHAR(255),
			description TEXT
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`)
	if err != nil {
		log.Fatal("❌ Erro ao criar tabela BlogSettings:", err)
	}

	// Insert default settings if empty
	db.Exec(`INSERT IGNORE INTO BlogSettings (id, preTitle, titlePrefix, titleSpan, description) VALUES ('global', '[ inteligência aplicada ao trabalho ]', 'Ideias para a próxima', 'operação.', 'Conteúdo sobre cultura, processos, tecnologia e organizações que trabalham com agentes.')`)
}

var slugInvalidChars = regexp.MustCompile(`[^a-z0-9]+`)
var slugTrim = regexp.MustCompile(`^-+|-+$`)

// slugify: sem acentos e sem lib externa — troca as vogais acentuadas mais comuns em pt-BR e
// derruba o resto que não é [a-z0-9] pra hífen. É o mesmo espírito do source:'title' do Sanity.
func slugify(s string) string {
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "ã", "a", "â", "a", "ä", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i",
		"ó", "o", "ò", "o", "õ", "o", "ô", "o", "ö", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u",
		"ç", "c", "ñ", "n",
	)
	lower := strings.ToLower(replacer.Replace(s))
	dashed := slugInvalidChars.ReplaceAllString(lower, "-")
	return slugTrim.ReplaceAllString(dashed, "")
}

func scanArticle(rows *sql.Rows) (Article, error) {
	var a Article
	var categoriesJSON []byte
	var coverPos sql.NullInt64
	var publishedAt sql.NullTime
	var bodyJSON sql.NullString
	err := rows.Scan(
		&a.ID, &a.Title, &a.Slug, &a.Excerpt, &a.Body, &bodyJSON, &a.CoverImageURL, &coverPos,
		&a.Featured, &a.Published, &a.AuthorName, &categoriesJSON,
		&a.SeoTitle, &a.SeoDescription, &a.CreatedAt, &a.UpdatedAt, &publishedAt,
	)
	if err != nil {
		return a, err
	}
	if bodyJSON.Valid {
		a.BodyJSON = &bodyJSON.String
	}
	if coverPos.Valid {
		a.CoverImagePos = int(coverPos.Int64)
	} else {
		a.CoverImagePos = 50
	}
	if publishedAt.Valid {
		a.PublishedAt = &publishedAt.Time
	}
	if categoriesJSON != nil {
		json.Unmarshal(categoriesJSON, &a.Categories)
	}
	if a.Categories == nil {
		a.Categories = []string{}
	}
	return a, nil
}

const articleColumns = `id, title, slug, excerpt, body, bodyJson, coverImageUrl, coverImagePos, featured, published, authorName, categories, seoTitle, seoDescription, createdAt, updatedAt, publishedAt`

// handleBlogArticles: GET lista (?published=true filtra pro que o site pode mostrar),
// POST cria, PUT atualiza (id no corpo), DELETE remove (?id=).
func handleBlogArticles(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		query := `SELECT ` + articleColumns + ` FROM Article`
		args := []any{}
		if r.URL.Query().Get("published") == "true" {
			query += ` WHERE published = 1`
		}
		query += ` ORDER BY featured DESC, COALESCE(publishedAt, createdAt) DESC`

		rows, err := db.Query(query, args...)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		articles := []Article{}
		for rows.Next() {
			a, err := scanArticle(rows)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			articles = append(articles, a)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(articles)

	case http.MethodPost:
		var a Article
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(a.Title) == "" {
			http.Error(w, "Título é obrigatório", http.StatusBadRequest)
			return
		}
		a.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		if strings.TrimSpace(a.Slug) == "" {
			a.Slug = slugify(a.Title)
		} else {
			a.Slug = slugify(a.Slug)
		}
		now := time.Now()
		a.CreatedAt = now
		a.UpdatedAt = now
		if a.Published && a.PublishedAt == nil {
			a.PublishedAt = &now
		}
		if a.CoverImagePos == 0 {
			a.CoverImagePos = 50
		}
		if a.Categories == nil {
			a.Categories = []string{}
		}
		categoriesJSON, _ := json.Marshal(a.Categories)

		_, err := db.Exec(
			`INSERT INTO Article (`+articleColumns+`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			a.ID, a.Title, a.Slug, a.Excerpt, a.Body, a.BodyJSON, a.CoverImageURL, a.CoverImagePos,
			a.Featured, a.Published, a.AuthorName, categoriesJSON, a.SeoTitle, a.SeoDescription,
			a.CreatedAt, a.UpdatedAt, a.PublishedAt,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				http.Error(w, "Já existe um artigo com este endereço (slug).", http.StatusConflict)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(a)

	case http.MethodPut:
		var a Article
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if a.ID == "" {
			http.Error(w, "id é obrigatório", http.StatusBadRequest)
			return
		}
		a.Slug = slugify(a.Slug)
		a.UpdatedAt = time.Now()
		if a.Categories == nil {
			a.Categories = []string{}
		}
		categoriesJSON, _ := json.Marshal(a.Categories)

		// Publicou agora pela primeira vez: registra publishedAt. Já publicado antes, mantém a
		// data original (senão cada edição de um artigo já publicado "resetaria" a data).
		var alreadyPublishedAt sql.NullTime
		db.QueryRow(`SELECT publishedAt FROM Article WHERE id = ?`, a.ID).Scan(&alreadyPublishedAt)
		if a.Published && !alreadyPublishedAt.Valid {
			now := time.Now()
			a.PublishedAt = &now
		} else if alreadyPublishedAt.Valid {
			a.PublishedAt = &alreadyPublishedAt.Time
		}

		res, err := db.Exec(
			`UPDATE Article SET title=?, slug=?, excerpt=?, body=?, bodyJson=?, coverImageUrl=?, coverImagePos=?, featured=?, published=?, authorName=?, categories=?, seoTitle=?, seoDescription=?, updatedAt=?, publishedAt=? WHERE id=?`,
			a.Title, a.Slug, a.Excerpt, a.Body, a.BodyJSON, a.CoverImageURL, a.CoverImagePos, a.Featured, a.Published,
			a.AuthorName, categoriesJSON, a.SeoTitle, a.SeoDescription, a.UpdatedAt, a.PublishedAt, a.ID,
		)
		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				http.Error(w, "Já existe um artigo com este endereço (slug).", http.StatusConflict)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, "Artigo não encontrado", http.StatusNotFound)
			return
		}
		// Reconsulta em vez de devolver `a` direto: o corpo do PUT não manda createdAt, então
		// devolver `a` sem mais nada voltava com data de criação zerada (0001-01-01).
		rows, err := db.Query(`SELECT `+articleColumns+` FROM Article WHERE id = ?`, a.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		if !rows.Next() {
			http.Error(w, "Artigo não encontrado", http.StatusNotFound)
			return
		}
		updated, err := scanArticle(rows)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id é obrigatório", http.StatusBadRequest)
			return
		}
		res, err := db.Exec(`DELETE FROM Article WHERE id = ?`, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, "Artigo não encontrado", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"success"}`)

	default:
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
	}
}

// handleBlogArticleBySlug: GET público por slug (?slug=), só devolve se estiver publicado —
// é o que alimenta /blog/[slug] no site. Rascunho por slug direto continua invisível de fora.
func handleBlogArticleBySlug(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	slug := r.URL.Query().Get("slug")
	if slug == "" {
		http.Error(w, "slug é obrigatório", http.StatusBadRequest)
		return
	}
	rows, err := db.Query(`SELECT `+articleColumns+` FROM Article WHERE slug = ? AND published = 1 LIMIT 1`, slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	if !rows.Next() {
		http.Error(w, "Artigo não encontrado", http.StatusNotFound)
		return
	}
	a, err := scanArticle(rows)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(a)
}

func handleBlogSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		var s BlogSettings
		err := db.QueryRow(`SELECT preTitle, titlePrefix, titleSpan, description FROM BlogSettings WHERE id = 'global'`).Scan(
			&s.PreTitle, &s.TitlePrefix, &s.TitleSpan, &s.Description,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)

	case http.MethodPut:
		var s BlogSettings
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_, err := db.Exec(
			`UPDATE BlogSettings SET preTitle = ?, titlePrefix = ?, titleSpan = ?, description = ? WHERE id = 'global'`,
			s.PreTitle, s.TitlePrefix, s.TitleSpan, s.Description,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)

	default:
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
	}
}
