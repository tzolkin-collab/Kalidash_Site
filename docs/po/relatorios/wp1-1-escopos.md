# Relatório WP1.1 — Permissões por escopo + tokens de API

Entregue em 18/10/2026. Tudo atrás de `AUTH_API=1` (desligada por padrão; sem ela nada muda). Nada foi executado contra o banco real nem com o `apps/api/.env`: a API de verificação rodou de uma pasta fora do repositório (scratchpad), com `DSN` apontando para um MySQL em memória (go-mysql-server, `127.0.0.1:3307`), e já foi desligada, junto do admin (`5174`). Não toquei em `apps/site`.

## (c) Commits

| Hash | Mensagem |
|---|---|
| `1801990` | feat(api): escopos de permissão (perfis viram presets), extras/removidos por pessoa e tokens de API |
| `d52174f` | feat(admin): telas de Permissões por escopo e Tokens de API em Configurações |
| (este) | docs: auth-study, settings, ARCHITECTURE e este relatório |

## (a) Checklist

| Item | Estado | Evidência |
|---|---|---|
| Catálogo de escopos + `routeScope` (tabela única), mapeando a matriz antiga | ✅ | `auth_scopes.go`: 19 escopos em 5 áreas. `TestRotaExigeEscopo` (29 rotas × método → escopo; exige que todo escopo proteja uma rota, exceto `leads:origin`, que é checado no handler, e `automations:manage`, marcado `Reserved`) |
| Perfis viram presets (Vendedor 11, Gerente 18, Admin 19) sem mudar o que cada um podia | ✅ | `TestCatalogoEPresets` (Vendedor ⊂ Gerente ⊂ Admin; o que era só de Admin/Gerente segue fora do Vendedor); a matriz antiga `TestPerfisNoServidor` (13 rotas × 3 perfis) e `TestRegrasFinasPorConteudo` passam **sem alteração** |
| Extras e removidos por pessoa; efetivos = (preset ∪ extras) − removidos | ✅ | `TestEfetivosSomamExtrasETiramRemovidos`, `TestExtrasERemovidosValemNaHora` (conceder `blog:read`, tirar `emails:send`: vale na próxima chamada; `/auth/me` devolve os efetivos), integração em MySQL (`SetMemberScopes`, CPF com `people:document` extra, Gerente sem `leads:origin`/`pipelines:manage`) |
| 401/403 provados **por escopo** | ✅ | `TestCadaEscopoAbreSoSuaRota`: para 16 rotas, sem sessão → 401; uma pessoa com **só** aquele escopo passa naquela rota e recebe 403 em todas as outras 15 |
| Admin raiz sempre com todos os escopos | ✅ | `TestEdicaoDeEscoposRegras` (removidos gravados à mão no banco não valem para a raiz; a tela devolve 409 ao tentar tirar) |
| Regras de edição: ninguém concede o que não tem; ninguém mexe no próprio acesso; sempre sobra um `team:manage`; normalização | ✅ | `TestEdicaoDeEscoposRegras`, `TestSemTeamManageNinguemSobra` |
| Compatível com o que existe; `AUTH_API` desligada não muda nada | ✅ | `TestComFlagDesligadaNadaMuda` (inclui `requireScopeFor` devolvendo `true`); migração de um `TeamMember` criado pelo WP1 (sem as colunas) testada em MySQL: linha mantida, escopos = preset |
| Tokens: escopos escolhidos, sem expiração por padrão, validade opcional | ✅ | `TestTokenSemExpiracaoPorPadraoEUltimoUso` (token "de 10 anos" sem validade segue valendo), `TestTokenInvalidoRevogadoExpirado` (validade futura ok; expirado → 401; data passada na criação → 422) |
| Prefixo visível, completo **uma única vez**, só o hash guardado | ✅ | `TestTokenCriacaoMostraSegredoUmaVez` (hash = SHA-256 do segredo, 64 hex, segredo ausente da listagem; `Cache-Control: no-store`); em MySQL: `SELECT … WHERE tokenHash/name/prefix = <segredo>` → 0 linhas |
| Revogação imediata, último uso | ✅ | `TestTokenInvalidoRevogadoExpirado` (200 → revoga → 401 na mesma hora; revogar de novo é idempotente), último uso grava ≤1x/min (`store.touch == 1` após 4 chamadas; regrava depois do intervalo; também em MySQL). Navegador: `curl` 401 logo após clicar **Revogar agora** |
| Aceitos em `Authorization: Bearer` | ✅ | `TestTokenNoBearerRespeitaEscopos` (200/403 por escopo, rotas públicas seguem públicas, rota sem mapa → 403 para token), cookie bom + token ruim → 401; cabeçalho não-Bearer → 401 |
| Token não escala privilégio | ✅ | `TestTokenNaoEscalaPrivilegio` (Vendedor não cria; Gerente só com os escopos que tem), `TestTokenEscopoHumanoNuncaVale` (`team:manage`/`keys:manage` recusados na criação e ignorados mesmo com banco adulterado), `TestTokenPublicoEOriginIntactos` (anti-CSRF por `Origin` vale também para token) |
| Gancho do WP2 documentado, sem duplicar | ✅ | `auth-study.md` → "Gancho para o WP2": o que já existe e o que sobra (`kld_test_`, `projectId`, `forms:write`/`analytics:write`/`ads:read`, endpoint do `connect.js`, limite de taxa por chave) |
| Admin: Permissões (presets de um clique, resumo, escopos por área, Extra/Removida, barra de salvar) | ✅ | Navegador (abaixo) |
| Admin: Tokens (criar com atalhos e validade, mostrar uma vez, copiar, listar, revogar) | ✅ | Navegador (abaixo) |
| Estados vazio, carregando, erro, sem permissão, sem login; responsivo; dark mode | ✅ | Navegador (abaixo); erro de carregamento usa `LoadError` com *Tentar de novo* (não provoquei uma falha de rede para ver na tela: **só por leitura de código**) |
| Testes unitários e de integração; build limpo | ✅ | `go vet .` limpo. `go test -count=1 .`: **76 PASS, 5 SKIP** (integração sem `TEST_DSN`); com `TEST_DSN=…@tcp(127.0.0.1:3307)/kalidash_test`: **81 PASS, 0 SKIP**. Admin: `npm test` **52 PASS** (+10: `scopes.test.ts`, `roles.test.ts`), `tsc -b` e `npm run build` limpos, `oxlint` sem avisos nos arquivos novos |
| Docs atualizados | ✅ | `docs/pagesAdmin/settings.md`, `docs/ARCHITECTURE.md`, `docs/auth-study.md` (seção "Escopos e tokens de API") |

### Verificação no navegador (admin `localhost:5174`, API `localhost:8090`, MySQL em memória)

1. Admin raiz entra pelo login de desenvolvimento. **Configurações → Permissões**: lista da equipe, perfil base em 3 cartões, resumo por área, escopos agrupados. A conta raiz aparece com "19 de 19" e tudo travado, com o aviso do `AUTH_ROOT_ADMIN`.
2. Diego (Vendedor, 2 extras e 1 removida criados por `curl`) aparece com ponto roxo e "personalizado"; as marcas *Extra* e *Removida* estão certas. Liguei `leads:origin`: surgiu a barra "1 alteração não salva em Diego Costa"; **Salvar permissões** gravou e a API passou a devolver `scopesExtra = [blog:read, leads:origin, people:document]`.
3. **Tokens de API** vazio: estado vazio com exemplo de `curl`. **Criar token** → nome "Zapier - leads do site", atalho *Leitura e escrita do CRM*, validade "Nunca expira (padrão)" → diálogo "Copie o token agora" com o segredo e o `curl`. Com esse token, por `curl`: `/api/crm/leads` e `/api/crm/people` → 404 (passou da autorização; este processo não liga o CRM), `/api/pipelines`, `/api/team`, `/api/tokens`, `/api/blog/articles` → **403**, token inventado → **401**.
4. Recarregando, a lista mostra o prefixo mascarado, 3 escopos + "+3", **último uso "agora há pouco"** e "Nunca expira". **Revogar** → confirmação → `curl` com o mesmo token deu **401** imediatamente; o token foi para "Mostrar revogados e expirados (1)".
5. Dark mode (tema do app) e celular (375 px): sem rolagem horizontal (`scrollWidth == clientWidth`); a lista de pessoas vira uma faixa rolável.
6. Entrando como Diego: **Tokens de API** diz "Sem permissão para tokens"; **Permissões** abre só leitura com "Você não pode mudar o seu próprio acesso"; Blog some do menu (ele tem só `blog:read`, e o item exige `blog:write`).

## (b) Arquivos alterados

API: `auth_scopes.go` (novo), `auth_tokens.go` (novo), `auth_store.go`, `auth_middleware.go` (agora `withAuth` por escopo + Bearer; `routeAccess` saiu), `auth_rules.go`, `auth_google.go` (rotas novas e edição de escopos na equipe), `auth_test.go`, `auth_scopes_test.go` (novo), `auth_integration_test.go`.
Admin: `components/Access.tsx` (novo), `access.css` (novo), `lib/scopes.ts` (novo, lógica pura), `lib/accessSync.ts` (novo), `lib/roles.ts`, `lib/permissions.ts`, `lib/auth.ts`, `lib/teamSync.ts`, `domain.ts`, `pages/Settings.tsx`, `tests/scopes.test.ts` (novo), `tests/roles.test.ts`.
Docs: `docs/pagesAdmin/settings.md`, `docs/ARCHITECTURE.md`, `docs/auth-study.md`, este relatório.

## (d) O que ficou de fora e por quê

- **Escopos de `forms:write`, `analytics:write`, `ads:read`, chaves `kld_test_`, projeto conectado, endpoint do `connect.js`, limite de taxa por chave:** são do WP2 (pedido: deixar o gancho). `ApiToken` aceita `ADD COLUMN env, projectId`.
- **`automations:manage`** existe e é concedível, mas **não há rota** que o exija (a API de automações ainda não existe): aparece "Em breve" na tela.
- **Auditoria em tabela** de quem mudou permissão ou criou/revogou token: vai para o log do servidor (`AUTH: …`, sem o segredo), como no WP1.
- **Limite de tentativas** com token inválido (o segredo tem 256 bits, então força bruta não é prática, mas não há bloqueio por IP).
- **Escopos por recurso** (ex.: "só leads de um funil") e o Vendedor ver só as oportunidades dele: continuam fora, como no WP1.
- O admin ainda tem uma cópia dos presets em `lib/roles.ts` para o modo sem login; com login ligado ele usa o catálogo do servidor (`GET /api/access/catalog`) e os escopos de `/auth/me`.

## (e) Riscos

1. **Testado em MySQL em memória (go-mysql-server), não em MySQL/MariaDB real.** A migração (`ALTER TABLE … ADD COLUMN` condicionado a `columnExists`) e o `SELECT … FOR UPDATE` do WP1 precisam passar em MySQL de verdade antes de ligar; rodar `TEST_DSN=… go test -run IntegrationAuth` num MySQL/MariaDB descartável junto do roteiro do WP3.
2. **Token = a organização, não a pessoa.** Desativar quem criou **não** revoga os tokens dele (para não derrubar integrações sem aviso). O contrário seria mais seguro e quebra automações. **Decisão de produto pendente (PO):** manter ou revogar junto?
3. **Gerente tem `keys:manage` por padrão** (alinhado ao WP2: "Admin/Gerente emitem"), mas só com escopos que ele próprio tem, e nunca `team:manage`/`keys:manage`. Um token de Gerente com `people:document` revela CPF: quem emite é responsável por guardar o segredo.
4. **Rota nova sem entrada em `routeScope`** é acessível a pessoas logadas (como antes) mas **negada a tokens** (de propósito). Quem criar rota nova precisa mapear o escopo e acrescentar a linha em `TestRotaExigeEscopo`.
5. O "último uso" tem precisão de 1 minuto e o IP vem de `X-Forwarded-For` quando existe (atrás do proxy do EasyPanel/Traefik, como no resto da API).
6. Havia mudanças de outras sessões não commitadas na árvore (`main.go`, `workflow_tasks.go`, páginas do admin). **Não as incluí** nos meus commits (`git add` só dos meus arquivos).

## (f) O que o Gustavo precisa fazer

1. Tudo do WP1 continua valendo (OAuth Client ID, domínio, `AUTH_ROOT_ADMIN`, backup antes de ligar a flag).
2. **Decidir** (risco 2): tokens sobrevivem à desativação de quem os criou? Hoje sim.
3. Depois de ligar `AUTH_API=1` em produção, abrir **Configurações → Permissões** e conferir a equipe (por padrão todos seguem com o preset do perfil, idêntico ao que era). Criar tokens só em **Tokens de API**, copiar o segredo na hora para um cofre de senhas.
4. Rodar a suíte de integração em MySQL/MariaDB real e descartável antes de ligar (risco 1).
