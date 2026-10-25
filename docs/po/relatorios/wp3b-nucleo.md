# WP3b — Núcleo unificado no CRM v2 (relatório em andamento)

> Atualizado a cada item concluído. Legenda: ✅ feito e comprovado · ⚠️ parcial · ❌ não feito · ⏳ ainda não começou.
> Banco descartável apenas (MySQL em memória, fora do repositório). Nunca o `apps/api/.env`, nunca a API da 8080.

## (a) Checklist

| Item | Estado | Evidência |
|---|---|---|
| **D6** `POST /api/public/leads` cria Lead v2 com `CRM_API=1`; sem a flag segue o caminho antigo | ✅ | `leadSaver` (`public_leads.go`) despacha por `crmEnabled()`. `TestLeadSaverEscolhePeloFlag` (sem flag → caminho antigo, com flag → v2) e `TestHandlePublicLeadChamaODestino` (sem banco). `TestIntegrationCapturaV2` em MySQL em memória: lead na etapa `LEAD` do 1º funil, `origin=INBOUND`, fonte "Site — home", mensagem com WhatsApp e desafio, 2 envios do mesmo e-mail = 1 pessoa + 2 leads + 2 linhas `create` no histórico, **0 Oportunidades**; sem funil com etapa Lead → erro e nada gravado; `PUBLIC_LEAD_PIPELINE_ID/STAGE_ID/SOURCE` fixam o destino. Mesma gravação do `connect.js` (`IngestLead`, sem contadores de projeto). Validação, honeypot, `Origin`, 5/min por IP e corpo de 8 KB intactos |
| **D6** plano para os leads que já entraram como Oportunidade INBOUND (proposta ao PO, nada executado) | ⚠️ | Proposta abaixo, §(g). Depende de decisão do PO |
| **D10** contato, empresa e responsável da oportunidade ligados ao CRM v2 e à equipe; ficha edita os vínculos | ✅ | `Opportunity.contactId/companyId` já apontam para `Contact`/`Company`, que SÃO as tabelas de Pessoa e Empresa do CRM v2: o `PUT /api/leads` passa a gravá-los (e `POST`), conferindo que existem e não estão arquivados (422 senão); `null`/`""` limpa, campo ausente mantém. Responsável = **`Opportunity.ownerMemberId`** (coluna nova, só com `CRM_API=1`) → `TeamMember` ativo, exige `AUTH_API=1`. Desvio consciente: o PO pediu "não criar colunas na tabela antiga" para contato/empresa (cumprido); para o responsável a coluna `ownerId` tem FK para a tabela `User` do Prisma, que não é a equipe do login, então foi preciso uma coluna nova (aditiva, idempotente). Lead v2 ganhou `ownerId` (`Lead.ownerMemberId`) pelo mesmo motivo; `Lead.owner` segue como texto de "quem trouxe" (outbound). `TestIntegrationOportunidadeVinculos` (MySQL em memória): grava/recusa/limpa/mantém, nomes voltam na lista, sem `AUTH_API` o responsável é 422. Navegador (admin 5195 + API 8095 descartáveis): ficha com Prioridade, Tags, Contato, Empresa e Responsável; escolhi contato (João Silva) e responsável, o `PUT` voltou 200 e a anotação automática apareceu na linha do tempo |
| **D9** ficha edita prioridade e tags | ✅ | Prioridade (Baixa/Média/Alta) e tags (adicionar/remover) na ficha, gravadas por `PUT /api/leads` (que já gravava desde o WP-B). O corpo leva só id, título, valor e o que mudou (não reenvia vínculos nem tags antigas). Navegador: prioridade → Alta, tag "Prioridade" criada, recarregando via `GET /api/leads` vieram `HIGH` e `["Novo","Prioridade"]`. `npm test` 60/60 (`updateBody`, `mergeSaved`, `changeNote`) |
| **D4** "responsável" = referência à equipe; escopos `leads:own`/`opportunities:own`; Vendedor vê só o que é dele | ✅ | **Modelo:** `Opportunity.ownerMemberId` e `Lead.ownerMemberId` → `TeamMember` (ver D10). **Escopos** (`auth_scopes.go`): `leads:own` (leads v2, `/api/crm/leads*`) e `opportunities:own` (oportunidades, `/api/leads*`), só de pessoas (token nunca recebe: `HumanOnly`). Quem tem **só** o "own" de uma área passa nas rotas de `leads:read`/`leads:write` daquela área (`scopeSatisfied`, `auth_middleware.go`) e o servidor restringe: lista só o dele, abrir/editar/arquivar o de outro ou o sem responsável = **404**, notas, mover etapa e e-mail da oportunidade idem, criar fica **sempre em nome dele** (mesmo pedindo outro responsável), reatribuir = **403**. `leads:read`/`leads:write` (Gerente, Admin, ou extra) enxergam tudo. **Presets:** Vendedor troca `leads:read/write` por `leads:own` + `opportunities:own`; Gerente soma `leads:read/write` (hierarquia Vendedor ⊂ Gerente ⊂ Admin mantida). **Testes:** `TestIntegrationEscopoOwn` (MySQL em memória, caminho completo `withAuth` + handlers reais: lista, 404, 403, criar em nome dele, notas com id no corpo, mover, e o Gerente/extra vendo tudo), `own_scope_test.go` (catálogo, presets, `scopeSatisfied` por área, token recusa own), matriz antiga `TestPerfisNoServidor` **passa sem alteração**. **Navegador:** entrei como "Vera Vendedora" (Vendedor): Oportunidades "1 oportunidade", Leads só "Lead da Vera" com Dono "Vera Vendedora"; `GET /api/crm/leads/lv2` (do Vitor) = 404; `/auth/me` traz `leads:own`/`opportunities:own` e nenhum `leads:read` |
| Dashboard com leads, tarefas e origem reais | ✅ | `lib/dashboardMetrics.ts` (puro; `tests/dashboardMetrics.test.ts`, 4 testes). Navegador (admin como Admin, flags ligadas): Leads ativos 6, novos no período, aguardando contato, qualificados, origem por fonte (inclui "Site — home" do formulário) e Tarefas abertas/atrasadas/a vencer/concluídas. Com a API fora do ar a seção só explica o que falta ligar, sem número. Tarefas **não** são filtradas por responsável |
| Aviso de exemplo some das telas reais com as flags ligadas | ✅ | Leads, Clientes, Pessoas, Tarefas, Funis e Projetos já escondiam o aviso com as flags; faltava **Configurações**: com login e CRM na API o aviso só aparece na aba Webhooks (verificado: Perfil sem aviso, Webhooks com). Emails e Automações seguem de exemplo, com aviso |
| Testes, build, navegador, docs | ✅ | `go vet .` limpo. `go test -count=1 .` sem DSN: 99 PASS, 11 SKIP. Com `TEST_DSN` (MySQL em memória, com e sem `parseTime=true`): 110 PASS, 0 SKIP. Admin `npm test` 65/65, `tsc -b` e `npm run build` limpos. Formulário da Home: `POST /api/public/leads` com Origin permitida → 201 e o lead "Marina Prado" apareceu em Leads (Q4 Sales › Novos, Inbound, fonte "Site — home-diagnostico"), 0 oportunidade nova. Obs.: usei o endpoint com o mesmo payload do formulário; não subi `apps/site` (de outra sessão). Docs: ARCHITECTURE, api-crm, api-workflow, auth-study, inbound-leads, edicao-e-cadastro, pagesAdmin/dashboard e settings, `.env.example` |

## (g) Proposta ao PO — leads que já entraram como Oportunidade INBOUND

Hoje o formulário da Home só cria `Opportunity` em `INBOUND` + `Contact` + `Note`. Duas saídas:

1. **Conviver (recomendada).** Nada é migrado. Esses registros continuam como oportunidades e o funil de leads só recebe os novos. Zero risco no dado; custo: 2 lugares para olhar até as antigas fecharem ou serem descartadas.
2. **Converter, em lote e com backup.** Script único (a ser escrito e rodado pelo Gustavo, nunca por worker): para cada `Opportunity` com `stage='INBOUND'` sem tarefa ou nota além da automática, criar um `Lead` (mesma pessoa via `contactId`, mensagem copiada da `Note`, tags e `createdAt` preservados, fonte "Site — site") e arquivar/remover a oportunidade. Só vale para as que ainda estão em `INBOUND`; as que andaram de etapa ficam.

**Decisão pedida:** conviver (1) ou converter (2)? Se (2), confirmar o funil/etapa de destino (`PUBLIC_LEAD_PIPELINE_ID/STAGE_ID`). Enquanto isso o `NEXT_PUBLIC_LEAD_ENDPOINT` pode ser ligado sem risco de duplicidade, porque o destino é definido pela flag `CRM_API` na API.

## (h) Bugs achados pelo caminho (corrigidos)

- **Anotação da ficha nunca gravava** (`POST /api/leads/notes` exigia `?opportunityId=` mesmo no POST, e a ficha manda no corpo → 400): as anotações do usuário e as automáticas ("O valor foi alterado…") nunca eram salvas. Agora aceita no corpo. Visto no navegador (400 → 201).
- **`archivedAt` dos funis se perdia com `parseTime=true`** (pedido do PO, achado pelo BC-0a): `loadPipelines` lia com `time.Parse` de um formato só; com o driver entregando RFC3339, `?archived=1` vinha sem data. Reproduzi (`TestIntegrationPipelineTaskGate` falhava com `?parseTime=true`), corrigi com `parseDT` (commit `435712b`) e o teste agora reabre a conexão com `parseTime=true` e confere de novo, então roda nos dois modos mesmo com um DSN só.
- **Nome do responsável vazio** quando a pessoa da equipe não tem nome: cai no e-mail.
- Flaky eventual no `go test .` sem banco (1 falha em ~8 rodadas, não reproduzida ao repetir; o WP-B já apontou `TestCookieDaSessao` com `MaxAge` na virada de segundo). Não mexi.

## (i) Testes de matriz ajustados de propósito (D4)

1. `TestEfetivosSomamExtrasETiramRemovidos`: o Vendedor passou a ter `leads:own` (e não `leads:read`); a asserção agora confere isso.
2. `TestRotaExigeEscopo` exigia que todo escopo protegesse uma rota; `leads:own` e `opportunities:own` entram na lista de exceções (como `leads:origin`): eles não protegem rota própria, ampliam `leads:read/write` só para os registros da pessoa (`own_scope_test.go` prova).
3. `TestEdicaoDeEscoposRegras` usava `leads:read` como "extra que o preset já dá" para testar a normalização; trocado por `people:read` (o Vendedor não tem mais `leads:read` no preset).
4. `TestIntegrationAuth` (origem do lead): o lead de teste agora é do Vendedor (`ownerId`), porque lead de outra pessoa é 404 para ele; acrescentei o caso "lead sem responsável → 404".
A matriz `TestPerfisNoServidor` e a de regras finas (CPF, origem) passaram **sem mudança**.

## (b) Arquivos

API: `public_leads.go`, `connect_projects.go`, `opportunity_links.go` (novo), `own_scope.go` (novo), `main.go` (3 handlers viraram chamadas; notas, mover e e-mail checam o dono), `crm_leads.go`, `crm_schema.go`, `auth_scopes.go`, `auth_middleware.go`, `workflow_pipelines.go`, testes novos (`public_leads_v2*`, `opportunity_links_integration`, `own_scope*`) e ajustados (ver §i). Admin: `OpportunityDetail.tsx`, `opportunityApi.ts`, `dashboardMetrics.ts` (novo), `Dashboard.tsx`, `Leads.tsx`, `LeadSheet.tsx`, `Settings.tsx`, `roles.ts`, `scopes.ts`, `leadFlow.ts`, `crmSync.ts`, `domain.ts`, `types.ts` e testes. Docs listados acima.

## (c) Commits

`5f51baa` D6 · `cc60fd4` D10 API · `435712b` archivedAt/parseTime · `46c4bf2` notas, dono e e-mail · `ddee133` ficha (D10/D9) · `d008002` relatório · `85be696` D4 API · `54f74d3` e `85d8285` D4 admin · `e1b8c83` relatório · `9aff6e1` Dashboard e Settings · `22116a2` docs.

## (d) Ficou de fora

- **Qualificar lead não cria oportunidade real**: `qualifyLead` (admin) ainda cria oportunidade de exemplo em memória. Fora da lista do WP3b, mas é a costura que falta entre Lead v2 e Oportunidade. Recomendo WP próprio.
- Tarefas, histórico, pessoas e empresas não são filtrados por responsável (só leads e oportunidades).
- Conversão dos leads antigos (INBOUND): só o plano (§g); nada executado.
- MySQL/MariaDB reais não exercitados (continua com o WP3a, bloqueado pelo Docker).

## (e) Riscos

- Vendedor **não vê lead sem responsável** (inbound do site chega sem dono): só Gerente/Admin distribuem. Se o PO quiser uma "fila" para o Vendedor pegar, é decisão de produto (pergunta abaixo).
- `ownerMemberId` é coluna nova nas tabelas `Opportunity` e `Lead` (aditiva, via `ensureCRMSchema`): faça backup antes de ligar `CRM_API`.
- Flaky eventual do `go test .` sem banco (1 em ~8, não reproduzida; suspeita `TestCookieDaSessao`).
- Outra sessão tem arquivos de `apps/admin` modificados (`auth.ts`, `main.tsx`, `vite.config.ts`…); não incluí nenhum nos meus commits.

## (f) O que o Gustavo precisa fazer

1. Decidir §g (conviver ou converter) e, se quiser destino fixo, definir `PUBLIC_LEAD_PIPELINE_ID/STAGE_ID/SOURCE`.
2. Ligar `CRM_API=1` + `AUTH_API=1` (+ `WORKFLOW_API=1`) conforme o runbook do WP3c; só então apontar `NEXT_PUBLIC_LEAD_ENDPOINT`.
3. Depois de ligar, atribuir responsável aos leads/oportunidades existentes (Gerente/Admin), senão o Vendedor não verá nada.

**Perguntas ao PO:** (1) leads sem responsável: fila para o Vendedor pegar ou só o Gerente distribui? (2) filtrar tarefas por responsável também? (3) abrir WP para "qualificar lead" criar oportunidade real?
