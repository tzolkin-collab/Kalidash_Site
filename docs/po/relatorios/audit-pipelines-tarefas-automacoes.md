# Auditoria — Funis, Tarefas e Automações (insumo da Entrega 3)

> 25/10/2026. Worker: sessão de auditoria (somente leitura; único arquivo criado: este relatório). Legenda: ✅ ok e comprovado · ⚠️ parcial/ressalva · ❌ ausente/quebrado. Evidência: **[C]** código · **[T]** teste · **[N]** navegador · **[H]** HTTP.
> Banco usado nas provas: MySQL em memória fora do repositório. Nunca o `apps/api/.env`, nunca a API da 8080.

## 0. Resumo executivo

_(preencher no fim)_

## 1. Modelo e fluxo

### 1.1 Diagrama (o que existe de verdade)

```
 FORMULÁRIO DA LP ──(connect.js / POST /api/public/leads)──► Lead  ◄── cadastro manual (admin)
   │  ConnectedProject.pipelineId+stageId+sourceName (API)            │ status ACTIVE|QUALIFIED|DISCARDED
   │  TrackedForm (API)                                               │ stageId ► PipelineStage.id (sem FK)
   │                                                                  │ convertedOpportunityId (texto, sem FK)
   ▼                                                                  ▼
 Pipeline (API) ── config JSON: sources[], steps[], customFields[],   "Qualificar" = só no navegador  ✗ (ver §3/§7)
   │                taskTags[], qualifyRequires[], templateId         │
   ├─ PipelineStage  kind LEAD|OPEN|WON|LOST, position, color,        ▼
   │                 probability, alertDays        ◄────────────  Opportunity (tabela Prisma antiga)
   └─ StageRequirement  kind FIELD|ACTION, gate NONE|ENTER|EXIT,       stage = id de etapa OU valor legado
        assignee(texto), dueDays, notifyAssignee, linkedAutomationId   (INBOUND/QUALIFICATION/WON/LOST)
              │ (id)                                                   wonAt, contactId, companyId, ownerMemberId
              ▼
        Task  (API)  source manual|passo|requisito · entityKind lead|person|company|opportunity|pipeline
              UNIQUE(requirementId, entityKind, entityId) · done/doneAt · dueAt · assignee(texto)
              │
  GATE ───────┘  POST /api/leads/move  (409 "gate")  e  POST /api/gate/check   ← só OPORTUNIDADE
                 (Lead: o gate só roda no navegador: lib/gate.ts → gateBlockers)

 AUTOMAÇÃO  = só no navegador (lib/events.ts: emit → collect → runAction), estado em `automationsStore`
              e `runsStore` (memória, restaurados do mock a cada F5). O que persiste na API é só
              `Pipeline.config.steps` (a receita dos passos do ciclo de vida), que nada executa no servidor.
```

### 1.2 Tabelas e colunas reais × o que só existe no front

| Conceito | Na API (tabela.colunas) | Só no front |
|---|---|---|
| Funil | `Pipeline(id,name,offer,position,config JSON,archivedAt,createdAt,updatedAt)` | `templateId`, `postSaleTemplateId` (dentro do `config`, opacos) |
| Etapa | `PipelineStage(id,pipelineId,name,kind,position,color,probability,alertDays)` FK→Pipeline ON DELETE CASCADE | mapeamento de valores legados (`lib/stages.ts: legacyStage`) |
| Requisito | `StageRequirement(id,pipelineId,stageId,label,tag,kind,gate,assignee,dueDays,notifyAssignee,linkedAutomationId,position)`; **sem FK de `stageId`** (só validação na escrita) | `linkedAutomationId` aponta para uma automação que **não existe no servidor** |
| Fonte | `Pipeline.config.sources[]` (JSON, cosmético) **e** `ConnectedProject.pipelineId/stageId/sourceName` + `TrackedForm` (a de verdade: é ela que cria lead em `connect_ingest.go`) | a lista de formulários que o "Conectar fonte" oferece (`mocks/projects.ts`) |
| Campo personalizado, tag de tarefa | `Pipeline.config.customFields/taskTags` (JSON) | tudo |
| Tarefa | `Task(...)` acima; sem FK para a entidade (`entityId` livre) | prazo/ciclo de alerta, "assumir ao concluir" (`taskActions.ts`) |
| Gate | calculado em `checkGate` (consulta `StageRequirement`+`Task`) | `lib/gate.ts` (cópia para Lead e para a animação do Kanban) |
| Lead | `Lead(id,name,email,phone,personId,companyId,pipelineId,stageId,origin,sourceName,owner,estimatedValue,expectedCloseAt,tags,message,status,discardReason,wasSeen,firstContactAt,convertedOpportunityId,returningClient,customData,archivedAt,createdAt,ownerMemberId)` | `qualifyLead` (`leadFlow.ts`) |
| Oportunidade | `Opportunity(id,title,value,stage,priority,tags,wonAt,contactId,companyId,ownerId,ownerMemberId,createdAt,updatedAt)`; **sem** `pipelineId`, motivo de perda, origem, SLA | `pipeline` (nome) e `ownerName` |
| Automação | **nenhuma tabela** (`linkedAutomationId` é só um texto; escopo `automations:manage` está `Reserved`, sem rota) | catálogo (19 eventos, 13 ações), execuções, categorias |
| Webhook de saída, fila, agendador, SLA, rodízio | **nada** (`grep -i "round\|sla\|webhook\|outbox\|ticker\|cron" apps/api/*.go` só acha `go func` do revalidate e `math.Round`) | tela Webhooks (mock) |

### 1.3 O doc de domínio promete e não existe

| `docs/dominio.md` v2.1 promete | Situação | Evidência |
|---|---|---|
| Tabelas `Source`, `PipelineSource`, `CustomField`, `Automation`, `LeadSubmission`, `OpportunityContact`, `StageRequirement` própria para campo | ❌ só `Pipeline.config` JSON (fonte, campo) e nada para automação/submission/stakeholder | `workflow_schema.go`, `docs/api-workflow.md` "O que falta" item 5 |
| §3 "Um formulário alimenta uma só pipeline" | ⚠️ vale só no cliente (`usedBy` em `PipelineEditors.tsx`) sobre formulários **de exemplo**; no servidor a regra equivalente é "um projeto tem um `pipelineId`" | §2.6 |
| §3 "Conectar fonte" cria automação gerenciada que **cria o lead** | ❌ o lead real é criado por `connect_ingest.go`, independe da automação; a automação é um registro de memória que some no F5 | prova §6 (automação visível antes do F5, ausente depois; fonte permanece) |
| §3 "Toda pipeline tem fonte; sem fonte vira tarefa 'Definir fonte'" | ⚠️ "Definir fonte da pipeline" existe como requisito do template (ACTION, sem gate, etapa Novos) e a galeria mostra o selo "Sem fonte" (visto em "Expansão 2026" e "Teste Sem Ganho"). **Não verifiquei** se a tarefa conclui sozinha ao conectar a fonte; nada no servidor a conclui | código (`workflow_schema`) e §6 |
| §4 Qualificar cria oportunidade na 1ª etapa aberta e transfere notas, tarefas, e-mails | ❌ no servidor nada acontece: o lead vira `QUALIFIED` apontando para uma oportunidade que não existe | prova §6 |
| §4 "Descartar com motivo", "tempo até o 1º contato", "cliente retornando" | ⚠️ colunas existem (`discardReason`, `firstContactAt`, `returningClient`); nada calcula tempo até o 1º contato nem alerta | `crm_leads.go` só grava |
| §6 Oportunidade com origem INBOUND/OUTBOUND, fonte, campanha, UTM, **motivo de perda**, stakeholders | ❌ `Opportunity` tem só título/valor/etapa/prioridade/tags/vínculos; "Marcar como perdido" não pede motivo | prova §6 |
| §8 Marcar campo como tarefa; "preencher o campo conclui a tarefa" | ❌ o servidor nunca confere o campo; qualquer pessoa com `tasks:write` marca a tarefa "Informar CNPJ" como feita sem CNPJ | prova §3 |
| §8 "Bloqueio impede entrar ou sair" | ⚠️ ENTER e EXIT valem para oportunidade em **mesmo funil**; criar direto na etapa, mover entre funis e Lead furam o gate | prova §3 |
| §9 Automações em catálogo, execução e logs; "apagar a fonte apaga a automação" | ❌ catálogo e execução só no navegador; logs são mock (`r1…r8`); contagens "47/12/9/6/22" são inventadas | `mocks/automations.ts` |
| §10 Configurações das pipelines (engrenagem) | ✅ existe (`PipelineSettings.tsx`, abas Geral/Etapas/Fontes/Tarefas/Passos/Campos/Tags) | §2 |
| §11 Galeria + workflow em React Flow, contagem de registros/tarefas/atrasadas/bloqueados | ⚠️ existe; números divergem dos dados (legados fora; bloqueados inflados) | §3 |
| `gatilhos-personalizados.md` (webhook de entrada por pipeline) | ❌ nada; sem rota, sem tabela, sem tela | grep |
| `notificacoes.md` caminho avançado "Criar automação a partir desta tarefa" | ⚠️ existe como painel (`PipelineEditors.tsx:createAutomation`) mas só grava na memória | §2.6 |

### 1.4 Existe e não está no doc

- **Escopos `leads:own` / `opportunities:own`**, `ownerMemberId` em `Lead` e `Opportunity` (WP3b) e o modelo de tokens com escopo: sem menção em `dominio.md`.
- **`Pipeline.config.qualifyRequires`** (campos que o "Qualificar" exige, ex. "Valor estimado (obrigatório nesta pipeline)") e **`steps`** com `phase`, `key`, `onlyIfEmpty`, `fieldKey`, atraso por ação.
- **Semeadura automática no servidor vazio** (`workflowSync.ts:initWorkflowSync` e `crmSync.ts:initCrmSync`): o admin sobe funis, pessoas, empresas e leads **de exemplo** para o banco real na primeira abertura (ver B-02).
- **Aviso 409 do gate e reversão do card** (`docs/api-workflow.md` cobre; `dominio.md` não).
- Valores legados de etapa (`INBOUND`, `QUALIFICATION`, `WON`, `LOST`) como parte do contrato de `Opportunity.stage` (`lib/stages.ts`).
- **Sincronização por diff com debounce de 600 ms** (`workflowSync.ts`/`workflowDiff.ts`): modelo "o navegador é o dono do estado, o servidor guarda" (last-write-wins no `PUT /api/pipelines/{id}`).

## 2. Pipelines (funis)

Evidência: **[C]** código · **[T]** teste · **[N]** navegador (admin 5197 → API 8097 sobre MySQL em memória, `WORKFLOW_API=1 CRM_API=1 AUTH_API=1`) · **[H]** chamada HTTP feita pela própria página (cookie da sessão de dev), para ver o que o servidor aceita independentemente da tela.

### 2.1 Quadro geral

| # | Item | | Evidência |
|---|---|---|---|
| 2.1 | Criar funil pelo template ("Venda consultiva B2B" + pós-venda) | ✅ | [N] `#/oportunidades/pipelines/nova` → "Auditoria Funil": 8 etapas (2 Lead, 4 Abertas, Ganho, Perdido), 6 requisitos (inclui **"Informar CNPJ" ENTER em "Assinatura do contrato"**), 12 passos; chegou ao servidor (`GET /api/pipelines`) sem F5 |
| 2.2 | Ler / listar / arquivar / desarquivar | ✅ | [T] `TestIntegrationPipelineTaskGate` (passos 1 e 7, nos dois modos de DSN); [N] arquivar mostra "Tem N oportunidades e M leads. Arquivar não mexe neles" |
| 2.3 | **Excluir** funil | ⚠️ não existe: `DELETE` só arquiva (`workflow_pipelines.go:536`). O doc §10 diz "excluir uma com oportunidades exige movê-las antes" | [C] — decisão consciente (comentário no código); falta alinhar o doc |
| 2.4 | Editar nome/oferta | ✅ | [N] aba Geral; [H] `PUT` devolve 200 e recarrega igual |
| 2.5 | Etapas: criar, renomear, reordenar, cor, probabilidade, "dias para alerta" | ✅ | [C] `PipelineSettings.tsx` (setas ↑↓, inclusão antes da 1ª Ganha/Perdida); servidor grava `position` = índice do array |
| 2.6 | Fontes ("Conectar fonte") | ❌ para uso real | [N][C] o painel lista **só formulários do mock** (`projectsStore`): com a API ligada e um projeto/formulário reais criados por mim (`LP Auditoria / Form Contato`, `POST /api/projects` 201), a lista mostrou "LP Consultoria…", "Site institucional…" e **não** o meu. A fonte gravada ficou com `formId:"lp-consultoria:modal"` (id inexistente no servidor). O tipo "Cadastro manual" grava a fonte mas **não** cria automação gerenciada (`PipelineEditors.tsx:41`). O vínculo que de fato cria lead é `ConnectedProject.pipelineId/stageId` (outra tela) — duas fontes de verdade que não se falam |
| 2.7 | Campos personalizados, tags de tarefa | ✅ (persistem no `config` JSON) / ⚠️ | [N] abas existem; [C] 256 KB de limite; nenhum campo personalizado é usado por Lead/Oportunidade no servidor (só no `customData` do Lead) |
| 2.8 | Requisitos de etapa: tipo FIELD/ACTION, gate NONE/ENTER/EXIT, responsável, prazo (dias), notificar | ✅ no cadastro | [T] validação (`TestValidatePipelineRejects`), [H] aceita; ver §3 para o que o gate **faz** |
| 2.9 | Passos automáticos / template de ciclo de vida (copiar, "atualizar a partir do template") | ✅ salva / ❌ não executa no servidor | [N] 12 passos persistidos em `config.steps`; [C] `pipelineTemplate.ts: diffWithTemplate/applyDiff`; execução só `events.ts` (§4) |
| 2.10 | Funil sem fonte | ✅ aceito (como o doc) | [N] galeria: selo "Sem fonte" em "Expansão 2026"/"Teste Sem Ganho" |
| 2.11 | Dois funis / funil por oferta | ⚠️ | `Opportunity` **não tem `pipelineId`**: o funil de uma oportunidade é deduzido do **id da etapa** (`stages.ts: pipelineOf`) e, para valores legados, do primeiro funil ativo ou do nome. Oportunidade em etapa inexistente (`xyz:nada`, aceita pelo servidor, ver 2.12) aparece em "Visão Geral" com o id cru |

### 2.2 Integridade: quem impõe as regras?

| Regra | Servidor? | Tela? | Prova |
|---|---|---|---|
| Nome ≤160, 1–40 etapas, ≤200 requisitos, kind/gate válidos, requisito aponta para etapa existente, JSON `config` ≤256 KB | ✅ | ✅ | [T] `TestValidatePipelineRejects`; [H] |
| **Etapa com oportunidades não pode sair** | ✅ 409 | ✅ botão desabilitado ("Mova os registros antes") | [T] passo 6 da integração; [C] `PipelineSettings.tsx:202` |
| **Etapa do tipo Lead com leads dentro pode sair?** | ❌ **200**: o lead fica com `stageId` órfão | ❌ o contador `pipeline.counts` só conta oportunidades, então o botão fica habilitado | [H] removi `q4:novos` (com 1 lead): `PUT` 200, `leadDepois = q4:novos` (etapa que não existe mais). [C] `writePipeline` só consulta `Opportunity` |
| Funil precisa de uma etapa Ganha e uma Perdida | ❌ | ⚠️ só impede apagar a **última** de cada tipo | [H] `POST /api/pipelines` com 1 etapa "OPEN" → **201** |
| Mudar o **tipo** de uma etapa com registros dentro (ex.: "Assinatura" OPEN → WON) | ❌ **200**, sem recalcular `wonAt`, sem aviso | ✅ livre | [H] `mudaTipo = 200` com 2 oportunidades na etapa; `wonAt` só é gravado em `/api/leads/move` quando o **cliente** manda `won:true` (`main.go:149`) |
| Remover um requisito que tem tarefas abertas | ❌ **200** e a tarefa vira **órfã**: não some, não conta como "bloqueio", e **não pode ser excluída** (`DELETE` exige `requirementId IS NULL` → 409) | ✅ "Excluir" deixa | [H] `removeReq=200`, `delOrfa=409`; a tarefa "Enviar a proposta" continuou na lista da oportunidade |
| Arquivar funil com registros | ✅ permitido (de propósito) | ✅ texto avisa | [N] |
| Concorrência (dois admins editando o mesmo funil) | ❌ `PUT` troca o funil **inteiro**; sem `If-Match`/versão; `updatedAt` existe mas não é comparado | — | [C] `writePipeline`; o diff do admin envia o objeto todo 600 ms depois de qualquer edição |
| Oportunidade só pode estar em etapa que existe | ❌ | ❌ | [H] `POST /api/leads {stage:'xyz:nada'}` → 201; `move` para `lixo:zzz` → **200** (`gateForMove` trata etapa sem funil como "valor legado, sem gate") |
| Mover para a **mesma** etapa | ❌ bug | — | [H] `/api/leads/move` para a etapa em que já está → **404 "Oportunidade não encontrada"** (`RowsAffected()==0` do UPDATE sem mudança; vale em MySQL real sem `clientFoundRows`) |

**Conclusão:** o servidor valida **formato** e protege **uma** invariante (etapa com oportunidade). As invariantes de negócio do `dominio.md` (§3 e §8) vivem na tela ou em lugar nenhum. Com um token ou usuário `pipelines:manage` chamando a API direto (ou o admin com a aba desatualizada), dá para apagar a etapa onde há leads, apagar o requisito que trava uma etapa e criar funil sem Ganha/Perdida.

### 2.3 O que grava e o que é só local (resumo)

- **Grava na API** (via `workflowSync.ts`, 600 ms depois da edição, `PUT /api/pipelines/{id}`): nome, oferta, etapas, requisitos, `config` (fontes, campos, tags, passos), arquivamento, ordem dos funis. **Recarregar mantém** (visto: funil e as duas fontes voltaram após F5).
- **Só local (some no F5):** automações gerenciadas criadas por "Conectar fonte" e por "criar automação a partir da tarefa" (`automationsStore`, nunca sincronizada); execuções e logs; as contagens "Execuções" da tela Automações.
- **Calculado no servidor e devolvido:** `counts`/`values` por etapa (só `Opportunity`, **por `stage` exato**), `blocked`/`overdue` por requisito.
- **Semeadura:** se a lista de funis voltar vazia o admin **cria os 3 funis de exemplo no servidor** (`initWorkflowSync`) e, com o CRM ligado e as três coleções vazias, também 9 leads, pessoas e empresas de exemplo (`initCrmSync → seed`). Visto na prova: depois de reiniciar o banco, a tela "Leads" mostrou "Ativos 10" = 9 exemplos (Renata Moura…) + o lead real que criei. **Quem ligar `WORKFLOW_API`/`CRM_API` em produção com as tabelas vazias e abrir o admin injeta esses dados no banco real** (B-02).

## 3. Tarefas e gate

### 3.1 Tarefas

| Item | | Evidência |
|---|---|---|
| Tipos `requisito` / `manual` / `passo` | ✅ no modelo | [C] `Task.source`; `requisito` nasce no gate (servidor, `INSERT IGNORE` por `(requirementId, entityKind, entityId)`) ou no "seguir registro" (front); `manual` pela ficha; `passo` só quando a ação `tarefa.criar` roda **no navegador** (`events.ts`) |
| Vínculo com oportunidade, lead, pessoa, empresa | ⚠️ | [C] oportunidade só sincroniza se o **id for numérico** (`isRealOpportunityId = /^\d+$/`); lead/pessoa/empresa só com `CRM_API=1`. [N] oportunidade `o1` (id de texto, semente) concluiu "Informar CNPJ" na tela e o servidor continuou `done:false` (a tarefa nunca foi enviada). Em produção, oportunidades criadas fora da API (Prisma/seed com cuid) cairiam nesse buraco 🟡 HIPÓTESE (não vi os ids reais) |
| Servidor confere se a entidade existe | ❌ | [H] `POST /api/tasks {entity:'opportunity', entityId:'nao-existe'}` → **201** |
| Prazo, atraso, responsável, tag | ✅ cria / ❌ **não consegue limpar** | [H] `PUT /api/tasks/{id} {dueAt:null, assignee:null}` → 200 mas continua com `dueAt` e `assignee` (ponteiro nulo = "não enviado", `workflow_tasks.go:226-231`). Na tela, limpar o prazo "funciona" e volta no F5 (B-07) |
| Responsável | ⚠️ texto livre | `assignee VARCHAR(120)`; o template grava o texto "Vendedor responsável" (visto), não um `TeamMember`; D19 (filtrar por responsável) depende de trocar isso por id |
| Concluir / reabrir | ✅ grava (numérico) / ❌ não valida | [N] clique em "Concluir" → `done:true` no servidor (Opp Gate). [H] qualquer pessoa com `tasks:write` conclui, **inclusive "Informar CNPJ" sem CNPJ** e a de oportunidade de outro vendedor (§5) |
| Excluir | ✅ só manual | [H] tarefa de requisito → 409 (por desenho, o gate a recriaria); a **órfã** (requisito removido) também → 409 e fica para sempre (B-06). [N] aviso "Esta tarefa não pode ser apagada" apareceu duas vezes na minha sessão sem eu excluir nada (⚠️ causa não isolada: o diff `remove` do `workflowSync` tenta `DELETE` de ids que saíram da store, p.ex. depois de `reloadTasks`) |
| Histórico | ⚠️ | `logChange` (browser) → `/api/crm/history` só para pessoa/empresa/lead com `CRM_API`; tarefa de oportunidade não tem histórico no servidor |
| Notificação `tarefa.criada` | ⚠️ browser | `taskNotify.ts`: só para tarefa de **requisito com `notifyAssignee` e responsável definido**; manual nunca avisa; não há canal servidor (sem push com o painel fechado) |
| Notificação `tarefa.atrasada` | ✅ no navegador / ❌ sem navegador | [N] criei "Ligar para o cliente (atrasada)" com prazo 20/10: apareceu "Tarefa atrasada: … prazo 20/10/2026" e "Aviso da automação para Responsável da tarefa". **Duas cópias de cada** (⚠️ B-12). O "uma vez por tarefa" fica em `localStorage`: outro navegador/aparelho avisa de novo; navegador fechado, ninguém é avisado |
| Tarefa de CNPJ ("Informar CNPJ") na etapa "Assinatura do contrato" | ✅ existe, ⚠️ não confere o CNPJ | [H][N] nos 3 funis de exemplo e no funil criado pelo template: `kind FIELD · gate ENTER · etapa Assinatura do contrato · responsável "Vendedor responsável"`. Barra a entrada (409) até alguém marcar a tarefa; **não verifica se a empresa tem CNPJ** (o doc §8: "preencher o campo conclui a tarefa") |

### 3.2 Contagens do card do funil (Tarefas)

Card "Q4 Sales Pipeline" depois dos meus testes: **3 registros · 6 tarefas · 2 bloqueados** (nenhum "atrasadas" mostrado).

| Número do card | Como é calculado | Bate com os dados? |
|---|---|---|
| Registros | `Σ counts[etapa]` = `COUNT(*) FROM Opportunity GROUP BY stage`, casando por **id exato** da etapa (`loadPipelines`) | ❌ **não bate com o Kanban** (5 oportunidades do funil). Faltam as 2 oportunidades com valor legado (`INBOUND`, `WON`), que o Kanban resolve por `legacyStage` e o servidor não. Leads não entram (por desenho). Oportunidade em etapa inexistente não entra em nenhum funil |
| Tarefas | `requirements.length` (modelo), não tarefas abertas | ⚠️ o nome engana: é o nº de **requisitos** do funil |
| Atrasadas | `Σ overdue` por requisito: tarefas de **requisito** abertas com `dueAt < agora` | ⚠️ tarefa manual atrasada (a que criei) **não conta**; é só do requisito |
| Bloqueados | `Σ blocked` = tarefas abertas de requisito com `gate != NONE` | ❌ conta **tarefas, não registros**, e inclui tarefas de registros que **já não estão** na etapa (a oportunidade que passou pela brecha entre funis continuou contando em "Enviar a proposta"). A tarefa nasce na **tentativa** de mover, então um card que voltou (revertido) também conta como "bloqueado" |

### 3.3 O gate bloqueia e libera como o doc diz?

| Cenário | Esperado (`notificacoes.md` §4, `api-workflow.md`) | Resultado | |
|---|---|---|---|
| Mover para etapa com ENTER aberto | 409 + tarefa criada | `409 {"error":"gate","blockers":[{requirementId:"q4:r-cnpj",…}]}`, tarefa criada | ✅ [H] |
| Concluir e mover | passa | 200 | ✅ [H] |
| Duas tarefas na mesma fronteira: todas fecham | trava até as duas | confirmado por [T] (`TestIntegrationPipelineTaskGate` passo 4) | ✅ |
| Reabrir a tarefa depois de entrar | volta a barrar quem tenta entrar de novo | 409 na tentativa seguinte; quem **já está** na etapa fica lá | ✅/⚠️ coerente com "fronteira" |
| EXIT na mesma pipeline (`Enviar a proposta` sai de Proposta) | 409 | 409 | ✅ [H] |
| EXIT ao sair para **outro funil** | 409 | **200** (a checagem só olha o funil da etapa de **destino**: `pipelineId` de `ToStageID`) | ❌ [H] `exitEntreFunis=200` |
| **Criar** a oportunidade direto na etapa com ENTER | 409 | **201** (nenhum gate no `POST /api/leads`) | ❌ [H] "GateDireto" nasceu em "Assinatura do contrato" sem tarefa |
| Mover para etapa que não existe | recusar | 200 (tratada como "valor legado") | ❌ [H] |
| Mover Lead (v2) entre etapas | o mesmo gate | **sem gate no servidor** (`PUT /api/crm/leads/{id}` não chama `checkGate`; teste 5b: "o gate de lead roda no front") | ❌ [H] `leadMoveParaGated=200` |
| Mover para a etapa onde já está | idempotente | **404** "Oportunidade não encontrada" | ❌ [H] (B-04) |
| `POST /api/gate/check` é "só consulta" | `tasks:read`, "não grava" (`auth_scopes.go:218`) | **grava**: cria a tarefa de cada requisito aplicável | ⚠️ [H][C] — um token só de leitura cria linhas |
| Concluir sem cumprir (campo vazio) | `FIELD` conclui quando o campo é preenchido | qualquer um marca `done` | ❌ — o gate vale o que a tarefa vale |
| **409 reverte o card?** | sim | Kanban: card volta para "Qualificação", servidor segue em `INBOUND`, a tarefa "Informar CNPJ" nasceu, toast/caixa: "**Consultoria Acme não pode avançar — Pendente: Informar CNPJ.**" (Aviso) | ✅ [N] (drop sintético via `DragEvent`: o Kanban usa HTML5 DnD) |
| O mesmo em tela de celular | — | Kanban é HTML5 `draggable` (`Opportunities.tsx:222`): no celular depende do arrasto nativo por toque longo (**não testei em aparelho**) e **não há alternativa** "Mover para…" nem por teclado; a ficha só tem "Marcar como ganho/perdido" | ⚠️ B-08 |
| "Marcar como perdido" | pede **motivo** (`dominio.md` §6) | move direto, sem motivo | ❌ [N] "Opp Exit" foi para Perdido sem perguntar |

### 3.4 Página do workflow (React Flow)

- **1440 px ✅** [N]: `#/tarefas/q4` desenha fontes → etapas com requisitos, cadeado, contagens; painel "Estrutura do funil" aberto à direita (≈ 30% da largura); controles de zoom e minimapa.
- **390 px ⚠️** [N]: funciona, mas o painel lateral **abre por padrão e ocupa ~85% da tela**; é preciso tocar em "Painel" para ver o desenho. Com o painel fechado o diagrama aparece, a barra de ferramentas quebra em 3 linhas e o **minimapa ocupa ~¼ da altura**. Não tem `fitView` (abre em zoom 0.85 deslocado), `nodesFocusable` padrão, `elementsSelectable=false`. Pan/zoom por toque é o padrão do React Flow, **não testei pinça** (ferramenta só tem mouse).
- **Escala ⚠️ (não medida):** 10 nós / ~900 elementos de DOM com 8 etapas e 6 requisitos (os requisitos são `button` dentro do nó, sem virtualização: `onlyRenderVisibleElements` não está ligado). Limites do servidor: 40 etapas, 200 requisitos. Estimo que ~40 etapas × 5 requisitos (200 botões) ainda renderize, mas **não testei** e o layout só calcula posições "da esquerda para a direita" (`buildGraph`, `TaskWorkflow.tsx:864`).
- **Dívida:** arquivo de **1098 linhas** com 20 hooks de estado/efeito, três componentes grandes (nós, dock, painel de registro) no mesmo módulo, mais `lint` com `set-state-in-effect`/`exhaustive-deps`.

## 4. Automações

### 4.0 A resposta curta: onde rodam e o que acontece com o navegador fechado

**Toda automação roda no navegador de quem está com o admin aberto, na hora da ação, com a memória do navegador como estado. Nada roda no servidor. Com o navegador fechado, nada acontece.** O servidor Go não tem tabela de automação, fila, agendador, nem cliente HTTP de saída (só o `emails.go` e o `revalidate.go`).

Consequências medidas:

1. **O lead que entra por formulário (`connect.js` / `/api/public/leads`) nunca dispara nada.** Ele é gravado pelo servidor; nenhum navegador emitiu `lead.criado`. As automações "Lead entra no funil" (boas-vindas por e-mail, notificar o responsável) **não rodam para o fluxo mais importante da Kalidash**.
2. **9 dos 20 eventos do catálogo não são emitidos por lugar nenhum** do código (`grep "emit('"` em `apps/admin/src`): `formulario.enviado`, `fonte.conectada`, `oportunidade.ganha`, `oportunidade.perdida`, `oportunidade.parada`, `lead.sem_contato`, `notificacao.lida`, `email.enviado`, `email.falhou`. Em especial **"Ganhou: vira cliente" nunca dispara**: mover a oportunidade para Ganho (`/api/leads/move`) não emite `oportunidade.ganha`; o ciclo de vida só vira Cliente por clique manual.
3. `oportunidade.mudou_de_etapa` só é emitido para **lead** (`leadFlow.ts:133`); o Kanban de oportunidades não emite. `oportunidade.criada` e `lead.qualificado` só saem do `qualifyLead` falso (§3).
4. `tarefa.atrasada` roda num `setInterval` do navegador (`taskNotify.ts`) e o "já avisei" fica no `localStorage`: com dois navegadores abertos, as ações disparam **duas vezes**; e, **causa provável (não isolada com depurador)**, a troca do id local pelo id do servidor depois do POST (`workflowSync.flushTasks`) faz a mesma tarefa parecer nova para `notifiedOverdue` (chaveado por id): visto 2 notificações e 2 "avisos da automação" para uma única tarefa atrasada.
5. A tela diz "Dados de exemplo… nada aqui é gravado e recarregar restaura o exemplo": **verdadeiro**. Visto: a automação gerenciada nascida de "Conectar fonte" apareceu na lista e **sumiu no F5**, enquanto a fonte (`Pipeline.config.sources`) ficou gravada. Fonte e automação divergem depois do primeiro recarregamento.
6. As contagens da lista ("Execuções 47, 12, 9, 6, 22") e o histórico `r1…r8` são **dados fabricados** no mock (`mocks/automations.ts`).

### 4.1 Eventos (gatilhos): emitidos × só no catálogo

| Evento | Quem emite hoje | Roda no servidor? |
|---|---|---|
| `pessoa.criada`, `empresa.criada` | cadastro manual / import no navegador (`NewPartyPanels`, `leadFlow`) | ❌ (o `connect.js` cria Pessoa no servidor sem emitir) |
| `campo.mudou` | `lib/edit.ts` (edição na ficha) | ❌ |
| `lead.criado` | `leadFlow.ts:106` (cadastro manual) | ❌ — **formulário não emite** |
| `lead.descartado` | `leadFlow.ts:140` | ❌ |
| `lead.qualificado`, `oportunidade.criada` | só `qualifyLead` (que não cria oportunidade real) | ❌ |
| `oportunidade.mudou_de_etapa` | só lead (`moveLeadStage`) | ❌ |
| `tarefa.criada` (só requisito com "notificar"), `tarefa.concluida`, `tarefa.atrasada` | `RecordTabs`, `taskActions`, `taskNotify` | ❌ |
| `formulario.enviado`, `fonte.conectada`, `oportunidade.ganha`, `oportunidade.perdida`, `oportunidade.parada`, `lead.sem_contato`, `notificacao.lida`, `email.enviado`, `email.falhou` | **ninguém** | ❌ |

### 4.2 Ações: reais (no navegador) × simuladas

| Ação | O que faz hoje (`events.ts: runAction`) | Real? | Persiste? |
|---|---|---|---|
| `ciclo.definir` | muda `lifecycle` de pessoa/empresa na store (só avança; Cliente = empresa se houver) | ✅ no navegador | ✅ com `CRM_API` (via `crmSync`); histórico `ChangeLog` |
| `tarefa.criar` | `addTask` (prazo = atraso em dias) | ✅ no navegador | ✅ só se entidade sincroniza (numérica / CRM) |
| `tarefa.concluir` | conclui tarefa aberta de mesmo título | ✅ | idem |
| `tag.adicionar`, `responsavel.atribuir` | lead/pessoa na store; responsável é **texto** do lead | ✅ | ⚠️ `owner` texto (não `ownerMemberId`) |
| `notificar.equipe` | `pushNotificacao` na caixa **do navegador** | ✅ só para quem está na tela | ❌ `localStorage` |
| `email.enviar` | devolve "E-mail enviado (simulado)" | ❌ **simulada**: nunca chama `/api/emails/send` | — |
| `lead.criar`, `contato.criar`, `empresa.criar`, `lead.qualificar`, `oportunidade.mover`, `webhook.chamar` | cai no `default`: "`<ação>` (simulada)" | ❌ **simuladas** | — |
| Atraso por ação (`delayDays` > 0, exceto `tarefa.criar`) | só escreve "agendada para daqui a N dias" e marca `SCHEDULED`; **ninguém agenda** | ❌ | ❌ |

### 4.3 Catálogo: cada automação (6 manuais/gerenciadas de exemplo + passos dos templates)

"Real?" = a ação executa de verdade quando o evento acontece **com o navegador aberto**. "Server" = o que falta para rodar sem navegador (S1 evento no outbox; S2 agendador; S3 fila/worker com retry; S4 cliente de e-mail; S5 tabela de execuções; S6 idempotência).

| Automação | Gatilho → ação | Origem | Real? | Persistida? | Falta no servidor |
|---|---|---|---|---|---|
| Criar lead a partir do formulário da LP | `formulario.enviado` → `lead.criar` | gerenciada (mock) | ❌ (o lead real já nasce do `connect_ingest.go`; a automação é rótulo) | ❌ some no F5 | nada: **virar configuração do `ConnectedProject`** (pipeline/etapa/dono), não "automação" |
| Importar contatos da planilha de parcerias | `formulario.enviado` → `contato.criar` | gerenciada (mock) | ❌ | ❌ | importação em lote é outro recurso |
| Tarefa "Informar CNPJ" ao entrar em Negociação | `oportunidade.mudou_de_etapa` → `tarefa.criar` | gerenciada (mock) | ❌ nunca dispara (Kanban não emite) | ❌ | S1+S3: emitir evento no `move` |
| Resumo por e-mail ao ganhar | `oportunidade.ganha` → `email.enviar` | manual (mock) | ❌ evento nunca emitido **e** ação simulada | ❌ | S1+S3+S4 (reaproveitar `emails.go`) |
| Cobrar tarefas atrasadas | `tarefa.atrasada` → `notificar.equipe` | manual (mock) | ✅ navegador aberto (duplica com 2 abas) | ❌ | S2 (varredura de `Task.dueAt`) + canal de notificação no servidor |
| Reenviar e-mails que falharam | `email.falhou` → `email.enviar` | manual (mock) | ❌ evento nunca emitido | ❌ | S4 + retorno do provedor |
| Lead entra no funil (passo) | `lead.criado` → ciclo LEAD, notificar responsável, e-mail "Boas-vindas (Inbound)" | passo do template (persiste em `config.steps`) | ⚠️ cadastro manual: ciclo + notificar ✅, e-mail simulado ❌; **formulário: nada** | passo ✅ / execução ❌ | S1 no `IngestLead`, S3, S4 |
| Lead sem contato (passo) | `lead.sem_contato` → notificar responsável do lead | passo | ❌ nunca emitido | passo ✅ | **S2 + SLA** (hoje não há prazo nem varredura) |
| Empresa sem CNPJ vira tarefa (passo) | `empresa.criada` → `tarefa.criar` "Informar CNPJ" (3 dias) | passo | ⚠️ só empresa criada na tela; a criada pelo servidor (CRM/connect) não | passo ✅ | S1 em `crm_companies`/ingest |
| CNPJ informado conclui a tarefa (passo) | `campo.mudou` (cnpj) → `tarefa.concluir` | passo | ✅ ao editar na ficha | idem | S1 em `PUT /api/crm/companies`; hoje edição por API/token não conclui |
| Lead qualificado vira oportunidade (passo) | `lead.qualificado` → ciclo PROSPECT | passo | ⚠️ roda, mas o "qualificar" é falso (§3) | passo ✅ | qualificar real (WP4) |
| Follow-up depois da proposta (passo) | `oportunidade.mudou_de_etapa` → `tarefa.criar` (3 dias) | passo (Q4) | ❌ Kanban não emite | passo ✅ | S1 no `move` |
| Oportunidade parada (passo) | `oportunidade.parada` → notificar dono | passo | ❌ nunca emitido (`alertDays` é só leitura de tela) | passo ✅ | **S2** usando `PipelineStage.alertDays` (não há `enteredStageAt`) |
| Ganhou: vira cliente (passo) | `oportunidade.ganha` → ciclo CLIENT | passo | ❌ nunca emitido | passo ✅ | S1 no `move` quando a etapa é `WON` (hoje o **cliente** manda `won:true`; o servidor não conhece o tipo da etapa) |
| Perdeu: fica inativo (passo) | `oportunidade.perdida` → INACTIVE | passo | ❌ | passo ✅ | idem + **motivo** |
| Lead descartado: fica inativo (passo) | `lead.descartado` → INACTIVE (se não há outro lead ativo) | passo | ✅ ao descartar na tela | passo ✅ | S1 em `PUT /api/crm/leads` |
| Onboarding do cliente / Check-ins e renovação (passos pós-venda) | `oportunidade.ganha` → 3+ tarefas e e-mail "Boas-vindas ao cliente" | passo | ❌ | passo ✅ | idem ganha |
| NDA ao negociar (Parcerias) | `oportunidade.mudou_de_etapa` → `tarefa.criar` "Assinar o NDA" | passo | ❌ | passo ✅ | S1 |

Categorias: `Fontes, Cadastros, Leads, Oportunidades, Pendências, Ciclo de vida, Notificações, E-mails` (8, só rótulo). Origens: `MANUAL` (editável, excluir) e `MANAGED` (só pausar; a edição manda para a pipeline). Nenhuma permissão por automação (a rota nem existe; `automations:manage` está **Reserved**).

### 4.4 O que falta para rodar no servidor e a distância da Entrega 3

Infra mínima (nada existe hoje):

| Peça | Estado | Observação |
|---|---|---|
| Tabela `Automation` (+ `AutomationRun`) com `idempotencyKey` único | ❌ | substitui `automationsStore`; o executor passa a ler dela |
| **Outbox de eventos** gravado na mesma transação da mudança (`lead.criado`, `…mudou_de_etapa`, `…ganha`) | ❌ | sem isso o servidor não sabe que "aconteceu algo" |
| Worker/fila com retry e backoff | ❌ | ver §8, comparação A × B |
| Agendador para eventos de tempo (`lead.sem_contato`, `oportunidade.parada`, `tarefa.atrasada`) | ❌ | falta `Opportunity.stageEnteredAt` e `Lead.firstResponseDueAt` |
| Webhook de saída (URL, segredo/HMAC, eventos, tentativas, `Deliveries`) | ❌ (tela de Webhooks é mock) | assinatura `X-Kalidash-Signature`, timeout, limite de corpo, DLQ |
| Auditoria (quem criou/alterou automação; quem executou) | ⚠️ `ChangeLog` do CRM serve de modelo | escopo `automations:manage` hoje só reservado |
| Permissões | ⚠️ escopo existe, rota não | Vendedor sem; Gerente/Admin com |

**Entrega 3 (09–23/11) × hoje:**

| Exigência | Hoje | Distância |
|---|---|---|
| Ciclo de vida do lead **Novo → Contatado → Negociação → Ganho/Perdido (com motivo)** | colunas de lead "Novos/Em contato" (`LEAD`), etapas abertas e `WON`/`LOST`; `Lead.status` ACTIVE/QUALIFIED/DISCARDED; `discardReason` só no lead; **sem motivo de perda** na oportunidade; qualificar falso | médio-alto: qualificar real + motivo + `firstContactAt` automático |
| Deduplicação por **e-mail + projeto** | pessoa deduplica por e-mail; lead **não** (2 envios = 2 leads); `connect_ingest` conhece o projeto | médio: índice/regra `(email, projectId)` em `IngestLead` + política (atualiza / ignora / marca "retornando") |
| **Rodízio** (round-robin) | nada; responsável manual; Vendedor não vê lead sem dono (D18) | médio: pool de elegíveis + cursor; depende de `TeamMember` ativo |
| **SLA** de primeiro contato | coluna `firstContactAt`; nada mede nem alerta | médio: prazo por pipeline + agendador + notificação |
| **Tags e filtros** | tags em lead/oportunidade ✅; filtro por tag na tela ✅ (cliente); servidor não filtra por tag | baixo |
| **Catálogo de fluxos** | catálogo de eventos/ações/templates **só front** (mock + `config.steps`) | médio: persistir `Automation` e templates |
| **Webhooks de saída ao marcar Ganho** | nada | alto (depende de outbox + worker) |

## 5. Permissões

_(pendente)_

## 6. Prova executada

_(pendente)_

## 7. Bugs, dívida técnica, desempenho, acessibilidade

_(pendente)_

## 8. Recomendação para a Entrega 3

_(pendente)_

## Ficou de fora / Riscos / Perguntas ao PO

_(pendente)_
