# 🔐 Estudo de Autenticação — Google OAuth + Workspace

> Estudo aprofundado de como o login, cadastro de equipe e controle de acesso
> funcionam no Kalidash usando Google OAuth 2.0 com Google Workspace.

---

## Por que Google OAuth (e não email + senha próprio)?

| Aspecto | Email + Senha próprio | Google OAuth |
|---|---|---|
| Segurança de senha | Nós gerenciamos (bcrypt, reset, vazamentos) | Google gerencia. Problema deles |
| 2FA | Precisamos implementar TOTP do zero | Google Workspace já tem 2FA nativo obrigatório |
| Onboarding da equipe | Criar conta, confirmar email, definir senha | Clica "Entrar com Google". Pronto |
| Manutenção de sessão | JWT + Refresh Token + rotação manual | Mesma coisa, mas sem gerenciar senhas |
| Ataque de phishing | Risco alto (tela de login falsa captura senhas) | Risco baixo (login acontece no domínio do Google) |
| Desligamento de funcionário | Precisa revogar acesso manualmente no Kalidash | Desativa no Google Workspace → acesso cortado automaticamente |
| Custo | $0 (mas horas de dev para implementar) | $0 (Google OAuth é gratuito) |

**Veredicto:** Usar Google OAuth elimina inteiramente a necessidade de:
- Tabela de senhas no banco
- Fluxo de "Esqueci minha senha"
- Implementação de TOTP/2FA
- Verificação de email
- Proteção contra brute force no login

### O que ganhamos na prática?

1. **Menos Código, Zero Dor de Cabeça (Segurança Terceirizada)**
   Não sabemos as senhas, não as guardamos e não nos preocupamos com elas. A segurança bilionária do Google trabalha de graça para o Kalidash, eliminando os riscos de vazamentos criminais e ataques de força bruta.
2. **Autenticação de 2 Fatores (2FA) de Graça**
   O Google Workspace permite forçar que toda a equipe use 2FA nativamente (via celular ou chave física). O Kalidash herda essa camada militar de segurança sem precisar escrever uma única linha de código para TOTP ou QR Codes.
3. **Onboarding e Offboarding Instantâneo (Gestão Centralizada)**
   Se um funcionário entra, basta criar o email corporativo dele. Se ele é desligado, o administrador desativa o email no Google Workspace e, **instantaneamente**, a pessoa perde acesso ao Kalidash, ao email e ao Drive. Evita o risco comum de ex-funcionários manterem acesso ao painel do CRM porque alguém esqueceu de excluí-los.
4. **UX Premium**
   Para a equipe, não há fricção: basta clicar em *"Entrar com o Google"* e o painel abre. Sem cadastros, confirmação de email ou memorização de senhas.

---

## Fluxo Completo de Login

### Diagrama

```
  Admin (PWA Vite)                    Backend (Go)                    Google
       │                                   │                            │
       ├─ 1. Clica "Entrar com Google"     │                            │
       │                                   │                            │
       ├─ 2. GET /auth/google/login ──────>│                            │
       │                                   ├─ 3. Gera state (anti-CSRF) │
       │                                   ├─ 4. Monta URL do Google    │
       │<── 5. Redirect 302 ──────────────>│                            │
       │                                   │                            │
       ├─ 6. Usuário vê tela do Google ────────────────────────────────>│
       │     (escolhe conta @empresa.com)  │                            │
       │                                   │                            │
       │<──────────────────────────────────────── 7. Redirect com code ─┤
       │                                   │                            │
       ├─ 8. GET /auth/google/callback ───>│                            │
       │     ?code=xxx&state=yyy           │                            │
       │                                   ├─ 9. Valida state           │
       │                                   ├─ 10. Troca code por tokens │
       │                                   │      POST googleapis.com ──────────>│
       │                                   │<─────── access_token + id_token ────┤
       │                                   │                            │
       │                                   ├─ 11. Decodifica id_token:  │
       │                                   │      email, nome, avatar   │
       │                                   │                            │
       │                                   ├─ 12. Verifica:             │
       │                                   │      Email existe na       │
       │                                   │      tabela team_members?  │
       │                                   │                            │
       │                                   │  SIM ──> 13a. Emite JWT    │
       │                                   │  NÃO ──> 13b. Retorna 403  │
       │                                   │          "Não autorizado"   │
       │                                   │                            │
       │<── 14. Set-Cookie: refresh_token ─┤                            │
       │<── 15. Redirect para /dashboard   │                            │
       │     com access_token na URL hash  │                            │
       │                                   │                            │
       ├─ 16. PWA salva access_token       │                            │
       │     em memória (nunca localStorage)│                           │
       ├─ 17. Limpa token da URL           │                            │
       ├─ 18. Carrega Dashboard ✅          │                            │
```

### Detalhes Técnicos

**Passo 4 — URL montada pelo Go:**
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=GOOGLE_CLIENT_ID
  &redirect_uri=https://api.kalidash.com/auth/google/callback
  &response_type=code
  &scope=openid email profile
  &state=random_csrf_token
  &hd=empresa.com          ← RESTRINGE ao domínio do Workspace!
```

O parâmetro `hd=empresa.com` é crucial: ele faz o Google mostrar
**apenas contas do domínio da empresa**. Se alguém tentar logar com
um Gmail pessoal, o Google bloqueia antes de chegar no nosso backend.

**Passo 11 — O que vem no ID Token do Google:**
```json
{
  "sub": "118234567890",           // ID único do Google (nunca muda)
  "email": "carol@kalidash.com",
  "email_verified": true,
  "name": "Carol",
  "picture": "https://lh3.googleusercontent.com/...",
  "hd": "kalidash.com"            // Domínio do Workspace
}
```

---

## Schema do Banco (Atualizado para Google OAuth)

```sql
-- Membros da equipe da Kalidash (login via Google OAuth).
-- Na implementação equivale à tabela `User` do Prisma, com google_sub, is_active
-- e last_login_at acrescentados. Não há tabela de contas: o espaço de dados é único.
CREATE TABLE team_members (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    google_sub      VARCHAR(50) NULL UNIQUE,      -- ID fixo do Google (NULL até o primeiro login)
    email           VARCHAR(254) NOT NULL UNIQUE,
    name            VARCHAR(200),
    avatar_url      VARCHAR(500),                 -- Foto do Google
    role            ENUM('admin', 'manager', 'seller') NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   DATETIME NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_google_sub (google_sub)
);

-- Sessões ativas (para controle de logout e auditoria)
CREATE TABLE sessions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_member_id  BIGINT UNSIGNED NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL,       -- SHA-256 do refresh token
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    expires_at      DATETIME NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_member (team_member_id),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id)
);
```

**O que mudou vs o schema anterior:**
- ❌ Removido `password_hash` — não gerenciamos mais senhas
- ❌ Removidas `accounts` e o `account_id` — não há multi-tenant; o espaço de dados é único
- ✅ Três perfis (`admin`, `manager`, `seller`), no lugar dos quatro anteriores (`owner` e `admin` viraram um só)
- ❌ Removido qualquer lógica de TOTP/2FA — Google Workspace já impõe
- ✅ Adicionado `google_sub` — identificador fixo do Google (mais seguro que email, que pode mudar)
- ✅ Adicionado `team_members` — cada pessoa tem seu próprio registro com role
- ✅ Adicionado `sessions` — controle de onde cada pessoa está logada

---

## Cadastro e Gestão da Equipe

### Fluxo de Convite de Novo Membro

```
Admin (no painel admin)
    │
    ├─ 1. Vai em Configurações > Equipe > "Convidar Membro"
    ├─ 2. Digita: carol@kalidash.com | Role: Manager
    │
    ▼
Backend Go
    │
    ├─ 3. Verifica se o email tem o domínio do Workspace da Kalidash
    ├─ 4. INSERT INTO team_members (email, role, is_active = TRUE)
    │     (google_sub fica NULL até o primeiro login)
    │
    ▼
Carol recebe uma notificação (email ou mensagem)
    │
    ├─ 5. Acessa admin.kalidash.com
    ├─ 6. Clica "Entrar com Google"
    ├─ 7. Google retorna email=carol@kalidash.com
    │
    ▼
Backend Go (no callback)
    │
    ├─ 8. SELECT * FROM team_members WHERE email = 'carol@kalidash.com'
    ├─ 9. Encontrou! is_active = TRUE
    ├─ 10. UPDATE team_members SET google_sub = '118...' WHERE email = ...
    │      (vincula o Google ID permanente)
    ├─ 11. Emite JWT com role = 'manager'
    │
    ▼
Carol está dentro do painel ✅
```

### Desligamento de Funcionário

```
Admin
    │
    ├─ Opção A: Desativa no Google Workspace (mais seguro)
    │   └─ Próximo login: Google rejeita → nunca chega no nosso callback
    │
    ├─ Opção B: Desativa no painel Kalidash
    │   └─ UPDATE team_members SET is_active = FALSE WHERE id = X
    │   └─ DELETE FROM sessions WHERE team_member_id = X (mata sessões ativas)
    │   └─ Próximo request: JWT ainda válido por até 15min, mas o refresh
    │      será rejeitado e a sessão expira naturalmente
    │
    └─ Ideal: Fazer ambos para cobertura total
```

---

## Sistema de Permissões (RBAC)

| Role | Dashboard | CRM | Projetos e Chaves | Blog | Webhooks | Equipe |
|---|---|---|---|---|---|---|
| **Admin** | ✅ | ✅ (todo o funil) | ✅ | ✅ | ✅ | ✅ (não pode remover o último Admin) |
| **Manager** | ✅ | ✅ (todo o funil) | ✅ | ✅ | ❌ | ❌ |
| **Seller** | ✅ (só seus leads) | ✅ (só leads atribuídos a ele) | ❌ | ❌ | ❌ | ❌ |

O **valor das oportunidades** segue a visibilidade do CRM: quem vê a oportunidade vê o valor dela (padrão a confirmar).

### Como funciona no Go (Middleware)

```go
// Middleware de autorização por role (net/http, como a API atual)
func RequireRole(allowed ...string) func(http.HandlerFunc) http.HandlerFunc {
    return func(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
            claims, ok := r.Context().Value(claimsKey).(JWTClaims)
            if !ok {
                http.Error(w, "Não autenticado", http.StatusUnauthorized)
                return
            }
            for _, role := range allowed {
                if claims.Role == role {
                    next(w, r)
                    return
                }
            }
            http.Error(w, "Permissão insuficiente", http.StatusForbidden)
        }
    }
}

// Uso nas rotas:
mux.HandleFunc("/api/team", RequireRole("admin")(listTeam))
mux.HandleFunc("/api/webhooks", RequireRole("admin")(listWebhooks))
mux.HandleFunc("/api/leads", RequireRole("admin", "manager", "seller")(listLeads))
// Para "seller", listLeads filtra por ownerId = claims.Sub.
```

### O JWT do Kalidash contém:

```json
{
  "sub": "42",                    // team_member.id
  "role": "manager",             // para o middleware de permissões
  "email": "carol@kalidash.com",
  "name": "Carol",
  "avatar": "https://lh3...",    // foto do Google
  "exp": 1727276400              // expira em 15 minutos
}
```

---

## Tokens Finais (Atualizado — Sem Senha)

| # | Token | Onde vive | Duração | Propósito |
|---|---|---|---|---|
| 1 | Google Authorization Code | URL (efêmero) | ~5 min | Trocar por tokens do Google |
| 2 | Google ID Token | Memória do Go (nunca salvo) | ~1 hora | Extrair email, nome, avatar |
| 3 | **Kalidash JWT Access** | Memória do PWA (variável JS) | 15 min | Autenticar requests no Go |
| 4 | **Kalidash Refresh Token** | Cookie `httpOnly; Secure; SameSite=Strict` | 7 dias | Renovar o Access Token |
| 5 | Publishable API Key | HTML do connect.js | Permanente | Identificar projeto na ingestão |
| 6 | AES-256 Encryption Key | Variável de ambiente na VPS | Fixa | Criptografar PII no banco |

**O que foi eliminado com Google OAuth:**
- ❌ Senha do usuário (bcrypt) — Google cuida
- ❌ TOTP / 2FA — Google Workspace já impõe
- ❌ Fluxo de "Esqueci minha senha" — não existe mais
- ❌ Verificação de email — Google já verificou

---

## Configuração no Google Cloud Console (Passo a Passo)

```
1. Acessar console.cloud.google.com
2. Criar projeto "Kalidash"
3. APIs & Services > Credentials > Create OAuth Client ID
4. Application type: Web Application
5. Authorized redirect URIs:
   - https://api.kalidash.com/auth/google/callback    (produção)
   - http://localhost:8080/auth/google/callback        (desenvolvimento)
6. Copiar CLIENT_ID e CLIENT_SECRET
7. Salvar como variáveis de ambiente na VPS:
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxx

Custo: $0 (OAuth é gratuito no Google Cloud, sem billing obrigatório)
```

---

## Bibliotecas no Go (todas gratuitas)

| Pacote | Função | Licença |
|---|---|---|
| `golang.org/x/oauth2` | Fluxo OAuth 2.0 completo | BSD |
| `coreos/go-oidc` | Verificação e decodificação do ID Token | Apache 2.0 |
| `golang-jwt/jwt/v5` | Emissão e validação dos nossos JWTs | MIT |

---

## Problemas Antecipados

**1. Primeiro login do Admin (chicken-and-egg)**
- *Problema:* Quem cadastra a equipe se ninguém tem acesso ainda?
- *Solução:* Rota especial `POST /auth/setup` que só funciona se a tabela
  `team_members` estiver vazia. O primeiro usuário do domínio da Kalidash que
  logar via Google se torna automaticamente o Admin.

**2. Funcionário muda de email no Google Workspace**
- *Problema:* Se o admin do Workspace mudar o email de carol@ para carolina@,
  o login com o email antigo falharia.
- *Solução:* Usamos `google_sub` (ID fixo) como chave primária de identidade,
  não o email. O email é atualizado silenciosamente a cada login.

**3. Pessoa da equipe sem e-mail do Workspace (Gmail pessoal)**
- *Problema:* Alguém de fora do domínio da Kalidash (ex.: um freelancer) precisa
  de acesso e só tem gmail.com.
- *Solução:* O convite passa a ser por e-mail exato, sem depender do filtro
  `hd=`. Como o login só entra se o e-mail estiver em `team_members`, o risco
  continua controlado.

**4. Sessão expirada durante uso do Kanban**
- *Problema:* O vendedor está arrastando cards e o JWT de 15min expira.
- *Solução:* O PWA tem um interceptor Axios/Fetch que, ao receber 401,
  automaticamente chama `POST /auth/refresh` (usando o cookie httpOnly),
  recebe um novo Access Token, e re-envia a requisição original sem
  o usuário perceber. Experiência transparente.

---

## Implementação (WP1, 18/10/2026)

Código: `apps/api/auth_store.go` (tabelas, equipe, sessões, bootstrap), `auth_google.go` (OAuth, `/auth/*`, `/api/team`), `auth_middleware.go` (cookie, CORS, **tabela única de acesso por rota**), `auth_rules.go` (regras que dependem do conteúdo); admin: `lib/auth.ts`, `pages/Login.tsx`, `lib/teamSync.ts`, `lib/roles.ts`. Tudo atrás de **`AUTH_API=1`** (desligada por padrão). Com a flag desligada nada muda: sem tabelas novas, sem middleware, CORS `*` e API aberta, como antes.

### O que diverge do desenho acima (e por quê)

| Desenho | Implementado | Motivo |
|---|---|---|
| JWT de 15 min + refresh token em cookie | **Sessão opaca** em cookie `kld_session` (`HttpOnly`, `Secure`, `SameSite=Lax`), **7 dias com renovação** (cada uso depois da metade do prazo estende de novo; 7 dias sem uso e expira). No banco (`AuthSession`) fica só o HMAC-SHA256 do token (chave `SESSION_SECRET`) | Perfil e desativação valem **na hora** (cada requisição relê o membro) e o logout revoga de verdade; sem interceptor de refresh. Custa uma consulta por requisição, irrelevante nesta escala |
| `access_token` na URL e na memória do PWA | Nada de token no JavaScript | O cookie `HttpOnly` não é lido por XSS |
| Tabelas `team_members` e `sessions` | **`TeamMember`** e **`AuthSession`** (nomes no padrão das demais tabelas; ver `apps/studio/prisma/schema.prisma`) | `User` do Prisma segue como dono de oportunidades do protótipo |
| `POST /auth/setup` (1º a logar vira Admin) | **`AUTH_ROOT_ADMIN`**: o Admin raiz (rootDev) é definido no `.env`, garantido a cada subida e protegido na tela (decidido pelo PO em 18/10; antes se chamava `AUTH_BOOTSTRAP_ADMIN`, que ainda funciona) | Entrar por qualquer conta do domínio e virar Admin é arriscado; o e-mail é escolhido por quem sobe o servidor |
| `RequireRole` por rota | `routeAccess` (uma tabela) + `auth_rules.go` | Uma única fonte da política, testada em `auth_test.go` |
| Equipe só para o Admin | `GET /api/team` para **qualquer pessoa logada**; escrever é só Admin | A lista (nome, e-mail, perfil) alimenta os seletores de responsável de todas as telas |
| id_token verificado com `go-oidc` | Lido sem checar a assinatura, **só** por vir direto do endpoint de token do Google (TLS, com `client_secret`); conferimos `iss`, `aud`, `exp`, `email_verified` e, se houver, `hd` | OIDC Core §3.1.3.7; evita dependências novas |
| `golang.org/x/oauth2`, `jwt` | Nenhuma dependência nova | Troca de código em ~40 linhas de `net/http` |

### Rotas

| Rota | Acesso | Observação |
|---|---|---|
| `GET /auth/google/login`, `GET /auth/google/callback` | público | `state` aleatório em cookie assinado (HMAC) + parâmetro; só entra quem está em `TeamMember` e ativo, senão `403` |
| `POST /auth/logout`, `GET /auth/me` | cookie | `/auth/me` devolve `401` com as formas de entrar disponíveis |
| `POST /auth/dev/login` | só com `AUTH_DEV_LOGIN=1`, do próprio computador, e-mail já na equipe | Entrada de desenvolvimento sem Google. `404` fora disso |
| `POST /api/public/leads` | **público** | Captura dos formulários das LPs; tem origem permitida, limite por IP e honeypot próprios |
| `GET /api/blog/article`, `GET /api/blog/settings`, `GET /api/blog/articles?published=true` | **público** | O site (Next) lê artigo publicado e textos da galeria sem login. Rascunhos e escrita exigem sessão |
| `/api/revalidate` | — | **Não é da API**: é do site (Next); a API é quem o chama (`revalidate.go`) |
| `GET /api/team` | qualquer logado | |
| `POST/PUT/DELETE /api/team…` | Admin | `DELETE` desativa; ninguém muda o próprio acesso; o último Admin não sai |
| `/api/blog/*` (menos as públicas) | Admin e Gerente | |
| `POST/PUT/DELETE /api/pipelines…` | Admin e Gerente | `managePipelines` |
| `GET /api/crm/people/{id}/document` | Admin e Gerente | `revealCpf` |
| `PUT/POST /api/crm/people` com CPF novo | Admin e Gerente | o CPF mascarado que a API devolve pode ser reenviado por qualquer um |
| `PUT /api/crm/leads/{id}` trocando origem ou fonte | Admin e Gerente | `editOrigin` |
| todo o resto de `/api/*` | qualquer logado | |

Outras decisões: o **autor do histórico** (`ChangeLog.actor`) passa a ser o nome da sessão, não o que o cliente envia; escritas com `Origin` fora de `ALLOWED_ORIGINS` recebem `403` (anti-CSRF além do `SameSite`); o CORS reflete só origens da lista, com credenciais, nunca `*`, e a API **recusa subir** com `AUTH_API=1` sem `SESSION_SECRET` (32+), `ALLOWED_ORIGINS` e (sem `AUTH_DEV_LOGIN`) `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URL`, `ADMIN_URL`.

### Fora do escopo do WP1 (continua pendente)

- Vendedor ver **só as oportunidades atribuídas a ele** (filtro por responsável na API): a matriz de `permissions.ts` não tem essa regra e o dono da oportunidade hoje é um texto livre.
- `AuditLog` genérico de segurança (login, convite, troca de perfil): hoje vai para o log do servidor (`AUTH: …`), não para uma tabela.
- Limite de tentativas em `/auth/*` (o Google já faz o trabalho pesado) e rotação do `SESSION_SECRET` sem derrubar sessões.

### Ligar em produção (ordem)

1. Backup do banco. 2. Google Cloud: criar o OAuth Client ID (tipo Aplicativo da Web) com a URL de redirecionamento `https://<api>/auth/google/callback`. 3. Definir as variáveis (ver `.env.example`), com `AUTH_ROOT_ADMIN` = e-mail do Admin raiz. 4. Admin e API no **mesmo site** (ex.: `admin.` e `api.` do mesmo domínio), senão o navegador não manda o cookie. 5. Subir a API; entrar com a conta do primeiro Admin; convidar o resto em Configurações → Equipe. 6. Manter `AUTH_ROOT_ADMIN` (restaura a conta raiz a cada subida). Nunca `AUTH_DEV_LOGIN` nem `AUTH_COOKIE_INSECURE` em produção.
