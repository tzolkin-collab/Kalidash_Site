package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Servidor MCP (Model Context Protocol) do Kalidash: agentes (Claude, Cursor, n8n…) leem e agem no CRM.
//
// Transporte "Streamable HTTP" sem stream: cada POST /api/mcp leva UMA mensagem JSON-RPC 2.0 e recebe a resposta em
// application/json (notificações recebem 202 sem corpo). GET devolve 405, como a especificação permite a servidores
// que não abrem SSE. A autenticação é a de sempre (withAuth): "Authorization: Bearer kld_live_…" com o escopo mcp:use.
//
// Cada ferramenta vira uma chamada interna à rota que já existe (mcpMux), com a mesma pessoa/token no contexto. Assim
// valem as mesmas regras da tela: escopo por rota, leads:own/opportunities:own, histórico com o nome do token.
// Uma ferramenta só aparece em tools/list se o token tem o escopo da rota dela.
//
// GET /api/mcp/info alimenta a aba MCP de Configurações: endereço, ferramentas com o escopo de cada uma e as últimas
// chamadas (em memória, some ao reiniciar a API).

const (
	mcpProtocolLatest = "2025-06-18"
	mcpServerVersion  = "0.1.0"
	mcpMaxBody        = 256 << 10
	mcpMaxResult      = 60 << 10 // texto devolvido ao agente; o resto é cortado com aviso
)

var mcpProtocols = map[string]bool{"2025-06-18": true, "2025-03-26": true, "2024-11-05": true}

// mcpMux é o mux das rotas /api (sem o withAuth): as ferramentas o chamam por dentro.
var mcpMux http.Handler

func registerMCPRoutes(mux *http.ServeMux) {
	mcpMux = mux
	mux.HandleFunc("/api/mcp", handleMCP)
	mux.HandleFunc("/api/mcp/info", handleMCPInfo)
}

// ---- ferramentas ----

type mcpTool struct {
	Name        string
	Title       string
	Description string
	Schema      map[string]any
	ReadOnly    bool
	// call monta a requisição interna a partir dos argumentos.
	call func(args map[string]any) (method, path string, query url.Values, body any, err error)
}

func prop(typ, desc string) map[string]any { return map[string]any{"type": typ, "description": desc} }

func objSchema(props map[string]any, required ...string) map[string]any {
	s := map[string]any{"type": "object", "properties": props, "additionalProperties": false}
	if len(required) > 0 {
		s["required"] = required
	}
	return s
}

func argStr(a map[string]any, k string) string {
	switch v := a[k].(type) {
	case string:
		return strings.TrimSpace(v)
	case float64:
		return fmt.Sprintf("%g", v)
	case bool:
		if v {
			return "true"
		}
		return "false"
	}
	return ""
}

func needArg(a map[string]any, k string) (string, error) {
	v := argStr(a, k)
	if v == "" {
		return "", fmt.Errorf("o argumento %q é obrigatório", k)
	}
	return v, nil
}

func setIf(q url.Values, k, v string) {
	if v != "" {
		q.Set(k, v)
	}
}

func limitArg(a map[string]any, def int) string {
	n := atoiOr(argStr(a, "limit"), def)
	if n <= 0 {
		n = def
	}
	if n > 100 {
		n = 100
	}
	return fmt.Sprint(n)
}

var mcpTools = []mcpTool{
	{
		Name: "buscar_leads", Title: "Buscar leads", ReadOnly: true,
		Description: "Lista leads do CRM, do mais novo para o mais antigo. Filtra por texto (nome ou e-mail), status e funil.",
		Schema: objSchema(map[string]any{
			"q":          prop("string", "Parte do nome ou do e-mail."),
			"status":     prop("string", "Status do lead (ex.: NEW, CONTACTED, QUALIFIED, DISQUALIFIED)."),
			"pipelineId": prop("string", "Id do funil (veja listar_funis)."),
			"limit":      prop("integer", "Quantos trazer (1 a 100, padrão 20)."),
		}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			q := url.Values{}
			setIf(q, "q", argStr(a, "q"))
			setIf(q, "status", argStr(a, "status"))
			setIf(q, "pipelineId", argStr(a, "pipelineId"))
			q.Set("limit", limitArg(a, 20))
			return http.MethodGet, "/api/crm/leads", q, nil, nil
		},
	},
	{
		Name: "ver_lead", Title: "Ver um lead", ReadOnly: true,
		Description: "Abre um lead pelo id, com contato, empresa, origem, etapa e responsável.",
		Schema:      objSchema(map[string]any{"id": prop("string", "Id do lead.")}, "id"),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			id, err := needArg(a, "id")
			return http.MethodGet, "/api/crm/leads/" + url.PathEscape(id), nil, nil, err
		},
	},
	{
		Name: "listar_oportunidades", Title: "Listar oportunidades", ReadOnly: true,
		Description: "Lista as oportunidades (negócios) com etapa, valor, empresa e responsável.",
		Schema:      objSchema(map[string]any{}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			return http.MethodGet, "/api/leads", nil, nil, nil
		},
	},
	{
		Name: "ver_notas_da_oportunidade", Title: "Ver notas de uma oportunidade", ReadOnly: true,
		Description: "Lista as notas e e-mails registrados numa oportunidade, da mais nova para a mais antiga.",
		Schema:      objSchema(map[string]any{"opportunityId": prop("string", "Id da oportunidade.")}, "opportunityId"),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			id, err := needArg(a, "opportunityId")
			return http.MethodGet, "/api/leads/notes", url.Values{"opportunityId": {id}}, nil, err
		},
	},
	{
		Name: "anotar_oportunidade", Title: "Anotar numa oportunidade",
		Description: "Registra uma nota numa oportunidade (fica no histórico com o nome do token).",
		Schema: objSchema(map[string]any{
			"opportunityId": prop("string", "Id da oportunidade."),
			"content":       prop("string", "Texto da nota."),
		}, "opportunityId", "content"),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			id, err := needArg(a, "opportunityId")
			if err != nil {
				return "", "", nil, nil, err
			}
			content, err := needArg(a, "content")
			return http.MethodPost, "/api/leads/notes", nil, map[string]any{"opportunityId": id, "content": content, "type": "NOTE"}, err
		},
	},
	{
		Name: "buscar_pessoas", Title: "Buscar pessoas", ReadOnly: true,
		Description: "Lista contatos (pessoas) do CRM por nome ou e-mail. O CPF vem sempre mascarado.",
		Schema: objSchema(map[string]any{
			"q":     prop("string", "Parte do nome ou do e-mail."),
			"limit": prop("integer", "Quantos trazer (1 a 100, padrão 20)."),
		}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			q := url.Values{}
			setIf(q, "q", argStr(a, "q"))
			q.Set("limit", limitArg(a, 20))
			return http.MethodGet, "/api/crm/people", q, nil, nil
		},
	},
	{
		Name: "buscar_empresas", Title: "Buscar empresas", ReadOnly: true,
		Description: "Lista empresas do CRM por nome.",
		Schema: objSchema(map[string]any{
			"q":     prop("string", "Parte do nome."),
			"limit": prop("integer", "Quantos trazer (1 a 100, padrão 20)."),
		}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			q := url.Values{}
			setIf(q, "q", argStr(a, "q"))
			q.Set("limit", limitArg(a, 20))
			return http.MethodGet, "/api/crm/companies", q, nil, nil
		},
	},
	{
		Name: "listar_funis", Title: "Listar funis", ReadOnly: true,
		Description: "Lista os funis com as etapas (ids e nomes), para filtrar leads e entender o processo.",
		Schema:      objSchema(map[string]any{}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			return http.MethodGet, "/api/pipelines", nil, nil, nil
		},
	},
	{
		Name: "listar_tarefas", Title: "Listar tarefas", ReadOnly: true,
		Description: "Lista tarefas (abertas primeiro, por prazo). Filtra por concluída, responsável ou registro ligado.",
		Schema: objSchema(map[string]any{
			"done":     prop("boolean", "true: só concluídas; false: só abertas. Sem o campo: todas."),
			"assignee": prop("string", "Nome do responsável."),
			"entity":   prop("string", "Tipo do registro ligado: lead, person, company, opportunity ou pipeline."),
			"entityId": prop("string", "Id do registro ligado."),
		}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			q := url.Values{}
			if v, ok := a["done"].(bool); ok {
				q.Set("done", map[bool]string{true: "1", false: "0"}[v])
			}
			setIf(q, "assignee", argStr(a, "assignee"))
			setIf(q, "entity", argStr(a, "entity"))
			setIf(q, "entityId", argStr(a, "entityId"))
			return http.MethodGet, "/api/tasks", q, nil, nil
		},
	},
	{
		Name: "criar_tarefa", Title: "Criar tarefa",
		Description: "Cria uma tarefa ligada a um lead, pessoa, empresa, oportunidade ou funil, com prazo opcional.",
		Schema: objSchema(map[string]any{
			"title":    prop("string", "O que precisa ser feito."),
			"entity":   prop("string", "Tipo do registro ligado: lead, person, company, opportunity ou pipeline."),
			"entityId": prop("string", "Id do registro ligado."),
			"dueAt":    prop("string", "Prazo em ISO 8601 (ex.: 2026-12-01T15:00:00-03:00)."),
			"assignee": prop("string", "Nome do responsável."),
		}, "title", "entity", "entityId"),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			body := map[string]any{"source": "manual", "status": "TODO"}
			for _, k := range []string{"title", "entity", "entityId"} {
				v, err := needArg(a, k)
				if err != nil {
					return "", "", nil, nil, err
				}
				body[k] = v
			}
			for _, k := range []string{"assignee"} {
				if v := argStr(a, k); v != "" {
					body[k] = v
				}
			}
			if v := argStr(a, "dueAt"); v != "" {
				t, perr := time.Parse(time.RFC3339, v)
				if perr != nil {
					return "", "", nil, nil, fmt.Errorf("dueAt precisa ser ISO 8601 com fuso (ex.: 2026-12-01T15:00:00-03:00)")
				}
				body["dueAt"] = t
			}
			return http.MethodPost, "/api/tasks", nil, body, nil
		},
	},
	{
		Name: "listar_artigos", Title: "Listar artigos do blog", ReadOnly: true,
		Description: "Lista os artigos do blog, publicados e rascunhos, com título, slug e datas.",
		Schema:      objSchema(map[string]any{}),
		call: func(a map[string]any) (string, string, url.Values, any, error) {
			return http.MethodGet, "/api/blog/articles", nil, nil, nil
		},
	},
}

var mcpToolIndex = func() map[string]*mcpTool {
	m := map[string]*mcpTool{}
	for i := range mcpTools {
		m[mcpTools[i].Name] = &mcpTools[i]
	}
	return m
}()

// mcpToolRoute: a rota da ferramenta com argumentos de exemplo e o escopo que ela exige (o mesmo da tela).
func mcpToolRoute(t *mcpTool) (scope, path string) {
	sample := map[string]any{"id": "x", "opportunityId": "x", "title": "x", "content": "x", "entity": "lead", "entityId": "x"}
	method, path, query, _, err := t.call(sample)
	if err != nil {
		return "", ""
	}
	u := path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req := httptest.NewRequest(method, u, nil)
	s, _ := routeScope(req)
	return s, path
}

func mcpToolScope(t *mcpTool) string { s, _ := mcpToolRoute(t); return s }

func mcpToolAllowed(m Member, t *mcpTool) bool {
	if !authEnabled() {
		return false
	}
	s, path := mcpToolRoute(t)
	return s != "" && scopeSatisfied(m.Scopes, s, path)
}

// ---- JSON-RPC ----

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func writeRPC(w http.ResponseWriter, id json.RawMessage, result any, rerr *rpcError) {
	if len(id) == 0 {
		id = json.RawMessage("null")
	}
	resp := map[string]any{"jsonrpc": "2.0", "id": id}
	if rerr != nil {
		resp["error"] = rerr
	} else {
		resp["result"] = result
	}
	writeJSON(w, http.StatusOK, resp)
}

func handleMCP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "use POST com uma mensagem JSON-RPC (o servidor não abre SSE)"})
		return
	}
	m, ok := principalOf(r)
	if !ok || !authEnabled() {
		writeAuthErr(w, http.StatusUnauthorized, "o MCP exige login ligado e um token de API")
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, mcpMaxBody))
	if err != nil {
		writeRPC(w, nil, nil, &rpcError{-32700, "corpo grande demais ou ilegível"})
		return
	}
	if t := bytes.TrimSpace(raw); len(t) > 0 && t[0] == '[' {
		writeRPC(w, nil, nil, &rpcError{-32600, "envie uma mensagem por requisição (lotes não são aceitos)"})
		return
	}
	var req rpcRequest
	if err := json.Unmarshal(raw, &req); err != nil || req.JSONRPC != "2.0" || req.Method == "" {
		writeRPC(w, nil, nil, &rpcError{-32600, "mensagem JSON-RPC 2.0 inválida"})
		return
	}
	// Notificação (sem id) ou resposta do cliente: só confirma.
	if len(req.ID) == 0 || string(req.ID) == "null" {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	switch req.Method {
	case "initialize":
		var p struct {
			ProtocolVersion string `json:"protocolVersion"`
			ClientInfo      struct {
				Name    string `json:"name"`
				Title   string `json:"title"`
				Version string `json:"version"`
			} `json:"clientInfo"`
		}
		_ = json.Unmarshal(req.Params, &p)
		rememberClientInfo(m, firstNonEmpty(p.ClientInfo.Title, p.ClientInfo.Name), p.ClientInfo.Version)
		version := mcpProtocolLatest
		if mcpProtocols[p.ProtocolVersion] {
			version = p.ProtocolVersion
		}
		writeRPC(w, req.ID, map[string]any{
			"protocolVersion": version,
			"capabilities":    map[string]any{"tools": map[string]any{"listChanged": false}},
			"serverInfo":      map[string]any{"name": "kalidash", "title": "Kalidash CRM", "version": mcpServerVersion},
			"instructions": "Kalidash é o CRM da Kalidash: leads, oportunidades, pessoas, empresas, tarefas e o blog. " +
				"Use buscar_* e listar_* para consultar; anotar_oportunidade e criar_tarefa gravam com o nome deste token no histórico. " +
				"Datas em ISO 8601 com fuso de Brasília (-03:00).",
		}, nil)
	case "ping":
		writeRPC(w, req.ID, map[string]any{}, nil)
	case "tools/list":
		tools := []map[string]any{}
		for i := range mcpTools {
			t := &mcpTools[i]
			if !mcpToolAllowed(m, t) {
				continue
			}
			tools = append(tools, map[string]any{
				"name": t.Name, "title": t.Title, "description": t.Description, "inputSchema": t.Schema,
				"annotations": map[string]any{"readOnlyHint": t.ReadOnly, "destructiveHint": false, "openWorldHint": false},
			})
		}
		writeRPC(w, req.ID, map[string]any{"tools": tools}, nil)
	case "tools/call":
		var p struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil || p.Name == "" {
			writeRPC(w, req.ID, nil, &rpcError{-32602, "params.name é obrigatório"})
			return
		}
		t := mcpToolIndex[p.Name]
		if t == nil {
			writeRPC(w, req.ID, nil, &rpcError{-32602, "ferramenta desconhecida: " + p.Name})
			return
		}
		if p.Arguments == nil {
			p.Arguments = map[string]any{}
		}
		start := time.Now()
		text, isErr := runMCPTool(r, m, t, p.Arguments)
		mcpRecord(mcpCallerOf(r, m), t.Name, !isErr, time.Since(start))
		writeRPC(w, req.ID, map[string]any{"content": []map[string]any{{"type": "text", "text": text}}, "isError": isErr}, nil)
	default:
		writeRPC(w, req.ID, nil, &rpcError{-32601, "método não suportado: " + req.Method})
	}
}

// runMCPTool chama a rota da ferramenta por dentro, com a mesma pessoa/token. Erros de negócio voltam como
// isError=true (o agente lê e corrige), não como erro JSON-RPC.
func runMCPTool(r *http.Request, m Member, t *mcpTool, args map[string]any) (string, bool) {
	if !mcpToolAllowed(m, t) {
		return "Este token não tem o escopo " + mcpToolScope(t) + ", que esta ferramenta exige.", true
	}
	method, path, query, body, err := t.call(args)
	if err != nil {
		return err.Error(), true
	}
	u := path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	sub, err := http.NewRequestWithContext(withPrincipal(r.Context(), m), method, u, rd)
	if err != nil {
		return err.Error(), true
	}
	if body != nil {
		sub.Header.Set("Content-Type", "application/json")
	}
	// Confere o escopo da rota como o withAuth faria (o mux interno não passa por ele).
	if s, _ := routeScope(sub); s == "" || !scopeSatisfied(m.Scopes, s, sub.URL.Path) {
		return "Sem permissão para " + path + ".", true
	}
	rec := httptest.NewRecorder()
	mcpMux.ServeHTTP(rec, sub)
	out := strings.TrimSpace(rec.Body.String())
	if len(out) > mcpMaxResult {
		out = out[:mcpMaxResult] + "\n… (resultado cortado: use filtros ou limit menor)"
	}
	if rec.Code >= 400 {
		if out == "" {
			out = http.StatusText(rec.Code)
		}
		return fmt.Sprintf("A API respondeu %d: %s", rec.Code, out), true
	}
	if out == "" {
		out = "ok"
	}
	return out, false
}

// ---- quem chama ----

// mcpCaller: o provedor e a pessoa por trás de uma chamada, para a aba MCP mostrar nome e logo.
// Kind: oauth (agente conectado por OAuth), token (token de API) ou session (pessoa logada no admin).
type mcpCaller struct {
	Kind     string `json:"kind"`
	Provider string `json:"provider"`
	Version  string `json:"version,omitempty"`
	LogoURI  string `json:"logoUri,omitempty"`
	Domain   string `json:"domain,omitempty"`
	Person   string `json:"person"`
}

type callerKey struct{}

func withMCPCaller(ctx context.Context, c mcpCaller) context.Context {
	return context.WithValue(ctx, callerKey{}, c)
}

type clientInfo struct{ Name, Version string }

var (
	clientInfoMu sync.Mutex
	clientInfos  = map[string]clientInfo{} // principal → o clientInfo do último initialize
)

func rememberClientInfo(m Member, name, version string) {
	if name == "" {
		return
	}
	clientInfoMu.Lock()
	defer clientInfoMu.Unlock()
	if len(clientInfos) > 500 {
		clientInfos = map[string]clientInfo{}
	}
	clientInfos[m.ID] = clientInfo{clip(name, 80), clip(version, 40)}
}

func mcpCallerOf(r *http.Request, m Member) mcpCaller {
	clientInfoMu.Lock()
	info := clientInfos[m.ID]
	clientInfoMu.Unlock()
	if c, ok := r.Context().Value(callerKey{}).(mcpCaller); ok {
		c.Version = info.Version
		return c
	}
	c := mcpCaller{Kind: "session", Provider: info.Name, Version: info.Version, Person: firstNonEmpty(m.Name, m.Email)}
	if isTokenPrincipal(m) {
		c.Kind = "token"
		c.Person = strings.TrimPrefix(m.Name, tokenAuthLabel)
	}
	if c.Provider == "" {
		c.Provider = map[string]string{"token": "Token de API", "session": "Admin (sessão)"}[c.Kind]
	} else {
		c.Domain = providerDomain(c.Provider, "", nil)
	}
	return c
}

// ---- últimas chamadas (memória) ----

type mcpCall struct {
	At time.Time `json:"at"`
	mcpCaller
	Tool string `json:"tool"`
	OK   bool   `json:"ok"`
	MS   int64  `json:"ms"`
}

var (
	mcpCallsMu sync.Mutex
	mcpCalls   []mcpCall
)

func mcpRecord(c mcpCaller, tool string, ok bool, d time.Duration) {
	mcpCallsMu.Lock()
	defer mcpCallsMu.Unlock()
	mcpCalls = append([]mcpCall{{At: time.Now(), mcpCaller: c, Tool: tool, OK: ok, MS: d.Milliseconds()}}, mcpCalls...)
	if len(mcpCalls) > 50 {
		mcpCalls = mcpCalls[:50]
	}
}

// GET /api/mcp/info: o que a aba MCP do admin mostra.
func handleMCPInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}
	type toolInfo struct {
		Name        string `json:"name"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Scope       string `json:"scope"`
		ReadOnly    bool   `json:"readOnly"`
	}
	tools := make([]toolInfo, 0, len(mcpTools))
	for i := range mcpTools {
		t := &mcpTools[i]
		tools = append(tools, toolInfo{t.Name, t.Title, t.Description, mcpToolScope(t), t.ReadOnly})
	}
	mcpCallsMu.Lock()
	calls := append([]mcpCall{}, mcpCalls...)
	mcpCallsMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":         authEnabled(),
		"path":            "/api/mcp",
		"protocolVersion": mcpProtocolLatest,
		"serverVersion":   mcpServerVersion,
		"tools":           tools,
		"calls":           calls,
	})
}
