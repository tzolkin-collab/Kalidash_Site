# Auditoria do Blog (pré-CMS) — relatório de entrega

**Pacote:** auditoria somente leitura, 18/10/2026. **Único arquivo criado:** este relatório. Nenhum arquivo do repositório editado, nenhum commit.
**Escopo:** leitura de `docs/` e do código do blog (site, admin, API) + auditoria no navegador + proposta de modelo de CMS.

## 0. Como a auditoria foi feita (e os limites)

| Item | Estado |
|---|---|
| Docs lidos | ✅ checklist (§5, §6), `blog-design-contrato.md`, `pagesClient/blog.md`, handoff do BlockNote, `r2-setup.md` |
| Código lido | ✅ `apps/site/src/app/blog/*`, `preview/*`, `lib/blog.ts`, `lib/api.ts`, `api/revalidate`, `sitemap.ts`, `robots.ts`, `next.config.ts`, `layout.tsx`; admin `Blog.tsx`, `articleCardBlock.tsx`, `PreviewFrame.tsx`, `lib/blog.ts`; API `blog.go`, `storage.go`, `revalidate.go` (+ rotas em `main.go`) |
| Navegador | ✅ site (3000) e admin (5173) já estavam no ar; viewports 1440 e 375. **Só GETs** contra a API de `localhost:8080` (`/api/blog/articles?published=true`, `/api/blog/article`). Nenhum clique em Salvar/Excluir/Publicar; no admin só abri artigos e digitei `/` num artigo **novo** sem salvar |
| Banco descartável | ⚠️ **não subi**: nada foi escrito, então não foi preciso. Consequência: **não testei escrita** (slug vazio, conflito de slug, redirecionamento, upload R2). Esses itens estão marcados "só código" |
| Experimento de paridade do editor | ✅ rodei `BlockNoteEditor.create()` + `blocksToHTMLLossy`/`tryParseHTMLToBlocks` no navegador (módulo já servido pelo Vite) com o HTML do artigo-template e com um bloco de cada tipo. Nada gravado |
| `.env` / credenciais | ✅ não abri `apps/api/.env`, não li `scratch/reseed_blog.js` nem `scripts/test.go` (o handoff avisa que têm senha de produção) |
| **Árvore de trabalho do site está suja** | ⚠️ `views.tsx`, `[slug]/page.tsx`, `article.module.css` estão **modificados e não commitados**; `ReadingProgressBar.tsx` e `ShareButtons.tsx` são **novos e não rastreados** (Antigravity). O que descrevo do site é o que está **no disco agora**, não o que está no `HEAD` nem em produção |

## 1. Fluxo ponta a ponta de um artigo

```
ADMIN (Vite/React)                         API (Go)                          SITE (Next 16, ISR)
──────────────────                         ────────                          ───────────────────
/blog/novo                                                                    
 título, resumo, capa, slug, SEO, cats     
 BlockNote (blogSchema)                    
   ├─ editor.document ───────► bodyJson ┐
   └─ blocksToHTMLLossy ─────► body     │  POST/PUT /api/blog/articles
 [Salvar]  ───────────────────────────────►  slugify(slug|título)
                                            INSERT/UPDATE Article (MySQL)
                                            publishedAt = 1ª vez que published=1
                                            notifySite(["/blog","/blog/<slug>"]) ──► POST /api/revalidate
                                              (goroutine, 5 s, só se SITE_URL        (x-revalidate-secret, regex
                                               e REVALIDATE_SECRET)                    ^/blog(/[a-z0-9-]+)?$)
                                                                                        revalidatePath(...)
Upload de imagem (capa/BlockNote)                                                      
 uploadImage() ──► POST /api/blog/upload ─► sniff (jpeg/png/gif/webp), ≤8 MB, ≤40 MP,
                                            EXIF, resize ≤2000 px, JPEG q85 / PNG alfa
                                            PUT no R2 `blog/<tempo>-<rand>.<ext>`
                                            ◄── { url: R2_PUBLIC_URL/... }  (só a URL volta)
                                                                                    
Leitor                                      GET /api/blog/article?slug=  ◄──────  fetchArticleBySlug (revalidate 60)
 /blog/[slug]  ◄── ArticleView(views.tsx) ◄─ só published=1                       generateStaticParams + generateMetadata
   body entra por dangerouslySetInnerHTML                                          /blog: lê bodyJson de "blog-global" p/ ordem

Preview (iframe) = SITE_URL/preview/article|blog (noindex, no-store, frame-ancestors=ADMIN_ORIGINS)
 admin ◄─ kalidash:preview-ready ── site ;  admin ─ kalidash:preview {payload} ─► site (mesmo ArticleView, sem API)
 clique no iframe ─ kalidash:focus {focus, blockId, text} ─► admin foca o campo/bloco
```

### Pontos frágeis por elo

| Elo | Fragilidade | Evidência | Gravidade |
|---|---|---|---|
| Slug | `slugify` só troca **minúsculas** acentuadas: `"Éxito na Operação"` → `xito-na-operacao`; `"Öffnung"` → `ffnung`; títulos em outro alfabeto ou só símbolos → `""` | rodei a mesma função em Go (`go run`) | incomoda (perde letras) |
| Slug | **PUT não gera slug do título**: a tela diz "deixe em branco pra gerar do título", mas no `PUT` `a.Slug = slugify(a.Slug)` sem fallback → salva `""` (e o 2º artigo sem slug bate no `UNIQUE`) | `blog.go` PUT; só código | incomoda/bloqueia ao editar |
| Slug | Nada impede um artigo normal de usar `blog-global` (o slug reservado da Galeria) | `blog.go` / `Blog.tsx` | incomoda |
| Slug | **Trocar slug não deixa rastro**: a URL antiga vira 404, sem redirecionamento nem histórico; o `notifySite` revalida o caminho antigo (que passa a 404) | `blog.go` PUT, `articlePaths(previousSlug, new)` | incomoda (SEO, links compartilhados) |
| Salvar | `body` (HTML) e `bodyJson` são enviados juntos, sem validação no servidor de que são coerentes; qualquer cliente HTTP pode gravar HTML arbitrário | `blog.go` | risco (ver §4, XSS) |
| Salvar | Artigo sem `bodyJson` (9 de 11 hoje) é reconvertido HTML→blocos na entrada do editor e o **próximo Salvar sobrescreve o HTML original** pelo export "lossy" (ex.: callout vira `<p>`) | experimento no navegador (§2) | **bloqueia** edição segura do artigo-template |
| Publicar | `featured` ("Destaque — ocupa o bloco grande") **não afeta o layout do site**: o destaque é o 1º cartão da Galeria. `featured` só muda a ordem da API quando a Galeria nunca foi salva | `page.tsx` (`galleryOrder`) vs. texto do switch em `Blog.tsx` | engana o editor |
| Publicar | **Depois que a Galeria é salva uma vez com cartões, artigos novos publicados não aparecem em `/blog`**: `items = order.flatMap(id => byId.get(id) ?? [])` descarta tudo que não está na lista de cartões. Hoje funciona porque o `bodyJson` da galeria em produção **não tem nenhum `articleCard`** (a lista vem da ordem da API); o primeiro "Salvar" da Galeria no admin liga o problema | `blog/page.tsx`; `bodyJson` da `blog-global` lido da API pública | **bloqueia** (silencioso) |
| Revalidar | Fire-and-forget: se o site estiver fora ou o segredo errado, só sai `log.Println`; o admin mostra "Salvo" e o site demora até 60 s. Sem retry/fila. `/sitemap.xml` não é revalidado (depende do `revalidate:60` do fetch) | `revalidate.go`, `route.ts` | cosmético/incomoda |
| Renderizar | Falha da API em runtime **lança erro** (mantém a última página boa no ISR — bom), mas `/blog` inteiro fica sem fallback; `generateStaticParams` com API fora no build gera 0 páginas (ok, gera sob demanda) | `lib/blog.ts` | ok |
| Renderizar | `/blog/blog-global` responde **200** (é um artigo publicado) e renderiza o texto da galeria como se fosse artigo; fora do sitemap, mas sem `noindex` | `curl` → 200; `fetchArticleBySlug` não exclui o slug | incomoda |
| Preview | Funciona e é o mesmo componente (`ArticleView`), **mas** não mostra "Continue explorando" (`relatedArticles` vazio no preview), categoria cai em "AI Culture" se vazia, e o título vazio renderiza `<h1>` vazio | `preview/article/page.tsx`; captura de `/blog/novo` | cosmético |
| Preview | **URLs relativas de imagem quebram no admin** (`/kalidash-hero-sculpture.png`, `/brand/logo-white.svg` do artigo-template): no editor viram imagem quebrada ("Capa" sem foto) porque a origem é `:5173`; no iframe funcionam (origem do site) | `naturalWidth=0` em `localhost:5173/...`; captura | incomoda |
| Upload | Sem login até o WP1 ligar `AUTH_API`; **não guarda largura/altura nem texto alternativo**; sem limpeza de órfãos; nunca rodou contra o R2 real (diz `r2-setup.md`); a UI do BlockNote só recebe a URL | `storage.go`, `uploadFile: uploadImageNotifying` | incomoda |
| Preview↔Auth | O admin chama a API **sem token** nas funções de `lib/blog.ts` (sem `Authorization`/credenciais); com `AUTH_API=1` o blog do admin deixa de funcionar | `lib/blog.ts` (fetch simples) vs. WP1 | 🟡 HIPÓTESE: não testei com sessão ligada; depende de como o WP1 injeta a sessão |

## 2. O artigo "de template" e o inventário de blocos/assets

### 2.1 Onde está o conteúdo de referência

| Fonte | O que é | Evidência |
|---|---|---|
| **`artigo-teste-template`** — "Template Editorial: Todos os Assets e Componentes" | Artigo **publicado na API de produção**, criado em 18/10/2026 23:29. Autor "Carol Sales", capa `/kalidash-hero-sculpture.png`. Cobre: inline (negrito/itálico/sublinhado/tachado/código/link), H2, H3, ul, ol, checklist, citação, "callout", bloco de código TS, `hr`, tabela 4×3, figura centralizada com legenda | `GET /api/blog/articles?published=true`; HTML lido por inteiro |
| `scratch/create_test_article.js` (gitignored, não lido por ter credencial no entorno) | Provável gerador desse artigo (contém `<blockquote>`, `<pre>`, `<table>`, `<figure data-text-alignment="center">`) | `grep` de tags apenas |
| `scratch/reseed_blog.js`, `setup_blog_hero.js`, `add_images.js`, … | Scripts de seed/migração antigos (gitignored). Não abri por causa das credenciais | — |
| Mocks | `apps/admin/src/mocks/posts.ts` foi removido (cliente real usa API). O admin ainda usa `mocks/team` para a lista de autores | `Blog.tsx` importa `teamStore` |
| Os outros 10 artigos publicados | 8 têm **1 parágrafo de texto** ("Em breve, publicaremos o artigo completo aqui"), 1 tem `bodyJson` curto (checklist), 1 é a galeria | contagem pela API |

**Limite do template:** ele foi escrito **à mão em HTML** (sem `bodyJson`) e usa marcações que o BlockNote **não gera** (`.bn-callout`, `data-callout-type`, `ul.bn-check-list`, `li.bn-check-list-item`). Ele prova o que o **CSS** cobre, não o que o **editor** produz. Também está **no sitemap e na galeria pública** com título de teste.

### 2.2 Experimento: o que o BlockNote realmente exporta (e o que perde ao reabrir o template)

Ao reabrir o `artigo-teste-template` no admin (só leitura): 11 parágrafos, 6 H2, 1 H3, 3 bullet, 4 numerados, 3 check, 1 quote, 1 código, 1 divisor, 1 tabela, 1 imagem; **nenhum bloco "callout"** (o `div.bn-callout` foi achatado em `<p>💡 …</p>`). Salvar reescreveria o `body`.

### 2.3 Matriz de paridade (tipo × definição × editor × preview × site publicado)

Legenda: ✅ ok · ⚠️ parcial · ❌ não funciona. "Definição" = onde o tipo nasce; "CSS" = `article.module.css` (artigo) salvo indicação.

| Tipo | Definido em | Editor | Preview | Site | Observação / evidência |
|---|---|---|---|---|---|
| Parágrafo + inline (b/i/u/s/código) | BlockNote default → `blocksToHTMLLossy` → `.body p` | ✅ | ✅ | ✅ | |
| Link | inline `link` | ✅ | ✅ | ⚠️ | export traz `rel="noopener noreferrer nofollow"` **em todo link (inclusive interno)** e atributo lixo `classname="bn-inline-content-section"` |
| Cor de texto/fundo, alinhamento | props de bloco/estilo | ✅ | ✅ | ✅ | vira `style` inline (paleta clara do BlockNote); o site não controla (conflita com a regra "admin não escreve CSS", ver §6) |
| H1 | default (`Título` no menu `/`) | ✅ | ✅ | ⚠️ | gera **2º `<h1>`** na página (o título já é `<h1>`); `.body h1` não tem CSS |
| H2, H3 | default, `.body h2/h3` | ✅ | ✅ | ✅ | `data-level` supérfluo |
| **H4–H6** | default (menu oferece) | ✅ | ✅ | ❌ | sem CSS no `.body`; Tailwind zera o tamanho → parece parágrafo |
| Lista marcadores / numerada | default; `.body ul/ol` | ✅ | ✅ | ✅ | aninhadas saem com `data-nesting-level`, sem teste visual |
| **Lista de verificação** | default `checkListItem` → `<ul><li data-checked><input>` | ✅ | ✅ | ❌ | CSS mira `.bn-check-list`, `ul[data-type="checkList"]`, `li[data-type="checkListItem"]` — **nenhum bate** com o export real (`li[data-checked]`). Na captura: bolinha + checkbox + texto quebrado na linha de baixo |
| Lista/Título **expansível** (toggle) | default | ✅ | ✅ | ⚠️ | export `<details><summary>`; sem CSS (visual de navegador) |
| Citação | default `quote` → `<blockquote>` | ✅ | ✅ | ✅ | sem campo de autoria |
| **Callout** | só CSS (`.bn-callout`) | ❌ | ❌ | ⚠️ | **não existe como bloco**; só renderiza se alguém escrever HTML à mão no banco |
| Bloco de código | default `codeBlock` | ✅ | ✅ | ✅ | sem destaque de sintaxe; idioma só em `data-language` |
| Divisor | default → `<hr>` | ✅ | ✅ | ✅ | |
| Tabela | default → `<table>` sem `thead`, `<p>` dentro de `td` | ✅ | ✅ | ⚠️ | **mobile: tabela de 534 px num container de ~335 px, cortada** (coluna "Impacto" some); `td p` herda margem inferior |
| **Imagem com legenda** | default `image` → `<figure data-text-alignment …><img width=…><figcaption>` | ✅ | ✅ | ✅ | `alt` = **nome do arquivo** (`data-name`), não descrição |
| **Imagem sem legenda** | idem | ✅ | ✅ | ⚠️ | export é `<img alt="">` **sem `<figure>`**: perde raio, sombra, margem e **alinhamento** (o CSS mira `.body figure img`) |
| Vídeo / Áudio / Arquivo | default (menu oferece) | ✅ | ⚠️ | ❌ | exporta `<video src>`/`<audio src>` **sem `controls`** (invisíveis) e `<a>` cru; sem CSS; e o upload só aceita imagem |
| Emoji | menu `/` | ✅ | ✅ | ✅ | texto |
| **Cartão de artigo** (`articleCard`) | custom: `articleCardBlock.tsx` (propSchema articleId/title/excerpt/cover/pos/meta/author) | ✅ só na Galeria | ✅ | ⚠️ | no site os cartões **não são HTML**: o site só lê a **ordem dos `articleId`**; edição de título/resumo/capa grava de volta no Article |
| Capa do artigo | campo `coverImageUrl/Pos` | ✅ | ✅ | ✅ | só corte vertical 0–100; sempre 16:9; `alt` = título do artigo; `<img>` simples, sem width/height/lazy |
| Autor | campo `authorName` (lista vem de `mocks/team`) | ⚠️ | ✅ | ✅ | avatar = 2 iniciais; cargo "Kalidash Intelligence" fixo no `views.tsx` |
| Categorias | `categories` JSON | ✅ | ✅ | ⚠️ | só a **1ª** aparece; fallback "AI Culture" hardcoded; sem páginas de categoria |
| Resumo | `excerpt` texto | ✅ | ✅ | ✅ | |
| Data | `publishedAt` | — | ✅ (agora) | ✅ | sem "atualizado em" |
| CTA final, "Continue explorando", compartilhar, barra de progresso | hardcoded em `views.tsx`/componentes | — | ⚠️ | ✅ | **não são conteúdo**: o admin não edita CTA; relacionados = os 2 primeiros publicados (não relacionados) |
| Hero da Galeria | `bodyJson/body` de `blog-global` (HTML via `dangerouslySetInnerHTML`) | ✅ | ✅ | ✅ | CSS posicional (`:first-child` = etiqueta, `:last-child` = apoio): fica frágil se o editor reordenar |
| `BlogSettings` (`/api/blog/settings`) | tabela + rota + `BlogSettingsForm` | ⚠️ | — | ❌ | **código morto**: o site não lê (confirmado no handoff e em `fetchBlogSettings`, que ninguém chama) |
| SEO da **Galeria** (campos no admin) | `seoTitle/Description` de `blog-global` | ✅ (grava) | — | ❌ | `/blog` tem `metadata` fixo em `page.tsx`; os campos são ignorados |

## 3. Auditoria funcional no navegador

Preview do site (1440 e 375 px) e do admin. Bugs priorizados, com passos:

### Bloqueia
1. **Gallery: novo artigo some depois da 1ª edição da Galeria.** Passos: admin → Blog → Galeria principal → Salvar (grava os `articleCard`) → publicar um artigo novo → `/blog` não o mostra (código em `blog/page.tsx`; não executei a escrita, só li e confirmei que hoje o `bodyJson` público da galeria não tem cartões).
2. **Editar o artigo-template destrói o conteúdo "extra".** `/blog/1792366154683136700` no admin → o callout já vem como parágrafo; Salvar grava isso em `body`.

### Incomoda
3. **Tabela cortada no celular** (375 px): `/blog/artigo-teste-template` → seção 5. Coluna "Impacto" fora da tela, `overflow:hidden` na tabela, sem rolagem horizontal.
4. **Lista de verificação quebrada** (desktop e celular): bolinha + checkbox + texto em linha separada (seletor de CSS não bate).
5. **Capa e imagens com URL relativa quebram no admin** (editor mostra "Capa" sem imagem).
6. **`<title>` duplicado**: "Template Editorial: Todos os Assets | Kalidash | Kalidash" — `seoTitle` já traz o sufixo e o `title.template` do layout acrescenta outro.
7. **Erro de hidratação** (console + selo "1 Issue" do Next dev) em `ShareButtons`: o servidor renderiza as URLs de LinkedIn/X com `url=` vazio (usa `window.location` no render); no HTML inicial e para crawlers, os links compartilham **nada**.
8. **Teste publicado em produção**: o artigo-template está na galeria pública, no sitemap e com título de teste (decisão do PO: despublicar/marcar `noindex`).
9. **`/blog/blog-global` público (200)**, sem `noindex`.
10. **Slug**: acento maiúsculo e slug vazio (§1).
11. **Cartões da Galeria ficam desalinhados**: com capa × sem capa os títulos começam em alturas diferentes na mesma linha (capturas do desktop), 6 de 9 cartões não têm capa.
12. **"Continue explorando" repete sempre os mesmos 2 artigos** e mistura card com capa e sem capa.
13. **Editor da Galeria em tela média**: cartão do editor corta o controle "Trocar capa" e o slider de corte; Galeria só tem hero + cartões, sem filtro, paginação ou categorias.

### Cosmético
14. Menu `/` oferece H1, H4–H6, vídeo, áudio, arquivo e toggles que o site não trata (ver matriz).
15. Preview do artigo novo mostra "AI Culture" e data de hoje antes de existir categoria/data.
16. Cabeçalho do artigo (`HomeHeader`, claro, encolhe o logo para "K" ao rolar) e da Galeria (cabeçalho próprio, escuro) são **sistemas diferentes**; navegar entre os dois troca de tema inteiro (decisão de tema do handoff continua em aberto).
17. Alvos de toque de 20 px de altura no breadcrumb e em "Voltar ao Blog" no celular.

**Não consegui verificar:** upload real (R2), arrastar bloco/redimensionar imagem (o handoff também não conseguiu), qualquer escrita, comportamento com `AUTH_API=1`, Lighthouse/CWV medidos (uso apenas leitura de código e DOM).

## 4. SEO e técnica de `/blog/[slug]`

| Item | Estado | Evidência |
|---|---|---|
| `generateMetadata` | ⚠️ existe: `title` (seoTitle→title), `description` (seoDescription→excerpt), `openGraph` (title, description, type=article, publishedTime, authors) | `[slug]/page.tsx` |
| Título duplicado | ❌ sufixo "\| Kalidash" duas vezes quando `seoTitle` já o contém | `<title>` capturado |
| Open Graph **imagem** | ❌ ausente: o `openGraph` da página **substitui** o do layout, então some `og:image` e `og:site_name`/`og:locale`; a capa do artigo nunca vira `og:image` | metas capturadas |
| Twitter | ⚠️ `twitter:title/description/image` vêm do **layout** (genéricos: "Kalidash — Eficiência…" + escultura), não do artigo | metas capturadas |
| Canonical | ❌ nenhum (`alternates.canonical` não definido) em `/blog` nem em `/blog/[slug]` | DOM |
| JSON-LD (`Article`, `BreadcrumbList`) | ❌ nenhum, apesar do breadcrumb visual existir | `script[type=application/ld+json]` = 0 |
| `robots` | ✅ `index, follow`; `robots.txt` bloqueia `/preview/` e `/api/`; `X-Robots-Tag: noindex` em `*.vercel.app` | `curl`, `next.config.ts` |
| Sitemap | ⚠️ inclui artigos publicados com `lastModified=updatedAt`; **inclui o artigo de teste**; exclui `blog-global`; `SITE_URL` fixo `kalidash.com.br` | `curl /sitemap.xml` |
| Slugs | ❌ ver §1 (acento maiúsculo, vazio, reservado, sem histórico/redirect) | |
| Mudança de slug | ❌ 404 sem redirecionamento 301 | `blog.go` |
| Imagens | ❌ `<img>` simples (não `next/image`): sem `width/height` (CLS), sem `loading="lazy"` na capa/galeria (`loading=auto`), sem `srcset`, sem AVIF/WebP automáticos (o R2 mantém JPEG/PNG; WebP/GIF sobem como vieram); `alt` da capa = título, `alt` do corpo = nome do arquivo. Origem das capas existentes: outro CDN (`…-1800x1200.jpg`), 🟡 HIPÓTESE: Sanity legado | DOM |
| Core Web Vitals (prováveis) | ⚠️ **LCP**: `PixelTransition` cobre a página por 1,4 s em toda carga (e não respeita `prefers-reduced-motion`); capa sem dimensões/`priority`; **CLS**: imagens sem `width/height`; **INP**: `ReadingProgressBar` usa `setState` por scroll (leve, passivo). Fontes: 4 famílias Google carregadas no layout global (Fraunces, Archivo, Newsreader, Manrope) | código; não medido com Lighthouse |
| Tipografia declarada × real | ❌ `article.module.css` usa `--font-inter`/`--font-source-sans`, **que não existem** no layout; o corpo renderiza em **Archivo** (fallback) | `getComputedStyle` |
| Acessibilidade | ⚠️ 1 `<h1>`, hierarquia H2/H3 correta no template, `lang="pt-BR"`, landmarks `main/nav/header/footer`, `aria-label` no breadcrumb e nos botões de compartilhar, `role=progressbar`. **Faltam:** link "pular para o conteúdo", `:focus-visible` (o CSS da Galeria tem **0** regras de foco; o do artigo 6), 6 `<nav>` sem rótulo distinto, `alt` de imagens do corpo = nome do arquivo, contraste do link/etiqueta `#b6644d` sobre claro ≈ **4,1:1** (< 4,5:1 para texto normal) | cálculo de contraste, CSS |
| Estados de erro / 404 | ⚠️ slug inexistente → 404 correto; rascunho por slug → 404 (API filtra `published=1`). **Sem `not-found.tsx` do blog** (usa o padrão do Next) e sem `error.tsx` próprio: API fora em runtime lança erro (mantém ISR; sem página de erro amigável) | `curl` 404; `lib/blog.ts` |
| ISR e cache | ✅ `revalidate = 60` + `revalidatePath` sob demanda; `x-nextjs-cache: HIT`. ⚠️ Cabeçalho `Cache-Control: no-cache, must-revalidate` na página (CDN não guarda sem a Vercel); `/api/blog/articles` público devolve **lista com `bodyJson`, `body` de todos os artigos** (payload cresce; sem paginação nem `fields`) | `curl -D` |
| Segurança de conteúdo | ⚠️ o corpo entra por `dangerouslySetInnerHTML` **sem sanitização** (nem no servidor Go nem no site). Hoje só o admin escreve, mas `POST/PUT /api/blog/articles` aceita HTML arbitrário de qualquer cliente. Antes de abrir o CMS a mais pessoas: sanitizar (allow-list de tags/atributos) | `views.tsx`, `blog.go` |
| Anotação à parte | `apps/site/public/` contém, **no disco**, `CNH-e.pdf.pdf` e `CONTRATO KALIDASH EDITADO - TZOLKIN.docx`, que **não estão rastreados** no git (então não vão no deploy), mas são servidos pelo dev server. Fora do escopo do blog; sugiro o Gustavo tirá-los da pasta pública | `ls`, `git ls-files` |

## 5. Crítica visual de design (capturas feitas em 1440 e 375 px)

**Capturas (descritas):**
- *A — Artigo, topo, desktop.* Cabeçalho do site claro, "← Voltar ao Blog" em terracota, breadcrumb à direita, selo "DESIGN SYSTEM", data e "2 min de leitura", H1 grande em Archivo bold, resumo em cinza, barra do autor (avatar roxo com iniciais) + "Copiar link/WhatsApp/LinkedIn/X", capa em cartão com raio 18 px.
- *B — Artigo, meio, desktop.* Coluna de 760 px a 18,4 px/1,85, H2 grandes, lista de verificação quebrada, citação com barra terracota, callout.
- *C — Código/tabela/figura.* Bloco escuro com sombra, tabela com cabeçalho em caixa-alta e linhas zebradas, figura centralizada com legenda cinza pequena.
- *D — CTA + "Continue explorando".* Cartão roxo escuro com brilho terracota; abaixo, dois cartões brancos de tamanhos diferentes (um sem capa).
- *E — Artigo, mobile.* H1 35 px, resumo 20 px, tabela cortada, bandeira de compartilhar em duas linhas.
- *F — Galeria, desktop/mobile.* Hero escuro com "na era dos agentes." em lilás; 1º cartão claro em largura total; demais em duas colunas escuras com 1 px de linha.

### O que está bom
- **Largura de leitura e corpo**: 760 px, ~18 px, entrelinha 1,85 — muito confortável. Títulos com `text-wrap: balance`.
- **Hierarquia do topo do artigo**: meta → título → resumo → autor está clara e editorial.
- **Bloco de código e CTA** têm acabamento próprio; citação com barra lateral é legível.
- **Galeria**: o destaque claro em largura total contra a grade escura cria foco; o mobile empilha bem, sem rolagem horizontal.
- **Preview fiel**: o iframe usa o mesmo componente, então o que o admin vê é o que sai.

### O que está fraco
- **Dois universos visuais** (Galeria escura/Manrope × Artigo claro/Archivo) sem transição pensada; cabeçalhos diferentes.
- **Ritmo vertical do corpo**: `h2` com 2,2 em de margem e parágrafos com 1,4 em funcionam, mas listas/citações/figuras/tabelas usam margens próprias (1,5–2,4 em) — o ritmo salta. Parágrafo dentro de `td`/`li` herda margem.
- **Capa** sempre 16:9 e com arredondamento/sombra pesados; sem variante "sem capa" (o artigo sem capa fica com um vazio no topo, a verificar) nem "capa lateral".
- **Cartões da Galeria**: altura mínima 440 px com 6 de 9 sem capa → blocos grandes e vazios; duas capas muito diferentes (preto técnico × foto) quebram a coesão; título começa em alturas diferentes.
- **"Continue explorando"** por ordem, não por relação (categoria/tag); mistura com/sem capa.
- **Citação** só em itálico + faixa; não há citação de destaque (pull quote) em largura maior.
- **Imagens sem legenda** (o caso padrão do editor) ficam sem tratamento — pior parte da "paridade".
- **Barra de progresso** 3 px terracota: boa ideia, mas sem rótulo visual; funciona. **Navegação entre artigos**: só voltar ao blog e relacionados; sem anterior/próximo, sem sumário (TOC) em artigos longos.
- **Mobile**: tabelas cortadas, alvos de toque pequenos, compartilhar quebra em duas linhas.

### O que quebra
Tabela no celular, lista de verificação, imagem sem legenda sem estilo, H4–H6 sem estilo, vídeo/áudio sem controles, callout inexistente no editor.

### Melhorias concretas (sem implementar), priorizadas
1. **P0** — Tabela: contêiner com `overflow-x: auto` e `min-width` por coluna (ou empilhar em cartões < 600 px).
2. **P0** — Lista de verificação: seletores `li[data-checked]` + `input[type=checkbox]` alinhado em flex, sem bullet.
3. **P0** — `figure`/`img` sem legenda: aplicar o mesmo tratamento a `.body img` e ler `data-text-alignment` do pai; alt editável.
4. **P1** — Unificar tema/cabeçalho entre `/blog` e `/blog/[slug]` (decisão do PO/Carol).
5. **P1** — Cartões: altura por conteúdo (`min-height` menor), cartão sem capa com bloco tipográfico (inicial/categoria em destaque), alinhar título por `grid-template-rows: subgrid`; padrão de capa 3:2 consistente.
6. **P1** — Relacionados por categoria, com `aspect-ratio` fixo e placeholder de capa; botão "Anterior/Próximo".
7. **P1** — CSS para H4–H6, `details/summary`, `video/audio` (`controls` ao exportar), `.pull-quote`, `callout` real com variantes (`info|warning|success`).
8. **P2** — Ritmo: um único espaçamento vertical em `--space-block` aplicado a todos os blocos; margem zero para `td p`/`li p`.
9. **P2** — TOC lateral para artigos com ≥ 4 H2; tempo de leitura e "atualizado em".
10. **P2** — Contraste do terracota em texto pequeno (escurecer para ≥ 4,5:1) e `:focus-visible` consistente; `prefers-reduced-motion` no `PixelTransition`.

## 6. Modelo de dados e CMS necessários

### 6.1 Requisitos do dono do produto
Slugs livres; escolher/reposicionar/duplicar blocos; trocar assets; SEO por artigo; **layouts por artigo e por bloco**; tudo **sem o admin escrever CSS** — só valores enumerados que o CSS do site interpreta (como `data-variant` hoje).

### 6.2 Três abordagens

| | **A. Estender o `bodyJson` (blocos customizados + props enumeradas)** | **B. `layout/sections` separado + renderizador de blocos no site** | **C. Híbrida (recomendada)** |
|---|---|---|---|
| Ideia | Novos blocos BlockNote (`callout`, `cta`, `columns`, `embed`, `figure` com `variant/width`…) com props enumeradas; o site continua recebendo **HTML exportado** (`body`) com `data-*` | O artigo vira lista de seções JSON (`{type,variant,data}`); BlockNote só edita texto dentro de uma seção "texto rico"; o site monta tudo por um renderizador React | `bodyJson` (árvore BlockNote com blocos customizados e **props enumeradas**) é a fonte; um **renderizador no site lê o JSON** (não o HTML); campo `layout` por artigo (JSON enumerado) e colunas de SEO; `body` HTML vira **derivado/legado** |
| Prós | Menor mudança; preview/admin já funcionam; migração quase nula; reaproveita `createReactBlockSpec` (já existe `articleCard`) | Layout muito flexível; separa conteúdo e apresentação; fácil validar | Mantém a UX de edição atual; elimina o abismo editor↔HTML (paridade vira teste de snapshot); permite layout por artigo **e** por bloco; sanitiza por construção (sem `dangerouslySetInnerHTML`) |
| Contras | Continua dependendo do **export HTML "lossy"** (perde o que o BlockNote não exporta: callout, check, vídeo); layout por artigo exige colar `data-*` no `<article>`; difícil testar paridade; `dangerouslySetInnerHTML` permanece | Rebaixa a experiência (BlockNote só em sub-blocos), **reescreve o editor**, migra todo artigo; risco de virar page-builder (custo alto, Notion-like perdido) | Dois consumidores do mesmo JSON (editor e site) → precisa de **pacote de esquema compartilhado**; mais trabalho inicial que A |
| Custo | **Baixo/médio** (≈ 1–2 semanas) | **Alto** (≈ 4–6 semanas) | **Médio** (≈ 3–4 semanas, em pacotes) |
| Risco de migração | Baixo (nada muda no banco; artigos sem `bodyJson` continuam) | **Alto** (converter 11 artigos + galeria, perda de formatação) | **Baixo/médio**: artigos com `bodyJson` rendem direto; os 9 só com `body` entram como 1 bloco `legacyHtml` (sanitizado) até alguém reeditar |
| Impacto no preview | Nenhum (continua iframe) | Preview precisa do novo renderizador (o site, de qualquer forma) | Preview passa a receber o **JSON** (não HTML) e usa o **mesmo renderizador** do site → fidelidade maior |
| Cobre "layout por bloco"? | ✅ via props | ✅ | ✅ |
| Cobre "layout por artigo"? | ⚠️ gambiarra (prop num bloco-capa ou coluna) | ✅ | ✅ (`layout` JSON) |

### 6.3 Recomendação: **C (híbrida)**, em passos que não exigem reescrita
Motivos: preserva o editor Notion-like decidido no handoff; corrige a causa raiz dos bugs da §2 (HTML "lossy" × CSS); mantém a regra de ouro (admin escolhe valores, site decide CSS); abre caminho a rascunhos por link, versões e testes de paridade.

**Modelo proposto**

```
Article (colunas novas, todas opcionais para não quebrar o existente)
  layout        JSON NULL   -- { template, hero, width, cta, related, toc }   (enumerados)
  ogImageUrl    VARCHAR(500) NULL
  canonicalUrl  VARCHAR(500) NULL
  noindex       TINYINT(1) DEFAULT 0
  schemaVersion INT DEFAULT 1       -- do bodyJson, p/ migrações
  updatedBy     VARCHAR(64) NULL
ArticleSlugHistory (articleId, slug, createdAt)  -- p/ 301
ArticleRevision    (id, articleId, bodyJson, layout, createdAt, author) -- opcional (P3)
Asset              (id, url, width, height, alt, bytes, mime, createdAt, refCount) -- opcional (P2)

Catálogo enumerado (packages/blog-schema, usado por admin E site)
  article.layout.template : standard | wide | longform
  article.layout.hero     : cover-top | cover-wide | cover-side | none
  article.layout.cta      : default | minimal | none | custom(blockId)
  article.layout.related  : auto-category | manual | none
  block.props.width       : text | wide | full
  block.props.align       : left | center | right
  block.variant           : por tipo (callout: info|warning|success; image: plain|framed|bleed; quote: default|pull; columns: 2|3 …)
```
O CSS do site interpreta `[data-template]`, `[data-hero]`, `[data-width]`, `[data-variant]`; o admin só grava valores do catálogo (validados no servidor com o mesmo esquema → 400 se fora do catálogo).

### 6.4 Pacotes de trabalho (ordem, dependências, arquivos, aceite)

| Pacote | Conteúdo | Depende de | Arquivos (previsto) | Aceite testável |
|---|---|---|---|---|
| **WPB-0 Hotfix e decisões** | slugify com maiúsculas/outros alfabetos, slug vazio no PUT, reservar `blog-global`, `/blog/blog-global` → 404/noindex, decidir sobre o artigo de teste, imagens relativas no admin, hidratação do `ShareButtons`, galeria **não** descartar artigos novos | PO decidir o artigo de teste | `blog.go` (+ teste Go), `Blog.tsx`; **site** (precisa alinhar com Antigravity): `blog/page.tsx`, `[slug]/page.tsx`, `ShareButtons.tsx` | testes Go: `slugify("Éxito")=="exito"`, PUT sem slug gera do título, POST `blog-global` → 409; `/blog/blog-global` → 404; abrir o template no admin mostra capa; console sem erro de hidratação; publicar artigo novo após salvar a galeria aparece em `/blog` |
| **WPB-1 SEO e slugs** | colunas `ogImageUrl/canonicalUrl/noindex`; `ArticleSlugHistory` + 301; `generateMetadata` completo (canonical, OG imagem, Twitter por artigo, `title.absolute`), JSON-LD `Article`+`BreadcrumbList`, `metadata` da Galeria a partir da `blog-global`; sitemap sem `noindex`; checagem de slug livre (`GET /api/blog/slug-available`) | WPB-0 | `blog.go`, schema, `Blog.tsx` (painel SEO), `[slug]/page.tsx`, `blog/page.tsx`, `sitemap.ts`, `next.config.ts`/middleware p/ redirect | trocar slug → URL antiga responde 301 p/ a nova; HTML tem `canonical`, `og:image`, JSON-LD válido (validador do Google); título sem duplicar; teste de unicidade (409 + mensagem clara) |
| **WPB-2 Esquema compartilhado + blocos novos + renderizador** | `packages/blog-schema` (tipos, enums, validação); blocos custom: `callout`, `cta`, `figure` (alt editável, largura/alinhamento), `embed`/vídeo com `controls`, `pullQuote`, `columns`; renderizador React no site a partir do `bodyJson`; `legacyHtml` p/ artigos antigos (sanitizado); sanitização do `body` | WPB-0 (pode paralelo a WPB-1) | `packages/blog-schema/*`, `articleCardBlock.tsx`→`blocks/*`, `Blog.tsx`, **site** `blog/renderer/*`, `views.tsx`, CSS | fixture dourada (o conteúdo do artigo-template reescrito em `bodyJson`) renderiza igual no preview e no site (snapshot); matriz da §2.3 sem ❌; tabela rola no celular; HTML arbitrário no `body` é sanitizado (teste) |
| **WPB-3 Layout por artigo e por bloco** | colunas `layout`; seletores no admin (template, hero, largura, CTA, relacionados); `data-*` no site; validação no servidor; CTA editável | WPB-2 | `blog.go`, `Blog.tsx` (painel), `views.tsx`, `article.module.css` (Carol/Antigravity) | trocar `template` muda o visual no preview e no site sem CSS no admin; valor fora do catálogo → 400; artigo sem `layout` renderiza como hoje |
| **WPB-4 Operações de bloco e assets** | duplicar/mover/substituir bloco e imagem (UI), biblioteca de assets (R2 com largura/altura/alt), limpeza de órfãos, `next/image`/`srcset`, upload com login | WPB-2; WP1 (auth) | `storage.go`, `Blog.tsx`, novo `AssetPicker`, tabela `Asset` | trocar a imagem de um bloco mantém posição/alt; imagem renderiza com `width/height` (CLS=0 na captura); upload exige sessão |
| **WPB-5 Galeria como CMS** | layouts de galeria (`featured/default/wide/compact`), filtro por categoria, paginação, cartão sem capa, relacionados por categoria | WPB-3 | `blog/page.tsx`, `views.tsx`, `articleCardBlock.tsx`, `blog.module.css` | galeria lista todo artigo publicado mesmo fora da ordem salva; filtro por categoria; mobile sem desalinhamento |
| **WPB-6 Rascunho/versões (opcional)** | `ArticleRevision`, preview de rascunho por link com token, agendamento | WPB-2 | `blog.go`, `Blog.tsx` | restaurar versão anterior; link de rascunho expira |

**Coordenação com o Antigravity:** WPB-0 (parte site), WPB-2, WPB-3 e WPB-5 tocam `apps/site` e o CSS; precisam ser feitas **na sessão que já trabalha lá** ou depois de a árvore estar commitada. WPB-1/4 podem começar na API/admin.

### 6.5 Perguntas de produto para o PO / Carol
1. O que fazemos com o `artigo-teste-template` (está público, no sitemap e na galeria)? Despublicar, `noindex` ou virar a "página-modelo" interna?
2. **Tema:** Galeria escura e Artigo claro são intencionais, ou unificamos? (pendente desde o handoff de 30/09.)
3. "Layout por artigo": quais **templates** a Carol quer de fato (ex.: padrão, longform, destaque com capa grande, landing de campanha)? Quantos blocos de **largura total/colunas**?
4. O admin deve poder **mudar cor/tipografia de texto** (hoje o BlockNote aplica cor/fundo inline) ou só escolher variantes (regra de ouro)? Recomendo remover cor livre.
5. Quem pode publicar/editar: Admin/Gerente/Vendedor? Haverá **revisão/aprovação** e **versões**?
6. **URL:** manter `/blog/[slug]` ou aceitar também categorias/aninhamento (`/blog/categoria/slug`)? Slug trocado deve sempre redirecionar (301)?
7. **Idiomas:** só pt-BR? (afeta `lang`, hreflang, slug por idioma.)
8. **Autor:** vem de usuários reais (Auth/WP1) ou do mock de equipe? Perfil público com foto e cargo?
9. **CTA e relacionados:** o texto do CTA muda por artigo/categoria? Relacionados manuais ou por categoria?
10. **Categorias** viram entidade (página, cor, descrição) ou continuam tags livres?
11. **Mídia:** vídeo (YouTube/Vimeo embed ou upload)? Limite de peso? AVIF/WebP obrigatório? Quem pode apagar assets?
12. Domínio final do site (`SITE_URL`) e quando o R2 real será ligado (nunca testado).
13. **Agendamento** de publicação e "atualizado em" visível?
14. A **Galeria** deve listar tudo automaticamente (ordem por data/destaque) ou continuar curada à mão? (muda a correção do bug "artigo novo some".)
15. Métricas: precisamos de leituras/cliques por artigo no CRM (liga com WP2 de projetos conectados)?

## 7. O que ficou de fora e por quê
- **Escrita real** (criar/salvar/publicar, slug conflitante, redirecionamento, upload R2): fiz leitura apenas porque a API local é produção e não subi MySQL descartável; os pontos de escrita estão marcados "só código".
- **Medição de Lighthouse/CWV** e verificação por leitor de tela: avaliei por código e DOM.
- **Arrastar/redimensionar** blocos: já era limitação conhecida do handoff.
- **`AUTH_API=1`** no blog do admin: não exercitado.
- **Scripts em `scratch/`**: não abertos (credenciais); apenas a lista de nomes e `grep` de tags.

## 8. Riscos
- Site com mudanças **não commitadas** de outra sessão: parte da auditoria pode mudar quando elas forem commitadas.
- Qualquer "Salvar" da Galeria hoje liga o bug de artigos novos sumindo (§1); qualquer "Salvar" do template achata o callout.
- Corpo sem sanitização + rotas de escrita abertas sem `AUTH_API`: antes de o CMS multiusuário existir, ligar auth e sanitizar.
- Mudar o formato (opção C) mexe em site, admin e API ao mesmo tempo: precisa de fixture dourada e de flag (`BLOG_CMS_V2`) para voltar ao render por HTML.

## 9. O que o Gustavo / PO precisa fazer
1. Responder as perguntas da §6.5 (principalmente 1, 2, 3, 4 e 14).
2. Decidir quem fecha o commit do site (Antigravity) antes do WPB-0/WPB-2.
3. Mover `CNH-e.pdf.pdf` e o contrato `.docx` para fora de `apps/site/public/`.
4. Confirmar o domínio final e testar o R2 real quando for ligar o upload.
