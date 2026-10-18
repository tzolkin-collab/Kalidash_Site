# Relatório WP2 — Conexão das LPs e formulários ao CRM

Entregue em 18/10/2026. Tudo atrás de `CRM_API=1` **e** `AUTH_API=1` (`connectEnabled()`); sem as duas, as rotas nem são registradas e o admin segue em dados de exemplo. **Nenhuma escrita em produção**: a API de verificação rodou de uma pasta fora do repositório (scratchpad, sem `.env`), na porta 8090, sobre um MySQL em memória (go-mysql-server, porta 3327, binário fora do repo); admin em 5176 com `VITE_API_URL`; LP de teste em 8765 (e 8766, origem não cadastrada). Tudo já foi desligado. Não toquei em `apps/site` nem em `apps/api/scripts/test.go`, e a API em 8080 não foi usada.

## (c) Commits

| Hash | Mensagem |
|---|---|
| `d512f00` | feat(api): projetos conectados, chaves `kld_test_` e do snippet, `connect.js` e entrada de Lead v2 (WP2) |
| `82a1b2b` | feat(admin): Projetos conectados reais, chaves do snippet e aviso ao desativar quem criou tokens (WP2) |
| `f77829e` | docs: conexão de LPs (WP2) em ARCHITECTURE, auth-study, inbound-leads, projects e `.env.example` |
| (este) | docs: este relatório |

## (a) Checklist

| Item | Estado | Evidência |
|---|---|---|
| Tokens `kld_live_`/`kld_test_`, hash SHA-256, prefixo visível, completo uma vez, revogação imediata, último uso | ✅ | `kld_test_` e `projectId` novos sobre o WP1.1 (`auth_tokens.go`). `TestChaveDoSnippetRegras` (prefixo `kld_test_`, ficha com `env`/`projectId`); integração: o segredo não está em `tokenHash`/`name`/`prefix`. Navegador: chave de teste criada pelo painel (`kld_test_8sLB…1kXf`), mostrada uma vez; `curl` com chave revogada → **401** na hora |
| Escopos `forms:write`, `analytics:write`, `ads:read` (`leads:read` nunca no snippet) | ⚠️ | `forms:write` funciona de ponta a ponta. `analytics:write` e `ads:read` existem no catálogo, marcados **Reservados** ("Em breve"): ainda não há rota que os use (analytics/visitas e mídia paga estão fora do pedido). `leads:read` nunca vai no snippet: 422 ao criar a chave (`forms:write`+`leads:read`) e 403 na entrada se o banco for adulterado (`TestEntradaNegaOQueNaoDeve`); `curl` real: **422** |
| Só Admin/Gerente emitem, revogam e gerenciam projetos (servidor) | ✅ | `/api/projects*` exigem `keys:manage` (escopo só de pessoas: token nunca alcança). `TestProjetosSoAdminEGerente` (Vendedor 403 em listar, criar projeto e emitir chave; Gerente 200/201); `TestRotaExigeEscopo` com as 5 rotas novas. Chave do snippet em `/api/projects` → **403** (curl) |
| Projetos conectados e formulários rastreados gravados na API | ✅ | Tabelas `ConnectedProject` e `TrackedForm` (+ `ApiToken.env/projectId` por `ADD COLUMN`), também em `apps/studio/prisma/schema.prisma` (que nem tinha `ApiToken`). CRUD em `connect_projects.go`; integração em MySQL (`TestIntegrationConnect`: migração de `ApiToken` antiga, criar/editar/remover formulário, coluna precisa ser tipo Lead do funil, arquivar). Navegador: projeto e formulário criados pela tela, sobrevivem ao recarregar |
| Endpoint do `connect.js` e API direta criam **Lead v2**, não Oportunidade | ✅ | `POST /api/connect/leads` (+ `GET /api/connect/config`, `GET /connect.js`). Integração: `Lead` com `origin=INBOUND`, funil/coluna/fonte do projeto, pessoa reaproveitada por e-mail (2 envios → 1 `Contact`, 2 leads), contadores do projeto/formulário, linha `create` no histórico, **0 linhas em `Opportunity`**. `POST /api/public/leads` **não foi alterado** (D6) |
| Limite de taxa por token e por IP | ✅ | `TestEntradaLimiteDeTaxa` (3/min por IP → 4º recebe 429 com `Retry-After`; por chave com IPs diferentes). Navegador/curl, padrão 10/min por IP: rajada de 14 → `201` seguido de `429` ×13. Observação: o balde do IP conta **toda** tentativa (inclusive 401/403), de propósito |
| Validação de `Origin` por projeto | ✅ | URL do projeto + origens extras (`https://*.vercel.app` aceito). `curl` com `Origin: http://localhost:8766` → **403**; no navegador, a LP em 8766 foi bloqueada (sem CORS) tanto no `/config` quanto no `POST`; a LP em 8765 enviou com **201**. Preflight (sem token) devolve CORS só para o preflight; a resposta real só leva `Access-Control-Allow-Origin` se a origem passa |
| Honeypot | ✅ | `website` (corpo ou dentro de `lead`) preenchido → `201 {"ok":true}` sem gravar (teste e `curl`) |
| `connect.js` carrega só uma chave publicável | ✅ | Servido pela API (`connect_script.js` embutido); tag `<script src=".../connect.js" data-key="kld_…" defer>`. Valida o formato, busca a configuração do projeto, escuta `submit` no documento (vale para modais), não impede o envio normal, não injeta CSS. Teste garante que o script não carrega chave nenhuma |
| `Projects.tsx` real com a API ligada, aviso some | ✅ | Navegador (admin 5176 logado, API 8090): sem banner "Dados de exemplo", abas Projetos/Integrações/Chaves, estado vazio, criar projeto, formulário, chave. Com a API **fora do ar** (admin em 5177 apontando para porta morta) a tela é o exemplo com o aviso, como antes (também removi o "fase 5" desatualizado do aviso) |
| Emissão/revogação reutilizando os componentes do WP1.1 | ✅ | A aba **Chaves de API** é o próprio `TokensTab`; `CreateTokenPanel` ganhou "Tipo de chave" (servidor × snippet de um projeto), ambiente e projeto; `RevealBox` mostra a tag do snippet. Nada duplicado |
| **D13**: desativar pessoa lista os tokens que ela criou e pede confirmação; listagem mostra o criador | ✅ | Navegador: Gerente Gil criou "Zapier do Gil"; **Desativar** abriu o diálogo listando o token ("continuam valendo depois que a pessoa sai") com *Cancelar* / *Desativar mesmo assim*. Depois de confirmar o token seguiu `ACTIVE` na API e a lista mostra "Gerente Gil" como criador. Lógica pura testada (`activeTokensOf`) |
| 403 sem `forms:write`, 401 revogado | ✅ | `curl` real: token `leads:read` na entrada → **403** ("não tem o escopo forms:write"); chave revogada → **401**; chave inventada → **401**; sem chave → **401**. Também nos testes |
| Formulário HTML de teste pelo `connect.js` com `kld_test_`, lead aparece no admin | ✅ | Página em `localhost:8765` (origem do projeto) com a tag colada e o formulário `#form-contato`; clique em Enviar → evento `kalidash:lead` `{ok:true,status:201}`. **Leads** no admin lista "Maria Souza · Q4 Sales › Novos · Inbound · LP Consultoria · tags Fale conosco, Teste" |
| Atrás das flags; nada muda com elas desligadas | ✅ | `TestConexaoDesligadaSemAsFlags` (404 nos três handlers; `CRM_API` sem `AUTH_API` também não liga); rotas só registradas com `connectEnabled()`; admin em modo exemplo conferido no navegador |
| Testes e builds | ✅ | `go vet .` limpo. `go test -count=1 .`: **85 PASS, 6 SKIP** (sem `TEST_DSN`); com `TEST_DSN` (MySQL em memória): **91 PASS, 0 SKIP**. Admin: `npm test` **54 PASS** (+2: `activeTokensOf`, snippet), `tsc -b` e `npm run build` limpos, `oxlint` sem avisos nos arquivos novos/alterados |
| Docs | ✅ | `docs/pagesAdmin/projects.md`, `docs/inbound-leads.md`, `docs/ARCHITECTURE.md` (status, tabelas, seção do Connect reescrita), `docs/auth-study.md`, `apps/api/.env.example` |

## (b) Arquivos alterados

API (novos): `connect_projects.go`, `connect_ingest.go`, `connect_script.js`, `connect_test.go`, `connect_integration_test.go`. Alterados: `auth_tokens.go` (env, projectId, `validateTokenScopes`), `auth_scopes.go` (3 escopos, `Publishable`, rotas `/api/connect/*` públicas e `/api/projects*` em `keys:manage`, presets do Gerente), `auth_middleware.go` (bypass de CORS/credencial para `/api/connect/`), `auth_store.go` (colunas e migração), `main.go` (schema e rotas), `auth_scopes_test.go`, `apps/studio/prisma/schema.prisma`, `.env.example`.
Admin (novos): `components/ProjectsLive.tsx`, `lib/connectSync.ts`, `lib/snippet.ts`. Alterados: `pages/Projects.tsx`, `pages/Settings.tsx` (D13), `components/Access.tsx`, `lib/accessSync.ts`, `lib/scopes.ts`, `tests/scopes.test.ts`.
Docs: os quatro acima. Não editei `docs/po/admin-checklist.md`.

## (d) O que ficou de fora e por quê

- **`analytics:write` e `ads:read` sem rota**: não há tabela de eventos/visitas nem sincronização de anúncios no pedido. A tela real mostra envios, último envio, fonte e funil; **visitas, conversão e origem principal do mock não existem** na versão real (não inventei números).
- **Webhook de entrada** (Zapier/Typeform/Meta) e **empresa/CNPJ, `LeadSubmission`, tarefa "Informar CNPJ", automação `formulario.enviado`, tempo real**: o contrato de `inbound-leads.md` é maior que este recorte; fiz pessoa + lead + histórico + contadores.
- **Turnstile/reCAPTCHA**: só honeypot, `Origin` e limites.
- **Página de exemplo com preview ao vivo** do mock antigo: trocada por instruções, `curl` e HTML de teste copiável. O navegador envia `Origin` real, então o teste de verdade precisa de uma página servida na origem do projeto (como fiz em 8765).
- **Migração do `POST /api/public/leads` para Lead v2**: é do WP3 (D6); intocado. Até lá, **não ligar `NEXT_PUBLIC_LEAD_ENDPOINT` com tráfego real**.
- Sem **análise por formulário** (visualizações) e sem **escopos por recurso**.
- Sem chave "secreta" de escrita separada: a API direta usa a mesma chave `forms:write` do projeto (sem `Origin`).

## (e) Riscos

1. **Chave no HTML + `Origin` forjável.** Quem copia a chave do HTML e chama com `curl` (sem `Origin` ou com `Origin` falso) cria leads, limitado a 10/min por IP e 60/min por chave, e cada lead leva `tokenId`/`via` em `customData`. É o desenho (mesmo risco de qualquer chave publicável). Mitigação: revogar a chave (vale na hora) e filtrar por `customData.via`/`tokenId`.
2. **IP vem de `X-Forwarded-For`** (como no resto da API): atrás do proxy do EasyPanel/Traefik vale o IP real; um proxy que não sobrescreve o cabeçalho deixaria o limite por IP contornável, e o IP de um escritório inteiro é um balde só.
3. **Limites em memória** (janela deslizante por processo, como o `/api/public/leads`): reiniciar zera, e com mais de uma réplica cada processo conta o seu.
4. **Chaves `kld_test_` criam leads reais** (com tag *Teste* e `customData.test`), de propósito para aparecerem no admin; é preciso filtrar/arquivar.
5. **MySQL real não exercitado**: testado em go-mysql-server. As migrações (`ADD COLUMN` condicionado, `CREATE TABLE IF NOT EXISTS`) e o `INSERT` do lead em transação precisam rodar num MySQL/MariaDB descartável junto do roteiro do WP3 (`TEST_DSN=… go test -run IntegrationConnect`). Observação: o go-mysql-server falha ao **reiniciar** a API sobre o mesmo banco (`Column "bodyJson" already exists`, do `ensureBlogSchema`, anterior ao WP2); não é do meu código, mas vale confirmar em MySQL real.
6. **Funis do admin × servidor**: o seletor de funil usa as pipelines carregadas pelo admin (`WORKFLOW_API=1`); com `WORKFLOW_API` desligado o servidor aceita qualquer id válido, sem conferir a coluna.
7. A `Origin` do projeto é só esquema+host+porta; `https://*.vercel.app` (se cadastrado) aceita qualquer projeto Vercel. Cadastre só o que é seu.
8. Havia mudanças de outras sessões não commitadas (`apps/site`, `docs/po/*`); não incluí nenhuma nos meus commits (`git add` só dos meus arquivos).

## (f) O que o Gustavo precisa fazer

1. Tudo do WP1/WP1.1 continua valendo (OAuth, `AUTH_ROOT_ADMIN`, backup antes de ligar). Para a conexão, ligar **`CRM_API=1` e `AUTH_API=1`** (e `WORKFLOW_API=1` para escolher funil pelo admin). `ensureConnectSchema` cria `ConnectedProject` e `TrackedForm` e acrescenta `ApiToken.env/projectId`; **backup antes**.
2. Conferir a **URL pública da API** (o `connect.js` é servido por ela; as páginas colam `<script src="https://SUA-API/connect.js" data-key="…">`) e garantir que o proxy repassa o IP real em `X-Forwarded-For`.
3. Em **Projetos**, conectar cada LP com a URL exata (e `www`, se houver), escolher o funil/coluna de leads, cadastrar o seletor do formulário e emitir uma chave **de teste**; mandar um envio e conferir em **Leads**; só então emitir a de produção. Revogar chaves de projetos desativados.
4. **Não** apontar o formulário do diagnóstico da Home para o endpoint novo sem decidir o WP3 (continua em `/api/public/leads`, que cria oportunidade).
5. Rodar a suíte em MySQL/MariaDB real e descartável antes de ligar (risco 5).
6. Decisão de produto pendente: queremos uma chave de **servidor** com escrita de leads separada da chave do HTML (hoje é a mesma `forms:write` por projeto)?
