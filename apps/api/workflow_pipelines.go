package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

// ---- tipos (o JSON espelha apps/admin/src/domain.ts: Pipeline, Stage, Requirement) ----

type PStage struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Kind        string `json:"kind"` // LEAD | OPEN | WON | LOST
	Color       string `json:"color"`
	Probability *int   `json:"probability,omitempty"`
	AlertDays   *int   `json:"alertDays,omitempty"`
}

type PRequirement struct {
	ID                 string  `json:"id"`
	StageID            string  `json:"stageId"`
	Label              string  `json:"label"`
	Tag                string  `json:"tag"`
	Kind               string  `json:"kind"` // FIELD | ACTION
	Gate               string  `json:"gate"` // NONE | ENTER | EXIT
	Assignee           *string `json:"assignee,omitempty"`
	DueDays            *int    `json:"dueDays,omitempty"`
	Blocked            int     `json:"blocked"` // calculado: tarefas abertas que travam
	Overdue            int     `json:"overdue"` // calculado: tarefas abertas com prazo vencido
	NotifyAssignee     bool    `json:"notifyAssignee,omitempty"`
	LinkedAutomationID *string `json:"linkedAutomationId,omitempty"`
}

// pipelineConfig guarda o que ainda não tem tabela própria. Os campos são opacos para a API
// (validados só como JSON e por tamanho); quem os entende é o admin.
type pipelineConfig struct {
	Sources            json.RawMessage `json:"sources,omitempty"`
	CustomFields       json.RawMessage `json:"customFields,omitempty"`
	TaskTags           json.RawMessage `json:"taskTags,omitempty"`
	QualifyRequires    json.RawMessage `json:"qualifyRequires,omitempty"`
	Steps              json.RawMessage `json:"steps,omitempty"`
	TemplateID         json.RawMessage `json:"templateId,omitempty"`
	PostSaleTemplateID json.RawMessage `json:"postSaleTemplateId,omitempty"`
}

type PipelineDTO struct {
	ID           string             `json:"id"`
	Name         string             `json:"name"`
	Offer        string             `json:"offer"`
	Position     int                `json:"position"`
	ArchivedAt   *time.Time         `json:"archivedAt,omitempty"`
	Stages       []PStage           `json:"stages"`
	Requirements []PRequirement     `json:"requirements"`
	Counts       map[string]int     `json:"counts"`
	Values       map[string]float64 `json:"values"`
	pipelineConfig
}

// ---- validação (pura, testável) ----

var (
	idRe       = regexp.MustCompile(`^[A-Za-z0-9:_.-]{1,128}$`)
	stageKinds = map[string]bool{"LEAD": true, "OPEN": true, "WON": true, "LOST": true}
	reqKinds   = map[string]bool{"FIELD": true, "ACTION": true}
	gates      = map[string]bool{"NONE": true, "ENTER": true, "EXIT": true}
)

const (
	maxStages   = 40
	maxReqs     = 200
	maxConfigKB = 256
)

// validatePipeline confere o funil inteiro e completa o que faltar (gate vazio vira NONE).
func validatePipeline(p *PipelineDTO) error {
	p.Name = strings.TrimSpace(p.Name)
	p.Offer = strings.TrimSpace(p.Offer)
	if p.Name == "" || len([]rune(p.Name)) > 160 {
		return errors.New("o funil precisa de um nome de até 160 caracteres")
	}
	if len([]rune(p.Offer)) > 160 {
		return errors.New("a oferta passa de 160 caracteres")
	}
	if len(p.Stages) == 0 || len(p.Stages) > maxStages {
		return fmt.Errorf("o funil precisa de 1 a %d etapas", maxStages)
	}
	seen := map[string]bool{}
	for i := range p.Stages {
		s := &p.Stages[i]
		s.Name = strings.TrimSpace(s.Name)
		if s.ID != "" && !idRe.MatchString(s.ID) {
			return fmt.Errorf("id de etapa inválido: %q", s.ID)
		}
		if s.ID != "" {
			if seen[s.ID] {
				return fmt.Errorf("etapa repetida: %q", s.ID)
			}
			seen[s.ID] = true
		}
		if s.Name == "" || len([]rune(s.Name)) > 120 {
			return errors.New("toda etapa precisa de um nome de até 120 caracteres")
		}
		if !stageKinds[s.Kind] {
			return fmt.Errorf("tipo de etapa inválido: %q", s.Kind)
		}
		if s.Probability != nil && (*s.Probability < 0 || *s.Probability > 100) {
			return errors.New("a probabilidade da etapa vai de 0 a 100")
		}
		if s.AlertDays != nil && (*s.AlertDays < 0 || *s.AlertDays > 3650) {
			return errors.New("dias de alerta inválidos")
		}
		if len(s.Color) > 16 {
			return errors.New("cor inválida")
		}
	}
	if len(p.Requirements) > maxReqs {
		return fmt.Errorf("no máximo %d requisitos por funil", maxReqs)
	}
	seenReq := map[string]bool{}
	for i := range p.Requirements {
		r := &p.Requirements[i]
		r.Label = strings.TrimSpace(r.Label)
		if r.ID != "" && !idRe.MatchString(r.ID) {
			return fmt.Errorf("id de requisito inválido: %q", r.ID)
		}
		if r.ID != "" {
			if seenReq[r.ID] {
				return fmt.Errorf("requisito repetido: %q", r.ID)
			}
			seenReq[r.ID] = true
		}
		if r.Label == "" || len([]rune(r.Label)) > 200 {
			return errors.New("todo requisito precisa de um título de até 200 caracteres")
		}
		if !reqKinds[r.Kind] {
			return fmt.Errorf("tipo de requisito inválido: %q", r.Kind)
		}
		if r.Gate == "" {
			r.Gate = "NONE"
		}
		if !gates[r.Gate] {
			return fmt.Errorf("gate inválido: %q", r.Gate)
		}
		if r.DueDays != nil && (*r.DueDays < 0 || *r.DueDays > 3650) {
			return errors.New("prazo do requisito inválido")
		}
		if len(r.Tag) > 80 {
			return errors.New("tag longa demais")
		}
		if !seen[r.StageID] {
			return fmt.Errorf("o requisito %q aponta para uma etapa que não existe", r.Label)
		}
	}
	raw, _ := json.Marshal(p.pipelineConfig)
	if len(raw) > maxConfigKB<<10 {
		return fmt.Errorf("configuração do funil passa de %d KB", maxConfigKB)
	}
	return nil
}

// fillIDs gera os ids que o cliente não mandou (funil novo criado pelo admin).
func fillIDs(p *PipelineDTO) {
	if p.ID == "" {
		p.ID = wfID("pl")
	}
	for i := range p.Stages {
		if p.Stages[i].ID == "" {
			p.Stages[i].ID = p.ID + ":" + wfID("st")
		}
	}
	for i := range p.Requirements {
		if p.Requirements[i].ID == "" {
			p.Requirements[i].ID = p.ID + ":" + wfID("rq")
		}
	}
}

// ---- leitura ----

// loadPipelines devolve os funis (ativos, ou todos com includeArchived) já com etapas, requisitos,
// contagens/valores por etapa (de Opportunity) e blocked/overdue por requisito (de Task).
func loadPipelines(id string, includeArchived bool) ([]PipelineDTO, error) {
	q := `SELECT id, name, offer, position, config, archivedAt FROM Pipeline WHERE 1=1`
	var args []any
	if id != "" {
		q += ` AND id = ?`
		args = append(args, id)
	}
	if !includeArchived && id == "" {
		q += ` AND archivedAt IS NULL`
	}
	q += ` ORDER BY position, createdAt`
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PipelineDTO{}
	index := map[string]int{}
	for rows.Next() {
		var p PipelineDTO
		var cfg []byte
		var archived sql.NullString
		if err := rows.Scan(&p.ID, &p.Name, &p.Offer, &p.Position, &cfg, &archived); err != nil {
			return nil, err
		}
		if len(cfg) > 0 {
			_ = json.Unmarshal(cfg, &p.pipelineConfig)
		}
		if archived.Valid {
			if t, err := time.Parse("2006-01-02 15:04:05", archived.String); err == nil {
				p.ArchivedAt = &t
			}
		}
		p.Stages, p.Requirements = []PStage{}, []PRequirement{}
		p.Counts, p.Values = map[string]int{}, map[string]float64{}
		index[p.ID] = len(out)
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return out, nil
	}

	stageRows, err := db.Query(`SELECT id, pipelineId, name, kind, color, probability, alertDays FROM PipelineStage ORDER BY pipelineId, position`)
	if err != nil {
		return nil, err
	}
	defer stageRows.Close()
	for stageRows.Next() {
		var s PStage
		var pid string
		var prob, alert sql.NullInt64
		if err := stageRows.Scan(&s.ID, &pid, &s.Name, &s.Kind, &s.Color, &prob, &alert); err != nil {
			return nil, err
		}
		if i, ok := index[pid]; ok {
			if prob.Valid {
				v := int(prob.Int64)
				s.Probability = &v
			}
			if alert.Valid {
				v := int(alert.Int64)
				s.AlertDays = &v
			}
			out[i].Stages = append(out[i].Stages, s)
		}
	}

	reqRows, err := db.Query(`SELECT id, pipelineId, stageId, label, tag, kind, gate, assignee, dueDays, notifyAssignee, linkedAutomationId FROM StageRequirement ORDER BY pipelineId, stageId, position`)
	if err != nil {
		return nil, err
	}
	defer reqRows.Close()
	reqIdx := map[string][2]int{}
	for reqRows.Next() {
		var r PRequirement
		var pid string
		var assignee, linked sql.NullString
		var due sql.NullInt64
		var notify bool
		if err := reqRows.Scan(&r.ID, &pid, &r.StageID, &r.Label, &r.Tag, &r.Kind, &r.Gate, &assignee, &due, &notify, &linked); err != nil {
			return nil, err
		}
		i, ok := index[pid]
		if !ok {
			continue
		}
		if assignee.Valid {
			r.Assignee = &assignee.String
		}
		if linked.Valid {
			r.LinkedAutomationID = &linked.String
		}
		if due.Valid {
			v := int(due.Int64)
			r.DueDays = &v
		}
		r.NotifyAssignee = notify
		reqIdx[r.ID] = [2]int{i, len(out[i].Requirements)}
		out[i].Requirements = append(out[i].Requirements, r)
	}

	// blocked/overdue por requisito
	taskRows, err := db.Query(`SELECT requirementId, COUNT(*), SUM(dueAt IS NOT NULL AND dueAt < ?) FROM Task WHERE requirementId IS NOT NULL AND done = 0 GROUP BY requirementId`, time.Now())
	if err != nil {
		return nil, err
	}
	defer taskRows.Close()
	for taskRows.Next() {
		var rid string
		var open, overdue int
		if err := taskRows.Scan(&rid, &open, &overdue); err != nil {
			return nil, err
		}
		if loc, ok := reqIdx[rid]; ok {
			r := &out[loc[0]].Requirements[loc[1]]
			r.Overdue = overdue
			if r.Gate != "NONE" {
				r.Blocked = open
			}
		}
	}

	// contagem e valor por etapa (oportunidades; leads não entram)
	cntRows, err := db.Query(`SELECT stage, COUNT(*), COALESCE(SUM(value), 0) FROM Opportunity GROUP BY stage`)
	if err != nil {
		return nil, err
	}
	defer cntRows.Close()
	byStage := map[string][2]float64{}
	for cntRows.Next() {
		var st string
		var n int
		var v float64
		if err := cntRows.Scan(&st, &n, &v); err != nil {
			return nil, err
		}
		byStage[st] = [2]float64{float64(n), v}
	}
	for i := range out {
		for _, s := range out[i].Stages {
			if c, ok := byStage[s.ID]; ok {
				out[i].Counts[s.ID] = int(c[0])
				out[i].Values[s.ID] = c[1]
			}
		}
	}
	return out, nil
}

// ---- escrita ----

// writePipeline grava o funil inteiro (metadados, etapas e requisitos) numa transação. Em `replace`
// ele já existe: etapas removidas só passam se nenhuma oportunidade estiver nelas.
func writePipeline(p *PipelineDTO, replace bool) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	cfg, _ := json.Marshal(p.pipelineConfig)
	now := time.Now()
	if replace {
		res, err := tx.Exec(`UPDATE Pipeline SET name = ?, offer = ?, position = ?, config = ?, updatedAt = ? WHERE id = ?`, p.Name, p.Offer, p.Position, cfg, now, p.ID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			var exists int
			if err := tx.QueryRow(`SELECT COUNT(*) FROM Pipeline WHERE id = ?`, p.ID).Scan(&exists); err != nil || exists == 0 {
				return errNotFound
			}
		}
		// etapas que estão saindo não podem ter oportunidades
		keep := map[string]bool{}
		for _, s := range p.Stages {
			keep[s.ID] = true
		}
		rows, err := tx.Query(`SELECT id FROM PipelineStage WHERE pipelineId = ?`, p.ID)
		if err != nil {
			return err
		}
		var removed []string
		for rows.Next() {
			var sid string
			if err := rows.Scan(&sid); err != nil {
				rows.Close()
				return err
			}
			if !keep[sid] {
				removed = append(removed, sid)
			}
		}
		rows.Close()
		for _, sid := range removed {
			var n int
			if err := tx.QueryRow(`SELECT COUNT(*) FROM Opportunity WHERE stage = ?`, sid).Scan(&n); err != nil {
				return err
			}
			if n > 0 {
				return fmt.Errorf("%w: a etapa %q ainda tem %d oportunidade(s); mova-as antes de removê-la", errConflict, sid, n)
			}
		}
		if _, err := tx.Exec(`DELETE FROM StageRequirement WHERE pipelineId = ?`, p.ID); err != nil {
			return err
		}
		if _, err := tx.Exec(`DELETE FROM PipelineStage WHERE pipelineId = ?`, p.ID); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec(`INSERT INTO Pipeline (id, name, offer, position, config, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`, p.ID, p.Name, p.Offer, p.Position, cfg, now, now); err != nil {
			return err
		}
	}

	for i, s := range p.Stages {
		if _, err := tx.Exec(`INSERT INTO PipelineStage (id, pipelineId, name, kind, position, color, probability, alertDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			s.ID, p.ID, s.Name, s.Kind, i, s.Color, s.Probability, s.AlertDays); err != nil {
			return err
		}
	}
	for i, r := range p.Requirements {
		if _, err := tx.Exec(`INSERT INTO StageRequirement (id, pipelineId, stageId, label, tag, kind, gate, assignee, dueDays, notifyAssignee, linkedAutomationId, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			r.ID, p.ID, r.StageID, r.Label, r.Tag, r.Kind, r.Gate, r.Assignee, r.DueDays, r.NotifyAssignee, r.LinkedAutomationID, i); err != nil {
			return err
		}
	}
	return tx.Commit()
}

var (
	errNotFound = errors.New("não encontrado")
	errConflict = errors.New("conflito")
)

func readPipelineBody(w http.ResponseWriter, r *http.Request) (*PipelineDTO, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, (maxConfigKB+256)<<10)
	var p PipelineDTO
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return nil, false
	}
	return &p, true
}

func writeErr(w http.ResponseWriter, err error) {
	var my *mysql.MySQLError
	switch {
	case errors.As(err, &my) && my.Number == 1062: // chave duplicada (ex.: id de funil que já existe)
		writeJSON(w, http.StatusConflict, map[string]string{"error": "já existe um registro com este id"})
	case errors.Is(err, errNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "não encontrado"})
	case errors.Is(err, errConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
	default:
		log.Println("❌ workflow:", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "erro interno"})
	}
}

// GET lista, POST cria.
func handlePipelines(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := loadPipelines("", r.URL.Query().Get("archived") == "1")
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	case http.MethodPost:
		p, ok := readPipelineBody(w, r)
		if !ok {
			return
		}
		if p.ID != "" && !idRe.MatchString(p.ID) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "id de funil inválido"})
			return
		}
		fillIDs(p)
		if err := validatePipeline(p); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := writePipeline(p, false); err != nil {
			writeErr(w, err)
			return
		}
		list, err := loadPipelines(p.ID, true)
		if err != nil || len(list) == 0 {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, list[0])
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// GET um, PUT substitui o funil inteiro, DELETE arquiva (nunca apaga: há oportunidades e tarefas penduradas).
func handlePipelineByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		list, err := loadPipelines(id, true)
		if err != nil {
			writeErr(w, err)
			return
		}
		if len(list) == 0 {
			writeErr(w, errNotFound)
			return
		}
		writeJSON(w, http.StatusOK, list[0])
	case http.MethodPut:
		p, ok := readPipelineBody(w, r)
		if !ok {
			return
		}
		p.ID = id
		fillIDs(p)
		if err := validatePipeline(p); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := writePipeline(p, true); err != nil {
			writeErr(w, err)
			return
		}
		list, err := loadPipelines(id, true)
		if err != nil || len(list) == 0 {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list[0])
	case http.MethodDelete:
		res, err := db.Exec(`UPDATE Pipeline SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now(), time.Now(), id)
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
