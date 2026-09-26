# Kalidash — Documento de Arquitetura e Transparência

> **Referência:** SOLYD  
> **Versão:** 1.0  
> **Última atualização:** 25/09/2026  
> **Status:** Em planejamento

---

## Visão Geral

Sistema modular e produto com qualidade de vida.  
Arquitetura: **Monorepo** com 3 aplicações independentes e banco centralizado.

| Aplicação | Papel | Stack | Hospedagem | Custo |
|---|---|---|---|---|
| LP1 — Cliente | Site público (SEO, Blog, Captação) | Next.js (SSR/ISR) | Vercel | $0/mês |
| LP2 — Admin | Painel operacional (CRM, Dashboard) | Vite (SPA + PWA) | Vercel | $0/mês |
| Backend — Master | API central (Lógica, Auth, Webhooks) | Go (HTTP Server) | Vultr SP | $5/mês |
| Banco de Dados | Persistência centralizada | MySQL (self-hosted) | Vultr SP (mesma VPS) | $0 extra |
| **Total** | | | | **$5/mês (~R$29)** |

---

## Stack Principal

### LP1 — Site Público (`apps/site`)

**Tecnologia:** Next.js com TypeScript (SSR/ISR)  
**Hospedagem:** Vercel (Free Tier)

**Por que Next.js e não Vite aqui?**

O Google recebe um HTML vazio de um SPA. Com Next.js, o HTML já vai pronto
com todo o conteúdo. A diferença de indexação é de **minutos vs semanas**.
Para o blog, o ISR (Incremental Static Regeneration) gera a página do post
novo automaticamente na primeira visita, sem precisar rodar build manual.

| Métrica | SPA (Vite) | SSR (Next.js) |
|---|---|---|
| Tempo para indexação no Google | Dias a semanas | Minutos |
| LCP (Largest Contentful Paint) | 2-4s | 0.5-1.2s |
| Preview em redes sociais (OG) | Caixa branca | Título + imagem + descrição |
| HTML entregue ao crawler | `<div id="root"></div>` | Conteúdo completo |

**Páginas:**
- Home / Landing Page de captação
- Blog institucional (conteúdo via CMS proprietário + ISR)

---

### LP2 — Painel Admin (`apps/admin`)

**Tecnologia:** Vite com React e TypeScript (SPA + PWA)  
**Hospedagem:** Vercel (Free Tier) — migrável para Cloudflare Pages ou Netlify

**Por que Vite e não Next.js aqui?**

O painel é 100% interativo (Kanban, gráficos, WebSockets). SSR é peso morto
aqui. O Vite compila em **2 segundos**, gera arquivos estáticos que custam
**zero** para hospedar, e o HMR durante o desenvolvimento reflete mudanças
em **<50ms**. A própria Supabase, Railway e PlanetScale fazem os painéis
deles assim.

| Métrica | Next.js no Admin | Vite no Admin |
|---|---|---|
| Tempo de build | 30-60s | 2-4s |
| Bundle (runtime incluso) | ~85KB gzip | ~44KB gzip |
| HMR (Hot Module Replacement) | 1-3s | <50ms |
| Complexidade | Server vs Client Components | Tudo é client-side |
| PWA nativo | Conflita com Service Worker do Next | Plugin pronto (`vite-plugin-pwa`) |
| Deploy | Precisa de servidor Node.js | Pasta `dist/` estática, qualquer CDN |

**PWA — O diferencial:**
- Instalável como aplicativo no celular/desktop (sem App Store)
- Notificações push reais (ex: "🚀 Novo Lead Capturado!")
- Cache offline da interface (abre instantaneamente mesmo com internet lenta)

**Páginas do Admin:**

| Página | Função | Ferramentas (todas $0, MIT) |
|---|---|---|
| Dashboard & Analytics | KPIs, gráficos, volume de captação | Recharts, TanStack Query, date-fns |
| CRM (Leads & Pipelines) | Kanban drag-and-drop, tabela paginada, ficha do lead | dnd-kit, TanStack Table + Virtual, React Hook Form |
| Projetos & API Keys | Cadastro de sites, geração de tokens, construtor de snippets | crypto (Go), go-jwt, Prism.js, nanoid |
| Blog / CMS | Editor WYSIWYG, upload de imagens, publicação | Tiptap (MIT, $0), slugify |
| Configurações | Webhooks, logs de auditoria, gestão de equipe, 2FA | bcrypt, TOTP (pquerna/otp), Goroutines |
| Financeiro | Receita, alertas de vencimento, export CSV | Recharts, Papa Parse, Dinero.js |

---

### Backend — Master (`apps/api`)

**Tecnologia:** Go (Golang) HTTP Server  
**Hospedagem:** Vultr São Paulo — $5/mês (1 vCPU, 1GB RAM, 25GB NVMe)  
**Latência:** ~5-15ms de qualquer ponto do Brasil

**Por que Go e não Node.js/Python/Java?**

Uma VPS de **$5** com Go aguenta 5.000-10.000 req/s. A mesma VPS com Node.js
aguenta ~500. O Go consome **8MB de RAM** parado (vs 80MB do Node). Webhooks
assíncronos? `go dispararWebhook()` — uma linha, zero dependência de fila
externa. Deploy? Um único binário copiado pro servidor.

| Métrica | Node.js (Express) | Go (net/http) |
|---|---|---|
| Consumo de RAM (idle) | ~50-80MB | ~8-12MB |
| Throughput na VPS de $5 | ~500 req/s | ~5.000-10.000 req/s |
| Latência por request | 5-15ms | 0.5-2ms |
| Deploy | Instalar Node.js + npm + PM2 | Copiar 1 binário e rodar |
| Webhooks assíncronos | Precisa de fila (Redis/BullMQ) | `go funcao()` nativo |
| Tipagem | Dinâmica (JS) ou transpilada (TS) | Estática e compilada |

**Referências de mercado:** Shopify, Cloudflare, Uber, Twitch, Docker, Kubernetes
— todos usam Go para serviços de alta ingestão.

---

## Banco de Dados

### MySQL sem Redis (Modelo Shopify)

**Tecnologia:** MySQL 8+ (InnoDB)  
**Hospedagem:** Mesma VPS do Go (Vultr SP) — $0 extra

**Por que sem Redis?**

Redis resolve um problema que **ainda não temos**. O Go já é rápido o
suficiente para que a diferença entre 1ms (Redis) e 3ms (MySQL direto)
seja imperceptível. Adicionar Redis hoje significaria lidar com
**invalidação de cache** (o pesadelo nº 1 da computação), mais RAM
consumida na VPS, e mais um serviço para monitorar. A Shopify processou
**bilhões** com MySQL-first antes de adicionar cache.

| Cenário | Com Redis | Sem Redis (nosso caminho) |
|---|---|---|
| Latência de leitura | ~0.1ms | ~1-3ms (imperceptível) |
| Complexidade | Cache + invalidação + fallback | Query direta, sem ambiguidade |
| Pontos de falha | MySQL + Redis | Apenas MySQL |
| RAM na VPS | MySQL ~200MB + Redis ~100MB | MySQL ~200MB (sobra mais) |
| Custo extra | Redis gerenciado ou +RAM | $0 |

**Quando adicionaremos Redis:**
- Quando medirmos que uma query específica está lenta (>100ms) e é chamada
  centenas de vezes por segundo.
- Para filas de webhook, se as Goroutines do Go não forem suficientes.
- Improvável antes de ~10.000 webhooks/minuto.

---

## Segurança

### Camada 1 — Rede (A Muralha Externa)

```
  Internet                VPS (Vultr SP)
┌──────────┐        ┌──────────────────────────┐
│ Atacante │──✖──>  │  MySQL (porta 3306)      │
│          │        │  BIND: 127.0.0.1 (local) │
└──────────┘        │                          │
                    │  Go API (porta 443) ◄────│── Única porta pública
                    └──────────────────────────┘
```

- MySQL escuta **apenas em `127.0.0.1`** (localhost). Nenhuma conexão externa chega nele.
- Firewall (UFW) bloqueia tudo exceto portas **443** (HTTPS) e **22** (SSH com chave pública).

### Camada 2 — Acesso ao Banco (Mínimo Privilégio)

| Usuário MySQL | Permissões | Usado por |
|---|---|---|
| `kalidash_api` | `SELECT, INSERT, UPDATE` | Backend Go (dia a dia) |
| `kalidash_migrate` | `ALL PRIVILEGES` | Apenas durante migrações de schema |
| `kalidash_readonly` | `SELECT` | Scripts de backup e relatórios |

O usuário `kalidash_api` **não pode** executar `DROP TABLE`, `DELETE` sem `WHERE`,
nem `ALTER TABLE`. Se o servidor Go for comprometido, o dano fica contido.

### Camada 3 — Dados (Criptografia e Hashing)

| Dado | Tratamento | Motivo |
|---|---|---|
| `api_key_secret` | Hash SHA-256 (irreversível) | Nunca salvar chave em texto limpo |
| `senha_do_usuario` | Hash bcrypt (irreversível) | Padrão ouro para armazenamento de senhas |
| `telefone`, `dados_extras` | Criptografia AES-256-GCM (reversível) | Ilegível se alguém copiar o dump |
| `email` | Texto limpo (pesquisável) | Necessário para busca no CRM |

- A chave de criptografia (Encryption Key) vive em **variável de ambiente**, nunca no código.

### Camada 4 — Aplicação (O Go como Guardião)

| Ameaça | Proteção |
|---|---|
| SQL Injection | 100% Prepared Statements (`db.Query("... WHERE id = ?", id)`) |
| Flood / DDoS | Rate Limiter: 60 req/min por IP. Acima: `429 Too Many Requests` |
| XSS Armazenado | Sanitização HTML com whitelist de tags antes de salvar no banco |
| Spoofing de Origem | Validação do header `Origin` + Rate Limit por IP |
| Payload gigante | Limite de 10KB por request no `POST /api/logs` |
| Input malicioso | Validação de email (RFC 5321), escape de HTML, tamanho máximo por campo |

### Camada 5 — Autenticação do Painel (Híbrida: Senha + Google 2FA)

**Decisão Estratégica:** O login exige dois fatores obrigatórios, combinando o controle do nosso próprio banco de senhas com a segurança do ecossistema Google.

| Etapa / Mecanismo | Como funciona |
|---|---|
| **Fator 1 (Conhecimento)** | Usuário digita Email e Senha. O Go valida o hash bcrypt no nosso MySQL. |
| **Fator 2 (Posse / Google)** | Em vez de digitar um código de 6 dígitos (TOTP), o usuário clica em "Verificar com Google". O Google valida a sessão do Workspace/dispositivo e retorna um token de aprovação para o Go. |
| **Sessão Segura** | JWT de curta duração (15min) + Refresh Token em `httpOnly cookie` (imune a XSS e roubo via JavaScript). |
| **Vantagem do Modelo** | Mantemos independência (temos a senha) mas terceirizamos a complexidade do 2FA para o Google Workspace (que já gerencia dispositivos confiáveis e chaves físicas). |

### Camada 6 — Backups (Plano de Desastre)

**Regra 3-2-1:**
- **3** cópias dos dados (produção + 2 backups)
- **2** mídias diferentes (disco da VPS + storage externo)
- **1** cópia offsite (fora do datacenter da Vultr)

```bash
# Cron job diário às 3:00 AM
mysqldump -u kalidash_readonly --single-transaction kalidash_db \
  | gzip > backup_$(date +%F).sql.gz
# Upload para storage externo
rclone copy backup_$(date +%F).sql.gz remote:kalidash-backups/
```

**Teste de restauração mensal:** Baixar o backup, restaurar num ambiente de teste e
verificar se os dados estão íntegros. **Backup que não é testado não é backup.**

### Camada 7 — LGPD (Obrigações Legais)

| Exigência | Implementação |
|---|---|
| Direito de exclusão | `DELETE /api/leads/:id` → soft-delete + anonimização |
| Consentimento | `connect.js` integra com banner de cookies do site cliente |
| Registro de tratamento | Tabela `audit_log` (quem acessou/alterou e quando) |
| Minimização de dados | Capturar apenas campos configurados no snippet |
| Portabilidade | `GET /api/leads/export?project_id=X` → CSV/JSON |

---

## Hospedagem — Comparativo de VPS

**Recomendação:** Vultr São Paulo ($5/mês) — menor latência para público brasileiro.

| Provedor | RAM | CPU | Disco | Preço | Datacenter BR | IOPS |
|---|---|---|---|---|---|---|
| **Vultr** ⭐ | 1GB | 1 vCPU | 25GB NVMe | $5/mês | ✅ São Paulo | ~25.000 |
| Hetzner | 2GB | 2 vCPU | 20GB SSD | €3,79/mês | ❌ | ~10.000 |
| DigitalOcean | 1GB | 1 vCPU | 25GB SSD | $6/mês | ❌ | ~5.000 |
| Contabo | 4GB | 4 vCPU | 50GB | €4,50/mês | ❌ | ⚠️ ~500-1.500 |
| Oracle (Free) | 1GB | 1 vCPU | — | $0/mês | ✅ Vinhedo | — |

**Por que não Contabo?** Overselling (vendem mais recursos do que têm). Os 4 vCPUs
no papel são fatias compartilhadas. O disco tem ~500-1.500 IOPS vs ~25.000 da Vultr.
Uma query MySQL que leva 2ms na Vultr pode levar 20-50ms na Contabo.

---

## CMS Proprietário (Blog sem Sanity)

**Decisão:** Removemos o Sanity da equação para eliminar dependência externa,
custo extra e complexidade de GROQ/schemas.

**Editor:** Tiptap (MIT, $0) — mesmo motor usado pelo Substack e GitLab.

**Fluxo de publicação:**
```
Admin (PWA)                    Backend (Go)                 Site (Next.js)
    │                              │                             │
    ├─ Escreve no Tiptap           │                             │
    ├─ Upload imagem ──────────>   ├─ Comprime para WebP         │
    │                              ├─ Gera 3 tamanhos            │
    │                              ├─ Salva no storage           │
    ├─ Clica "Publicar" ───────>   ├─ Sanitiza HTML (whitelist)  │
    │                              ├─ Gera slug único            │
    │                              ├─ Salva no MySQL             │
    │                              ├─ Dispara revalidação ────>  ├─ ISR regenera a página
    │                              │                             ├─ Próximo visitante vê o post
    │                              │                             ├─ Google indexa HTML completo
```

---

## Princípio Arquitetônico

```
┌─────────────────────────────────────────────────────────┐
│                    PRINCÍPIO KALIDASH                    │
│                                                         │
│   "Cada peça no sistema precisa justificar sua          │
│    existência. Se ela não resolve um problema            │
│    que já existe, ela É o problema."                     │
│                                                         │
│   ✅ Vite Admin   → Leve, rápido, sem servidor          │
│   ✅ Next.js Site  → SEO obrigatório, ISR nativo        │
│   ✅ Go Backend   → 10x menos RAM, 10x mais throughput  │
│   ✅ MySQL puro   → Simples, confiável, barato          │
│   ✅ Vultr SP     → 5ms de latência, NVMe, $5/mês      │
│   ❌ Redis        → Problema que ainda não temos        │
│   ❌ Sanity       → Dependência que não precisamos      │
│   ❌ Contabo      → Specs falsos, disco lento           │
└─────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant (Isolamento por Projeto)

O Kalidash é uma plataforma que atende **múltiplos clientes** pelo mesmo backend.
Cada "cliente" (inclusive o próprio site da Kalidash) é um **Projeto** isolado
dentro do banco de dados. Esse modelo se chama **Single Database, Shared Schema**
— o mesmo que Shopify, Intercom e HubSpot usam.

### Schema de Isolamento

```sql
-- Toda conta que usa o Kalidash
CREATE TABLE accounts (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,          -- "Agência X", "Kalidash Oficial"
    email           VARCHAR(254) NOT NULL UNIQUE,   -- Email de login do dono
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt
    plan            ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cada site conectado ao Kalidash (1 conta pode ter N projetos)
CREATE TABLE projects (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id      BIGINT UNSIGNED NOT NULL,       -- FK → accounts.id
    name            VARCHAR(200) NOT NULL,          -- "Site Principal", "LP Black Friday"
    domain          VARCHAR(255) NOT NULL,          -- "agenciax.com.br"
    status          ENUM('pending', 'active', 'paused') DEFAULT 'pending',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_account (account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Chaves de API vinculadas a um projeto
CREATE TABLE api_keys (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT UNSIGNED NOT NULL,       -- FK → projects.id
    key_prefix      VARCHAR(12) NOT NULL,           -- "kld_live_8F2a" (visível no painel)
    key_hash        VARCHAR(64) NOT NULL,           -- SHA-256 da chave completa (nunca texto limpo)
    scope           ENUM('publishable', 'secret') NOT NULL,
    is_revoked      BOOLEAN DEFAULT FALSE,
    last_used_at    DATETIME NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_project (project_id),
    INDEX idx_hash (key_hash),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Leads capturados (o coração do sistema)
CREATE TABLE leads (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id      BIGINT UNSIGNED NOT NULL,       -- FK → projects.id (ISOLAMENTO)
    source          VARCHAR(100),                   -- "connect.js", "api_direta", "manual"
    email           VARCHAR(254),
    name            VARCHAR(200),
    phone_enc       VARBINARY(512),                 -- Criptografado AES-256-GCM
    extra_data_enc  VARBINARY(4096),                -- Campos extras do formulário (criptografado)
    utm_source      VARCHAR(100),
    utm_medium      VARCHAR(100),
    utm_campaign    VARCHAR(200),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    page_url        VARCHAR(2048),                  -- URL onde o lead preencheu o formulário
    stage           ENUM('new', 'contacted', 'negotiation', 'won', 'lost') DEFAULT 'new',
    assigned_to     BIGINT UNSIGNED NULL,            -- FK → team_members.id
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_project_stage (project_id, stage),
    INDEX idx_project_created (project_id, created_at DESC),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Como o isolamento funciona na prática

```
Site da Agência X              Site da Padaria Y              Site da Kalidash
(connect.js + kld_AAAA)        (connect.js + kld_BBBB)        (connect.js + kld_CCCC)
        │                              │                              │
        └──────────────┬───────────────┘──────────────────────────────┘
                       ▼
              POST /api/logs (Backend Go)
                       │
                       ├─ 1. Extrai a API Key do header
                       ├─ 2. Faz SHA-256 da chave recebida
                       ├─ 3. Busca: SELECT project_id FROM api_keys WHERE key_hash = ?
                       ├─ 4. Valida Origin header vs projects.domain
                       ├─ 5. INSERT INTO leads (project_id = ?, ...) ← CARIMBA com o projeto certo
                       │
                       ▼
              Banco de Dados (MySQL)
              ┌─────────────────────────────────────────┐
              │ leads                                   │
              │ id=1  project_id=1  email=joao@...      │ ← Agência X
              │ id=2  project_id=2  email=maria@...     │ ← Padaria Y
              │ id=3  project_id=3  email=pedro@...     │ ← Kalidash
              │ id=4  project_id=1  email=ana@...       │ ← Agência X
              └─────────────────────────────────────────┘
```

Quando o dono da **Agência X** faz login no painel admin, o Go filtra:
`SELECT * FROM leads WHERE project_id = 1` — ele **nunca** vê os leads
da Padaria Y nem os da Kalidash. O isolamento é absoluto.

---

## Controle de Leads (Ciclo de Vida)

### Estágios do Pipeline

```
  ┌─────────┐    ┌────────────┐    ┌─────────────┐    ┌───────┐
  │   NEW   │───>│ CONTACTED  │───>│ NEGOTIATION │───>│  WON  │
  │ (Novo)  │    │(Contatado) │    │ (Negociação)│    │(Ganho)│
  └────┬────┘    └────────────┘    └─────────────┘    └───────┘
       │                                                  
       └──────────────────────────────────────────>┌───────┐
                                                   │ LOST  │
                                                   │(Perd.)│
                                                   └───────┘
```

| Estágio | Quem move | O que acontece |
|---|---|---|
| **NEW** | Automático (connect.js ou API) | Lead entra no banco. Notificação push na PWA. Aparece na coluna "Novos" do Kanban |
| **CONTACTED** | Vendedor (arrasta no Kanban) | Vendedor entrou em contato. Registra nota na ficha do lead |
| **NEGOTIATION** | Vendedor | Proposta enviada. Campos de valor ($) e previsão de fechamento |
| **WON** | Vendedor | Contrato fechado. Dispara webhook para sistema externo (se configurado). |
| **LOST** | Vendedor | Oportunidade perdida. Registra motivo (preço, concorrência, timing) para análise futura |

### Regras de Negócio

- **Atribuição automática:** Se houver regra de round-robin configurada, o lead
  novo é automaticamente atribuído ao próximo vendedor da fila (`assigned_to`).
- **SLA de primeiro contato:** Timer visível no card do Kanban mostrando há quanto
  tempo o lead está em "NEW" sem ser contatado (ex: "⏱ 2h sem resposta").
- **Deduplicação:** Se chegar um lead com o mesmo `email` + `project_id`,
  o sistema não cria duplicata — atualiza o registro existente e registra
  a nova interação no histórico.

---

## Inbound (Pipeline de Captação)

### Fluxo Completo de Entrada de um Lead

```
   Visitante no site do cliente
          │
          ├─ 1. Página carrega connect.js (via CDN ou <script> inline)
          ├─ 2. connect.js identifica o formulário pelos seletores CSS configurados
          ├─ 3. Visitante preenche e clica "Enviar"
          │
          ▼
   connect.js intercepta o submit
          │
          ├─ 4. Coleta os campos mapeados (nome, email, tel)
          ├─ 5. Coleta metadados automáticos:
          │     • URL da página (page_url)
          │     • UTM params (utm_source, utm_medium, utm_campaign)
          │     • User-Agent do navegador
          │     • Timestamp
          ├─ 6. Monta o payload JSON
          ├─ 7. Envia POST /api/logs com header X-API-Key: kld_live_xxxx
          │
          ▼
   Backend Go recebe o request
          │
          ├─ 8. Rate Limiter: IP dentro do limite? Se não → 429
          ├─ 9. Extrai X-API-Key → SHA-256 → busca no banco
          ├─ 10. Chave existe e não está revogada? Se não → 401
          ├─ 11. Origin header bate com o domínio do projeto? Se não → 403
          ├─ 12. Valida e sanitiza todos os campos do payload
          ├─ 13. Criptografa campos sensíveis (telefone, extras) com AES-256
          ├─ 14. INSERT INTO leads (project_id, email, name, ...)
          ├─ 15. Atualiza api_keys.last_used_at
          │
          ├─ 16. Dispara em paralelo (Goroutines):
          │     ├─ WebSocket: notifica o painel admin em tempo real
          │     ├─ Push Notification: "🚀 Novo Lead: joao@email.com"
          │     └─ Webhooks: POST para RD Station / HubSpot (se configurado)
          │
          └─ 17. Retorna 201 Created ao connect.js
                  (connect.js exibe mensagem de sucesso no formulário original)
```

### Métricas do Dashboard (Inbound Analytics)

| Métrica | Como é calculada | Visualização |
|---|---|---|
| **Total de Leads** | `COUNT(*) WHERE project_id = ? AND created_at BETWEEN ...` | Número grande (card) |
| **Leads Hoje** | Filtro por `DATE(created_at) = CURDATE()` | Card com variação vs ontem (↑12%) |
| **Taxa de Conversão** | `COUNT(stage='won') / COUNT(*) * 100` | Gráfico de rosca (%) |
| **Leads por Fonte** | Agrupado por `utm_source` | Gráfico de barras |
| **Leads por Página** | Agrupado por `page_url` | Tabela ranqueada |
| **Tempo Médio de Resposta** | Diferença entre `created_at` (NEW) e timestamp do CONTACTED | Indicador (ex: "1h 23min") |
| **Volume Diário** | Agrupado por `DATE(created_at)` últimos 30 dias | Gráfico de linha (tendência) |

---

## Pixel / Connect.js (O Script de Captura)

### O que é o Connect.js

É um arquivo JavaScript leve (~5KB gzipped) que o cliente cola no site dele.
Ele funciona como um "pixel de captura" — silenciosamente observa o formulário
HTML nativo do site e, quando o visitante submete, intercepta os dados e
envia para o backend do Kalidash.

### Anatomia do Snippet

O admin gera isso no painel e o cliente cola no HTML do site:

```html
<!-- Kalidash Connect -->
<script
  src="https://cdn.kalidash.com/connect.js"
  data-token="kld_live_8F2a..."
  data-form="#meu-formulario"
  data-map='{"email": "#campo-email", "name": "#campo-nome", "phone": "#campo-tel"}'
  async
></script>
```

| Atributo | Função |
|---|---|
| `data-token` | Publishable API Key (somente escrita, sem poder de leitura) |
| `data-form` | Seletor CSS do formulário que o script deve observar |
| `data-map` | Mapeamento: qual campo do lead corresponde a qual input do HTML |
| `async` | Carrega sem bloquear a renderização da página |

### O que o Connect.js faz internamente

```javascript
// Pseudocódigo simplificado do connect.js
(function() {
  const config = document.currentScript.dataset;
  const form = document.querySelector(config.form);
  const map = JSON.parse(config.map);

  form.addEventListener('submit', async (e) => {
    // 1. Coleta os campos mapeados
    const payload = {};
    for (const [leadField, selector] of Object.entries(map)) {
      payload[leadField] = document.querySelector(selector)?.value;
    }

    // 2. Coleta metadados automáticos
    payload.page_url = window.location.href;
    payload.utm_source = new URLSearchParams(location.search).get('utm_source');
    payload.utm_medium = new URLSearchParams(location.search).get('utm_medium');
    payload.utm_campaign = new URLSearchParams(location.search).get('utm_campaign');

    // 3. Envia para o backend
    await fetch('https://api.kalidash.com/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.token
      },
      body: JSON.stringify(payload)
    });
  });
})();
```

### Segurança do Pixel

| Ameaça | Proteção |
|---|---|
| Chave visível no HTML | É uma **Publishable Key** — só tem permissão de `INSERT` leads. Não lê, não deleta, não altera nada |
| Spoofing (forjar origem) | Backend valida `Origin` header + Rate Limit por IP |
| Flood de requests falsos | Rate Limiter: 5 leads/minuto por IP. Acima: 429 |
| Bot/spam | Opção futura: integrar Cloudflare Turnstile (captcha invisível) no connect.js |
| Interceptação de dados | Tudo trafega via HTTPS (TLS 1.3). Dados criptografados em trânsito |

### Captura de UTM e Rastreamento

O connect.js captura automaticamente os parâmetros de campanha da URL:

```
https://agenciax.com.br/lp?utm_source=google&utm_medium=cpc&utm_campaign=black-friday
                            ─────────────────────────────────────────────────────────
                            Esses valores são extraídos e salvos junto com o lead
```

Isso permite que o dashboard mostre **de onde veio cada lead** sem precisar
de integração com Google Analytics — o Kalidash tem seu próprio rastreamento
de origem. No futuro, podemos expandir para capturar `referrer`, `device`,
`geolocation` (via IP) e criar um analytics de captação completo.
