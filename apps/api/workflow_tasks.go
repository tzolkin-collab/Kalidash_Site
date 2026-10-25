package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
)

// ---- tarefas (JSON espelha TaskItem de apps/admin/src/domain.ts) ----

type TaskDTO struct {
	ID         string  `json:"id"`
	Entity     string  `json:"entity"` // lead | person | company | opportunity | pipeline
	EntityID   string  `json:"entityId"`
	EntityName string  `json:"entityName"`
	Title      string  `json:"title"`
	Tag        string  `json:"tag"`
	Assignee   *string `json:"assignee,omitempty"` // texto (compatibilidade); assigneeMemberId manda quando vem
	// AssigneeMemberID: o responsável como pessoa da equipe (TeamMember.id), D36. Com ele o servidor resolve o nome
	// em `assignee` e o Vendedor passa a ver as tarefas atribuídas a ele.
	AssigneeMemberID *string    `json:"assigneeMemberId,omitempty"`
	DueAt            *time.Time `json:"dueAt,omitempty"`
	Done             bool       `json:"done"`
	DoneAt           *time.Time `json:"doneAt,omitempty"`
	Source           string     `json:"source"` // manual | passo | requisito
	RequirementID    *string    `json:"requirementId,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
}

var (
	entityKinds = map[string]bool{"lead": true, "person": true, "company": true, "opportunity": true, "pipeline": true}
	taskSources = map[string]bool{"manual": true, "passo": true, "requisito": true}
)

// validateTask normaliza e confere uma tarefa nova (POST).
func validateTask(t *TaskDTO) error {
	t.Title = strings.TrimSpace(t.Title)
	t.Tag = strings.TrimSpace(t.Tag)
	t.EntityName = strings.TrimSpace(t.EntityName)
	if t.Title == "" || len([]rune(t.Title)) > 255 {
		return errors.New("a tarefa precisa de um título de até 255 caracteres")
	}
	if len([]rune(t.Tag)) > 80 {
		return errors.New("tag longa demais")
	}
	if !entityKinds[t.Entity] {
		return errors.New("tipo de registro inválido")
	}
	if !idRe.MatchString(t.EntityID) {
		return errors.New("id do registro inválido")
	}
	if t.Source == "" {
		t.Source = "manual"
	}
	if !taskSources[t.Source] {
		return errors.New("origem da tarefa inválida")
	}
	if t.Assignee != nil && len([]rune(*t.Assignee)) > 120 {
		return errors.New("responsável longo demais")
	}
	return nil
}

// parseDT lê DATETIME vindo como texto. Sem parseTime no DSN o driver entrega "2006-01-02 15:04:05[.fff]";
// com parseTime=true o database/sql converte o time.Time em RFC3339 ("2006-01-02T15:04:05Z"). Aceita os
// dois, para a API não depender do DSN de cada ambiente. O driver grava time.Time em UTC (DSN sem loc=),
// então o texto sem fuso é lido em UTC; em local, uma máquina fora do UTC deslocaria todas as datas.
func parseDT(s string) time.Time {
	for _, layout := range []string{"2006-01-02 15:04:05.999999", "2006-01-02 15:04:05", time.RFC3339Nano} {
		if t, err := time.ParseInLocation(layout, s, time.UTC); err == nil {
			return t.UTC()
		}
	}
	return time.Time{}
}

const taskCols = `id, title, tag, source, entityKind, entityId, entityName, requirementId, assignee, dueAt, done, doneAt, createdAt, assigneeMemberId`

func scanTask(sc interface{ Scan(...any) error }) (TaskDTO, error) {
	var t TaskDTO
	var req, assignee, member sql.NullString
	var due, doneAt, created sql.NullString
	if err := sc.Scan(&t.ID, &t.Title, &t.Tag, &t.Source, &t.Entity, &t.EntityID, &t.EntityName, &req, &assignee, &due, &t.Done, &doneAt, &created, &member); err != nil {
		return t, err
	}
	t.CreatedAt = parseDT(created.String)
	if req.Valid {
		t.RequirementID = &req.String
	}
	if assignee.Valid {
		t.Assignee = &assignee.String
	}
	if member.Valid && member.String != "" {
		t.AssigneeMemberID = &member.String
	}
	if due.Valid {
		d := parseDT(due.String)
		t.DueAt = &d
	}
	if doneAt.Valid {
		d := parseDT(doneAt.String)
		t.DoneAt = &d
	}
	return t, nil
}

// taskEntityExists: o registro da tarefa existe (422 em entityId inventado). Lead, pessoa e empresa só existem
// para a API com CRM_API=1; sem ele não há como conferir e a tarefa passa (como antes).
func taskEntityExists(kind, id string) (bool, error) {
	var table string
	switch kind {
	case "opportunity":
		table = "Opportunity"
	case "pipeline":
		table = "Pipeline"
	case "lead":
		table = leadTbl
	case "person":
		table = "Contact"
	case "company":
		table = "Company"
	}
	if table == "" || (!crmEnabled() && (kind == "lead" || kind == "person" || kind == "company")) {
		return true, nil
	}
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE id = ?`, id).Scan(&n)
	return n > 0, err
}

// resolveAssignee aplica o responsável da equipe: o id precisa ser de uma pessoa ativa e, sem texto explícito, o nome
// dela vai para `assignee` (o texto segue existindo para quem ainda lê só ele).
func resolveAssignee(t *TaskDTO, textGiven bool) error {
	if t.AssigneeMemberID == nil || *t.AssigneeMemberID == "" {
		t.AssigneeMemberID = nil
		return nil
	}
	if err := checkOwnerMember(*t.AssigneeMemberID); err != nil {
		return err
	}
	if !textGiven {
		m, err := authDB.MemberByID(*t.AssigneeMemberID)
		if err != nil {
			return err
		}
		name := m.Name
		if name == "" {
			name = m.Email
		}
		t.Assignee = &name
	}
	return nil
}

func writeTaskErr(w http.ResponseWriter, err error) {
	if _, ok := err.(linkError); ok {
		writeLinkErr(w, err)
		return
	}
	writeErr(w, err)
}

// GET /api/tasks?entity=&entityId=&pipelineId=&done=0|1&assignee=  |  POST cria tarefa manual.
func handleTasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		q := `SELECT ` + taskCols + ` FROM Task WHERE 1=1`
		var args []any
		add := func(clause string, v string) {
			if v != "" {
				q += clause
				args = append(args, v)
			}
		}
		qs := r.URL.Query()
		add(` AND entityKind = ?`, qs.Get("entity"))
		add(` AND entityId = ?`, qs.Get("entityId"))
		add(` AND pipelineId = ?`, qs.Get("pipelineId"))
		add(` AND assignee = ?`, qs.Get("assignee"))
		switch qs.Get("done") {
		case "0":
			q += ` AND done = 0`
		case "1":
			q += ` AND done = 1`
		}
		if me, restricted := taskOwnRestriction(r); restricted { // D19: o Vendedor só vê as tarefas dele
			clause, own := taskOwnClause(me)
			q += ` AND ` + clause
			args = append(args, own...)
		}
		q += ` ORDER BY done, dueAt IS NULL, dueAt, createdAt DESC LIMIT 500`
		rows, err := db.Query(q, args...)
		if err != nil {
			writeErr(w, err)
			return
		}
		defer rows.Close()
		out := []TaskDTO{}
		for rows.Next() {
			t, err := scanTask(rows)
			if err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, t)
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		var t TaskDTO
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if err := validateTask(&t); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if exists, err := taskEntityExists(t.Entity, t.EntityID); err != nil {
			writeErr(w, err)
			return
		} else if !exists {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "o registro da tarefa não existe"})
			return
		}
		if !taskEntityAllowed(r, t.Entity, t.EntityID) { // D19: Vendedor não cria tarefa em registro de outro
			writeErr(w, errNotFound)
			return
		}
		if err := resolveAssignee(&t, t.Assignee != nil); err != nil {
			writeTaskErr(w, err)
			return
		}
		t.ID, t.Done, t.DoneAt, t.CreatedAt = wfID("task"), false, nil, time.Now()
		// Só tarefa de requisito carrega requirementId (o front gera as dos leads; as das oportunidades
		// nascem no gate do servidor). Ela é idempotente: a chave única (requisito, registro) devolve a
		// tarefa que já existe em vez de duplicar.
		if t.Source != "requisito" {
			t.RequirementID = nil
		} else if t.RequirementID != nil && !idRe.MatchString(*t.RequirementID) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "id de requisito inválido"})
			return
		}
		verb := "INSERT"
		if t.RequirementID != nil {
			verb = "INSERT IGNORE"
		}
		res, err := db.Exec(verb+` INTO Task (id, title, tag, source, entityKind, entityId, entityName, requirementId, assignee, assigneeMemberId, dueAt, done, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
			t.ID, t.Title, t.Tag, t.Source, t.Entity, t.EntityID, t.EntityName, t.RequirementID, t.Assignee, t.AssigneeMemberID, t.DueAt, t.CreatedAt)
		if err != nil {
			writeErr(w, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 && t.RequirementID != nil {
			existing, err := scanTask(db.QueryRow(`SELECT `+taskCols+` FROM Task WHERE requirementId = ? AND entityKind = ? AND entityId = ?`, *t.RequirementID, t.Entity, t.EntityID))
			if err != nil {
				writeErr(w, err)
				return
			}
			writeJSON(w, http.StatusOK, existing)
			return
		}
		writeJSON(w, http.StatusCreated, t)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// taskVisible: a tarefa existe e quem pede pode vê-la (o Vendedor só vê as dele; as dos outros são 404).
func taskVisible(r *http.Request, id string) (bool, error) {
	q, args := `SELECT COUNT(*) FROM Task WHERE id = ?`, []any{id}
	if me, restricted := taskOwnRestriction(r); restricted {
		clause, own := taskOwnClause(me)
		q += ` AND ` + clause
		args = append(args, own...)
	}
	var n int
	err := db.QueryRow(q, args...).Scan(&n)
	return n > 0, err
}

// PUT /api/tasks/{id}: concluir/reabrir e editar título, tag, responsável e prazo. Campo ausente mantém; `null`
// explícito limpa (tag, assignee, assigneeMemberId, dueAt). Concluir uma tarefa de requisito FIELD exige o campo
// preenchido no registro (fieldGap). DELETE remove tarefa manual e a órfã (a de um requisito que foi removido);
// a de requisito que existe fica (o gate depende dela).
func handleTaskByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	if r.Method == http.MethodPut || r.Method == http.MethodDelete {
		if ok, err := taskVisible(r, id); err != nil {
			writeErr(w, err)
			return
		} else if !ok {
			writeErr(w, errNotFound)
			return
		}
	}
	switch r.Method {
	case http.MethodPut:
		raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16<<10))
		var pr presence
		if err != nil || json.Unmarshal(raw, &pr) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		cur, err := scanTask(db.QueryRow(`SELECT `+taskCols+` FROM Task WHERE id = ?`, id))
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, errNotFound)
			return
		} else if err != nil {
			writeErr(w, err)
			return
		}
		isNull := func(k string) bool { return bytes.Equal(bytes.TrimSpace(pr[k]), []byte("null")) }
		bad := func(k string) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "campo inválido: " + k})
		}
		if pr.has("title") && !isNull("title") {
			if json.Unmarshal(pr["title"], &cur.Title) != nil {
				bad("title")
				return
			}
		}
		if pr.has("tag") {
			cur.Tag = ""
			if !isNull("tag") && json.Unmarshal(pr["tag"], &cur.Tag) != nil {
				bad("tag")
				return
			}
		}
		textGiven := false
		if pr.has("assignee") {
			cur.Assignee = nil
			if !isNull("assignee") {
				var s string
				if json.Unmarshal(pr["assignee"], &s) != nil {
					bad("assignee")
					return
				}
				cur.Assignee, textGiven = &s, true
			} else if !pr.has("assigneeMemberId") {
				cur.AssigneeMemberID = nil // limpar o responsável limpa também o vínculo com a equipe
			}
		}
		if pr.has("assigneeMemberId") {
			cur.AssigneeMemberID = nil
			if !isNull("assigneeMemberId") {
				var s string
				if json.Unmarshal(pr["assigneeMemberId"], &s) != nil {
					bad("assigneeMemberId")
					return
				}
				cur.AssigneeMemberID = &s
			} else if !pr.has("assignee") {
				cur.Assignee = nil
			}
			if err := resolveAssignee(&cur, textGiven || (pr.has("assignee") && isNull("assignee"))); err != nil {
				writeTaskErr(w, err)
				return
			}
		}
		if pr.has("dueAt") {
			cur.DueAt = nil
			if !isNull("dueAt") {
				var d time.Time
				if json.Unmarshal(pr["dueAt"], &d) != nil {
					bad("dueAt")
					return
				}
				cur.DueAt = &d
			}
		}
		if pr.has("done") && !isNull("done") {
			var done bool
			if json.Unmarshal(pr["done"], &done) != nil {
				bad("done")
				return
			}
			if done != cur.Done {
				if done && cur.RequirementID != nil {
					if msg, err := fieldGap(*cur.RequirementID, cur.Entity, cur.EntityID); err != nil {
						writeErr(w, err)
						return
					} else if msg != "" {
						writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": msg})
						return
					}
				}
				cur.Done = done
				if cur.Done {
					now := time.Now()
					cur.DoneAt = &now
				} else {
					cur.DoneAt = nil
				}
			}
		}
		if err := validateTask(&cur); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if _, err := db.Exec(`UPDATE Task SET title = ?, tag = ?, assignee = ?, assigneeMemberId = ?, dueAt = ?, done = ?, doneAt = ? WHERE id = ?`,
			cur.Title, cur.Tag, cur.Assignee, cur.AssigneeMemberID, cur.DueAt, cur.Done, cur.DoneAt, id); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, cur)
	case http.MethodDelete:
		var req sql.NullString
		err := db.QueryRow(`SELECT requirementId FROM Task WHERE id = ?`, id).Scan(&req)
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, errNotFound)
			return
		} else if err != nil {
			writeErr(w, err)
			return
		}
		if req.Valid {
			var n int
			if err := db.QueryRow(`SELECT COUNT(*) FROM StageRequirement WHERE id = ?`, req.String).Scan(&n); err != nil {
				writeErr(w, err)
				return
			}
			if n > 0 { // o requisito ainda existe: a tarefa é a trava do gate
				writeJSON(w, http.StatusConflict, map[string]string{"error": "tarefa criada por um requisito de etapa"})
				return
			}
		}
		if _, err := db.Exec(`DELETE FROM Task WHERE id = ?`, id); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
	}
}

// ---- gate (docs/notificacoes.md §4): a trava de etapa, também do lado da API ----

type gateReq struct {
	ID      string
	StageID string
	Gate    string
	Label   string
	Tag     string
}

// applicableGates: quais requisitos barram o movimento from→to. ENTER vale para a etapa de destino,
// EXIT para a de origem. Duas ou mais tarefas podem travar a mesma fronteira: todas precisam fechar.
func applicableGates(reqs []gateReq, from, to string) []gateReq {
	var out []gateReq
	for _, r := range reqs {
		if (r.Gate == "ENTER" && r.StageID == to) || (r.Gate == "EXIT" && r.StageID == from && from != "") {
			out = append(out, r)
		}
	}
	return out
}

type Blocker struct {
	RequirementID string `json:"requirementId"`
	Label         string `json:"label"`
	TaskID        string `json:"taskId"`
}

type gateInput struct {
	EntityKind  string `json:"entity"`
	EntityID    string `json:"entityId"`
	EntityName  string `json:"entityName"`
	FromStageID string `json:"fromStageId"`
	ToStageID   string `json:"toStageId"`
}

// checkGate devolve o que ainda trava o movimento from→to (vazio = pode mover). ENTER vale para a etapa de
// destino e EXIT para a de origem, mesmo que sejam de funis diferentes. Mover para a mesma etapa não passa por gate.
//
// attempt=true é a tentativa de mover: cria, se faltar, a tarefa de cada requisito que trava (INSERT IGNORE na
// chave única: seguro com chamadas simultâneas). attempt=false é consulta pura (sem nenhuma escrita): o requisito
// que ainda não tem tarefa volta como bloqueio com taskId vazio.
func checkGate(in gateInput, attempt bool) ([]Blocker, error) {
	if in.FromStageID == in.ToStageID {
		return nil, nil
	}
	rows, err := db.Query(`SELECT id, pipelineId, stageId, gate, label, tag, assignee, dueDays FROM StageRequirement WHERE gate <> 'NONE' AND (stageId = ? OR stageId = ?) ORDER BY pipelineId, position`, in.ToStageID, in.FromStageID)
	if err != nil {
		return nil, err
	}
	type full struct {
		gateReq
		pipelineID string
		assignee   sql.NullString
		dueDays    sql.NullInt64
	}
	var all []full
	var reqs []gateReq
	for rows.Next() {
		var f full
		if err := rows.Scan(&f.ID, &f.pipelineID, &f.StageID, &f.Gate, &f.Label, &f.Tag, &f.assignee, &f.dueDays); err != nil {
			rows.Close()
			return nil, err
		}
		all = append(all, f)
		reqs = append(reqs, f.gateReq)
	}
	rows.Close()

	applies := map[string]bool{}
	for _, r := range applicableGates(reqs, in.FromStageID, in.ToStageID) {
		applies[r.ID] = true
	}
	var blockers []Blocker
	for _, f := range all {
		if !applies[f.ID] {
			continue
		}
		if attempt {
			var due any
			if f.dueDays.Valid {
				due = time.Now().Add(time.Duration(f.dueDays.Int64) * 24 * time.Hour)
			}
			if _, err := db.Exec(`INSERT IGNORE INTO Task (id, title, tag, source, entityKind, entityId, entityName, pipelineId, requirementId, assignee, dueAt, done, createdAt) VALUES (?, ?, ?, 'requisito', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
				wfID("task"), f.Label, f.Tag, in.EntityKind, in.EntityID, in.EntityName, f.pipelineID, f.ID, f.assignee, due, time.Now()); err != nil {
				return nil, err
			}
		}
		var taskID string
		var done bool
		err := db.QueryRow(`SELECT id, done FROM Task WHERE requirementId = ? AND entityKind = ? AND entityId = ?`, f.ID, in.EntityKind, in.EntityID).Scan(&taskID, &done)
		if errors.Is(err, sql.ErrNoRows) {
			blockers = append(blockers, Blocker{RequirementID: f.ID, Label: f.Label}) // consulta: a tarefa ainda não existe
			continue
		} else if err != nil {
			return nil, err
		}
		if !done {
			blockers = append(blockers, Blocker{RequirementID: f.ID, Label: f.Label, TaskID: taskID})
		}
	}
	return blockers, nil
}

// gateForMove é o gate aplicado a /api/leads/move (tentativa: grava as tarefas que travam). toStage já vem
// resolvido por destStage. Vazio = pode mover (inclusive quando a etapa não pertence a nenhum funil).
func gateForMove(oppID, oppTitle, fromStage, toStage string) ([]Blocker, error) {
	if toStage == "" {
		return nil, nil
	}
	return checkGate(gateInput{EntityKind: "opportunity", EntityID: oppID, EntityName: oppTitle, FromStageID: fromStage, ToStageID: toStage}, true)
}

// POST /api/gate/check: o admin pergunta antes de mover; 200 com a lista (vazia = pode). É CONSULTA PURA: não
// cria tarefa (quem tem só tasks:read pode chamar). As tarefas nascem na tentativa de mover (/api/leads/move,
// PUT /api/crm/leads/{id}).
func handleGateCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	var in gateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || !entityKinds[in.EntityKind] || !idRe.MatchString(in.EntityID) || !idRe.MatchString(in.ToStageID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return
	}
	if !taskEntityAllowed(r, in.EntityKind, in.EntityID) {
		writeErr(w, errNotFound)
		return
	}
	blockers, err := checkGate(in, false)
	if err != nil {
		writeErr(w, err)
		return
	}
	if blockers == nil {
		blockers = []Blocker{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"blocked": len(blockers) > 0, "blockers": blockers})
}
