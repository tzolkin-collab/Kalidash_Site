package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Criativos orgânicos (admin > Tráfego): a peça que a equipe vai publicar, com a legenda e um ID gerado aqui. O ID
// entra no fim do utm_content dos links curtos da peça (campaign_links.go), então clique e lead voltam para ela sem
// ninguém montar UTM à mão. Nada é publicado nas redes: a equipe cola o link e, depois, guarda o endereço do post.

const creativeSchema = `
CREATE TABLE IF NOT EXISTS Creative (
	id VARCHAR(16) PRIMARY KEY,
	title VARCHAR(160) NOT NULL,
	caption TEXT NOT NULL,
	format VARCHAR(16) NOT NULL,
	campaign VARCHAR(120) NOT NULL,
	destination VARCHAR(500) NOT NULL,
	mediaUrl VARCHAR(500) NOT NULL DEFAULT '',
	postUrls TEXT NULL,
	createdBy VARCHAR(160) NOT NULL DEFAULT '',
	archivedAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	INDEX idx_creative_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

func ensureCreativeSchema() {
	if _, err := db.Exec(creativeSchema); err != nil {
		log.Fatal("❌ Erro ao criar tabela Creative:", err)
	}
}

type Creative struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Caption     string    `json:"caption"`
	Format      string    `json:"format"`
	Campaign    string    `json:"campaign"`
	Destination string    `json:"destination"`
	MediaURL    string    `json:"mediaUrl"`
	PostURLs    []string  `json:"postUrls"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   *FlexTime `json:"createdAt,omitempty"`
}

type creativeInput struct {
	Title       string   `json:"title"`
	Caption     string   `json:"caption"`
	Format      string   `json:"format"`
	Campaign    string   `json:"campaign"`
	Destination string   `json:"destination"`
	MediaURL    string   `json:"mediaUrl"`
	PostURLs    []string `json:"postUrls"`
}

var creativeFormats = map[string]bool{"post": true, "carrossel": true, "reels": true, "stories": true, "video": true}

// webURL aceita só endereço http(s) completo: o valor vira link e imagem no admin.
func webURL(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", true
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || len(raw) > 500 {
		return "", false
	}
	return raw, true
}

func cleanPostURLs(list []string) ([]string, error) {
	out := []string{}
	seen := map[string]bool{}
	for _, raw := range list {
		u, ok := webURL(raw)
		if !ok {
			return nil, errors.New("o endereço da publicação precisa começar com https://")
		}
		if u != "" && !seen[u] {
			seen[u] = true
			out = append(out, u)
		}
	}
	if len(out) > 20 {
		return nil, errors.New("no máximo 20 publicações por criativo")
	}
	return out, nil
}

func (in creativeInput) toCreative() (Creative, error) {
	c := Creative{
		Title:    clean(in.Title, 160),
		Caption:  strings.TrimSpace(in.Caption),
		Format:   strings.ToLower(strings.TrimSpace(in.Format)),
		Campaign: clean(normalizeUTM(in.Campaign), 120),
	}
	if c.Title == "" || c.Campaign == "" {
		return Creative{}, errors.New("nome e tema são obrigatórios")
	}
	if !creativeFormats[c.Format] {
		return Creative{}, errors.New("formato inválido")
	}
	if len([]rune(c.Caption)) > 3000 {
		return Creative{}, errors.New("a legenda passa de 3000 caracteres")
	}
	dest, err := normalizeDestination(in.Destination)
	if err != nil {
		return Creative{}, err
	}
	c.Destination = dest
	media, ok := webURL(in.MediaURL)
	if !ok {
		return Creative{}, errors.New("endereço da imagem inválido")
	}
	c.MediaURL = media
	if c.PostURLs, err = cleanPostURLs(in.PostURLs); err != nil {
		return Creative{}, err
	}
	return c, nil
}

// newCreativeID: "cr" + 6 caracteres sem os ambíguos. Sem "_", para o fim do utm_content ser sempre "_<id>".
func newCreativeID() string { return "cr" + newLinkCode(6) }

func registerCreativeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/blog/creatives", enableCORS(handleCreatives))
	mux.HandleFunc("/api/blog/creatives/{id}", enableCORS(handleCreativeByID))
}

func listCreatives() ([]Creative, error) {
	rows, err := db.Query(`SELECT id, title, caption, format, campaign, destination, mediaUrl, postUrls, createdBy, createdAt FROM Creative WHERE archivedAt IS NULL ORDER BY createdAt DESC, id LIMIT 500`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Creative{}
	for rows.Next() {
		var c Creative
		var posts, created sql.NullString
		if err := rows.Scan(&c.ID, &c.Title, &c.Caption, &c.Format, &c.Campaign, &c.Destination, &c.MediaURL, &posts, &c.CreatedBy, &created); err != nil {
			return nil, err
		}
		c.PostURLs = []string{}
		if posts.Valid {
			_ = json.Unmarshal([]byte(posts.String), &c.PostURLs)
		}
		c.CreatedAt = flexFrom(created.String)
		out = append(out, c)
	}
	return out, rows.Err()
}

func handleCreatives(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := listCreatives()
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		var in creativeInput
		r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		c, err := in.toCreative()
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		c.ID = newCreativeID()
		c.CreatedBy = clean(actorName(r), 160)
		now := time.Now().UTC()
		posts, _ := json.Marshal(c.PostURLs)
		if _, err := db.Exec(`INSERT INTO Creative (id, title, caption, format, campaign, destination, mediaUrl, postUrls, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.ID, c.Title, c.Caption, c.Format, c.Campaign, c.Destination, c.MediaURL, string(posts), c.CreatedBy, now, now); err != nil {
			writeErr(w, err)
			return
		}
		created := FlexTime{now}
		c.CreatedAt = &created
		writeJSON(w, http.StatusCreated, c)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// handleCreativeByID: PATCH guarda os endereços das publicações; DELETE arquiva (os links curtos continuam valendo).
// Tema e destino não mudam depois de criado: os links já distribuídos carregam esses valores.
func handleCreativeByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	var res sql.Result
	var err error
	switch r.Method {
	case http.MethodPatch:
		var in struct {
			PostURLs []string `json:"postUrls"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		list, verr := cleanPostURLs(in.PostURLs)
		if verr != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": verr.Error()})
			return
		}
		posts, _ := json.Marshal(list)
		// updatedAt sempre muda, então "0 linhas" quer dizer que o criativo não existe
		res, err = db.Exec(`UPDATE Creative SET postUrls = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, string(posts), time.Now().UTC().Format("2006-01-02 15:04:05"), id)
		if err == nil {
			if n, _ := res.RowsAffected(); n == 0 {
				var found string
				err = db.QueryRow(`SELECT id FROM Creative WHERE id = ? AND archivedAt IS NULL`, id).Scan(&found)
				if errors.Is(err, sql.ErrNoRows) {
					writeErr(w, errNotFound)
					return
				}
			}
		}
	case http.MethodDelete:
		res, err = db.Exec(`UPDATE Creative SET archivedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now().UTC(), id)
		if err == nil {
			if n, _ := res.RowsAffected(); n == 0 {
				writeErr(w, errNotFound)
				return
			}
		}
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
