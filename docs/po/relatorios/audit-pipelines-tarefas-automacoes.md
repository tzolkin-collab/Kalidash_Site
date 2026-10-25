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

_(pendente)_

## 4. Automações

_(pendente)_

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
