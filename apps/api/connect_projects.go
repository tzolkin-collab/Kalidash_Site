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

// Projetos conectados e formulários rastreados (WP2). São as LPs, sites e formulários da própria
// Kalidash que mandam lead para o CRM pelo connect.js (ou pela API direta). Só existem com
// CRM_API=1 E AUTH_API=1 (connectEnabled): a chave do snippet é um token, e o lead é um Lead v2.
// Quem gerencia: Admin/Gerente (escopo keys:manage, que token nunca recebe). Docs: docs/pagesAdmin/projects.md.

func connectEnabled() bool { return crmEnabled() && authEnabled() }

// leadFields: os campos do payload do connect.js (sempre os mesmos; ausentes viram vazio).
var leadFields = []string{"nome", "email", "telefone", "empresa", "cargo", "interesse", "mensagem"}

func isLeadField(f string) bool {
	for _, x := range leadFields {
		if x == f {
			return true
		}
	}
	return false
}

type Project struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	URL              string    `json:"url"`
	Origins          []string  `json:"origins"` // origens extras aceitas (além da do URL), ex.: https://www.exemplo.com.br
	Stack            string    `json:"stack,omitempty"`
	Description      string    `json:"description,omitempty"`
	PipelineID       nullableID `json:"pipelineId"` // null = projeto sem funil (fonte desconectada, D40)
	StageID          nullableID `json:"stageId"`
	SourceName       string    `json:"sourceName"` // fonte do lead (inbound)
	Submissions      int       `json:"submissions"`
	LastSubmissionAt *FlexTime `json:"lastSubmissionAt,omitempty"`
	ArchivedAt       *FlexTime `json:"archivedAt,omitempty"`
	CreatedAt        *FlexTime `json:"createdAt,omitempty"`
}

// nullableID vira null no JSON quando vazio (projeto sem funil) e lê null como vazio.
type nullableID string

func (n nullableID) MarshalJSON() ([]byte, error) {
	if n == "" {
		return []byte("null"), nil
	}
	return json.Marshal(string(n))
}

// errNoPipeline é a recusa de envio de um projeto cuja fonte foi desconectada do funil (D40).
var errProjectNoPipeline = errors.New("projeto sem funil: reconecte a fonte a um funil no admin para voltar a receber envios")

type TrackedForm struct {
	ID               string            `json:"id"`
	ProjectID        string            `json:"projectId"`
	Name             string            `json:"name"`
	Selector         string            `json:"selector"`
	Fields           map[string]string `json:"fields"` // campo do payload -> seletor do input (vazio: o connect.js acha por name/id/type)
	ConsentSelector  string            `json:"consentSelector,omitempty"`
	Submissions      int               `json:"submissions"`
	LastSubmissionAt *FlexTime         `json:"lastSubmissionAt,omitempty"`
}

type ProjectView struct {
	Project
	Forms []TrackedForm `json:"forms"`
}

// inboundLead é o que o ingest entrega ao armazenamento.
type inboundLead struct {
	Project  Project
	Form     *TrackedForm
	Name     string
	Email    string
	Phone    string
	Message  string
	Tags     []string
	Custom   map[string]any
	Test     bool
	Actor    string
	ClientIP string
}

type connectStore interface {
	ListProjects() ([]Project, error)
	ProjectByID(id string) (Project, error) // inclui arquivados
	SaveProject(p *Project, replace bool) error
	ArchiveProject(id string) error
	FormsOf(projectID string) ([]TrackedForm, error)
	FormByID(projectID, id string) (TrackedForm, error)
	SaveForm(f *TrackedForm, replace bool) error
	DeleteForm(projectID, id string) error
	IngestLead(in inboundLead) (LeadDTO, error)
}

var connectDB connectStore = sqlConnectStore{}

const connectSchema = `
CREATE TABLE IF NOT EXISTS ConnectedProject (
	id VARCHAR(64) PRIMARY KEY,
	name VARCHAR(160) NOT NULL,
	url VARCHAR(500) NOT NULL,
	origins TEXT NULL,
	stack VARCHAR(120) NULL,
	description VARCHAR(500) NULL,
	pipelineId VARCHAR(64) NULL,
	stageId VARCHAR(128) NULL,
	sourceName VARCHAR(255) NOT NULL,
	submissions INT NOT NULL DEFAULT 0,
	lastSubmissionAt DATETIME NULL,
	archivedAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS TrackedForm (
	id VARCHAR(64) PRIMARY KEY,
	projectId VARCHAR(64) NOT NULL,
	name VARCHAR(160) NOT NULL,
	selector VARCHAR(255) NOT NULL,
	fields TEXT NULL,
	consentSelector VARCHAR(255) NULL,
	submissions INT NOT NULL DEFAULT 0,
	lastSubmissionAt DATETIME NULL,
	createdAt DATETIME NOT NULL,
	updatedAt DATETIME NOT NULL,
	INDEX idx_form_project (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

// ensureConnectSchema é idempotente e só cria tabelas novas (nada existente é alterado).
// Falha alta: com as duas flags ligadas o operador pediu o recurso.
func ensureConnectSchema() {
	for _, stmt := range splitStatements(connectSchema) {
		if _, err := db.Exec(stmt); err != nil {
			log.Fatalf("❌ CONNECT: erro ao criar tabelas de projetos conectados: %v", err)
		}
	}
	// D40: tabelas antigas têm funil e etapa NOT NULL; afrouxa para NULL (só quando ainda for NOT NULL, idempotente).
	for _, c := range []struct{ col, ddl string }{{"pipelineId", "VARCHAR(64) NULL"}, {"stageId", "VARCHAR(128) NULL"}} {
		var nullable string
		if err := db.QueryRow(`SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ConnectedProject' AND COLUMN_NAME = ?`, c.col).Scan(&nullable); err != nil {
			log.Fatalf("❌ CONNECT: não consegui ler ConnectedProject.%s: %v", c.col, err)
		}
		if strings.EqualFold(nullable, "NO") {
			if _, err := db.Exec("ALTER TABLE ConnectedProject MODIFY " + c.col + " " + c.ddl); err != nil {
				log.Fatalf("❌ CONNECT: não consegui permitir NULL em ConnectedProject.%s: %v", c.col, err)
			}
		}
	}
	log.Println("✅ Projetos conectados e connect.js prontos (CRM_API=1 + AUTH_API=1)")
}

// ---- validação ----

// originOf devolve esquema://host[:porta] de um endereço, ou "" se não for http(s) válido.
func originOf(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || !strings.Contains(u.Hostname(), ".") && u.Hostname() != "localhost" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

// validOriginPattern aceita origem exata ou com curinga de subdomínio (https://*.exemplo.com.br).
func validOriginPattern(o string) bool {
	if i := strings.Index(o, "*."); i > 0 {
		if o[:i] != "https://" && o[:i] != "http://" {
			return false
		}
		plain := o[:i] + o[i+2:]
		return originOf(plain) == plain
	}
	return originOf(o) == o
}

func (p *Project) allowedOrigins() []string {
	out := []string{}
	if o := originOf(p.URL); o != "" {
		out = append(out, o)
	}
	return append(out, p.Origins...)
}

func (p *Project) originAllowed(origin string) bool {
	return originAllowed(origin, p.allowedOrigins())
}

func validateProject(p *Project) error {
	p.Name = clean(p.Name, 160)
	p.URL = strings.TrimRight(strings.TrimSpace(p.URL), "/")
	p.Stack = clean(p.Stack, 120)
	p.Description = clean(p.Description, 500)
	p.SourceName = clean(p.SourceName, 255)
	if p.Name == "" {
		return errors.New("dê um nome ao projeto")
	}
	if originOf(p.URL) == "" {
		return errors.New("informe o endereço completo do site, com https://")
	}
	seen := map[string]bool{originOf(p.URL): true}
	extras := []string{}
	for _, o := range p.Origins {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o == "" || seen[o] {
			continue
		}
		if !validOriginPattern(o) {
			return errors.New("origem inválida: " + o + " (use https://dominio, sem caminho)")
		}
		seen[o] = true
		extras = append(extras, o)
	}
	if len(extras) > 10 {
		return errors.New("origens demais (máx. 10)")
	}
	p.Origins = extras
	if p.SourceName == "" {
		p.SourceName = p.Name
	}
	p.PipelineID, p.StageID = nullableID(strings.TrimSpace(string(p.PipelineID))), nullableID(strings.TrimSpace(string(p.StageID)))
	if p.PipelineID == "" && p.StageID == "" {
		return nil // fonte desconectada (D40): o projeto existe, mas não recebe envios até ser reconectado
	}
	if !idRe.MatchString(string(p.PipelineID)) || !idRe.MatchString(string(p.StageID)) {
		return errors.New("escolha o funil e a coluna de leads em que os envios entram")
	}
	if workflowEnabled() {
		var kind string
		err := db.QueryRow(`SELECT s.kind FROM PipelineStage s JOIN Pipeline p ON p.id = s.pipelineId WHERE s.id = ? AND s.pipelineId = ? AND p.archivedAt IS NULL`, p.StageID, p.PipelineID).Scan(&kind)
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("a coluna escolhida não existe nesse funil")
		} else if err != nil {
			return err
		}
		if kind != "LEAD" {
			return errors.New("a coluna de entrada precisa ser uma coluna de leads (tipo Lead)")
		}
	}
	return nil
}

func validateForm(f *TrackedForm) error {
	f.Name = clean(f.Name, 160)
	f.Selector = clean(f.Selector, 255)
	f.ConsentSelector = clean(f.ConsentSelector, 255)
	if f.Name == "" {
		return errors.New("dê um nome ao formulário")
	}
	if f.Selector == "" {
		return errors.New("informe o seletor CSS do formulário (ex.: #form-contato)")
	}
	fields := map[string]string{}
	for k, v := range f.Fields {
		if !isLeadField(k) {
			return errors.New("campo desconhecido: " + k)
		}
		if v = clean(v, 255); v != "" {
			fields[k] = v
		}
	}
	f.Fields = fields
	return nil
}

// ---- armazenamento SQL ----

type sqlConnectStore struct{}

const projectCols = `id, name, url, origins, stack, description, pipelineId, stageId, sourceName, submissions, lastSubmissionAt, archivedAt, createdAt`

func scanProject(sc interface{ Scan(...any) error }) (Project, error) {
	var p Project
	var origins, stack, desc, last, archived, created, pipeline, stage sql.NullString
	if err := sc.Scan(&p.ID, &p.Name, &p.URL, &origins, &stack, &desc, &pipeline, &stage, &p.SourceName, &p.Submissions, &last, &archived, &created); err != nil {
		return p, err
	}
	p.PipelineID, p.StageID = nullableID(pipeline.String), nullableID(stage.String)
	p.Origins = decodeJSON([]byte(origins.String), []string{})
	if p.Origins == nil {
		p.Origins = []string{}
	}
	p.Stack, p.Description = stack.String, desc.String
	p.LastSubmissionAt, p.ArchivedAt, p.CreatedAt = flexFrom(last.String), flexFrom(archived.String), flexFrom(created.String)
	return p, nil
}

func (sqlConnectStore) ListProjects() ([]Project, error) {
	rows, err := db.Query(`SELECT ` + projectCols + ` FROM ConnectedProject WHERE archivedAt IS NULL ORDER BY createdAt, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Project{}
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (sqlConnectStore) ProjectByID(id string) (Project, error) {
	p, err := scanProject(db.QueryRow(`SELECT `+projectCols+` FROM ConnectedProject WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return p, errNotFound
	}
	return p, err
}

func (sqlConnectStore) SaveProject(p *Project, replace bool) error {
	origins, _ := json.Marshal(p.Origins)
	now := time.Now()
	if !replace {
		_, err := db.Exec(`INSERT INTO ConnectedProject (id, name, url, origins, stack, description, pipelineId, stageId, sourceName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			p.ID, p.Name, p.URL, string(origins), nullStr(p.Stack), nullStr(p.Description), nullStr(string(p.PipelineID)), nullStr(string(p.StageID)), p.SourceName, now, now)
		return err
	}
	res, err := db.Exec(`UPDATE ConnectedProject SET name = ?, url = ?, origins = ?, stack = ?, description = ?, pipelineId = ?, stageId = ?, sourceName = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`,
		p.Name, p.URL, string(origins), nullStr(p.Stack), nullStr(p.Description), nullStr(string(p.PipelineID)), nullStr(string(p.StageID)), p.SourceName, now, p.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, err := (sqlConnectStore{}).ProjectByID(p.ID); err != nil {
			return err
		}
	}
	return nil
}

func (sqlConnectStore) ArchiveProject(id string) error {
	res, err := db.Exec(`UPDATE ConnectedProject SET archivedAt = ?, updatedAt = ? WHERE id = ? AND archivedAt IS NULL`, time.Now(), time.Now(), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errNotFound
	}
	return nil
}

const formCols = `id, projectId, name, selector, fields, consentSelector, submissions, lastSubmissionAt`

func scanForm(sc interface{ Scan(...any) error }) (TrackedForm, error) {
	var f TrackedForm
	var fields, consent, last sql.NullString
	if err := sc.Scan(&f.ID, &f.ProjectID, &f.Name, &f.Selector, &fields, &consent, &f.Submissions, &last); err != nil {
		return f, err
	}
	f.Fields = decodeJSON([]byte(fields.String), map[string]string{})
	if f.Fields == nil {
		f.Fields = map[string]string{}
	}
	f.ConsentSelector, f.LastSubmissionAt = consent.String, flexFrom(last.String)
	return f, nil
}

func (sqlConnectStore) FormsOf(projectID string) ([]TrackedForm, error) {
	rows, err := db.Query(`SELECT `+formCols+` FROM TrackedForm WHERE projectId = ? ORDER BY createdAt, id`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TrackedForm{}
	for rows.Next() {
		f, err := scanForm(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (sqlConnectStore) FormByID(projectID, id string) (TrackedForm, error) {
	f, err := scanForm(db.QueryRow(`SELECT `+formCols+` FROM TrackedForm WHERE projectId = ? AND id = ?`, projectID, id))
	if errors.Is(err, sql.ErrNoRows) {
		return f, errNotFound
	}
	return f, err
}

func (sqlConnectStore) SaveForm(f *TrackedForm, replace bool) error {
	fields, _ := json.Marshal(f.Fields)
	now := time.Now()
	if !replace {
		_, err := db.Exec(`INSERT INTO TrackedForm (id, projectId, name, selector, fields, consentSelector, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			f.ID, f.ProjectID, f.Name, f.Selector, string(fields), nullStr(f.ConsentSelector), now, now)
		return err
	}
	res, err := db.Exec(`UPDATE TrackedForm SET name = ?, selector = ?, fields = ?, consentSelector = ?, updatedAt = ? WHERE id = ? AND projectId = ?`,
		f.Name, f.Selector, string(fields), nullStr(f.ConsentSelector), now, f.ID, f.ProjectID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, err := (sqlConnectStore{}).FormByID(f.ProjectID, f.ID); err != nil {
			return err
		}
	}
	return nil
}

func (sqlConnectStore) DeleteForm(projectID, id string) error {
	res, err := db.Exec(`DELETE FROM TrackedForm WHERE projectId = ? AND id = ?`, projectID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errNotFound
	}
	return nil
}

// IngestLead cria (ou reaproveita, por e-mail) a pessoa e o Lead v2 na pipeline do projeto, e conta o envio
// no projeto e no formulário. Tudo numa transação: ou entra completo, ou não entra.
func (sqlConnectStore) IngestLead(in inboundLead) (LeadDTO, error) {
	if in.Project.ID != "" && in.Project.PipelineID == "" {
		return LeadDTO{}, errProjectNoPipeline
	}
	tx, err := db.Begin()
	if err != nil {
		return LeadDTO{}, err
	}
	defer tx.Rollback()
	now := time.Now()

	var personID, lifecycle string
	if in.Email != "" {
		err := tx.QueryRow(`SELECT id, lifecycle FROM Contact WHERE LOWER(email) = ? AND archivedAt IS NULL ORDER BY createdAt LIMIT 1`, in.Email).Scan(&personID, &lifecycle)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return LeadDTO{}, err
		}
	}
	if personID == "" {
		personID = wfID("p")
		tags, _ := json.Marshal([]string{"Inbound"})
		if _, err := tx.Exec(`INSERT INTO Contact (id, name, email, phone, lifecycle, legacyClient, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'LEAD', 0, ?, ?, ?)`,
			personID, in.Name, in.Email, in.Phone, tags, now, now); err != nil {
			return LeadDTO{}, err
		}
	}

	tags, _ := json.Marshal(in.Tags)
	var custom any
	if len(in.Custom) > 0 {
		raw, _ := json.Marshal(in.Custom)
		custom = string(raw)
	}
	id := wfID("l")
	if _, err := tx.Exec(`INSERT INTO `+leadTbl+` (id, name, email, phone, personId, pipelineId, stageId, origin, sourceName, tags, message, status, wasSeen, returningClient, customData, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'INBOUND', ?, ?, ?, 'ACTIVE', 0, ?, ?, ?, ?)`,
		id, in.Name, in.Email, nullStr(in.Phone), personID, string(in.Project.PipelineID), string(in.Project.StageID), in.Project.SourceName, string(tags), nullStr(in.Message),
		lifecycle == "CLIENT", custom, now, now); err != nil {
		return LeadDTO{}, err
	}
	// Captura pública da Home (WP3b): não há projeto conectado, então não há contadores a atualizar.
	if in.Project.ID != "" {
		if _, err := tx.Exec(`UPDATE ConnectedProject SET submissions = submissions + 1, lastSubmissionAt = ? WHERE id = ?`, now, in.Project.ID); err != nil {
			return LeadDTO{}, err
		}
	}
	if in.Form != nil {
		if _, err := tx.Exec(`UPDATE TrackedForm SET submissions = submissions + 1, lastSubmissionAt = ? WHERE id = ? AND projectId = ?`, now, in.Form.ID, in.Project.ID); err != nil {
			return LeadDTO{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return LeadDTO{}, err
	}
	lead, err := getLeadRecord(id)
	if err != nil {
		return lead, err
	}
	// Histórico (só-acréscimo): melhor esforço, o lead já está gravado.
	via, _ := in.Custom["via"].(string)
	if c := (ChangeDTO{Actor: in.Actor, Entity: "lead", EntityID: id, EntityName: lead.Name, Kind: "create", Note: "Lead criado pelo " + via + " (fonte " + in.Project.SourceName + ")"}); validateChange(&c, now) == nil {
		_, _ = saveChanges([]ChangeDTO{c}, in.ClientIP)
	}
	return lead, nil
}

// ---- rotas: /api/projects (keys:manage; token nunca chega: o escopo é humanOnly) ----

func registerConnectRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/projects", enableCORS(handleProjects))
	mux.HandleFunc("/api/projects/{id}", enableCORS(handleProjectByID))
	mux.HandleFunc("/api/projects/{id}/forms", enableCORS(handleProjectForms))
	mux.HandleFunc("/api/projects/{id}/forms/{formId}", enableCORS(handleProjectFormByID))
	mux.HandleFunc("/api/connect/leads", handleConnectLead)     // CORS e token próprios (connect_ingest.go)
	mux.HandleFunc("/api/connect/config", handleConnectConfig)  // idem
	mux.HandleFunc("/connect.js", handleConnectScript)          // o snippet
}

func projectView(p Project) (ProjectView, error) {
	forms, err := connectDB.FormsOf(p.ID)
	return ProjectView{Project: p, Forms: forms}, err
}

func methodNotAllowed(w http.ResponseWriter) {
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "método não permitido"})
}

func actorName(r *http.Request) string {
	if m, ok := principalOf(r); ok {
		if m.Email != "" {
			return m.Email
		}
		return m.Name
	}
	return "?"
}

func handleProjects(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		list, err := connectDB.ListProjects()
		if err != nil {
			writeErr(w, err)
			return
		}
		out := make([]ProjectView, 0, len(list))
		for _, p := range list {
			v, err := projectView(p)
			if err != nil {
				writeErr(w, err)
				return
			}
			out = append(out, v)
		}
		writeJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var p Project
		r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if err := validateProject(&p); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		p.ID = wfID("prj")
		if err := connectDB.SaveProject(&p, false); err != nil {
			writeErr(w, err)
			return
		}
		got, _ := connectDB.ProjectByID(p.ID)
		log.Printf("AUTH: %s conectou o projeto %s (%s)", actorName(r), got.Name, got.ID)
		v, err := projectView(got)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, v)
	default:
		methodNotAllowed(w)
	}
}

func handleProjectByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		p, err := connectDB.ProjectByID(id)
		if err != nil || p.ArchivedAt != nil {
			writeErr(w, errNotFound)
			return
		}
		v, err := projectView(p)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	case http.MethodPut:
		var p Project
		r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		p.ID = id
		if err := validateProject(&p); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		if err := connectDB.SaveProject(&p, true); err != nil {
			writeErr(w, err)
			return
		}
		got, _ := connectDB.ProjectByID(id)
		log.Printf("AUTH: %s alterou o projeto %s (%s)", actorName(r), got.Name, got.ID)
		v, err := projectView(got)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	case http.MethodDelete:
		// Arquiva: o connect.js deixa de aceitar envios do projeto na hora; os leads já criados ficam.
		if err := connectDB.ArchiveProject(id); err != nil {
			writeErr(w, err)
			return
		}
		log.Printf("AUTH: %s desconectou o projeto %s", actorName(r), id)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func liveProject(w http.ResponseWriter, id string) (Project, bool) {
	if !idRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return Project{}, false
	}
	p, err := connectDB.ProjectByID(id)
	if err != nil || p.ArchivedAt != nil {
		writeErr(w, errNotFound)
		return Project{}, false
	}
	return p, true
}

func handleProjectForms(w http.ResponseWriter, r *http.Request) {
	p, ok := liveProject(w, r.PathValue("id"))
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodGet:
		forms, err := connectDB.FormsOf(p.ID)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, forms)
	case http.MethodPost:
		var f TrackedForm
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if err := validateForm(&f); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		f.ID, f.ProjectID = wfID("frm"), p.ID
		if err := connectDB.SaveForm(&f, false); err != nil {
			writeErr(w, err)
			return
		}
		got, err := connectDB.FormByID(p.ID, f.ID)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, got)
	default:
		methodNotAllowed(w)
	}
}

func handleProjectFormByID(w http.ResponseWriter, r *http.Request) {
	p, ok := liveProject(w, r.PathValue("id"))
	if !ok {
		return
	}
	fid := r.PathValue("formId")
	if !idRe.MatchString(fid) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id inválido"})
		return
	}
	switch r.Method {
	case http.MethodPut:
		var f TrackedForm
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "corpo inválido"})
			return
		}
		if err := validateForm(&f); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
			return
		}
		f.ID, f.ProjectID = fid, p.ID
		if err := connectDB.SaveForm(&f, true); err != nil {
			writeErr(w, err)
			return
		}
		got, err := connectDB.FormByID(p.ID, fid)
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, got)
	case http.MethodDelete:
		if err := connectDB.DeleteForm(p.ID, fid); err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}
