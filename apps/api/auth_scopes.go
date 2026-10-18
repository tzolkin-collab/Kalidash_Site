package main

import (
	"net/http"
	"sort"
	"strings"
)

// Escopos: a unidade de permissão (docs/auth-study.md, "Escopos e tokens"). O servidor só pergunta
// "esta pessoa/token tem o escopo X?". Os perfis Admin/Gerente/Vendedor viraram PRESETS (conjuntos
// padrão de escopos) e cada pessoa pode ter escopos extras (scopesExtra) ou removidos (scopesDenied).
//
//	efetivos = (preset do perfil ∪ extras) − removidos        o Admin raiz (AUTH_ROOT_ADMIN) sempre tem todos
//
// Esta tabela é a ÚNICA fonte da verdade; o admin lê o catálogo em GET /api/access/catalog.
// Sem AUTH_API=1 nada disto age.

type scopeDef struct {
	ID    string `json:"id"`
	Group string `json:"group"`
	Label string `json:"label"`
	Desc  string `json:"description"`
	// HumanOnly: só pessoas têm (nunca um token de API). Quem administra acessos não pode ser automatizado.
	HumanOnly bool `json:"humanOnly,omitempty"`
	// Reserved: o escopo existe e pode ser concedido, mas a API ainda não tem rota que o exija (gancho).
	Reserved bool `json:"reserved,omitempty"`
	// Publishable: escopo de escrita que pode ir no HTML (connect.js). Um token com escopo publicável não
	// carrega nenhum outro (ver validateTokenScopes): leitura nunca fica exposta no snippet.
	Publishable bool `json:"publishable,omitempty"`
}

// scopeGroups mantém a ordem de exibição das áreas.
var scopeGroups = []string{"CRM", "Funis e tarefas", "Conteúdo", "Automação", "Conexão de LPs", "Administração"}

var scopeCatalog = []scopeDef{
	{ID: "leads:read", Group: "CRM", Label: "Ver leads e oportunidades", Desc: "Lista e abre leads, oportunidades e notas."},
	{ID: "leads:write", Group: "CRM", Label: "Criar e editar leads", Desc: "Cria, edita, move de etapa e anota leads e oportunidades."},
	{ID: "leads:origin", Group: "CRM", Label: "Trocar origem e fonte do lead", Desc: "Altera a origem e a fonte de um lead que já existe."},
	{ID: "people:read", Group: "CRM", Label: "Ver pessoas e empresas", Desc: "Lê contatos e empresas (CPF sempre mascarado)."},
	{ID: "people:write", Group: "CRM", Label: "Editar pessoas e empresas", Desc: "Cria, edita e remove contatos e empresas."},
	{ID: "people:document", Group: "CRM", Label: "Ver e alterar o CPF", Desc: "Revela o CPF inteiro e envia um CPF novo."},
	{ID: "history:read", Group: "CRM", Label: "Ver o histórico", Desc: "Lê o registro de quem mudou o quê."},
	{ID: "history:write", Group: "CRM", Label: "Gravar no histórico", Desc: "Registra mudanças feitas pelas telas."},
	{ID: "pipelines:read", Group: "Funis e tarefas", Label: "Ver funis", Desc: "Lê funis, etapas, fontes, tags e templates."},
	{ID: "pipelines:manage", Group: "Funis e tarefas", Label: "Gerenciar funis", Desc: "Cria e altera funis, fontes, tags e templates."},
	{ID: "tasks:read", Group: "Funis e tarefas", Label: "Ver tarefas", Desc: "Lê tarefas e confere os requisitos de uma etapa."},
	{ID: "tasks:write", Group: "Funis e tarefas", Label: "Criar e editar tarefas", Desc: "Cria, conclui e edita tarefas."},
	{ID: "blog:read", Group: "Conteúdo", Label: "Ver o blog (inclui rascunhos)", Desc: "Lê rascunhos e configurações. Artigos publicados são públicos."},
	{ID: "blog:write", Group: "Conteúdo", Label: "Escrever no blog", Desc: "Cria, edita, publica e envia imagens."},
	{ID: "emails:send", Group: "Conteúdo", Label: "Enviar e-mails", Desc: "Dispara e-mails pela conta de envio."},
	{ID: "automations:manage", Group: "Automação", Label: "Gerenciar automações", Desc: "Cria e altera automações e gatilhos.", Reserved: true},
	{ID: "forms:write", Group: "Conexão de LPs", Label: "Enviar formulários (connect.js)", Desc: "Cria leads vindos de um projeto conectado. Pode ir no HTML da página.", Publishable: true},
	{ID: "analytics:write", Group: "Conexão de LPs", Label: "Enviar eventos (analytics)", Desc: "Pageview e origem de um projeto conectado. Pode ir no HTML.", Publishable: true, Reserved: true},
	{ID: "ads:read", Group: "Conexão de LPs", Label: "Ler mídia paga", Desc: "Sincroniza custo e CPL das contas de anúncios. Nunca no HTML.", Reserved: true},
	{ID: "team:read", Group: "Administração", Label: "Ver a equipe", Desc: "Lê nomes, e-mails e perfis (alimenta os seletores de responsável)."},
	{ID: "team:manage", Group: "Administração", Label: "Gerenciar equipe e permissões", Desc: "Convida, muda perfil, escopos e desativa pessoas.", HumanOnly: true},
	{ID: "keys:manage", Group: "Administração", Label: "Gerenciar tokens de API", Desc: "Cria e revoga tokens (só com escopos que a própria pessoa tem).", HumanOnly: true},
}

var scopeIndex = func() map[string]scopeDef {
	m := map[string]scopeDef{}
	for _, s := range scopeCatalog {
		m[s.ID] = s
	}
	return m
}()

func validScope(id string) bool { _, ok := scopeIndex[id]; return ok }

func allScopeIDs() []string {
	out := make([]string, 0, len(scopeCatalog))
	for _, s := range scopeCatalog {
		out = append(out, s.ID)
	}
	return out
}

// Presets dos perfis. O Vendedor tem exatamente o que a tabela antiga (accAny) lhe dava; o Gerente soma
// o que era de Admin/Gerente; o Admin tem tudo.
var sellerScopes = []string{
	"leads:read", "leads:write", "people:read", "people:write", "history:read", "history:write",
	"pipelines:read", "tasks:read", "tasks:write", "emails:send", "team:read",
}

var managerScopes = append(append([]string{}, sellerScopes...),
	"leads:origin", "people:document", "pipelines:manage", "blog:read", "blog:write", "automations:manage", "keys:manage",
	"forms:write", "analytics:write", "ads:read")

func presetScopes(role string) []string {
	switch role {
	case roleAdmin:
		return allScopeIDs()
	case roleManager:
		return managerScopes
	case roleSeller:
		return sellerScopes
	}
	return nil
}

// normScopes remove repetidos e desconhecidos, ordena e devolve nunca-nil.
func normScopes(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, s := range in {
		s = strings.TrimSpace(s)
		if validScope(s) && !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	sort.Strings(out)
	return out
}

// unknownScopes devolve os ids que não existem no catálogo (para responder 422 em vez de ignorar).
func unknownScopes(in []string) []string {
	var bad []string
	for _, s := range in {
		if !validScope(strings.TrimSpace(s)) {
			bad = append(bad, s)
		}
	}
	return bad
}

// effectiveScopes = (preset ∪ extras) − removidos. A conta raiz ignora os removidos.
func effectiveScopes(role string, extra, denied []string, isRoot bool) []string {
	if isRoot {
		return allScopeIDs()
	}
	set := map[string]bool{}
	for _, s := range presetScopes(role) {
		set[s] = true
	}
	for _, s := range extra {
		set[s] = true
	}
	for _, s := range denied {
		delete(set, s)
	}
	out := make([]string, 0, len(set))
	for s := range set {
		if validScope(s) {
			out = append(out, s)
		}
	}
	sort.Strings(out)
	return out
}

// computeScopes preenche os escopos efetivos do membro (chamado ao ler do armazenamento).
func computeScopes(m *Member) {
	m.Extra, m.Denied = normScopes(m.Extra), normScopes(m.Denied)
	m.Scopes = effectiveScopes(m.Role, m.Extra, m.Denied, m.Root)
}

func hasScope(have []string, want string) bool {
	for _, s := range have {
		if s == want {
			return true
		}
	}
	return false
}

// ---- escopo exigido por rota ----

// routeScope diz o que a rota exige. public=true: sem login, de propósito (cada exceção tem o motivo).
// scope=="" sem public: basta estar logado como pessoa (token nunca passa por aqui: ver tokenAllowed).
// É a ÚNICA tabela de quem pode o quê por rota. Regras finas por conteúdo (CPF novo, origem do lead)
// ficam nos handlers: requireScopeFor.
func routeScope(r *http.Request) (scope string, public bool) {
	p, m := r.URL.Path, r.Method
	read := m == http.MethodGet || m == http.MethodHead
	pick := func(readScope, writeScope string) string {
		if read {
			return readScope
		}
		return writeScope
	}
	switch {
	case !strings.HasPrefix(p, "/api/"):
		// /auth/* tem login/callback/logout/me, que se autenticam por conta própria. O resto nem existe (404).
		return "", true
	case p == "/api/public/leads":
		// Captura de lead pelos formulários das LPs. Tem origem permitida, limite por IP e honeypot próprios.
		return "", true
	case strings.HasPrefix(p, "/api/connect/"):
		// Entrada do connect.js e da API direta. A autenticação é o token (Authorization: Bearer) com forms:write,
		// conferida no handler junto com a origem do projeto, o limite de taxa e o honeypot (connect_ingest.go).
		// Não pode passar pelo CORS do admin: a página do cliente está em outro domínio.
		return "", true
	case strings.HasPrefix(p, "/api/projects"):
		return "keys:manage", false // projetos conectados e formulários rastreados: Admin/Gerente
	case read && (p == "/api/blog/article" || p == "/api/blog/settings"):
		// O site (Next) lê o artigo publicado por slug e os textos da galeria sem login.
		return "", true
	case read && p == "/api/blog/articles" && r.URL.Query().Get("published") == "true":
		// Lista do site: só publicados. Sem ?published=true entram rascunhos e exige login.
		return "", true
	case strings.HasPrefix(p, "/api/team"):
		return pick("team:read", "team:manage"), false // a lista alimenta os seletores de responsável de qualquer tela
	case strings.HasPrefix(p, "/api/tokens"):
		return "keys:manage", false
	case p == "/api/access/catalog":
		return "", false // catálogo de escopos e presets: qualquer pessoa logada (a tela de permissões lê)
	case strings.HasPrefix(p, "/api/blog/"):
		return pick("blog:read", "blog:write"), false
	case strings.HasPrefix(p, "/api/pipelines"):
		return pick("pipelines:read", "pipelines:manage"), false
	case strings.HasPrefix(p, "/api/tasks"):
		return pick("tasks:read", "tasks:write"), false
	case p == "/api/gate/check":
		return "tasks:read", false // confere requisitos de etapa; não grava
	case strings.HasPrefix(p, "/api/crm/people/") && strings.HasSuffix(p, "/document"):
		return "people:document", false // revealCpf
	case strings.HasPrefix(p, "/api/crm/people"), strings.HasPrefix(p, "/api/crm/companies"):
		return pick("people:read", "people:write"), false
	case p == "/api/crm/history":
		return pick("history:read", "history:write"), false
	case strings.HasPrefix(p, "/api/crm/leads"), strings.HasPrefix(p, "/api/leads"):
		return pick("leads:read", "leads:write"), false
	case p == "/api/emails/send":
		return "emails:send", false
	}
	// Rota sem escopo mapeado: pessoas logadas passam (como antes); token nunca (nega por padrão).
	return "", false
}

// publishableScope diz se o escopo pode ir no HTML.
func publishableScope(id string) bool { return scopeIndex[id].Publishable }

// tokenAllowed: um token só alcança rotas com escopo mapeado e que não sejam de administração de acesso.
func tokenAllowed(scope string) bool {
	if scope == "" {
		return false
	}
	d, ok := scopeIndex[scope]
	return ok && !d.HumanOnly
}
