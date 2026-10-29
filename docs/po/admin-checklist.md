# /admin — visão do PO, checklist de aceite e régua de nota

> Dono do documento: sessão "PO" (decide, briefa, avalia e devolve). Workers executam e **não editam este arquivo**; reportam no formato da seção 5.
> Criado em 18/10/2026. Fontes: `docs/index.md`, `docs/ARCHITECTURE.md` (status por módulo), `docs/handoffs/2026-10-14-estado-e-proximos-passos.md`, `docs/auth-study.md`, `docs/pagesAdmin/*`, `docs/dominio.md`.

## 1. Objetivo final

O time interno da Kalidash (Admin, Gerente, Vendedor) opera o dia a dia em **produção, com dado real persistido e acesso só para quem está autenticado**: leads → oportunidades → tarefas → clientes, blog, e a conexão das LPs/formulários da própria Kalidash. Não é SaaS nem multi-tenant. Contrato v2: perfis e painel de permissões são escopo, e o login Google entra até a Entrega 4.

**Definição de pronto do admin** (todas verdadeiras):
1. Ninguém sem login lê ou grava dado do CRM; o perfil é aplicado **no servidor**, não só escondido na tela.
2. Nenhuma tela do menu opera em "dados de exemplo" sem deixar isso explícito; as do núcleo (Leads, Oportunidades, Tarefas, Pessoas & Empresas, Clientes, Blog, Projetos/Chaves, Equipe) gravam na API.
3. Um formulário de LP da Kalidash (via `connect.js` ou API direta, com chave de escopo) cria lead real e aparece no admin.
4. Existe roteiro testado para ligar `WORKFLOW_API`/`CRM_API` em produção sem perder dado (backup, `DATA_KEY`, testes em MySQL real).

## 2. Estado de partida (18/10/2026)

| Área | Situação |
|---|---|
| Funis, tarefas, gate, pessoas, empresas, leads, histórico, valor, upload R2 | API pronta e **desligada por padrão**; admin sincroniza quando ligada, senão usa exemplo |
| Captura pública de lead | Pronta (`POST /api/public/leads`) |
| Login e perfis | **Inexistente** (API aberta, CORS `*`). `permissions.ts` só simula o perfil |
| Projetos conectados, Chaves, `connect.js` | Tela com mock; sem API |
| Equipe, Webhooks de saída | Tela com mock; sem API |
| E-mails e Automações | Tela com mock; envio provisório via Resend |
| Dashboard | Métricas reais de oportunidades; leads/tarefas/origem pendentes |

## 3. Pacotes de trabalho (ordem e dependência)

| Pacote | Entrega | Depende de | Toca em |
|---|---|---|---|
| **WP0** Auditoria real × mock | Matriz por tela, bugs reproduzidos, sem editar código | — | nada (só leitura) |
| **WP1** Login Google + perfis no servidor | Entrar com Google, sessão, middleware, equipe real | — | `apps/api`, `apps/admin` (shell, Settings, permissions) |
| **WP2** Chaves de API, projetos conectados, `connect.js` | Emitir/revogar chave com escopo, endpoint de entrada, snippet | WP1 | `apps/api`, `apps/admin/pages/Projects.tsx` |
| **WP3** Núcleo ligado de ponta a ponta + roteiro de produção | Testes em MySQL/MariaDB real, runbook de ligar flags, Dashboard com leads/tarefas | WP1 | `apps/api` (testes), docs |
| **WP4** Mocks restantes (Automações, E-mails, Webhooks de saída) | Decidir o que fica fora do contrato e o que liga | WP1–3 | admin + api |

Regra: pacotes que escrevem código não rodam ao mesmo tempo nos mesmos arquivos. WP0 roda em paralelo com qualquer um.

## 4. Checklists de aceite

### WP0 — Auditoria
- [ ] Uma linha por item do menu (Dashboard, Leads, Oportunidades, Tarefas + workflow, Pessoas & Empresas, Clientes, E-mails, Blog, Automações, Projetos, Configurações): **real / exemplo / quebrado**, com a evidência.
- [ ] `pnpm` build e testes do admin e `go test ./...` da API rodados, saída resumida.
- [ ] Conferido no navegador nos dois modos: API desligada (exemplo) e ligada (API local em MySQL em memória, **nunca** o `.env` real).
- [ ] Lista de bugs priorizada (bloqueia uso / incomoda / cosmético), cada um com passos de reprodução.
- [ ] Lacunas entre os docs de `docs/pagesAdmin/*` e o código.

### WP1 — Login e perfis
- [ ] `GET /auth/google/login` e `/auth/google/callback` (estado anti-CSRF) conforme `docs/auth-study.md`; só entra quem está na tabela da equipe, senão 403.
- [ ] Sessão por cookie `HttpOnly`/`Secure`/`SameSite` (ou equivalente justificado); logout; expiração.
- [ ] Middleware protege `/api/*` **exceto** o que é público de propósito: `POST /api/public/leads`, leitura de artigos publicados usada pelo site e `/api/revalidate`. Cada exceção listada e justificada.
- [ ] Perfis Admin/Gerente/Vendedor aplicados **no servidor** (mesma matriz de `permissions.ts`: CPF, origem do lead, pipelines/fontes/tags/templates); teste prova 403 para Vendedor.
- [ ] CORS restrito por `ALLOWED_ORIGINS` (admin e site), sem `*`.
- [ ] Admin: tela de login, rota protegida, usuário real no topo, Equipe gravando na API (convidar, trocar perfil, desativar), `permissions.ts` lendo o perfil da sessão.
- [ ] Atrás de flag `AUTH_API=1` (desligada por padrão, como as demais) e com modo de desenvolvimento sem Google documentado.
- [ ] Nenhum segredo no repositório; `.env.example` atualizado com `GOOGLE_CLIENT_ID/SECRET`, `SESSION_SECRET`, `ALLOWED_ORIGINS`.
- [ ] Testes de integração e de unidade novos passando; build do admin limpo.
- [ ] Lista do que o **Gustavo** precisa fazer (criar o OAuth Client ID, domínio autorizado, primeira conta Admin).

### WP2 — Chaves e conexão
- [ ] Chaves `kld_live_`/`kld_test_` com hash SHA-256, prefixo visível, token completo **uma única vez**, escopos `forms:write`/`analytics:write`/`ads:read`/`leads:read`, revogação imediata, "último uso".
- [ ] Só Admin/Gerente emitem e revogam (servidor).
- [ ] Projetos conectados e formulários rastreados gravados na API; `connect.js` e API direta criam lead real usando só chave `forms:write`.
- [ ] Limite de taxa por IP e validação de origem; chave de escopo de leitura nunca aceita no snippet.
- [ ] Projects.tsx deixa de ser mock quando a API está ligada; aviso de exemplo some.

### WP3 — Núcleo em produção (dividido em 3a e 3b, 18/10/2026)

**Pré-requisito do 3a (Gustavo):** Docker instalado e rodando nesta máquina. Em 18/10 o comando `docker` **não existe** aqui; o 3a fica bloqueado até isso. Alternativa aceita: um MariaDB/MySQL descartável instalado localmente, em porta própria, que o Gustavo aponte.

**WP3a — Validação em MySQL real (diagnóstico + infraestrutura de teste).** Pode rodar junto do WP2 porque só lê código e cria arquivos novos de teste/script.
- [ ] `docker-compose` (ou script) em `apps/api/scripts/` ou `scripts/` que sobe MySQL 8 e MariaDB descartáveis em porta própria, com dados efêmeros, e script para rodar a suíte com `TEST_DSN`. Sem credencial real, sem volume persistente.
- [ ] Toda a suíte (`workflow_*`, `crm_*`, `crm_history_*`, `auth_*`, `opportunities_*`) rodada em **MySQL 8 e em MariaDB**; tabela de resultados, falha por falha com a causa (SQL incompatível, `FOR UPDATE`, `COALESCE` em JSON, `ALTER`, FK, `DATETIME`/`parseTime`/`loc`, collation).
- [ ] Mesmos testes com o DSN em dois modos (`parseTime=true` e sem) e `loc` vazio.
- [ ] Correções **só** se forem pequenas e de SQL; cada uma com teste. O que for grande vira item na lista para o PO. Não editar arquivos que o WP2 esteja alterando (`auth_tokens.go`, `crm_leads.go`, `public_leads.go`, `Projects.tsx`).
- [ ] Medidas de sanidade: criar schema do zero e a partir do schema "antigo" (sem as tabelas do auth/escopos) e conferir que a migração por `columnExists` é idempotente (subir a API 2 vezes).

**WP3b — Núcleo ligado de ponta a ponta + roteiro de produção.** Depois do WP2 e do 3a.
- [ ] **D6:** `POST /api/public/leads` passa a criar **Lead v2** (com a fonte do formulário) quando `CRM_API=1`; sem a flag segue o caminho antigo. Teste cobrindo os dois, e plano de migração dos leads que já entraram como Oportunidade INBOUND (conversão ou convivência, com a decisão listada ao PO).
- [ ] **D10:** contato, empresa e responsável da oportunidade ligados ao CRM v2 (Pessoa/Empresa) e à equipe; a ficha passa a editar esses vínculos; **D9:** ficha edita prioridade e tags.
- [ ] **D4:** "responsável" vira referência à equipe e o Vendedor passa a ver só o que é dele, como escopo (`leads:own`), sem quebrar os presets.
- [ ] Dashboard com leads, tarefas e origem reais.
- [ ] **Runbook** em `docs/runbooks/ligar-em-producao.md`: backup e teste de restauração, geração e guarda da `DATA_KEY`, DSN sem `loc=` e com/sem `parseTime`, retenção do IP no histórico (LGPD), ordem de ligar `AUTH_API` → `WORKFLOW_API` → `CRM_API`, variáveis do Google, checklist de smoke test pós-deploy e **rollback** de cada flag.
- [ ] Nada executado contra o banco de produção; o runbook é para o Gustavo executar.

## 5. Regras para todo worker

1. **Nunca** rodar API local com o `.env` real e as flags ligadas; usar MySQL em memória/container descartável. Não ler nem repetir credenciais de produção.
2. Não tocar em `apps/site` nem em CSS do site: outra sessão (Antigravity) trabalha lá. Reler o arquivo antes de editar; `git status` antes de começar.
3. `git add` **só dos arquivos do seu pacote**; nunca `git add -A`. Commits pequenos, mensagem `feat(api,admin): …` no padrão do repositório.
4. Tudo novo atrás de flag desligada por padrão, no padrão `WORKFLOW_API`/`CRM_API`.
5. Verificar no navegador (preview do admin) e com testes; "compila" não é aceite.
6. Se uma decisão de produto for necessária, **parar e perguntar ao PO** em vez de decidir.
7. Atualizar a documentação do módulo (`docs/pagesAdmin/*`, `ARCHITECTURE.md` status) no mesmo commit.

**Formato do relatório de entrega** (obrigatório): (a) cada item do checklist com ✅/⚠️/❌ e a evidência (comando + resultado, ou o que foi visto no navegador); (b) arquivos alterados; (c) commits; (d) o que ficou de fora e por quê; (e) riscos; (f) o que o Gustavo precisa fazer.

## 6. Régua de nota (0–10) usada pelo PO

| Critério | Peso |
|---|---|
| Funciona de verdade: verificado no navegador e por testes, não só no código | 40% |
| Aderência ao checklist e ao escopo (sem inventar, sem faltar) | 25% |
| Segurança e integridade de dados (servidor decide, nada vaza, nada de produção tocado) | 15% |
| Qualidade do código e testes (padrão do repo, cobertura do que importa) | 10% |
| Documentação e relatório honesto (admite o que não fez) | 10% |

- **≥ 9** aceito. **7–8,9** aceito com correções listadas, devolvo ao mesmo worker. **< 7** refazer o ponto fraco. Qualquer item de segurança ❌, ou ter tocado produção, limita a nota a 6.
- O PO confere a entrega por conta própria (lê o diff, roda testes, olha o navegador) antes de dar a nota; o relatório do worker é só o ponto de partida.

## 7. Registro de entregas

| Pacote | Sessão | Nota | Situação |
|---|---|---|---|
| WP0 | wp0-auditoria | **8,8** | Aceito. Relatório em `relatorios/wp0-auditoria.md`. Honesto sobre o que não conseguiu fazer (modo "API ligada"); errou ao dizer que não havia banco em memória disponível (o WP1 achou um fora do repo) |
| WP1 | wp1-auth | **8,6** | Aceito. 4 commits (`cf65f56`…`13baba8`). PO conferiu: `go vet` e `go test` verdes, admin 42/42 e `tsc -b` limpo, código de `auth_middleware.go` revisado (sessão opaca com HMAC, CORS sem `*`, tabela única de rotas, `SESSION_SECRET` ≥ 32, rascunhos do blog não vazam). Descontos: um commit saiu com teste quebrado (corrigido depois), MySQL real e Google real não exercitados (inevitável agora; vai para o WP3 e para o Gustavo), tela de login sem checagem de dark mode e mobile |
| WP-B | wp-b-estabiliza-o-do-n-c | **9,0** | Aceito. Commits `f616190` e `bfee002`. PO conferiu: `go vet` e `go test` verdes no repositório real; `parseDT` e `emails.go` revisados (destinatário só da sessão, `to` ignorado, limite de 10/h, assunto sem quebra de linha, Resend trocável nos testes). Causa do B-D1 reproduzida e corrigida nos dois modos de DSN. Descontos: B-F5 só parcial (por decisão de escopo), `COALESCE` em JSON e o envio real do Resend não exercitados, teste flaky do WP1 apontado mas não corrigido (arquivo de outra sessão) |
| WP1.1 | wp1-1-escopos-de-permiss | **9,0** | Aceito (aberto pelo worker do WP1, mas dentro do contrato: "painel de permissões" é escopo). Commits `1801990`, `d52174f`, `244c570`, `c304872`. PO conferiu: `go vet` e `go test` verdes, admin 52/52, `tsc -b` limpo, relatório coerente com o diff (9 arquivos de API, +1540 linhas). Pontos fortes: matriz antiga passa sem alteração, `TestCadaEscopoAbreSoSuaRota` prova 401/403 por escopo, token com hash SHA-256 e segredo mostrado uma vez, token não escala privilégio. Descontos: MySQL real não exercitado, auditoria de permissões só em log, estado de erro de carga verificado só por leitura de código. **Cobre parte do WP2** (ver D13) |

| WP2 | wp2-projetos-conectados | **9,0** | Aceito. Commits `d512f00`, `82a1b2b`, `f77829e`, `082fde9`. PO conferiu: `go vet` e `go test` verdes, admin 54/54, `tsc -b` limpo, `connect_ingest.go` revisado (ordem barata→cara das barreiras, token e escopo antes de tudo, só escopos publicáveis, `Origin` por projeto, honeypot, limites por IP e por chave, só registra rotas com `CRM_API` **e** `AUTH_API`). Provado no navegador com LP real em outra origem. Descontos: `analytics:write`/`ads:read` só reservados, limites em memória, MySQL real não exercitado, mock de métricas (visitas, conversão) sumiu da tela real em vez de ser substituído |
| WP3a | wp3a-su-te-da-api-em-mys | — | **Bloqueado**: Docker não instalado (`docker` inexistente, sem Podman; só `wsl.exe`). O worker parou corretamente, sem instalar nada. Reabrir quando o Gustavo instalar o Docker |

## 8. Decisões do PO (18/10/2026)

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Primeiro Admin por `AUTH_BOOTSTRAP_ADMIN` em vez de "primeiro a logar" | **Ok** (mais seguro). Quem é o primeiro Admin: decisão do Gustavo |
| D2 | `GET /api/team` aberto a qualquer logado | **Ok** (os seletores de responsável precisam) |
| D3 | Blog bloqueado para Vendedor no servidor | **Mantém** (`docs/system-core.md`) |
| D4 | Vendedor só vê o que é dele | **Depois**, junto com a modelagem de "responsável" (hoje texto livre). Entra na lista do WP3 |
| D5 | Sessão de 7 dias sem renovação | **Ok por ora** |
| D6 (P2 do WP0) | Formulário do site cria Lead v2 ou Oportunidade INBOUND | **Lead v2** (`docs/dominio.md` v2.1 confirmada). Até o WP3 migrar a captura pública, **não** ligar `NEXT_PUBLIC_LEAD_ENDPOINT` com tráfego real |
| D7 (P3) | Galeria de gráficos de demonstração no Dashboard | Fica, mas **separada** das métricas reais, com rótulo e fora da rota principal |
| D8 (P4) | Envio de teste de e-mail | Trocar por `POST /api/emails/test` que envia **só para o e-mail de quem está logado**; sem sessão, botão desativado com aviso. Nada de destinatário digitado |
| D9 (WP-B) | Ficha da oportunidade edita prioridade e tags | **Sim**, é barato (a API já grava). Entra no próximo pacote de admin do núcleo |
| D10 (WP-B) | Contato, empresa e responsável da oportunidade | Ligar ao **CRM v2** (Pessoa/Empresa) e à equipe, não criar colunas na tabela antiga. Junto com D6 e D4, no WP3 |
| D11 (WP-B) | `/api/emails/send` por oportunidade aberto a qualquer perfil | Limitar a Admin/Gerente no WP4 |
| D12 | WP1.1 abriu escopos e tokens de API por conta própria | Reescopar o WP2 depois de avaliar o WP1.1, para não duplicar |
| D13 | Token de API sobrevive à desativação de quem o criou? | **Sim** (o token é da organização, não da pessoa). Contrapartida obrigatória: ao desativar alguém, a tela lista os tokens que a pessoa criou e pede confirmação; a listagem mostra o criador |
| D15 (WP2) | Chave de servidor com escrita de leads separada da chave do HTML | **Não agora.** Mesma `forms:write` por projeto, com limites e revogação imediata. Reavaliar quando entrar o webhook de entrada (WP4) |
| D16 (WP2) | Webhook de entrada, `LeadSubmission`, tarefa "Informar CNPJ" e automação `formulario.enviado` (contrato de `inbound-leads.md`) | **WP4**, depois do núcleo ligado. Turnstile/reCAPTCHA também |
| D14 | WP2 reescopado | Já existe (WP1.1): tokens `kld_live_`, hash, escopos, revogação, último uso, Bearer. **Falta:** `kld_test_`, `projectId`, escopos `forms:write`/`analytics:write`/`ads:read`, projetos conectados e formulários rastreados na API, endpoint do `connect.js` criando **Lead v2** (D6), limite de taxa por chave, `Projects.tsx` real |

## 9. WP-B — Estabilização do núcleo (a partir do WP0) — **concluído, ver registro**

Corrige os bugs que o WP0 achou e que bloqueiam ou enganam o uso. Toca em `apps/api/main.go` (handlers de oportunidade e e-mail), `apps/admin` (Oportunidades, Dashboard, Emails). **Não** roda junto com o WP2.

- [ ] **B-D1:** `created_at` e `wonAt` das oportunidades vêm zerados. Reproduzir em banco descartável, corrigir o parse de forma que funcione com e sem `parseTime=true` no DSN, com teste. Não presumir o DSN de produção.
- [ ] **B-F1:** "Nova Oportunidade" sem `catch` nem checagem de `res.ok`: mostrar erro claro e nunca inserir objeto de erro na lista.
- [ ] **B-F5:** `PUT /api/leads` só grava título e valor. Levantar o que a ficha edita, persistir o que as colunas atuais suportam, e **tornar explícito na tela** o que não persiste (sem criar armazenamento novo; listar o restante no relatório para decisão).
- [ ] **B-F2 / D8:** endpoint de teste de e-mail só para o próprio e-mail logado, com permissão e teste; tela ajustada.
- [ ] **B-F3 / D7:** dado de exemplo (`sampleOppsStore`, "Ver leads (9)", galeria do Dashboard) nunca mistura com dado real sem rótulo; galeria separada.
- [ ] **B-F4 / B-C2:** corrigir os textos e docs desatualizados que o WP0 listou (banner que diz "login por último", linhas duplicadas e status velho em `ARCHITECTURE.md`, `pagesAdmin/projects.md`).
- [ ] Testes novos para o que for lógica; build e `go vet` limpos; verificado no navegador.
- Fora do escopo: `apps/api/scripts/test.go` (arquivo local com credencial; é do Gustavo), captura pública (WP3), qualquer coisa de auth (WP1 pronto).

| WP3c | wp3c-runbook-para-ligar | **8,8** | Aceito (24/10). Commits `9ee0921` e `bf7d30a`; `docs/runbooks/ligar-em-producao.md` com 12 seções, sem nenhum segredo (varredura limpa). PO leu §7 e o relatório: ordem `AUTH_API` → `WORKFLOW_API` → `CRM_API`, regra do cookie, smoke por curl e por tela, bloqueio da captura pública até o WP3b, rollback. Descontos: comandos não executados; o §9 diz que não viu suporte a vídeo no R2 (o `ALLOWED_MEDIA_HOSTS` do site já existe: acrescentar); retenção do IP sem job no código; `RESEND_API_KEY` ausente do `.env.example` |
| WP3b | wp3b-n-cleo-crm-v2-de-po | — | Em andamento. Já commitados: D6 (`5f51baa`, captura pública cria Lead v2 com `CRM_API=1`) e D10 (`cc60fd4`, oportunidade ligada a pessoa, empresa e equipe). Falta D9, D4 e o Dashboard |

| WP3b | wp3b-n-cleo-crm-v2-de-po | **9,0** | Aceito (25/10). Commits `5f51baa`, `cc60fd4`, `435712b`, `46c4bf2`, `ddee133`, `85be696`, `54f74d3`, `85d8285`, `9aff6e1` e docs. PO conferiu: numa cópia limpa do HEAD `go vet` e `go test` verdes; admin 65/65 e `tsc -b` limpos; `own_scope.go` revisado (o "own" amplia `leads:read/write` só para os registros da pessoa; sem `AUTH_API` nada age; reatribuir é 403; fora do escopo é 404). Pontos fortes: o worker explicou cada desvio (coluna nova `ownerMemberId` porque `ownerId` aponta para a tabela `User` do Prisma), listou os 4 testes de matriz que ajustou de propósito e achou e corrigiu bug real de anotação que nunca gravava e o `archivedAt` com `parseTime=true`. Descontos: MySQL real não exercitado; tarefas e histórico não filtrados por responsável; `qualifyLead` ainda cria oportunidade de exemplo |

## 10. Decisões do PO após o WP3b (25/10/2026)

| # | Pergunta | Decisão |
|---|---|---|
| D17 | Leads antigos que entraram como Oportunidade INBOUND | **Conviver.** Nada é migrado; os novos vão para o funil de leads. Só reavaliar se a Kalidash pedir |
| D18 | Lead sem responsável: o Vendedor vê? | **Não.** Gerente/Admin distribuem. O **rodízio automático (round-robin)** é item da Entrega 3 do contrato e vira pacote próprio |
| D19 | Filtrar tarefas por responsável | **Sim, na Entrega 3**, junto do rodízio: o Vendedor vê as tarefas dos seus registros |
| D20 | "Qualificar lead" cria oportunidade real | **Sim, pacote próprio (WP4)**: qualificar lead → oportunidade real na API, com SLA de primeiro contato, dedup por e-mail e projeto, motivo de perda; é o miolo da Entrega 3 |
| D21 | `NEXT_PUBLIC_LEAD_ENDPOINT` | Pode ser ligado **só depois** de `CRM_API=1` e `AUTH_API=1` em produção (runbook WP3c); o destino já é decidido pela flag, sem risco de duplicar |

| Admin PWA | admin-pwa | **9,0** | Aceito (25/10). Commits `9dd3a13`, `c910e32`, `0786069` e relatório. PO conferiu: `npm test` 67/67 e `tsc -b` limpos; `vite.config.ts` com `NetworkOnly` para `/api/*`, `/auth/*` e outras origens e `navigateFallbackDenylist`; relatório com prova em Chrome real contra o build servido (manifesto, SW ativo, 24 entradas de precache sem resposta de API, rota profunda offline, aviso de nova versão). Descontos: instalação e janela standalone não testadas; clique de logout com login real e a faixa "Sem conexão" só no código; risco de offline com sessão (ver D26) |
| Web Vitals do site | site-webvitals | **8,5** | Aceito parcialmente (25/10). Linha de base honesta (Lighthouse 12 no Edge, mediana de 3, 5 páginas, móvel e desktop) e 3 correções com medição antes/depois; uma tentativa (`dynamic`) foi testada e descartada com evidência. PO conferiu: `tsc` limpo, as classes das fontes removidas (`.text-display-*`, `Header`/`DesktopNav`) não são usadas em nenhuma página viva. Resultado: LCP móvel 5,6–7,2 s → 3,4–4,5 s, fontes 520 → 135 KB, desktop 99–100; **meta de LCP ≤ 2,5 s no móvel NÃO atingida**. Descontos: conferência visual a 1440/390 px não feita; ganho do `PixelTransition` não medido |

## 11. Decisões do PO (25/10/2026), Web Vitals e PWA

| # | Pergunta | Decisão |
|---|---|---|
| D22 | `PixelTransition` cobrindo `/blog` e `/blog/[slug]` por ~1,4 s em toda carga | **Medir sem a cortina primeiro** e, se o ganho for relevante, passar a rodar só na **primeira visita da sessão** (sessionStorage) e com duração menor. Mantém a assinatura visual e tira o custo das visitas seguintes |
| D23 | Fontes restantes (135 KB) | Carregar **Manrope só nas rotas do blog** e reduzir pesos não usados de Inter e Source Sans 3; medir |
| D24 | Home como Server Component | **Não agora** (mudança grande). Reavaliar depois de medir na URL real da Vercel |
| D25 | Meta de LCP móvel | A meta fica em ≤ 2,5 s. Se o ciclo D22+D23 não chegar, o PO decide entre aceitar um número documentado e abrir o item D24 |
| D26 | Offline com `AUTH_API` ligada: hoje `initAuth` trata "API fora do ar" como "sem login" e o app abre só com o shell | **Não entrar em modo de exemplo.** Com `AUTH_API=1` e API inalcançável, mostrar tela clara "Sem conexão com o servidor" com botão de tentar de novo; o modo de exemplo só vale quando a API nunca foi configurada |

## 12. Fechamento Web Vitals e PWA (25/10/2026)

| Pacote | Nota final | Observação |
|---|---|---|
| Web Vitals do site (rodada 2) | **9,0** | Commits `740a68b`, `fdc1100`. O worker conferiu o visual a 1440 e 390 px (sem mudança), **mediu o D22 e não implementou** porque a cortina não pesa no LCP medido (o critério era "se o ganho for relevante"), e testou `inlineCss` sem ganho, revertendo. LCP móvel simulado 3,1–4,3 s (início: 5,6–7,2 s); o LCP sem simulação é só TTFB + 155 ms de render. Meta de 2,5 s não atingida **no modelo simulado de 4G lento**. **D25 resolvido:** aceitar o número documentado e validar na URL real (PageSpeed) antes de abrir D24 (Home como Server Component). Pendência de design, não de performance: `/blog/<slug>` renderiza em Archivo porque `--font-inter` e `--font-source-sans` não existem na página (BC-5, junto da decisão Q2) |
| Admin PWA, follow-up D26 | **9,0** (mantida) | Commit `e79f569`: com o login ligado, a primeira resposta do servidor grava um indicador local; se depois a chamada falhar por rede ou 5xx, o app mostra "Sem conexão com o servidor" com "Tentar de novo". Admin 72/72 e `tsc -b` limpos. Risco residual: na primeiríssima visita com a API fora do ar (sem indicador) ainda cai em modo de exemplo; só mostra dado de exemplo, nunca dado real |

## 13. Auditoria de funis, tarefas e automações (25/10/2026)

| Pacote | Sessão | Nota | Situação |
|---|---|---|---|
| Auditoria workflow | audit-workflow | **9,5** | Aceita. Commits `1afd90e`, `9f9b074`, `8ba855b`, `1855dee`; relatório de 547 linhas em `relatorios/audit-pipelines-tarefas-automacoes.md`. PO conferiu no código os dois achados mais graves: **B-01** (`qualifyLead` em `leadFlow.ts` só escreve em `sampleOppsStore`, memória, e marca o lead `QUALIFIED` apontando para uma oportunidade que não existe) e **B-02** (`initWorkflowSync` cria funis de exemplo no servidor quando a lista vem vazia, e `crmSync.seed` faz o mesmo com leads, pessoas e empresas). Pontos fortes: prova em banco descartável com chamadas HTTP diretas, que mostrou que a integridade vive só na tela (gate furado por 4 caminhos, etapa com leads apagável, tarefa órfã); resposta direta ao ponto central ("automações não existem no servidor, rodam só no navegador aberto, 9 de 20 eventos nunca são emitidos"); comparação de duas abordagens para executar jobs com recomendação defendida; lista do que NÃO construir. Descontos: toque no celular, carga e MySQL real não testados; contraste não medido |

### Decisões do PO sobre as perguntas da §8.4 (25/10/2026)

| # | Pergunta | Decisão |
|---|---|---|
| D27 | Catálogo de fluxos | **Lista de fluxos prontos que se liga e desliga** (WP4-7), não construtor livre |
| D28 | Motivo de perda | **Lista fechada configurável por funil**, com "Outro" + texto; obrigatório ao entrar numa etapa Perdida; o lead descartado usa a mesma lista |
| D29 | Deduplicação | Lead **ativo** com o mesmo e-mail no mesmo projeto (`ConnectedProject`): **não cria outro**; registra o novo envio no lead existente, preenche só campos vazios e marca "retornando". Se o anterior foi qualificado, perdido ou descartado: cria lead novo marcado "retornando", ligado à mesma pessoa. Dois formulários do mesmo projeto contam como um |
| D30 | Rodízio | Só **Vendedores ativos** (Gerente fora), **por funil** (`config.assignment`). Sem ninguém elegível: lead fica sem dono e notifica Gerente e Admin. **D18 continua** (o Vendedor só vê o que é dele) |
| D31 | SLA de primeiro contato | Padrão **60 min corridos por funil** (configurável; sem horário comercial na v1), avisa o responsável e o Gerente. Conta como contato: 1ª anotação de contato, e-mail enviado ou tarefa de contato concluída. **Valor a confirmar com a Carol** |
| D32 | Webhook de saída (Ganho) | Payload: valor, contato (nome, e-mail, telefone), empresa, funil e etapa, origem e UTM, ids. **Vários destinatários por funil**; reenvio manual: sim. **Falta saber qual é o sistema receptor** (Gustavo/Carol) |
| D33 | Ciclo de vida do lead | Usar as **etapas do funil** (Novos → Contatado → Negociação → Ganho/Perdido), ajustando os nomes do template; não criar um campo `leadStage` à parte |
| D34 | Automações de exemplo na tela | **Remover as contagens inventadas** ("Execuções 47…") e marcar como exemplo tudo o que ainda não roda no servidor |
| D35 | Quem liga ou desliga fluxo do sistema | Admin e Gerente (`automations:manage`), com registro na auditoria; Vendedor não |
| D36 | Responsável da tarefa | Sempre uma **pessoa da equipe**. "Função" resolve para o responsável do registro; sem dono, vai para a fila do Gerente |
| D37 | Semente de exemplo | **Só com `SEED_DEMO=1`** (desenvolvimento). Nunca em produção |
| D38 | E-mail de boas-vindas automático ao lead | **Fora da Entrega 3**: depende do domínio verificado no Resend. Entra como fluxo desligado, pronto para ligar depois |
| D39 | Corte da §8.3 (webhook de entrada por pipeline, construtor livre, WebSocket/Push, Redis/BullMQ, rodízio com pesos) | **Aprovado.** Execução de jobs: **outbox + tabela de jobs no MySQL com workers em goroutine** (sem Redis) |

Ordem a executar: **WP4-0 (higiene de produção) e WP4-1 (integridade do servidor)** primeiro, porque B-01 e B-02 impedem ligar as flags em produção; depois WP4-2, WP4-3 e em paralelo WP4-4; por fim WP4-5, WP4-6 e WP4-7.

## 14. Fechamento WP4-0 e WP4-1 (25/10/2026)

| Pacote | Sessão | Nota | Situação |
|---|---|---|---|
| WP4-0 Higiene de produção | wp4-0-higiene | **9,0** | Aceito. 7 commits (`833ffb3`…`4a91664`). PO conferiu: admin 85/85, `tsc -b` limpo, `npm run build` com saída 0; `VITE_SEED_DEMO` realmente controla `crmSync` e `workflowSync` (`seedDemo.ts`). Entregou semeadura só com a flag, "Conectar fonte" com projetos reais, oportunidades de exemplo escondidas em modo API, `null` ao limpar prazo e responsável, Automações sem números inventados. Descontos: "desconectar fonte" ficou de fora (a API recusa, 422); só viu 1440 px e nada de celular; bancos que já foram semeados antes não são limpos |
| WP4-1 Integridade do servidor | wp4-1-integridade | **9,3** | Aceito. 6 commits (`850b469`…`ce467da`). PO conferiu: `go vet` e `go test` verdes numa cópia limpa do HEAD (sem banco); o relatório afirma 117 testes de integração nos dois modos de DSN. Gate no servidor em oportunidade, lead e mudança de funil, com `gate/check` sem efeito colateral; etapa inexistente 422; mover para a mesma etapa 200; etapa com lead 409; funil sem Ganha/Perdida 422; tarefas órfãs; `null` limpa campo; tarefa de campo exige o dado; tarefas por dono; `Opportunity.pipelineId` e contagens; `If-Match` com compare-and-swap. Nenhum teste de matriz precisou ser ajustado. Descontos: MySQL real não exercitado; tarefa de campo reconhece o campo pelo **título** (o requisito não guarda `fieldKey`); D36 completo (Função resolve para o responsável do registro) não feito; o admin ainda não envia o `If-Match` |

### Decisões do PO após o WP4-0 e o WP4-1

| # | Pergunta | Decisão |
|---|---|---|
| D40 | O que é "desconectar a fonte" de um funil | A API passa a aceitar `pipelineId`/`stageId` nulos em `ConnectedProject`. O projeto continua existindo; **novos envios do formulário são recusados com erro claro (422 "projeto sem funil")** até ser reconectado; nenhum lead existente é apagado. O admin avisa antes de desconectar |
| D41 | Campo exigido por requisito | **Adicionar `StageRequirement.fieldKey`** (aditivo, nullable). O servidor valida pela chave e não mais pelo título; o título continua só como retrocompatibilidade para requisitos antigos |
| D42 | `If-Match` no front | O admin passa a enviar o `updatedAt` esperado em `PUT /api/pipelines/{id}`; em 409 mostra "Este funil foi alterado por outra pessoa" com opção de recarregar |
| D43 | D36 completo (Função → responsável do registro; sem dono → fila do Gerente) | Entra com o **rodízio (WP4-4)**, não antes |

Próximos: **WP4-1b** (D40, D41, D42; pequeno) em paralelo com **WP4-2** (qualificar lead real + motivo de perda; resolve o B-01, que também impede ligar as flags). Depois WP4-3 (eventos e jobs) e WP4-4.
