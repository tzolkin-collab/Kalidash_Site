# WP0 — Auditoria do /admin: real × exemplo × quebrado

> Data: 18/10/2026. Worker: sessão WP0 (só leitura). Único arquivo criado: este relatório. Nenhum código editado, nenhum commit.
> Legenda: ✅ feito e comprovado · ⚠️ parcial / com ressalva · ❌ não feito / quebrado.

## 0. Resumo executivo

- **Real hoje (grava na API, sem flag):** Oportunidades (`/api/leads`, tabela antiga `Opportunity`), Blog (`/api/blog/*`) e a parte "Oportunidade" do Dashboard.
- **Real só com flag (`WORKFLOW_API=1`):** funis e tarefas de oportunidades (Tarefas, workflow, gate no `move`). **Real só com `CRM_API=1`:** Leads, Pessoas & Empresas, Clientes, Auditoria. Sem a flag a tela mostra o aviso de exemplo.
- **Exemplo puro (mock em memória, sem rota):** Projetos conectados/Chaves, Equipe, Webhooks de saída, Automações, E-mails (modelos e histórico).
- **Ninguém autentica:** nenhum endpoint exige login; CORS `*` em tudo, exceto `/api/public/leads`.
- **Achado urgente (processo, não de código):** havia uma API Go rodando em `localhost:8080` (PID de `go run .`, iniciada por outra sessão ou pelo usuário), com `WORKFLOW_API` ligada, `CRM_API` desligada e **dados que parecem reais** (6 oportunidades, artigos reais do blog, origem do site restrita). Isso é compatível com o `.env` de produção. Só fiz GETs nela (nenhum POST/PUT/DELETE) e **não** a iniciei. Ver §3 e risco R1.

## 1. Matriz por item do menu

Evidência: **[C]** código · **[T]** teste · **[N]** navegador · **[H]** HTTP (curl/rede).

| Item | Veredito | Rota(s) da API | Como comprovei |
|---|---|---|---|
| **Dashboard** | ⚠️ Parcial: métricas de oportunidades **reais**; Leads/tarefas/origem **não existem** | `GET /api/leads` | [C] `Dashboard.tsx` usa `useOpportunities` (só `/api/leads`); `pipelinesStore` é mock só para probabilidade/nome de etapa. [N] API ligada: "4 abertas, 6 no total, R$ 20.350", batendo com `GET /api/leads` ([H] 6 itens). API desligada: "Não foi possível falar com a API", tudo 0. **Abaixo vem a "Galeria de gráficos" rotulada "DADOS DE DEMONSTRAÇÃO" (330 oportunidades, origens etc.) na mesma página**: é estudo visual, não vem do CRM, mas está colada ao dado real (ver B7). |
| **Leads** | ⚠️ Exemplo; **real só com `CRM_API=1`** | `/api/crm/leads` (+`/{id}`), `/api/crm/history` | [C] `crmSync.ts` hidrata `leadsStore` e grava por diff; `crm_leads.go`. [N] com a API no ar mas CRM desligado (`GET /api/crm/people` → 404): banner "Dados de exemplo… fase 3". Modo "ligado" com CRM **não** foi exercitado (ver §3). [T] `crm_test.go` ok; `TestIntegrationCRM` **SKIP** (sem `TEST_DSN`). |
| **Oportunidades** | ✅ Real (Kanban/Lista) · ⚠️ misturada com exemplos | `GET/POST/PUT /api/leads`, `POST /api/leads/move`, `GET/POST /api/leads/notes` | [C] `Opportunities.tsx`, `OpportunityDetail.tsx`. [N] API ligada: "6 oportunidades" vindas do banco; API desligada: lista vazia + erro. [H] `GET /api/leads` devolve as 6. **Ressalvas:** `sampleOppsStore` (qualificar lead/"nova oportunidade" do protótipo) é mesclado à lista real (`useAllOpportunities`) e não grava; PUT só persiste `title` e `value`; POST ignora `pipeline`; "Ver leads" (9) são leads de exemplo. |
| **Tarefas e workflow** | ✅ Real **com `WORKFLOW_API=1`** (ativa na API que encontrei); exemplo sem ela | `/api/pipelines[/{id}]`, `/api/tasks[/{id}]`, `/api/gate/check`, gate dentro de `POST /api/leads/move` | [C] `workflowSync.ts`, `workflow_*.go`. [N] com a API no ar: **sem banner de exemplo** em `/tarefas` e `/tarefas/q4`; rede mostra `GET /api/pipelines?archived=1` e `GET /api/tasks?entity=opportunity` (200). API desligada: banner "fase 4". [T] `workflow_test.go` ok; `TestIntegrationPipelineTaskGate` **SKIP**. Tarefas de lead/pessoa/empresa só sincronizam se `CRM_API` ligar. |
| **Pessoas & Empresas** | ⚠️ Exemplo; real só com `CRM_API=1` | `/api/crm/people`, `/api/crm/companies` (+ `/document`) | [C] `crmSync.ts`, `crm_people.go`, `crm_companies.go`. [N] banner de exemplo (CRM 404). [T] testes unitários ok, integração SKIP. |
| **Clientes** | ⚠️ Exemplo; real só com `CRM_API=1` | derivado de pessoas/empresas (`lifecycle`) | [C] `Clients.tsx` lê `peopleStore`/`companiesStore`, sem rota própria. [N] banner de exemplo. |
| **E-mails** | ❌ Exemplo + **envio de teste quebrado** | `POST /api/emails/send` (contrato incompatível) | [C] `Emails.tsx:126` envia `{to,subject,body,isHtml}`; a API (`main.go:345`) exige `opportunityId`, resolve o destinatário pelo contato da oportunidade e **ignora `to`** → o teste nunca chega a quem foi digitado. O próprio código tem um comentário "ATENÇÃO" admitindo. Modelos (`templates.ts`) e histórico (`emailLog`) são mocks. [N] "Caixa de entrada desconectada", histórico de 5 itens de exemplo. |
| **Blog** | ✅ Real | `GET/POST/PUT/DELETE /api/blog/articles`, `GET /api/blog/article`, `POST /api/blog/upload`, `GET/PUT /api/blog/settings` | [C] `lib/blog.ts`. [N] API ligada: galeria/lista carregam (`GET /api/blog/articles` 200); API desligada: "Não foi possível falar com a API" + "Tentar de novo". [H] devolve artigos. [T] `storage_test.go` (upload) ok. Upload depende das credenciais R2 (não verificadas). **Sem auth:** qualquer um com acesso à API cria/apaga artigos. |
| **Automações** | ❌ Exemplo (sem API nenhuma) | nenhuma | [C] `Automations.tsx` só lê `mocks/automations.ts`, templates e pipelines mock. [N] banner "fase 5" nos dois modos. Algumas ações (ex.: "Notificar a equipe") geram notificação local no navegador; nada é persistido ou executado no servidor. |
| **Projetos conectados** (+ Chaves, `connect.js`) | ❌ Exemplo | nenhuma | [C] `Projects.tsx` só lê `mocks/projects.ts`; chave "gerada" no navegador. Não existe `ApiKey`/`Project` na API. [N] banner "chave de exemplo… não existe no servidor", nos dois modos. |
| **Configurações → Perfil/Equipe/Perfis** | ❌ Exemplo | nenhuma | [C] `Settings.tsx` usa `teamStore`/`CURRENT_USER_ID` (mock); `permissions.ts` **simula** o perfil (padrão ADMIN). Não há tabela de equipe/login. [N] banner de exemplo. |
| **Configurações → Webhooks de saída** | ❌ Exemplo | nenhuma | [C] `webhooksStore` mock; API não dispara nada. |
| **Configurações → Auditoria** | ⚠️ Exemplo; **real com `CRM_API=1`** | `/api/crm/history` | [C] `Settings.tsx:243`: `crmMode === 'api' ? history : auditLog(mock)`. Histórico só-acréscimo existe na API (`crm_history.go`). |
| **Configurações → Notificações** | ⚠️ Local | nenhuma | Sino/toast/aviso do navegador; histórico fica no navegador. Sem servidor (WebSocket/Web Push). Fora do menu pedido, registrado por completude. |
| **Captura pública (site → CRM)** | ⚠️ Pronta, mas grava na tabela **antiga** | `POST /api/public/leads` | [C] `public_leads.go:saveLead` cria `Contact` + `Opportunity` em `INBOUND` + `Note`; **não** cria o `Lead` do modelo v2 (`/api/crm/leads`). [T] `public_leads_test.go` ok. [H] sem `Origin` e corpo vazio → 422 (valida); `Origin: https://evil.example` → 403 "origem não permitida" (a API em execução tem `SITE_URL`/`ALLOWED_ORIGINS` configurados). |

## 2. Testes e build

Ambiente: Windows/PowerShell+Git Bash, Go e Node do PATH.

| Comando | Resultado |
|---|---|
| `go test ./...` em `apps/api` | ❌ **exit 1**: `kalidash-logs` **ok**; `kalidash-logs/scripts` **FAIL [build failed]** — `scripts\test.go:9:6: main redeclared in this block` (outra declaração em `scripts\seed.go:13:6`). Causa: `apps/api/scripts/test.go` é um arquivo **local**, ignorado pelo git (`.gitignore:26`); não está no repositório. Num clone limpo o pacote `scripts` só tem `seed.go` e não deve falhar (não testei clone limpo). |
| `go test -count=1 -v .` (pacote raiz) | ✅ `ok kalidash-logs 2.7s` — 37 `PASS`, **3 SKIP**: `TestIntegrationCRM`, `TestIntegrationHistorico`, `TestIntegrationPipelineTaskGate` (exigem `TEST_DSN`; **nenhum teste de integração rodou nesta auditoria**). |
| `go vet .` | sem saída (limpo). |
| `npm test` em `apps/admin` (`node --test tests/*.test.ts`) | ✅ 39 testes, 39 pass, 0 fail (`historyDiff`, `notify`, `salesMetrics`, `stages`, `taskAlerts`, `uploadCheck`, `workflowDiff`). Não há teste de componente nem de rede. |
| `npm run build` em `apps/admin` (`tsc -b && vite build`) | ✅ exit 0, build em 5,8 s, PWA com 23 entradas (3,6 MiB). Avisos: chunk > limite e `eval` direto em `easy-email-extensions` (terceiro). |
| `oxlint` em `apps/admin` | só **warnings** (ex.: `set-state-in-effect`, `exhaustive-deps` em `TaskWorkflow.tsx`); sem erros reportados. |

Observação: o repositório não tem teste de integração do admin contra a API nem CI visível.

## 3. Navegador, nos dois modos

**Modo "API desligada" (exemplo) — ✅ feito.** Sem tocar em nenhuma API: segundo servidor Vite do admin (porta 5180, `VITE_API_URL=http://127.0.0.1:9`, variável só de processo; nada editado). Visitei `/dashboard`, `/leads`, `/oportunidades`, `/tarefas`, `/tarefas/q4`, `/pessoas-empresas`, `/clientes`, `/emails`, `/blog`, `/automacoes`, `/projetos`, `/configuracoes`.
Resultado: Dashboard/Oportunidades/Blog mostram "Não foi possível falar com a API…"; Leads, Tarefas, Pessoas&Empresas, Clientes, Automações, Projetos, Configurações mostram o banner "Dados de exemplo… nada aqui é gravado"; Emails sem banner de exemplo no topo (só dentro do histórico). Ver bug B1.

**Modo "API ligada" com banco descartável — ❌ NÃO foi possível.** Não há Docker, `mysqld`, `mariadbd` nem `mysql` nesta máquina, e o `go.mod` não traz MySQL embutido/em memória. Não tentei instalar nada. **Não** subi a API e **não** usei o `.env`. Portanto **nada do modo CRM (`CRM_API=1`) foi visto no navegador**; para Leads/Pessoas/Empresas/Clientes/Auditoria a conclusão vem só do código e dos testes unitários.

**Observação não planejada — API já em execução.** Ao abrir o preview do admin, ele já conversava com `http://localhost:8080`: processo `kalidash-logs.exe` filho de `go run .` (PID 1340, filho do PID 10756), que eu **não** iniciei. Estado dela: `WORKFLOW_API` ligada (`/api/pipelines`, `/api/tasks` 200), `CRM_API` desligada (`/api/crm/people` 404), 6 oportunidades, artigos reais do blog, `ALLOWED_ORIGINS`/`SITE_URL` configurados. Não consigo provar qual banco é (não li `.env`), mas os dados e o ambiente indicam que **pode ser produção**. Por isso: (a) usei esta API **só para GET** (carregar telas e curl de leitura); (b) **não cliquei** em nada que gravasse (criar, mover, editar, enviar); (c) o que vi nela vale como "observado ao vivo", não como teste de gravação. **Gravações reais (POST/PUT/move/notes/blog) não foram exercitadas em tempo de execução**; a evidência de que gravam é o código e o fato de o Dashboard refletir o banco.
Desligar ou apontar essa API para um banco descartável é decisão do PO/Gustavo (ver Perguntas).

## 4. Bugs priorizados

### Bloqueia o uso em produção
- **B-S1 (segurança) — API 100% aberta.** Reprodução: `curl http://localhost:8080/api/tasks` e `/api/leads` e `/api/blog/articles` sem credencial → 200 com dados. `PUT/DELETE` em `/api/leads` e `/api/blog/articles?id=` também sem checagem [C]. É a pendência já registrada na ARCHITECTURE; escopo do WP1. Cobre também `POST /api/emails/send` (usa a chave do Resend, aceita assunto e HTML arbitrários, envia para o contato de qualquer `opportunityId`).
- **B-S2 (segurança) — CORS `*` com `Allow-Methods` PUT/DELETE.** `enableCORS` (`main.go:88`) devolve `Access-Control-Allow-Origin: *` em todas as rotas, exceto `/api/public/leads`. Reprodução: `curl -i -X OPTIONS -H "Origin: https://evil.example" -H "Access-Control-Request-Method: PUT" http://localhost:8080/api/leads` → `Allow-Origin: *`. Qualquer página aberta no navegador de alguém na rede pode ler/gravar (só não envia cookie, mas, sem auth, não precisa).
- **B-S3 (segurança) — credencial em arquivo local.** `apps/api/scripts/test.go` (gitignored, não está no repo) contém uma conexão MySQL com usuário/senha/host literais. Não repito os valores. Risco: vazar por backup, compartilhamento da pasta, ou se o `.gitignore` mudar; e a credencial deve ser tratada como exposta e rotacionada se for a de produção. Além disso quebra `go test ./...` (§2).
- **B-D1 — `created_at` zerado em todas as oportunidades.** Reprodução: `curl localhost:8080/api/leads` → os 6 itens vêm com `"created_at":"0001-01-01T00:00:00Z"`. Causa provável (hipótese, não confirmada sem ler o DSN/banco): `main.go:149` faz `time.Parse("2006-01-02 15:04:05.999", …)` sobre a string devolvida pelo driver e descarta o erro (`parsedTime, _ :=`); se o DSN tem `parseTime=true` o formato muda e o parse falha. Mesmo trecho vale para `wonAt` (todas as 2 ganhas vieram `wonAt:null`; o Dashboard avisa "2 ganhas não têm data"). Impacto: nenhuma ordenação/filtro por criação funciona; "Ganho no período" fica sempre vazio; risco de o WP3 (leitura de histórico) herdar o erro.
- **B-F1 — "Nova Oportunidade" sem tratamento de falha.** `Opportunities.tsx:130-` faz `fetch(...).then(res => res.json()).then(created => setOpportunities([created,…]))` sem `catch` nem checagem de `res.ok`. Reprodução (modo desligado, porta 5180): abrir `/#/oportunidades`, clicar "Nova Oportunidade" → nada acontece na tela; no console: `Uncaught (in promise) TypeError: Failed to fetch at createOpportunity`. Se a API responder 4xx/5xx com texto (`http.Error`), `res.json()` falha do mesmo jeito; se responder JSON de erro, o objeto de erro entraria na lista como "oportunidade".

### Incomoda
- **B-F2 — Envio de teste de e-mail nunca chega ao destinatário digitado** (§1, E-mails). Reprodução: abrir Emails → Modelos visuais → enviar teste; a API recebe `{to,subject,body,isHtml}` sem `opportunityId` → 404 "Oportunidade não encontrada…" (ou 500 se faltar `RESEND_API_KEY`); a tela diz "A API não aceitou o envio".
- **B-F3 — Mistura de real com exemplo sem aviso (Oportunidades e Dashboard).** Oportunidades mostra dado real + `sampleOppsStore` + "Ver leads (9)" de exemplo, sem banner; o Dashboard mostra métricas reais seguidas da galeria de "dados de demonstração" (330 oportunidades etc.). Quem olha rápido pode ler os números de demonstração como reais. O critério 2 da definição de pronto ("Nenhuma tela opera em exemplo sem deixar explícito") fica só parcialmente atendido.
- **B-F4 — Banner de exemplo cita "fase N do plano" mesmo ligado/irrelevante** e a Auditoria só vira real com `CRM_API`; texto do banner de Configurações diz que o login "fica por último", mas o contrato v2 e o checklist colocam login até a Entrega 4 (texto desatualizado).
- **B-F5 — PUT `/api/leads` só persiste título e valor** (`main.go:212`): estágio, prioridade, tags, contatos e dono editados na ficha não vão para o banco; POST ignora `pipeline`. Reprodução: editar tags/prioridade na ficha de uma oportunidade real, recarregar → volta ao antigo [C]. (Não reproduzido no navegador para não gravar na API em execução.)
- **B-F6 — Service worker de dev falha em porta alternativa** (`Failed to register a ServiceWorker… dev-sw.js`), só quando o admin sobe fora da 5173. Não afeta produção.

### Cosmético
- **B-C1 —** `Dashboard`: textos "em tempo real" e "Atualizar" sem polling/auto refresh.
- **B-C2 —** `ARCHITECTURE.md` mantém duas linhas "Equipe e Configurações" (a segunda duplicada dentro da tabela de páginas do admin) e a seção "Status por módulo (27/09/2026)" ainda diz que o login está "Planejado"; docs/pagesAdmin/projects.md ainda diz "Status: planejado" embora a tela exista como mock.
- **B-C3 —** `oxlint` warnings em `TaskWorkflow.tsx` (set-state-in-effect, exhaustive-deps).

## 5. Lacunas docs × código

| Doc | O que o doc diz | O que o código faz |
|---|---|---|
| `pagesAdmin/dashboard.md` | Funil de "Entrada, Qualificação e Ganho"; leads/origem/tarefas "entram com fases 3 e 4"; seção "Requisitos" vazia | O funil usa as etapas do funil mock (Qualificação, Proposta, Negociação, Assinatura, Ganho). Há uma galeria inteira de "estudo visual" (13+ gráficos de demonstração) que **não está documentada**. |
| `pagesAdmin/crm.md` | Cartão com "próxima tarefa", dono, stakeholders por oportunidade, motivo de perda, "Agendar call", exportação CSV, ações em massa, SLA com borda vermelha, WebSocket e Web Push em tempo real, round-robin | Não verifiquei cada item na UI; pelo código e pela ARCHITECTURE: WebSocket/Push, SLA, round-robin, export CSV e ações em massa **não existem**; contatos por oportunidade e tags de contato **não estão na API**. A API grava só título/valor/estágio da oportunidade. |
| `pagesAdmin/projects.md` | "Status: planejado"; chaves `kld_live_…`, SHA-256, escopos, revogação imediata, "último uso", rate limit | Tela existe como mock; **nenhum** item do servidor existe (sem tabela `ApiKey`, sem `connect.js`, sem endpoint `forms:write`). A única entrada pública real é `POST /api/public/leads`, sem chave, protegida só por `Origin` + 5/min por IP. |
| `pagesAdmin/settings.md` | Webhooks assíncronos com retry/backoff; auditoria "quem fez o quê"; gestão de equipe e perfis; JWT curto + refresh `httpOnly` | Tudo mock (equipe, webhooks). A Auditoria real registra mudanças do CRM mas **sem usuário real** (sem login). Não há JWT/sessão. |
| `docs/dominio.md` / ARCHITECTURE (ciclo lead→oportunidade) | Lead é registro próprio; formulário cria **Lead** | `POST /api/public/leads` cria `Opportunity INBOUND`, não `Lead`. Há dois caminhos paralelos (tabela antiga × `CRM_API`). Decisão necessária (Perguntas P2). |
| ARCHITECTURE (segurança) | "Rate limiter 5 leads/min"; "CORS restrito"; "sanitização do HTML" | Rate limit existe só no público e é em memória (reinicia no deploy, por IP do `RemoteAddr`, sem `X-Forwarded-For` — atrás de proxy conta o IP do proxy). CORS restrito só na rota pública. Sanitização do HTML do blog **não existe** (a própria ARCHITECTURE admite). |
| `index.md` → "API: Go… Auth" | API central com auth e ingestão de leads | Sem auth; ingestão só pela rota pública acima. |

## 6. Autenticação e CORS (lido no código)

- **Autenticação:** nenhum endpoint exige credencial. Busquei `Authorization|Bearer|auth` em `apps/api/*.go`: só aparece o `Authorization: Bearer` **de saída** para o Resend (`main.go`); não há middleware, sessão, cookie nem checagem de usuário. Os 20+ handlers registrados em `main.go:430-438`, `registerWorkflowRoutes` e `registerCRMRoutes` são todos abertos. Exceção apenas de *intenção* de público: `POST /api/public/leads`. O `X-Revalidate-Secret` protege o `/api/revalidate` **do site** (chamada de saída da API para o Next), não a API.
- **CORS:** `enableCORS` (`main.go:88`) em todas as rotas, exceto a pública: `Access-Control-Allow-Origin: *`, `Allow-Methods: POST, GET, OPTIONS, PUT, DELETE`, `Allow-Headers: Content-Type` (sem `Authorization`: o login com token por header exigirá ajustar), `Expose-Headers: X-Total-Count`. A rota pública valida `Origin` contra `ALLOWED_ORIGINS` + `SITE_URL` (aceita `https://*.vercel.app`), responde 403 para origem não listada e reflete a origem aceita; **se nenhuma estiver configurada, aceita qualquer origem** (modo dev). Confirmado por curl: `evil.example` → 403 na API em execução.
- Outros: sem limite de tamanho de corpo nas rotas autenticáveis (só o público usa `MaxBytesReader`); `handleBlogUpload` tem limites próprios (storage).

## 7. O que ficou de fora

- Modo ligado com banco descartável e `CRM_API=1`/`WORKFLOW_API=1` (sem MySQL/Docker na máquina). Logo: **integração (`TestIntegration*`) não rodou**, e criar/mover/editar de ponta a ponta não foi exercitado.
- Qualquer gravação pelo navegador contra a API em execução (por risco de ser produção).
- Verificação do upload R2 (sem credenciais reais, e não deve ser tentado).
- Teste em clone limpo para confirmar que `go test ./...` passa sem o `test.go` local.
- Itens do `crm.md` não verificados um a um na UI (o doc é longo; priorizei o menu).
- Mobile/PWA/instalação.

## 8. Riscos

- **R1 (alto):** API local ligada a algo que parece produção, com flags de escrita ligadas e sem auth. Qualquer sessão ou usuário que clique em "Nova oportunidade", mova um card ou salve um artigo grava no banco real. Recomendo confirmar de quem é o processo e apontar para base descartável antes do WP1/WP3.
- **R2 (alto):** credencial de banco em arquivo local (`scripts/test.go`) — rotacionar se for a de produção.
- **R3 (médio):** `created_at`/`wonAt` zerados (B-D1) corrompem relatórios e qualquer migração/histórico que dependa de datas.
- **R4 (médio):** dois caminhos de lead (Opportunity × Lead v2) vão divergir se a captura pública for ligada ao formulário antes da decisão.
- **R5 (médio):** `CRM_API`/`DATA_KEY` nunca foram executados contra MySQL real nesta máquina; WP3 deve ter container disponível (instalar Docker ou usar MariaDB portátil).
- **R6 (baixo):** rate limit em memória e por IP do socket.

## 9. Perguntas de produto para o PO

- **P1.** A API em `localhost:8080` (PID de `go run .`) aponta para produção? Quem a mantém ligada? Posso derrubá-la/pará-la antes do WP1?
- **P2.** O formulário do site deve criar **Lead** (modelo v2, `CRM_API`) ou continuar criando **Oportunidade INBOUND** (tabela antiga)? Precisa ser decidido antes de ligar `NEXT_PUBLIC_LEAD_ENDPOINT`.
- **P3.** A galeria de "estudo visual" do Dashboard fica? Se sim, deve ficar atrás de aviso/aba separada (hoje fica colada às métricas reais).
- **P4.** E-mails: remover o envio de teste do template até haver API própria (Gmail API), ou corrigir o contrato com Resend provisório?

## 10. O que o Gustavo precisa fazer

1. Decidir sobre a API em execução (P1) e **rotacionar** a credencial do banco se `scripts/test.go` tiver a de produção; apagar ou limpar esse arquivo local.
2. Disponibilizar um MySQL/MariaDB descartável (Docker Desktop ou um MariaDB portátil) para o WP3 e para repetir o modo "ligado" desta auditoria.
3. Responder P2–P4.
