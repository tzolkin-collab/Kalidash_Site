# Blog — contrato entre design (site) e conteúdo (admin)

**Regra de ouro:** o design do blog vive **só** em `apps/site`. O admin nunca escreve CSS nem
importa CSS do site; o preview do admin é o **próprio site** dentro de um iframe. Quem mexe no
visual (Carol, IA) edita CSS no site e não quebra backend nem admin — desde que respeite os
atributos abaixo.

## Onde está cada coisa

| O quê | Arquivo |
|---|---|
| HTML das páginas (uma implementação só, usada no site real e no preview) | `apps/site/src/app/blog/views.tsx` |
| Design da galeria `/blog` | `apps/site/src/app/blog/blog.module.css` |
| Design do artigo `/blog/[slug]` | `apps/site/src/app/blog/[slug]/article.module.css` |
| Rotas de preview (só o iframe do admin usa) | `apps/site/src/app/preview/*` |
| Iframe + mensagens no admin | `apps/admin/src/components/PreviewFrame.tsx` |
| Aviso de "artigo mudou" (API → site) | `apps/api/revalidate.go` → `apps/site/src/app/api/revalidate/route.ts` |

## Atributos que o CSS pode (e deve) usar

O CSS reage a **tags** e a estes **atributos**. Pode mudar cores, tamanhos, grade, espaçamento,
fontes, animações. **Não renomeie nem remova os atributos** — o admin e o preview dependem deles.

### Galeria `/blog`

| Seletor | O que é |
|---|---|
| `[data-block="hero"]` | texto de abertura (HTML escrito no editor: `p`, `h1`, `div`, `span` colorido) |
| `[data-block="gallery"]` | grade de artigos |
| `[data-block="article-card"]` | cada cartão |
| `[data-variant="featured"]` / `"default"` | variante do cartão. Hoje o **1º cartão é `featured`** (regra de posição; é o admin que define a ordem) |
| `[data-role="cover"]` | imagem de capa do cartão |
| `[data-role="read-more"]` | link "Ler artigo" |

Dentro do cartão, os filhos diretos são: `p` (categoria · data), `h2` (título), `div` (resumo),
`span` (autor).

### Artigo `/blog/[slug]`

Elementos com `data-focus` (`meta`, `title`, `excerpt`, `author`, `cover`, `body`). O corpo
(`[data-block="article-body"]`) é HTML exportado pelo editor: `h2`, `h3`, `p`, `ul`, `ol`,
`li`, `blockquote`, `figure` (com `data-text-alignment="left|center|right"`), `img`,
`figcaption`.

### `data-focus` e `data-block-id`

Só servem ao preview: clicar num elemento com `data-focus` no iframe faz o admin focar o campo
ou bloco correspondente. **Mantenha-os** nos mesmos elementos.

## Como o admin escolhe layout sem escrever CSS

O admin só escolhe **valores** (hoje: a posição do cartão → `data-variant`). Para criar uma
variante nova (ex.: `wide`), o caminho é: (1) o CSS ganha `[data-variant="wide"]`; (2) o admin
ganha uma opção que grava esse valor no bloco; (3) `views.tsx` repassa o valor ao atributo.
O CSS decide como a variante se parece; o admin decide onde ela se aplica.

## Preview (como funciona)

1. O admin embute `SITE_URL/preview/blog` (galeria) ou `SITE_URL/preview/article` (artigo).
2. A rota avisa `kalidash:preview-ready`; o admin responde com o rascunho
   (`kalidash:preview`, **sem salvar**) a cada edição, com debounce de 150 ms.
3. Clique no preview → `kalidash:focus` → o admin foca o campo/bloco.
4. Segurança: só `NEXT_PUBLIC_ADMIN_ORIGINS` pode embutir (`frame-ancestors`) e mandar
   mensagens; as rotas `/preview/*` são `noindex` e sem cache.

## Publicação

Ao salvar/excluir um artigo, a API avisa o site (`POST /api/revalidate`, com
`REVALIDATE_SECRET`) e `/blog` e `/blog/[slug]` regeneram em ~2 s. Sem `SITE_URL` e
`REVALIDATE_SECRET` configurados nos dois lados, o site volta ao `revalidate = 60` (até 1 min).

## Variáveis de ambiente

| Onde | Variável | Para quê |
|---|---|---|
| site | `NEXT_PUBLIC_ADMIN_ORIGINS` | origens do admin autorizadas (vírgula) |
| site | `REVALIDATE_SECRET` | segredo do `/api/revalidate` |
| api | `SITE_URL`, `REVALIDATE_SECRET` | para onde e com que segredo avisar |
| admin | `VITE_SITE_URL` | URL do site para o iframe (padrão `http://localhost:3000`) |

## Checagem rápida depois de mexer no CSS

Abra o admin → Blog → Galeria principal → "Lado a lado" e confira desktop e celular (botões
no topo do preview). O iframe mostra o que vai para o ar.
