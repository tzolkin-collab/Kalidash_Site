package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Oportunidades (tabela antiga Opportunity) ligadas ao CRM v2 e à equipe (WP3b, D10 e D4).
//
//   - contactId e companyId apontam para Contact e Company, que SÃO as tabelas de Pessoa e Empresa do CRM v2
//     (o CRM só acrescentou colunas a elas), então o vínculo já é o do CRM; esta rota passa a gravá-lo e a conferir
//     que a pessoa/empresa existe e não está arquivada.
//   - ownerMemberId (coluna nova, só com CRM_API=1) guarda o responsável como pessoa da EQUIPE (TeamMember). A coluna
//     antiga ownerId aponta para a tabela User do Prisma (com chave estrangeira), que não é a equipe do login, então
//     não serve para isso. Quem já tem ownerId continua vendo o nome que tinha enquanto não houver ownerMemberId.
//   - prioridade e tags (D9) já eram gravadas pelo PUT desde o WP-B; a ficha agora as edita.
//
// Sem CRM_API=1 e sem AUTH_API=1 nada disto muda: as consultas não citam coluna nem tabela que só existe com as flags.

// oppQuery monta o SELECT das oportunidades. where começa com " WHERE …" ou é vazio.
func oppQuery(where string) string {
	ownerMember, ownerName, ownerAvatar, join := "NULL", "u.name", "u.avatarUrl", ""
	lostReason, lostNote := "NULL", "NULL"
	if crmEnabled() {
		ownerMember = "o.ownerMemberId"
		lostReason, lostNote = "o.lostReason", "o.lostReasonNote" // colunas do CRM (crm_schema.go)
		if authEnabled() {
			ownerName, ownerAvatar = "COALESCE(NULLIF(tm.name, ''), tm.email, u.name)", "COALESCE(NULLIF(tm.avatarUrl, ''), u.avatarUrl)"
			join = " LEFT JOIN TeamMember tm ON tm.id = o.ownerMemberId"
		}
	}
	return `SELECT o.id, o.title, o.value, o.stage, o.priority, o.tags, o.createdAt, o.wonAt,
			o.companyId, c.name, c.logoUrl,
			o.contactId, p.name, p.avatarUrl,
			o.ownerId, ` + ownerName + `, ` + ownerAvatar + `, ` + ownerMember + `, ` + lostReason + `, ` + lostNote + `
		FROM Opportunity o
		LEFT JOIN Company c ON o.companyId = c.id
		LEFT JOIN Contact p ON o.contactId = p.id
		LEFT JOIN User u ON o.ownerId = u.id` + join + where + ` ORDER BY o.createdAt DESC`
}

func scanOpportunity(sc interface{ Scan(...any) error }) (Opportunity, error) {
	var o Opportunity
	var tagsJSON []byte
	var createdAt string
	var wonAt sql.NullString
	if err := sc.Scan(
		&o.ID, &o.Title, &o.Value, &o.Stage, &o.Priority, &tagsJSON, &createdAt, &wonAt,
		&o.CompanyID, &o.CompanyName, &o.CompanyLogo,
		&o.ContactID, &o.ContactName, &o.ContactAvatar,
		&o.OwnerID, &o.OwnerName, &o.OwnerAvatar, &o.OwnerMemberID, &o.LostReason, &o.LostReasonNote,
	); err != nil {
		return o, err
	}
	if tagsJSON != nil {
		json.Unmarshal(tagsJSON, &o.Tags)
	}
	o.CreatedAt = parseDT(createdAt)
	if wonAt.Valid {
		if t := parseDT(wonAt.String); !t.IsZero() {
			o.WonAt = &t
		}
	}
	return o, nil
}

func getOpportunity(id string) (Opportunity, error) {
	o, err := scanOpportunity(db.QueryRow(oppQuery(` WHERE o.id = ?`), id))
	if err == sql.ErrNoRows {
		return o, errNotFound
	}
	return o, err
}

func listOpportunities(w http.ResponseWriter, r *http.Request) {
	where, args := "", []any{}
	if owner, restricted := ownRestriction(r, "opportunities", false); restricted {
		where, args = ` WHERE o.ownerMemberId = ?`, []any{owner}
	}
	rows, err := db.Query(oppQuery(where), args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	opps := []Opportunity{}
	for rows.Next() {
		o, err := scanOpportunity(rows)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		opps = append(opps, o)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(opps)
}

// linkError é um vínculo recusado (vira 422 com a mensagem para quem editou a ficha).
type linkError string

func (e linkError) Error() string { return string(e) }

// checkContactLink confere que a pessoa existe (e, com o CRM ligado, que não está arquivada).
func checkContactLink(table, id string) error {
	if !idRe.MatchString(id) {
		return linkError("id de vínculo inválido")
	}
	q := `SELECT COUNT(*) FROM ` + table + ` WHERE id = ?`
	if crmEnabled() {
		q += ` AND archivedAt IS NULL`
	}
	var n int
	if err := db.QueryRow(q, id).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		if table == "Contact" {
			return linkError("a pessoa escolhida não existe ou está arquivada")
		}
		return linkError("a empresa escolhida não existe ou está arquivada")
	}
	return nil
}

// checkOwnerMember: o responsável é uma pessoa ativa da equipe. Exige o login ligado (a tabela é dele).
func checkOwnerMember(id string) error {
	if !authEnabled() {
		return linkError("o responsável exige o login ligado (AUTH_API=1)")
	}
	if !idRe.MatchString(id) {
		return linkError("id de responsável inválido")
	}
	m, err := authDB.MemberByID(id)
	if err != nil || !m.Active {
		return linkError("o responsável precisa ser uma pessoa ativa da equipe")
	}
	return nil
}

// checkOppOwner: o responsável da oportunidade mora na coluna ownerMemberId, que só existe com CRM_API=1.
func checkOppOwner(id string) error {
	if !crmEnabled() {
		return linkError("o responsável exige CRM_API=1")
	}
	return checkOwnerMember(id)
}

// oppOwner devolve o responsável atual e se a oportunidade existe.
func oppOwner(id string) (owner string, found bool, err error) {
	if !crmEnabled() {
		var n int
		err = db.QueryRow(`SELECT COUNT(*) FROM Opportunity WHERE id = ?`, id).Scan(&n)
		return "", n > 0, err
	}
	var o sql.NullString
	err = db.QueryRow(`SELECT ownerMemberId FROM Opportunity WHERE id = ?`, id).Scan(&o)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	return o.String, err == nil, err
}

func writeLinkErr(w http.ResponseWriter, err error) {
	if le, ok := err.(linkError); ok {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": string(le)})
		return
	}
	http.Error(w, err.Error(), http.StatusInternalServerError)
}

// presence: quais campos vieram no corpo (null ou "" limpam o vínculo; ausente mantém).
type presence map[string]json.RawMessage

func (p presence) has(k string) bool { _, ok := p[k]; return ok }

// linkValue devolve o valor do campo de vínculo: "" quando veio null/vazio.
func (p presence) linkValue(k string) string {
	var s *string
	if json.Unmarshal(p[k], &s) != nil || s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

func createOpportunity(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 128<<10))
	var newOpp Opportunity
	if err != nil || json.Unmarshal(raw, &newOpp) != nil {
		http.Error(w, "corpo inválido", http.StatusBadRequest)
		return
	}
	var pr presence
	json.Unmarshal(raw, &pr)
	v, ok := normalizeMoney(newOpp.Value)
	if !ok {
		http.Error(w, "Valor inválido", http.StatusBadRequest)
		return
	}
	newOpp.Value = v
	newOpp.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	newOpp.CreatedAt = time.Now()
	tagsJSON, _ := json.Marshal(newOpp.Tags)
	if newOpp.Priority == "" {
		newOpp.Priority = "MEDIUM"
	}

	cols, vals := []string{"id", "title", "value", "stage", "priority", "tags", "createdAt", "updatedAt"},
		[]any{newOpp.ID, newOpp.Title, newOpp.Value, newOpp.Stage, newOpp.Priority, tagsJSON, newOpp.CreatedAt, newOpp.CreatedAt}
	add := func(col string, val any) { cols, vals = append(cols, col), append(vals, val) }
	if workflowEnabled() {
		// WP4-1: nasce só em etapa que existe (422) e que o gate deixa entrar (409 com o que falta; é consulta,
		// nenhuma tarefa nasce para uma oportunidade que não foi criada). Grava o funil.
		gateStage, pid, err := destStage(newOpp.Stage, "")
		if err != nil {
			writeLinkErr(w, err)
			return
		}
		blockers, err := checkGate(gateInput{EntityKind: "opportunity", EntityID: newOpp.ID, EntityName: newOpp.Title, ToStageID: gateStage}, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if len(blockers) > 0 {
			writeGate409(w, blockers)
			return
		}
		if pid != "" {
			add("pipelineId", pid)
		}
		if lostReasonActive() && gateStage != "" { // WP4-2: nascer já Perdida também pede o motivo
			if kind, err := stageKindOf(gateStage); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			} else if kind == "LOST" {
				reason, note, err := checkLostReason(pid, pr.linkValue("lostReason"), pr.linkValue("lostReasonNote"))
				if err != nil {
					writeLinkErr(w, err)
					return
				}
				add("lostReason", reason)
				add("lostReasonNote", nullStr(note))
			}
		}
	}
	for _, l := range []struct{ key, col, table string }{{"contactId", "contactId", "Contact"}, {"companyId", "companyId", "Company"}} {
		if id := pr.linkValue(l.key); pr.has(l.key) && id != "" {
			if err := checkContactLink(l.table, id); err != nil {
				writeLinkErr(w, err)
				return
			}
			add(l.col, id)
		}
	}
	owner := pr.linkValue("ownerMemberId")
	if me, restricted := ownRestriction(r, "opportunities", true); restricted {
		owner = me // quem só enxerga o que é dele cria sempre em seu nome
	}
	if owner != "" {
		if err := checkOppOwner(owner); err != nil {
			writeLinkErr(w, err)
			return
		}
		add("ownerMemberId", owner)
		newOpp.OwnerMemberID = &owner
	}
	marks := strings.TrimRight(strings.Repeat("?, ", len(cols)), ", ")
	if _, err := db.Exec(`INSERT INTO Opportunity (`+strings.Join(cols, ", ")+`) VALUES (`+marks+`)`, vals...); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	got, err := getOpportunity(newOpp.ID)
	if err != nil {
		got = newOpp
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(got)
}

func updateOpportunity(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 128<<10))
	var opp Opportunity
	if err != nil || json.Unmarshal(raw, &opp) != nil {
		http.Error(w, "corpo inválido", http.StatusBadRequest)
		return
	}
	var pr presence
	json.Unmarshal(raw, &pr)
	v, ok := normalizeMoney(opp.Value)
	if !ok {
		http.Error(w, "Valor inválido", http.StatusBadRequest)
		return
	}
	opp.Value = v
	if strings.TrimSpace(opp.Title) == "" {
		http.Error(w, "Título obrigatório", http.StatusBadRequest)
		return
	}

	// Quem só enxerga o que é dele edita só o que é dele e não reatribui.
	if me, restricted := ownRestriction(r, "opportunities", true); restricted {
		cur, found, err := oppOwner(opp.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !found || cur != me {
			http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
			return
		}
		if pr.has("ownerMemberId") && pr.linkValue("ownerMemberId") != me {
			writeAuthErr(w, http.StatusForbidden, "falta a permissão leads:write para trocar o responsável")
			return
		}
	}

	// Persistem título, valor, prioridade e tags (quando enviados) e os vínculos presentes no corpo.
	// Etapa muda só por /api/leads/move. Campo ausente mantém o que está no banco.
	var prio any // NULL mantém a coluna (COALESCE)
	if opp.Priority != "" && validPriority(opp.Priority) {
		prio = opp.Priority // valor fora do conjunto não bloqueia a edição de título/valor: mantém o do banco
	}
	var tagsArg any
	if opp.Tags != nil {
		tj, _ := json.Marshal(opp.Tags)
		tagsArg = tj
	}
	sets := []string{"title = ?", "value = ?", "priority = COALESCE(?, priority)", "tags = COALESCE(?, tags)", "updatedAt = ?"}
	args := []any{opp.Title, opp.Value, prio, tagsArg, time.Now()}
	for _, l := range []struct{ key, table string }{{"contactId", "Contact"}, {"companyId", "Company"}} {
		if !pr.has(l.key) {
			continue
		}
		id := pr.linkValue(l.key)
		if id != "" {
			if err := checkContactLink(l.table, id); err != nil {
				writeLinkErr(w, err)
				return
			}
			sets, args = append(sets, l.key+" = ?"), append(args, id)
		} else {
			sets = append(sets, l.key+" = NULL")
		}
	}
	if pr.has("ownerMemberId") {
		if id := pr.linkValue("ownerMemberId"); id != "" {
			if err := checkOppOwner(id); err != nil {
				writeLinkErr(w, err)
				return
			}
			sets, args = append(sets, "ownerMemberId = ?"), append(args, id)
		} else if crmEnabled() {
			sets = append(sets, "ownerMemberId = NULL")
		}
	}
	if lostReasonActive() && pr.has("lostReason") { // WP4-2: corrigir o motivo de uma oportunidade que já está Perdida
		var stage string
		var pipeCol sql.NullString
		if err := db.QueryRow(`SELECT stage, pipelineId FROM Opportunity WHERE id = ?`, opp.ID).Scan(&stage, &pipeCol); err == nil {
			pid, perr := oppPipeline(pipeCol, stage)
			gateStage := ""
			if perr == nil {
				gateStage, perr = effectiveStage(stage, pid)
			}
			if kind, kerr := stageKindOf(gateStage); perr == nil && kerr == nil && kind == "LOST" {
				reason, note, cerr := checkLostReason(pid, pr.linkValue("lostReason"), pr.linkValue("lostReasonNote"))
				if cerr != nil {
					writeLinkErr(w, cerr)
					return
				}
				sets, args = append(sets, "lostReason = ?", "lostReasonNote = ?"), append(args, reason, nullStr(note))
			}
		}
	}
	res, err := db.Exec(`UPDATE Opportunity SET `+strings.Join(sets, ", ")+` WHERE id = ?`, append(args, opp.ID)...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// 0 linhas também é "nada mudou": confere se existe antes de dizer 404
		if _, found, _ := oppOwner(opp.ID); !found {
			http.Error(w, "Oportunidade não encontrada", http.StatusNotFound)
			return
		}
	}
	got, err := getOpportunity(opp.ID)
	if err != nil {
		got = opp
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(got)
}
