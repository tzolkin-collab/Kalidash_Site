# 👥 API de pessoas, empresas e leads

> **Status (05/10/2026):** API e esquema prontos e testados (sem banco e num MySQL em memória); **desligados por padrão** e **nunca aplicados ao banco real**. O admin já sincroniza com ela quando ligada (ver "Como o admin usa"); sem ela segue com os dados de exemplo. Recorte do [plano-schema.md](./plano-schema.md) §3 e §4, com o JSON igual aos tipos `Person`, `Company` e `Lead` de `apps/admin/src/domain.ts`.

## Como ligar

Variáveis da API: `CRM_API=1` e `DATA_KEY` (ver `apps/api/.env.example`). Na subida a API:

- acrescenta colunas às tabelas **`Contact`** (pessoa) e **`Company`**, que já existem: só `ADD COLUMN` e índice único, nada é alterado nem apagado, e as linhas antigas continuam valendo (ficam com ciclo de vida `LEAD` e sem data de criação);
- cria **`CompanyStakeholder`**, **`Lead`** e **`ChangeLog`** (o histórico de mudanças).

Sem `CRM_API` a API não toca no banco nem expõe as rotas. **Faça backup antes de ligar** (o banco real é compartilhado). Sem `DATA_KEY` as rotas funcionam, mas qualquer CPF novo é recusado (422) com uma mensagem clara.

## Rotas (prefixo `/api/crm`; `/api/leads` segue sendo as oportunidades)

| Rota | O que faz |
|---|---|
| `GET` · `POST /api/crm/people` | Lista (`?q=`, `?lifecycle=`, `?archived=1`, `?limit=` máx. 500, `?offset=`; total em `X-Total-Count`) · cria. |
| `GET` · `PUT` · `DELETE /api/crm/people/{id}` | Lê · **substitui** · **arquiva**. `PUT` com `archivedAt` nulo desarquiva. |
| `GET /api/crm/people/{id}/document` | Revela o CPF completo (`Cache-Control: no-store`). **Sem autenticação por enquanto**: entra na fase de segurança com permissão por perfil e auditoria. |
| `GET` · `POST /api/crm/companies` | Mesmos filtros (busca por nome e razão social). |
| `GET` · `PUT` · `DELETE /api/crm/companies/{id}` | O `PUT` substitui também os **stakeholders**. |
| `GET` · `POST /api/crm/leads` | Filtros `pipelineId`, `stageId`, `status`, `personId`, `companyId`, `q`, `archived`. |
| `GET` · `PUT` · `DELETE /api/crm/leads/{id}` | Mover de etapa, marcar como visto, qualificar (`status: QUALIFIED` + `convertedOpportunityId`) e descartar passam pelo `PUT`. **WP3b:** `ownerId` é o responsável na equipe (`TeamMember.id`, exige `AUTH_API=1`): `PUT` sem `ownerId` mantém o atual, `""` limpa; quem só tem `leads:own` só enxerga/edita os próprios (404 nos demais) e não reatribui (403). `POST /api/public/leads` passa a criar lead aqui com `CRM_API=1`. |
| `GET` · `POST /api/crm/history` | Histórico de mudanças (ver abaixo). **Não existe `PUT` nem `DELETE`.** |

## Regras

- **CPF** é validado (dígitos verificadores) e guardado **cifrado** (AES-256-GCM, chave `DATA_KEY`), com um **hash** (HMAC) só para achar duplicado: CPF repetido dá **409**. Nas respostas ele vem **mascarado** (`•••.•••.•••-35`). No corpo: CPF completo grava; o valor mascarado devolvido pela API **não muda** nada (dá para reenviar o objeto inteiro no `PUT`); vazio apaga.
- **CNPJ** aceita letras e números (desde 31/07/2026), é validado e guardado só com letras e números em maiúsculas. Repetido dá **409**. **Sem CNPJ a empresa fica em análise** (`status: REVIEW`, calculado no servidor).
- **Lead** exige nome, ao menos um contato (e-mail ou telefone), funil, etapa, origem (`INBOUND` ou `OUTBOUND`) e uma **fonte ou quem trouxe** (`sourceName`), como em [dominio.md](./dominio.md) §4.
- Tudo o que o admin guarda e a tabela não tem coluna própria (`extraEmails`, `extraPhones`, `customData`) vai num JSON `extra`.
- `LEAD` é palavra reservada no MySQL 8 (função de janela): a tabela é sempre citada com crases. O teste de integração pegou isso.

## Histórico de mudanças (`ChangeLog`)

Quem, quando, em qual registro e o que mudou (antes e depois): a linha do tempo da ficha e a tela de Auditoria. Espelha `ChangeEntry` de `apps/admin/src/lib/history.ts` (tipos de registro `lead`, `person`, `company`, `opportunity`, `pipeline`; tipos de mudança `create`, `edit`, `archive`, `restore`, `reveal`, `lifecycle`, `event`, `qualify`, `discard`).

- **Só-acréscimo:** a API não tem rota para alterar nem apagar uma entrada (`PUT`, `PATCH` e `DELETE` dão 405). É garantido pela aplicação, não pelo banco (qualquer um com acesso ao banco ainda pode mexer na tabela).
- **`POST`** aceita uma entrada ou uma lista de até 100, valida **tudo antes de gravar** (lote com uma entrada inválida não grava nada) e é **idempotente**: o admin gera o id de cada entrada, então reenviar (retry) não duplica nem sobrescreve a original (`{"saved": n, "duplicates": m}`).
- **Quando:** vale a hora que o admin informa se for plausível (de 7 dias atrás a 1 minuto no futuro); fora disso, a hora do servidor.
- **`GET`:** filtros `entity`, `entityId`, `kind`, `q` (nome, autor, campo, nota), `since`, `until`, `limit` (máx. 500) e `offset`; mais recente primeiro; total em `X-Total-Count`.
- **IP de origem:** guardado (para a Auditoria), mas **nenhuma rota o devolve** até haver login. Endereço IP é dado pessoal (LGPD): defina o prazo de retenção antes de produção.
- **Quem:** é o nome que o admin informa. **Até existir login, não é confiável** (qualquer um que alcance a API pode escrever com qualquer nome). Limite de 240 envios por minuto por IP.
- **CPF** nunca entra no histórico: editar ou revelar o CPF registra só "CPF anterior/novo" e "CPF exibido inteiro", nunca o número.

No admin (`lib/historySync.ts`): com o CRM na API, as entradas novas vão ao servidor ~0,8 s depois; se a API estiver fora, ficam pendentes e são reenviadas sozinhas a cada 15 s (um aviso explica). A ficha carrega o histórico do registro quando abre, e a **Auditoria** (Configurações) passa a mostrar as 500 mais recentes, reais, em vez do exemplo. Sem o CRM na API, o histórico continua só na memória, como antes.

## Como o admin usa

`apps/admin/src/lib/crmSync.ts` faz com pessoas, empresas e leads o mesmo que `workflowSync.ts` faz com funis e tarefas: as telas seguem lendo e escrevendo as stores em memória (`peopleStore`, `companiesStore`, `leadsStore`), e a camada carrega do servidor na abertura e grava as mudanças ~0,6 s depois.

- **Modo `api` ou `local`:** o admin pergunta `GET /api/crm/people`. 200 → modo API (os avisos de "dados de exemplo" de Leads, Pessoas & Empresas e Clientes somem). 404 (`CRM_API` desligado) ou API fora → modo local, como antes.
- **Servidor vazio:** os exemplos que a tela já mostra são criados no servidor uma única vez (pessoas, depois empresas, depois leads). Sem `DATA_KEY` na API, os CPFs de exemplo ficam de fora e um aviso explica.
- **CPF:** a tela recebe e mostra o CPF **mascarado**. "Revelar" busca o completo (`GET .../document`) sem contar como edição. Editar qualquer outro campo reenvia o CPF inteiro e, depois de salvar, a tela volta a mostrar o mascarado (o CPF completo não fica na memória). **Limite:** a checagem de CPF repetido no navegador compara com CPFs mascarados, então não pega duplicado; quem barra é o servidor (409), e o admin avisa com a mensagem dele e volta ao que o servidor tem.
- **CNPJ:** o servidor guarda só letras e números; a tela o mostra formatado.
- **Recusas do servidor** (409/422): aviso na caixa de notificações com a mensagem do servidor e a tela volta ao estado dele. Outros erros: aviso de erro e as mudanças ficam na tela até a próxima tentativa.
- **Tarefas** de leads, pessoas e empresas passam a sincronizar também (`POST /api/tasks` aceita `requirementId` nas tarefas de requisito, de forma idempotente: o gate de lead roda no front).
- **Listas:** o admin baixa tudo (inclusive arquivados) em páginas de 500; por isso a API expõe `X-Total-Count` no CORS (`Access-Control-Expose-Headers`).

**Verificado em 05/10** com a API real (`CRM_API=1`, `WORKFLOW_API=1`, `DATA_KEY` de teste) sobre MySQL em memória e o admin no navegador: semeadura (14 pessoas, 8 empresas, 9 leads, 6 CPFs cifrados), reveal sem gravação, editar com o CPF revelado (um `PUT`, CPF preservado, volta mascarado), CPF duplicado (aviso + volta ao servidor), editar lead e empresa, tarefa de lead sincronizada e tudo persistindo depois de recarregar.

Os documentos fictícios que não fechavam os dígitos verificadores (CPF `905.112.660-79`; CNPJ `45.678.901/0001-23`, `98.765.432/0001-10`, `33.444.555/0001-66`) foram **trocados por valores válidos** em `apps/admin/src/mocks/people.ts`.

## Como testar

`go test .` roda os testes sem banco. `apps/api/crm_integration_test.go` roda o fluxo completo (linhas antigas sem as colunas novas, criação das colunas duas vezes, CPF cifrado e duplicado, CNPJ alfanumérico, stakeholders, filtros, paginação, arquivar e desarquivar, mover e qualificar lead) contra um MySQL **descartável**; só roda com `TEST_DSN` em localhost e **apaga e recria** `Contact`, `Company`, `CompanyStakeholder` e `Lead` (e as tabelas do workflow). Em 05/10 passou num servidor MySQL em memória, que **não é o MySQL de produção**: rode também num MySQL ou MariaDB real antes de ligar `CRM_API`.

## O que falta

1. ~~O admin sincronizar pessoas, empresas e leads~~: feito (ver acima). O histórico de mudanças também foi feito (ver acima). Faltam as tags de contato e os contatos por oportunidade, que ainda são locais.
2. Autenticação: estas rotas, e principalmente a que revela o CPF, estão abertas (CORS `*`) até a fase de segurança.
3. Deduplicação por e-mail e a lógica de ciclo de vida calculado (hoje o admin envia o `lifecycle`).
