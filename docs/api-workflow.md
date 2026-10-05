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

1. O admin trocar `pipelinesStore` e `tasksStore` por chamadas a estas rotas (e semear os funis de exemplo com `POST /api/pipelines`).
2. `Opportunities.tsx` tratar o **409** do `move` (hoje ignora a resposta): reverter o card e abrir o aviso com as tarefas que travam.
3. Notificações geradas por tarefa (criada, atrasada, concluída) usando `pushNotificacao`.
4. Autenticação: como o resto da API, estas rotas estão abertas (CORS `*`) até a fase de segurança.
5. Tabelas próprias para `Source`, `CustomField` e `Automation` (hoje dentro do `config`).
