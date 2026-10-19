# Relatório WP1 — Login Google + perfis no servidor

Entregue em 18/10/2026. Tudo atrás de `AUTH_API=1` (desligada por padrão). Nada foi executado contra o banco real nem com o `apps/api/.env`: a API de verificação rodou de uma pasta fora do repositório, sobre um MySQL em memória (go-mysql-server, `127.0.0.1:3307`), e já foi desligada.

## (c) Commits

| Hash | Mensagem |
|---|---|
| `cf65f56` | feat(api): login com Google, sessão por cookie e perfis aplicados no servidor (AUTH_API) |
| `3bb048a` | feat(api): qualquer pessoa logada lê a lista da equipe (escrita segue só Admin) |
| `164f991` | test(api): corrige o id inexistente do teste de perfis |
| `13baba8` | feat(admin): tela de login, rota protegida, usuário real e Equipe na API (AUTH_API) |

(`3bb048a` foi commitado com um teste quebrado por um id que existia no armazenamento em memória; `164f991` corrige. A árvore final está verde.)

## (a) Checklist do WP1

| Item | Estado | Evidência |
|---|---|---|
| `GET /auth/google/login` e `/callback` com `state` anti-CSRF; só e-mail da equipe, senão 403 | ✅ | `TestGoogleLoginConvidadoEntra`, `TestGoogleLoginNegado` (fora da equipe, desativado, e-mail não verificado, `aud`/`iss` errados, token expirado, outra conta Google no mesmo e-mail), `TestGoogleStateAntiCSRF` (sem cookie, state diferente, vazio, cookie com assinatura forjada, `code` recusado, cancelado), `TestGoogleDominioHD`. O Google é um servidor falso (`httptest`). **O fluxo contra o Google de verdade não foi exercitado** (ver "f") |
| Sessão por cookie `HttpOnly`/`Secure`/`SameSite`, logout, expiração | ✅ | `TestCookieDaSessao` (HttpOnly, Secure, Lax, 7 dias), `TestSessaoExpiraELogoutRevoga` (o banco guarda só o HMAC, logout revoga, expirada dá 401). `SameSite=Lax` e não `Strict` porque o callback chega por navegação vinda do Google; o anti-CSRF extra é a checagem de `Origin` em escrita |
| Middleware protege `/api/*`, exceções públicas listadas e justificadas | ✅ | `TestSemSessaoRecebe401` (13 combinações de método e rota, inclusive rascunhos do blog, upload e equipe → 401), `TestRotasPublicasContinuamAbertas`. Tabela única em `routeAccess` (`auth_middleware.go`); lista e motivos em `docs/auth-study.md` |
| Perfis no servidor (CPF, origem do lead, pipelines/fontes/tags/templates) com 403 para Vendedor | ✅ | `TestPerfisNoServidor` (matriz Admin × Gerente × Vendedor em 13 rotas), `TestPerfilEDesativacaoValemNaHora`, `TestRegrasFinasPorConteudo` e, em MySQL, `TestIntegrationAuth`: Vendedor recebe 403 ao criar/trocar CPF novo, revelar CPF, trocar origem **ou fonte** do lead; segue salvando com CPF mascarado e editando outros campos; Gerente faz tudo isso |
| CORS restrito por `ALLOWED_ORIGINS`, sem `*` | ✅ | `TestCORSRestrito` (origem aceita com credenciais; estranha → 403 sem cabeçalho; nunca `*`; preflight; o 401 também leva CORS), `TestAntiCSRFEmEscrita`, `TestValidateAuthConfig` (`ALLOWED_ORIGINS=*` não vira curinga). No navegador: preflights `204` e chamadas com cookie entre `localhost:5174` e `localhost:8090` |
| Admin: login, rota protegida, usuário real, Equipe na API, `permissions.ts` com perfil da sessão | ✅ | Navegador (abaixo) + `npm test` (42/42, inclui `roles.test.ts`), `npm run build` limpo, `tsc -b` limpo |
| Atrás de `AUTH_API=1`, com modo dev sem Google documentado | ✅ | `TestComFlagDesligadaNadaMuda` (CORS segue `*`, regras não agem); navegador com a API sem `/auth/me`: abre direto, sem usuário na barra, Blog visível. Modo dev: `docs/pagesAdmin/settings.md` ("Rodar localmente sem Google"), `TestDevLogin` (404 desligado, fora do loopback ou atrás de proxy; 403 fora da equipe) |
| Nenhum segredo no repo; `.env.example` atualizado | ✅ | `apps/api/.env.example` ganhou `AUTH_API`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URL`, `ADMIN_URL`, `GOOGLE_HD`, `AUTH_BOOTSTRAP_ADMIN`, `AUTH_DEV_LOGIN`, `AUTH_COOKIE_INSECURE` (todos vazios). `.env.local` temporário do admin apagado |
| Testes novos de integração e unidade passando; build limpo | ✅ | `go vet .` limpo. `go test .`: 55 PASS, 4 SKIP (integração sem `TEST_DSN`). Com `TEST_DSN=…@tcp(127.0.0.1:3307)/kalidash_test`: **59 PASS, 0 SKIP**. Admin: `npm test` 42 PASS; `npm run build` ok |
| Lista do que o Gustavo precisa fazer | ✅ | Seção (f) |

### Verificação no navegador (admin em `localhost:5174`, API em `localhost:8090`, MySQL em memória)

1. Sem sessão: tela **Entrar no Kalidash**. E-mail fora da equipe → "Este e-mail não está na equipe." (403 do servidor).
2. Entrada com o Admin criado por `AUTH_BOOTSTRAP_ADMIN`: dashboard abre, bloco do usuário no topo da barra lateral ("Admin") e botão Sair. Rede: `OPTIONS 204` + chamadas com cookie a `/api/pipelines`, `/api/crm/*`, `/api/tasks` → 200.
3. Configurações → Meu perfil mostra a pessoa real; Equipe e acessos lista a equipe da API. **Convidar pessoa** (Vera, Vendedor) pela interface gravou na API e apareceu como "Convite enviado".
4. Sair → volta à tela de entrada. Entrando como Vendedora: **Blog some do menu**, Equipe sem botão de convidar/desativar e com o perfil bloqueado. Pelo navegador com a sessão dela: `GET /api/crm/people` 200; `POST /api/pipelines` 403; `GET /api/crm/people/p1/document` 403; `GET /api/blog/articles` 403; `GET /api/blog/articles?published=true` 200; `POST /api/team` 403; `GET /api/team` 200.
5. Um Admin desativou a Vendedora por `curl` enquanto ela estava logada; a próxima chamada do navegador deu 401 e a tela voltou para "Sua sessão terminou. Entre de novo.". (Isto revelou que a tela de entrada perdia os botões de login nesse caminho; corrigido antes do commit e reaberto: ok.)
6. Com a API sem `/auth/me` (servidor vazio na 8091): o admin abre direto, como antes.
7. Sem sessão por `curl`: `GET /api/leads` → 401; `POST /api/public/leads` segue respondendo (422 com corpo vazio, ou seja, passou do middleware).

**Não verificado visualmente:** o `Entrar com Google` real (precisa do Client ID), o dark mode da tela de login e telas estreitas (o pane do navegador ficou com o viewport instável; a tela usa só o CSS existente).

## (b) Arquivos alterados

API (`apps/api`): novos `auth_store.go`, `auth_google.go`, `auth_middleware.go`, `auth_rules.go`, `auth_test.go`, `auth_integration_test.go`; alterados `main.go` (liga o schema, as rotas, o `withAuth` e o CORS), `crm_history.go` (autor = sessão), `crm_people.go` (CPF novo), `crm_leads.go` (origem/fonte), `.env.example`. Schema: `apps/studio/prisma/schema.prisma` (`TeamMember`, `AuthSession`).

Admin (`apps/admin`): novos `lib/auth.ts`, `lib/roles.ts`, `lib/teamSync.ts`, `pages/Login.tsx`, `tests/roles.test.ts`; alterados `App.tsx`, `lib/permissions.ts`, `lib/history.ts`, `pages/Settings.tsx`, `domain.ts` (status `DISABLED`), `pages.css`.

Docs: `docs/pagesAdmin/settings.md`, `docs/ARCHITECTURE.md` (status e segurança), `docs/auth-study.md` (seção "Implementação (WP1)" com a tabela de divergências e de rotas públicas).

## (d) O que ficou de fora e por quê

- **Vendedor ver só as oportunidades atribuídas a ele**: a matriz de `permissions.ts` não tem essa regra (o dono da oportunidade hoje é texto livre). Está em `docs/system-core.md`, mas não no checklist do WP1; precisa de decisão e de modelagem de responsável.
- **`/api/revalidate`**: o checklist o lista como exceção pública, mas ele **não existe na API**, é rota do site (Next); a API é quem o chama. Não há o que liberar.
- Auditoria de segurança em tabela (login, convite, troca de perfil): vai para o log do servidor (`AUTH: …`), não para o `ChangeLog`. Limite de tentativas em `/auth/*` e rotação de `SESSION_SECRET` sem derrubar sessões também ficam para depois.
- Webhooks de saída seguem sem API (WP4); Projetos/Chaves seguem mock (WP2).

## (e) Riscos

1. **Testado em MySQL em memória (go-mysql-server), não em MySQL/MariaDB real.** A criação das tabelas, `SELECT … FOR UPDATE` (guarda do último Admin) e a FK com `ON DELETE CASCADE` precisam passar em MySQL de verdade antes de ligar (roteiro do WP3). O go-mysql-server não reaplica `ALTER` em coluna existente: a API só sobe uma vez por instância dele (problema do `ensureBlogSchema`/`ensureOpportunitySchema` já existente, não do auth).
2. **Cookie e domínio:** o cookie é `SameSite=Lax`; admin e API precisam estar no mesmo *site* (`admin.` e `api.` do mesmo domínio). Admin em `*.vercel.app` com API em outro domínio **não recebe o cookie**. Definir o domínio do admin antes de ligar.
3. **Atrás de proxy:** o IP guardado e a checagem de loopback do modo dev usam `X-Forwarded-For`; o proxy precisa sobrescrevê-lo (o EasyPanel/Traefik já faz) — senão o IP gravado é forjável. O dev login se nega por qualquer `X-Forwarded-For`.
4. **Quem usa a API sem navegador** (scripts, `curl` internos, o próprio site chamando rotas não públicas) passa a receber 401 ao ligar a flag. O site só usa as três leituras públicas do blog (conferido em `apps/site/src/lib/blog.ts`); qualquer outro consumidor precisa ser mapeado antes.
5. **id_token sem checar assinatura** (vem direto do Google por TLS na troca do código, permitido pelo OIDC). Se o `GOOGLE_TOKEN_URL` for trocado por algo não confiável, isso deixa de valer; ele é uma variável de código, não de ambiente.
6. Efeito colateral: com a flag ligada, **`/api/emails/send` passa a exigir sessão** (resolve a pendência de segurança nº 2 do ARCHITECTURE; a do CORS `*` também).
7. No admin, ao receber 401 a tela de entrada substitui o app: o que estava sendo editado e ainda não sincronizado se perde.
8. Há um outro processo do usuário escutando a `localhost:8080` (API com conexão para um host remoto na 3306). **Não toquei nele**; usei as portas 8090/8091/3307 e o admin em 5174 (a 5173 estava ocupada).

## (f) O que o Gustavo precisa fazer

1. **Google Cloud Console** → projeto → *APIs e serviços* → *Credenciais* → *Criar credenciais* → **ID do cliente OAuth**, tipo **Aplicativo da Web**. Em *URIs de redirecionamento autorizados*: `https://<domínio-da-api>/auth/google/callback` (e `http://localhost:8080/auth/google/callback` se quiser testar localmente com Google).
2. **Tela de consentimento OAuth**: tipo *Interno* se a Kalidash tiver Google Workspace (só o domínio entra); *Externo* + usuários de teste se forem Gmails pessoais. Escopos: `openid`, `email`, `profile` (sem verificação do app).
3. **Domínio autorizado**: o da API (e o do admin, se a tela pedir). Admin e API no **mesmo site** (ver risco 2).
4. Copiar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` para as variáveis da API na VPS (nunca no repositório) e definir `GOOGLE_REDIRECT_URL` (igual ao cadastrado), `ADMIN_URL`, `ALLOWED_ORIGINS` (a URL do admin e a do site, sem barra final), `SESSION_SECRET` (32+ caracteres aleatórios; `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), opcionalmente `GOOGLE_HD=<domínio do Workspace>`.
5. **Primeira conta Admin:** definir `AUTH_BOOTSTRAP_ADMIN=<e-mail do Gustavo ou da Carol>` na primeira subida. Entrar com essa conta Google; o resto da equipe se convida em Configurações → Equipe e acessos (e-mail exato). A variável é ignorada depois que existe um Admin.
6. **Backup do banco antes** de ligar `AUTH_API=1` (cria `TeamMember` e `AuthSession`, só `CREATE TABLE IF NOT EXISTS`). Rodar `TEST_DSN=… go test -run IntegrationAuth` num MySQL/MariaDB real descartável (junto do roteiro do WP3).
7. Nunca ligar `AUTH_DEV_LOGIN` nem `AUTH_COOKIE_INSECURE` em produção.

## Perguntas de produto para o PO

1. **Primeiro Admin:** implementei `AUTH_BOOTSTRAP_ADMIN` (e-mail definido por quem sobe o servidor) em vez do `POST /auth/setup` do estudo ("o primeiro do domínio a logar vira Admin"), por ser mais seguro. Ok? E quem é o primeiro Admin (Carol ou o Gustavo)?
2. **Equipe para todos lerem:** `GET /api/team` é aberto a qualquer logado (os seletores de responsável precisam da lista); o estudo dizia "Equipe: só Admin". Confirmar.
3. **Blog para Vendedor:** pelo `system-core.md` o Vendedor não acessa o Blog, então apliquei 403 no servidor e escondi do menu — isso vai além dos três itens de `permissions.ts`. Manter?
4. **Vendedor só vê o que é dele** (oportunidades atribuídas): entra no WP1.1 ou fica para depois? Exige decidir o que é "responsável" (hoje `owner` é texto).
5. **Sessão de 7 dias sem renovação:** depois disso, entra de novo. Aceitável ou quer sessão deslizante/mais curta?

## Atualização (18/10, depois das respostas do PO)

- **Admin raiz (rootDev):** `AUTH_ROOT_ADMIN` (o nome antigo `AUTH_BOOTSTRAP_ADMIN` ainda vale). A conta é criada na primeira subida e **volta a ser Admin ativo a cada subida**; pela tela nem outro Admin a rebaixa ou desativa (409), e ela aparece marcada "· raiz". Testes: `TestAdminRaiz`. No navegador: criada a partir da variável, marcada, com perfil e lixeira bloqueados.
- **Lista da equipe aberta a todo logado:** já era assim; confirmado.
- **Sessão de 7 dias com renovação:** cada uso depois da metade do prazo estende para mais 7 dias (e reenvia o cookie); 7 dias sem uso expira. Testes: `TestSessaoRenovaComUso` e, em MySQL, `ExtendSession` em `TestIntegrationAuth`. Resultado: 61 PASS sem `TEST_DSN` (integração pulada) e todos com ele (MySQL em memória); admin 42 PASS.
- **Escopos de permissão, menu de configuração (design Stripe) e tokens de API sem expiração:** **não feito aqui**, é um recurso novo grande (substitui os três perfis fixos por escopos, tela de configuração e tokens). Proposto como sessão própria; o WP1 já deixa a base (`routeAccess` é a tabela única de acesso por rota, `capabilities` no admin, `AuthSession`).
