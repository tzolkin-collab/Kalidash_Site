# 👥 API de pessoas, empresas e leads

> **Status (05/10/2026):** API e esquema prontos e testados (sem banco e num MySQL em memória); **desligados por padrão** e **nunca aplicados ao banco real**. As telas ainda usam os dados de exemplo (`apps/admin/src/mocks`). Recorte do [plano-schema.md](./plano-schema.md) §3 e §4, com o JSON igual aos tipos `Person`, `Company` e `Lead` de `apps/admin/src/domain.ts`.

## Como ligar

Variáveis da API: `CRM_API=1` e `DATA_KEY` (ver `apps/api/.env.example`). Na subida a API:

- acrescenta colunas às tabelas **`Contact`** (pessoa) e **`Company`**, que já existem: só `ADD COLUMN` e índice único, nada é alterado nem apagado, e as linhas antigas continuam valendo (ficam com ciclo de vida `LEAD` e sem data de criação);
- cria **`CompanyStakeholder`** e **`Lead`**.

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
| `GET` · `PUT` · `DELETE /api/crm/leads/{id}` | Mover de etapa, marcar como visto, qualificar (`status: QUALIFIED` + `convertedOpportunityId`) e descartar passam pelo `PUT`. |

## Regras

- **CPF** é validado (dígitos verificadores) e guardado **cifrado** (AES-256-GCM, chave `DATA_KEY`), com um **hash** (HMAC) só para achar duplicado: CPF repetido dá **409**. Nas respostas ele vem **mascarado** (`•••.•••.•••-35`). No corpo: CPF completo grava; o valor mascarado devolvido pela API **não muda** nada (dá para reenviar o objeto inteiro no `PUT`); vazio apaga.
- **CNPJ** aceita letras e números (desde 31/07/2026), é validado e guardado só com letras e números em maiúsculas. Repetido dá **409**. **Sem CNPJ a empresa fica em análise** (`status: REVIEW`, calculado no servidor).
- **Lead** exige nome, ao menos um contato (e-mail ou telefone), funil, etapa, origem (`INBOUND` ou `OUTBOUND`) e uma **fonte ou quem trouxe** (`sourceName`), como em [dominio.md](./dominio.md) §4.
- Tudo o que o admin guarda e a tabela não tem coluna própria (`extraEmails`, `extraPhones`, `customData`) vai num JSON `extra`.
- `LEAD` é palavra reservada no MySQL 8 (função de janela): a tabela é sempre citada com crases. O teste de integração pegou isso.

## Atenção para a ligação com o admin

Vários documentos fictícios dos dados de exemplo **não fecham os dígitos verificadores** (por exemplo o CPF `905.112.660-79` e os CNPJ `45.678.901/0001-23`, `98.765.432/0001-10` e `33.444.555/0001-66`; o próprio validador do admin os recusa). Ao semear o servidor com os exemplos, a API vai recusá-los (422): é preciso corrigir os exemplos ou semear sem esses documentos.

## Como testar

`go test .` roda os testes sem banco. `apps/api/crm_integration_test.go` roda o fluxo completo (linhas antigas sem as colunas novas, criação das colunas duas vezes, CPF cifrado e duplicado, CNPJ alfanumérico, stakeholders, filtros, paginação, arquivar e desarquivar, mover e qualificar lead) contra um MySQL **descartável**; só roda com `TEST_DSN` em localhost e **apaga e recria** `Contact`, `Company`, `CompanyStakeholder` e `Lead` (e as tabelas do workflow). Em 05/10 passou num servidor MySQL em memória, que **não é o MySQL de produção**: rode também num MySQL ou MariaDB real antes de ligar `CRM_API`.

## O que falta

1. O admin trocar `peopleStore`, `companiesStore` e `leadsStore` por estas rotas (como foi feito com funis e tarefas) e passar a sincronizar as tarefas de leads, pessoas e empresas.
2. Autenticação: estas rotas, e principalmente a que revela o CPF, estão abertas (CORS `*`) até a fase de segurança.
3. Deduplicação por e-mail e a lógica de ciclo de vida calculado (hoje o admin envia o `lifecycle`).
