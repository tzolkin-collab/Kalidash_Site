# 🔒 Segurança do Banco de Dados & Estratégia do CMS Proprietário

---

## Parte 1 — Segurança do Banco de Dados

### O cenário de ameaça real do Kalidash
O Kalidash guarda dados sensíveis de terceiros: nomes, emails, telefones e dados de
formulários de clientes que **não são nossos**. Se esse banco vazar, não é só a reputação
da Kalidash que vai pro chão — é a dos clientes também. Isso nos coloca sob a LGPD
(Lei Geral de Proteção de Dados) com responsabilidade direta.

---

### 1. Camada de Rede (A Muralha Externa)

**Princípio: O banco de dados NUNCA fala com a internet.**

```
  Internet                VPS
┌──────────┐        ┌──────────────────────────┐
│ Atacante │──✖──>  │  MySQL (porta 3306)      │
│          │        │  BIND: 127.0.0.1 (local) │
└──────────┘        │                          │
                    │  Go API (porta 443) ◄────│── Única porta pública
                    └──────────────────────────┘
```

- O MySQL escuta **apenas em `127.0.0.1`** (localhost). Nenhuma conexão externa consegue
  chegar nele, mesmo que descubram a senha.
- O firewall da VPS (UFW/iptables) bloqueia tudo exceto as portas **443** (HTTPS) e **22** (SSH).
- A porta SSH deve usar **chave pública** (não senha), com acesso restrito ao IP da equipe.

**Se usar Supabase (alternativa SaaS):**
- O Supabase já isola o PostgreSQL atrás de uma API intermediária com Row Level Security (RLS).
- Mesmo assim, desabilite o acesso direto ao banco via "Dashboard > Database > Connection Pooling"
  e use apenas a Service Key no backend Go (nunca no frontend).

---

### 2. Camada de Autenticação do Banco

**Princípio: Mínimo privilégio. Cada contexto tem seu próprio usuário MySQL.**

| Usuário MySQL | Permissões | Usado por |
|---|---|---|
| `kalidash_api` | `SELECT, INSERT, UPDATE` nas tabelas de leads, projects, api_keys | O backend Go (operações do dia a dia) |
| `kalidash_migrate` | `ALL PRIVILEGES` | Apenas durante migrações de schema (rodar e desligar) |
| `kalidash_readonly` | `SELECT` apenas | Scripts de backup e relatórios |

**Por que não usar `root` para tudo?**
Se o servidor Go for comprometido (ex: uma vulnerabilidade de SQL Injection que passamos batido),
o atacante teria acesso com o usuário `kalidash_api`, que **não pode** executar `DROP TABLE`,
`DELETE` sem `WHERE`, nem `ALTER TABLE`. O dano fica contido.

---

### 3. Camada de Dados (Criptografia e Hashing)

**O que é salvo em texto limpo (pesquisável):**
- `email` — precisa ser buscável para o CRM funcionar (mas criptografado em repouso, ver abaixo)
- `project_id`, `created_at`, `status` — dados operacionais

**O que é hasheado (irreversível, SHA-256):**
- `api_key_secret` — A chave completa NUNCA é armazenada. Apenas o hash.
  Quando o connect.js manda um request, o Go faz `SHA256(chave_recebida)` e
  compara com o hash no banco.

**O que é criptografado (reversível, AES-256-GCM):**
- `telefone`, `dados_extras_do_formulario` — Campos sensíveis que precisam ser exibidos
  no painel mas que devem estar ilegíveis se alguém copiar o dump do banco.
- A chave de criptografia (Encryption Key) vive em **variável de ambiente** do servidor,
  nunca no código ou no banco.

**Criptografia em Repouso (Encryption at Rest):**
- No MySQL self-hosted: Ativar `innodb_encrypt_tables = ON` (disponível no MariaDB)
  ou usar discos criptografados na VPS (LUKS).
- No Supabase: Já vem ativado por padrão (AES-256 no storage da AWS).

---

### 4. Camada de Aplicação (O Go como Guardião)

**SQL Injection — A ameaça nº 1 do planeta:**
- O Go usa `database/sql` com **prepared statements** por padrão.
  ```go
  // ✅ CORRETO — O Go parameteriza automaticamente
  db.Query("SELECT * FROM leads WHERE project_id = ?", projectID)

  // ❌ JAMAIS — Concatenação direta é uma porta aberta
  db.Query("SELECT * FROM leads WHERE project_id = " + projectID)
  ```
- Isso é inegociável. **100% das queries** devem usar placeholders `?`.

**Rate Limiting (Anti-Flood):**
- Middleware no Go que limita requisições por IP.
- Regra inicial: 60 requests/minuto por IP na rota `/api/logs`.
- Se um IP ultrapassar: retorna `429 Too Many Requests` e bloqueia por 5 minutos.

**Validação de Input (Nunca confie no frontend):**
- Todo campo recebido no `POST /api/logs` é sanitizado antes de tocar o banco.
- Email: validação com regex + tamanho máximo (254 chars conforme RFC 5321).
- Campos de texto: escape de HTML para prevenir XSS armazenado (Stored XSS).
- Tamanho total do payload: máximo de 10KB por request.

---

### 5. Backups (O Plano de Desastre)

**Regra 3-2-1:**
- **3** cópias dos dados (produção + 2 backups)
- **2** mídias diferentes (disco da VPS + storage externo como S3/Backblaze B2)
- **1** cópia offsite (fora do datacenter da VPS)

**Automação:**
```bash
# Cron job diário às 3:00 AM (horário de menor tráfego)
mysqldump -u kalidash_readonly --single-transaction kalidash_db | gzip > backup_$(date +%F).sql.gz
# Upload para storage externo
rclone copy backup_$(date +%F).sql.gz remote:kalidash-backups/
```

**Teste de restauração mensal:** Baixar o backup, restaurar num ambiente de teste e
verificar se os dados estão íntegros. Backup que não é testado não é backup.

---

### 6. LGPD — Obrigações Técnicas

| Exigência da LGPD | Implementação no Kalidash |
|---|---|
| Direito de exclusão ("me apague") | Endpoint `DELETE /api/leads/:id` que faz soft-delete + anonimização dos campos pessoais |
| Consentimento | O snippet `connect.js` deve exibir ou integrar com o banner de cookies/consentimento do site do cliente |
| Registro de tratamento | Tabela `audit_log` registrando quem acessou/alterou dados pessoais e quando |
| Minimização de dados | Capturar apenas os campos que o cliente configurou no mapeamento do snippet. Nada a mais |
| Portabilidade | Endpoint `GET /api/leads/export?project_id=X` que retorna CSV/JSON dos leads daquele projeto |

---

---

## Parte 2 — CMS Proprietário (O Blog sem Sanity)

### Decisão: CMS Interno no Kalidash

Conforme discutido, removemos o Sanity da equação. O blog será gerenciado 100%
dentro do ecossistema Kalidash:
- **Escrita:** Uma aba "Publicações" no FE Admin (Vite/PWA).
- **Armazenamento:** Os posts ficam no nosso BD Centralizado (MySQL/Supabase).
- **Exibição:** O FE Cliente (Next.js) consome a API Go com ISR.

---

### 1. Schema do Banco (Tabela `posts`)

```sql
CREATE TABLE posts (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug        VARCHAR(255) NOT NULL UNIQUE,       -- URL amigável: "como-capturar-leads"
    title       VARCHAR(300) NOT NULL,
    excerpt     VARCHAR(500),                        -- Resumo para cards e meta description
    content     MEDIUMTEXT NOT NULL,                 -- O corpo do artigo (HTML ou Markdown)
    cover_url   VARCHAR(500),                        -- URL da imagem de capa (no S3/Storage)
    author      VARCHAR(100),
    status      ENUM('draft', 'published') DEFAULT 'draft',
    published_at DATETIME NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status_published (status, published_at DESC)  -- Query principal do blog
);
```

**Por que `MEDIUMTEXT` e não `TEXT`?**
`TEXT` suporta até 64KB (~20 páginas de texto). `MEDIUMTEXT` suporta até 16MB,
o que cobre artigos com imagens inline em base64 ou HTML pesado. Na prática,
nossos posts terão <100KB, mas não queremos bater no limite.

---

### 2. Editor de Texto — Qual usar no Admin?

O editor é a peça mais crítica do CMS. Aqui estão as opções realistas:

| Editor | Peso (gzip) | Experiência | Formato de saída |
|---|---|---|---|
| **Tiptap** (baseado no ProseMirror) | ~50KB | Notion-like, blocos arrastáveis, extensível | HTML ou JSON |
| **Milkdown** (baseado no ProseMirror) | ~40KB | Markdown-first com preview WYSIWYG | Markdown |
| **Editor.js** | ~30KB | Blocos independentes (tipo Notion/Medium) | JSON estruturado |
| **Textarea + Markdown** | ~0KB | Crua, sem preview visual | Markdown |

**Recomendação: Tiptap**
- É o mais maduro e usado em produção (Substack, GitLab, muitos SaaS).
- Suporta extensões para imagens, vídeos, tabelas, código, callouts.
- Produz HTML limpo que o Next.js renderiza direto sem parser especial.
- Tem integração nativa com React.

**Alternativa minimalista: Textarea + Markdown**
- Se quiser lançar o mais rápido possível, salvar Markdown puro no banco e
  converter para HTML no Next.js com uma lib de ~5KB (`marked` ou `markdown-it`).
- Desvantagem: a experiência de escrever é inferior (sem negrito visual, sem arrastar imagens).

---

### 3. Fluxo Completo de uma Publicação

```
Autor (no FE Admin PWA)
    │
    ├─ 1. Escreve o artigo no editor Tiptap
    ├─ 2. Faz upload da imagem de capa
    │      └─ Go recebe, comprime para WebP, envia para S3/Storage, retorna URL
    ├─ 3. Clica em "Publicar"
    │      └─ POST /api/posts  →  Go salva no MySQL com status = 'published'
    │
    ▼
Next.js (FE Cliente na Vercel)
    │
    ├─ 4. Visitante acessa kalidash.com/blog/como-capturar-leads
    ├─ 5. Next.js não tem essa página em cache (é nova)
    │      └─ ISR: Next.js chama GET /api/posts/como-capturar-leads no Go
    │      └─ Go retorna o HTML do post
    │      └─ Next.js renderiza, entrega ao visitante, e cacheia por X minutos
    ├─ 6. Próximo visitante recebe a versão cacheada instantaneamente
    │
    ▼
Google
    ├─ 7. Googlebot acessa a URL e recebe HTML completo
    └─ 8. Indexa com título, descrição e conteúdo. SEO perfeito.
```

---

### 4. Problemas Antecipados do CMS

**Problema 1: Upload de Imagens Pesadas**
- *Risco:* O autor sobe uma foto de 8MB direto da câmera. Isso destrói o LCP do blog.
- *Solução:* O endpoint de upload no Go deve:
  1. Rejeitar arquivos >5MB (retorna erro 413).
  2. Converter para WebP com qualidade 80% (reduz ~70% do tamanho).
  3. Gerar 3 tamanhos (thumbnail 300px, medium 800px, full 1200px).
  4. Salvar no S3/Supabase Storage e retornar apenas a URL.

**Problema 2: XSS no Conteúdo do Post (Stored XSS)**
- *Risco:* Se o editor permite HTML, um admin poderia (acidentalmente ou maliciosamente)
  salvar `<script>alert('hack')</script>` no corpo do post. O Next.js renderizaria
  esse script no blog público, executando código arbitrário no navegador dos visitantes.
- *Solução:* O Go deve sanitizar o HTML antes de salvar, usando uma whitelist de tags
  permitidas (ex: `<p>, <h1-h6>, <img>, <a>, <strong>, <em>, <ul>, <ol>, <li>, <code>, <blockquote>`).
  Qualquer tag fora da lista é removida silenciosamente.

**Problema 3: Slug Duplicado**
- *Risco:* O autor cria dois posts com o título "Dicas de Marketing". Ambos geram
  o slug `dicas-de-marketing`. O segundo sobrescreve a rota do primeiro.
- *Solução:* A coluna `slug` tem `UNIQUE` constraint. Se já existir, o Go
  adiciona um sufixo numérico (`dicas-de-marketing-2`).

**Problema 4: Invalidação do Cache ISR**
- *Risco:* O autor publicou o post, depois editou o título. Mas a Vercel ainda
  serve a versão antiga do cache por X minutos.
- *Solução:* O Go, ao receber um `PUT /api/posts/:slug`, dispara um
  `POST` para a API de revalidação da Vercel (`/api/revalidate?path=/blog/:slug`),
  forçando o Next.js a regenerar aquela página específica imediatamente.

---

### Resumo das Camadas de Segurança

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEFESA EM PROFUNDIDADE                      │
│                                                                 │
│  Camada 1 — Rede       Firewall + MySQL em localhost only       │
│  Camada 2 — Acesso     Usuários MySQL com mínimo privilégio     │
│  Camada 3 — Dados      Hash (API Keys) + AES-256 (PII)         │
│  Camada 4 — App        Prepared Statements + Rate Limit         │
│  Camada 5 — CMS        Sanitização HTML + Whitelist de tags     │
│  Camada 6 — Backup     3-2-1 + Teste mensal de restauração      │
│  Camada 7 — LGPD       Anonimização + Auditoria + Exportação   │
└─────────────────────────────────────────────────────────────────┘
```
