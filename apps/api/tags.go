package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Catálogo de tags. A tag em si continua sendo TEXTO nos registros (Opportunity.tags, Lead.tags, Person.tags…): nada
// muda nelas. Esta tabela só CLASSIFICA o texto (nome → categoria), para o admin listar as tags existentes por
// categoria, buscar e desenhar cada categoria de um jeito. Tag que não está no catálogo vale como GENERAL.
// Status (da tarefa), prioridade e origem NÃO são tags: são campos próprios dos registros.
// Apagar uma entrada do catálogo NÃO toca nos registros que usam o texto.

const (
	tagProfile = "PROFILE" // perfil do cliente: B2B, B2C, Enterprise…
	tagEvent   = "EVENT"   // evento: feira, webinar, congresso…
	tagGeneral = "GENERAL"

	tagNameMax = 40
)

var tagCategories = map[string]bool{tagProfile: true, tagEvent: true, tagGeneral: true}

const tagSchema = `
CREATE TABLE IF NOT EXISTS Tag (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(80) NOT NULL,
	category VARCHAR(12) NOT NULL DEFAULT 'GENERAL',
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	UNIQUE KEY uq_tag_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

type TagDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Category  string    `json:"category"`
	CreatedAt time.Time `json:"createdAt"`
}

// ensureTagSchema cria a tabela (só CREATE IF NOT EXISTS: nada existente é alterado nem apagado).
func ensureTagSchema() {
	for _, stmt := range splitStatements(tagSchema) {
		if _, err := db.Exec(stmt); err != nil {
			// O catálogo é um extra: sem ele as tags seguem funcionando como texto. Não derruba a API.
			fmt.Println("⚠️ Tags: não consegui criar a tabela Tag:", err)
			return
		}
	}
}

// cleanTagName normaliza o nome: tira espaços das pontas, junta espaços repetidos e recusa vazio, longo demais ou com
// caractere de controle.
func cleanTagName(raw string) (string, error) {
	name := strings.Join(strings.Fields(raw), " ")
	switch {
	case name == "":
		return "", errors.New("dê um nome à tag")
	case utf8.RuneCountInString(name) > tagNameMax:
		return "", fmt.Errorf("a tag pode ter até %d caracteres", tagNameMax)
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return "", errors.New("nome de tag inválido")
		}
	}
	return name, nil
}

// normalizeCategory: vazio vira GENERAL; categoria fora da lista é erro.
func normalizeCategory(raw string) (string, error) {
	c := strings.ToUpper(strings.TrimSpace(raw))
	if c == "" {
		return tagGeneral, nil
	}
	if !tagCategories[c] {
		return "", errors.New("categoria inválida")
	}
	return c, nil
}

func newTagID() string { return fmt.Sprintf("tag-%d", time.Now().UnixNano()) }

func registerTagRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/tags", enableCORS(handleTags))
	mux.HandleFunc("/api/tags/{id}", enableCORS(handleTagByID))
}

func handleTags(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`SELECT id, name, category, createdAt FROM Tag ORDER BY category, name`)
		if err != nil {
			writeErr(w, err)
			return
		}
		defer rows.Close()
		out := []TagDTO{}
		for rows.Next() {
			var t TagDTO
			if err := rows.Scan(&t.ID, &t.Name, &t.Category, &t.CreatedAt); err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, t)
		}
		if err := rows.Err(); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var in struct {
			Name     string `json:"name"`
			Category string `json:"category"`
		}
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 4<<10))
		if err != nil || json.Unmarshal(raw, &in) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		name, err := cleanTagName(in.Name)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		cat, err := normalizeCategory(in.Category)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		now := time.Now()
		t := TagDTO{ID: newTagID(), Name: name, Category: cat, CreatedAt: now}
		if _, err := db.Exec(`INSERT INTO Tag (id, name, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`, t.ID, t.Name, t.Category, now, now); err != nil {
			if isDuplicateKey(err) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "já existe uma tag com esse nome"})
				return
			}
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, t)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// handleTagByID: PUT troca só a CATEGORIA (renomear descolaria o catálogo dos registros, que guardam o texto);
// DELETE tira a entrada do catálogo sem tocar nos registros.
func handleTagByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodPut:
		var in struct {
			Category string `json:"category"`
		}
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 4<<10))
		if err != nil || json.Unmarshal(raw, &in) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		cat, err := normalizeCategory(in.Category)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		res, err := db.Exec(`UPDATE Tag SET category = ?, updatedAt = ? WHERE id = ?`, cat, time.Now(), id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			// MySQL devolve 0 também quando o valor não mudou: confirma se a tag existe.
			var one int
			if err := db.QueryRow(`SELECT 1 FROM Tag WHERE id = ?`, id).Scan(&one); errors.Is(err, sql.ErrNoRows) {
				writeErr(w, errNotFound)
				return
			} else if err != nil {
				writeErr(w, err)
				return
			}
		}
		var t TagDTO
		if err := db.QueryRow(`SELECT id, name, category, createdAt FROM Tag WHERE id = ?`, id).Scan(&t.ID, &t.Name, &t.Category, &t.CreatedAt); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, t)
	case http.MethodDelete:
		res, err := db.Exec(`DELETE FROM Tag WHERE id = ?`, id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeErr(w, errNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}
