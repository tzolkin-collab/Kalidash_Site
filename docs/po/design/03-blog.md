# D3: Direção do Blog (lista, categoria, artigo)

> Designer D2/D3. Só direção e protótipo; nada em `apps/site` foi editado. Sistema em [00-sistema.md](00-sistema.md), [tokens.css](tokens.css) e [tokens-d2d3.css](tokens-d2d3.css). Contrato de dados: `docs/blog-design-contrato.md` (§5 abaixo prova que nenhum atributo mudou).
> Capturas "antes": [../relatorios/antes/d2-d3/](../relatorios/antes/d2-d3/) (`blog-*`, 1440 e 390; página inteira e dobra). Referências: [refs/](refs/) (`d2d3-*`). Protótipos: [proto/08-blog-lista.html](proto/08-blog-lista.html) (estados `#todos #cat #um #vazio`, mais o teste `#stress-hero`) e [proto/09-blog-artigo.html](proto/09-blog-artigo.html) (`#com-capa #sem-capa`); capturas em [proto/shots/](proto/shots/) (`08-*`, `09-*`).
> **Dados de teste.** O blog precisa da API. Usei um servidor falso fora do repo (7 artigos "Artigo de teste…", capas de `public/home/`, corpo com `h2`, `h3`, `p`, `ul`, `ol`, `blockquote`, `figure`, `figcaption`) e uma **cópia** do site fora do repo (em `:3299`), porque o `next dev` da `:3000` é de outra sessão. Nenhum dado de produção. Títulos, resumos e corpo dos protótipos são **fixtures** (`data-fixture`), não copy de código.

## 1. Diagnóstico do estado atual (visto)

### Lista `/blog` e categoria (`blog-lista-1440`, `blog-categoria-cases-1440`, `blog-lista-390`)
| Tell | Onde |
|---|---|
| **Grade de 3 cartões iguais** | linhas de 3 cartões idênticos (capa, categoria, título, resumo, autor, link) abaixo do destaque; é a regra de `.posts` com 6 colunas |
| Cartão dentro de cartão | o destaque é uma caixa com borda e 44px de padding **com a foto dentro de outro raio**; em categoria com 2 artigos, duas caixas gigantes lado a lado |
| Dois estilos de raio e sombra | raios 4, 8, 12, 14 e 999px no módulo; três sombras diferentes (`0 6px 22px`, `0 4px 16px`, `0 12px 28px`) |
| Hover que sobe com sombra | `.posts article:hover` (translate + sombra) |
| Pílula de contagem | filtro com "Todos 7" em botão com badge de 999px |
| Vazio dentro do cartão | cartão sem capa ("Terceiro artigo…") fica com ~150px de espaço morto entre resumo e autor, porque o cartão estica à altura do vizinho |
| Hero genérico | eyebrow + h1 + cinza à direita, o molde que o D0 manda tirar (aqui o hero é HTML do editor; o tratamento é de CSS) |
| Mobile | uma coluna de cartões com capa 16:9 e 6 linhas de texto cada: 4.454px de página para 7 artigos; nenhuma variação de ritmo |

### Artigo `/blog/[slug]` (`blog-artigo-dobra-1440/390`, `blog-artigo-1440`)
| Tell / problema | Onde |
|---|---|
| **Medida de leitura larga** | corpo 740px com 18,4px: medi **93–96 caracteres por linha** no 1440 (`proto/measure-check.mjs`). O confortável é 60–75 |
| Barra lateral colorida | `blockquote` com barra terracota |
| Selo de duas letras | avatar "EQ" do autor (tell "two-letter badges") |
| Caixa roxa de conversão | o bloco "Prepare sua operação…" é uma caixa roxa arredondada com dois botões lado a lado, dentro da coluna de 960px |
| Cartão em cartão | "Continue explorando": um contêiner com borda e 2 cartões divididos por filete |
| Redundância | "Voltar ao Blog" e a trilha "Início / Blog / Cases" na mesma linha dizem a mesma coisa (mantidas: é copy) |
| Compartilhar quebra no 390 | os 4 botões quebram e o "X" fica sozinho numa segunda linha (`blog-artigo-dobra-390`) |
| Capa | a foto de 1600×900 entra na mesma coluna de 912px do título: nada a distingue do texto; abre como mais um bloco |
| Hierarquia do corpo | `h2` 30px e `h3` 24px separados do parágrafo só por margem; sem hairline, sem escala; figura de retrato em tamanho natural (ocupa uma tela inteira de 900px) |

O que funciona e **fica**: título grande em Inter 500, tracking apertado; resumo em Source Sans; barra de progresso de leitura; botões de compartilhar; relacionados só com capa quando todos têm capa (regra do código); JSON-LD e metadados (não tocados).

## 2. Referências (abertas e vistas)

> Tamanhos e espaços das referências são estimados olhando as capturas (não medidos por ferramenta); as medidas **do nosso** site são de `getComputedStyle`/`Range`.

### 2.1 Stripe — /blog ([refs/d2d3-stripe-blog-vp.png](refs/d2d3-stripe-blog-vp.png)) e /blog/product ([refs/d2d3-stripe-blog-product-vp.png](refs/d2d3-stripe-blog-product-vp.png))
- **Composição:** destaque em duas colunas 7/5 (texto à esquerda, arte à direita) num painel único; depois, nas páginas de categoria, a abertura é **título de categoria + parágrafo**, e cada item tem uma **coluna de metadado à direita** (data, autores com foto) separada por um filete vertical tracejado; guias tracejadas mostram a grade.
- **Tipo:** um grotesco só; título do destaque ~40px peso 500, resumo ~20px, categoria em cor de marca ~15px.
- **Ar:** generoso: ~100px entre a abertura e o destaque; a coluna de texto do destaque é estreita (≈440px).
- **Detalhe:** raio ~4px nas imagens, sombra só no painel do destaque, hairlines claras; "Read more" em texto com seta, sem botão.
- **Herdo:** o **destaque 7/5** (foto grande + texto), o **metadado como coluna separada** (usado no índice: meta + autor à esquerda), o link de leitura como texto com seta.
- **Recuso:** o painel com sombra grande e o gradiente de fundo; guias tracejadas; autores com foto (não há dado de foto de autor).
- **Limite:** vi a abertura e o destaque; a lista de itens abaixo da dobra não carregou na captura. Não vi o índice completo.

### 2.2 Anthropic — /news ([refs/d2d3-anthropic-news-vp.png](refs/d2d3-anthropic-news-vp.png))
- **Composição:** **três colunas de larguras desiguais**: uma coluna estreita com itens empilhados (foto, título, resumo), o **item central largo com a foto grande**, e uma coluna direita de itens só de texto separados por **hairlines**; o tamanho da peça diz a importância; nenhuma caixa.
- **Tipo:** grotesco de peso médio; títulos 24 a 36px conforme a importância; resumo 16–17px cinza; **linha de metadado** (categoria · data) em ~14px acima do título.
- **Ar:** ~32px entre colunas; hairline de 1px separando linhas de texto; fundo creme.
- **Detalhe:** raio ~4px nas fotos, sem sombra, sem borda; o metadado vira "rótulo" cinza.
- **Herdo:** a **hierarquia por tamanho** (um destaque, dois médios, o resto em linhas com hairline), a metadado acima do título, fotos sem moldura.
- **Recuso:** o fundo creme (a Kalidash é branca), o botão de cookies, o item em vídeo.

### 2.3 Anthropic — artigo ([refs/d2d3-anthropic-article-vp.png](refs/d2d3-anthropic-article-vp.png))
- **Composição:** título **largo** (~820px) no topo; o corpo começa **deslocado para dentro** (≈2 colunas) com uma **coluna lateral** à direita (Published, Category, Topics em linhas com hairline).
- **Tipo:** título ~36px peso 500 tracking apertado; corpo em **serifa de ~21px, entrelinha ~1,6, coluna de ≈625px**; contei uma linha da captura: ~80 caracteres (estimativa a olho, não medida por ferramenta).
- **Ar:** ~100px antes do corpo; ~24px entre parágrafos.
- **Detalhe:** nenhuma barra, nenhuma caixa; links sublinhados; o metadado é tabela de duas colunas.
- **Herdo:** o **texto entra duas colunas** em relação ao título (o título e o corpo partilham a borda esquerda; a esquerda vazia é o ar), a **coluna de ≈625px** (a nossa dá 616px no 1440), o corpo em 20–21px, metadado em linhas ruled.
- **Recuso:** serifa (D0: uma família de título; corpo continua Source Sans), a coluna lateral de tópicos (não há tópicos no dado).

### 2.4 Every — home ([refs/d2d3-every-vp.png](refs/d2d3-every-vp.png)): **não serviu**
A dobra é uma promoção de evento (preto, serifa display, cartões de programação em mono); a lista de ensaios está abaixo da dobra e a captura não a alcançou. Vale como **contraexemplo** (cartões escuros com mono, "tell" de dev-tool). Não analisei a lista de ensaios; não é âncora.

### 2.5 Âncora do D3
- **Lista:** *Anthropic /news* (hierarquia por tamanho, hairlines, sem caixas) + *Stripe /blog* (destaque 7/5 e metadado em coluna).
- **Artigo:** *Anthropic, página de artigo* (texto deslocado, medida de ~65, corpo 20px).
Princípios, não layout; o sistema da Home e o D0 têm prioridade.

## 3. Direção (uma frase)

A lista deixa de ser uma **grade de cartões** e vira um **índice editorial**: um destaque 7/5 com a única sombra, dois médios lado a lado e o resto como **linhas ruled** (metadado | título e resumo | miniatura); o artigo ganha **medida de leitura de ~72 caracteres**, corpo em 20px, **capa larga 21:9** (o único objeto) e uma **faixa escura única** na conversão, no fim.

## 4. Seção por seção

Tokens do D0 + `--read-size 20px`, `--read-lh 1.7`, `--read-measure 62ch` ([tokens-d2d3.css](tokens-d2d3.css)). Raio 4 (controles) e 12 (fotos); **sombra só na foto-herói** (destaque da lista, capa do artigo).

### 4.1 Lista e categoria (`blog/views.tsx` → `BlogGalleryView`)

| # | Seção | Papel | Objeto protagonista | O que domina | Próximo passo | Tratamento |
|---|---|---|---|---|---|---|
| 1 | **Hero** (`[data-block="hero"]`) | dizer do que é o blog | o **título** (tipo) | o h1 em `--t-h1` | rolar para os artigos | H-Sem: eyebrow (`p`) vira `meta`; h1 em 7 colunas com o `span` em `--accent` (>=24px: pode); o `div` vira lead em 5 colunas, **base alinhada ao h1**. Serve ao hero da lista (`Inteligência aplicada ao trabalho`) e ao da categoria (`Blog · Categoria` / `Cases.`) |
| 2 | **Filtro** (`[data-block="category-filter"]`) | trocar de categoria | o texto ativo | "Todos 7" | clicar numa categoria | filete em cima/embaixo, **texto + numeral tabular** (sai a pílula de 999px); ativa = sublinhado 2px `--ink` e peso 600; rolagem horizontal no celular; o comportamento "ancora no header" (`data-docked`) não muda |
| 3 | **Destaque** (1º cartão, `data-variant="featured"`) | o artigo que a curadoria escolheu | **a capa**, 7 colunas, 16:10, `--shadow-lift` | o título em `--t-h2` (5 colunas) | "Ler artigo" | foto à esquerda, texto à direita (meta, título, resumo em `--t-lead`, autor, link com filete); sem borda e sem caixa |
| 4 | **Dois médios** (2º e 3º cartões, só com 4+ artigos) | segundo nível de leitura | as duas capas, 3:2 | os títulos em 24–32px | "Ler artigo" | duas colunas sem caixa: capa, meta, título, resumo, autor, link; hairline em cima |
| 5 | **Índice** (4º em diante, ou 2º e 3º quando há ≤3 artigos) | varrer o resto | o título na linha | a coluna de títulos | "Ler artigo" | **linha ruled**: meta+autor (3 col) \| título+resumo(2 linhas)+link (6) \| miniatura 4:3 (3); sem capa: a coluna da miniatura some e o título ocupa a largura; o cartão inteiro é clicável pelo título (`::after`) |
| 6 | **1 artigo** | a categoria tem 1 só | a capa | o título | — | o próprio destaque (`single` do código atual); sem caixa |
| 7 | **Vazio** | avisar sem parecer erro | a frase | "Os primeiros artigos estão a caminho." em `--t-h2` | voltar em breve | texto em largura de 9 colunas; sem cartão |

**Por que a lista é a exceção à regra "sem 3+ cartões iguais".** O índice repete uma estrutura (a linha), mas: (a) é **tabela ruled**, não caixa; (b) a repetição é o conteúdo (uma lista de artigos de tamanho aberto, que o admin amplia), e o que faz o **ritmo** é a hierarquia de três tamanhos (destaque → médios → linhas), não a grade; (c) nunca há 3 peças iguais **lado a lado**. É o padrão de Stripe e Anthropic.

**Regra de posição (substitui `data-layout`).** Hoje `views.tsx` calcula `single`/`duo`/`featured`/`default` para evitar órfão numa grade de 3. Com o índice não há órfão. A direção usa só **posição**: 1º = destaque (`data-variant="featured"`, também com 2 artigos); 2º e 3º viram médios **só quando há 4 ou mais**; o resto é linha. CSS: `:nth-child(2):nth-last-child(n+3)` e `:nth-child(3):nth-last-child(n+2)`. O atributo `data-layout` pode continuar sendo emitido (não faz parte do contrato; o CSS novo o ignora). **Mudança de lógica pequena e sugerida:** com 2 artigos, o 1º também é `featured` (hoje os dois são `default`/`duo`).

### 4.2 Artigo (`ArticleView`)

| # | Seção | Papel | Objeto protagonista | O que domina | Próximo passo | Tratamento |
|---|---|---|---|---|---|---|
| 1 | **Navegação** (`breadcrumbNav`) | voltar ao contexto | — | "Voltar ao Blog" | voltar/continuar | filete embaixo; "Voltar" à esquerda e a trilha à direita (mantidos os dois); empilha no celular |
| 2 | **Cabeçalho** (meta, h1, resumo) | dizer do que se trata e quanto custa ler | o **título** (tipo) | h1 em até 60px | rolar | **o texto entra 2 colunas** (col. 3→12); meta = categoria em `meta` + data e "N min de leitura" em 15px/cinza; h1 sem limite estreito (balance); resumo 22px em 46ch |
| 3 | **Autor + compartilhar** (`authorBar`) | autoria e difusão | — | o nome | compartilhar | faixa com hairline em cima e embaixo; **sai o avatar "EQ"**; os 4 botões a 44px; no celular o rótulo "Compartilhar" fica numa linha e os 4 botões numa linha só |
| 4 | **Capa** (`data-focus="cover"`) | dar a imagem do artigo | **a foto**, 12 colunas, 21:9 (4:3 no celular), `--shadow-lift` | a foto | ler | abre **além da coluna de texto**, na largura do container; `object-position` vem de `coverImagePos` (o admin continua controlando o recorte); sem capa, a seção não renderiza |
| 5 | **Corpo** (`[data-block="article-body"]`) | ler | o texto | a medida | rolar | ver §4.3 |
| 6 | **Compartilhar (rodapé)** | difundir ao fim | — | — | — | igual ao 3, com filete em cima |
| 7 | **Conversão** (`conversionCta`) | levar ao diagnóstico | o título | "Prepare sua operação para trabalhar com agentes de IA." em `--t-h2` branco | **"Fazer diagnóstico gratuito ↗︎"** | **a única faixa escura da página** (`--black-1`), largura total; 7/5: texto à esquerda; à direita o botão primário e "Conhecer a Kalidash" como link com sublinhado; sai a caixa roxa |
| 8 | **Leitura complementar** (`relatedSection`) | continuar lendo | as 2 capas | os 2 títulos | "Ler artigo ↗︎" | H-Legenda (`meta` + filete) + `h2`; **2 colunas sem caixa** (capa 3:2, meta, título, resumo em 2 linhas, link); o item todo é o link; sem borda externa |

### 4.3 Corpo do artigo: hierarquia do HTML exportado

Medida: `max-width: 62ch` a 20px/1,7 em `Source Sans 3`, cor `--c-text-2` (11,6:1). **Medi 66–75 caracteres por linha no 1440** (antes: 93–96 nas linhas cheias) e 40–46 no 390 (antes ~50), com 19px no celular (`proto/measure-check.mjs`). Espaço entre blocos: `1,25em`.

| Elemento | Tratamento |
|---|---|
| `p` | 20px (19px no celular), 62ch, `text-wrap: pretty`; `strong` em `--c-text-1` 600; link sublinhado 1px, `--c-brand-text`, 2px no hover |
| `h2` | Inter 500, `clamp(28, 2.6vw, 38)`, entrelinha 1,15, -0,03em, cor `--ink`; **hairline forte em cima + 24px de respiro**, 2,4em de margem acima (é o "capítulo"); o 1º filho não leva filete |
| `h3` | Inter 500, `clamp(22, 2vw, 26)`, sem filete, 2em acima |
| `ul` / `ol` | recuo 1,35em; marcador em `--c-brand-text` (numeral do `ol` em tabular, 600); itens separados por 0,5em; mesma medida do parágrafo |
| `blockquote` | **sem barra lateral**: hairline forte em cima, 24px de respiro, Inter 500 `clamp(24, 2.4vw, 32)` / 1,3, cor `--ink`; largura até 46rem (mais larga que o parágrafo) |
| `figure` + `img` | `data-text-alignment="center"` (e sem atributo): **abre além da medida** (até 56rem); `left` / `right`: na largura da medida (`right` alinha à direita da medida); `img` raio 12, `max-height: 78svh` e `width:auto` (a figura em retrato do teste deixou de ocupar uma tela inteira); sem sombra |
| `figcaption` | 15px, `--c-text-3`, 12px abaixo da imagem, na medida |
| `code`, `pre`, `details`, `video`, `audio`, `h4`–`h6` | **não redesenhei**: o CSS atual já os trata (`article.module.css`) e não aparecem no contrato do editor; ficam como estão e devem ser conferidos no B6 |

## 5. Contrato `data-*`: conferido

Todos os atributos do `docs/blog-design-contrato.md` estão **no HTML dos protótipos, nos mesmos elementos**; o CSS dos protótipos só **lê** `data-block`, `data-variant`, `data-role`, `data-docked`, `data-text-alignment`.

| Atributo | Onde está no protótipo |
|---|---|
| `data-block="hero"` + `data-focus="hero"` | `08` `<section>` do hero (lista e categoria) |
| `data-block="category-filter"` + `data-docked` | `08` `<nav>` |
| `data-block="gallery"` + `data-count` | `08` `<section>` (7, 2 e 1; vazio sem `data-count`, como hoje) |
| `data-block="article-card"` `data-variant="featured"\|"default"` `data-layout` `data-focus="card"` | `08` cada `<article>`; `data-block-id` só existe no preview (o protótipo não o emite; o código atual o mantém) |
| `data-role="cover"` / `"read-more"` | `08` `<img>` e `<a>` |
| `data-focus="meta"`, `"title"`, `"excerpt"`, `"author"`, `"cover"`, `"body"` | `09` nos mesmos elementos do `ArticleView` |
| `data-block="article-body"` | `09` o `div` do corpo |
| filhos diretos do cartão `p, h2, div, span` | preservados: a grade do índice usa `grid-template-areas` sobre os filhos diretos |

Conferência por comando: `grep -o 'data-[a-z-]*' proto/0[89]-*.html | sort | uniq -c` lista os atributos usados (todos do contrato, mais `data-st`, `data-sec` e `data-fixture` dos **protótipos**, que **não** vão para o site).

## 6. Responsivo

- **≥1100:** artigo em 12 colunas, texto de 3 a 12. **<1100:** texto em largura cheia (col. 1–12).
- **<1024:** destaque empilha (capa em cima); médios continuam em 2 colunas até 760; hero em uma coluna.
- **<760:** o índice vira **linha com miniatura de 104px à direita**; os médios viram linhas; o destaque empilha; filtro rola na horizontal; capa do artigo 4:3; corpo 19px; compartilhar em 2 linhas (rótulo, depois 4 botões).
- Alvos de toque 44px (botões de compartilhar, filtros 56px de altura); foco 2px `--ink`.

## 7. Verificação

| Item | Resultado |
|---|---|
| Copy (`proto/copy-check.mjs`) | `08-blog-lista.html`: **0 extras** (4 estados); `09-blog-artigo.html`: **0 extras** (2 estados). Compara o texto visível, **sem** os elementos `data-fixture` (conteúdo de CMS), com a baseline do blog e os literais de `views.tsx`, `ShareButtons.tsx` e `categoria/[slug]/page.tsx`. **Limite:** só o texto "de código" é checado; títulos, resumos, autor, datas, categorias e corpo são fixtures e **não** são verificados (vêm do CMS e não mudam por design). |
| Overflow (`proto/overflow-check.mjs`) | 84 combinações (todos os protótipos, todos os estados) × 390/768/1024/1440: **0 overflow** |
| Medida de leitura | `proto/measure-check.mjs`: antes 93–96 car/linha (1440), 45–52 (390); depois 66–75 (1440), 40–46 (390) |
| Visto em tamanho real | 08: `todos` 1440/1024/390, `cat` 1440, `um` 390, `stress-hero` 1440. 09: `com-capa` 1440 (página inteira, dobra) e 390 (página inteira); `com-capa` 1024 (dobra). |
| Não visto | 08 `vazio` 1440, `cat` 390; 09 `sem-capa` só na dobra (1440) e 390; 768 do 09 e do 07 como imagem (só o 08 em 768 foi gerado e não revisto); hover/foco; teclado; leitor de tela |
| Teste de estresse do hero | `#stress-hero`: hero com lead de ~270 caracteres (texto lido na `:3000` de outra sessão, origem do dado desconhecida; **não** usado como copy, fora do `copy-check`). O lead fica com 8 linhas na coluna de 36ch: aceitável, mas pode ganhar `max-width: 44ch` |

## 8. O que a B6 (dev) faz com isto

1. `blog.module.css`: reescrever `.posts`/`article` conforme `proto/08-blog-lista.html` (grid de 12 colunas, três tratamentos por posição, `:has()` para cartão sem capa). Remover `border-radius` 6/8/14/999 e as 3 sombras, e o hover que sobe; hover = sublinhado no título.
2. `views.tsx`: com 2 artigos, o 1º é `featured`; o resto da lógica de `data-layout` pode sair (sem uso). Remover o avatar "EQ". Estrutura do `ArticleView`: a faixa de conversão precisa de **largura total**: tirar `conversionCta` de dentro da coluna de 960px (ou usar `margin-inline: calc(50% - 50vw)` com `overflow-x: clip` no `page`).
3. `article.module.css`: `.mainContainer` passa de 960px para o container de 1280px com grade de 12 colunas; `.body` 62ch/20px/1,7; escala de §4.3; `blockquote` sem barra.
4. `ReadingProgressBar`, `ShareButtons` (rótulos e `aria-label`): sem mudança de texto.
5. Conferir no admin ("Lado a lado", desktop e celular) e no preview `/preview/blog` e `/preview/article`: o iframe renderiza o mesmo `views.tsx`.

## 9. Perguntas de produto

- **Q1.** Capa do artigo em 21:9 corta mais as fotos (hoje 16:9 inteira). O `coverImagePos` do admin cobre o recorte vertical, mas capas de retrato ficam ruins. Aceitar 21:9, ou 16:9 limitada a 560px de altura?
- **Q2.** Remover o avatar "EQ" (tell de selo de duas letras): o autor passa a ser só nome + "Kalidash". Aprovar?
- **Q3.** Faixa escura de conversão em largura total (muda a estrutura do componente). Aprovar? A alternativa é manter na coluna, em `warm`, sem caixa.
- **Q4.** Com 2 artigos, o 1º vira destaque (muda uma regra de `views.tsx`). Aprovar?
- **Q5.** O hero do `/blog` é HTML do editor (o admin controla o texto). A direção estiliza `p`, `h1 > span` e `div`; se o editor produzir outra estrutura (ex.: dois `p`), o CSS ainda lê, mas o lead pode ficar alto. Vale restringir o editor ao molde `p + h1(span) + div`.
