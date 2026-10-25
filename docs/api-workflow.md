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
| `GET` · `PUT` · `DELETE /api/pipelines/{id}` | Lê; **substitui** o funil inteiro (o admin edita o objeto todo); **arquiva** (nunca apaga). Remover uma etapa que ainda tem oportunidades devolve **409**. |
| `GET /api/tasks` | Filtros `entity`, `entityId`, `pipelineId`, `assignee`, `done=0|1`. Máx. 500. |
| `POST /api/tasks` | Cria tarefa manual. |
| `PUT /api/tasks/{id}` | Concluir/reabrir e editar título, tag, responsável e prazo. |
| `DELETE /api/tasks/{id}` | Só tarefa manual; a de requisito fica (o gate depende dela). |
| `POST /api/gate/check` | `{entity, entityId, entityName, fromStageId, toStageId}` → `{blocked, blockers[]}`. Cria a tarefa dos requisitos aplicáveis se faltar. |

**Gate no servidor:** com `WORKFLOW_API=1`, `POST /api/leads/move` também checa o gate e devolve **409** `{"error":"gate","blockers":[…]}` se algo trava. Regras iguais às de [notificacoes.md](./notificacoes.md) §4: `ENTER` vale para a etapa de destino, `EXIT` para a de origem, e **todas** as tarefas que travam a mesma fronteira precisam estar concluídas. Etapa que não pertence a nenhum funil (valor legado) não tem gate. Isto fecha a pergunta em aberto de onde o gate roda: **nas duas pontas** (o front checa antes para animar a recusa; a API garante).

## O que falta para as telas usarem isto

1. ~~Trocar os dados de exemplo pelas rotas~~ e ~~tratar o 409 do `move`~~: feitos (ver acima).
2. ~~O Kanban e a ficha usarem as etapas dos funis~~: feito (ver acima). Falta leads, pessoas e empresas ganharem API para suas tarefas também sincronizarem, e o Kanban mostrar todos os funis de uma vez.
3. Notificações geradas por tarefa (criada, atrasada, concluída) usando `pushNotificacao`.
4. Autenticação: como o resto da API, estas rotas estão abertas (CORS `*`) até a fase de segurança.
5. Tabelas próprias para `Source`, `CustomField` e `Automation` (hoje dentro do `config`).
