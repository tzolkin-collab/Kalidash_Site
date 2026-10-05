package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

// Empresas (tabela Company) e seus stakeholders (CompanyStakeholder). JSON espelha Company de
// apps/admin/src/domain.ts. Sem CNPJ a empresa fica "em análise" (status REVIEW), calculado aqui.

type StakeholderDTO struct {
	PersonID    string `json:"personId"`
	Description string `json:"description"`
	Tag         string `json:"tag"`
}

type CompanyDTO struct {
	ID               string           `json:"id"`
	Name             string           `json:"name"`
	LegalName        string           `json:"legalName,omitempty"`
	Document         string           `json:"document,omitempty"` // CNPJ só com letras e números, maiúsculo
	Status           string           `json:"status"`             // calculado: ACTIVE com CNPJ, REVIEW sem
	DefaultContactID string           `json:"defaultContactId,omitempty"`
	Stakeholders     []StakeholderDTO `json:"stakeholders"`
	Lifecycle        string           `json:"lifecycle"`
	Segment          string           `json:"segment"`
	SizeRange        string           `json:"sizeRange,omitempty"`
	Website          string           `json:"website,omitempty"`
	City             string           `json:"city,omitempty"`
	State            string           `json:"state,omitempty"`
	LegacyClient     bool             `json:"legacyClient,omitempty"`
	InactiveReason   string           `json:"inactiveReason,omitempty"`
	FirstWonAt       *FlexTime        `json:"firstWonAt,omitempty"`
	CustomData       map[string]any   `json:"customData,omitempty"`
	ArchivedAt       *FlexTime        `json:"archivedAt,omitempty"`
	CreatedAt        *FlexTime        `json:"createdAt,omitempty"`
}

func validateCompany(c *CompanyDTO) error {
	c.Name = clean(c.Name, 255)
	c.LegalName = clean(c.LegalName, 255)
	c.Segment = clean(c.Segment, 120)
	c.SizeRange = clean(c.SizeRange, 40)
	c.Website = clean(c.Website, 255)
	c.City = clean(c.City, 120)
	c.State = strings.ToUpper(clean(c.State, 2))
	c.InactiveReason = clean(c.InactiveReason, 255)
	c.DefaultContactID = clean(c.DefaultContactID, 64)
	if c.Name == "" {
		return errors.New("a empresa precisa de um nome")
	}
	if c.Document = strings.TrimSpace(c.Document); c.Document != "" {
		if !isValidCNPJ(c.Document) {
			return errors.New("CNPJ inválido")
		}
		c.Document = stripDoc(c.Document)
	}
	c.Status = "REVIEW"
	if c.Document != "" {
		c.Status = "ACTIVE"
	}
	if c.Lifecycle == "" {
		c.Lifecycle = "LEAD"
	}
	if !lifecycles[c.Lifecycle] {
		return errors.New("ciclo de vida inválido")
	}
	if c.DefaultContactID != "" && !idRe.MatchString(c.DefaultContactID) {
		return errors.New("contato padrão inválido")
	}
	if len(c.Stakeholders) > 200 {
		return errors.New("stakeholders demais (máx. 200)")
	}
	seen := map[string]bool{}
	list := []StakeholderDTO{}
	for _, s := range c.Stakeholders {
		s.Description, s.Tag = clean(s.Description, 255), clean(s.Tag, 80)
		if !idRe.MatchString(s.PersonID) {
			return errors.New("stakeholder com id de pessoa inválido")
		}
		if seen[s.PersonID] {
			return errors.New("pessoa repetida nos stakeholders")
		}
		seen[s.PersonID] = true
		list = append(list, s)
	}
	c.Stakeholders = list
	if raw, _ := json.Marshal(c.CustomData); len(raw) > 64<<10 {
		return errors.New("campos personalizados passam de 64 KB")
	}
	return nil
}

const companyCols = `id, name, legalName, document, defaultContactId, lifecycle, segment, sizeRange, website, city, state, legacyClient, inactiveReason, firstWonAt, extra, archivedAt, createdAt`

func scanCompany(sc interface{ Scan(...any) error }) (CompanyDTO, error) {
	var c CompanyDTO
	var legal, doc, def, size, web, city, state, inactive, firstWon, archived, created, segment sql.NullString
	var extra []byte
	var legacy bool
	if err := sc.Scan(&c.ID, &c.Name, &legal, &doc, &def, &c.Lifecycle, &segment, &size, &web, &city, &state, &legacy, &inactive, &firstWon, &extra, &archived, &created); err != nil {
		return c, err
	}
	c.LegalName, c.Document, c.DefaultContactID, c.Segment, c.SizeRange = legal.String, doc.String, def.String, segment.String, size.String
	c.Website, c.City, c.State, c.InactiveReason, c.LegacyClient = web.String, city.String, state.String, inactive.String, legacy
	c.FirstWonAt, c.ArchivedAt, c.CreatedAt = flexFrom(firstWon.String), flexFrom(archived.String), flexFrom(created.String)
	c.CustomData = decodeJSON(extra, map[string]any(nil))
	c.Status = "REVIEW"
	if c.Document != "" {
		c.Status = "ACTIVE"
	}
	c.Stakeholders = []StakeholderDTO{}
	return c, nil
}

// loadStakeholders preenche os stakeholders de todas as empresas da lista de uma vez.
func loadStakeholders(list []CompanyDTO) error {
	if len(list) == 0 {
		return nil
	}
	idx := map[string]int{}
	ph := make([]string, len(list))
	args := make([]any, len(list))
	for i, c := range list {
		idx[c.ID], ph[i], args[i] = i, "?", c.ID
	}
	rows, err := db.Query(`SELECT companyId, personId, description, tag FROM CompanyStakeholder WHERE companyId IN (`+strings.Join(ph, ",")+`) ORDER BY companyId, position`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid string
		var s StakeholderDTO
		if err := rows.Scan(&cid, &s.PersonID, &s.Description, &s.Tag); err != nil {
			return err
		}
		if i, ok := idx[cid]; ok {
			list[i].Stakeholders = append(list[i].Stakeholders, s)
		}
	}
	return rows.Err()
}

func getCompany(id string) (CompanyDTO, error) {
	c, err := scanCompany(db.QueryRow(`SELECT `+companyCols+` FROM Company WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return c, errNotFound
	}
	if err != nil {
		return c, err
	}
	l := []CompanyDTO{c}
	if err := loadStakeholders(l); err != nil {
		return c, err
	}
	return l[0], nil
}

func saveCompany(c *CompanyDTO, replace bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now()
	extra := jsonOrNull(c.CustomData)
	if replace {
		res, err := tx.Exec(`UPDATE Company SET name = ?, legalName = ?, document = ?, defaultContactId = ?, lifecycle = ?, segment = ?, sizeRange = ?, website = ?, city = ?, state = ?, legacyClient = ?, inactiveReason = ?, firstWonAt = ?, extra = ?, archivedAt = ?, updatedAt = ? WHERE id = ?`,
			c.Name, nullStr(c.LegalName), nullStr(c.Document), nullStr(c.DefaultContactID), c.Lifecycle, c.Segment, nullStr(c.SizeRange), nullStr(c.Website), nullStr(c.City), nullStr(c.State),
			c.LegacyClient, nullStr(c.InactiveReason), ptrTime(c.FirstWonAt), extra, ptrTime(c.ArchivedAt), now, c.ID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			var k int
			if err := tx.QueryRow(`SELECT COUNT(*) FROM Company WHERE id = ?`, c.ID).Scan(&k); err != nil || k == 0 {
				return errNotFound
			}
		}
		if _, err := tx.Exec(`DELETE FROM CompanyStakeholder WHERE companyId = ?`, c.ID); err != nil {
			return err
		}
	} else if _, err := tx.Exec(`INSERT INTO Company (id, name, legalName, document, defaultContactId, lifecycle, segment, sizeRange, website, city, state, legacyClient, inactiveReason, firstWonAt, extra, archivedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Name, nullStr(c.LegalName), nullStr(c.Document), nullStr(c.DefaultContactID), c.Lifecycle, c.Segment, nullStr(c.SizeRange), nullStr(c.Website), nullStr(c.City), nullStr(c.State),
		c.LegacyClient, nullStr(c.InactiveReason), ptrTime(c.FirstWonAt), extra, ptrTime(c.ArchivedAt), now, now); err != nil {
		return err
	}
	for i, s := range c.Stakeholders {
		if _, err := tx.Exec(`INSERT INTO CompanyStakeholder (companyId, personId, description, tag, position) VALUES (?, ?, ?, ?, ?)`, c.ID, s.PersonID, s.Description, s.Tag, i); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func writeCompanyErr(w http.ResponseWriter, err error) {
	if isDup(err) {
		msg := "já existe uma empresa com este CNPJ"
		if strings.Contains(err.Error(), "PRIMARY") {
			msg = "já existe uma empresa com este id"
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
		return
	}
	writeErr(w, err)
}

// GET /api/crm/companies (?archived=1&lifecycle=&q=&limit=&offset=) e POST.
func handleCompanies(w http.ResponseWriter, r *http.Request) {
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
			where += ` AND (name LIKE ? OR legalName LIKE ?)`
			args = append(args, like, like)
		}
		var total int
		if err := db.QueryRow(`SELECT COUNT(*) FROM Company WHERE `+where, args...).Scan(&total); err != nil {
			writeErr(w, err)
			return
		}
		pg := readPage(r)
		rows, err := db.Query(`SELECT `+companyCols+` FROM Company WHERE `+where+` ORDER BY COALESCE(createdAt, '1970-01-01 00:00:00') DESC, id LIMIT ? OFFSET ?`, append(args, pg.limit, pg.offset)...)
		if err != nil {
			writeErr(w, err)
			return
		}
		out := []CompanyDTO{}
		for rows.Next() {
			c, err := scanCompany(rows)
			if err != nil {
				rows.Close()
				writeErr(w, err)
				return
			}
			out = append(out, c)
		}
		rows.Close()
		if err := loadStakeholders(out); err != nil {
			writeErr(w, err)
			return
		}
		w.Header().Set("X-Total-Count", itoa(total))
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
		var c CompanyDTO
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if c.ID != "" && !idRe.MatchString(c.ID) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "id inválido"})
			return
		}
		if c.ID == "" {
			c.ID = wfID("c")
		}
		if err := validateCompany(&c); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := saveCompany(&c, false); err != nil {
			writeCompanyErr(w, err)
			return
		}
		got, err := getCompany(c.ID)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, got)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// GET um, PUT substitui (inclusive stakeholders; archivedAt nulo desarquiva), DELETE arquiva.
func handleCompanyByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		c, err := getCompany(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, c)
	case http.MethodPut:
		r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
		var c CompanyDTO
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		c.ID = id
		if err := validateCompany(&c); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := saveCompany(&c, true); err != nil {
			writeCompanyErr(w, err)
			return
		}
		got, err := getCompany(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, got)
	case http.MethodDelete:
		res, err := db.Exec(`UPDATE Company SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now(), time.Now(), id)
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
