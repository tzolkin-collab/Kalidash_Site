package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

// Leads (tabela Lead). JSON espelha Lead de apps/admin/src/domain.ts. Lead não é oportunidade:
// qualificar cria a oportunidade e marca o lead como QUALIFIED (convertedOpportunityId).

type LeadDTO struct {
	ID                     string         `json:"id"`
	Name                   string         `json:"name"`
	Email                  string         `json:"email"`
	Phone                  string         `json:"phone,omitempty"`
	PersonID               string         `json:"personId,omitempty"`
	CompanyID              string         `json:"companyId,omitempty"`
	PipelineID             string         `json:"pipelineId"`
	StageID                string         `json:"stageId"`
	Origin                 string         `json:"origin"`     // INBOUND | OUTBOUND
	SourceName             string         `json:"sourceName"` // inbound: a fonte; outbound: quem da equipe trouxe
	Owner                  string         `json:"owner,omitempty"`
	EstimatedValue         *float64       `json:"estimatedValue,omitempty"`
	ExpectedCloseAt        *FlexTime      `json:"expectedCloseAt,omitempty"`
	Tags                   []string       `json:"tags"`
	Message                string         `json:"message,omitempty"`
	Status                 string         `json:"status"` // ACTIVE | QUALIFIED | DISCARDED
	DiscardReason          string         `json:"discardReason,omitempty"`
	WasSeen                bool           `json:"wasSeen"`
	FirstContactAt         *FlexTime      `json:"firstContactAt,omitempty"`
	ConvertedOpportunityID string         `json:"convertedOpportunityId,omitempty"`
	ReturningClient        bool           `json:"returningClient,omitempty"`
	CustomData             map[string]any `json:"customData,omitempty"`
	ArchivedAt             *FlexTime      `json:"archivedAt,omitempty"`
	CreatedAt              *FlexTime      `json:"createdAt,omitempty"`
}

var (
	leadOrigins  = map[string]bool{"INBOUND": true, "OUTBOUND": true}
	leadStatuses = map[string]bool{"ACTIVE": true, "QUALIFIED": true, "DISCARDED": true}
)

func validateLeadRecord(l *LeadDTO) error {
	l.Name = clean(l.Name, 255)
	l.Email = strings.ToLower(clean(l.Email, 255))
	l.Phone = clean(l.Phone, 40)
	l.SourceName = clean(l.SourceName, 255)
	l.Owner = clean(l.Owner, 120)
	l.Message = clean(l.Message, 4000)
	l.DiscardReason = clean(l.DiscardReason, 255)
	l.Tags = cleanStrings(l.Tags, 60)
	if l.Name == "" {
		return errors.New("o lead precisa de um nome")
	}
	if l.Email != "" && !emailRe.MatchString(l.Email) {
		return errors.New("e-mail inválido")
	}
	if l.Email == "" && l.Phone == "" {
		return errors.New("informe ao menos um contato (e-mail ou telefone)")
	}
	for _, id := range []string{l.PersonID, l.CompanyID, l.ConvertedOpportunityID} {
		if id != "" && !idRe.MatchString(id) {
			return errors.New("id de vínculo inválido")
		}
	}
	if !idRe.MatchString(l.PipelineID) || !idRe.MatchString(l.StageID) {
		return errors.New("o lead precisa de funil e etapa")
	}
	if !leadOrigins[l.Origin] {
		return errors.New("origem inválida (INBOUND ou OUTBOUND)")
	}
	// Regra do domínio: todo lead tem uma fonte (inbound) ou um contato interno que o trouxe (outbound).
	if l.SourceName == "" {
		return errors.New("o lead precisa de uma fonte (inbound) ou de quem o trouxe (outbound)")
	}
	if l.Status == "" {
		l.Status = "ACTIVE"
	}
	if !leadStatuses[l.Status] {
		return errors.New("situação inválida")
	}
	v, ok := normalizeMoney(l.EstimatedValue)
	if !ok {
		return errors.New("valor estimado inválido")
	}
	l.EstimatedValue = v
	if len(l.Tags) > 30 {
		return errors.New("tags demais (máx. 30)")
	}
	if raw, _ := json.Marshal(l.CustomData); len(raw) > 64<<10 {
		return errors.New("campos personalizados passam de 64 KB")
	}
	return nil
}

// LEAD é palavra reservada no MySQL 8: sempre citada.
const leadTbl = "`Lead`"

const leadCols = `id, name, email, phone, personId, companyId, pipelineId, stageId, origin, sourceName, owner, estimatedValue, expectedCloseAt, tags, message, status, discardReason, wasSeen, firstContactAt, convertedOpportunityId, returningClient, customData, archivedAt, createdAt`

func scanLead(sc interface{ Scan(...any) error }) (LeadDTO, error) {
	var l LeadDTO
	var phone, person, company, owner, expected, message, discard, firstContact, converted, archived, created sql.NullString
	var value sql.NullFloat64
	var tags, custom []byte
	if err := sc.Scan(&l.ID, &l.Name, &l.Email, &phone, &person, &company, &l.PipelineID, &l.StageID, &l.Origin, &l.SourceName, &owner, &value, &expected, &tags, &message, &l.Status, &discard,
		&l.WasSeen, &firstContact, &converted, &l.ReturningClient, &custom, &archived, &created); err != nil {
		return l, err
	}
	l.Phone, l.PersonID, l.CompanyID, l.Owner, l.Message, l.DiscardReason, l.ConvertedOpportunityID = phone.String, person.String, company.String, owner.String, message.String, discard.String, converted.String
	if value.Valid {
		l.EstimatedValue = &value.Float64
	}
	l.ExpectedCloseAt, l.FirstContactAt, l.ArchivedAt, l.CreatedAt = flexFrom(expected.String), flexFrom(firstContact.String), flexFrom(archived.String), flexFrom(created.String)
	l.Tags = decodeJSON(tags, []string{})
	l.CustomData = decodeJSON(custom, map[string]any(nil))
	return l, nil
}

func saveLeadRecord(l *LeadDTO, replace bool) error {
	now := time.Now()
	if !replace {
		_, err := db.Exec(`INSERT INTO `+leadTbl+` (id, name, email, phone, personId, companyId, pipelineId, stageId, origin, sourceName, owner, estimatedValue, expectedCloseAt, tags, message, status, discardReason, wasSeen, firstContactAt, convertedOpportunityId, returningClient, customData, archivedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			l.ID, l.Name, l.Email, nullStr(l.Phone), nullStr(l.PersonID), nullStr(l.CompanyID), l.PipelineID, l.StageID, l.Origin, l.SourceName, nullStr(l.Owner), l.EstimatedValue, ptrTime(l.ExpectedCloseAt),
			jsonOrNull(l.Tags), nullStr(l.Message), l.Status, nullStr(l.DiscardReason), l.WasSeen, ptrTime(l.FirstContactAt), nullStr(l.ConvertedOpportunityID), l.ReturningClient, jsonOrNull(l.CustomData),
			ptrTime(l.ArchivedAt), now, now)
		return err
	}
	res, err := db.Exec(`UPDATE `+leadTbl+` SET name = ?, email = ?, phone = ?, personId = ?, companyId = ?, pipelineId = ?, stageId = ?, origin = ?, sourceName = ?, owner = ?, estimatedValue = ?, expectedCloseAt = ?, tags = ?, message = ?, status = ?, discardReason = ?, wasSeen = ?, firstContactAt = ?, convertedOpportunityId = ?, returningClient = ?, customData = ?, archivedAt = ?, updatedAt = ? WHERE id = ?`,
		l.Name, l.Email, nullStr(l.Phone), nullStr(l.PersonID), nullStr(l.CompanyID), l.PipelineID, l.StageID, l.Origin, l.SourceName, nullStr(l.Owner), l.EstimatedValue, ptrTime(l.ExpectedCloseAt),
		jsonOrNull(l.Tags), nullStr(l.Message), l.Status, nullStr(l.DiscardReason), l.WasSeen, ptrTime(l.FirstContactAt), nullStr(l.ConvertedOpportunityID), l.ReturningClient, jsonOrNull(l.CustomData),
		ptrTime(l.ArchivedAt), now, l.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		var k int
		if err := db.QueryRow(`SELECT COUNT(*) FROM `+leadTbl+` WHERE id = ?`, l.ID).Scan(&k); err != nil || k == 0 {
			return errNotFound
		}
	}
	return nil
}

func getLeadRecord(id string) (LeadDTO, error) {
	l, err := scanLead(db.QueryRow(`SELECT `+leadCols+` FROM `+leadTbl+` WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return l, errNotFound
	}
	return l, err
}

// GET /api/crm/leads (?pipelineId=&stageId=&status=&personId=&companyId=&archived=1&q=&limit=&offset=) e POST.
func handleCRMLeads(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		where, args := `1=1`, []any{}
		qs := r.URL.Query()
		if qs.Get("archived") != "1" {
			where += ` AND archivedAt IS NULL`
		}
		for _, f := range [][2]string{{"pipelineId", "pipelineId"}, {"stageId", "stageId"}, {"personId", "personId"}, {"companyId", "companyId"}} {
			if v := qs.Get(f[0]); v != "" {
				where += ` AND ` + f[1] + ` = ?`
				args = append(args, v)
			}
		}
		if v := qs.Get("status"); leadStatuses[v] {
			where += ` AND status = ?`
			args = append(args, v)
		}
		if q := strings.TrimSpace(qs.Get("q")); q != "" {
			like := "%" + strings.ReplaceAll(strings.ReplaceAll(q, "%", ""), "_", "") + "%"
			where += ` AND (name LIKE ? OR email LIKE ?)`
			args = append(args, like, like)
		}
		var total int
		if err := db.QueryRow(`SELECT COUNT(*) FROM `+leadTbl+` WHERE `+where, args...).Scan(&total); err != nil {
			writeErr(w, err)
			return
		}
		pg := readPage(r)
		rows, err := db.Query(`SELECT `+leadCols+` FROM `+leadTbl+` WHERE `+where+` ORDER BY createdAt DESC, id LIMIT ? OFFSET ?`, append(args, pg.limit, pg.offset)...)
		if err != nil {
			writeErr(w, err)
			return
		}
		defer rows.Close()
		out := []LeadDTO{}
		for rows.Next() {
			l, err := scanLead(rows)
			if err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, l)
		}
		w.Header().Set("X-Total-Count", itoa(total))
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
		var l LeadDTO
		if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if l.ID != "" && !idRe.MatchString(l.ID) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "id inválido"})
			return
		}
		if l.ID == "" {
			l.ID = wfID("l")
		}
		if err := validateLeadRecord(&l); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := saveLeadRecord(&l, false); err != nil {
			if isDup(err) {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "já existe um lead com este id"})
				return
			}
			writeErr(w, err)
			return
		}
		got, err := getLeadRecord(l.ID)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, got)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// GET um, PUT substitui (mover de etapa, qualificar e descartar passam por aqui; archivedAt nulo
// desarquiva), DELETE arquiva.
func handleCRMLeadByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		l, err := getLeadRecord(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, l)
	case http.MethodPut:
		r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
		var l LeadDTO
		if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		l.ID = id
		if err := validateLeadRecord(&l); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := saveLeadRecord(&l, true); err != nil {
			writeErr(w, err)
			return
		}
		got, err := getLeadRecord(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, got)
	case http.MethodDelete:
		res, err := db.Exec(`UPDATE `+leadTbl+` SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now(), time.Now(), id)
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
