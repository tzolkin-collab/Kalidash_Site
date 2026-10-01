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

## Status por módulo (27/09/2026)

| Módulo | Onde | Status | Observação |
|---|---|---|---|
| CRM — Kanban e tabela | admin + api | **Parcial** | A UI cria oportunidades e move de coluna; a API também edita título e valor. O Kanban mostra 3 colunas (INBOUND, QUALIFICATION, WON). A lista tem busca, filtro por estágio, paginação, colunas editáveis (inclusive campos de `customData`) e "Ver leads" (leads de exemplo). Sem login. |
| Ficha da oportunidade (painel lateral ou popup) | admin | **Parcial** | Painel lateral ou popup central, à escolha; edição de título e valor corrigida; Visão Geral e notas funcionam. As abas Tarefas e E-mails são placeholders. |
| Construtor de funil | admin | **Tela pronta, sem API** | Cria a pipeline a partir do template (etapas e requisitos iniciais) em estado local. |
| Editor de e-mail e templates | admin | **Parcial** | Editor visual com canvas, preview desktop/mobile e traduções funcionando no `vite dev` e no build. Templates em estado local e histórico de envio de exemplo. As regras de automação foram para a página Automações. O envio de teste usa um contrato incompatível com a API. |
| Envio de e-mail por oportunidade | api | **Parcial** | Via Resend (provisório). A meta é a Gmail API. |
| Leads, Pessoas & Empresas e Clientes | admin + api | **Tela pronta, sem API** | Páginas com dados de exemplo: fonte obrigatória no lead, CPF e CNPJ (inclusive alfanumérico) validados, deduplicação, empresa "em análise" sem CNPJ, stakeholders. Definição v2 em [dominio.md](./dominio.md). |
| Pipelines (funil por oferta), fontes e painel de configurações | admin + api | **Tela pronta, sem API** | Painel dedicado (engrenagem em Oportunidades): etapas, fontes com "Conectar fonte", tarefas, campos personalizados e tags. Hoje os funis existem só no código. |
| Tarefas, requisitos de etapa e campos personalizados | admin + api | **Tela pronta, sem API** | Galeria de funis e página do workflow (React Flow), com edição de requisitos e "seguir um registro". |
| E-mails (templates) e Automações, em páginas separadas | admin + api | **Tela pronta, sem API** | E-mails (modelos e histórico) e Automações (catálogo, manuais e gerenciadas, execuções) são páginas próprias. |
| Entrada de leads (`connect.js`, API direta, webhook) | api | Planejado | Contrato já desenhado no v1.0 (`connect.ts`). |
| Projetos conectados, Integrações e Chaves | admin + api | **Tela pronta, sem API** | Projetos com métricas, snippet e página de exemplo, emissão e revogação de chaves (o token de exemplo não existe no servidor). |
| Login e perfis | api + admin | Planejado | Google OAuth do Workspace. Perfis **Admin, Gerente e Vendedor**, com painel de permissões (decidido em 01/10/2026 e incluído no contrato, para entrega até a Entrega 4). Hoje a API está aberta. |
| Blog / CMS | admin + api + site | **Parcial** | Sem Sanity — lista e editor ([BlockNote](https://www.blocknotejs.org/), trocou o Tiptap em 30/09) gravam artigo real via Go API/MySQL (`/api/blog/articles`); `bodyJson` (documento nativo do BlockNote) é a fonte de verdade, `body` (HTML) é gerado a cada save pro site consumir com ISR, publicado/rascunho, destaque e categorias. Upload de imagem implementado (`/api/blog/upload`, redimensiona e comprime antes de subir pro Cloudflare R2) — falta só configurar as credenciais reais do bucket no `.env` da API. **Atualizado em 01/10:** os cartões de artigo da Galeria Principal são editáveis (bloco do BlockNote; a ordem dos blocos é a ordem no site e o 1º é o destaque); o preview é o próprio site num iframe (`/preview/*`, com clique que foca o campo no editor); e salvar ou excluir um artigo avisa o site (`/api/revalidate`), que regenera em ~2 s em vez de até 60 s. O design do blog fica só no site (ver [blog-design-contrato.md](./blog-design-contrato.md)). **Falta:** sanitização do HTML e login (fase de segurança), `connect.js`. Handoffs: [30/09](./handoffs/2026-09-30-editor-blog-blocknote.md) e [01/10](./handoffs/2026-10-01-preview-home-contrato.md). |
| Dashboard e analytics | admin | **Parcial** | Métricas reais calculadas de `/api/leads` (valor em aberto e ganho, conversão, funil por etapa). Leads, tarefas e origem entram com as fases 3 e 4. |
| Equipe e Configurações | admin + api | **Tela pronta, sem API** | Página com perfil, equipe e perfis (Admin, Gerente, Vendedor), webhooks e auditoria, em dados de exemplo. |
| Webhooks de saída e auditoria | api | Planejado | A tela existe em Configurações; falta a API e o disparo em segundo plano. |
| Notificações (WebSocket, Web Push, PWA) | api + admin | Planejado | O admin ainda não é PWA. |
| Google Meet, Gmail e Drive | api | Planejado | |
| Site institucional | site | **Parcial** | **Home (LP)** refeita em 01/10 a partir de [Home.pdf](./Home.pdf) em `apps/site/src/app/home/` (design em `home.module.css`, textos em `content.ts`); conferida contra o PDF e pronta para aprovação; faltam só conteúdos da Carol (ver [pagesClient/home.md](./pagesClient/home.md)). **Blog** real (`/blog` e `/blog/[slug]`), `sitemap.xml` e `robots.txt`. O Motion do v1.0 segue arquivado como referência. Faltam a ligação do formulário do diagnóstico (ainda não há rota pública de captura de lead na API) e as demais páginas. A copy está no Google Doc "Copy site - MVP". |
| Valor das oportunidades | admin + api | **Parcial** | Cada oportunidade tem `value` e o Kanban soma o valor por coluna. Faltam valor ganho por período, ticket médio, previsão ponderada e o campo em `Decimal`. Não há módulo Financeiro separado. |

**Tela pronta, sem API** significa que a interface existe e funciona com dados de exemplo em memória (`apps/admin/src/mocks`): nada é gravado e recarregar a página restaura o exemplo. Cada tela mostra um aviso disso e a fase do [plano de schema](./plano-schema.md#10-ordem-de-implementação) em que será ligada à API.

*Status de 27/09/2026, conferido no navegador (dev e build) para as telas do admin. A API e o banco não mudaram. As linhas de Blog, Site e Login e perfis foram atualizadas em 01/10/2026.*

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
| Equipe e Configurações | admin + api | **Tela pronta, sem API** | Página com perfil, equipe e perfis (Admin, Gerente, Vendedor), webhooks e auditoria, em dados de exemplo. |

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
| `User` + `googleSub`, `isActive`, `lastLoginAt`; `role` = `ADMIN`, `MANAGER` ou `SELLER` | Login com Google e perfis (ver `auth-study.md`) |
| `Project` (`name`, `url`, `stack`, `status`) | Projeto conectado: uma LP ou site com o Connect instalado |
| `ProjectForm` (`projectId`, `name`, `selector`, `fieldMap`) | Formulário rastreado dentro de um projeto |
| `ApiKey` (`projectId`, `name`, `prefix`, `keyHash`, `env`, `scopes`, `revokedAt`, `lastUsedAt`) | Chaves com escopo. O token completo aparece uma vez, no momento da emissão. |
| `LeadSubmission` (`sourceId`, `payload`, UTMs, `page_url`, `leadId`) | Guarda cada envio e liga ao **lead** criado ou atualizado (ver plano-schema.md) |
| `Opportunity` (ver plano-schema.md: `pipelineId`, `stageId`, `origin`, `value` em `Decimal(12,2)`, motivo, previsão, tempo na etapa) | Etapas configuráveis, origem e valores exatos nas somas (com `Float` a soma de centavos acumula erro) |
| `Session` | Refresh tokens do login |
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

Google OAuth do Workspace, com JWT de curta duração (15 min) e refresh token em cookie `httpOnly`. Detalhes em [auth-study.md](./auth-study.md).

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

1. **API sem autenticação**, com CORS `*`. Qualquer cliente que alcance a API lê e altera oportunidades.
2. **`/api/emails/send` aberto.** Usa a chave do Resend e aceita assunto e HTML arbitrários.
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

### Snippet

```html
<!-- Kalidash Connect -->
<script
  src="https://cdn.kalidash.com.br/connect.js"
  data-token="kld_live_…"
  defer
></script>
<script type="application/json" data-kalidash-config>
{
  "form": "#form-contato",
  "map": { "nome": "#nome", "email": "#email", "empresa": "#empresa", "interesse": "#interesse" },
  "attribution": true,
  "consent": "#aceite"
}
</script>
```

O domínio do CDN é o do código v1.0 (`cdn.kalidash.com.br`) e deve ser confirmado.

### Contrato do payload (sempre os mesmos campos)

```json
{
  "token": "kld_live_…",
  "form": "#form-contato",
  "lead": {
    "nome": "…", "email": "…", "telefone": null, "empresa": "…",
    "cargo": null, "interesse": "…", "mensagem": null
  },
  "attribution": { "utm_source": "…", "utm_medium": "…", "utm_campaign": "…", "referrer": "…", "device": "…", "page_url": "…" },
  "context": { "submittedAt": "…", "consent": true }
}
```

Campos ausentes viram `null`. Campos fora do mapa viajam como extras.

### Chaves e escopos

Formato: `kld_live_<32 hex>` ou `kld_test_<32 hex>`. Depois da emissão, só o prefixo (18 caracteres) fica visível.

| Escopo | Para quê | Pode ir no HTML? |
|---|---|---|
| `forms:write` | Criar leads a partir do Connect (o mínimo do snippet) | Sim |
| `analytics:write` | Pageview, sessão e origem | Sim |
| `ads:read` | Sincronizar custo e CPL de mídia paga | Não |
| `leads:read` | Consultar a base pelo servidor | **Nunca** |

### Segurança do Connect

| Ameaça | Proteção |
|---|---|
| Chave visível no HTML | É uma chave pública, só com `forms:write` e `analytics:write`: não lê, não altera e não deleta |
| Spoofing de origem | Validação de `Origin` + rate limit por IP |
| Flood de requisições falsas | 5 leads/min por IP. Acima disso, `429`. |
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
4. **Domínio do CDN do Connect** (`cdn.kalidash.com.br` no código v1.0) e onde o arquivo fica hospedado. O custo é ~US$ 0 em qualquer opção.
5. **Editor de e-mail:** agora tem página própria (E-mails), separada de Automações. Falta persistir os templates.
6. **Domínio do CRM:** os pontos abertos estão na seção 13 de [dominio.md](./dominio.md).
