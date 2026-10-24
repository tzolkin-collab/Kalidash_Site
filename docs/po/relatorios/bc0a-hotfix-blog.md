# BC-0a — Hotfix do blog (API + admin) — relatório de entrega

> Worker: sessão BC-0a, 24/10/2026. Legenda: ✅ feito e comprovado · ⚠️ parcial · ❌ não feito.

## 0. Ponto de partida (honestidade)

O brief dizia "nada foi escrito antes", mas ao retomar **grande parte do BC-0a já estava no HEAD**, varrida para dentro do commit `877309b` do Antigravity (`feat(blog): corte e enquadramento…`): `slugify` novo, `isReservedSlug`, PUT sem slug, `handleBlogSlugAvailable`, `applyGalleryHybridOrder`, `resolveAssetUrl`, `checkSlugAvailable`, `credentials: 'include'` em `lib/blog.ts`, `blog_test.go` e `blog_slug.test.ts`. Não refiz do zero: **auditei** e corrigi/completei. O que eu mudei de fato está nos 3 commits da seção 3.

Defeitos que achei no que já existia:
- **Q14 errada:** o "resto" saía na ordem da consulta (destaque primeiro), não por data; a `blog-global` entrava na grade como se fosse artigo.
- **409 de slug repetido só funcionava se o texto do erro fosse "Duplicate entry"**; no go-mysql-server virava 500. Agora detecta o erro 1062.
- O teste `TestApplyGalleryHybridOrderOrdering` **reimplementava a lógica dentro do teste** (não testava o código). Removido; lógica extraída para `orderGallery` (pura) e coberta de verdade.
- **Nenhum teste exercitava POST/PUT/GET no banco.** Agora há integração.
- O aviso de slug em uso era só tooltip: agora é texto visível e Salvar fica desabilitado.
- Reservados não eram configuráveis.

Ambiente: MySQL em memória (go-mysql-server, `127.0.0.1:3327`, binário em scratchpad fora do repo); API de verificação compilada de um `git archive` do HEAD, rodando de pasta sem `.env` (porta 8095, `AUTH_API=1`, `AUTH_DEV_LOGIN=1`); admin em 5195; um servidor estático falso em 3399 como "site". Nenhum `.env` real lido, nada escrito na 8080. Tudo encerrado ao fim.

## 1. Checklist (seção 4 de `blog-cms.md`)

| Item | | Evidência |
|---|---|---|
| `slugify("Éxito na Operação")=="exito-na-operacao"`, `"Öffnung"→"offnung"`, só símbolos/outro alfabeto → não vazio e determinístico | ✅ | `TestSlugify` (9 casos), `TestSlugifyDeterministicFallback` (`???`, emoji → `artigo-<hash>`, entradas diferentes → hashes diferentes), `TestSlugifyLetrasExtras` (`ł`, `đ`, `þ`). Acrescentei `ł đ ð þ ı`. **Limite:** letras com marca combinada fora do mapa (ex.: `ẵ`, `ź`) viram hífen (`Đà Nẵng`→`da-n-ng`); sem `x/text` não há NFD. |
| `PUT` sem slug gera do título; nunca grava vazio; conflito → 409 claro | ✅ | `TestIntegrationBlogSlugs` (MySQL): PUT com slug `"  "` e título novo → `offnung-do-mercado`; PUT só com id preserva o slug; PUT para slug de outro artigo → 409 "Já existe um artigo…"; POST duplicado → 409 (antes, 500 no MySQL em memória); id inexistente → 404. |
| Slug reservado (`blog-global` + lista configurável) → 409 em POST e PUT | ✅ | Mesmo teste: POST com `blog-global`, ` NOVO `, e título "Blog Global" (gerado) → 409 "reservado"; PUT para `blog-global` → 409; `BLOG_RESERVED_SLUGS=contato, Sobre` → POST "Sobre" → 409. A Galeria existente (`blog-global`) continua salvável por PUT (testado). |
| `GET /api/blog/slug-available?slug=&exceptId=` autenticado com `AUTH_API=1`; admin mostra a disponibilidade | ✅ | Teste de integração: livre, em uso (`taken`), `exceptId` do próprio artigo, `reserved`, `empty`, normalizado (`Éxito Novo`→`exito-novo`), POST → 405. `TestSlugAvailableExigeEscopoDoBlog`: `routeScope` = `blog:read`, não pública. **Navegador:** digitando `segundo-artigo` o editor mostra "✗ /blog/segundo-artigo já está em uso por outro artigo." e Salvar fica desabilitado; `blog-global` → "é um endereço reservado pelo sistema."; `Éxito Novo da Operação` → ✓ e salvou como `exito-novo-da-operacao`. |
| Ordem da galeria na API: artigo publicado novo nunca fica de fora (Q14) | ✅ | `TestIntegrationBlogGaleriaNaoDescartaArtigoNovo` (MySQL): sem cartões → ordem de sempre (`a3,a2,a1`); Galeria curada `[a1,a3]` com repetido, rascunho e id apagado → `a1,a3,a2,g`; publicando `a4` depois → `a1,a3,a4,a2,g`; lista do admin continua trazendo rascunhos. `TestOrderGalleryPura`. Contrato em `docs/pagesClient/blog.md`. A leitura no site é do BC-0b. |
| Imagens com URL relativa do template aparecem no admin | ✅ | `resolveAssetUrl` (`lib/site.ts`, já no HEAD; 3 testes em `blog_slug.test.ts`) usado na capa do editor e nos cartões. **Navegador:** artigo com `coverImageUrl="/kalidash-hero-sculpture.png"` abre com a capa; `img.src = http://localhost:3399/kalidash-hero-sculpture.png`, `naturalWidth` 512, captura confirma. |
| Com `AUTH_API=1` o admin do blog continua funcionando | ✅ | Com a API em `AUTH_API=1`, `GET /api/blog/articles` sem sessão → 401 `{"error":"faça login"}`; no navegador, após o login (dev) a lista aparece, o artigo abre, **cria** ("Öffnung do Mercado" → slug `offnung-do-mercado`), **edita**, **troca de slug** e salva (`credentials: 'include'` já estava em `lib/blog.ts`; `lib/auth.ts` também força `include` no `fetch` global). Não testei **upload** (R2 não configurado: "upload fica indisponível"). 🟡 O login real (Google) não foi exercitado; só o dev login. |
| Testes, `go vet`, build, navegador, nada em produção | ✅ | Ver seção 2. |

## 2. Comandos

- `go vet .` limpo. `go test -count=1 .` ok. `TEST_DSN='root:@tcp(127.0.0.1:3327)/kalidash_test' go test -count=1 .` ok (inclui os 3 testes novos de integração do blog).
- Admin: `npm test` 60/60, `npx tsc -b` limpo, `npm run build` ok (o aviso `-clear-icon` do CSS já existia).
- ⚠️ Com `parseTime=true` no `TEST_DSN` outro teste, `TestIntegrationPipelineTaskGate` ("com archived=1 deveria vir 1 arquivado"), falhou na minha primeira rodada (antes de eu mudar nada nele). É de funil, território do WP3b; não investiguei. Os testes do blog reabrem a conexão com `parseTime=true` por conta própria (a produção usa assim; sem isso o Scan de `DATETIME` quebra).

## 3. Arquivos e commits

Mine: `5f6393d` fix(api) — `apps/api/blog.go`, `blog_test.go`, `blog_integration_test.go` (novo); `3d82a3d` fix(admin) — `apps/admin/src/pages/Blog.tsx` (aviso visível, placeholder honesto); `611fe2f` docs — `docs/pagesClient/blog.md`, `docs/ARCHITECTURE.md`. Este relatório. Não toquei em `apps/site`, `lib/site.ts` (tem mudança de porta 3000→3001 não commitada de outra sessão), `main.go`, `auth_scopes.go`.

## 4. O que ficou de fora

- **Troca de slug ainda não deixa rastro** (404 na URL antiga): é o BC-1 (`ArticleSlugHistory` + 301). O `notifySite` revalida o caminho antigo, que passa a 404.
- `revalidate.go`, `storage.go`, `PreviewFrame.tsx`: sem mudança necessária.
- Normalização Unicode completa do slug (ver limite acima).

## 5. Riscos

1. Quem já tem artigo com slug reservado (`novo`, `tag`…) continua editando (só bloqueio na troca para reservado), mas não consegue criar outro igual.
2. A API da Galeria pública agora devolve o `blog-global` **no fim** da lista (antes entrava por data). O site atual acha a Galeria por slug, então não deve quebrar; confirmar no BC-0b.
3. `slug-available` tem janela de corrida (checa e depois salva): o `UNIQUE` do banco continua sendo a barreira final (409).
4. Testado só no go-mysql-server, não em MySQL/MariaDB real.

## 6. O que o Gustavo precisa fazer

- Nada para ligar: sem flag nova. `BLOG_RESERVED_SLUGS` é opcional.
- Em produção, quando o BC-0b entrar, conferir que a Galeria salva não esconde artigo novo.
- Despublicar o `artigo-teste-template` (Q1) até existir `noindex`.

## 7. O que o site precisa ler (BC-0b, Antigravity)

Ver "Contrato da API do blog" em `docs/pagesClient/blog.md`: usar a ordem da lista pública `?published=true` como ordem final da grade (sem `flatMap` por cartões), tirar o `blog-global` da grade e dar 404 em `/blog/blog-global`, ler o `blog-global` por slug só para o hero; capas relativas resolvem na origem do site.
