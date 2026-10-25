# WP4-1 — Integridade de funis, gate e tarefas no servidor

> Worker: sessão wp4-1 (25/10/2026). Legenda: ✅ feito e provado · ⚠️ parcial/ressalva · ❌ não feito. **[T]** teste de integração · **[C]** código.
> Banco de prova: MySQL em memória (go-mysql-server, `memmysql.exe` copiado para o scratchpad, fora do repositório, porta 3361). Nada de produção tocado; `apps/api/.env` não foi lido; a API da 8080 não foi chamada.
> Todos os testes novos rodam **nos dois modos de DSN** (sem e com `parseTime=true`): subtestes `sem_parseTime` e `parseTime`.

## (a) Itens

### 1. Gate no servidor — ✅

| Linha da auditoria (§6.3 / §3.3) | Resultado agora | Teste |
|---|---|---|
| Criar oportunidade direto em etapa travada (`q4:assinatura`) | **409** `{"error":"gate","blockers":[{requirementId:"g:r-cnpj",…}]}`; **nada gravado**, nem tarefa (a criação usa consulta, não tentativa) | `TestIntegrationIntegridadeGate` |
| EXIT ao mudar de funil | **409** com o requisito de saída; concluir a tarefa libera e o move grava o `pipelineId` do destino | idem |
| Mover Lead v2 para etapa travada (`PUT /api/crm/leads/{id}`) | **409** + tarefa do requisito criada para o lead; etapa de outro funil ou inexistente **422** | idem |
| Criar lead direto em etapa travada (`POST /api/crm/leads`) | **409**, nada gravado; etapa inexistente 422 | idem |
| `POST /api/gate/check` com efeito colateral (B-17) | **consulta pura**: devolve a trava (`taskId` vazio), **0 tarefas** criadas; a tentativa de mover é que cria, sem duplicar | `TestIntegrationPipelineTaskGate` (ajustado) e Gate |

Escolha de design: *consultar* ≠ *tentar*. `checkGate(in, attempt)`: `attempt=false` (gate/check e criação) nunca escreve; `attempt=true` (move de oportunidade, PUT de lead) cria a tarefa do requisito (INSERT IGNORE na chave única), que é o comportamento que a tela já assume.

### 2. Etapa e funil — ✅

| Regra | Resultado | Teste |
|---|---|---|
| Criar/mover para etapa inexistente (`xyz:nada`, `lixo:zzz`, vazia) | **422**, nada muda | `…IntegridadeGate` |
| Mover para a mesma etapa (B-04) | **200** (também repetido); 404 só se a oportunidade não existe. Resolvido por consulta de existência quando `RowsAffected()==0`, sem flag de driver (vale também com a flag `WORKFLOW_API` desligada) | idem |
| Valor antigo (`INBOUND`, `WON`…) | continua válido; o gate usa a etapa equivalente do funil (`legacyStageFrom`, espelho de `stages.ts`) | idem |
| Remover etapa com **leads** | **409** (lead arquivado não segura; oportunidade segura) | `…IntegridadeFunil` |
| Mudar o **tipo** da etapa com registros | **409**; sem registros passa | idem |
| Funil sem Ganha ou sem Perdida | **422** (PUT e POST); sem etapas 422 | idem |

### 3. Tarefas órfãs e limpar campos — ✅

- **B-06:** requisito removido leva as tarefas **abertas** dele; as **concluídas** viram tarefa comum (`requirementId=NULL`, `source=manual`) para preservar o histórico, e podem ser apagadas. Justificativa: a aberta não trava mais nada; a concluída é registro de que alguém fez. `DELETE` de tarefa cujo requisito não existe mais (inclusive as órfãs que já existiam em produção antes desta regra) → **200**; de requisito vigente segue 409; inexistente agora é 404. [T] `TestIntegrationTarefasOrfasELimpar`.
- **B-07:** `PUT /api/tasks/{id}` lê o corpo como mapa de presença: ausente mantém, `null` limpa `dueAt`, `assignee`, `assigneeMemberId` e `tag`; `dueAt` inválido 400. [T] idem.
- `POST /api/tasks` com `entityId` inexistente → **422** (`opportunity`, `pipeline` sempre; `lead`/`person`/`company` só com `CRM_API=1`, porque as tabelas só existem com ele). [T] idem.

### 4. Tarefa de campo (B-03e) — ✅ com ⚠️

Concluir a tarefa de um requisito `FIELD` exige o campo no registro (**422** com mensagem). [T] `TestIntegrationTarefaDeCampo`: "Informar CNPJ" em oportunidade **sem empresa** → 422 "vincule uma empresa"; **empresa sem CNPJ** → 422; com `Company.document` → 200 e o gate libera; reabrir nunca é barrado; `ACTION` conclui livre; lead usa o CNPJ da empresa do lead.

⚠️ **O que o servidor consegue verificar hoje:** o requisito **não guarda a chave do campo** (só `label`/`tag`), então o servidor reconhece pelo **título**: `CNPJ` (empresa), `CPF` (pessoa), `e-mail`, `telefone/celular/whatsapp`. Qualquer outro `FIELD` ("Informar o orçamento") conclui livre (testado). Só vale com `CRM_API=1`. O caminho certo é uma coluna `fieldKey` no requisito (o `config.steps` do front já tem `fieldKey`) — **decisão de produto/pacote seguinte**, não feita para não inventar schema.

### 5. Tarefas por dono (D19, D36) — ✅ com ⚠️

- Coluna aditiva `Task.assigneeMemberId` (`ensureWorkflowColumns`, `columnExists`, idempotente). `POST`/`PUT` aceitam o id (pessoa **ativa** da equipe, senão 422; exige `AUTH_API=1`) e preenchem `assignee` com o nome dela; o texto sozinho segue funcionando (compatibilidade). Limpar um limpa o outro. [T] `TestIntegrationTarefasPorDono`.
- Com `AUTH_API=1`, quem tem `leads:own`/`opportunities:own` e **não** tem `leads:read` (Vendedor) vê em `GET /api/tasks` **apenas** as atribuídas a ele ou ligadas a oportunidade/lead dele (`ownerMemberId`); `PUT`/`DELETE` nas dos outros → **404**; `POST /api/tasks` e `POST /api/gate/check` em oportunidade/lead alheio → 404. Gerente e Admin veem tudo (7 de 7 no teste); token nunca é restrito (escopo "own" é `HumanOnly`).
- ⚠️ Tarefa de **pessoa/empresa** só aparece para o Vendedor se for atribuída a ele (o spec fala só de lead/oportunidade). ⚠️ D36 completo ("Função resolve para o responsável do registro; sem dono vai para a fila do Gerente") **não** foi feito: as tarefas que o gate cria continuam com o texto do requisito (`assignee`), sem `assigneeMemberId`. Tem que vir junto do rodízio (WP4-3).
- **Matriz de escopos/rotas:** nenhuma linha mudou (`gate/check` segue `tasks:read`, agora de fato sem escrita — só o comentário em `auth_scopes.go`). Nenhum teste de matriz precisou ser ajustado; `TestRotaExigeEscopo`, `TestCadaEscopoAbreSoSuaRota` e `TestPerfisNoServidor` passam sem alteração.

### 6. `Opportunity.pipelineId` e contagens — ✅

- Coluna aditiva nula, preenchida na criação e no move (a partir da etapa de destino). Backfill idempotente no startup, pelo id da etapa; valores antigos ficam nulos (não dizem o funil). [T] `TestIntegrationContagensDoFunil` (rodado 2×, mais `ensureWorkflowColumns` 2×).
- Contagens (`workflow_stats.go`): o funil de cada oportunidade = dono da etapa gravada → `pipelineId` → primeiro funil ativo (só para valor antigo), como o `stages.ts`. Legados (`INBOUND`, `WON`) caem em `q4:neg`/`q4:ganho` (provado); etapa inventada não entra em nenhum funil (provado). Novo `stats {records, openTasks, overdue, blocked}` por funil: **`blocked` = registros** (1 registro com 2 requisitos = 1; a soma por requisito segue 2, provado); **`overdue` inclui tarefa manual** (provado); registro que mudou de funil sai da conta do antigo. `counts`/`values` por etapa passam a usar a mesma resolução (antes, só id exato).
- **Front (mínimo, só arquivos fora do território do WP4-0):** `src/lib/pipelineStats.ts` lê `p.stats` quando existe e cai na conta local senão; teste novo `tests/pipelineStats.test.ts`. `Tasks.tsx` **não foi alterado**: o card mostra `st.tasks`, que agora é "tarefas abertas" (antes era o nº de requisitos) — o rótulo "tarefas" continua correto. Admin: `npm test` 85/85, `tsc -b` limpo.

### 7. Concorrência (B-13) — ✅ com ⚠️

`PUT /api/pipelines/{id}` aceita `If-Match: "<updatedAt RFC 3339>"` ou `expectedUpdatedAt` no corpo; divergindo → **409** `{"error":"conflict","message":…,"current":<funil atual>}` e nada é gravado; `If-Match` inválido 400; sem nenhum dos dois, comportamento de hoje. A gravação é compare-and-swap (`UPDATE … WHERE updatedAt = ?`), então duas gravações simultâneas não passam as duas. Toda gravação muda a versão (se cair no mesmo segundo, soma 1 s). O funil passou a devolver `updatedAt`. [T] `TestIntegrationConcorrenciaDoFunil`. ⚠️ A versão tem precisão de **segundo** (a coluna é `DATETIME`; não mexi no tipo); o `DELETE` (arquivar) grava `updatedAt` com o relógio e pode, raramente, não mudar a versão dentro do mesmo segundo. O admin ainda **não envia** o `If-Match` (é `workflowSync.ts`, território do WP4-0): o servidor está pronto, falta o front passar a mandar.

## Testes de matriz e fixtures ajustados de propósito

Nenhum teste de matriz de escopos mudou. Mudaram **fixtures** que dependiam do servidor aceitar etapa inexistente ou funil sem Ganha/Perdida, cada uma por causa de uma regra nova:

| Arquivo | Ajuste | Motivo |
|---|---|---|
| `crm_integration_test.go` (`crmDB`) | semeia os funis `q4` e `b2b` (`seedBasePipeline`); o lead `l2` mantém `b2b` | lead/oportunidade em etapa inexistente agora é 422 (item 2) |
| `workflow_testenv_test.go` (novo) | helper `seedBasePipeline` | idem |
| `public_leads_v2_integration_test.go` | apaga os funis antes do cenário "sem funil de leads" | o pano de fundo agora tem funil |
| `opportunity_links_integration_test.go` (`oppEnv`) | cria a tabela Prisma `Note` | `TestIntegrationEscopoOwn` falhava num banco limpo (`table not found: Note`), já apontado pela auditoria §6.4 |
| `workflow_test.go` | `goodPipeline` ganha etapa `LOST` | funil exige Ganha e Perdida (item 2) |
| `workflow_integration_test.go` | funil de teste ganha `q4:perdido`; `gate/check` não cria mais tarefa — a **tentativa de mover** cria; PUT final espera 4 etapas | itens 1 e 2 |

## (b) Arquivos

**API (novos):** `workflow_integrity.go` (etapa de destino, legado, gate de lead), `workflow_stats.go` (contagens/stats), `workflow_tasks_scope.go` (tarefas por dono, tarefa de campo), `workflow_testenv_test.go`, `workflow_integrity_integration_test.go`, `workflow_tasks_integration_test.go`, `workflow_stats_integration_test.go`.
**API (alterados):** `main.go` (move), `opportunity_links.go` (criar), `crm_leads.go`, `workflow_pipelines.go`, `workflow_tasks.go`, `workflow_schema.go`, `auth_scopes.go` (só comentário) e os testes citados acima.
**Admin:** `src/lib/pipelineStats.ts`, `tests/pipelineStats.test.ts`.
**Docs:** `docs/api-workflow.md`, `docs/ARCHITECTURE.md`, `docs/pagesAdmin/crm.md`, este relatório. (Não existe `docs/pagesAdmin` de Tarefas; a nota do gate foi para `crm.md`, onde a regra do CNPJ já estava.)

## (c) Commits

`850b469` (itens 1, 2 e a base de 3/7) · `47a28d9` (itens 3, 4 e 5) · `cf976ea` (itens 6 e 7) · `8e203cc` (front mínimo) · `363722c` (docs) · relatório no commit seguinte.

## Verificação

| Comando | Resultado |
|---|---|
| `go vet .` | limpo |
| `go test -count=1 .` (sem DSN) | 106 PASS, 11 SKIP (integração) |
| `TEST_DSN=…/kalidash_test go test -count=1 -v .` | **117 PASS, 0 FAIL, 0 SKIP** |
| `TEST_DSN=…/kalidash_test?parseTime=true …` | **117 PASS, 0 FAIL** |
| admin `npm test` / `npx tsc -b` | 85/85 / limpo |

Banco em memória **não é MySQL real**: `FOR UPDATE`, `COALESCE` em JSON e `RowsAffected` sem `clientFoundRows` seguem sem prova em MySQL/MariaDB (WP3a). Por isso o B-04 foi resolvido por consulta de existência, que funciona nos dois.

## (d) O que ficou de fora

- **Admin enviar `If-Match`** e tratar o 409 `conflict` (é `workflowSync.ts`, do WP4-0).
- **`fieldKey` no requisito** (reconhecer o campo por título é heurística; ver item 4).
- **D36 completo** (tarefa do gate com responsável = dono do registro / fila do Gerente) e o rodízio: WP4-3.
- `POST /api/public/leads` e `connect_ingest` gravam o lead/oportunidade sem passar pelo gate nem preencher `Opportunity.pipelineId` (a oportunidade legada `INBOUND` cai no primeiro funil pela regra de legado).
- Paginação de `GET /api/tasks` (LIMIT 500 silencioso) e a auditoria de quem concluiu a tarefa (`doneBy`): fora do escopo.
- Contagem de **leads** nos números do funil (por desenho só oportunidades).

## (e) Riscos

1. **O front ainda semeia/aceita funis sem Ganha ou Perdida** (ex.: o exemplo "Teste Sem Ganho", ou um funil criado pelo editor sem essas etapas): o `PUT`/`POST` agora volta **422**; o admin trata 409/422 recarregando o servidor, então uma edição desse tipo é desfeita na tela. Conferir os templates e o editor de etapas do WP4-0.
2. **Lead/oportunidade em etapa que não existe agora é recusado**: qualquer cliente que mande `stageId` antigo ou de funil removido recebe 422 (o admin trabalha com ids reais; valores `INBOUND/QUALIFICATION/WON/LOST` continuam aceitos).
3. **Gate em leads**: a tela de Leads que muda de etapa por `PUT` passa a receber 409 com `blockers` (formato do move) e precisa tratá-lo como o Kanban faz. Hoje a tela de Leads aplica o gate sozinha antes (`gate.ts`), então o caso real é só corrida.
4. **Órfãs antigas**: `DELETE` agora apaga qualquer tarefa cujo requisito não existe; correto, mas é a única forma de limpar as que já existem em produção — ninguém as apaga sozinho.
5. Versão do funil com precisão de segundo (item 7) e `Opportunity.pipelineId` nulo nos valores antigos até serem movidos.
6. MySQL/MariaDB reais não exercitados (ver Verificação).

## (f) O que o Gustavo precisa fazer

1. Nada novo para ligar: as colunas (`Task.assigneeMemberId`, `Opportunity.pipelineId`) nascem sozinhas no startup com `WORKFLOW_API=1` (ALTER aditivo + backfill). **Faça o backup antes** (como no runbook): é a primeira vez que `WORKFLOW_API` altera uma tabela do Prisma (`Opportunity`).
2. Conferir, depois do deploy, que o primeiro `GET /api/pipelines` devolve `stats` e `updatedAt`.
3. Decidir com o PO: `fieldKey` no requisito (item 4) e se tarefa de pessoa/empresa deve aparecer ao Vendedor (item 5).
