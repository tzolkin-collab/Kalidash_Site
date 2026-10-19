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
