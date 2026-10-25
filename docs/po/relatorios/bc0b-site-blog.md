# BC-0b — Site do blog (hotfix + SEO base) — relatório de entrega

> Worker: sessão BC-0b, 24/10/2026. Legenda: ✅ feito e comprovado · ⚠️ parcial · ❌ não feito.
> Coordenação: antes de começar, `git status` e `git log` em `apps/site/src/app/blog` mostraram **nenhuma mudança não commitada** do Antigravity (último commit `877309b`, 19/10). Nada foi revertido.
> Ambiente: servidor falso em Node (fora do repo, scratchpad) servindo `GET /api/blog/articles?published=true` e `/api/blog/article?slug=` na 8099, `API_URL=http://localhost:8099`, site via `next build` + `next start -p 3055`. Nada escrito na 8080, nenhum `.env` lido ou gravado. Dados: galeria curada `[2,1,4(rascunho)]` sem o artigo novo `3`, rascunho, `blog-global` (com SEO), artigo com tabela, lista de verificação, imagens sem legenda, H4–H6, `details`, `video`.

## 1. Checklist

| Item | | Evidência |
|---|---|---|
| **A** Galeria usa a ordem da API, sem `flatMap`, sem `blog-global` na grade, hero/SEO por slug | ✅ | `curl /blog`: `<h2>` na ordem `Segundo → Primeiro → Artigo NOVO (fora da curadoria) → Template`; rascunho e `blog-global` ausentes. Navegador: hero do `blog-global` + 1º cartão = "Segundo artigo curado". |
| **B** `/blog/blog-global` 404 e fora do sitemap; nenhum reservado vaza | ✅ | `curl`: `/blog/blog-global` 404, `/blog/rascunho` 404; `sitemap.xml` lista só `/blog` e os 4 artigos; `generateStaticParams` não gera `blog-global` (build). Só o slug `blog-global` é tratado como reservado no site (os demais reservados da API só bloqueiam criação). |
| **C** `ShareButtons` sem `window.location` | ✅ | HTML do servidor já traz `linkedin…url=https%3A%2F%2Fkalidash.com.br%2Fblog%2Fartigo-teste-template` e WhatsApp com título + URL; console do navegador (build de produção) sem erro de hidratação; único 404 é o `x.mp4` falso do teste. Obs.: em produção o texto do erro é minificado; não rodei `next dev` para ver o overlay. |
| **D** SEO por artigo + `/blog` | ✅ (com ressalva do `noindex`) | `<title>Template Editorial \| Kalidash</title>` (um sufixo só; artigo sem "Kalidash" no seoTitle sai `X \| Kalidash`); `canonical`; `og:title/description/url/site_name/locale/image(+alt)/type=article`, `article:published_time/modified_time/author`; `twitter:card=summary_large_image` + title/description/image do artigo; JSON-LD: 1 `<script>` com `Article` + `BreadcrumbList` parseável por `JSON.parse` (`<` escapado). `/blog`: título "Blog da Kalidash — SEO da galeria", descrição, canonical e OG vindos do `blog-global`; fallback ao texto antigo. **`noindex`**: ponto de extensão pronto (`robots: noindex, follow` + saída do sitemap), mas o campo `noindex` (e `ogImageUrl`/`canonicalUrl`) **ainda não existe na API (BC-1)**; não testei com valor `true`. |
| **E** Estilos do corpo | ✅/⚠️ | Medido no navegador a 390 px: tabela rola (`scrollWidth 771 > clientWidth 352`, `overflow-x:auto`) sem estourar a página (`docSW 390`); na 758 px do desktop não rola (758=758). Lista de verificação: `li` flex, `list-style:none`, checkbox e `<p>` na mesma linha, sem bullet; item marcado riscado. Imagem solta (`<img>` e `<div data-text-alignment><img>`) com raio 12 px e margem 2,4em; H4–H6 estilizados (H4 19,2 px); `details/summary` e `video/audio` com regras; `td p`/`li p` margem 0; `:focus-visible` no artigo e na galeria; breadcrumb e "Voltar ao Blog" com 44 px de altura (medido). ⚠️ Não verifiquei visualmente a 1440 px (o painel do navegador tem 1024 px; usei 1024 e 390), nem o alinhamento left/right de imagem solta, nem o foco por teclado em tela; `details`/`video` só por regra de CSS. |
| **F** Imagens | ✅ | HTML: capa `width=1600 height=900 fetchPriority=high decoding=async alt=<título>`; cartões `width=1280 height=720 loading=lazy`; relacionados idem. O CSS existente já fixa `aspect-ratio`, então não há mudança visual; os atributos evitam CLS pelo ratio. Dimensões são fixas (a API não guarda largura/altura reais). |
| **G** Home/institucionais/header/rodapé | ✅ | Não tocados. |

## 2. Comandos

- `npx tsc --noEmit` (apps/site): limpo. `npm run build` com a API falsa: ok (sem `fetch failed`); rotas SSG: `/blog/{segundo,primeiro,novo-artigo,artigo-teste-template}`.
- Não rodei `npm run lint` nem testes automatizados (o site não tem suíte); a prova é build + curl + navegador.

## 3. Arquivos e commits

`d90a8cb` (A, parte de D: `lib/blog.ts`, `lib/blogSeo.ts` novo, `sitemap.ts`, `blog/page.tsx`) · `b7b2161` (C, F: `ShareButtons.tsx`, `views.tsx`) · `1ca526b` (B, D: `blog/[slug]/page.tsx`) · `154919b` e `d7d1c4f` (E: `article.module.css`, `blog.module.css`; docs `docs/pagesClient/blog.md`). `docs/blog-design-contrato.md` não mudou (nenhum `data-*` renomeado). Em `views.tsx` só entrou a prop opcional `shareUrl` em `ArticleView` (o preview do admin não passa nada e cai em `SITE_URL/blog`).

## 4. O que ficou de fora

- Campo `noindex`, `ogImageUrl`, `canonicalUrl` e "atualizado em" reais: BC-1 (API/admin).
- `next/image`/AVIF/srcset e dimensões reais das imagens (BC-4).
- Relacionados por categoria, cartões sem capa, tema unificado, callout/pull-quote (BC-5 / decisão Q2).
- `ShareButtons` ainda mostra "Copiado!" mesmo se a cópia falhar (comportamento antigo, não alterei).
- Não toquei no `PixelTransition` (LCP) nem na tipografia declarada × real (`--font-inter` inexistente).

## 5. Riscos

1. `SITE_URL` cai em `https://kalidash.com.br` se `NEXT_PUBLIC_SITE_URL` não estiver definido na Vercel; canonical/og/JSON-LD apontariam para o domínio final mesmo em staging (intencional, mas confirmar o valor).
2. `og:image` da capa de template é caminho relativo (`/arquivo.png`) → vira URL do site; capas em outro CDN seguem como vêm. O logo do `publisher` no JSON-LD é o SVG branco (o Google prefere PNG/fundo claro): trocar quando houver o arquivo.
3. `modified_time`/`dateModified` usam `updatedAt` da API.
4. Cabeçalho `Cache-Control` e ISR de 60 s inalterados; a nova leitura do `blog-global` em `generateMetadata` reaproveita o mesmo `fetch` (cache de dados do Next), sem custo extra por requisição esperado — não medi.

## 6. O que o Gustavo e a Carol precisam fazer

- Gustavo: conferir `NEXT_PUBLIC_SITE_URL` na Vercel; despublicar `artigo-teste-template` (Q1) até o `noindex` do BC-1; olhar a Galeria em produção depois do deploy (artigo novo deve aparecer sozinho).
- Carol: preencher título e descrição SEO da Galeria Principal e de cada artigo no admin (agora são lidos); definir imagem de capa dos artigos (vira `og:image`).
