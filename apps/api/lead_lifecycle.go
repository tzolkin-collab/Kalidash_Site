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
)

// Ciclo de vida do lead (WP4-2, D20/D28/D33): qualificar de verdade no servidor e motivo de perda.
//
//   - POST /api/crm/leads/{id}/qualify cria a Opportunity, move as tarefas abertas e marca o lead QUALIFIED numa
//     transação só. Antes disto "Qualificar" só escrevia em memória no navegador e o lead apontava para uma
//     oportunidade que não existia (B-01 da auditoria).
//   - Motivo de perda: lista por funil em Pipeline.config.lostReasons (padrão abaixo). Obrigatório ao entrar em
//     etapa Perdida e ao descartar um lead; "Outro" exige a nota.

const otherLostReason = "Outro"

var defaultLostReasons = []string{"Sem orçamento", "Escolheu concorrente", "Sem resposta", "Sem fit", "Timing", otherLostReason}

// lostReasonActive: o motivo de perda da oportunidade mora em colunas do CRM e a lista no funil.
func lostReasonActive() bool { return crmEnabled() && workflowEnabled() }

// pipelineSettings é o pedaço da Pipeline.config que o ciclo de vida lê (a API a guarda como JSON opaco).
type pipelineSettings struct {
	LostReasons     []string `json:"lostReasons"`
	QualifyRequires []string `json:"qualifyRequires"`
}

func pipelineSettingsOf(pipelineID string) (pipelineSettings, error) {
	var s pipelineSettings
	if !workflowEnabled() || pipelineID == "" {
		return s, nil
	}
	var cfg []byte
	err := db.QueryRow(`SELECT config FROM Pipeline WHERE id = ?`, pipelineID).Scan(&cfg)
	if errors.Is(err, sql.ErrNoRows) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	if len(cfg) > 0 {
		_ = json.Unmarshal(cfg, &s) // config opaca: o que não for lista de textos vale como ausente
	}
	s.LostReasons = cleanStrings(s.LostReasons, 120)
	return s, nil
}

// lostReasonsOf devolve os motivos do funil, ou o padrão quando ele não definiu os seus.
func lostReasonsOf(pipelineID string) ([]string, error) {
	s, err := pipelineSettingsOf(pipelineID)
	if err != nil {
		return nil, err
	}
	if len(s.LostReasons) == 0 {
		return defaultLostReasons, nil
	}
	return s.LostReasons, nil
}

// checkLostReason confere motivo e nota contra a lista do funil e devolve os valores limpos.
// Erro de regra volta como linkError (422).
func checkLostReason(pipelineID, reason, note string) (string, string, error) {
	reason, note = clean(reason, 120), clean(note, 500)
	if reason == "" {
		return "", "", linkError("informe o motivo da perda")
	}
	list, err := lostReasonsOf(pipelineID)
	if err != nil {
		return "", "", err
	}
	ok := false
	for _, r := range list {
		if r == reason {
			ok = true
			break
		}
	}
	if !ok {
		return "", "", linkError("motivo fora da lista do funil (" + strings.Join(list, ", ") + ")")
	}
	if reason == otherLostReason && note == "" {
		return "", "", linkError("o motivo \"Outro\" exige uma nota explicando")
	}
	return reason, note, nil
}

// stageKindOf devolve o tipo da etapa ("" quando ela não existe).
func stageKindOf(stageID string) (string, error) {
	var k string
	err := db.QueryRow(`SELECT kind FROM PipelineStage WHERE id = ?`, stageID).Scan(&k)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return k, err
}

// ---- regras do lead no POST/PUT (crm_leads.go) ----

// leadLifecycleRules aplica as regras do WP4-2 ao corpo de um lead. cur == nil na criação.
//   - QUALIFIED só nasce em POST .../qualify; o PUT nunca grava essa situação nem troca convertedOpportunityId.
//   - DISCARDED exige motivo da lista do funil (e a nota, em "Outro") quando o descarte é novo ou o motivo mudou.
//   - Voltar a ACTIVE (restaurar) limpa motivo e nota.
func leadLifecycleRules(l *LeadDTO, cur *LeadDTO) error {
	l.DiscardNote = clean(l.DiscardNote, 500)
	if cur != nil && cur.Status == "QUALIFIED" {
		if l.Status != "QUALIFIED" {
			return linkError("um lead qualificado não volta a ser lead: a oportunidade já existe")
		}
		l.ConvertedOpportunityID, l.DiscardReason, l.DiscardNote = cur.ConvertedOpportunityID, "", ""
		return nil
	}
	if l.Status == "QUALIFIED" {
		return linkError("para qualificar use POST /api/crm/leads/{id}/qualify")
	}
	l.ConvertedOpportunityID = ""
	switch l.Status {
	case "DISCARDED":
		changed := cur == nil || cur.Status != "DISCARDED" || cur.DiscardReason != l.DiscardReason || cur.DiscardNote != l.DiscardNote
		if changed {
			reason, note, err := checkLostReason(l.PipelineID, l.DiscardReason, l.DiscardNote)
			if err != nil {
				return err
			}
			l.DiscardReason, l.DiscardNote = reason, note
		}
	default:
		l.DiscardReason, l.DiscardNote = "", ""
	}
	return nil
}

// logLeadStatusChange registra o descarte e a restauração no histórico (o servidor é quem sabe que aconteceu).
func logLeadStatusChange(r *http.Request, cur, got LeadDTO) {
	if cur.Status == got.Status {
		return
	}
	c := ChangeDTO{Actor: actorOf(r), Entity: "lead", EntityID: got.ID, EntityName: got.Name}
	switch {
	case got.Status == "DISCARDED":
		c.Kind, c.Note = "discard", "Motivo: "+got.DiscardReason
		if got.DiscardNote != "" {
			c.Note += ". " + got.DiscardNote
		}
	case cur.Status == "DISCARDED" && got.Status == "ACTIVE":
		c.Kind, c.Note = "restore", "Lead restaurado"
	default:
		return
	}
	writeChange(c)
}

// actorOf é o nome de quem fez a chamada (login ligado) ou "Equipe".
func actorOf(r *http.Request) string {
	if m, ok := principalOf(r); ok && m.Name != "" {
		return m.Name
	}
	return "Equipe"
}

// writeChange grava uma entrada de histórico fora de transação. Falha só vai ao log: o histórico não derruba a ação.
func writeChange(c ChangeDTO) {
	if err := validateChange(&c, time.Now()); err != nil {
		return
	}
	if _, err := saveChanges([]ChangeDTO{c}, ""); err != nil {
		fmt.Println("⚠️ histórico:", err)
	}
}

func insertChangeTx(tx *sql.Tx, c ChangeDTO) error {
	if err := validateChange(&c, time.Now()); err != nil {
		return err
	}
	_, err := tx.Exec(`INSERT INTO ChangeLog (id, at, actor, entity, entityId, entityName, kind, field, fromValue, toValue, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.At.Time, c.Actor, c.Entity, c.EntityID, c.EntityName, c.Kind, nullStr(c.Field), nullStr(c.From), nullStr(c.To), nullStr(c.Note))
	return err
}

// ---- POST /api/crm/leads/{id}/qualify ----

var qualifyLabels = map[string]string{"value": "valor estimado", "owner": "responsável"}

// missingForQualify: o que a configuração do funil (qualifyRequires) exige e o lead ainda não tem.
func missingForQualify(l LeadDTO, required []string) []string {
	var out []string
	for _, k := range required {
		switch k {
		case "value":
			if l.EstimatedValue == nil || *l.EstimatedValue <= 0 {
				out = append(out, k)
			}
		case "owner":
			if l.Owner == "" && l.OwnerID == "" {
				out = append(out, k)
			}
		}
	}
	return out
}

func qualifyConflict(w http.ResponseWriter, msg, oppID string) {
	body := map[string]any{"error": msg}
	if oppID != "" {
		body["opportunityId"] = oppID
	}
	writeJSON(w, http.StatusConflict, body)
}

func handleQualifyLead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
		return
	}
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	if !workflowEnabled() {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "qualificar exige WORKFLOW_API=1 (a oportunidade nasce numa etapa do funil)"})
		return
	}
	var body struct {
		Value   *float64 `json:"value"`
		Owner   *string  `json:"owner"`
		OwnerID *string  `json:"ownerId"`
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16<<10))
	if err != nil || (len(strings.TrimSpace(string(raw))) > 0 && json.Unmarshal(raw, &body) != nil) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
		return
	}

	lead, err := getLeadRecord(id)
	if err != nil {
		writeErr(w, err)
		return
	}
	me, restricted := ownRestriction(r, "leads", true)
	if restricted && lead.OwnerID != me {
		writeErr(w, errNotFound) // leads:own: o lead dos outros não existe para esta pessoa
		return
	}
	switch {
	case lead.Status == "QUALIFIED":
		qualifyConflict(w, "este lead já foi qualificado", lead.ConvertedOpportunityID)
		return
	case lead.Status == "DISCARDED":
		qualifyConflict(w, "este lead foi descartado: restaure antes de qualificar", "")
		return
	case lead.ArchivedAt != nil:
		qualifyConflict(w, "este lead está arquivado", "")
		return
	}

	// O que a chamada informa vale para este lead (como o "Qualificar" da tela, que pede valor e dono na hora).
	if body.Value != nil {
		v, ok := normalizeMoney(body.Value)
		if !ok {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "valor estimado inválido"})
			return
		}
		lead.EstimatedValue = v
	}
	if body.Owner != nil {
		lead.Owner = clean(*body.Owner, 120)
	}
	if body.OwnerID != nil && strings.TrimSpace(*body.OwnerID) != lead.OwnerID {
		if restricted {
			writeAuthErr(w, http.StatusForbidden, "falta a permissão leads:write para trocar o responsável")
			return
		}
		lead.OwnerID = strings.TrimSpace(*body.OwnerID)
		if lead.OwnerID != "" {
			if err := checkOwnerMember(lead.OwnerID); err != nil {
				writeLinkErr(w, err)
				return
			}
		}
	}

	pid, ok, err := stagePipeline(lead.StageID)
	if err != nil {
		writeErr(w, err)
		return
	}
	if !ok || pid != lead.PipelineID {
		writeLinkErr(w, linkError("a etapa do lead não existe no funil dele"))
		return
	}
	stages, err := stagesOf(lead.PipelineID)
	if err != nil {
		writeErr(w, err)
		return
	}
	firstOpen := ""
	for _, s := range stages {
		if s.Kind == "OPEN" {
			firstOpen = s.ID
			break
		}
	}
	if firstOpen == "" {
		writeLinkErr(w, linkError("o funil não tem etapa Aberta para receber a oportunidade"))
		return
	}

	cfg, err := pipelineSettingsOf(lead.PipelineID)
	if err != nil {
		writeErr(w, err)
		return
	}
	if missing := missingForQualify(lead, cfg.QualifyRequires); len(missing) > 0 {
		labels := make([]string, len(missing))
		for i, k := range missing {
			labels[i] = qualifyLabels[k]
		}
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "faltam campos para qualificar: " + strings.Join(labels, ", "), "missing": missing})
		return
	}
	// Gate de SAÍDA da etapa do lead (e de ENTRADA da primeira etapa aberta). Consulta pura: se barrar, nada é gravado.
	blockers, err := checkGate(gateInput{EntityKind: "lead", EntityID: lead.ID, EntityName: lead.Name, FromStageID: lead.StageID, ToStageID: firstOpen}, false)
	if err != nil {
		writeErr(w, err)
		return
	}
	if len(blockers) > 0 {
		writeGate409(w, blockers)
		return
	}

	oppID, moved, err := qualifyTx(r, lead, firstOpen)
	if errors.Is(err, errAlreadyQualified) {
		again, gerr := getLeadRecord(id) // outra chamada qualificou no meio: devolve a oportunidade dela
		if gerr != nil {
			writeErr(w, gerr)
			return
		}
		qualifyConflict(w, "este lead já foi qualificado", again.ConvertedOpportunityID)
		return
	}
	if err != nil {
		writeErr(w, err)
		return
	}
	got, err := getLeadRecord(id)
	if err != nil {
		writeErr(w, err)
		return
	}
	opp, err := getOpportunity(oppID)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"lead": got, "opportunity": opp, "movedTasks": moved})
}

var errAlreadyQualified = errors.New("lead já qualificado")

// qualifyTx é a gravação inteira: tudo ou nada. A troca ACTIVE→QUALIFIED é a primeira instrução e serve de trava:
// com duas chamadas simultâneas só uma muda a linha; a outra espera o commit, não muda nada e vira 409.
func qualifyTx(r *http.Request, lead LeadDTO, stageID string) (oppID string, moved int64, err error) {
	tx, err := db.Begin()
	if err != nil {
		return "", 0, err
	}
	defer tx.Rollback()
	now := time.Now()

	res, err := tx.Exec(`UPDATE `+leadTbl+` SET status = 'QUALIFIED', updatedAt = ? WHERE id = ? AND status = 'ACTIVE'`, now, lead.ID)
	if err != nil {
		return "", 0, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return "", 0, errAlreadyQualified
	}

	oppID = wfID("opp")
	tags, _ := json.Marshal(lead.Tags)
	if lead.Tags == nil {
		tags = []byte("[]")
	}
	cols := []string{"id", "title", "value", "stage", "priority", "tags", "createdAt", "updatedAt", "pipelineId", "contactId", "companyId", "ownerMemberId"}
	if _, err := tx.Exec(`INSERT INTO Opportunity (`+strings.Join(cols, ", ")+`) VALUES (?, ?, ?, ?, 'MEDIUM', ?, ?, ?, ?, ?, ?, ?)`,
		oppID, lead.Name, lead.EstimatedValue, stageID, tags, now, now, lead.PipelineID, nullStr(lead.PersonID), nullStr(lead.CompanyID), nullStr(lead.OwnerID)); err != nil {
		return "", 0, err
	}
	if _, err := tx.Exec(`UPDATE `+leadTbl+` SET convertedOpportunityId = ?, estimatedValue = ?, owner = ?, ownerMemberId = ?, wasSeen = 1, updatedAt = ? WHERE id = ?`,
		oppID, lead.EstimatedValue, nullStr(lead.Owner), nullStr(lead.OwnerID), now, lead.ID); err != nil {
		return "", 0, err
	}
	tr, err := tx.Exec(`UPDATE Task SET entityKind = 'opportunity', entityId = ?, entityName = ? WHERE entityKind = 'lead' AND entityId = ? AND done = 0`, oppID, lead.Name, lead.ID)
	if err != nil {
		return "", 0, err
	}
	moved, _ = tr.RowsAffected()
	if msg := strings.TrimSpace(lead.Message); msg != "" {
		if _, err := tx.Exec(`INSERT INTO Note (id, content, type, opportunityId, createdAt) VALUES (?, ?, 'NOTE', ?, ?)`, wfID("note"), "Mensagem do lead:\n"+msg, oppID, now); err != nil {
			return "", 0, err
		}
	}

	actor := actorOf(r)
	note := "Virou a oportunidade \"" + lead.Name + "\""
	if moved > 0 {
		note += fmt.Sprintf(". %d tarefa(s) foram junto.", moved)
	}
	if err := insertChangeTx(tx, ChangeDTO{Actor: actor, Entity: "lead", EntityID: lead.ID, EntityName: lead.Name, Kind: "qualify", Note: note}); err != nil {
		return "", 0, err
	}
	origin := "outbound"
	if lead.Origin == "INBOUND" {
		origin = "inbound"
	}
	if err := insertChangeTx(tx, ChangeDTO{Actor: actor, Entity: "opportunity", EntityID: oppID, EntityName: lead.Name, Kind: "create", Note: "Nasceu do lead " + lead.Name + " (" + origin + ")"}); err != nil {
		return "", 0, err
	}
	if err := tx.Commit(); err != nil {
		return "", 0, err
	}
	return oppID, moved, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// lostReasonForMove devolve o trecho do UPDATE (e os argumentos) que acerta o motivo de perda ao mover a
// oportunidade: entrar em etapa Perdida exige motivo da lista do funil; sair de uma Perdida limpa o motivo;
// continuar na mesma Perdida mantém o que está salvo (a não ser que venha um motivo novo, que então é validado).
func lostReasonForMove(toStage, fromStage, pipelineID, reason, note string) (set string, args []any, err error) {
	if toStage == "" {
		return "", nil, nil
	}
	kind, err := stageKindOf(toStage)
	if err != nil {
		return "", nil, err
	}
	if kind != "LOST" {
		return ", lostReason = NULL, lostReasonNote = NULL", nil, nil
	}
	if toStage == fromStage && strings.TrimSpace(reason) == "" {
		return "", nil, nil
	}
	r, n, err := checkLostReason(pipelineID, reason, note)
	if err != nil {
		return "", nil, err
	}
	return ", lostReason = ?, lostReasonNote = ?", []any{r, nullStr(n)}, nil
}
