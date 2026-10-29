package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"sort"
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

// BlogCategory: cadastro gerenciado no admin (nome, slug, descrição, ordem e visibilidade),
// alimenta a barra de filtros de /blog e as páginas SEO /blog/categoria/[slug].
type BlogCategory struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug"`
	Description    string    `json:"description"`
	SortOrder      int       `json:"sortOrder"`
	Hidden         bool      `json:"hidden"`
	SeoTitle       *string   `json:"seoTitle,omitempty"`
	SeoDescription *string   `json:"seoDescription,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
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

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS BlogCategory (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(120) NOT NULL,
			slug VARCHAR(120) NOT NULL UNIQUE,
			description TEXT,
			sortOrder INT NOT NULL DEFAULT 0,
			hidden TINYINT(1) NOT NULL DEFAULT 0,
			seoTitle VARCHAR(255) NULL,
			seoDescription VARCHAR(500) NULL,
			createdAt DATETIME NOT NULL,
			updatedAt DATETIME NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
	`)
	if err != nil {
		log.Fatal("❌ Erro ao criar tabela BlogCategory:", err)
	}

	seedDefaultBlogCategories()
}

var slugInvalidChars = regexp.MustCompile(`[^a-z0-9]+`)
var slugTrim = regexp.MustCompile(`^-+|-+$`)

// defaultReservedSlugs: slugs protegidos que não podem ser usados por artigos normais
var defaultReservedSlugs = map[string]bool{
	"blog-global": true,
	"novo":        true,
	"editar":      true,
	"preview":     true,
	"settings":    true,
	"feed":        true,
	"rss":         true,
	"categoria":   true,
	"tag":         true,
	"api":         true,
}

// isReservedSlug: lista padrão + BLOG_RESERVED_SLUGS (separada por vírgula, acrescenta; não remove).
func isReservedSlug(slug string) bool {
	s := strings.ToLower(strings.TrimSpace(slug))
	if defaultReservedSlugs[s] {
		return true
	}
	for _, extra := range strings.Split(os.Getenv("BLOG_RESERVED_SLUGS"), ",") {
		if e := strings.ToLower(strings.TrimSpace(extra)); e != "" && e == s {
			return true
		}
	}
	return false
}

// slugify: sem dependência externa. Converte minúsculas primeiro para capturar maiúsculas acentuadas
// (ex.: "Éxito na Operação" -> "exito-na-operacao", "Öffnung" -> "offnung"), troca vogais e consoantes
// acentuadas e substitui caracteres não-alfanuméricos por hífen. Se o título contiver apenas símbolos
// ou alfabetos sem mapeamento direto, gera deterministricamente "artigo-<hash-curto>".
func slugify(s string) string {
	lower := strings.ToLower(s)
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "ã", "a", "â", "a", "ä", "a", "å", "a", "ā", "a", "ă", "a", "ą", "a",
		"é", "e", "è", "e", "ê", "e", "ë", "e", "ē", "e", "ĕ", "e", "ė", "e", "ę", "e", "ě", "e",
		"í", "i", "ì", "i", "î", "i", "ï", "i", "ĩ", "i", "ī", "i", "ĭ", "i", "į", "i",
		"ó", "o", "ò", "o", "õ", "o", "ô", "o", "ö", "o", "ø", "o", "ō", "o", "ŏ", "o", "ő", "o",
		"ú", "u", "ù", "u", "û", "u", "ü", "u", "ũ", "u", "ū", "u", "ŭ", "u", "ů", "u", "ű", "u", "ų", "u",
		"ç", "c", "ć", "c", "č", "c",
		"ñ", "n", "ń", "n", "ň", "n",
		"ß", "ss", "æ", "ae", "œ", "oe", "ł", "l", "đ", "d", "ð", "d", "þ", "th", "ı", "i",
	)
	normalized := replacer.Replace(lower)
	dashed := slugInvalidChars.ReplaceAllString(normalized, "-")
	res := slugTrim.ReplaceAllString(dashed, "")
	if res == "" {
		h := sha256.Sum256([]byte(s))
		return fmt.Sprintf("artigo-%x", h[:4])
	}
	return res
}

// isDuplicateKey: erro 1062 do MySQL/MariaDB (o texto varia: "Duplicate entry" no real,
// "duplicate unique key given" no go-mysql-server dos testes).
func isDuplicateKey(err error) bool {
	m := err.Error()
	return strings.Contains(m, "Error 1062") || strings.Contains(m, "Duplicate entry")
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

type galleryBlock struct {
	Type  string `json:"type"`
	Props struct {
		ArticleID string `json:"articleId"`
	} `json:"props"`
}

// articleDate: a data que ordena o blog (publicação, ou criação se nunca publicou).
func articleDate(a Article) time.Time {
	if a.PublishedAt != nil {
		return *a.PublishedAt
	}
	return a.CreatedAt
}

// orderGallery aplica a regra Q14 (docs/po/blog-cms.md), função pura:
//  1. os artigos curados (ids dos cartões da Galeria, na ordem dela) vêm primeiro;
//  2. todo artigo publicado fora dessa ordem entra depois, do mais novo para o mais antigo;
//  3. nada é descartado: id curado que não existe/não está publicado é ignorado, e nenhum
//     artigo publicado fica de fora.
//
// A própria Galeria (slug blog-global) não é artigo da grade: vai por último, para o site achá-la
// por slug sem ela ocupar posição.
func orderGallery(published []Article, curatedIDs []string) []Article {
	byID := make(map[string]Article, len(published))
	for _, a := range published {
		byID[a.ID] = a
	}
	result := make([]Article, 0, len(published))
	placed := make(map[string]bool, len(published))
	for _, id := range curatedIDs {
		if a, ok := byID[id]; ok && !placed[id] && a.Slug != "blog-global" {
			placed[id] = true
			result = append(result, a)
		}
	}
	var rest []Article
	var gallery []Article
	for _, a := range published {
		if placed[a.ID] {
			continue
		}
		if a.Slug == "blog-global" {
			gallery = append(gallery, a)
			continue
		}
		rest = append(rest, a)
	}
	sort.SliceStable(rest, func(i, j int) bool { return articleDate(rest[i]).After(articleDate(rest[j])) })
	result = append(result, rest...)
	return append(result, gallery...)
}

// galleryCuratedIDs lê os ids dos cartões (articleCard) salvos no bodyJson da Galeria, na ordem.
func galleryCuratedIDs(bodyJSON string) []string {
	var blocks []galleryBlock
	if err := json.Unmarshal([]byte(bodyJSON), &blocks); err != nil {
		return nil
	}
	var ids []string
	seen := map[string]bool{}
	for _, b := range blocks {
		if b.Type == "articleCard" && b.Props.ArticleID != "" && !seen[b.Props.ArticleID] {
			seen[b.Props.ArticleID] = true
			ids = append(ids, b.Props.ArticleID)
		}
	}
	return ids
}

// applyGalleryHybridOrder: lista pública (?published=true). Sem cartões salvos na Galeria
// (nunca curada) mantém a ordem da consulta (destaque, depois data), como sempre foi.
func applyGalleryHybridOrder(published []Article) []Article {
	if len(published) == 0 {
		return published
	}
	var bodyJSON sql.NullString
	if err := db.QueryRow(`SELECT bodyJson FROM Article WHERE slug = 'blog-global' LIMIT 1`).Scan(&bodyJSON); err != nil || !bodyJSON.Valid {
		return published
	}
	curated := galleryCuratedIDs(bodyJSON.String)
	if len(curated) == 0 {
		return published
	}
	return orderGallery(published, curated)
}

const articleColumns = `id, title, slug, excerpt, body, bodyJson, coverImageUrl, coverImagePos, featured, published, authorName, categories, seoTitle, seoDescription, createdAt, updatedAt, publishedAt`

// handleBlogArticles: GET lista (?published=true filtra pro que o site pode mostrar e aplica ordem hibrida Q14),
// POST cria, PUT atualiza (id no corpo), DELETE remove (?id=).
func handleBlogArticles(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		query := `SELECT ` + articleColumns + ` FROM Article`
		args := []any{}
		isPublishedOnly := r.URL.Query().Get("published") == "true"
		if isPublishedOnly {
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

		if isPublishedOnly {
			articles = applyGalleryHybridOrder(articles)
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
		if isReservedSlug(a.Slug) {
			http.Error(w, "Este endereço (slug) é reservado pelo sistema.", http.StatusConflict)
			return
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
			if isDuplicateKey(err) {
				http.Error(w, "Já existe um artigo com este endereço (slug).", http.StatusConflict)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notifySite(articlePaths(a.Slug))
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

		var alreadyPublishedAt sql.NullTime
		var previousSlug string
		err := db.QueryRow(`SELECT publishedAt, slug FROM Article WHERE id = ?`, a.ID).Scan(&alreadyPublishedAt, &previousSlug)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Artigo não encontrado", http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Se o slug estiver vazio, gera a partir do título (como prometido na interface).
		// Se nem título nem slug vierem, preserva o slug existente.
		if strings.TrimSpace(a.Slug) == "" {
			if strings.TrimSpace(a.Title) != "" {
				a.Slug = slugify(a.Title)
			} else {
				a.Slug = previousSlug
			}
		} else {
			a.Slug = slugify(a.Slug)
		}

		// Valida slugs reservados (exceto se for a própria Galeria Principal "blog-global" sendo salva)
		if isReservedSlug(a.Slug) && previousSlug != a.Slug {
			http.Error(w, "Este endereço (slug) é reservado pelo sistema.", http.StatusConflict)
			return
		}

		a.UpdatedAt = time.Now()
		if a.Categories == nil {
			a.Categories = []string{}
		}
		categoriesJSON, _ := json.Marshal(a.Categories)

		// Publicou agora pela primeira vez: registra publishedAt. Já publicado antes, mantém a data original.
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
			if isDuplicateKey(err) {
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
		notifySite(articlePaths(previousSlug, updated.Slug))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id é obrigatório", http.StatusBadRequest)
			return
		}
		var deletedSlug string
		db.QueryRow(`SELECT slug FROM Article WHERE id = ?`, id).Scan(&deletedSlug)
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
		notifySite(articlePaths(deletedSlug))
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

// handleBlogSlugAvailable: GET /api/blog/slug-available?slug=&exceptId=
// Verifica se um slug é válido, não reservado e não colide com outros artigos.
func handleBlogSlugAvailable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	rawSlug := r.URL.Query().Get("slug")
	clean := slugify(rawSlug)
	w.Header().Set("Content-Type", "application/json")

	if strings.TrimSpace(rawSlug) == "" || clean == "" {
		json.NewEncoder(w).Encode(map[string]any{"available": false, "slug": "", "reason": "empty"})
		return
	}
	if isReservedSlug(clean) {
		json.NewEncoder(w).Encode(map[string]any{"available": false, "slug": clean, "reason": "reserved"})
		return
	}

	query := `SELECT COUNT(*) FROM Article WHERE slug = ?`
	args := []any{clean}
	exceptID := strings.TrimSpace(r.URL.Query().Get("exceptId"))
	if exceptID != "" {
		query += ` AND id != ?`
		args = append(args, exceptID)
	}

	var count int
	if err := db.QueryRow(query, args...).Scan(&count); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if count > 0 {
		json.NewEncoder(w).Encode(map[string]any{"available": false, "slug": clean, "reason": "taken"})
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"available": true, "slug": clean})
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

const categoryColumns = `id, name, slug, description, sortOrder, hidden, seoTitle, seoDescription, createdAt, updatedAt`

func seedDefaultBlogCategories() {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM BlogCategory`).Scan(&count); err != nil || count > 0 {
		return
	}
	now := time.Now()
	defaults := []struct {
		id, name, slug, desc string
		order                int
	}{
		{"cat-cases", "Cases", "cases", "Estudos de caso e resultados reais de implementação de IA e agentes em operações complexas.", 0},
		{"cat-posts", "Posts", "posts", "Artigos, análises práticas e guias sobre cultura, governança e execução com agentes de IA.", 1},
	}
	for _, d := range defaults {
		_, _ = db.Exec(
			`INSERT IGNORE INTO BlogCategory (id, name, slug, description, sortOrder, hidden, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
			d.id, d.name, d.slug, d.desc, d.order, now, now,
		)
	}
}

func scanCategory(rows *sql.Rows) (BlogCategory, error) {
	var c BlogCategory
	var desc sql.NullString
	err := rows.Scan(
		&c.ID, &c.Name, &c.Slug, &desc, &c.SortOrder, &c.Hidden,
		&c.SeoTitle, &c.SeoDescription, &c.CreatedAt, &c.UpdatedAt,
	)
	if desc.Valid {
		c.Description = desc.String
	}
	return c, err
}

func categoryPaths(slugs ...string) []string {
	paths := []string{"/blog"}
	seen := map[string]bool{}
	for _, s := range slugs {
		s = strings.TrimSpace(s)
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		paths = append(paths, "/blog/categoria/"+s)
	}
	return paths
}

// handleBlogCategories: GET lista ordenada por sortOrder ASC, name ASC (?visible=true oculta hidden=1),
// POST cria, PUT atualiza (ou reordena em lote quando recebe {"order":["id1","id2"]}), DELETE remove (?id=).
func handleBlogCategories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		query := `SELECT ` + categoryColumns + ` FROM BlogCategory`
		if r.URL.Query().Get("visible") == "true" {
			query += ` WHERE hidden = 0`
		}
		query += ` ORDER BY sortOrder ASC, name ASC`
		rows, err := db.Query(query)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		cats := []BlogCategory{}
		for rows.Next() {
			c, err := scanCategory(rows)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			cats = append(cats, c)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cats)

	case http.MethodPost:
		var c BlogCategory
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		c.Name = strings.TrimSpace(c.Name)
		if c.Name == "" {
			http.Error(w, "Nome da categoria é obrigatório", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(c.Slug) == "" {
			c.Slug = slugify(c.Name)
		} else {
			c.Slug = slugify(c.Slug)
		}
		c.ID = fmt.Sprintf("cat-%d", time.Now().UnixNano())
		now := time.Now()
		c.CreatedAt = now
		c.UpdatedAt = now

		if c.SortOrder == 0 {
			var maxOrder sql.NullInt64
			_ = db.QueryRow(`SELECT MAX(sortOrder) FROM BlogCategory`).Scan(&maxOrder)
			if maxOrder.Valid {
				c.SortOrder = int(maxOrder.Int64) + 1
			}
		}

		_, err := db.Exec(
			`INSERT INTO BlogCategory (`+categoryColumns+`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.ID, c.Name, c.Slug, c.Description, c.SortOrder, c.Hidden, c.SeoTitle, c.SeoDescription, c.CreatedAt, c.UpdatedAt,
		)
		if err != nil {
			if isDuplicateKey(err) {
				http.Error(w, "Já existe uma categoria com este endereço (slug).", http.StatusConflict)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notifySite(categoryPaths(c.Slug))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(c)

	case http.MethodPut:
		var payload struct {
			BlogCategory
			Order []string `json:"order,omitempty"`
			RenameArticles *bool `json:"renameArticles,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// Reordenação rápida em lote: {"order": ["cat-cases", "cat-posts", ...]}
		if len(payload.Order) > 0 && payload.ID == "" {
			now := time.Now()
			for idx, id := range payload.Order {
				_, _ = db.Exec(`UPDATE BlogCategory SET sortOrder = ?, updatedAt = ? WHERE id = ?`, idx, now, id)
			}
			notifySite([]string{"/blog"})
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprint(w, `{"status":"success"}`)
			return
		}

		c := payload.BlogCategory
		if c.ID == "" {
			http.Error(w, "id é obrigatório", http.StatusBadRequest)
			return
		}
		var prevName, prevSlug string
		err := db.QueryRow(`SELECT name, slug FROM BlogCategory WHERE id = ?`, c.ID).Scan(&prevName, &prevSlug)
		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Categoria não encontrada", http.StatusNotFound)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		c.Name = strings.TrimSpace(c.Name)
		if c.Name == "" {
			c.Name = prevName
		}
		if strings.TrimSpace(c.Slug) == "" {
			c.Slug = slugify(c.Name)
		} else {
			c.Slug = slugify(c.Slug)
		}
		c.UpdatedAt = time.Now()

		_, err = db.Exec(
			`UPDATE BlogCategory SET name=?, slug=?, description=?, sortOrder=?, hidden=?, seoTitle=?, seoDescription=?, updatedAt=? WHERE id=?`,
			c.Name, c.Slug, c.Description, c.SortOrder, c.Hidden, c.SeoTitle, c.SeoDescription, c.UpdatedAt, c.ID,
		)
		if err != nil {
			if isDuplicateKey(err) {
				http.Error(w, "Já existe uma categoria com este endereço (slug).", http.StatusConflict)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Se renomeou a categoria, atualiza os artigos que usavam o nome antigo para manter consistência.
		if prevName != c.Name && (payload.RenameArticles == nil || *payload.RenameArticles) {
			renameCategoryInArticles(prevName, c.Name)
		}

		rows, err := db.Query(`SELECT `+categoryColumns+` FROM BlogCategory WHERE id = ?`, c.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		if !rows.Next() {
			http.Error(w, "Categoria não encontrada", http.StatusNotFound)
			return
		}
		updated, err := scanCategory(rows)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		notifySite(categoryPaths(prevSlug, updated.Slug))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(updated)

	case http.MethodDelete:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id é obrigatório", http.StatusBadRequest)
			return
		}
		var deletedSlug string
		_ = db.QueryRow(`SELECT slug FROM BlogCategory WHERE id = ?`, id).Scan(&deletedSlug)
		res, err := db.Exec(`DELETE FROM BlogCategory WHERE id = ?`, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			http.Error(w, "Categoria não encontrada", http.StatusNotFound)
			return
		}
		notifySite(categoryPaths(deletedSlug))
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"success"}`)

	default:
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
	}
}

func renameCategoryInArticles(oldName, newName string) {
	rows, err := db.Query(`SELECT id, categories FROM Article WHERE categories IS NOT NULL`)
	if err != nil {
		return
	}
	type patch struct {
		id   string
		cats []string
	}
	var patches []patch
	for rows.Next() {
		var id string
		var raw []byte
		if err := rows.Scan(&id, &raw); err != nil || len(raw) == 0 {
			continue
		}
		var cats []string
		if err := json.Unmarshal(raw, &cats); err != nil {
			continue
		}
		changed := false
		for i, c := range cats {
			if strings.EqualFold(strings.TrimSpace(c), oldName) {
				cats[i] = newName
				changed = true
			}
		}
		if changed {
			patches = append(patches, patch{id: id, cats: cats})
		}
	}
	rows.Close()
	for _, p := range patches {
		b, _ := json.Marshal(p.cats)
		_, _ = db.Exec(`UPDATE Article SET categories = ? WHERE id = ?`, b, p.id)
	}
}

