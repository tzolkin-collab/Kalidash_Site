package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// mcpPost manda uma mensagem JSON-RPC ao handler com a pessoa/token no contexto.
func mcpPost(t *testing.T, m *Member, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, "/api/mcp", strings.NewReader(body))
	if m != nil {
		r = r.WithContext(withPrincipal(r.Context(), *m))
	}
	w := httptest.NewRecorder()
	handleMCP(w, r)
	return w
}

func mcpResult(t *testing.T, w *httptest.ResponseRecorder) (map[string]any, map[string]any) {
	t.Helper()
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("resposta não é JSON: %q", w.Body.String())
	}
	res, _ := resp["result"].(map[string]any)
	rerr, _ := resp["error"].(map[string]any)
	return res, rerr
}

func TestMCPInitializeENotificacao(t *testing.T) {
	t.Setenv("AUTH_API", "1")
	m := &Member{ID: "token:1", Name: "API: Agente", Scopes: []string{"mcp:use"}}

	res, rerr := mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"x","version":"1"}}}`))
	if rerr != nil || res["protocolVersion"] != "2025-03-26" {
		t.Fatalf("initialize devia ecoar a versão suportada: %v %v", res, rerr)
	}
	if caps, _ := res["capabilities"].(map[string]any); caps["tools"] == nil {
		t.Error("initialize devia anunciar tools")
	}
	res, _ = mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":2,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}`))
	if res["protocolVersion"] != mcpProtocolLatest {
		t.Errorf("versão desconhecida devia cair na mais nova: %v", res["protocolVersion"])
	}

	if w := mcpPost(t, m, `{"jsonrpc":"2.0","method":"notifications/initialized"}`); w.Code != http.StatusAccepted || w.Body.Len() != 0 {
		t.Errorf("notificação devia receber 202 sem corpo, veio %d %q", w.Code, w.Body.String())
	}
	if _, rerr := mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":3,"method":"resources/list"}`)); rerr == nil || rerr["code"].(float64) != -32601 {
		t.Errorf("método não suportado devia dar -32601: %v", rerr)
	}
	if _, rerr := mcpResult(t, mcpPost(t, m, `[{"jsonrpc":"2.0","id":4,"method":"ping"}]`)); rerr == nil {
		t.Error("lote devia ser recusado")
	}
	if _, rerr := mcpResult(t, mcpPost(t, m, `{"id":5,"method":"ping"}`)); rerr == nil {
		t.Error("sem jsonrpc 2.0 devia ser recusado")
	}
}

func TestMCPSemLoginOuComGET(t *testing.T) {
	t.Setenv("AUTH_API", "1")
	if w := mcpPost(t, nil, `{"jsonrpc":"2.0","id":1,"method":"ping"}`); w.Code != http.StatusUnauthorized {
		t.Errorf("sem principal devia dar 401, deu %d", w.Code)
	}
	t.Setenv("AUTH_API", "0")
	m := &Member{ID: "x", Scopes: allScopeIDs()}
	if w := mcpPost(t, m, `{"jsonrpc":"2.0","id":1,"method":"ping"}`); w.Code != http.StatusUnauthorized {
		t.Errorf("com o login desligado o MCP fica fechado, deu %d", w.Code)
	}
	w := httptest.NewRecorder()
	handleMCP(w, httptest.NewRequest(http.MethodGet, "/api/mcp", nil))
	if w.Code != http.StatusMethodNotAllowed || w.Header().Get("Allow") != http.MethodPost {
		t.Errorf("GET devia dar 405 com Allow: POST, deu %d", w.Code)
	}
}

func TestMCPListaSoFerramentasDoEscopo(t *testing.T) {
	t.Setenv("AUTH_API", "1")
	names := func(scopes ...string) map[string]bool {
		m := &Member{ID: "token:1", Scopes: append([]string{"mcp:use"}, scopes...)}
		res, rerr := mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
		if rerr != nil {
			t.Fatalf("tools/list: %v", rerr)
		}
		out := map[string]bool{}
		for _, x := range res["tools"].([]any) {
			tool := x.(map[string]any)
			if tool["inputSchema"] == nil {
				t.Errorf("%v sem inputSchema", tool["name"])
			}
			out[tool["name"].(string)] = true
		}
		return out
	}
	if got := names(); len(got) != 0 {
		t.Errorf("só mcp:use não devia abrir ferramenta nenhuma: %v", got)
	}
	got := names("tasks:read")
	if !got["listar_tarefas"] || got["criar_tarefa"] || got["buscar_leads"] {
		t.Errorf("tasks:read devia abrir só listar_tarefas: %v", got)
	}
	got = names("leads:read", "leads:write")
	if !got["buscar_leads"] || !got["ver_lead"] || !got["anotar_oportunidade"] || got["listar_artigos"] {
		t.Errorf("leads:* devia abrir as de lead e oportunidade: %v", got)
	}
	if len(names(allScopeIDs()...)) != len(mcpTools) {
		t.Error("com todos os escopos todas as ferramentas aparecem")
	}
	for i := range mcpTools {
		if mcpToolScope(&mcpTools[i]) == "" {
			t.Errorf("%s caiu numa rota sem escopo (token nunca alcançaria)", mcpTools[i].Name)
		}
	}
}

func TestMCPChamadaPassaPelaRotaComOMesmoPrincipal(t *testing.T) {
	t.Setenv("AUTH_API", "1")
	var gotBody map[string]any
	var gotActor string
	fake := http.NewServeMux()
	fake.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) {
		if p, ok := principalOf(r); ok {
			gotActor = p.Name
		}
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &gotBody)
		if r.Method == http.MethodPost {
			writeJSON(w, http.StatusCreated, map[string]string{"id": "task_1"})
			return
		}
		writeJSON(w, http.StatusOK, []string{})
	})
	old := mcpMux
	mcpMux = fake
	t.Cleanup(func() { mcpMux = old })

	m := &Member{ID: "token:1", Name: "API: Agente", Scopes: []string{"mcp:use", "tasks:read", "tasks:write"}}
	res, rerr := mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"criar_tarefa","arguments":{"title":"Ligar","entity":"lead","entityId":"lead_1","dueAt":"2026-12-01T15:00:00-03:00"}}}`))
	if rerr != nil || res["isError"] != false {
		t.Fatalf("criar_tarefa devia funcionar: %v %v", res, rerr)
	}
	if gotActor != "API: Agente" || gotBody["title"] != "Ligar" || gotBody["entityId"] != "lead_1" || gotBody["dueAt"] == nil {
		t.Errorf("a rota devia receber o corpo e o token: actor=%q body=%v", gotActor, gotBody)
	}
	if text := res["content"].([]any)[0].(map[string]any)["text"].(string); !strings.Contains(text, "task_1") {
		t.Errorf("o agente devia ler a resposta da rota: %q", text)
	}

	// argumento faltando e prazo inválido: isError, sem chamar a rota
	gotBody = nil
	res, _ = mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"criar_tarefa","arguments":{"title":"Ligar"}}}`))
	if res["isError"] != true || gotBody != nil {
		t.Errorf("sem entity devia voltar isError sem chamar a rota: %v", res)
	}
	res, _ = mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"criar_tarefa","arguments":{"title":"x","entity":"lead","entityId":"l","dueAt":"amanhã"}}}`))
	if res["isError"] != true {
		t.Error("prazo inválido devia voltar isError")
	}

	// sem o escopo da rota: isError, a rota não é chamada
	gotBody = nil
	semEscrita := &Member{ID: "token:2", Scopes: []string{"mcp:use", "tasks:read"}}
	res, _ = mcpResult(t, mcpPost(t, semEscrita, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"criar_tarefa","arguments":{"title":"x","entity":"lead","entityId":"l"}}}`))
	if res["isError"] != true || gotBody != nil {
		t.Errorf("sem tasks:write a ferramenta não roda: %v", res)
	}
	if _, rerr := mcpResult(t, mcpPost(t, m, `{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"apagar_tudo"}}`)); rerr == nil {
		t.Error("ferramenta desconhecida devia ser erro JSON-RPC")
	}
	mcpCallsMu.Lock()
	n := len(mcpCalls)
	mcpCallsMu.Unlock()
	if n == 0 {
		t.Error("as chamadas deviam ficar registradas para a aba MCP")
	}
}

func TestMCPRotaExigeMcpUse(t *testing.T) {
	for _, p := range []string{"/api/mcp", "/api/mcp/info"} {
		s, public := routeScope(httptest.NewRequest(http.MethodPost, p, nil))
		if s != "mcp:use" || public || !tokenAllowed(s) {
			t.Errorf("%s devia exigir mcp:use e aceitar token: %q %v", p, s, public)
		}
	}
	if !hasScope(managerScopes, "mcp:use") || hasScope(sellerScopes, "mcp:use") {
		t.Error("mcp:use é do Gerente e do Admin, não do Vendedor")
	}
}
