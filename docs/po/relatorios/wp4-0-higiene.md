# WP4-0 — Higiene de produção do front (25/10/2026)

Sessão: wp4-0 (worker). Escopo: `apps/admin` (nenhum arquivo de `apps/api` nem `apps/site` foi alterado). Decisões aplicadas: **D34** (automações de exemplo marcadas, sem contagens inventadas) e **D37** (semente só em desenvolvimento).

**Resultado:** itens 1, 3, 4, 5 e 6 ✅; item 2 ⚠️ (tudo feito, menos "desconectar a fonte limpa o vínculo", que a API atual não permite).

## Ambiente de prova (tudo descartável, fora do repositório)

- MySQL em memória (`memmysql.exe`, go-mysql-server) em `127.0.0.1:3337`, tabelas Prisma semeadas por um programa no scratchpad.
- API compilada para o scratchpad e rodada de lá (sem `.env`), porta **8107**, `WORKFLOW_API=1 CRM_API=1 AUTH_API=1 AUTH_DEV_LOGIN=1`, segredos fictícios. Admin (`vite`) na **5207** com `VITE_API_URL=http://localhost:8107` e **sem** `VITE_SEED_DEMO`. Uma segunda instância do vite (5208) apontando para uma porta morta, para o modo exemplo.
- A API de `localhost:8080` (produção) não foi tocada; nenhuma credencial lida.

## (a) Itens e evidência

### 1. B-02 / D37 — semeadura só com `VITE_SEED_DEMO=1` — ✅
- `lib/seedDemo.ts` (`SEED_DEMO`), `workflowDiff.planInitialPipelines` e `shouldSeedCrm` decidem; `workflowSync.initWorkflowSync` e `crmSync.initCrmSync` só semeiam com a flag. Sem ela e com servidor vazio, a lista de funis do navegador é **esvaziada** (`adoptPipelines([])`), para o exemplo local não ser gravado depois por diff. `apps/admin/.env.example` documenta `VITE_SEED_DEMO` (valor vazio) e `VITE_API_URL`.
- Galeria de Tarefas: estado vazio "Nenhum funil ainda. Crie o primeiro" + botão "Criar o primeiro funil" (`pages/Tasks.tsx`).
- **Teste:** `tests/workflowDiff.test.ts` ("B-02/D37…": vazio sem flag ⇒ `empty`, com flag ⇒ `seed`, servidor com dados ⇒ `adopt`; CRM só semeia com as 3 coleções vazias e a flag).
- **Navegador (modo API, servidor vazio):** abri o admin logado; a tela mostrou "Nenhum funil ai…" (estado vazio) e, **pela própria página**, `GET /api/pipelines?archived=1` ⇒ `[]`, `X-Total-Count` de `people`, `companies` e `leads` ⇒ `0`. **Zero linhas criadas.**
- **Navegador (API desligada, vite na 5208):** galeria com os 3 funis de exemplo e o aviso "Dados de exemplo", como antes.

### 2. B-05 — "Conectar fonte" com projetos reais — ⚠️ (menos o desconectar)
- `lib/sourceLink.ts` (puro) + `lib/projectSources.ts` (liga as stores). Com a API ligada, `ConnectSourcePanel` lista `GET /api/projects` (projeto › formulários) e **não** o mock; conectar faz `PUT /api/projects/{id}` com `pipelineId`, `stageId` = **primeira etapa de tipo Lead** do funil e `sourceName`. Funil sem etapa Lead: o painel avisa e bloqueia. Projeto que hoje alimenta outro funil: aviso "passa a alimentar só este funil" (um formulário/projeto alimenta uma só pipeline).
- **Única verdade:** as fontes de formulário do funil são **derivadas** dos projetos (`withProjectSources`) e **não** vão no corpo do `PUT /api/pipelines` nem contam como edição (`pipelineProjection` e `writableSources` as ignoram); as legadas do `config` são descartadas ao carregar. Cadastro manual, importação e API continuam no `config`. "Sem fonte" só aparece se nenhum projeto aponta para o funil; quem não lê projetos (sem `keys:manage`) vê "Fontes indisponíveis" em vez de um "Sem fonte" falso.
- Em modo API o painel não cria mais a "automação gerenciada" de mentira; no modo exemplo, continua, marcada como exemplo.
- **Testes:** `tests/sourceLink.test.ts` (5 testes: derivação, idempotência, strip do corpo/projeção, corpo do PUT com 1ª etapa Lead e erro sem Lead, funil de origem).
- **Navegador:** criei 1 funil pela tela e 2 projetos reais (`LP Auditoria`, `Site Institucional`) na API descartável; um segundo funil "Funil B". Galeria: "Funil B" com selo **Sem fonte**, o outro sem. Configurações do Funil B → Fontes → Conectar fonte: a lista mostrou **só os 2 projetos reais** (nenhum do mock), com o aviso "Hoje este projeto alimenta Funil Teste WP4-0…". Conectei "LP Auditoria" com o nome "Form Auditoria". Resultado no servidor (`GET /api/projects`): `pipelineId=pl-funilb`, `stageId` = primeira etapa Lead, `sourceName="Form Auditoria"`; `GET /api/pipelines` mostra `config.sources` **vazio** em ambos (nada duplicado). Depois do F5 a galeria mantém o estado (nenhum funil com "Sem fonte"; o selo some do Funil B).
- ❌→⚠️ **Desconectar a fonte limpa o vínculo:** não é possível sem mudar a API. Provei: `PUT /api/projects/{id}` com `pipelineId:""` ⇒ **422 "escolha o funil e a coluna de leads…"** (`validateProject`, `connect_projects.go`). Por isso o painel da fonte de formulário não tem "Remover" e aponta para Projetos conectados (trocar o funil do projeto, ou desconectar o projeto inteiro, que arquiva e interrompe o connect.js). **Decisão de produto/API para o PO:** permitir projeto sem funil (e o que o `IngestLead` faz nesse caso: rejeitar? cair numa fila?) ou aceitar que "desconectar da pipeline" = trocar de funil.

### 3. B-10 — oportunidade de exemplo nunca em modo API — ✅
- `useAllOpportunities` passa a usar `withSampleOpportunities(samples, api, apiMode)`: com `syncMode==='api'` descarta `sampleOppsStore`. Regra documentada em `workflowDiff.isRealOpportunityId` (só ids numéricos sincronizam tarefas; exemplos não podem aparecer com a API ligada; em produção a semente está desligada).
- **Teste:** `workflowDiff.test.ts` ("B-10…"). **Navegador:** injetei uma oportunidade `o1` ganha em `sampleOppsStore` com a API ligada; a store ficou com 1, a página Clientes **não** a mostrou. **Ressalva:** `qualifyLead` (B-01, fora do escopo) ainda grava só em `sampleOppsStore`, então agora a oportunidade "qualificada" não aparece em modo API (antes aparecia como fantasma); o conserto real é o WP4 de qualificação.

### 4. B-07 (front) — limpar prazo/responsável envia `null` — ✅
- `workflowDiff.taskUpdateBody` (pura) usada no `PUT /api/tasks/{id}` de `flushTasks`. **Teste:** corpo com `assignee:null,dueAt:null` e chaves presentes no JSON.
- **Navegador:** com uma tarefa (prazo 05/11, responsável Diego) numa oportunidade real, abri a ficha → editar tarefa → esvaziei o prazo → Salvar. O `PUT` capturado: `{"title":"Ligar pro cliente","tag":"Geral","assignee":"Diego","dueAt":null,"done":false}`. Que o **servidor** aceite `null` é do WP4-1 (não conferi o efeito no banco; a API que eu compilei era o commit anterior ao do WP4-1).

### 5. D34 / B-16 / B-20 — tela Automações — ✅
- `mocks/automations.ts`: removidos `runs`/`lastRun` inventados (47/12/9/6/22) e os 8 logs mock (`runsStore` começa vazio; só entram execuções reais da aba, de `events.ts`). 
- `pages/Automations.tsx`: todo item leva o selo **"Exemplo, não roda no servidor"**; o **funil aparece na linha** (selo) e há filtro "Todos os funis" (busca também por funil); colunas renomeadas "(nesta aba)" e vazias mostram "—"; aba Execuções com estado vazio explicando; banner novo ("Nenhuma automação roda no servidor… o que chega por formulário no site não dispara nenhuma"), subtítulo corrigido.
- **Textos de B-16** (`PipelineEditors.tsx`): "o avançado cria uma automação de verdade" ⇒ "…automação de exemplo, que só roda neste navegador e não roda no servidor"; "Conclui sozinha quando o campo é preenchido" ⇒ "Conclui quando o campo é preenchido na ficha, com o admin aberto no navegador. O servidor ainda não confere o campo"; "recebe um push" ⇒ aviso no admin só com o admin aberto; botão "Criar automação de exemplo a partir desta tarefa".
- **Teste:** `tests/automationsMock.test.ts` (guarda de texto-fonte: sem contagem/data inventada, `runsStore` vazio, selo e funil presentes; o módulo importa a store sem extensão, então o Node não o carrega).
- **Navegador (modo API, 2 funis com 12 passos):** 30 linhas, **30 selos**, nenhum "47", cada linha mostra o funil.
- Fica de fora: não colapsei as 12 linhas por funil em uma só; mostrei o funil na linha e o filtro (a "consolidação" pedida foi lida como identificar o funil). Se o PO quiser agrupamento recolhível por funil, é um follow-up pequeno.

### 6. Documentação — ✅
`docs/runbooks/ligar-em-producao.md` (variável `VITE_SEED_DEMO` só para desenvolvimento, não criar na Vercel; semeadura desligada em §7.2 e §7.3 com a conferência por `GET`; nota das fontes), `docs/ARCHITECTURE.md` (3 linhas de status), `docs/pagesAdmin/projects.md` (seção da fonte do funil e o limite do desconectar).

## Verificação geral
`npm test` em `apps/admin`: **83 testes, 0 falhas** (eram 72 + 11 novos). `npx tsc -b` limpo. `npm run build` ok. `oxlint`: só avisos antigos de `TaskWorkflow.tsx`.

## (b) Arquivos alterados
`apps/admin/.env.example` (novo) · `src/lib/seedDemo.ts`, `sourceLink.ts`, `projectSources.ts` (novos) · `src/lib/workflowSync.ts`, `crmSync.ts`, `workflowDiff.ts`, `useAllOpportunities.ts` · `src/domain.ts` (`Source.derived`) · `src/App.tsx` (liga `startProjectSources`) · `src/components/PipelineEditors.tsx`, `WorkflowInspector.tsx` · `src/pages/Tasks.tsx`, `PipelineSettings.tsx`, `Automations.tsx` · `src/mocks/automations.ts` · testes `workflowDiff.test.ts`, `sourceLink.test.ts`, `automationsMock.test.ts` · docs acima. (`TaskWorkflow.tsx` não foi editado: já trata as fontes pelo `Source`, sem botão de remover para as derivadas via `SourceDetailPanel`.)

## (c) Commits
`833ffb3` (item 1) · `674a71d` (item 2) · `f43f371` (item 3) · `a82d1db` (item 4) · `482fe54` (item 5) · `1b0ea7c` (docs).

## (d) O que ficou de fora
- Desconectar a fonte limpando o vínculo (precisa da API; ver item 2).
- `qualifyLead` / B-01, gate (B-03) e integridade do funil (B-13): WP4-1 e seguintes.
- Mock de projetos da página **Projetos** em modo exemplo (`projectsStore`) continua sendo exemplo, como antes.
- Medi só 1440 px/viewport do painel; não testei celular nem MySQL real.
- Não toquei `site.ts` nem arquivos do WP4-1.

## (e) Riscos
- Fontes de formulário dependem de `GET /api/projects`, que exige `keys:manage`; o Vendedor não as vê (a tela avisa).
- A derivação regrava a store de funis com `sources` alterado; isso não vai ao servidor (ignorado na projeção), mas qualquer código novo que compare funis por JSON completo verá a diferença.
- Em modo API com servidor vazio, quem tinha dados de exemplo gravados antes (bancos já semeados) não é limpo por esta mudança: só impede novas semeaduras.
- `qualifyLead` sumindo da lista em modo API (item 3) é visível até o conserto do B-01.
- O vite em dev guardou módulo vazio em cache durante uma escrita de arquivo (erro "does not provide an export" só no meu ambiente); reiniciei com `--force`. Não afeta o build.

## (f) O que o Gustavo precisa fazer
1. **Não** definir `VITE_SEED_DEMO` na Vercel (admin) de produção.
2. Se algum banco de produção/staging já foi aberto com as flags ligadas antes desta correção, conferir se há funis/leads/pessoas/empresas de exemplo e apagar (esta entrega não apaga nada).
3. Decidir com o PO o que "desconectar a fonte do funil" significa (item 2) para a API ser ajustada.
4. Conferir na produção, depois de ligar as flags: `GET /api/pipelines` ⇒ `[]` após abrir o admin com tabelas vazias.
