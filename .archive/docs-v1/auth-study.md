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
-- Contas (empresas/clientes que usam o Kalidash)
CREATE TABLE accounts (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    workspace_domain VARCHAR(255),               -- "kalidash.com" (domínio do Google Workspace)
    plan            ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Membros da equipe (login via Google OAuth)
CREATE TABLE team_members (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id      BIGINT UNSIGNED NOT NULL,
    google_sub      VARCHAR(50) NOT NULL UNIQUE,  -- ID fixo do Google (nunca muda)
    email           VARCHAR(254) NOT NULL UNIQUE,
    name            VARCHAR(200),
    avatar_url      VARCHAR(500),                 -- Foto do Google
    role            ENUM('owner', 'admin', 'manager', 'seller') NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   DATETIME NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_account (account_id),
    INDEX idx_google_sub (google_sub),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
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
- ❌ Removido `password_hash` da tabela `accounts` — não gerenciamos mais senhas
- ❌ Removido qualquer lógica de TOTP/2FA — Google Workspace já impõe
- ✅ Adicionado `google_sub` — identificador fixo do Google (mais seguro que email, que pode mudar)
- ✅ Adicionado `team_members` — cada pessoa tem seu próprio registro com role
- ✅ Adicionado `sessions` — controle de onde cada pessoa está logada

---

## Cadastro e Gestão da Equipe

### Fluxo de Convite de Novo Membro

```
Owner (no painel admin)
    │
    ├─ 1. Vai em Configurações > Equipe > "Convidar Membro"
    ├─ 2. Digita: carol@kalidash.com | Role: Manager
    │
    ▼
Backend Go
    │
    ├─ 3. Verifica se o email tem o domínio do Workspace da conta
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
Owner
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

| Role | Dashboard | CRM | Projetos | Blog | Webhooks | Equipe | Financeiro |
|---|---|---|---|---|---|---|---|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (não pode remover owner) | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 👁️ (somente leitura) |
| **Seller** | ✅ (só seus leads) | ✅ (só leads atribuídos) | ❌ | ❌ | ❌ | ❌ | ❌ |

### Como funciona no Go (Middleware)

```go
// Middleware de autorização por role
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        claims := c.MustGet("jwt_claims").(JWTClaims)

        for _, role := range allowedRoles {
            if claims.Role == role {
                c.Next()
                return
            }
        }

        c.JSON(403, gin.H{"error": "Permissão insuficiente"})
        c.Abort()
    }
}

// Uso nas rotas:
api.GET("/team", RequireRole("owner", "admin"), listTeam)
api.GET("/financial", RequireRole("owner", "admin", "manager"), getFinancial)
api.GET("/leads", RequireRole("owner", "admin", "manager", "seller"), listLeads)
```

### O JWT do Kalidash contém:

```json
{
  "sub": "42",                    // team_member.id
  "account_id": "1",             // account.id
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

**1. Primeiro login do Owner (chicken-and-egg)**
- *Problema:* Quem cria a conta se ninguém tem acesso ainda?
- *Solução:* Rota especial `POST /auth/setup` que só funciona se a tabela
  `accounts` estiver vazia. O primeiro usuário que logar via Google se
  torna automaticamente o Owner.

**2. Funcionário muda de email no Google Workspace**
- *Problema:* Se o admin do Workspace mudar o email de carol@ para carolina@,
  o login com o email antigo falharia.
- *Solução:* Usamos `google_sub` (ID fixo) como chave primária de identidade,
  não o email. O email é atualizado silenciosamente a cada login.

**3. Empresa sem Google Workspace (Gmail pessoal)**
- *Problema:* Um cliente pequeno usa gmail.com, não tem domínio próprio.
- *Solução:* Aceitar login Google genérico (sem filtro `hd=`), mas o convite
  de equipe passa a ser por email exato em vez de domínio. Funciona igual,
  apenas sem a restrição automática de domínio.

**4. Sessão expirada durante uso do Kanban**
- *Problema:* O vendedor está arrastando cards e o JWT de 15min expira.
- *Solução:* O PWA tem um interceptor Axios/Fetch que, ao receber 401,
  automaticamente chama `POST /auth/refresh` (usando o cookie httpOnly),
  recebe um novo Access Token, e re-envia a requisição original sem
  o usuário perceber. Experiência transparente.
