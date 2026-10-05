package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

// Histórico de mudanças (apps/admin/src/lib/history.ts): quem, quando, em qual registro, o que mudou
// (antes e depois). É SÓ-ACRÉSCIMO: a API não tem rota para alterar nem apagar uma linha.
//
//   - O front gera o id de cada entrada, então reenviar a mesma entrada (retry) não duplica.
//   - "quando" vem do front se for plausível (de 7 dias atrás até 1 minuto no futuro); fora disso vale a hora do servidor.
//   - "quem" é o nome que o admin informa: até existir login ele NÃO é confiável (fase de segurança).
//   - O IP de origem fica guardado (para a Auditoria, "quando a API existir"), mas não é devolvido por
//     nenhuma rota até haver autenticação.

type ChangeDTO struct {
	ID         string    `json:"id"`
	At         *FlexTime `json:"at,omitempty"`
	Actor      string    `json:"actor"`
	Entity     string    `json:"entity"`
	EntityID   string    `json:"entityId"`
	EntityName string    `json:"entityName"`
	Kind       string    `json:"kind"`
	Field      string    `json:"field,omitempty"`
	From       string    `json:"from,omitempty"`
	To         string    `json:"to,omitempty"`
	Note       string    `json:"note,omitempty"`
}

var changeKinds = map[string]bool{"create": true, "edit": true, "archive": true, "restore": true, "reveal": true, "lifecycle": true, "event": true, "qualify": true, "discard": true}

const (
	maxHistoryBatch = 100
	maxHistoryText  = 2000
	historyBodyKB   = 256
	historyPerMin   = 240
)

// validateChange normaliza uma entrada. `now` entra por parâmetro para testar o relógio.
func validateChange(c *ChangeDTO, now time.Time) error {
	c.Actor = clean(c.Actor, 120)
	c.EntityName = clean(c.EntityName, 255)
	c.Field = clean(c.Field, 120)
	c.From = clean(c.From, maxHistoryText)
	c.To = clean(c.To, maxHistoryText)
	c.Note = clean(c.Note, maxHistoryText)
	if c.ID != "" && !idRe.MatchString(c.ID) {
		return errors.New("id da entrada inválido")
	}
	if !entityKinds[c.Entity] {
		return errors.New("tipo de registro inválido")
	}
	if !idRe.MatchString(c.EntityID) {
		return errors.New("id do registro inválido")
	}
	if !changeKinds[c.Kind] {
		return errors.New("tipo de mudança inválido")
	}
	if c.Actor == "" {
		c.Actor = "Equipe"
	}
	if c.ID == "" {
		c.ID = wfID("h")
	}
	if c.At == nil || c.At.IsZero() || c.At.Before(now.Add(-7*24*time.Hour)) || c.At.After(now.Add(time.Minute)) {
		c.At = &FlexTime{now}
	}
	return nil
}

const changeCols = `id, at, actor, entity, entityId, entityName, kind, field, fromValue, toValue, note`

func scanChange(sc interface{ Scan(...any) error }) (ChangeDTO, error) {
	var c ChangeDTO
	var at string
	var field, from, to, note sql.NullString
	if err := sc.Scan(&c.ID, &at, &c.Actor, &c.Entity, &c.EntityID, &c.EntityName, &c.Kind, &field, &from, &to, &note); err != nil {
		return c, err
	}
	c.At = flexFrom(at)
	c.Field, c.From, c.To, c.Note = field.String, from.String, to.String, note.String
	return c, nil
}

// decodeChanges aceita uma entrada ({...}) ou uma lista ([...]).
func decodeChanges(body []byte) ([]ChangeDTO, error) {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 {
		return nil, errors.New("corpo vazio")
	}
	var list []ChangeDTO
	if trimmed[0] == '[' {
		if err := json.Unmarshal(trimmed, &list); err != nil {
			return nil, err
		}
	} else {
		var one ChangeDTO
		if err := json.Unmarshal(trimmed, &one); err != nil {
			return nil, err
		}
		list = []ChangeDTO{one}
	}
	if len(list) == 0 {
		return nil, errors.New("nenhuma entrada")
	}
	if len(list) > maxHistoryBatch {
		return nil, errors.New("entradas demais de uma vez (máx. 100)")
	}
	return list, nil
}

func saveChanges(list []ChangeDTO, ip string) (saved int, err error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	for _, c := range list {
		res, err := tx.Exec(`INSERT IGNORE INTO ChangeLog (id, at, actor, entity, entityId, entityName, kind, field, fromValue, toValue, note, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.ID, c.At.Time, c.Actor, c.Entity, c.EntityID, c.EntityName, c.Kind, nullStr(c.Field), nullStr(c.From), nullStr(c.To), nullStr(c.Note), nullStr(ip))
		if err != nil {
			return 0, err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			saved++
		}
	}
	return saved, tx.Commit()
}

// GET /api/crm/history (?entity=&entityId=&kind=&q=&since=&until=&limit=&offset=; total em X-Total-Count)
// e POST (uma entrada ou uma lista). Não há PUT nem DELETE: o histórico só cresce.
func handleHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		where, args := `1=1`, []any{}
		qs := r.URL.Query()
		if v := qs.Get("entity"); entityKinds[v] {
			where += ` AND entity = ?`
			args = append(args, v)
		}
		if v := qs.Get("entityId"); v != "" && idRe.MatchString(v) {
			where += ` AND entityId = ?`
			args = append(args, v)
		}
		if v := qs.Get("kind"); changeKinds[v] {
			where += ` AND kind = ?`
			args = append(args, v)
		}
		for _, f := range []struct{ param, op string }{{"since", ">="}, {"until", "<="}} {
			if v := qs.Get(f.param); v != "" {
				var t FlexTime
				if err := t.UnmarshalJSON([]byte(`"` + v + `"`)); err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "data inválida em " + f.param})
					return
				}
				where += ` AND at ` + f.op + ` ?`
				args = append(args, t.Time)
			}
		}
		if q := strings.TrimSpace(qs.Get("q")); q != "" {
			like := "%" + strings.ReplaceAll(strings.ReplaceAll(q, "%", ""), "_", "") + "%"
			where += ` AND (entityName LIKE ? OR actor LIKE ? OR field LIKE ? OR note LIKE ?)`
			args = append(args, like, like, like, like)
		}
		var total int
		if err := db.QueryRow(`SELECT COUNT(*) FROM ChangeLog WHERE `+where, args...).Scan(&total); err != nil {
			writeErr(w, err)
			return
		}
		pg := readPage(r)
		rows, err := db.Query(`SELECT `+changeCols+` FROM ChangeLog WHERE `+where+` ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`, append(args, pg.limit, pg.offset)...)
		if err != nil {
			writeErr(w, err)
			return
		}
		defer rows.Close()
		out := []ChangeDTO{}
		for rows.Next() {
			c, err := scanChange(rows)
			if err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, c)
		}
		w.Header().Set("X-Total-Count", itoa(total))
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		ip := clientIP(r)
		if !allowRateLimit("history:"+ip, historyPerMin, time.Now()) {
			w.Header().Set("Retry-After", "60")
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "muitas tentativas, tente em instantes"})
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, historyBodyKB<<10)
		var buf bytes.Buffer
		if _, err := buf.ReadFrom(r.Body); err != nil {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "corpo grande demais"})
			return
		}
		list, err := decodeChanges(buf.Bytes())
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		now := time.Now()
		for i := range list {
			if err := validateChange(&list[i], now); err != nil {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
				return
			}
		}
		saved, err := saveChanges(list, ip)
		if err != nil {
			writeErr(w, err)
			return
		}
		status := http.StatusOK
		if saved > 0 {
			status = http.StatusCreated
		}
		writeJSON(w, status, map[string]int{"saved": saved, "duplicates": len(list) - saved})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "o histórico só aceita GET e POST"})
	}
}
