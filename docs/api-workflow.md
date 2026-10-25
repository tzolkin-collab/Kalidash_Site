# 🧭 API de funis, tarefas e gate

> **Status (05/10/2026):** API e esquema prontos, **desligados por padrão** e **nunca aplicados ao banco real**; testados sem banco e num MySQL descartável (ver "Como testar"). As telas ainda usam os dados de exemplo (`apps/admin/src/mocks`). Recorte do [plano-schema.md](./plano-schema.md) §2 e §6, com o formato do JSON igual aos tipos de `apps/admin/src/domain.ts` (`Pipeline`, `Stage`, `Requirement`, `TaskItem`), para a troca nas telas ser direta.

## Como ligar

Variável da API: `WORKFLOW_API=1`. Na subida ela cria quatro tabelas (`CREATE TABLE IF NOT EXISTS`; nada é alterado nem apagado): `Pipeline`, `PipelineStage`, `StageRequirement`, `Task`. Sem a variável a API não toca no banco nem expõe as rotas. **Faça backup do banco antes de ligar em produção** (o banco real é compartilhado).

## Como testar

- `go test .` roda os testes sem banco (validação, regras do gate, formato do JSON).
- `apps/api/workflow_integration_test.go` roda o fluxo completo (criar funil, contagens, gate com duas travas, concluir tarefas, mover, wonAt, editar e arquivar) contra um MySQL **descartável**. Só roda com `TEST_DSN` e só aceita localhost, nunca lê o DSN do `.env`:

```bash
TEST_DSN='root:@tcp(127.0.0.1:3306)/kalidash_test' go test -run Integration -v .
```

Ele apaga e recria as tabelas `Task`, `StageRequirement`, `PipelineStage`, `Pipeline` e `Opportunity` do banco indicado: use um banco vazio. Em 05/10 passou num servidor MySQL em memória (go-mysql-server), que é compatível, mas **não é o MySQL de produção**: rode também num MySQL/MariaDB real antes de ligar `WORKFLOW_API`.

## Como o admin usa (06/10)

`apps/admin/src/lib/workflowSync.ts` liga as telas à API sem mudar as telas: elas continuam lendo e escrevendo `pipelinesStore` e `tasksStore`, e a camada de sincronização carrega do servidor na abertura e grava as mudanças ~0,6 s depois.

- **Modo `api` ou `local`:** na abertura o admin pergunta `GET /api/pipelines`. Respondeu 200 → modo API (os avisos de "dados de exemplo" de Tarefas, Pipelines e do criador de pipeline somem). Deu 404 (`WORKFLOW_API` desligado) ou a API está fora → modo local, como antes, com os dados de exemplo.
- **Servidor vazio:** os funis de exemplo que a tela já mostra são criados no servidor uma única vez (e uma notificação avisa).
- **Funis:** editar etapas, requisitos, fontes etc. dispara `PUT`; funil novo dispara `POST`; arquivar/desarquivar vai no próprio `archivedAt`. Contagens, valores, `blocked` e `overdue` vêm do servidor e não contam como edição. Se o servidor recusar (409/422, ex.: etapa que ainda tem oportunidades), o admin avisa e volta ao que o servidor tem.
- **Tarefas:** só as de **oportunidades reais** (id numérico, como a API as cria) sincronizam. Leads, pessoas e empresas ainda são dados de exemplo e ficam só na tela, para não poluir o banco.
- **Oportunidade ligada ao CRM e à equipe (WP3b, 24/10):** `PUT`/`POST /api/leads` gravam `contactId` e `companyId` (as tabelas `Contact`/`Company` SÃO as de Pessoa e Empresa do CRM; o servidor confere que existem e não estão arquivadas, 422 senão) e, com `CRM_API=1` + `AUTH_API=1`, `ownerMemberId` (pessoa ativa da equipe). `null`/`""` limpa; campo ausente mantém. A resposta já traz os nomes (`contactName`, `companyName`, `ownerName`). `POST /api/leads/notes` aceita o `opportunityId` no corpo (antes só na query, e a ficha enviava no corpo: as anotações nunca gravavam). Quem só tem `opportunities:own` só lista, edita, anota, move e e-mail das próprias (404 nas demais).
- **Mover oportunidade:** `Opportunities.tsx` agora olha a resposta do `/api/leads/move`. No **409** de gate o card volta, aparece o aviso (toast + caixa) com as tarefas que travam e as tarefas e o funil são recarregados; outros erros também revertem o card e abrem um erro. Exemplos do protótipo e leads continuam sem reverter (não existem na API).

**Verificado em 06/10** com a API real rodando em `WORKFLOW_API=1` sobre um MySQL em memória (nunca no banco real): semear os funis, editar funil e criar tarefa com gravação automática, mover e ser barrado pelo gate (card reverte, aviso, tarefa de requisito criada), concluir a tarefa e mover com sucesso gravando `wonAt`.

**Kanban pelas etapas do funil (06/10):** o Kanban, o filtro de estágio, a coluna Estágio, os totais por etapa, o funil do Dashboard, "Marcar como ganho/perdido" e Clientes agora falam as etapas dos funis (`apps/admin/src/lib/stages.ts`). A coluna `Opportunity.stage` guarda ou o id de uma etapa (`q4:assinatura`) ou um valor antigo; a camada de resolução traduz o antigo: `WON`→etapa Ganha, `LOST`→Perdida, `QUALIFICATION`→"Qualificação" (ou a 1ª aberta), `INBOUND`→1ª etapa aberta. Nenhum dado do banco foi alterado. O Kanban mostra **um funil por vez** (o selecionado, ou o primeiro em "Visão Geral"); a ordem dos funis é a `position` (o admin a envia). Com isso o gate vale nas etapas reais: arrastar para "Assinatura do contrato" com a tarefa "Informar CNPJ" aberta é barrado pelo servidor, o card volta e o aviso aparece.

**Verificado em 06/10** (API real sobre MySQL em memória, admin no navegador): colunas = etapas do funil; oportunidades com valores antigos e com ids de etapa nos lugares certos; gate barrando no drop; concluir a tarefa e arrastar de novo passa; arrastar para Ganho grava `wonAt`; Dashboard e lista mostram as etapas.

## Modelo

- **Pipeline:** nome, oferta, posição, arquivamento e um `config` em JSON com o que ainda não tem tabela própria (fontes, campos personalizados, tags de tarefa, passos do ciclo de vida, templates). A API só valida esse JSON por tamanho (256 KB); quem o entende é o admin.
- **PipelineStage:** tipo `LEAD | OPEN | WON | LOST`, posição, cor, probabilidade (0–100) e dias de alerta. O `id` é o texto que já vai em `Opportunity.stage` (ex.: `q4:ganho`), então as oportunidades existentes continuam valendo, sem migrar dados.
- **StageRequirement:** o que a etapa exige (`FIELD | ACTION`), o `gate` (`NONE | ENTER | EXIT`), responsável, prazo em dias e o aviso ao responsável.
- **Task:** tarefa de um registro (`lead | person | company | opportunity | pipeline`), com `source` `manual | passo | requisito`. Chave única (`requirementId`, `entityKind`, `entityId`): uma tarefa por requisito e registro.

## Rotas

| Rota | O que faz |
|---|---|
| `GET /api/pipelines` (`?archived=1`) | Lista os funis com etapas, requisitos, `counts`/`values` por etapa (de `Opportunity`) e `blocked`/`overdue` por requisito (de `Task`). |
| `POST /api/pipelines` | Cria um funil inteiro. Ids que faltarem são gerados. |
| `GET` · `PUT` · `DELETE /api/pipelines/{id}` | Lê; **substitui** o funil inteiro (o admin edita o objeto todo); **arquiva** (nunca apaga). Remover uma etapa que ainda tem oportunidades ou leads devolve **409** (ver "Integridade no servidor"). |
| `GET /api/tasks` | Filtros `entity`, `entityId`, `pipelineId`, `assignee`, `done=0|1`. Máx. 500. |
| `POST /api/tasks` | Cria tarefa manual. |
| `PUT /api/tasks/{id}` | Concluir/reabrir e editar título, tag, responsável e prazo. |
| `DELETE /api/tasks/{id}` | Só tarefa manual; a de requisito fica (o gate depende dela). |
| `POST /api/gate/check` | `{entity, entityId, entityName, fromStageId, toStageId}` → `{blocked, blockers[]}`. Consulta pura desde o WP4-1: não cria tarefa (a tentativa de mover é que cria). |

**Gate no servidor:** com `WORKFLOW_API=1`, `POST /api/leads/move` também checa o gate e devolve **409** `{"error":"gate","blockers":[…]}` se algo trava. Regras iguais às de [notificacoes.md](./notificacoes.md) §4: `ENTER` vale para a etapa de destino, `EXIT` para a de origem, e **todas** as tarefas que travam a mesma fronteira precisam estar concluídas. Etapa que não pertence a nenhum funil (valor legado) não tem gate. Isto fecha a pergunta em aberto de onde o gate roda: **nas duas pontas** (o front checa antes para animar a recusa; a API garante).

## O que falta para as telas usarem isto

1. ~~Trocar os dados de exemplo pelas rotas~~ e ~~tratar o 409 do `move`~~: feitos (ver acima).
2. ~~O Kanban e a ficha usarem as etapas dos funis~~: feito (ver acima). Falta leads, pessoas e empresas ganharem API para suas tarefas também sincronizarem, e o Kanban mostrar todos os funis de uma vez.
3. Notificações geradas por tarefa (criada, atrasada, concluída) usando `pushNotificacao`.
4. Autenticação: como o resto da API, estas rotas estão abertas (CORS `*`) até a fase de segurança.
5. Tabelas próprias para `Source`, `CustomField` e `Automation` (hoje dentro do `config`).

## Integridade no servidor (WP4-1, 25/10/2026)

Antes disto o servidor só validava o formato; as regras do funil viviam na tela (ver `docs/po/relatorios/audit-pipelines-tarefas-automacoes.md`). Agora o servidor impõe, com `WORKFLOW_API=1` (e `CRM_API=1`/`AUTH_API=1` onde citado). Relatório: [wp4-1-integridade.md](./po/relatorios/wp4-1-integridade.md).

**Gate** (`ENTER` no destino, `EXIT` na origem, inclusive entre funis; mesma etapa não passa por gate):

| Onde | Resposta barrada |
|---|---|
| `POST /api/leads/move` (oportunidade) | `409 {"error":"gate","blockers":[…]}` e a **tarefa do requisito nasce** (é uma tentativa de mover) |
| `POST /api/leads` (criar oportunidade direto numa etapa travada) | `409` com os requisitos que faltam (`taskId` vazio); **nada é gravado**, nem tarefa |
| `PUT /api/crm/leads/{id}` (mudar `stageId`/`pipelineId` do lead) | `409` + tarefa criada, como no move |
| `POST /api/crm/leads` (lead nascendo em etapa travada) | `409`, nada gravado |
| `POST /api/gate/check` | **consulta pura**: `{blocked, blockers[]}`, não cria tarefa (`taskId` vazio quando ainda não existe). Quem só tem `tasks:read` pode chamar |

**Etapa de destino:** precisa existir (`PipelineStage`) ou ser um valor antigo (`INBOUND`, `QUALIFICATION`, `WON`, `LOST`), que o servidor traduz para a etapa equivalente do funil como o admin faz (`stages.ts`); senão **422**. Lead: a etapa precisa ser do funil dele (422). Mover para a **mesma etapa** é `200` (404 só se a oportunidade não existe).

**Funil (`POST`/`PUT /api/pipelines`):** exige ao menos uma etapa `WON` e uma `LOST` e 1–40 etapas (422). No `PUT`: remover etapa com oportunidades **ou leads ativos** → `409`; mudar o **tipo** de etapa que tem registros → `409`; requisito removido leva as **tarefas abertas** dele, e as concluídas viram tarefa comum (`source=manual`, sem `requirementId`), que pode ser apagada.

**Concorrência:** o funil devolve `updatedAt` (versão, precisão de segundo; toda gravação a muda). `PUT` aceita `If-Match: "<updatedAt RFC 3339>"` ou o campo `expectedUpdatedAt`; se divergir: `409 {"error":"conflict","message":…,"current":<funil atual>}` e nada é gravado. Sem nenhum dos dois, vale o último a gravar (como antes).

**Tarefas:** `PUT /api/tasks/{id}` distingue campo ausente (mantém) de `null` (limpa) em `tag`, `assignee`, `assigneeMemberId` e `dueAt`. `POST` confere que o registro existe (`422`; lead/pessoa/empresa só com `CRM_API=1`). `DELETE` apaga tarefa manual e a **órfã** (de requisito que não existe mais); a de requisito vigente segue `409`. Concluir a tarefa de um requisito `FIELD` exige o campo preenchido (`422` com a mensagem): o servidor reconhece pelo **título** do requisito `CNPJ` (CNPJ da empresa do registro), `CPF`, `e-mail`, `telefone`/`celular`/`WhatsApp`; outros títulos `FIELD` e todo `ACTION` concluem livres. Só com `CRM_API=1` (os campos moram nas tabelas do CRM).

**Tarefas por dono (D19, D36):** coluna aditiva `Task.assigneeMemberId` (→ `TeamMember`). `POST`/`PUT` aceitam `assigneeMemberId` (pessoa ativa da equipe; 422 senão; exige `AUTH_API=1`) e preenchem `assignee` com o nome dela; o texto `assignee` segue valendo sozinho. Com `AUTH_API=1`, quem só tem `leads:own`/`opportunities:own` (Vendedor) vê em `GET /api/tasks` apenas as tarefas atribuídas a ele ou ligadas a oportunidades/leads cujo responsável é ele; nas dos outros `PUT`/`DELETE` dão `404`, e `POST /api/tasks`/`gate/check` em registro alheio dão `404`. Gerente, Admin e tokens veem tudo.

**Funil da oportunidade:** coluna aditiva `Opportunity.pipelineId` (preenchida na criação e no move; as antigas, no startup, pelo id da etapa). `GET /api/pipelines` traz por funil `stats {records, openTasks, overdue, blocked}`: valores antigos de `stage` caem no primeiro funil ativo na etapa equivalente, `blocked` conta **registros** bloqueados e `overdue` inclui tarefas manuais.
