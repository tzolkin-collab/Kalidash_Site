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

## 5. DSN e senha do banco

1. O DSN **não deve ter `loc=`** (a API lê datas como UTC; `loc=Local` com servidor fora do UTC desloca as datas, ver WP-B). Com ou sem `parseTime=true` a API funciona desde o WP-B. Formas válidas: `usuario:SENHA@tcp(host:3306)/kalidash` ou `...kalidash?parseTime=true`.
2. Para conferir sem expor a senha: no EasyPanel abra `DSN` e olhe só o trecho depois do `?`.
3. **Trocar a senha do banco** (a atual está em arquivos locais: `apps/api/.env`, `scratch/reseed_blog.js`, `apps/api/scripts/test.go`; e o banco é acessível de fora):
   1. No painel do banco, defina uma senha nova (ou crie um usuário só para a API).
   2. Atualize `DSN` no EasyPanel e reinicie a API; o log deve mostrar `✅ Banco de Dados conectado`.
   3. Atualize seu `.env` local e **apague** a credencial antiga de `scripts/test.go` e `scratch/reseed_blog.js` (são arquivos locais; confirme com `git status` que não estão no repositório).
   4. ⚠️ Se possível, restrinja o acesso externo ao banco ao IP da VPS.

## 6. Google Cloud (login)

1. console.cloud.google.com → seu projeto → *APIs e serviços* → *Tela de consentimento OAuth*: **Interno** se a Kalidash tem Google Workspace (só o domínio entra); senão **Externo** + usuários de teste. Escopos: `openid`, `email`, `profile` (não exigem verificação do app).
2. *Credenciais* → *Criar credenciais* → *ID do cliente OAuth* → tipo **Aplicativo da Web**.
3. *URIs de redirecionamento autorizados*: exatamente `https://API/auth/google/callback`, igual a `GOOGLE_REDIRECT_URL`. Para teste local com Google, acrescente `http://localhost:8080/auth/google/callback`.
4. *Domínio autorizado*: o da API (e o do admin, se a tela pedir).
5. Copie ID e segredo para as variáveis da API (§3), nunca para o repositório.
6. `AUTH_ROOT_ADMIN=<e-mail Google do primeiro Admin>` ⚠️ (Gustavo ou Carol). A conta é criada na primeira subida e reativada como Admin a cada subida; pela tela ninguém a rebaixa. O resto da equipe é convidado em Configurações → Equipe (e-mail exato).
7. Opcional: `GOOGLE_HD=<domínio Workspace>` para aceitar só esse domínio.

## 7. Ordem de ligar as flags

**Regra do cookie:** admin e API precisam estar no **mesmo site** (ex.: `admin.kalidash.com` e `api.kalidash.com`). O cookie é `HttpOnly`, `Secure`, `SameSite=Lax`; com o admin em `*.vercel.app` e a API em outro domínio, o navegador **não envia** a sessão. ⚠️ Defina o domínio do admin antes do passo 7.1. Atrás do proxy (EasyPanel/Traefik), ele precisa sobrescrever `X-Forwarded-For`.

Para **cada** passo: (1) backup novo (§2); (2) ajustar a variável e reiniciar; (3) ler o log; (4) smoke test; (5) só então o próximo. Nos `curl`, defina antes: `API=https://API`.

### 7.1 `AUTH_API=1` (primeiro: é o que fecha a API)

- Variáveis: `AUTH_API=1`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS` (admin **e** site), `AUTH_ROOT_ADMIN`.
- **O que muda:** cria `TeamMember`, `AuthSession` e as tabelas de escopos/tokens; `/api/*` passa a exigir sessão (401), exceto `POST /api/public/leads`, `/api/connect/*` (têm autenticação própria), leitura pública de artigos publicados e `/api/revalidate`; o CORS deixa de ser `*`; `/api/emails/send` passa a exigir sessão. Quem chamava a API sem navegador passa a receber 401 (o site só usa as leituras públicas do blog).
- Log esperado: `✅ Login e perfis prontos (AUTH_API=1)`.
- Smoke (curl):

```bash
curl -s -o /dev/null -w "%{http_code}\n" $API/api/leads
```
  Esperado `401`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" $API/auth/google/login
```
  Esperado `302` (para o Google).

  Leitura pública do blog: abra o site e confira que `/blog` ainda carrega. 🟡 caminho exato da rota de leitura pública a conferir em `apps/site/src/lib/blog.ts`.
- Smoke (telas): `https://ADMIN` mostra a tela de login → entrar com o `AUTH_ROOT_ADMIN` → seu nome no topo → Configurações → Equipe mostra a conta marcada "raiz". Convide uma segunda conta como Vendedor e entre com ela: o Blog deve estar bloqueado (403 no servidor). Configurações → Permissões lista a equipe com o preset do perfil.
- Atenção: um 401 no admin troca o app pela tela de login; edição não sincronizada se perde.

### 7.2 `WORKFLOW_API=1`

- **O que muda:** cria `Pipeline`, `PipelineStage`, `StageRequirement`, `Task`; libera `/api/pipelines`, `/api/tasks`, `/api/gate/check`; o gate de etapa passa a valer no servidor.
- Smoke (curl): sem sessão, `curl -s -o /dev/null -w "%{http_code}\n" $API/api/pipelines` deve dar `401` (e `404` significaria a flag desligada).
- Smoke (telas): Tarefas → criar tarefa; Oportunidades → mover um card (o gate bloqueia se faltar requisito); o sino mostra a notificação.

### 7.3 `CRM_API=1` (por último)

- Antes: `DATA_KEY` gerada e guardada em dois lugares (§4).
- **O que muda:** `ADD COLUMN` em `Contact` e `Company` (nada é alterado), cria `CompanyStakeholder`, `Lead`, `ChangeLog`; libera `/api/crm/*`. Com `AUTH_API=1` também liga `connect.js`/`/api/connect/*` e cria `ConnectedProject`, `TrackedForm` e colunas em `ApiToken`.
- Smoke (telas): Leads, Pessoas & Empresas e Clientes abrem sem o aviso de "dados de exemplo"; criar uma pessoa **com CPF** e reabrir (CPF legível = `DATA_KEY` ok; Admin vê, Vendedor não); o histórico mostra a alteração.
- Smoke do token e do `connect.js` (WP2):
  1. Configurações → Tokens de API (ou Projetos → Chaves): emitir chave `kld_test_`; o segredo aparece **uma vez**, copie para o cofre.
  2. Projetos → Conectar projeto: URL exata da LP (e `www`, se houver), funil/coluna dos leads, seletor do formulário.
  3. Teste direto (🟡 formato do corpo conforme `docs/inbound-leads.md` §3; ajuste os campos):

```bash
curl -s -X POST $API/api/connect/leads -H "Authorization: Bearer kld_test_SUACHAVE" -H "Origin: https://URL-DA-LP" -H "Content-Type: application/json" -d '{"name":"Teste Runbook","email":"teste@example.com"}'
```
  4. O lead aparece em Leads (com a tag *Teste*). Só depois emita a chave `kld_live_`. Revogar uma chave vale na hora.
  5. `curl -s -o /dev/null -w "%{http_code}\n" $API/connect.js` deve dar `200`.
- **A confirmar após o WP3b:** captura pública criando Lead v2, vínculos de contato/empresa/responsável, escopo "Vendedor vê só o que é dele" (`leads:own`) e Dashboard com leads/tarefas.

## 8. CORS, Vercel Authentication e formulário do site

1. `ALLOWED_ORIGINS` na API deve conter a origem do **site** (`https://SITE` e o domínio final) **e** a do **admin**. O valor antigo tinha só o admin e fazia a API responder 403 ao formulário. `https://*.vercel.app` libera todas as prévias da Vercel; use só se aceitar isso.
2. **Vercel Authentication** (projeto do admin → Settings → Deployment Protection): serve de stopgap **enquanto `AUTH_API` não estiver ligada** (protege a tela, não a API). Depois do §7.1 ⚠️ decida se mantém; 🟡 pode atrapalhar o retorno do login do Google, teste.
3. **`NEXT_PUBLIC_LEAD_ENDPOINT`** (projeto do site na Vercel) = `https://API/api/public/leads`, seguido de redeploy do site.
   - ⚠️ **BLOQUEIO: não ligar com tráfego real** até o WP3b migrar a captura para Lead v2 (D6). Hoje cada envio cria contato + Oportunidade INBOUND; o destino dos que já entraram (converter ou conviver) é decisão pendente do PO. **A confirmar após o WP3b.**
   - Para testar antes disso, use só um envio manual seu e depois apague o registro.
4. Para as LPs da Kalidash, o caminho novo é o `connect.js` (§7.3), não o endpoint acima.

## 9. R2 (upload de imagem do blog e vídeos de depoimento)

O mesmo R2 (a Kalidash tem R2/S3) atende o upload de imagem do blog e, conforme a decisão do PO, os vídeos de depoimento.

Resumo do upload do blog: criar o bucket (`kalidash-blog`), criar o token **Object Read & Write restrito ao bucket**, liberar leitura pública (domínio próprio recomendado; `r2.dev` só para teste), definir as 5 variáveis `R2_*` na API (§3), reiniciar e procurar `✅ Cloudflare R2 configurado` no log. Teste: subir uma capa no admin, abrir a URL em aba anônima, confirmar que SVG é recusado. Sem as variáveis, só a rota de upload responde 503; o resto da API funciona.

Passo a passo e verificação completos: [`docs/r2-setup.md`](../r2-setup.md). Com `AUTH_API=1` a rota de upload passa a exigir sessão.

🟡 HIPÓTESE: o fluxo de upload dos vídeos de depoimento (limite de tamanho, bucket separado) não existe no código lido (a rota atual aceita só JPEG/PNG/GIF/WebP até 8 MB); definir antes de usar.

## 10. Retenção do IP no histórico (LGPD)

- O histórico (`ChangeLog`) guarda o IP de quem alterou. ⚠️ **Recomendação: reter o IP por 90 dias** e depois anulá-lo, mantendo o registro da alteração. Ajuste se o jurídico pedir outro prazo e declare o prazo na política de privacidade.
- 🟡 HIPÓTESE: não encontrei no código nenhum job que apague o IP, nem confirmei o nome da coluna. Confira primeiro:

```sql
SHOW COLUMNS FROM ChangeLog;
```

- Com os nomes reais (abaixo supõe `ip` e `createdAt`), rode uma vez por mês, manualmente ou por agendamento do provedor, **depois de um backup**:

```sql
UPDATE ChangeLog SET ip = NULL WHERE createdAt < NOW() - INTERVAL 90 DAY AND ip IS NOT NULL;
```

- Um job automático dentro da API seria trabalho novo (não existe hoje). O IP de sessão (`AuthSession`) e o de tokens ("último uso") também são dados pessoais: 🟡 verifique se entram no mesmo prazo.

## 11. Rollback

Regra geral: desligar a flag e reiniciar. Tabelas e colunas criadas **ficam** (só `CREATE TABLE IF NOT EXISTS`/`ADD COLUMN`, inofensivas) e os dados gravados também.

| O que | Como reverter | Efeito |
|---|---|---|
| `CRM_API` | esvaziar a variável e reiniciar | `/api/crm/*` e `connect` somem (404); as telas voltam ao exemplo. **Mantenha a `DATA_KEY`** |
| `WORKFLOW_API` | idem | funis/tarefas somem; o gate deixa de valer |
| `AUTH_API` | idem | ⚠️ **a API volta a ficar aberta, CORS `*`**: só em emergência, e reative a Vercel Authentication no admin |
| Deploy da API | EasyPanel → redeploy do commit/imagem anterior | — |
| Deploy do admin ou site | Vercel → Deployments → versão anterior → *Promote to Production* | — |
| Dados corrompidos | restaurar o dump do §2 | **perde o que entrou depois**; último recurso |
| Perdeu o acesso ao admin | reiniciar a API: o `AUTH_ROOT_ADMIN` volta a ser Admin ativo | — |
| Chave ou token vazado | Admin → revogar (vale na hora) | leads criados trazem `tokenId`/`via` para filtrar |

## 12. Checklist final de "pronto" e monitoramento

- [ ] Backup feito **e restauração testada** (§2), cópia fora do servidor
- [ ] `DATA_KEY` e `SESSION_SECRET` no cofre (a primeira em dois lugares)
- [ ] Senha do banco trocada; credencial removida dos arquivos locais
- [ ] DSN sem `loc=`
- [ ] Docker/MySQL real: WP3a rodado ⚠️ (bloqueio)
- [ ] Login Google funciona; Admin raiz entra; Vendedor de teste leva 403 no Blog
- [ ] `/api/leads` sem login = 401; blog público do site carregando
- [ ] Funis/tarefas e CRM sem aviso de exemplo; CPF grava e lê
- [ ] LP de teste com `kld_test_` cria lead; a chave `kld_live_` só depois
- [ ] `ALLOWED_ORIGINS` correta; `NEXT_PUBLIC_LEAD_ENDPOINT` **não** ligado (bloqueio WP3b)
- [ ] R2 funcionando, se usado; prazo de retenção do IP decidido ⚠️
- [ ] `AUTH_DEV_LOGIN` e `AUTH_COOKIE_INSECURE` não definidas

**Primeiros dias:** log da API (procure `❌`, `Erro`, picos de 401/403/429/500); lista de Leads (duplicatas, leads de teste); se cada membro consegue entrar; tokens com "último uso" inesperado; datas das oportunidades (B-D1) e CPF ilegível; e-mail de teste (exige `RESEND_API_KEY`; sem domínio verificado o Resend só entrega ao dono da conta); backup diário na primeira semana.

## Pendências

- ⚠️ Decisões: domínio do admin (mesmo site da API), quem é o `AUTH_ROOT_ADMIN`, prazo do IP, manter ou não a Vercel Authentication, destino dos leads INBOUND já criados, vídeos de depoimento no R2.
- Bloqueios: Docker/WP3a (MySQL real) e WP3b (Lead v2 na captura pública).
- 🟡 A conferir: variável da URL da API no admin, rota de leitura pública do blog, formato do corpo do `connect`, nome das colunas de IP.
- A confirmar após o WP3b: captura pública, vínculos de contato/empresa/responsável, `leads:own`, Dashboard.

