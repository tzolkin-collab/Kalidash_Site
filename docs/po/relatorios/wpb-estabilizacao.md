# WP-B — Estabilização do núcleo (a partir do WP0)

> 18/10/2026. Worker: sessão WP-B. Legenda: ✅ feito e comprovado · ⚠️ parcial · ❌ não feito.
> Nada foi executado contra o banco real nem com `apps/api/.env`. Nenhuma escrita foi feita na API de `localhost:8080`. Tudo foi visto num MySQL em memória (go-mysql-server, `127.0.0.1:3317`) que roda de uma pasta **fora do repositório** (scratchpad da sessão), com a API em 8090/8091 e o admin em 5190/5191. Tudo foi desligado ao fim.

## (a) Checklist da seção 9

| Item | | Evidência |
|---|---|---|
| **B-D1** `created_at`/`wonAt` zerados | ✅ | **Causa confirmada:** com `parseTime=true` o `database/sql` entrega o `DATETIME` lido em `string` como RFC3339 (`2026-09-03T10:20:30Z`); o `time.Parse("2006-01-02 15:04:05.999", …)` falhava e o erro era descartado. Isso casa com o que o WP0 viu em `localhost:8080`, então o DSN de produção provavelmente tem `parseTime=true` (não presumi nem li o DSN). **Reproduzi** com o `main.go` antigo: `TestIntegrationOportunidadeDatasEEdicao` falha com `created_at = 0001-01-01…` e `wonAt = <nil>` quando o teste reabre a conexão com `parseTime=true`. **Correção:** `parseDT` (`workflow_tasks.go`) aceita `"… 05[.fff]"` e RFC3339, sempre em UTC; usada em oportunidades e notas. Depois: o mesmo teste passa nos dois modos. No navegador (API com `parseTime=true`): Dashboard mostra "Valor ganho R$ 12.000, 1 contrato · este mês" (antes cairia no aviso "ganha sem data") e a ficha mostra "03/09/2026 · Oportunidade criada". |
| **B-F1** Nova Oportunidade sem tratamento | ✅ | `createOpportunity` (`Opportunities.tsx`) checa `res.ok`, valida o corpo com `asCreatedOpportunity` (`lib/opportunityApi.ts`, 2 testes) e usa `pushErro`. Navegador: com a API de pé, cria e a linha entra (R$ 1.500); com a API derrubada, o clique mostra o toast "Sem conexão com a API · A oportunidade não foi criada." e a lista continua com 3. (Antes: `Uncaught (in promise)` e nada na tela.) |
| **B-F5** PUT só gravava título e valor | ⚠️ | Levantamento: a ficha **só edita título e valor** (clique no campo). Prioridade, tags, estágio, contato, empresa, responsável e funil aparecem só como leitura (colunas). **Persistido agora:** `PUT /api/leads` grava também `priority` (LOW/MEDIUM/HIGH; valor fora do conjunto é ignorado, não bloqueia a edição) e `tags` quando vêm no corpo; campo ausente mantém o do banco (`COALESCE`); título vazio → 400. Teste em MySQL cobre gravar, manter, limpar tags (`[]`), prioridade inválida, 400 e 404. **Explícito na tela:** a ficha mostra "Nesta ficha só o título e o valor são editados e gravados… Prioridade, tags, contato, empresa, responsável e funil são só leitura" (e "Oportunidade de exemplo: nada daqui é gravado" para as de exemplo). Ficou ⚠️ porque **a ficha continua sem editar prioridade/tags** (as colunas existem; falta só decisão de produto/UI) e sem armazenamento para o resto (ver (d)). |
| **B-F2 / D8** envio de teste | ✅ | `POST /api/emails/test` (`emails.go`): usa só o e-mail da **sessão** (`principalOf`); `to`/`cc` no corpo são ignorados; sem sessão → 401; assunto sem quebra de linha (≤200), corpo ≤600 KB, **10 testes/h por pessoa** (429); falha do Resend → 502 sem vazar detalhe. Qualquer perfil logado pode (só vai para si mesmo). `go test`: 5 testes novos, incluindo o fluxo completo `withAuth` (sem cookie 401; Vendedor logado 200 e a resposta traz o e-mail dele, ignorando `to` malicioso). Os testes usam um `resendSend` trocável: **nenhum envio real foi feito**. Navegador: com login, o diálogo diz "será enviada só para o seu e-mail: adm@kalidash.test", sem campo de destino; "Enviar teste" faz `POST /api/emails/test` → 502 (API sem `RESEND_API_KEY`, esperado) e mostra "Não foi possível enviar" com o motivo. Sem login (API sem `AUTH_API`): botão `disabled` (verificado por JS), opacidade reduzida e o texto "Para enviar um teste, entre com a sua conta: ele só vai para o seu e-mail." ao lado. O caminho de **sucesso** só foi exercido por teste (sem chave do Resend, de propósito). |
| **B-F3 / D7** exemplo misturado | ✅ | Galeria: saiu do Dashboard para `#/dashboard/demonstracao` (`DashboardDemo.tsx`, com `SampleBanner` e voltar), com link discreto no rodapé do Dashboard; o Dashboard agora só tem dado real (visto no navegador). "Ver leads (9)" → "Ver leads (exemplo)", contagem "· 9 leads de exemplo" e badge "Exemplo" em cada linha quando `CRM_API` está desligado; com CRM ligado nada muda. `sampleOppsStore`: **não** alimenta `Opportunities.tsx` (o WP0 estava impreciso); alimenta Clientes e a ficha de pessoa/empresa. Esta última já tinha badge "Exemplo"; em **Clientes**, com o CRM da API ligado as de exemplo não entram nas contas. |
| **B-F4 / B-C2** textos e docs | ✅ | Banner de Configurações já tinha sido corrigido pelo WP1 (confirmado no código: sem "login por último"). `ARCHITECTURE.md`: linha duplicada de "Equipe e Configurações" na tabela de páginas virou linha própria; título "Status por módulo" atualizado (18/10); linhas de CRM, ficha, editor de e-mail, envio, Dashboard e pendência 2 atualizadas. `pagesAdmin/projects.md`: "planejado" → "tela com dados de exemplo, API é o WP2". `pagesAdmin/dashboard.md`: galeria documentada, funil descrito certo. |
| Testes novos, `go vet`/build limpos, navegador | ✅ | Ver (a2). |

### a2. Comandos e resultados

- `go vet .`: limpo. Rodei numa **cópia isolada** do pacote (HEAD + meus 4 arquivos, em scratchpad) porque, no meio da sessão, o working tree tinha o WP1.1 (escopos) com `auth_store.go` em edição e `go vet` quebrava em `auth_test.go` (`memStore` sem `SetMemberScopes`). Esse commit (`1801990`) já entrou depois e, no fim, `go vet .` e `go test -count=1 .` no repositório real (sem `TEST_DSN`) passaram.
- `go test -count=1 .` (cópia): `ok`.
- `TEST_DSN='root:@tcp(127.0.0.1:3317)/kalidash_test' go test -count=1 -v .` (MySQL em memória): 66 PASS, 0 SKIP; `TestIntegrationOportunidadeDatasEEdicao` incluso. Numa rodada `TestCookieDaSessao` falhou e passou em 5 de 6 repetições (ver (e)).
- `apps/admin`: `npx tsc -b` limpo; `npm test` 52 pass (inclui 2 novos meus, o resto é do WP1.1); `npm run build` ok (aviso de CSS preexistente).

## (b) Arquivos

API: `apps/api/main.go`, `workflow_tasks.go` (`parseDT`), **novo** `emails.go`, **novo** `opportunities_test.go`.
Admin: `Opportunities.tsx`, `OpportunityDetail.tsx`, `Dashboard.tsx`, **novo** `DashboardDemo.tsx`, `App.tsx` (1 rota), `Emails.tsx`, `Clients.tsx`, `lib/columns.tsx`, **novo** `lib/opportunityApi.ts`, **novo** `tests/opportunityApi.test.ts`.
Docs: `docs/ARCHITECTURE.md`, `docs/pagesAdmin/dashboard.md`, `docs/pagesAdmin/projects.md`, este relatório.

## (c) Commits

- `f616190` fix(api): datas das oportunidades com ou sem parseTime, PUT grava prioridade e tags, POST /api/emails/test
- `bfee002` fix(admin): erro ao criar oportunidade, teste de e-mail só para quem está logado, exemplo rotulado e galeria separada

## (d) O que ficou de fora (decisão do PO)

1. **B-F5, o restante:** estágio só muda por `/api/leads/move`; **contato, empresa e responsável** são vínculos por id (`contactId`/`companyId`/`ownerId`) e a ficha não os edita nem há seletor; o `ownerName` do front é texto livre e não casa com `User` (D4 já adia isso). `pipeline` no POST não tem coluna (o funil vem da etapa). Decidir: (i) ligar vínculos ao CRM v2 (`Person`/`Company`) em vez da tabela antiga, ou (ii) criar colunas. Também decidir se a ficha ganha edição de prioridade e tags (a API já grava).
2. `/api/emails/send` (por oportunidade) segue como estava: com `AUTH_API=1` exige sessão, mas qualquer perfil logado pode enviar e-mail a qualquer contato de oportunidade. Sugiro limitar a Admin/Gerente quando for tocado (WP4).
3. Aviso "Ligação prevista na fase N do plano" dos `SampleBanner` continua numerando fases do plano antigo (Automações 5, E-mails 6, Projetos 5), que não batem com a numeração WP. Texto, não bug; reescrever quando o PO fechar a numeração.
4. Galeria: no console aparecem avisos `<path> NaN` de alguns gráficos Recharts ao carregar `#/dashboard/demonstracao` (preexistente, só na galeria de demonstração; não investiguei).
5. B-F6 (service worker em porta alternativa), B-C1, B-C3: fora do escopo.

## (e) Riscos

- **Teste flaky do WP1:** `TestCookieDaSessao` compara `MaxAge` com `int(sessionTTL.Seconds())`, mas o `MaxAge` vem de `time.Until(expires)` e pode dar 604799 na virada de segundo (falhou 1 em 7 rodadas). Não mexi (arquivo do WP1/WP1.1); correção: tolerar ±2 s.
- `PUT` agora pode sobrescrever tags/prioridade com o que o cliente enviou: um admin com a lista desatualizada reenvia tags antigas (a ficha manda o objeto inteiro). Hoje a UI não muda tags, então o efeito é só reafirmar o valor que ela carregou; ficaria relevante se dois usuários editassem tags.
- `parseDT` lê texto sem fuso como UTC (como o driver grava, DSN sem `loc=`). Se o DSN de produção tiver `loc=Local` com máquina fora do UTC, as datas deslocam: conferir no runbook do WP3 (o WP0 já pedia "DSN sem `loc=`").
- O MySQL em memória não é MySQL real: `COALESCE(?, tags)` com JSON e o `ALTER` de parseTime precisam passar num MySQL/MariaDB real (WP3). `COALESCE(NULL, tags)` em coluna JSON é padrão, mas não foi exercitado em MySQL de verdade.
- O envio de teste real (Resend) nunca foi disparado nesta sessão.
- `/api/emails/test` está na regra padrão (`accAny`) de `routeAccess`; não editei `auth_middleware.go` (o WP1.1 mexia nos escopos). Se o WP1.1 trocar o default de rotas desconhecidas para "negar", essa rota precisa entrar na tabela.

## (f) O que o Gustavo precisa fazer

1. Conferir se o DSN de produção tem `parseTime=true` (explica B-D1) e **que não tem `loc=`**; sem mexer em nada: a correção vale nos dois casos.
2. Para o envio de teste funcionar em produção: `RESEND_API_KEY` na API (já usada por `/api/emails/send`) e `AUTH_API=1` ligado (o teste só vai para a conta logada). O Resend sem domínio verificado só entrega para o e-mail dono da conta do Resend: pode ser preciso verificar o domínio.
3. Decidir os pontos de (d)1: ficha edita prioridade/tags? contato/empresa/responsável vêm do CRM v2?
4. Lembrete do WP0 (R1/R2, ainda abertos): a API em `localhost:8080` ligada a um banco aparentemente real e a credencial em `apps/api/scripts/test.go`.
