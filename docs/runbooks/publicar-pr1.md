# Roteiro: publicar o PR 1

> Para quem vai publicar. **Nada aqui foi executado em produção.** Situação conferida em 27/11/2026, sem autenticar.
> PR: https://github.com/tzolkin-collab/Kalidash_Site/pull/1 (sem conflito com a `main` em 27/11).
> Backup, variáveis antigas e login: ver [`ligar-em-producao.md`](./ligar-em-producao.md).

## Como está hoje

| Peça | Situação |
|---|---|
| API (`systembots-apika.rzkso2.easypanel.host`) | Versão antiga (sem as rotas do MCP OAuth e dos links curtos). Login ligado, `connect.js` no ar |
| Site (`www.kalidash.com`) e admin (`kalidash-site-admin.vercel.app`) | Commit `47f57d1` |
| Admin: `VITE_API_URL` | o próprio endereço do admin (as rotas `/api` e `/auth` são repassadas à API) |
| Admin: `VITE_SITE_URL` | `https://kalidash-site-one.vercel.app` (precisa mudar, passo 3) |

## 0. Antes de começar

- [x] **Tela de autorização de agentes** (`/autorizar-agente` respondia 404 no admin publicado): corrigida neste PR com uma regra em `apps/admin/vercel.json`. Conferir depois de publicar (passo 6).
- [ ] **Confirmar no EasyPanel** de qual repositório e branch a API é construída e se publica sozinha a cada push na `main`. 🟡 Não conferido. Se publicar sozinha, os passos 4 e 5 acontecem juntos: faça backup e variáveis antes de mesclar.
- [ ] Avisar a equipe: o admin ganha as áreas **Analytics** e **Tráfego**.

## 1. Backup do banco

Obrigatório: a API nova altera o esquema ao subir. Siga a seção 2 do [`ligar-em-producao.md`](./ligar-em-producao.md), **incluindo o teste de restauração**.

O que a subida cria ou altera:

- tabelas novas: `Tag`, `ArticleSlugHistory`, `CampaignLink`, `Creative`, `McpOAuthClient`, `McpOAuthCode`, `McpOAuthGrant`;
- só com `EMAIL_AUTOMATIONS=1`: `EmailTemplate`, `EmailAutomation`, `EmailJob`, `NewsletterEdition`;
- colunas novas: `Task.status` (preenche as tarefas já concluídas) e campos de SEO em `Article`;
- `ConnectedProject.mediaConversions` **já existe** no banco (criada pela API local);
- a API também alinha a collation das tabelas que ela mesma criou.

## 2. Variáveis da API (EasyPanel, antes do deploy)

Digite direto no painel. Nunca em chat ou no repositório.

| Variável | Valor | Obrigatória? |
|---|---|---|
| `PUBLIC_API_URL` | `https://systembots-apika.rzkso2.easypanel.host` | sim, para o MCP |
| `ADMIN_URL` | `https://kalidash-site-admin.vercel.app` | conferir (o login já a usa) |
| `META_ADS_ACCESS_TOKEN` | token **só com `ads_read`** (gerar um novo; o de teste também altera campanhas) | para Tráfego pago |
| `META_AD_ACCOUNT_ID` | número da conta de anúncios | para Tráfego pago |
| `OFFLINE_CONVERSIONS` | `0` na primeira subida | recomendado, ver abaixo |
| `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` | conferir se já existem | para conversões pelo servidor |
| `EMAIL_AUTOMATIONS` | `1` só quando quiser ligar e-mails e newsletter | opcional |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_NEWSLETTER_SEGMENT_ID`, `RESEND_MATERIAL_SEGMENT_ID`, `RESEND_TEST_SEGMENT_ID`, `EMAIL_REPLY_TO` | com `EMAIL_AUTOMATIONS=1` | opcional |
| `GOOGLE_ADS_*` | ver `apps/api/.env.example` | opcional |

⚠️ **Conversões offline vêm ligadas.** Com as chaves da Meta e do GA4 presentes, qualificar ou ganhar um lead passa a enviar evento para as plataformas. Comece com `0`, confira e depois remova.

Nunca em produção: `AUTH_DEV_LOGIN`, `AUTH_COOKIE_INSECURE`, `VITE_SEED_DEMO`.

## 3. Variáveis da Vercel (antes de mesclar: entram na hora do build)

| Projeto | Variável | Valor |
|---|---|---|
| admin | `VITE_SITE_URL` | `https://www.kalidash.com` (hoje aponta para o endereço `.vercel.app`; é o domínio dos links curtos) |
| site | `NEXT_PUBLIC_CLARITY_PROJECT_ID` | ID do projeto no Clarity |
| site | `NEXT_PUBLIC_ADMIN_ORIGINS` | conferir se inclui o endereço do admin (pré-visualização do blog) |

Em 27/11, `kalidash.com` respondeu e `kalidash.com.br` não respondeu por HTTPS: não use o `.com.br` nos links.

## 4. Publicar a API

1. No EasyPanel, publique a API a partir do branch `TzolkinClaudeAgent/local-testing-setup-24d09b` (ou da `main` logo após o merge, se for automático).
2. No log, não pode haver `❌`. Devem aparecer o MCP com OAuth pronto e, com as chaves, `Investimento em mídia: Meta ligado`.
3. Confira (somente leitura):

```powershell
curl.exe -s -o NUL -w "%{http_code}" https://systembots-apika.rzkso2.easypanel.host/.well-known/oauth-authorization-server
```
Esperado `200` (hoje `404`).

```powershell
curl.exe -s -o NUL -w "%{http_code}" https://systembots-apika.rzkso2.easypanel.host/api/public/links/naoexiste
```
Esperado `404` (hoje `401`).

```powershell
curl.exe -s -o NUL -w "%{http_code}" https://systembots-apika.rzkso2.easypanel.host/api/blog/creatives
```
Esperado `401`.

4. Abra o admin **atual** e confira Leads, Oportunidades e Blog. 🟡 A API nova com o admin antigo não foi testada; se algo falhar, volte a API (passo 7).

## 5. Mesclar o PR

Mescle o PR 1 na `main`. A Vercel publica site e admin. Acompanhe até os dois ficarem prontos.

## 6. Conferir no ar

- [ ] Home e `/blog` abrem; o selo da Anthropic continua o novo.
- [ ] `https://kalidash-site-admin.vercel.app/autorizar-agente` responde `200`.
- [ ] Login no admin com Google.
- [ ] **Analytics** abre sem erro em todas as abas.
- [ ] **Tráfego > Pago** mostra "Meta · lido às …" e **não** o selo "Dados de exemplo".
- [ ] **Tráfego > Orgânico**: criar um criativo de teste, abrir o link `https://www.kalidash.com/l/<código>` e ver o clique; arquivar depois.
- [ ] Qualificar um lead que tenha requisito pendente cria a tarefa.
- [ ] Projetos conectados: ligar **Conversões de mídia** nas LPs da própria Kalidash (vem desligado).
- [ ] Anúncios novos com o padrão de UTM de [`../tracking.md`](../tracking.md).
- [ ] MCP: conectar um agente de verdade e conferir o endereço na tela de autorização (nunca testado com provedor real).

## 7. Voltar atrás

| O quê | Como |
|---|---|
| Site ou admin | Vercel > Deployments > versão `47f57d1` > *Promote to Production* |
| API | EasyPanel > publicar o commit anterior. Tabelas e colunas novas ficam e não atrapalham 🟡 |
| E-mails | remover `EMAIL_AUTOMATIONS` e reiniciar |
| Conversões offline | `OFFLINE_CONVERSIONS=0` |
| Dados corrompidos | restaurar o backup (perde o que entrou depois) |

## Riscos conhecidos que vão junto

- Os limites por IP confiam no primeiro `X-Forwarded-For`: o proxy precisa sobrescrever esse cabeçalho.
- O favicon da conta é buscado no domínio informado pelo lead, a partir do navegador da equipe.
- Vendas feitas fora do CRM (checkout externo) não entram no faturamento nem no ROAS.
- A revisão não cobriu o PR inteiro (editor de e-mail, newsletter, blog e dashboard).
