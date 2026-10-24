# Runbook — ligar o admin/CRM em produção (WP3c)

> Para o Gustavo executar. **Nada aqui foi executado contra produção.** Legenda: ⚠️ depende de decisão do PO ou do Gustavo · 🟡 HIPÓTESE (não confirmado no código) · "a confirmar após o WP3b" = o WP3b altera o núcleo em paralelo.
> Fontes: `docs/po/admin-checklist.md`, relatórios WP0/WP1/WP1.1/WP-B/WP2, handoff de 14/10, `docs/r2-setup.md`, `apps/api/.env.example` e o código que lê cada variável (`os.Getenv` em `apps/api`).

## 1. Pré-condições e quem faz o quê

| Quem | O quê |
|---|---|
| Gustavo | executa tudo; tem acesso ao EasyPanel (API), Vercel (admin e site), painel do banco, Google Cloud e Cloudflare |
| Gustavo ⚠️ | decide o domínio do admin e da API (mesmo site, ver §7) e quem é o `AUTH_ROOT_ADMIN` |
| PO | decide os itens ⚠️ e confere o resultado |
| Claude | não executa nada em produção |

Antes de começar:
- [ ] Você sabe a URL pública da API (`https://API`) e a do admin (`https://ADMIN`).
- [ ] Nenhuma API local roda com o `.env` real e flags ligadas (risco R1 do WP0). No PowerShell: `Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue`; se houver processo, encerre.
- [ ] **BLOQUEIO ⚠️ (WP3a):** o Docker **não está instalado** na máquina do Gustavo, então a suíte de integração nunca rodou em MySQL/MariaDB real (só em MySQL em memória). Instale o Docker (ou um MariaDB descartável) e rode o WP3a antes de ligar em produção. Se decidir ligar mesmo assim, a ordem gradual do §7 e o backup do §2 são a única mitigação.
- [ ] **BLOQUEIO ⚠️ (WP3b):** não ligar `NEXT_PUBLIC_LEAD_ENDPOINT` com tráfego real antes de o WP3b migrar a captura pública para Lead v2 (D6). Hoje o formulário do diagnóstico usa `POST /api/public/leads`, que cria Oportunidade INBOUND.

## 2. Backup e teste de restauração (antes de qualquer flag)

1. Tenha o cliente MySQL (`mysqldump`, `mysql`) na sua máquina ou use o terminal do serviço do banco no EasyPanel.
2. Backup (troque os `<...>`; a senha é pedida no prompt, nunca escreva na linha de comando):

```bash
mysqldump -h <HOST> -P <PORTA> -u <USUARIO> -p --single-transaction --routines --triggers <BANCO> > kalidash-$(date +%F).sql
```

```bash
ls -lh kalidash-*.sql
```

3. **Teste de restauração** num banco descartável, **nunca** no de produção:

```bash
mysql -h <HOST> -P <PORTA> -u <USUARIO> -p -e "CREATE DATABASE kalidash_restore_teste"
```

```bash
mysql -h <HOST> -P <PORTA> -u <USUARIO> -p kalidash_restore_teste < kalidash-AAAA-MM-DD.sql
```

```bash
mysql -h <HOST> -P <PORTA> -u <USUARIO> -p kalidash_restore_teste -e "SHOW TABLES; SELECT COUNT(*) FROM Opportunity;"
```

```bash
mysql -h <HOST> -P <PORTA> -u <USUARIO> -p -e "DROP DATABASE kalidash_restore_teste"
```

   As contagens devem bater com as de produção. 🟡 O nome `Opportunity` não foi conferido linha a linha; use o resultado de `SHOW TABLES`.
4. Guarde o `.sql` fora do servidor (cofre privado). **Repita o backup antes de cada flag** (§7).
5. Snapshot automático do provedor ajuda, mas não substitui o teste de restauração.

## 3. Variáveis de ambiente

Nunca no repositório. API: EasyPanel → serviço → Environment (reiniciar depois). Exemplos são placeholders.

### API (`apps/api`)

| Nome | Para que serve | Obrigatória quando | Exemplo | Quem gera |
|---|---|---|---|---|
| `DSN` | conexão MySQL | sempre | `usuario:SENHA@tcp(host:3306)/kalidash` (sem `loc=`, §5) | provedor do banco |
| `PORT` | porta | opcional | `:8080` | — |
| `ALLOWED_ORIGINS` | origens CORS e da captura pública, separadas por vírgula, sem `/` final | sempre em produção; **obrigatória com `AUTH_API=1`** (listar o admin) | `https://ADMIN,https://SITE` | Gustavo |
| `SITE_URL` | origem do site e alvo da revalidação do blog | revalidação | `https://SITE` | Gustavo |
| `REVALIDATE_SECRET` | segredo da revalidação (igual ao do site) | revalidação | 64 hex | gerar (§4) |
| `WORKFLOW_API` | liga funis/tarefas | quando `=1` | `1` | Gustavo |
| `CRM_API` | liga pessoas/empresas/leads/histórico | quando `=1` | `1` | Gustavo |
| `DATA_KEY` | chave do CPF (AES-256-GCM) | `CRM_API=1` e uso de CPF | 64 hex | gerar (§4) |
| `AUTH_API` | login Google, perfis, escopos e tokens | quando `=1` | `1` | Gustavo |
| `SESSION_SECRET` | assina a sessão | `AUTH_API=1` (≥ 32 caracteres) | 64 hex | gerar (§4) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth | `AUTH_API=1` (sem dev login) | `…apps.googleusercontent.com` | Google Cloud (§6) |
| `GOOGLE_REDIRECT_URL` | callback, idêntico ao cadastrado no Google | idem | `https://API/auth/google/callback` | Gustavo |
| `ADMIN_URL` | para onde voltar após o login | idem | `https://ADMIN` | Gustavo |
| `GOOGLE_HD` | aceita só um domínio Workspace | opcional | `kalidash.com` | — |
| `AUTH_ROOT_ADMIN` | Admin raiz, recriado/reativado a cada subida | recomendada ⚠️ | e-mail do Admin | Gustavo decide (`AUTH_BOOTSTRAP_ADMIN` é o nome antigo) |
| `AUTH_DEV_LOGIN`, `AUTH_COOKIE_INSECURE` | só desenvolvimento | **nunca em produção** | vazio | — |
| `CONNECT_RATE_IP`, `CONNECT_RATE_TOKEN`, `CONNECT_RATE_CONFIG` | limites do `connect.js` por minuto (padrão 10/60/60) | opcional | `10` | — |
| `RESEND_API_KEY` | envio de e-mail (`/api/emails/*`) | para enviar e-mail; ⚠️ falta no `.env.example` | `re_xxxx` | Resend |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | upload de imagem (§9) | para upload (senão a rota dá 503) | ver `docs/r2-setup.md` | Cloudflare |
| `R2_ENDPOINT` | storage alternativo (MinIO/testes) | não usar em produção | vazio | — |
| `TEST_DSN` | só testes (`go test`) | nunca em produção | — | — |

Regras vistas no código: com `AUTH_API=1` a API **não sobe** se faltar `SESSION_SECRET` ≥ 32 caracteres, `ALLOWED_ORIGINS`/`SITE_URL` ou (sem dev login) `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URL` e `ADMIN_URL`. As rotas `connect.js` e `/api/connect/*` só existem com `CRM_API=1` **e** `AUTH_API=1`.

### Admin (Vercel)

| Nome | Para que serve | Quem gera |
|---|---|---|
| `VITE_SITE_URL` | URL do site (pré-visualização do blog); já criada | Gustavo |
| URL da API | 🟡 HIPÓTESE: o nome da variável que aponta o admin para a API não foi conferido; procure `import.meta.env` em `apps/admin/src` antes do deploy | Gustavo |

### Site (Vercel)

| Nome | Para que serve | Observação |
|---|---|---|
| `NEXT_PUBLIC_ADMIN_ORIGINS` | origens do admin para a pré-visualização; já criada | — |
| `NEXT_PUBLIC_LEAD_ENDPOINT` | formulário do diagnóstico → `https://API/api/public/leads` | ⚠️ **BLOQUEADO** até o WP3b (§8) |
| `REVALIDATE_SECRET` | igual ao da API | gerar (§4) |

## 4. `DATA_KEY` e `SESSION_SECRET`

Gere (um valor diferente para cada; copie a saída direto para o cofre de senhas e para o EasyPanel, nunca para chat nem para arquivo do repositório):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- **`DATA_KEY`**: 64 caracteres hex (ou base64 de 32 bytes). **Se perder ou trocar, os CPFs já gravados ficam ilegíveis, sem recuperação.** Guarde em **dois** lugares independentes (cofre de senhas + cópia offline) junto com o backup do banco. Sem `DATA_KEY` a API recusa gravar CPF.
- **`SESSION_SECRET`**: trocar só derruba as sessões (todos entram de novo); pode ser rotacionado sem perda de dado.
- `REVALIDATE_SECRET`: mesmo comando; o mesmo valor na API e no site.

<!-- PROXIMA-SECAO -->
