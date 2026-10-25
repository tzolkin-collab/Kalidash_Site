# Auditoria — Funis, Tarefas e Automações (insumo da Entrega 3)

> 25/10/2026. Worker: sessão de auditoria (somente leitura; único arquivo criado: este relatório). Legenda: ✅ ok e comprovado · ⚠️ parcial/ressalva · ❌ ausente/quebrado. Evidência: **[C]** código · **[T]** teste · **[N]** navegador · **[H]** HTTP.
> Banco usado nas provas: MySQL em memória fora do repositório. Nunca o `apps/api/.env`, nunca a API da 8080.

## 0. Resumo executivo

- **Funis e tarefas gravam de verdade** (com `WORKFLOW_API=1`): criar pelo template, adicionar etapa/requisito, fontes, tarefas de oportunidade, recarregar mantém. O gate barra e libera como o doc diz **no caminho feliz** (409 reverte o card e avisa), e "Informar CNPJ" existe na etapa "Assinatura do contrato". 
- **A integridade vive na tela, não no servidor**: dá para furar o gate (criar direto na etapa, mudar de funil, Lead, "concluir" sem cumprir), apagar etapa onde há leads e deixar tarefa órfã. Contagens do card divergem do Kanban (legados fora; "bloqueados" conta tarefas).
- **Automações não existem no servidor.** Rodam só no navegador aberto, em memória (somem no F5); 9 dos 20 eventos nunca são emitidos (inclusive `oportunidade.ganha`), e-mail e webhook são simulados, e **o lead que chega por formulário não dispara nada**.
- **"Qualificar lead" corrompe o dado** (lead `QUALIFIED` apontando para oportunidade inexistente) e o admin **semeia exemplos no banco real** se abrir com tabelas vazias: os dois precisam ser resolvidos antes de ligar as flags em produção.
- **Entrega 3:** hoje existem só as colunas (`firstContactAt`, `discardReason`, tags); faltam dedup lead+projeto, rodízio, SLA, motivo de perda, catálogo persistido e webhooks de saída. Recomendo **outbox + tabela de jobs no MySQL com workers em goroutine** (não Redis) e 8 pacotes (~27,5 dias, caminho crítico 17): ver §8. Provas: API em MySQL em memória (110 testes Go passam, admin 72/72), nada de produção tocado.

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

Fonte: `auth_scopes.go` (`routeScope`, `sellerScopes`, `managerScopes`), `own_scope.go`. Provas: login de desenvolvimento como **Admin raiz** e como **Vera (Vendedor)**, chamadas `curl` com o cookie dela (**[H]**).

| Ação | Admin | Gerente | Vendedor | Servidor impõe? | Prova |
|---|---|---|---|---|---|
| Ver funis, etapas, requisitos | ✅ | ✅ | ✅ `pipelines:read` | ✅ | [H] `GET /api/pipelines` 200 |
| Criar/editar/arquivar funil, requisito, fonte, template | ✅ `pipelines:manage` | ✅ | ❌ | ✅ | [H] `PUT /api/pipelines/q4` como Vera → **403** `falta a permissão pipelines:manage` |
| Ver tarefas | ✅ | ✅ | ✅ `tasks:read` — **de todos** | ✅ (escopo) / ❌ (dono) | [H] `GET /api/tasks` como Vera listou tarefas de oportunidades que não são dela |
| Criar/concluir/editar tarefa | ✅ | ✅ | ✅ `tasks:write` — **de qualquer registro** | ❌ não há dono | [H] Vera: `PUT /api/tasks/{id} {done:true}` na tarefa de "Opp Gate" (de Admin) → **200**; `POST /api/tasks` em oportunidade alheia → 201 |
| Excluir tarefa manual | ✅ | ✅ | ✅ de qualquer um | ❌ | [H] Vera apagou a tarefa manual "Manual" (responsável "Ana") → 200 |
| `POST /api/gate/check` | ✅ | ✅ | ✅ `tasks:read` | ⚠️ grava | [H] Vera: consulta de oportunidade alheia devolveu os bloqueios e **criou** tarefas (rota tem escopo de leitura, efeito de escrita) |
| Mover oportunidade/gate | ✅ | ✅ | **só as dela** (`opportunities:own`) | ✅ | [H] mover a alheia → **404**; a própria para a mesma etapa → 404 (bug B-04, não permissão) |
| Mover **Lead** de etapa (sem gate) | ✅ `leads:write` | ✅ | só os dela (`leads:own`) | ✅ dono / ❌ gate | [C] `PUT /api/crm/leads/{id}` |
| Criar/editar/excluir **automação** | — | — | — | ❌ **rota inexistente** (404) | [H] `GET /api/automations` → 404. `automations:manage` está no preset do Gerente/Admin como `Reserved`: concede um escopo que ainda não protege nada |
| Webhook de saída | — | — | — | ❌ sem rota, sem escopo | tela Configurações → Webhooks é mock |
| Tokens de API | token com `tasks:read` | | | ⚠️ | um token só de leitura cria tarefa via `gate/check` |

**Lacunas (ordenadas):**

1. **Vendedor conclui tarefa de oportunidade que não é dele** (e a "Informar CNPJ" que destrava o gate dela): `tasks:write` não considera dono. Como a oportunidade alheia dá 404 para o Vendedor, ele **não vê** o registro, mas vê e age sobre a tarefa. D19 ("Vendedor vê as tarefas dos seus registros") exige filtrar `GET /api/tasks` e `PUT/DELETE /api/tasks/{id}` pelo dono do `entityId` (junção com `Opportunity.ownerMemberId`/`Lead.ownerMemberId`) — um "escopo own" para tarefas, no mesmo molde de `own_scope.go`.
2. **Responsável da tarefa é texto livre** (`Task.assignee`): quem edita pode pôr qualquer nome; o filtro `?assignee=` compara string. Trocar por `TeamMember.id` (como no WP3b) antes do filtro por responsável.
3. **`gate/check` precisa de `tasks:write`** (ou virar `POST` sem efeito colateral, só calculando).
4. **Gerente** recebe `automations:manage` sem rota: quando a rota existir, decidir se Vendedor pode **ver** execuções (`automations:read` não existe).
5. Sem trilha de auditoria de **quem** concluiu/reabriu uma tarefa no servidor (`Task` não tem `doneBy`; o histórico do CRM é gravado pelo navegador e só para pessoa/empresa/lead).
6. Quem tem `pipelines:manage` pode apagar requisito e etapa sem as proteções da tela (§2.2). Para a Entrega 3, mover as invariantes para o servidor ou reduzir o escopo a Admin.

## 6. Prova executada

### 6.1 Ambiente (tudo fora do repositório, tudo descartável)

- **Banco:** `memmysql.exe` (go-mysql-server, binário já existente no scratchpad de outra sessão, copiado para o meu) em `127.0.0.1:3327` (demonstração) e `:3328` (suíte de testes). Tabelas Prisma (`Opportunity`, `Contact`, `Company`, `User`, `Note`) semeadas por um programa `seed` **no scratchpad** (2 oportunidades legadas: `INBOUND` e `WON`).
- **API:** `go build` do `apps/api` para o scratchpad, rodada **de dentro do scratchpad** (não carrega nenhum `.env`), porta **8097**, `WORKFLOW_API=1 CRM_API=1 AUTH_API=1`, `AUTH_DEV_LOGIN=1`, `SESSION_SECRET`/`DATA_KEY` fictícios, `AUTH_ROOT_ADMIN=adm@kalidash.test`. **Não toquei** a API da 8080 nem o `apps/api/.env`; nenhuma credencial lida.
- **Admin:** `vite` do `apps/admin` na porta **5197** com `VITE_API_URL=http://localhost:8097` (variável só do processo; `.claude/launch.json` intacto).
- **Navegador:** painel do app (Chrome embutido), 1440×900 e 390×844. Para ver o que o **servidor** aceita independentemente da tela, chamei a API de dentro da própria página (cookie de sessão de dev) — marcado **[H]**.
- Ressalvas do ambiente: o MySQL em memória **não é** MySQL real (§ Riscos); `ensureConnectSchema` morre ao reiniciar a API sobre o mesmo banco (`bodyJson already exists`, limitação do servidor em memória: precisei zerar o banco entre reinícios); a primeira rodada do admin sem `phone`/`website` nas tabelas semente deu `500` em `/api/crm/people` (tabela semente incompleta, **não** bug do produto).

### 6.2 Roteiro pedido × resultado

| # | Passo | | O que vi |
|---|---|---|---|
| 1 | Criar funil pelo template | ✅ [N] | "Auditoria Funil" (Venda consultiva B2B + pós-venda): 8 etapas, 6 requisitos, 12 passos; `GET /api/pipelines` já o devolve (id gerado no navegador: `pl-mvo2wdcs30`) |
| 2 | Adicionar etapa | ✅ [N] | Configurações → Etapas → "Adicionar etapa": `OPEN:Nova etapa` entra antes de Ganho e persiste no servidor em ~2 s |
| 3 | Adicionar requisito | ✅ [N] | Tarefas → "Nova tarefa" (tipo Ação, "Reunião de diagnóstico (auditoria)"): gravado em `StageRequirement`. A janela seguinte diz "o avançado **cria uma automação de verdade**" — a automação é só de memória (§4) |
| 4 | Criar oportunidade | ✅ [H] | `POST /api/leads` (a tela "Nova Oportunidade" é a mesma chamada; B-F1 do WP-B já tratado). **Também aceitei** criação direto em etapa travada e em etapa inexistente (B-03) |
| 5 | Tentar mover bloqueada | ✅ [N][H] | Kanban (drop sintético via `DragEvent`, pois o arrasto nativo HTML5 não é simulável com a ferramenta): **o card voltou para Qualificação**, o servidor seguiu em `INBOUND`, nasceu a tarefa "Informar CNPJ" e o Aviso "**Consultoria Acme não pode avançar — Pendente: Informar CNPJ.**" entrou na caixa. [H] confirmou o `409 {"error":"gate","blockers":[…]}` |
| 6 | Concluir o requisito e mover | ✅ [N][H] | Concluir na ficha (aba Tarefas) sincronizou `done:true` (oportunidade numérica) e o `move` seguinte deu 200. **Em oportunidade com id de texto (`o1`) o "Concluir" não chegou ao servidor** (`isRealOpportunityId`), então o gate continuaria barrando |
| 7 | Tarefa manual atrasada + notificação | ✅ [N] | Prazo 20/10/2026 criado na ficha de "Opp Gate": `dueAt 2026-10-20T15:00:00Z` no servidor e **"Tarefa atrasada: Ligar para o cliente (atrasada)"** + "Aviso da automação para Responsável da tarefa" na caixa, **em duplicata** (B-12) |
| 8 | Workflow a 1440 e a 390 px | ✅ 1440 / ⚠️ 390 [N] | ver §3.4 |
| 9 | Automação gerenciada ao conectar fonte | ⚠️ [N] | "Cadastro manual": cria a fonte, **sem** automação. "Formulário": só oferece formulários **de exemplo**; com um deles a automação "Criar lead a partir de "Modal de inscrição"" apareceu em Automações e **sumiu no F5**; a fonte ficou gravada com `formId:"lp-consultoria:modal"` (id inexistente no servidor) |
| 10 | O que persiste ao recarregar | ✅/❌ | **Persiste:** funis, etapas, requisitos, fontes (JSON), tarefas de oportunidades numéricas, notificações (`localStorage`). **Perde:** automações (gerenciadas e manuais), execuções, a edição de limpar prazo/responsável de tarefa (volta o valor antigo), tarefas de oportunidade com id não numérico |

### 6.3 Provas extras de servidor (pelo console da página, [H])

| Teste | Resultado |
|---|---|
| Criar oportunidade em `q4:assinatura` (ENTER travado) | **201**, sem tarefa |
| Criar oportunidade em `xyz:nada` | **201** |
| Mover para `lixo:zzz` | **200** |
| EXIT de Proposta (Q4) ao ir para `b2b:qualificacao` | **200** (brecha entre funis) |
| Mover Lead v2 para etapa travada | **200** |
| `PUT /api/pipelines/q4` removendo a etapa `q4:novos` com 1 lead | **200**, lead fica em `q4:novos` |
| `PUT` mudando "Assinatura" para `WON` com 2 oportunidades | **200** |
| `POST /api/pipelines` com só 1 etapa `OPEN` | **201** |
| Remover requisito com tarefa aberta, depois `DELETE /api/tasks/{id}` | **200** e **409** (tarefa órfã permanente) |
| `PUT /api/tasks/{id} {dueAt:null,assignee:null}` | 200 e **nada muda** |
| `POST /api/tasks` com `entityId` inexistente | 201 |
| `POST /api/leads/move` para a etapa em que já está | **404** |
| Qualificar lead (tela Leads → Qualificar → valor R$ 8.000) | `Lead.status = QUALIFIED`, `convertedOpportunityId = "opp-mvo35qo134"`, **`GET /api/leads` continua com 2 oportunidades**: a "oportunidade" não existe (B-01) |
| Marcar oportunidade como perdida (ficha) | vai para Perdido **sem pedir motivo** |
| Reiniciar com banco vazio e abrir o admin | semeia 3 funis + pessoas/empresas/leads de exemplo no servidor (visto em "Ativos 10") |

### 6.4 Testes executados

| Comando | Resultado |
|---|---|
| `go vet .` (apps/api) | limpo |
| `go test -count=1 .` (sem `TEST_DSN`) | **99 PASS, 11 SKIP** (os 11 `TestIntegration*`) |
| `TEST_DSN='…:3328/kalidash_test' go test -count=1 -v .` | **110 PASS, 0 FAIL** |
| mesmo com `…?parseTime=true` | **110 PASS, 0 FAIL** |
| `npm test` (apps/admin) | **72 pass / 0 fail** (14 arquivos de teste) |
| Notas | `TestIntegrationEscopoOwn` **falha** num banco sem a tabela Prisma `Note` (`table not found: Note`, 1ª rodada minha); passa depois de semeá-la: o teste depende de uma tabela que ele não cria. Algum teste (não identifiquei qual; de `storage`/blog) loga `Erro ao subir pro R2 … 403` durante `go test`, ou seja, parece tentar uma chamada de rede real ao R2 com credenciais inválidas (nenhuma credencial minha estava no ambiente; vale um teste de olho: `go test` não deveria sair da máquina) |

### 6.5 Cobertura do que importa (e o que NÃO tem teste)

| Área | Coberto | Sem teste |
|---|---|---|
| Validação de funil/requisito/tarefa | `TestValidatePipelineOK/Rejects`, `TestValidateTask`, `TestPipelineJSONShape` | — |
| Gate no servidor (ENTER/EXIT, duas tarefas, idempotência, `wonAt`, editar/arquivar) | `TestApplicableGates`, `TestIntegrationPipelineTaskGate` (1 fluxo longo) | **EXIT entre funis, criar direto, etapa inexistente, Lead, remover requisito com tarefa aberta, remover etapa com lead, mudar tipo da etapa, mover para a mesma etapa, limpar prazo/responsável, `gate/check` com efeito colateral, permissões de tarefa por dono** |
| Escopos | `TestRotaExigeEscopo`, `TestCadaEscopoAbreSoSuaRota`, matrizes de perfil | Vendedor × tarefa de outro (não existe regra) |
| Admin: diff de sincronização, stages, alertas de tarefa, métricas | `workflowDiff`, `stages`, `taskAlerts`, `dashboardMetrics`… | **`events.ts` (motor de automações), `gate.ts`, `taskActions.ts`, `taskNotify.ts` (duplicidade), `pipelineTemplate.ts`, `lifecycle.ts`, `leadFlow.ts` (`qualifyLead`), `TaskWorkflow.tsx`/`buildGraph`, qualquer componente** |
| Ponta a ponta (admin × API) | nenhum | tudo da §6.2 foi manual |
| MySQL/MariaDB reais | nenhum (WP3a bloqueado por Docker) | `COALESCE` em JSON, `RowsAffected` sem `clientFoundRows` (B-04) |

## 7. Bugs, dívida técnica, desempenho, acessibilidade

### 7.1 Bugs (reproduzidos, salvo indicação)

**Bloqueia a Entrega 3 ou o uso em produção**

| ID | Bug | Passos para reproduzir | Onde |
|---|---|---|---|
| **B-01** | **Qualificar lead corrompe o dado**: o lead vira `QUALIFIED` apontando para uma oportunidade que **não existe** | Ligar `CRM_API`/`WORKFLOW_API`/`AUTH_API`; criar um lead; Leads → "Qualificar" → informar valor → confirmar. `GET /api/crm/leads` mostra `status:QUALIFIED, convertedOpportunityId:"opp-…"`; `GET /api/leads` não ganhou linha | `leadFlow.ts:qualifyLead` cria a oportunidade só na store/`sampleOppsStore`; a API aceita `convertedOpportunityId` sem FK |
| **B-02** | **Semeadura de exemplo no banco real**: com tabelas vazias, o primeiro admin que abrir o app cria no servidor 3 funis de exemplo e 9 leads/pessoas/empresas "Renata Moura…" | Subir API com as flags e banco vazio → abrir o admin → "Ativos 10"; `GET /api/pipelines` devolve 3 funis que ninguém criou | `workflowSync.initWorkflowSync` (servidor vazio → POST dos mocks), `crmSync.initCrmSync → seed()` |
| **B-03** | **Gate tem 4 brechas e um calcanhar**: (a) criar oportunidade direto em etapa travada; (b) EXIT ao mudar de funil; (c) mover para etapa inexistente; (d) Lead sem gate; (e) "concluir" sem cumprir o requisito, por qualquer perfil com `tasks:write` | §6.3 | `checkGate` olha só o funil da etapa de destino; `createOpportunity` não chama o gate; `crm_leads` não chama o gate; `PUT /api/tasks` não valida |
| **B-05** | **"Conectar fonte" não conecta nada real**: lista só formulários de exemplo; a fonte guarda `formId` de mock; a automação gerenciada some no F5; duas "fontes de verdade" (`Pipeline.config.sources` × `ConnectedProject.pipelineId`) | §6.2 passos 9 | `PipelineEditors.tsx:ConnectSourcePanel` lê `projectsStore` (mock), não `useApiProjects` |
| **B-09** | **O servidor não dispara nada**: formulário → lead não aciona automação; `oportunidade.ganha/perdida/parada`, `lead.sem_contato`, `formulario.enviado` nunca são emitidos; "Ganhou: vira cliente" não roda; e-mail e webhook são simulados | §4 | `events.ts`, `leadFlow.ts`, `Opportunities.tsx` (não emite) |
| **B-10** | Tarefas de oportunidade com **id não numérico** não sincronizam (concluir "Informar CNPJ" na tela não libera o gate) | `o1` da semente: "Concluir" na ficha → `done:false` no servidor | `workflowDiff.isRealOpportunityId = /^\d+$/`. 🟡 HIPÓTESE de impacto real: só afeta oportunidades criadas fora de `createOpportunity` (cuid do Prisma/seed). Conferir os ids da base real antes de ligar |

**Incomoda**

| ID | Bug | Passos | Onde |
|---|---|---|---|
| **B-04** | Mover para a etapa em que a oportunidade **já está** dá 404 "Oportunidade não encontrada" | `POST /api/leads/move` com a mesma etapa | `main.go:174-184` (`RowsAffected()==0`); em MySQL real sem `clientFoundRows` também zera |
| **B-06** | **Tarefa órfã permanente**: remover um requisito deixa tarefas abertas que não somem, não contam e não podem ser excluídas | `PUT` sem o requisito; `DELETE /api/tasks/{id}` → 409 | `handleTaskByID` (só `requirementId IS NULL`) + `writePipeline` sem varrer tarefas |
| **B-07** | **Limpar prazo ou responsável não grava** (volta no F5) | `PUT /api/tasks/{id} {dueAt:null,assignee:null}`; na ficha, editar tarefa e esvaziar o prazo | ponteiro nulo = "não enviado" em `handleTaskByID`; `diffTasks` envia `undefined` |
| **B-08** | Mover card só por arrasto HTML5; sem teclado e sem "Mover para…" (celular depende do toque longo, não testado) | Kanban em 390 px | `Opportunities.tsx:222`, `handleDrop` |
| **B-11** | Contagens do card/lista de funis erradas: legados fora; "bloqueados" conta tarefas (inclui de registros que já saíram); "Tarefas" = nº de requisitos; "atrasadas" ignora manuais; lista da esquerda dizia "0 registros" com 2 oportunidades legadas | §3.2 | `loadPipelines` (match por id exato), `pipelineStats.ts` |
| **B-12** | Notificação "tarefa atrasada" e "aviso da automação" **em duplicata**; aviso "Esta tarefa não pode ser apagada" espúrio | criar tarefa manual atrasada pela ficha; abrir a caixa | `taskNotify.ts` (chave por id) × `workflowSync.flushTasks` (troca de id); causa provável, não isolada |
| **B-13** | Integridade do funil só na tela: remover etapa Lead com leads, mudar tipo da etapa com registros, funil sem Ganha/Perdida, e `PUT` last-write-wins | §2.2 | `writePipeline`/`validatePipeline` |
| **B-14** | "Marcar como perdido" sem motivo; Opportunity sem coluna de motivo | ficha → Marcar como perdido | `OpportunityDetail.tsx`, `Opportunity` |
| **B-16** | Textos que prometem o que não existe: "o avançado cria uma automação **de verdade**"; "Conclui sozinha quando o campo é preenchido" (só se a automação rodar no navegador); "Execuções 47/12/…" inventadas | §6.2 passo 3; Automações | `PipelineEditors.tsx`, `mocks/automations.ts` |
| **B-17** | `POST /api/gate/check` tem escopo de leitura mas **grava** (cria tarefas) | token só `tasks:read` | `auth_scopes.go:217` × `checkGate` |
| **B-18** | Vendedor lê, conclui, cria e apaga tarefas de registros que não são dele | §5 | `tasks:write` sem dono (D19) |

**Cosmético / a confirmar**

| ID | Bug | Observação |
|---|---|---|
| B-19 | "Em contato" aparece como "Novos" em "Ver leads" para funis criados pelo template | `Opportunities.tsx:201` compara `stageId.endsWith(':contato')`; ids do template terminam em `…:<n>-<chave>`. [C], não vi na tela |
| B-20 | Lista de Automações repete os 12 passos de cada funil (45 linhas, "Lead entra no funil" ×4) sem mostrar o funil na linha | só `managedBy` no `title` do selo |
| B-21 | `CustomSelect` exposto como `generic` na árvore de acessibilidade (não `combobox`/`button`) e a lista ficou aberta depois de escolher uma opção até clicar fora (pode ser atraso da captura) | [N] |
| B-22 | `Opportunities` mostra id cru da etapa (`xyz:nada`) para etapa desconhecida | consequência de B-03(c) |

### 7.2 Dívida técnica

1. **`TaskWorkflow.tsx` (1098 linhas)**: nós (`StageNode`, `SourceNode`), grafo (`buildGraph`), dock de estrutura, painel de registro (`RecordTaskPanel`) e 20 hooks no mesmo módulo; sem teste; avisos de lint (`set-state-in-effect`, `exhaustive-deps`). Separar em `workflow/{nodes,graph,dock,record}.tsx` e testar `buildGraph`.
2. **O mesmo gate escrito duas vezes** (`gate.ts` e `checkGate` em Go) e **duas resoluções de "em que etapa está"** (`stages.ts: legacyStage` × `loadPipelines`), que divergem (B-11). Uma só (no servidor) e o front só consome.
3. **Estado local × servidor:** o navegador é o dono do estado e o servidor um disco: `PUT` do funil **inteiro** a cada edição (600 ms, `workflowDiff`), recarregar a lista num 409 **descarta edições locais pendentes** (`flushPipelines → reloadPipelines`), flag global `silent`, sem versão/ETag. Para multiusuário (equipe de vendas) é o ponto mais frágil.
4. **Código de produção importa de `mocks/`** (`pipelinesStore`, `tasksStore`, `automationsStore`, `projectsStore`, `leadsStore`): o mock **é** o store.
5. **Motor de automações (`events.ts`) 100% acoplado às stores** (lê/escreve `peopleStore`, `leadsStore`, `tasksStore`…). Não portável: a versão do servidor precisa ser reescrita em Go (e a do front vira só leitura de execuções).
6. **`Pipeline.config` é JSON opaco** (fontes, campos, passos, templates): sem migração, sem consulta, 256 KB, e o servidor não pode agir sobre ele (ex.: um passo "ao ganhar → webhook").
7. **`workflowSync`/`crmSync`** repetem o mesmo andaime (snapshot, diff, `schedule`, `silent`, seed): candidato a um núcleo comum.
8. `Opportunity` não tem `pipelineId` (o funil é deduzido do id da etapa e de nome): o próprio WP0 e o `dominio.md` dependem disso; qualquer relatório por funil precisa de `LEFT JOIN PipelineStage`.
9. Testes só unitários no admin (14 arquivos) e nenhum de integração admin × API.

### 7.3 Desempenho

- `loadPipelines` faz **5 varreduras completas** a cada `GET /api/pipelines` (todas as `PipelineStage`, todas as `StageRequirement`, `Task` agrupada, `Opportunity` agrupada), mesmo para `GET /api/pipelines/{id}` (a consulta de etapas/requisitos não filtra pelo funil). Tolerável hoje (dezenas de linhas); cresce com `Task` e `Opportunity`. O admin chama isso na abertura, depois de cada 409 e no `reloadPipelines`.
- `GET /api/tasks` tem `LIMIT 500` **silencioso**: acima disso o admin hidrata a lista truncada e o `diffTasks` pode apagar localmente o que não veio. Sem paginação.
- `checkGate` faz 3–4 consultas por requisito aplicável (sem transação): ok para 2 requisitos, mas a consulta é por tentativa de arrasto.
- Semente do admin: POSTs **sequenciais** (3 funis, dezenas de pessoas) na primeira abertura.
- Workflow: 10 nós / ~900 elementos de DOM com o funil padrão; sem virtualização; não medi com 40 etapas (§3.4). Bundle do admin avisa chunk grande (já no WP0).
- `taskNotify` roda `check()` a cada `CHECK_MS` varrendo todas as tarefas (O(n) por tick) e dá `setInterval` sem `clearInterval`.

### 7.4 Acessibilidade (observação em tela, 1440 e 390 px; contraste **não medido** com ferramenta)

- ✅ Região do workflow rotulada (`role="region" aria-label="Workflow de …"`), botão do painel com `aria-pressed`, nós do React Flow focáveis, botões de ícone com `aria-label` ("Excluir Informar CNPJ", "Editar …").
- ❌ **Mover card sem teclado** (HTML5 DnD); "Marcar como ganho/perdido" é a única alternativa.
- ⚠️ `CustomSelect` não é `<select>` nem `combobox` na árvore de acessibilidade; em celular e leitor de tela vira texto genérico.
- ⚠️ Painel lateral do workflow abre por padrão e cobre ~85% da tela a 390 px; o foco não vai para ele (não conferi `inert`).
- ⚠️ Alvos de toque pequenos nos ícones de ordem/exclusão das etapas (≈ 16–24 px) a 390 px (estimado pela captura, 🟡 HIPÓTESE).
- ⚠️ Estado só por cor em parte dos selos (Aberta/Lead/Ganha usam cor + texto; "Sem fonte" laranja sobre branco parece de contraste baixo, **não medido**).
- ⚠️ Avisos do gate aparecem como toast + caixa; não conferi `aria-live`.

## 8. Recomendação para a Entrega 3 (09 a 23/11/2026)

### 8.1 Decisão técnica: como executar automações no servidor

Escala real: uma API Go em **uma** VPS, dezenas de leads/dia, centenas de execuções/dia, **sem Redis hoje**, MySQL já é a única dependência (`docs/architecture-decisions.md` §3 já escolheu "goroutines nativas, zero dependência extra" para webhooks).

| | **A. Outbox + tabela de jobs no MySQL, workers em goroutine (polling)** | **B. Fila externa (Redis + BullMQ ou, em Go, `asynq`)** |
|---|---|---|
| Consistência | evento e mudança de negócio na **mesma transação** (outbox): não perde nem duplica por falha entre "gravou" e "enfileirou" | escrita dupla (MySQL e Redis): precisa de outbox mesmo assim, ou aceita perder/duplicar |
| Infra nova | **nenhuma** | Redis na VPS (memória, persistência AOF, backup, monitoramento, segurança, atualização) |
| Linguagem | Go puro | **BullMQ é biblioteca Node**: usar com a API Go exige um worker Node à parte (mais um serviço) ou trocar por `asynq` |
| Retry/backoff/agendamento | `attempts`, `runAt`, `nextAttemptAt`, backoff exponencial em SQL | nativo |
| Visibilidade | `SELECT … FROM Job` (e o admin lê a mesma tabela para "Execuções") | painel da fila (bull-board/asynqmon) à parte |
| Throughput | centenas/s com polling a cada 1–2 s, claim por `UPDATE … WHERE status='pending' AND runAt<=now() ORDER BY id LIMIT n` (portável: MySQL 8, MariaDB, e o MySQL em memória dos testes; `SKIP LOCKED` fica opcional) | milhares/s |
| Várias instâncias da API | funciona com o claim atômico (lock por `lockedUntil`) | funciona |
| Teste | o mesmo `TEST_DSN` dos demais; sem container extra (hoje o Docker nem está instalado: WP3a bloqueado) | exige Redis nos testes |
| Custo | ~0 dia de infra | +3 a 4 dias (instalar, operar, runbook, testes) e +1 ponto de falha |
| Quando vira o limite | > ~50 jobs/s sustentados, jobs longos (minutos) ou necessidade de fan-out entre serviços | — |

**Recomendação: A.** Tabelas `DomainEvent` (outbox), `Job` (execução com `idempotencyKey` único, `attempts`, `runAt`, `lockedUntil`, `status` pending/running/done/failed/dead, `lastError`) e `AutomationRun`/`WebhookDelivery` como visões do mesmo `Job`; um *dispatcher* (lê `DomainEvent`, cria `Job` por automação/webhook ativo) e N workers goroutine; reinício seguro (jobs `running` com `lockedUntil` vencido voltam a `pending`); backoff 1 min → 5 min → 30 min → 2 h → 12 h e depois `dead` + notificação ao Admin. Agendador (eventos de tempo) = mesma tabela com `runAt` ou um tick que varre `Lead`/`Opportunity`/`Task`. **Gatilho para migrar para B:** carga sustentada > 50 jobs/s, ou segundo serviço (não Go) precisando consumir a fila.

### 8.2 O que construir (pacotes, ordem, dependências)

Numeração a combinar com o PO; "WP4" mantém o nome da D20. Custo em dias de uma pessoa, já com testes e verificação no navegador.

| Pacote | Entrega | Arquivos principais | Depende de | Critério de aceite (testável) | Dias | Risco |
|---|---|---|---|---|---|---|
| **WP4-0 Higiene de produção** | semeadura de exemplo só com `SEED_DEMO=1` (B-02); "Conectar fonte" lê os projetos reais e grava `ConnectedProject.pipelineId` como **única** fonte (B-05); ids não numéricos (B-10); banner/textos (B-16) | `workflowSync.ts`, `crmSync.ts`, `PipelineEditors.tsx`, `connect_projects.go` | — | Banco vazio + admin aberto ⇒ **0** linhas criadas; formulário real aparece na lista; F5 mantém a fonte | 1,5 | baixo |
| **WP4-1 Integridade do servidor (gate e tarefas)** | gate no `POST /api/leads` e no `PUT /api/crm/leads/{id}`; EXIT entre funis; etapa inexistente → 422; mover para a mesma etapa → 200; remover etapa com **leads** → 409; funil exige ≥1 Ganha e ≥1 Perdida; mudar tipo de etapa com registros → 409; requisito removido leva as tarefas abertas (ou as marca `archived`); `PUT /api/tasks` aceita `null` para limpar; `gate/check` sem efeito colateral; **tarefas por dono** (D19) e `assignee` como `TeamMember.id`; `Opportunity.pipelineId` | `workflow_tasks.go`, `workflow_pipelines.go`, `main.go` (move/create), `crm_leads.go`, `own_scope.go`, `auth_scopes.go` | — | Cada linha da §6.3 vira teste de integração com o resultado certo; Vendedor `GET /api/tasks` só vê as dele; `go test` com e sem `parseTime` | 4 | médio (muda regras que a tela já assume; migrar `assignee`) |
| **WP4-2 Qualificar lead real + motivo de perda** (D20) | `POST /api/crm/leads/{id}/qualify` transacional: cria `Opportunity` na 1ª etapa aberta, copia pessoa/empresa/dono/valor/tags, move as tarefas, marca o lead, exige `qualifyRequires` no servidor; `Opportunity.lostReason` (+ lista configurável), obrigatório ao entrar em etapa `LOST`; tela de Leads e ficha usam isso e `sampleOppsStore` sai do caminho | `crm_leads.go`, `opportunity_links.go`, `main.go`, `leadFlow.ts`, `LeadPanels.tsx`, `OpportunityDetail.tsx` | WP4-1 | Qualificar ⇒ `GET /api/leads` +1 e `Lead.convertedOpportunityId` existe; repetir ⇒ 409 idempotente; mover para Perdido sem motivo ⇒ 422 | 4 | médio-alto (toca o núcleo e a ficha) |
| **WP4-3 Eventos + jobs (fundação do servidor)** | `DomainEvent` (outbox na transação), `Job`, dispatcher + workers, retry/backoff, `idempotencyKey`, painel de execuções (API de leitura); eventos emitidos pelo **servidor**: `lead.criado`, `lead.qualificado`, `oportunidade.mudou_de_etapa/ganha/perdida`, `tarefa.concluida` | novo `jobs.go`, `events.go`; ganchos em `public_leads.go`, `connect_ingest.go`, `main.go`, `crm_leads.go`, `workflow_tasks.go` | WP4-2 | Derrubar a API no meio ⇒ ao subir, o job pendente roda **uma** vez; evento sem automação ⇒ nada; mesmo `idempotencyKey` ⇒ 1 execução; teste com banco em memória | 5 | alto (concorrência, reinício) |
| **WP4-4 Deduplicação + rodízio** | dedup `(e-mail, projeto)` em `IngestLead`: existe lead ativo ⇒ não cria outro, registra o envio e marca "retornando"; **rodízio**: `Pipeline.config.assignment` + cursor, aplicado na captura e no cadastro sem dono; Vendedor passa a ver o que recebeu | `crm_leads.go`, `connect_ingest.go`, `public_leads.go`, `own_scope.go`, tela de pipeline | WP4-1 (pode correr em paralelo ao WP4-2) | 2 envios do mesmo e-mail+projeto ⇒ 1 lead + 2 submissões; 6 leads com 3 vendedores ativos ⇒ 2 a 2; vendedor inativo é pulado | 3 | médio |
| **WP4-5 SLA de primeiro contato** | `Pipeline.config.sla.firstContactMinutes`; `Lead.firstResponseDueAt`; `firstContactAt` automático (1ª anotação/ligação/e-mail/tarefa concluída); varredura no worker emite `lead.sem_contato` + notificação **no servidor** (tabela `Notification`) ao responsável e ao Gerente; cartão com borda vermelha | `jobs.go`, `crm_leads.go`, `Leads.tsx`, `Opportunities.tsx` | WP4-3, WP4-4 | Lead sem contato após o prazo ⇒ exatamente 1 notificação (mesmo reiniciando a API); contato antes do prazo ⇒ nenhuma | 3 | médio |
| **WP4-6 Webhooks de saída (Ganho)** | `Webhook` (URL, segredo, eventos, ativo) + `WebhookDelivery`; entrega por job com HMAC `X-Kalidash-Signature`, timeout 10 s, 5 tentativas com backoff, bloqueio de IP privado/loopback (SSRF), "enviar teste"; tela Webhooks real; escopo `webhooks:manage` (**HumanOnly**, Admin) | `jobs.go`, novo `webhooks.go`, `Settings.tsx`, `auth_scopes.go` | WP4-3 | Mover para Ganho ⇒ POST ao receptor de teste com assinatura válida; receptor 500 ⇒ 5 tentativas; 2 movimentos para Ganho ⇒ 1 entrega por oportunidade; URL `http://127.0.0.1` ⇒ 422 | 4 | médio-alto (rede, segurança) |
| **WP4-7 Catálogo de fluxos persistido + execuções** | tabela `Automation` com os **fluxos do sistema** (boas-vindas, SLA, atrasada, ganho→webhook, ciclo de vida) ligáveis/desligáveis, leitura de execuções e log; `GET/PUT /api/automations` (`automations:manage`); Automações lê da API e **para de rodar o `events.ts` para os eventos que o servidor já cobre** (evita execução dupla) | `automations.go`, `Automations.tsx`, `events.ts` | WP4-3 | F5 mantém estado ligado/desligado; execução aparece com `result`/erro; Vendedor 403; nenhum evento executa no navegador **e** no servidor | 3 | médio |

**Total ≈ 27,5 dias** de uma pessoa: **não cabe em uma pessoa** até 23/11 (≈ 21 dias úteis, 26/10 → 23/11). **Caminho crítico** WP4-1 (4) → WP4-2 (4) → WP4-3 (5) → WP4-6 (4, o mais longo dos três finais) = **17 dias**, mais 1,5 de WP4-0 = ~18,5: cabe com **duas sessões em paralelo** e quase nenhuma folga. Ordem sugerida: **semana 1** WP4-0 + WP4-1 (e WP4-4 em paralelo, arquivos diferentes); **semana 2** WP4-2; **semana 3** WP4-3; **semana 4** WP4-5, 6 e 7 em paralelo (arquivos disjuntos). Se faltar tempo, cortar nesta ordem: WP4-7 (vira só leitura das execuções) → WP4-5 (SLA só notificação, sem borda vermelha) → WP4-6 sem tela de Webhooks (cadastro por API). Todas as estimativas são minhas, sem MySQL real e sem ter escrito a fundação: o risco de estourar está no WP4-3.

Regras da casa a lembrar em cada pacote: flag desligada por padrão (`JOBS_API=1`), `go test` com e sem `parseTime`, nada de produção, `docs/` no mesmo commit, e **nenhum worker de teste fala com a rede de verdade** (receptor local `httptest`).

### 8.3 O que NÃO construir (cortar para caber)

| Não construir agora | Motivo |
|---|---|
| Gatilhos por webhook de entrada por pipeline (`gatilhos-personalizados.md`) | não está na Entrega 3; exige URL assinada, mapeamento e freio por ritmo |
| Construtor livre "qualquer evento × qualquer ação", `campo.mudou` genérico e atraso por ação | 90% do valor vem de ~6 fluxos fixos; o construtor é o item mais caro de testar e mais fácil de errar |
| "Atualizar a partir do template" / "aplicar aos registros existentes" / ramificação se-senão / pós-venda encadeado | conforto; o template continua sendo cópia |
| WebSocket, Web Push, notificação por e-mail do sistema | a tabela `Notification` + leitura periódica (30–60 s) basta; push fica para depois |
| Calendário "Acompanhamento" (Google Calendar) | fora do contrato |
| Filtro de tarefas por tag/busca no servidor, paginação de `GET /api/tasks`, virtualização do workflow, polimento mobile do React Flow | só importam com volume que ainda não existe; registrar o limite de 500 como dívida |
| Rodízio com pesos, disponibilidade/escala, horário comercial no SLA | regra simples primeiro (círculo entre ativos) |
| Migrar os leads antigos `INBOUND` (D17 já decidiu conviver) | — |
| Redis/BullMQ | §8.1 |

### 8.4 Perguntas de produto para o PO

1. **"Catálogo de fluxos"** do contrato = lista de fluxos prontos que a pessoa liga/desliga (WP4-7) **ou** construtor livre? (a recomendação assume a primeira)
2. **Motivo de perda:** lista fechada configurável por funil, ou texto livre? Obrigatório sempre? Também para lead descartado (hoje `discardReason` texto)?
3. **Deduplicação:** duplicado vira (a) **ignora e registra o envio**, (b) cria novo lead marcado "retornando", (c) atualiza o lead aberto? E se o lead antigo já foi qualificado ou perdido? "Projeto" = `ConnectedProject` (LP) — dois formulários do mesmo projeto contam como o mesmo?
4. **Rodízio:** só entre **Vendedores ativos**? Inclui Gerente? Por funil ou global? O que fazer com lead sem ninguém elegível (fila, Gerente)? D18 ("lead sem dono o Vendedor não vê") continua?
5. **SLA:** quantos minutos (por funil)? conta em horário comercial? quem é avisado (responsável, Gerente, ambos)? o que "conta como contato" (anotação, ligação, e-mail enviado, tarefa concluída)?
6. **Webhook de saída:** quais campos no payload de Ganho (valor, contato, empresa, UTM)? destinatário único ou vários por funil? o receptor da Carol já existe (que sistema)? Precisamos de reenvio manual?
7. **Ciclo de vida do lead (contrato):** "Novo → Contatado → Negociação → Ganho/Perdido" = renomear as colunas **Novos / Em contato** e as etapas abertas, ou um campo `leadStage` separado do funil?
8. **Automações já mostradas na tela** ("Execuções 47…", "Resumo por e-mail ao ganhar"): aceitam ser **removidas** da tela até existirem de verdade (hoje parecem reais)?
9. **Gerente e Vendedor** podem desligar um fluxo do sistema? (hoje só `automations:manage`, concedido ao Gerente).
10. **Responsável da tarefa** passa a ser sempre uma pessoa da equipe (não "Vendedor responsável")? E "função" (papel) como destino, resolve-se para quem?
11. **Semente de exemplo:** posso remover do produto (apenas `SEED_DEMO=1`) ou a Carol usa a demonstração em produção?
12. **E-mail de boas-vindas** automático ao lead: entra na Entrega 3 (precisa do domínio verificado no Resend, runbook WP3c)?

---

## Ficou de fora desta auditoria

- **Arrasto real e toque no celular:** só drop sintético (`DragEvent`) no Kanban; a ferramenta não faz pinça/toque longo. Não testei em aparelho.
- **Carga:** nenhuma medição com dezenas de etapas/centenas de tarefas; números de desempenho são de leitura de código.
- **Contraste** e leitor de tela: não medi com ferramenta (só inspeção).
- **Banco real:** MySQL/MariaDB reais, `COALESCE` em JSON e `clientFoundRows` (B-04) não exercitados.
- **E-mail/Resend e Google real**: não tocados.
- Core ("tarefa Entrega 3" do Tzolkin Core): não consultei; usei o resumo do pedido e do `admin-checklist.md`.
- `Projects.tsx`/`connect.js` só no que toca a "Conectar fonte"; `Opportunities.tsx` só no gate e no Kanban; `Leads.tsx` só em qualificar.

## Riscos

- **R1 (alto):** ligar `WORKFLOW_API`/`CRM_API` em produção hoje cria dados de exemplo no banco (B-02) e deixa o gate furável por API (B-03). Ajustar WP4-0/1 **antes** de qualquer `NEXT_PUBLIC_LEAD_ENDPOINT` com tráfego real.
- **R2 (alto):** "Qualificar" corrompe o vínculo lead→oportunidade (B-01): não usar a tela de Leads em produção até o WP4-2.
- **R3 (médio):** sem o servidor executar automações, qualquer promessa de "e-mail automático/webhook ao ganhar" é falsa hoje.
- **R4 (médio):** o ambiente de prova é MySQL em memória; `SKIP LOCKED`/claim por `UPDATE … LIMIT` e `RowsAffected` precisam de MySQL/MariaDB real (WP3a).
- **R5 (médio):** `go test` parece fazer uma chamada de rede real ao R2 (log `403`); revisar para que os testes não saiam da máquina.
- **R6 (baixo):** a numeração WP4-x é minha; o PO decide nomes e ordem.

## O que o Gustavo precisa fazer

1. Decidir as perguntas §8.4 (1, 3, 5 e 6 mudam o desenho).
2. Instalar Docker (ou apontar um MySQL/MariaDB descartável) para o WP3a e para testar o worker em banco real antes do WP4-3.
3. Antes de ligar as flags em produção: conferir se existem oportunidades com id não numérico (B-10) e **não** abrir o admin com o banco vazio (B-02).

## Arquivos e commits

- Criado: `docs/po/relatorios/audit-pipelines-tarefas-automacoes.md` (único arquivo do repositório tocado). Nenhum código editado; nenhum arquivo de `apps/site`.
- Artefatos fora do repositório (scratchpad da sessão): `run/api.exe`, `run/memmysql.exe`, `seed*/` (semente do banco em memória), `vite.log`.
- Commits: `1afd90e` (§1–2), `9f9b074` (§3–4), `8ba855b` (§5–7) e o commit final (§0, §8 e fechamento).

