# Kalidash — Documento de Arquitetura e Transparência

> **Referência:** SOLYD — nome de referência desta arquitetura (usado no contrato e no Anexo I)  
> **Versão:** 2.1 — atualizada em 01/10/2026 (a 2.0 é de 26/09/2026; a v1.0 está em `.archive/docs-v1/`)  
> **Status:** Em execução — admin/CRM e site público (Entrega 1)

---

## Escopo

**O que é:** o site institucional da Kalidash mais um `/admin`, um PWA de **uso interno**, com CRM, blog e um integrador de LPs e formulários que a própria Kalidash lança.

**O que não é:** SaaS, plataforma para terceiros ou sistema multi-tenant. Há **um único espaço de dados** e **vários usuários internos** com perfis (Admin, Gerente, Vendedor).

> **Nota histórica:** a v1.0 deste documento descrevia uma plataforma multi-tenant (contas, planos free/pro/enterprise, painel Master × Tenant, isolamento por cliente). Isso nunca foi o escopo e foi removido. A fonte de verdade do escopo são o `ADMIN-MOCK.md` do site v1.0 (`.archive/v1.0_site/docs/`) e os pedidos de 01/09/2026: integrador de formulários por token, aba Leads além de Clientes, "projetos conectados" e painel de chaves de API.

---

## Status por módulo (atualizado em 18/10/2026)

| Módulo | Onde | Status | Observação |
|---|---|---|---|
| CRM — Kanban e tabela | admin + api | **Parcial** | A UI cria oportunidades e move de coluna; a API também edita título e valor (e, quando enviadas, prioridade e tags; contato, empresa e responsável ainda não). O Kanban mostra as etapas do funil selecionado. A lista tem busca, filtro por estágio, paginação, colunas editáveis (inclusive campos de `customData`) e "Ver leads", rotulado "(exemplo)" enquanto o CRM não está na API. "Nova Oportunidade" avisa quando a API falha. `created_at` e `wonAt` vêm certos com ou sem `parseTime=true` no DSN (18/10). Login só com `AUTH_API=1`. |
| Ficha da oportunidade (painel lateral ou popup) | admin | **Parcial** | Painel lateral ou popup central, à escolha; só título e valor são editáveis e gravados (a tela diz que o resto é leitura); Visão Geral e notas funcionam. A aba **Tarefas** cria e conclui tarefas da oportunidade e sincroniza com a API (inclusive as tarefas de requisito que o gate cria); a aba E-mails ainda é placeholder. |
| Construtor de funil | admin | **Tela pronta, sem API** | Cria a pipeline a partir do template (etapas e requisitos iniciais) em estado local. |
| Editor de e-mail e templates | admin | **Parcial** | Editor visual com canvas, preview desktop/mobile e traduções funcionando no `vite dev` e no build. Templates em estado local e histórico de envio de exemplo. As regras de automação foram para a página Automações. **18/10:** o envio de teste usa `POST /api/emails/test`, que manda só para o e-mail de quem está logado (sem login ligado o botão fica desativado com aviso). |
| Envio de e-mail por oportunidade | api | **Parcial** | Via Resend (provisório). A meta é a Gmail API. `/api/emails/send` ainda aceita qualquer `opportunityId` (com `AUTH_API=1` exige sessão). |
| Leads, Pessoas & Empresas e Clientes | admin + api | **API pronta (desligada por padrão); admin já sincroniza quando ligada** | Páginas com dados de exemplo: fonte obrigatória no lead, CPF e CNPJ (inclusive alfanumérico) validados, deduplicação, empresa "em análise" sem CNPJ, stakeholders. Definição v2 em [dominio.md](./dominio.md). **05/10:** a API tem `/api/crm/people`, `/api/crm/companies` e `/api/crm/leads` (CPF cifrado, CNPJ alfanumérico validado, stakeholders, filtros e paginação), testadas sem banco e num MySQL descartável, **desligadas** (`CRM_API=1`); nada foi aplicado ao banco real. Ver [api-crm.md](./api-crm.md). **05/10:** com a API ligada, o admin carrega e grava pessoas, empresas e leads (`lib/crmSync.ts`), revela o CPF sob demanda e sincroniza as tarefas deles; sem ela, segue com os dados de exemplo. **Histórico de mudanças (05/10):** `ChangeLog` só-acréscimo na API (`/api/crm/history`), sincronizado pelo admin com reenvio automático; a Auditoria mostra o real. **Falta:** tags de contato e contatos por oportunidade na API. |
| Pipelines (funil por oferta), fontes e painel de configurações | admin + api | **Tela pronta, sem API** | Painel dedicado (engrenagem em Oportunidades): etapas, fontes com "Conectar fonte", tarefas, campos personalizados e tags. Hoje os funis existem só no código. |
| Tarefas, requisitos de etapa e campos personalizados | admin + api | **API pronta (desligada por padrão); admin já sincroniza quando ligada** | Galeria de funis e página do workflow (React Flow), com edição de requisitos e "seguir um registro". **05/10:** a API tem funis, etapas, requisitos, tarefas e o gate de etapa no servidor, testados sem banco e **desligados por padrão** (`WORKFLOW_API=1`); nada foi aplicado ao banco. Ver [api-workflow.md](./api-workflow.md). **06/10:** com a API ligada, o admin carrega e grava funis e tarefas de oportunidades (`lib/workflowSync.ts`) e trata o 409 do gate no `move`; sem ela, segue com os dados de exemplo. **Kanban pelas etapas do funil (06/10):** colunas, filtro, totais, Dashboard e ganho/perdido usam as etapas do funil, e o gate vale nelas; valores antigos de `stage` são traduzidos sem alterar o banco (`lib/stages.ts`). **Falta:** API para leads, pessoas e empresas e o Kanban mostrar vários funis de uma vez. |
| E-mails (templates) e Automações, em páginas separadas | admin + api | **Tela pronta, sem API** | E-mails (modelos e histórico) e Automações (catálogo, manuais e gerenciadas, execuções) são páginas próprias. |
| Entrada de leads (`connect.js`, API direta, webhook) | api | **Pronto (WP2, 18/10), atrás de `CRM_API=1` + `AUTH_API=1`** | `POST /api/connect/leads` e `GET /api/connect/config` (token `Authorization: Bearer` com `forms:write`) criam um **Lead v2** na pipeline do projeto (fonte e formulário do projeto, pessoa reaproveitada por e-mail, histórico `create`), com `Origin` validado por projeto, limite de taxa por IP e por chave e honeypot; `GET /connect.js` serve o snippet. Webhook de entrada continua planejado. `POST /api/public/leads` segue como está (cria oportunidade INBOUND) até o WP3. Ver [inbound-leads.md](./inbound-leads.md). |
| Projetos conectados, Integrações e Chaves | admin + api | **Pronto com a API ligada (WP2, 18/10); exemplo sem ela** | Com `CRM_API=1` e `AUTH_API=1`: `/api/projects` (+ `/forms`) grava projetos e formulários rastreados (só `keys:manage`: Admin/Gerente), chaves `kld_live_`/`kld_test_` do snippet ligadas a um projeto emitidas pelo mesmo painel de tokens do WP1.1. Sem as flags a tela segue em dados de exemplo, com o aviso. Métricas de visita/conversão (`analytics:write`) e `ads:read` são ganchos: ainda sem rota. [projects.md](./pagesAdmin/projects.md) |
| Login e perfis | api + admin | **Pronto, desligado por padrão (18/10)** | Atrás de `AUTH_API=1`: login com Google (OAuth, `state` anti-CSRF) só para e-mails da tabela `TeamMember`; sessão por cookie `HttpOnly` (token opaco, só o HMAC fica no banco); middleware que exige sessão em `/api/*` (exceções públicas: `POST /api/public/leads` e a leitura de artigos publicados e dos textos da galeria); perfis **Admin, Gerente e Vendedor** aplicados **no servidor** como **presets de escopos** (`auth_scopes.go`, 19 escopos; extras e removidos por pessoa; **tokens de API** `kld_live_` em `Authorization: Bearer`); CORS restrito a `ALLOWED_ORIGINS`; modo de desenvolvimento sem Google. Admin: tela de login, usuário real na barra lateral, Equipe gravando na API. **Falta ligar em produção** (criar o OAuth Client ID, primeira conta Admin; ver [auth-study.md](./auth-study.md#implementação-wp1-18102026)). Sem a flag a API segue aberta, como antes. |
| Blog / CMS | admin + api + site | **Parcial** | Sem Sanity — lista e editor ([BlockNote](https://www.blocknotejs.org/), trocou o Tiptap em 30/09) gravam artigo real via Go API/MySQL (`/api/blog/articles`); `bodyJson` (documento nativo do BlockNote) é a fonte de verdade, `body` (HTML) é gerado a cada save pro site consumir com ISR, publicado/rascunho, destaque e categorias. Upload de imagem implementado (`/api/blog/upload`, redimensiona e comprime antes de subir pro Cloudflare R2) — falta só configurar as credenciais reais do bucket no `.env` da API (passo a passo e verificação em [r2-setup.md](./r2-setup.md); **05/10:** a rota foi endurecida e testada com um S3 falso: tipo pelo conteúdo, sem SVG, orientação EXIF, PNG transparente preservado, GIF intacto, limite de megapixels e de envios por IP). **Atualizado em 01/10:** os cartões de artigo da Galeria Principal são editáveis (bloco do BlockNote; a ordem dos blocos é a ordem no site e o 1º é o destaque); o preview é o próprio site num iframe (`/preview/*`, com clique que foca o campo no editor); e salvar ou excluir um artigo avisa o site (`/api/revalidate`), que regenera em ~2 s em vez de até 60 s. O design do blog fica só no site (ver [blog-design-contrato.md](./blog-design-contrato.md)). **Falta:** sanitização do HTML e login (fase de segurança), `connect.js`. Handoffs: [30/09](./handoffs/2026-09-30-editor-blog-blocknote.md) e [01/10](./handoffs/2026-10-01-preview-home-contrato.md). |
| Dashboard e analytics | admin | **Parcial** | Métricas reais calculadas de `/api/leads` (valor em aberto e ganho, conversão, funil por etapa). Leads, tarefas e origem ainda não entram (WP3). **18/10:** a galeria de gráficos de demonstração (números inventados) saiu da página e mora em `#/dashboard/demonstracao`, com aviso; o Dashboard só mostra dado real. |
| Equipe e Configurações | admin + api | **Parcial** | Equipe, perfil, **permissões por escopo** (`scopesExtra`/`scopesDenied`) e **tokens de API** gravam na API (`/api/team`, `/api/tokens`) com `AUTH_API=1`; sem a flag seguem em dados de exemplo. Webhooks seguem sem API. A Auditoria mostra o histórico real quando o CRM está na API. |
| Webhooks de saída e auditoria | api | Planejado | A tela existe em Configurações; falta a API e o disparo em segundo plano. |
| Notificações (WebSocket, Web Push, PWA) | api + admin | **Parcial** | **Front pronto (05/10):** sino com a caixa de erros, avisos e notificações, toast e aba em Configurações com o aviso do navegador ([notificacoes.md](./notificacoes.md)); o histórico fica no navegador. **Tarefas (05/10):** avisos de tarefa de requisito criada (com "notificar" ligado) e de tarefa atrasada, e a automação "Notificar a equipe" gera notificação real. **Falta:** o servidor (WebSocket, Web Push com o painel fechado, e-mail), erros do backend e o evento "tarefa concluída". O admin ainda não é PWA completo. |
| Google Meet, Gmail e Drive | api | Planejado | |
| Site institucional | site | **Parcial** | **Home (LP)** refeita em 01/10 a partir de [Home.pdf](./Home.pdf) em `apps/site/src/app/home/` (design em `home.module.css`, textos em `content.ts`); conferida contra o PDF e pronta para aprovação; faltam só conteúdos da Carol (ver [pagesClient/home.md](./pagesClient/home.md)). **Blog** real (`/blog` e `/blog/[slug]`), `sitemap.xml` e `robots.txt`. O Motion do v1.0 segue arquivado como referência. A API já tem a captura pública `POST /api/public/leads` (02/10); falta ligar o formulário do diagnóstico definindo `NEXT_PUBLIC_LEAD_ENDPOINT` e `ALLOWED_ORIGINS`, e as demais páginas. A copy está no Google Doc "Copy site - MVP". |
| Valor das oportunidades | admin + api | **Parcial** | Cada oportunidade tem `value` e o Kanban soma o valor por coluna. **Atualizado em 05/10:** `value` agora é `DECIMAL(14,2)` (a API migra a coluna na subida e arredonda a centavos, recusando negativo), a API grava `wonAt` ao mover para Ganho, e o Dashboard tem **valor ganho e ticket médio por período** (mês, 30/90 dias, ano, tudo) e **previsão ponderada** (valor × probabilidade da etapa), com as contas em centavos em `apps/admin/src/lib/salesMetrics.ts` (testes: `npm test` no admin). **Falta:** ganho por etapa de pipeline antiga sem data (só entra em "Tudo"), previsão com probabilidade da etapa vinda da API (hoje das pipelines de exemplo) e um módulo Financeiro. Não há módulo Financeiro separado. |

**Tela pronta, sem API** significa que a interface existe e funciona com dados de exemplo em memória (`apps/admin/src/mocks`): nada é gravado e recarregar a página restaura o exemplo. Cada tela mostra um aviso disso e a fase do [plano de schema](./plano-schema.md#10-ordem-de-implementação) em que será ligada à API.

*Status base de 27/09/2026, conferido no navegador (dev e build) para as telas do admin. As linhas de Blog, Site e Login e perfis foram atualizadas em 01/10 e 18/10/2026; as de CRM, Ficha, E-mails e Dashboard na estabilização (WP-B) de 18/10/2026.*

---

## Visão Geral

Monorepo (pnpm + turbo) com três aplicações e um pacote de schema.

| Aplicação | Papel | Stack | Hospedagem |
|---|---|---|---|
| Site — `apps/site` | Público: SEO, blog, formulários | Next.js (SSR/ISR) | Vercel (plano Pro para uso comercial) |
| Admin — `apps/admin` | Interno: CRM, blog, integrações | Vite + React (SPA + PWA) | Vercel ou Cloudflare Pages (estático) |
| API — `apps/api` | Lógica, auth, ingestão de leads, webhooks | Go (`net/http`) | VPS Vultr ou DigitalOcean; a Kalidash escolhe **na hora de subir** |
| Banco | Persistência | MySQL | VPS (hoje no EasyPanel) |
| Schema — `apps/studio` | Fonte do schema e Prisma Studio | Prisma | — |

### Custo estimado (preços consultados em 26/09/2026)

| Item | Custo | Observação |
|---|---|---|
| VPS Vultr, São Paulo, 1 vCPU / 1GB | US$ 5/mês | Tem datacenter no Brasil. Fonte secundária: a página oficial bloqueou a consulta. O plano de 2GB precisa ser confirmado no site da Vultr. |
| VPS DigitalOcean, 1GB / 2GB | US$ 6 / US$ 12 por mês | Sem datacenter no Brasil (regiões: EUA, Europa, Ásia e Sydney). |
| EasyPanel (se for mantido na VPS nova) | — | A documentação do EasyPanel pede **no mínimo 2GB de RAM** na instalação. Com ele, o plano de 1GB não serve. |
| CDN do `connect.js` | **~US$ 0** | Ver abaixo. |
| Site e admin na Vercel | US$ 0 (Hobby) **não vale** | O plano Hobby é "personal, non-commercial use". Para uma empresa, o Pro custa US$ 20/mês por assento. |
| Admin no Cloudflare Pages | US$ 0 | Estático, uso comercial permitido, requisições estáticas ilimitadas. |

Ordem de grandeza: **US$ 5 a 12/mês** de VPS, mais **US$ 0 a 20/mês** de hospedagem do site e do admin.

**Custo do CDN do `connect.js`:** o arquivo tem ~5KB compactado, então 100 mil carregamentos por mês são ~0,5GB, e 1 milhão são ~5GB. Nesse volume o custo é praticamente zero em qualquer opção:
- Cloudflare Pages: requisições estáticas gratuitas e ilimitadas.
- Cloudflare R2 com domínio próprio: 10GB de storage, 1M de operações de escrita e 10M de leitura por mês grátis; saída de dados gratuita. Passando disso, US$ 0,36 por milhão de leituras.
- Vercel (arquivo em `public/` do site): 100GB/mês no Hobby e 1TB no Pro.
- Na própria VPS, atrás do Cloudflare (plano grátis): os planos de 1GB da Vultr e da DigitalOcean incluem cerca de 1TB de tráfego por mês.

O que importa é manter a **URL estável e versionada** (por exemplo `/v1/connect.js`), porque ela fica colada em páginas fora do repositório.

### Como o schema e a API se relacionam

- O **Prisma** (`apps/studio/prisma/schema.prisma`) é a fonte do schema.
- A **API em Go** lê e escreve com SQL cru (`database/sql`), usando os nomes de tabelas e colunas criados pelo Prisma (`Opportunity`, `createdAt`…).
- Consequência: mudou o schema no Prisma, é preciso atualizar as queries em `apps/api/main.go`. Ainda não há pasta de migrations versionadas.

---

## Stack Principal

### Site público (`apps/site`)

**Tecnologia:** Next.js com TypeScript (SSR/ISR). **Hospedagem:** Vercel.

O Google recebe um HTML vazio de um SPA. Com Next.js, o HTML já vai pronto com todo o conteúdo. A diferença de indexação é de **minutos vs semanas**. Para o blog, o ISR gera a página do post novo na primeira visita, sem build manual.

| Métrica | SPA (Vite) | SSR (Next.js) |
|---|---|---|
| Tempo para indexação no Google | Dias a semanas | Minutos |
| LCP | 2–4s | 0,5–1,2s |
| Preview em redes sociais (OG) | Caixa branca | Título + imagem + descrição |
| HTML entregue ao crawler | `<div id="root"></div>` | Conteúdo completo |

**Páginas previstas** (Google Doc "Copy site - MVP"): Home, Sobre nós, AI Culture, Advisory, Execução, Cases, Soluções e Blog.

### Painel Admin (`apps/admin`)

**Tecnologia:** Vite com React e TypeScript (SPA + PWA). **Hospedagem:** Vercel (estático), migrável para Cloudflare Pages ou Netlify.

O painel é 100% interativo (Kanban, gráficos, notificações em tempo real). SSR é peso morto aqui. O Vite gera arquivos estáticos que custam zero para hospedar, o HMR é instantâneo e o PWA é um plugin pronto (`vite-plugin-pwa`).

| Métrica | Next.js no Admin | Vite no Admin |
|---|---|---|
| Tempo de build | 30–60s | 2–4s |
| Bundle (runtime incluso) | ~85KB gzip | ~44KB gzip |
| Deploy | Precisa de servidor Node.js | Pasta `dist/` estática |
| PWA | Conflita com o Service Worker do Next | Plugin pronto |

**PWA (planejado):** instalável no celular e no desktop, notificações push ("Novo lead capturado"), cache offline da interface.

**Páginas do admin:**

| Página | Função | Ferramentas (open-source, previstas) |
|---|---|---|
| Dashboard | KPIs, volume de captação, funil por origem, valor do pipeline | Recharts, TanStack Query, date-fns |
| Leads e Clientes | Entrada de leads (vindos dos integradores ou do formulário interno) e carteira de clientes | TanStack Table |
| CRM (pipeline) | Kanban, tabela e ficha lateral da oportunidade | Drag-and-drop, React Hook Form |
| Projetos conectados | LPs e sites com o Connect instalado, com formulários rastreados e métricas de cada um | — |
| Integrações e Chaves | Emitir token, gerar snippet, mapear campos, escopos | Prism.js |
| Blog / CMS | Lista e editor (BlockNote) com SEO, publicado/rascunho, destaque e categorias — sem Sanity, grava no MySQL via Go API e o site consome com ISR | BlockNote |
| E-mails | Templates e automações | easy-email |
| Equipe e Configurações | Equipe e perfis, webhooks de saída, auditoria e notificações (status na tabela acima) | — |

### API (`apps/api`)

**Tecnologia:** Go, `net/http`. **Hospedagem:** VPS.

Uma VPS pequena com Go aguenta milhares de requisições por segundo, consome ~10MB de RAM parado, implanta como um único binário e dispara webhooks assíncronos com uma linha (`go disparar()`), sem fila externa.

| Métrica | Node.js (Express) | Go (`net/http`) |
|---|---|---|
| RAM (idle) | ~50–80MB | ~8–12MB |
| Throughput em VPS pequena | ~500 req/s | ~5.000–10.000 req/s |
| Deploy | Node + npm + PM2 | 1 binário |
| Webhooks assíncronos | Fila externa (Redis/BullMQ) | `go funcao()` nativo |

---

## Banco de Dados

### MySQL sem Redis

**Tecnologia:** MySQL 8+ (InnoDB), em VPS. **Acesso:** Go (SQL cru) e Prisma (schema e Studio), ambos pelo mesmo banco.

Redis resolve um problema que ainda não temos. O Go já é rápido o bastante para que 1ms (Redis) contra 3ms (MySQL direto) seja imperceptível. Adicionar Redis hoje traria invalidação de cache, mais RAM e mais um serviço para monitorar.

**Quando adicionar Redis:** quando uma query específica medir mais de 100ms e for chamada centenas de vezes por segundo, ou para filas de webhook, se as Goroutines não bastarem.

### Modelo de dados — implementado

Definido em `apps/studio/prisma/schema.prisma`:

| Tabela | Campos principais |
|---|---|
| `User` | `name`, `email` (único), `avatarUrl`, `role` (hoje `ADMIN` ou `MEMBER`) |
| `Company` | `name`, `logoUrl`, `website` |
| `Contact` | `name`, `email`, `phone`, `avatarUrl`, `companyId` (opcional) |
| `Opportunity` | `title`, `value`, `stage`, `priority`, `tags` (JSON), `companyId`, `contactId`, `ownerId` (todos opcionais) |
| `Note` | `content`, `type` (`NOTE`, `CALL`, `EMAIL`, `MEETING`, `TASK`), `opportunityId`, `authorId` |

**Etapas do funil hoje:** `Opportunity.stage`, em texto (`INBOUND`, `QUALIFICATION`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`), e os funis existem só no código. Na v2 viram `Pipeline` e `Stage` configuráveis (ver [plano-schema.md](./plano-schema.md)).

> **v2 (26/09/2026):** o modelo de Lead, Pipeline, Fonte, Stakeholder, Cliente, Tarefa e Automação está em [dominio.md](./dominio.md), e o desenho das tabelas em [plano-schema.md](./plano-schema.md). Isso **substitui** as linhas de `LeadSubmission` e de `Opportunity` da tabela abaixo. O lead deixa de ser a coluna INBOUND e passa a ser um registro próprio.

### Modelo de dados — proposto (ainda não existe)

| Tabela / campo | Para quê |
|---|---|
| `TeamMember` (`email`, `googleSub`, `role` = `ADMIN`, `MANAGER` ou `SELLER`, `extraScopes`, `deniedScopes`, `active`, `lastLoginAt`) | **Existe** (com `AUTH_API=1`): login com Google e perfis (ver `auth-study.md`). Não substitui `User`, que segue como dono de oportunidades do protótipo |
| `Project` (`name`, `url`, `stack`, `status`) | Projeto conectado: uma LP ou site com o Connect instalado |
| `ProjectForm` (`projectId`, `name`, `selector`, `fieldMap`) | Formulário rastreado dentro de um projeto |
| `ApiKey` (`projectId`, `name`, `prefix`, `keyHash`, `env`, `scopes`, `revokedAt`, `lastUsedAt`) | Chaves com escopo. O token completo aparece uma vez, no momento da emissão. |
| `LeadSubmission` (`sourceId`, `payload`, UTMs, `page_url`, `leadId`) | Guarda cada envio e liga ao **lead** criado ou atualizado (ver plano-schema.md) |
| `Opportunity` (ver plano-schema.md: `pipelineId`, `stageId`, `origin`, `value` em `Decimal(12,2)`, motivo, previsão, tempo na etapa) | Etapas configuráveis, origem e valores exatos nas somas (com `Float` a soma de centavos acumula erro) |
| `AuthSession` | **Existe** (com `AUTH_API=1`): sessões do login (HMAC do token, validade, IP) |
| `ApiToken` (`name`, `prefix`, `last4`, `tokenHash` SHA-256, `scopes`, `createdBy`, `expiresAt` opcional, `lastUsedAt`, `revokedAt`, `env`, `projectId`) | **Existe** (com `AUTH_API=1`; WP1.1 + WP2): tokens de API com escopos, sem validade por padrão; `env` = `live`/`test`; `projectId` só nas chaves do snippet |
| `ConnectedProject` e `TrackedForm` | **Existem** (WP2, com `CRM_API=1` + `AUTH_API=1`, `connect_projects.go`; também em `apps/studio/prisma/schema.prisma`): projeto = nome, URL, origens extras, funil + coluna de leads + fonte; formulário = seletor CSS, mapa de campos, consentimento, contagem de envios |
| `AuditLog` | Trilha de auditoria |
| `Post` | Blog (rascunho, publicado, slug, imagem de capa) |

O esquema completo e os campos definitivos serão fechados junto com a implementação. Isto é uma proposta.

---

## Segurança

### Camada 1 — Rede

```
  Internet                VPS
┌──────────┐        ┌──────────────────────────┐
│ Atacante │──✖──>  │  MySQL (porta 3306)      │
│          │        │  só aceita a API          │
└──────────┘        │                          │
                    │  Go API (porta 443) ◄────│── Única porta pública
                    └──────────────────────────┘
```

- O MySQL deve aceitar conexões **apenas da API** (bind local ou lista de IPs permitidos).
- Firewall bloqueando tudo, exceto 443 (HTTPS) e 22 (SSH com chave pública).

### Camada 2 — Acesso ao banco (mínimo privilégio)

| Usuário MySQL | Permissões | Usado por |
|---|---|---|
| `kalidash_api` | `SELECT, INSERT, UPDATE` (+ `DELETE` onde o negócio exigir) | API Go no dia a dia |
| `kalidash_migrate` | `ALL PRIVILEGES` | Apenas para mudanças de schema (Prisma) |
| `kalidash_readonly` | `SELECT` | Backup e relatórios |

### Camada 3 — Dados

| Dado | Tratamento | Motivo |
|---|---|---|
| Token de chave de API | Hash SHA-256; só o prefixo fica visível | Nunca guardar a chave em texto limpo |
| Telefone e campos extras do formulário | Criptografia AES-256-GCM (planejado; hoje `Contact.phone` está em texto) | Ilegível se alguém copiar o dump |
| E-mail | Texto limpo | Necessário para busca e deduplicação |

A chave de criptografia vive em variável de ambiente, nunca no código.

### Camada 4 — Aplicação (o Go como guardião)

| Ameaça | Proteção |
|---|---|
| SQL Injection | 100% prepared statements (já é assim no código atual) |
| Flood / bot | Rate limiter por IP na captação: 5 leads/min. Acima disso, `429`. |
| XSS armazenado | Sanitização com whitelist de tags antes de salvar |
| Spoofing de origem | Validação de `Origin` + rate limit + Turnstile (opcional) |
| Payload gigante | Limite de tamanho por request |
| CORS | Restrito aos domínios do admin e dos projetos conectados |

### Camada 5 — Autenticação do painel

Google OAuth, com **sessão opaca no servidor** em cookie `HttpOnly` (7 dias, revogável) no lugar do JWT + refresh token do desenho inicial: o perfil e a desativação valem na hora. Detalhes e divergências em [auth-study.md](./auth-study.md#implementação-wp1-18102026).

### Camada 6 — Backups (regra 3-2-1)

- **3** cópias dos dados (produção + 2 backups), em **2** mídias diferentes, com **1** cópia fora do provedor.
- `mysqldump` diário com `--single-transaction`, compactado e enviado por `rclone` para storage externo.
- **Teste de restauração mensal.** Backup que não é testado não é backup.

### Camada 7 — LGPD

| Exigência | Implementação |
|---|---|
| Direito de exclusão | Exclusão do lead com anonimização |
| Consentimento | O Connect só envia se o checkbox de consentimento estiver marcado (quando configurado) |
| Registro de tratamento | Tabela `AuditLog` |
| Minimização | Capturar apenas os campos mapeados no snippet |
| Portabilidade | Exportação em CSV/JSON |

### Pendências de segurança conhecidas (26/09/2026)

1. **API sem autenticação**, com CORS `*`. Qualquer cliente que alcance a API lê e altera oportunidades. **Resolvido no código em 18/10/2026 atrás de `AUTH_API=1`; segue aberto até ligar a flag em produção** (e `/api/emails/send` passa a exigir sessão).
2. **`/api/emails/send` aberto.** Usa a chave do Resend e aceita assunto e HTML arbitrários. (O teste do editor agora usa `/api/emails/test`, que só envia ao e-mail da sessão.)
3. **Sem `.gitignore` e sem repositório no monorepo.** `apps/api/.env` (com o DSN) e os `.exe` entrariam no primeiro commit.
4. **Banco acessado por host remoto na porta 3306.** Confirmar se há restrição por IP; caso contrário, o banco está exposto.

---

## CMS Proprietário (Blog)

**Editor:** Tiptap (MIT). O Sanity do site v1.0 foi descartado para eliminar dependência externa e custo.

```
Admin (PWA)                    API (Go)                     Site (Next.js)
    │                              │                             │
    ├─ Escreve no Tiptap           │                             │
    ├─ Upload de imagem ───────>   ├─ Comprime para WebP         │
    │                              ├─ Gera 3 tamanhos            │
    │                              ├─ Salva no storage           │
    ├─ Clica "Publicar" ───────>   ├─ Sanitiza HTML (whitelist)  │
    │                              ├─ Gera slug único            │
    │                              ├─ Salva no MySQL             │
    │                              ├─ Dispara revalidação ────>  ├─ ISR regenera a página
    │                              │                             ├─ Google indexa o HTML completo
```

---

## Ciclo de vida: lead, oportunidade e cliente

```
Fonte ─> LEAD (coluna de leads) ──qualificar──> OPORTUNIDADE (etapas abertas) ──> GANHA ──> CLIENTE
              │                                          │
              └─ descartar (com motivo)                  └─ PERDIDA (com motivo)
```

Cada pipeline (o funil de uma oferta) tem etapas dos tipos **Lead**, **Aberta**, **Ganha** e **Perdida**, configuráveis. Definição completa em [dominio.md](./dominio.md).

| Momento | Quem move | O que acontece |
|---|---|---|
| **Lead criado** | Automático (formulário conectado) ou manual/importação | Entra na primeira coluna de leads da pipeline. Notificação no painel. Só aparece no Kanban com **Ver leads**. |
| **Lead em contato** | Vendedor | Primeiro contato feito. Notas na ficha. |
| **Qualificar** | Vendedor (botão ou arrastar) | Cria a oportunidade na primeira etapa aberta e transfere notas, tarefas e e-mails. |
| **Etapas abertas** | Vendedor | Configuráveis por pipeline (ex.: Qualificação, Proposta, Negociação). |
| **Ganha** | Vendedor | Confirma o valor final. O **cliente** passa a ser a Empresa (ou a Pessoa, se não houver empresa). Pode disparar webhook de saída. |
| **Perdida** | Vendedor | Exige o motivo (lista configurável). |
| **Descartado** | Vendedor | Lead sem interesse, com motivo. Não conta como oportunidade perdida. |

**Regras de negócio**
- **Origem obrigatória:** todo lead tem uma **fonte** (inbound) ou um **contato interno** que o trouxe (outbound).
- **Atribuição:** o lead entra sem dono e qualquer vendedor pode pegar para si. Com round-robin ligado pelo gerente, o próximo da fila recebe (`ownerId`).
- **SLA de primeiro contato:** timer no card ("2h sem resposta"), configurável.
- **Deduplicação:** o mesmo e-mail, CPF ou CNPJ não cria pessoa ou empresa novas. Se já há lead aberto naquela pipeline, o envio é anexado a ele e ele volta ao topo da coluna.
- **Visibilidade:** Admin e Gerente veem tudo; o Vendedor vê só o que está atribuído a ele.

**Valor das oportunidades** (como nos CRMs de mercado; não há módulo Financeiro separado)
- Cada oportunidade tem um **valor em R$**, informado na criação e editável em qualquer etapa. Ao ganhar, confirma-se o valor final.
- O Kanban mostra **quantidade e valor por coluna**; os **leads ficam fora** dos totais. A lista permite ordenar e filtrar por valor.
- O dashboard consolida: **valor em pipeline** (oportunidades abertas, por etapa e total), **valor ganho no período**, **valor perdido**, **ticket médio** e, opcionalmente, **previsão ponderada** (valor × probabilidade da etapa).
- O valor segue a visibilidade do CRM: quem vê a oportunidade vê o valor dela (padrão a confirmar).

---

## Inbound (pipeline de captação)

Como os leads chegam das LPs e dos formulários que a Kalidash lança.

```
   Visitante em uma LP ou site da Kalidash
          │
          ├─ 1. A página carrega connect.js (tag de script com o token)
          ├─ 2. O Connect observa o formulário existente (seletor da config)
          ├─ 3. Visitante preenche e envia
          │
          ▼
   connect.js intercepta o submit
          │
          ├─ 4. Lê os campos mapeados (nome, e-mail, telefone, empresa, cargo, interesse, mensagem)
          ├─ 5. Coleta atribuição: UTMs, referrer, device, page_url
          ├─ 6. Só envia se o consentimento estiver marcado (quando configurado)
          ├─ 7. POST para a API com o token do projeto
          │
          ▼
   API Go
          │
          ├─ 8.  Rate limit por IP
          ├─ 9.  Token → SHA-256 → busca a chave; existe, não está revogada, tem o escopo forms:write?
          ├─ 10. Origin bate com o domínio do projeto conectado?
          ├─ 11. Valida e sanitiza os campos
          ├─ 12. Cria ou atualiza Pessoa e Empresa (dedupe por e-mail, CPF e CNPJ) e cria o **Lead** na pipeline da fonte
          ├─ 13. Grava a LeadSubmission (payload, atribuição, fonte) e aplica os requisitos de etapa da pipeline
          │
          ├─ 14. Em paralelo (Goroutines): WebSocket para o painel, Web Push, webhooks de saída
          │
          └─ 15. Retorna 201 ao connect.js
```

**Métricas do dashboard**

| Métrica | Cálculo | Visualização |
|---|---|---|
| Leads no período | Contagem de **leads** criados, com filtro por pipeline, fonte e projeto conectado | Card |
| Leads hoje | Criados hoje, com variação vs. ontem | Card |
| Taxa lead → oportunidade | Leads convertidos ÷ leads criados | Rosca |
| Taxa de ganho | Oportunidades ganhas ÷ oportunidades encerradas | Rosca |
| Leads por origem | Agrupado por `utm_source` e projeto | Barras |
| Leads por página | Agrupado por `page_url` | Tabela |
| Tempo até o primeiro contato | Criação do lead até o primeiro contato | Indicador |
| Volume diário | Últimos 30 dias | Linha |
| Valor em pipeline | Soma de `value` das oportunidades abertas, por etapa e total | Card + barras por etapa |
| Valor ganho no período | Soma de `value` das oportunidades `WON` no período | Card |
| Ticket médio | Valor ganho ÷ nº de oportunidades `WON` | Indicador |
| Previsão ponderada (opcional) | Soma de `value` × probabilidade de cada etapa | Indicador |

---

## Connect.js (o script de captura)

Um script leve que se cola na LP. **Ele não renderiza nem estiliza formulário**: o markup e o CSS são da página. Ele lê os inputs que já existem, segundo um mapa declarado na config, e envia **sempre o mesmo JSON**.

> **Implementado no WP2 (18/10/2026)** — o que vale é esta seção; o desenho do v1.0 (config JSON na página, `data-token`) foi trocado por uma config guardada no servidor.

### Snippet

```html
<script src="https://API/connect.js" data-key="kld_live_…" defer></script>
```

O script é **servido pela própria API** (`GET /connect.js`, `connect_script.js` embutido no binário), então não há CDN a escolher; a URL pode ganhar versão (`/v1/connect.js`) quando a página sair do repositório. Só carrega uma **chave publicável**. Quais formulários observar (seletor CSS, mapa de campos, caixa de consentimento) vem do painel, por `GET /api/connect/config`. No evento `submit` (captura no documento, vale para formulários criados depois) ele lê os campos (pelo mapa ou, se vazio, por `name`/`id`/`type`: nome, e-mail, telefone…), junta a atribuição e faz `POST /api/connect/leads` em segundo plano, **sem impedir o envio normal** da página. A página pode ouvir `window` `kalidash:lead` (`{ok, status, form}`).

### Entrada: `POST /api/connect/leads`

`Authorization: Bearer kld_(live|test)_…` (também serve para chamada direta de servidor, sem `Origin`).

```json
{
  "form": "#form-contato",
  "website": "",
  "lead": { "nome": "…", "email": "…", "telefone": null, "empresa": "…", "cargo": null, "interesse": "…", "mensagem": null },
  "attribution": { "utm_source": "…", "utm_medium": "…", "utm_campaign": "…", "referrer": "…", "device": "…", "page_url": "…" },
  "context": { "submittedAt": "…", "consent": true }
}
```

Resposta `201 {"ok":true,"id":"l-…"}`. Cria um **Lead v2** (`INBOUND`) na pipeline e coluna do projeto, `sourceName` = fonte do projeto, pessoa reaproveitada por e-mail (nova com ciclo `LEAD` se não existe; "cliente retornando" se já é cliente), tags `Inbound`, nome do projeto, nome do formulário e `Teste` (chave `kld_test_`), `customData` com `projectId`, `formId`, `via` (`connect.js`/`api`), `env`, empresa/cargo/interesse e a atribuição (só chaves conhecidas), uma linha `create` no histórico e o contador de envios do projeto e do formulário. **Não cria Oportunidade.** Obrigatório: nome e ao menos um contato.

Ordem das barreiras: limite por IP (`CONNECT_RATE_IP`, 10/min; conta toda tentativa, inclusive as recusadas) → chave (401) → escopo `forms:write` e só escopos publicáveis (403) → projeto ativo e `Origin` ∈ origens do projeto (403) → limite por chave (`CONNECT_RATE_TOKEN`, 60/min) → corpo ≤ 16 KB → honeypot (`website` preenchido: `201` sem gravar) → validação (422).

### Chaves e escopos

Formato: `kld_live_<32 caracteres>` ou `kld_test_<32 caracteres>` (192 bits aleatórios em base64url). Depois da emissão, só o prefixo e os 4 últimos caracteres ficam visíveis; no banco só o SHA-256.

| Escopo | Para quê | Pode ir no HTML? |
|---|---|---|
| `forms:write` | Criar leads a partir do Connect (o mínimo do snippet) | Sim |
| `analytics:write` | Pageview, sessão e origem (**gancho**: ainda sem rota) | Sim |
| `ads:read` | Sincronizar custo e CPL de mídia paga (**gancho**) | Não |
| `leads:read` | Consultar a base pelo servidor | **Nunca** |

Regra aplicada no servidor (`validateTokenScopes`): escopo publicável **fica sozinho** no token, que vai ligado a um projeto (`projectId`); leitura nunca acompanha a chave do HTML (422 na criação, 403 na entrada se o banco for adulterado). Só Admin/Gerente emitem (`keys:manage`).

### Segurança do Connect

| Ameaça | Proteção |
|---|---|
| Chave visível no HTML | É uma chave publicável, só com `forms:write` (e `analytics:write`): não lê, não altera e não deleta; o servidor não emite uma chave que misture leitura |
| Spoofing de origem | Validação de `Origin` por projeto + rate limit por IP e por chave (quem forja o `Origin` com `curl` continua limitado e só consegue criar leads, marcados com o `tokenId`) |
| Flood de requisições falsas | 10 tentativas/min por IP e 60 envios/min por chave. Acima disso, `429` com `Retry-After`. (`/api/public/leads`: 5/min por IP.) |
| Bot / spam | Cloudflare Turnstile (opcional) |
| Interceptação | HTTPS (TLS 1.3) |

---

## Princípio Kalidash

```
┌─────────────────────────────────────────────────────────┐
│                    PRINCÍPIO KALIDASH                    │
│                                                         │
│   "Cada peça no sistema precisa justificar sua          │
│    existência. Se ela não resolve um problema            │
│    que já existe, ela É o problema."                     │
│                                                         │
│   ✅ Vite Admin  → Leve, rápido, sem servidor           │
│   ✅ Next.js Site → SEO obrigatório, ISR nativo         │
│   ✅ Go API      → 10x menos RAM, 10x mais throughput   │
│   ✅ MySQL puro  → Simples, confiável, barato           │
│   ❌ Redis       → Problema que ainda não temos         │
│   ❌ Sanity      → Dependência que não precisamos       │
│   ❌ Multi-tenant → Não é o escopo                      │
└─────────────────────────────────────────────────────────┘
```

---

## Decisões em aberto

1. **E-mail:** a meta é a Gmail API (o e-mail sai da caixa do vendedor). O Resend com `onboarding@resend.dev` no código é provisório.
2. **VPS:** Vultr (São Paulo) ou DigitalOcean, conforme a preferência da Kalidash. Se mantiver o EasyPanel, o plano precisa ter pelo menos 2GB de RAM. A DigitalOcean não tem datacenter no Brasil.
3. **Hospedagem do site e do admin:** o plano Hobby da Vercel é só para uso pessoal e não comercial. Escolher entre Vercel Pro (US$ 20/mês por assento) e Cloudflare Pages para o admin estático (US$ 0).
4. **Domínio público da API** (o `connect.js` é servido por ela; as páginas apontam para esse endereço). Pôr um CDN na frente é opcional e custa ~US$ 0.
5. **Editor de e-mail:** agora tem página própria (E-mails), separada de Automações. Falta persistir os templates.
6. **Domínio do CRM:** os pontos abertos estão na seção 13 de [dominio.md](./dominio.md).
