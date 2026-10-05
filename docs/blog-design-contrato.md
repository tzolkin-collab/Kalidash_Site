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
| **Home** — estrutura (HTML) | `apps/site/src/app/home/HomePage.tsx` (+ `HomeHeader.tsx`, `Carousel.tsx`, `DiagnosticoForm.tsx`) |
| **Home** — design | `apps/site/src/app/home/home.module.css` |
| **Home** — textos, links e imagens | `apps/site/src/app/home/content.ts` (itens PENDENTE marcados) |

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

## Home (LP)

A Home segue o mesmo contrato: o CSS só reage a tags e a estes atributos (todos em `HomePage.tsx`).
As cores e a largura do conteúdo são variáveis no topo de `home.module.css` (`--ink`, `--purple`,
`--accent`, `--gray-1`, `--gray-2`, `--container`, `--gutter`): trocar a identidade é mexer ali.

| Seletor | O que é |
|---|---|
| `[data-block="home-header"]` | cabeçalho fixo (logo, menu, "Fazer Diagnóstico"); no celular vira menu hambúrguer |
| `[data-block="home-hero"]` | título e texto de abertura |
| `[data-block="home-problem"]` | seção "O problema…": foto recortada, cartão roxo e 4 colunas |
| `[data-block="home-testimonial"]` / `[data-block="home-clients"]` | depoimento e faixa de logos de clientes |
| `[data-block="home-journey"]` | "Do desafio à solução": cartão + imagem (carrossel) |
| `[data-block="home-method"]` | "Método validado": imagem à esquerda, texto à direita |
| `[data-block="home-cases"]` | "Transformação que acontece de verdade": carrossel de fotos |
| `[data-block="home-diagnostico"]` / `[data-block="diagnostico-form"]` | chamada e formulário do diagnóstico |
| `[data-block="home-footer"]` | rodapé |
| `[data-role="chip"]`, `"text-link"`, `"rail"`, `"arrows"`, `"slide"`, `"case-card"`, `"problem-card"`, `"problem-quote"` | peças reutilizadas dentro das seções |

Medidas de referência: o design é de **1920 px** (container de 1280 px; títulos de 55 px; texto de 22 px).
Abaixo de **1100 px** o layout empilha. Fonte: Inter.

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
| site | `NEXT_PUBLIC_LEAD_ENDPOINT` | URL pública de `POST /api/public/leads` na API (sem isto o formulário valida e avisa que o envio não está conectado) |
| api | `ALLOWED_ORIGINS` | origens que podem chamar a captura pública de lead (aceita `https://*.vercel.app`); `SITE_URL` também conta |
| site | `NEXT_PUBLIC_WHATSAPP_URL` | link do WhatsApp (botão flutuante); vazio = o botão leva ao formulário |

## Checagem rápida depois de mexer no CSS

Abra o admin → Blog → Galeria principal → "Lado a lado" e confira desktop e celular (botões
no topo do preview). O iframe mostra o que vai para o ar.
