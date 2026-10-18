package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

// Pessoas (tabela Contact). JSON espelha Person de apps/admin/src/domain.ts.

type PersonDTO struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Email       string         `json:"email"`
	Phone       string         `json:"phone"`
	ExtraEmails []ContactPoint `json:"extraEmails"`
	ExtraPhones []ContactPoint `json:"extraPhones"`
	// Document: na resposta vem mascarado ("•••.•••.•••-35"); no corpo, o CPF completo, ou o
	// valor mascarado de volta (= não mudar), ou vazio (= apagar).
	Document       string         `json:"document,omitempty"`
	Role           string         `json:"role,omitempty"`
	Tags           []string       `json:"tags"`
	Lifecycle      string         `json:"lifecycle"`
	LegacyClient   bool           `json:"legacyClient,omitempty"`
	InactiveReason string         `json:"inactiveReason,omitempty"`
	FirstWonAt     *FlexTime      `json:"firstWonAt,omitempty"`
	LgpdBasis      string         `json:"lgpdBasis,omitempty"`
	LgpdAt         *FlexTime      `json:"lgpdAt,omitempty"`
	CustomData     map[string]any `json:"customData,omitempty"`
	ArchivedAt     *FlexTime      `json:"archivedAt,omitempty"`
	CreatedAt      *FlexTime      `json:"createdAt,omitempty"`
}

var errInvalidCPF = errors.New("CPF inválido")

var lifecycles = map[string]bool{"LEAD": true, "PROSPECT": true, "CLIENT": true, "INACTIVE": true}

type personExtra struct {
	ExtraEmails []ContactPoint `json:"extraEmails,omitempty"`
	ExtraPhones []ContactPoint `json:"extraPhones,omitempty"`
	CustomData  map[string]any `json:"customData,omitempty"`
}

func cleanPoints(in []ContactPoint, isEmail bool) ([]ContactPoint, error) {
	out := []ContactPoint{}
	for _, p := range in {
		p.Value, p.Label = clean(p.Value, 120), clean(p.Label, 60)
		if p.Value == "" {
			continue
		}
		if isEmail && !emailRe.MatchString(p.Value) {
			return nil, errors.New("e-mail adicional inválido: " + p.Value)
		}
		out = append(out, p)
	}
	if len(out) > 20 {
		return nil, errors.New("contatos adicionais demais (máx. 20)")
	}
	return out, nil
}

// validatePerson normaliza e confere. Não toca no documento (ver docColumns).
func validatePerson(p *PersonDTO) error {
	p.Name = clean(p.Name, 255)
	p.Email = strings.ToLower(clean(p.Email, 255))
	p.Phone = clean(p.Phone, 40)
	p.Role = clean(p.Role, 120)
	p.InactiveReason = clean(p.InactiveReason, 255)
	p.LgpdBasis = clean(p.LgpdBasis, 120)
	if p.Name == "" {
		return errors.New("a pessoa precisa de um nome")
	}
	if p.Email != "" && !emailRe.MatchString(p.Email) {
		return errors.New("e-mail inválido")
	}
	if p.Lifecycle == "" {
		p.Lifecycle = "LEAD"
	}
	if !lifecycles[p.Lifecycle] {
		return errors.New("ciclo de vida inválido")
	}
	var err error
	if p.ExtraEmails, err = cleanPoints(p.ExtraEmails, true); err != nil {
		return err
	}
	if p.ExtraPhones, err = cleanPoints(p.ExtraPhones, false); err != nil {
		return err
	}
	p.Tags = cleanStrings(p.Tags, 60)
	if len(p.Tags) > 30 {
		return errors.New("tags demais (máx. 30)")
	}
	if raw, _ := json.Marshal(p.CustomData); len(raw) > 64<<10 {
		return errors.New("campos personalizados passam de 64 KB")
	}
	return nil
}

// docColumns decide o que gravar no documento: change=false mantém o que já está no banco.
func docColumns(doc string) (enc, hash any, change bool, err error) {
	doc = strings.TrimSpace(doc)
	if isMasked(doc) {
		return nil, nil, false, nil
	}
	if doc == "" {
		return nil, nil, true, nil // apagar
	}
	if !isValidCPF(doc) {
		return nil, nil, false, errInvalidCPF
	}
	digits := onlyDigits(doc)
	e, err := encryptDoc(formatCPF(digits))
	if err != nil {
		return nil, nil, false, err
	}
	h, err := docHash(digits)
	if err != nil {
		return nil, nil, false, err
	}
	return e, h, true, nil
}

const personCols = `id, name, email, phone, role, lifecycle, legacyClient, inactiveReason, firstWonAt, lgpdBasis, lgpdAt, documentEnc, tags, extra, archivedAt, createdAt`

func scanPerson(sc interface{ Scan(...any) error }) (PersonDTO, error) {
	var p PersonDTO
	var email, phone, role, inactive, lgpd, docEnc, firstWon, lgpdAt, archived, created sql.NullString
	var tags, extra []byte
	var legacy bool
	if err := sc.Scan(&p.ID, &p.Name, &email, &phone, &role, &p.Lifecycle, &legacy, &inactive, &firstWon, &lgpd, &lgpdAt, &docEnc, &tags, &extra, &archived, &created); err != nil {
		return p, err
	}
	p.Email, p.Phone, p.Role, p.InactiveReason, p.LgpdBasis = email.String, phone.String, role.String, inactive.String, lgpd.String
	p.LegacyClient = legacy
	p.FirstWonAt, p.LgpdAt, p.ArchivedAt, p.CreatedAt = flexFrom(firstWon.String), flexFrom(lgpdAt.String), flexFrom(archived.String), flexFrom(created.String)
	p.Tags = decodeJSON(tags, []string{})
	ex := decodeJSON(extra, personExtra{})
	p.ExtraEmails, p.ExtraPhones, p.CustomData = ex.ExtraEmails, ex.ExtraPhones, ex.CustomData
	if p.ExtraEmails == nil {
		p.ExtraEmails = []ContactPoint{}
	}
	if p.ExtraPhones == nil {
		p.ExtraPhones = []ContactPoint{}
	}
	if docEnc.Valid && docEnc.String != "" {
		p.Document = "•••"
		if plain, err := decryptDoc(docEnc.String); err == nil {
			p.Document = maskCPF(plain)
		}
	}
	return p, nil
}

func personExtraJSON(p *PersonDTO) any {
	return jsonOrNull(personExtra{ExtraEmails: p.ExtraEmails, ExtraPhones: p.ExtraPhones, CustomData: p.CustomData})
}

func isDup(err error) bool {
	var my *mysql.MySQLError
	return errors.As(err, &my) && my.Number == 1062
}

func savePerson(p *PersonDTO, replace bool) error {
	enc, hash, change, err := docColumns(p.Document)
	if err != nil {
		return err
	}
	now := time.Now()
	if !replace {
		_, err = db.Exec(`INSERT INTO Contact (id, name, email, phone, role, lifecycle, legacyClient, inactiveReason, firstWonAt, lgpdBasis, lgpdAt, documentEnc, documentHash, tags, extra, archivedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			p.ID, p.Name, p.Email, p.Phone, nullStr(p.Role), p.Lifecycle, p.LegacyClient, nullStr(p.InactiveReason), ptrTime(p.FirstWonAt), nullStr(p.LgpdBasis), ptrTime(p.LgpdAt),
			enc, hash, jsonOrNull(p.Tags), personExtraJSON(p), ptrTime(p.ArchivedAt), now, now)
		return err
	}
	q := `UPDATE Contact SET name = ?, email = ?, phone = ?, role = ?, lifecycle = ?, legacyClient = ?, inactiveReason = ?, firstWonAt = ?, lgpdBasis = ?, lgpdAt = ?, tags = ?, extra = ?, archivedAt = ?, updatedAt = ?`
	args := []any{p.Name, p.Email, p.Phone, nullStr(p.Role), p.Lifecycle, p.LegacyClient, nullStr(p.InactiveReason), ptrTime(p.FirstWonAt), nullStr(p.LgpdBasis), ptrTime(p.LgpdAt),
		jsonOrNull(p.Tags), personExtraJSON(p), ptrTime(p.ArchivedAt), now}
	if change {
		q += `, documentEnc = ?, documentHash = ?`
		args = append(args, enc, hash)
	}
	res, err := db.Exec(q+` WHERE id = ?`, append(args, p.ID)...)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		var c int
		if err := db.QueryRow(`SELECT COUNT(*) FROM Contact WHERE id = ?`, p.ID).Scan(&c); err != nil || c == 0 {
			return errNotFound
		}
	}
	return nil
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func getPerson(id string) (PersonDTO, error) {
	p, err := scanPerson(db.QueryRow(`SELECT `+personCols+` FROM Contact WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return p, errNotFound
	}
	return p, err
}

func writePersonErr(w http.ResponseWriter, err error) {
	switch {
	case isDup(err):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "já existe uma pessoa com este CPF"})
	case errors.Is(err, errNoKey), errors.Is(err, errInvalidCPF):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
	default:
		writeErr(w, err)
	}
}

// GET /api/crm/people (?archived=1&lifecycle=&q=&limit=&offset=) e POST.
func handlePeople(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		where, args := `1=1`, []any{}
		qs := r.URL.Query()
		if qs.Get("archived") != "1" {
			where += ` AND archivedAt IS NULL`
		}
		if v := qs.Get("lifecycle"); lifecycles[v] {
			where += ` AND lifecycle = ?`
			args = append(args, v)
		}
		if q := strings.TrimSpace(qs.Get("q")); q != "" {
			like := "%" + strings.ReplaceAll(strings.ReplaceAll(q, "%", ""), "_", "") + "%"
			where += ` AND (name LIKE ? OR email LIKE ?)`
			args = append(args, like, like)
		}
		var total int
		if err := db.QueryRow(`SELECT COUNT(*) FROM Contact WHERE `+where, args...).Scan(&total); err != nil {
			writeErr(w, err)
			return
		}
		pg := readPage(r)
		rows, err := db.Query(`SELECT `+personCols+` FROM Contact WHERE `+where+` ORDER BY COALESCE(createdAt, '1970-01-01 00:00:00') DESC, id LIMIT ? OFFSET ?`, append(args, pg.limit, pg.offset)...)
		if err != nil {
			writeErr(w, err)
			return
		}
		defer rows.Close()
		out := []PersonDTO{}
		for rows.Next() {
			p, err := scanPerson(rows)
			if err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, p)
		}
		w.Header().Set("X-Total-Count", itoa(total))
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
		var p PersonDTO
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if p.ID != "" && !idRe.MatchString(p.ID) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "id inválido"})
			return
		}
		if p.ID == "" {
			p.ID = wfID("p")
		}
		if !canWriteDocument(w, r, p.Document) {
			return
		}
		if err := validatePerson(&p); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := savePerson(&p, false); err != nil {
			if isDup(err) && strings.Contains(err.Error(), "PRIMARY") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "já existe uma pessoa com este id"})
				return
			}
			writePersonErr(w, err)
			return
		}
		got, err := getPerson(p.ID)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, got)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

// GET um, PUT substitui (archivedAt nulo desarquiva), DELETE arquiva.
func handlePersonByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		p, err := getPerson(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, p)
	case http.MethodPut:
		r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
		var p PersonDTO
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		p.ID = id
		if !canWriteDocument(w, r, p.Document) {
			return
		}
		if err := validatePerson(&p); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := savePerson(&p, true); err != nil {
			writePersonErr(w, err)
			return
		}
		got, err := getPerson(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, got)
	case http.MethodDelete:
		res, err := db.Exec(`UPDATE Contact SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now(), time.Now(), id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			writeErr(w, errNotFound)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// GET /api/crm/people/{id}/document: revela o CPF completo. SEM autenticação por enquanto, como o
// resto da API: entra na fase de segurança com permissão por perfil e registro de auditoria.
func handlePersonDocument(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if r.Method != http.MethodGet || !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pedido inválido"})
		return
	}
	var enc sql.NullString
	if err := db.QueryRow(`SELECT documentEnc FROM Contact WHERE id = ?`, id).Scan(&enc); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, errNotFound)
			return
		}
		writeErr(w, err)
		return
	}
	if !enc.Valid || enc.String == "" {
		writeJSON(w, http.StatusOK, map[string]string{"document": ""})
		return
	}
	plain, err := decryptDoc(enc.String)
	if err != nil {
		writePersonErr(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"document": plain})
}
