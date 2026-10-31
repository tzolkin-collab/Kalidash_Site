# D1 — Direção das 7 páginas institucionais

> Designer D0/D1. Só direção e protótipo; nada em `apps/site` foi editado. Sistema em [00-sistema.md](00-sistema.md) e [tokens.css](tokens.css). Copy: **só** as strings de `pages.ts` (conferi os protótipos contra o arquivo; ver §8).
> Capturas reais do estado atual em [antes/](antes/) (PNG de página inteira, 1440 e 390, rolagem gradual para disparar o `Reveal`). Referências em [refs/](refs/). Protótipos em [proto/](proto/) com capturas de seção em [proto/shots/](proto/shots/).

## 0. Rodada 2: vida (assinatura, ritmo, escala, cor, movimento)

> Pedido do PO após ver as imagens em tamanho real: a rodada 1 tirou os tells mas arriscava trocar "chapado de cartões" por "chapado de texto" (régua + título gigante à esquerda + parágrafo à direita repetido, quase tudo branco). Esta rodada refaz os protótipos de **todas as 7 páginas** (Sobre nós, AI Culture, Advisory, Execução, Soluções, Kognis, Spectra) com **uma ideia forte por página**. Onde esta seção e a §4 divergirem no padrão visual de uma seção, **vale esta seção**; a §4 continua valendo para o papel, o objeto e o próximo passo.
> Protótipos: [01](proto/01-sobre-nos.html) · [02](proto/02-kognis.html) · [03](proto/03-advisory.html) · [04](proto/04-execucao.html) · [05](proto/05-ai-culture.html) · [06](proto/06-spectra.html) · [10](proto/10-solucoes.html). Capturas reais em [depois/](depois/) (1440 e 390, página inteira) e lado a lado com o estado atual em [comparativo/](comparativo/).

### 0.1 Regras da rodada 2 (valem para todas as páginas)

1. **Uma assinatura por página**, que nenhuma outra página usa como ideia principal.
2. **Ritmo: duas seções seguidas nunca usam o mesmo padrão.** Vocabulário de padrões: foto sangrando (bleed), faixa escura com números, faixa quente com lema, coluna sticky, número gigante, índice em escala de cartaz, linha de sequência, régua (linhas separadas por hairline), FAQ. **No máximo um uso de régua por página.**
3. **Foto real já existente em `public/` em escala grande** em toda página: full-bleed (100vw) ou 7/12, com corte e proporção intencionais. Nenhuma imagem nova nem inventada.
4. **Banda de cor só onde tem função:** escura = prova/números (Sobre nós, Kognis, Execução) ou produto de noite (Spectra, Soluções); quente (`--c-band-warm` = `--accent`) = **uma** frase-tese (Advisory). Texto branco sobre a faixa quente só a partir de 40px (contraste 4,3:1 reprova AA em texto pequeno).
5. **Um micro-movimento por página**, só `opacity`/`transform`, ligado à rolagem (CSS scroll-driven, sem JS) ou ao hover/foco, **nunca em loop**, desligado em `prefers-reduced-motion`. Regra anti-faixa-branca: **o conteúdo nunca nasce escondido** (nenhum movimento parte de `opacity: 0`; transformações partem de um estado já legível).
6. **Escala de títulos em 3 níveis:** **cartaz** (`--t-poster` 56–128px e `--t-poster-sm` 44–88px: lemas, números, h1 com foto), **seção** (`--t-h2` 32–55px) e **subordinado** (`--t-h3` 22–30px: título de seção secundária e de item). Cada página usa os três.
7. **Mobile não é o desktop encolhido:** foto sobreposta ao título vira foto inteira em 3:2 com o título embaixo (Sobre nós); lemas de cartaz caem para 36–48px; faixas e passos viram trilho vertical.

### 0.2 Por página

| Página | Assinatura | Sequência de padrões (nenhum igual ao vizinho) | Fotos grandes (arquivo · escala · corte) | Faixa de cor e função | Micro-movimento |
|---|---|---|---|---|---|
| **Sobre nós** | **Foto dos fundadores sangrando a tela**, "Já estivemos do seu lado da mesa." a 128px sobreposto (véu de baixo para cima) | bleed → texto 5/7 → **história em 3 layouts diferentes** (ato 1: retrato 5/12 + texto; ato 2: tese em cartaz sobre warm, sem foto; ato 3: mosaico grande e irregular) → lema de cartaz → credo em **números gigantes** (warm) → foto do time 8/12 + coluna → faixa escura com números de 168px (nenhuma régua na página) | `founders-studio.jpg` 100vw × min(88vh, 780px), corte 50% 30% · `ato-01-operacao.jpg` 5/12 em 4:5,6 (ato 1) · mosaico de 6 fotos em 12 colunas, 130px por linha, m1 de 7 col × 4 linhas · `time-kalidash.jpg` 8/12 em 4:3 | escura só na prova (`+10 mil`, `170`, `Parceira`, `Finalista`): é a credencial | foto do hero desliza ±32px com `scale(1.12)` fixo, ligada à rolagem (`cover 0–100%`); sem duração própria |
| **AI Culture** | **Faixa de foto sangrando com "Dois formatos…" a 128px** + números de cartaz sobre branco (sem faixa) | hero contido → números (`+10 mil`, `170` a 168px, filete de 2px) → warm com lema → passos em linha → bleed + formatos em linhas | `evento-sala.jpg` 4:5 (contida, hero) · `metodo-reuniao.jpg` 100vw × min(72vh, 640px), corte 50% 45% | nenhuma faixa de cor; `warm` só na pausa do "por quê" | linha dos passos desenha (`scaleX .35→1`, `entry 10% – cover 45%`) |
| **Advisory** | **Faixa quente com o lema** "Não entregamos um plano. Acompanhamos o que acontece depois dele." a 128px | hero (foto 7/12 à direita) → "E agora?" → **faixa quente** → coluna sticky + frases de 44px → rituais em números gigantes (warm) → passos em linha → critérios em régua (**a única**, warm) → FAQ | `metodo-reuniao.jpg` 7/12 sangrando à direita, min-height min(86vh, 720px), corte 62% 50% | quente (`#b6644d`) só no lema: é a tese da página | o lema sobe 40px→0 na entrada (`entry 0–80%`) |
| **Execução** | **Índice em escala de cartaz** (os 5 nomes a 88px) + faixa escura com `+100 · 170 · 12 horas` a 128px | hero (retrato sangrando à direita) → lema "É aí que a Kalidash entra." a 128px → índice → passos em linha → faixa escura → caso com foto sangrando à esquerda → régua com os 2 produtos (**a única**) | `front-3-entrega.jpg` 5/12 sangrando · `g21-cba-premio.jpg` 7/12 em 4:3 sangrando à esquerda | escura nos números: é a prova | a foto do caso faz zoom `1.08→1` (`entry 0 – cover 55%`) |
| **Soluções** | **Dois painéis cheios, um claro e um escuro:** os advogados recortados em pé na base do painel claro; a foto do Spectra em 6/12 sangrando no escuro | manchete 128px (abertura à la Mistral) → painel claro (Kognis) → painel escuro (Spectra) | `kognis-heroes.png` ~800px de altura, apoiado na borda · `ato-01-operacao.jpg` 6/12 sangrando, corte 50% 30% | escura só no Spectra (produto de chão de fábrica); claro (`warm`) no Kognis | o recorte dos advogados sobe 40px→0 na entrada |
| **Kognis** | **Os advogados em pé sobre a faixa escura** com os 4 números a 128px (`8 horas`, `3x`, `+90%`, `100%`) | hero (recorte) → faixa escura → título de cartaz + tabela em régua (**a única**) → coluna sticky + itens (warm) → índice de cartaz (financeiro) → passos em linha (warm) → FAQ com título sticky | `kognis-heroes.png` ~760px de altura sobre o filete da faixa · `kalidash-motion-statue.jpg` (busto em preto e branco, arte da marca que já existe em `public/`) 100% da faixa, à direita, sob véu; **K1–K3 são opcionais e não aparecem sem tela** (§4.8) | escura nos números: é a prova | linha dos passos desenha (`scaleX .35→1`) |
| **Spectra** | **Tela dividida em altura cheia:** texto sobre escuro à esquerda, a foto real do chão de operação ocupando a metade direita | split → lista de 3 capacidades em cartaz (56–88px); [S1 opcional, só com imagem] | **`g10-agir.jpg`** (sala de operação com telas, hoje na Home) 50vw × min(92vh, 820px), corte 30% 88%; o retrato do operário **sai** da página (ver §0.5) | escura no hero: é a abertura | ao passar/focar um item, os outros recuam a `opacity .45` em 160ms (hover/foco; não depende de rolagem) |

Escala de títulos usada (cada página tem os três níveis): cartaz = h1 de hero, lemas, números e nomes do índice; seção = `--t-h2` nos títulos principais; subordinado = `--t-h3` em seções de apoio (a abertura do credo no Sobre nós, "O que faz" no Spectra, o financeiro no Kognis, o problema na Execução).

### 0.3 Vida: nota de 0 a 10, antes → depois (minha, para o PO desmentir)

Critério: *"se eu rolasse esta página por 10 segundos, algo me pararia?"* — foto com peso, número ou frase em escala de cartaz, um contraste de fundo com função, algo que se mova ou responda. Comparei [antes/](antes/) e [depois/](depois/) lado a lado nos PNGs de [comparativo/](comparativo/).

| Página | Antes | Depois | Por quê (e o que ainda segura a nota) |
|---|---|---|---|
| Sobre nós | 3 | **8** | Hero sangrado, história em três layouts (retrato, tese em cartaz, mosaico grande), credo e prova em números enormes. Segura: o ato 2 é só tipo; a foto do ato 1 ocupa pouco depois do hero. |
| AI Culture | 3 | **6,5** | Faixa de foto com título de cartaz e números de 168px. Segura: o hero continua contido e é a página com mais branco; só uma foto grande. |
| Advisory | 2 | **7,5** | A faixa quente é o momento memorável da página; numerais de 128px nos rituais. Segura: sem produto ou número real; sete seções de tipo. |
| Execução | 3 | **7** | Índice de cartaz e faixa escura com `12 horas`. Segura: o hero tem uma foto de palco sem relação direta com "execução"; a régua final é fria. |
| Soluções | 2 | **7,5** | Dois painéis cheios, claro/escuro, produto em escala grande. Segura: o painel escuro mostra um operário, não o produto. |
| Kognis | 2 | **6,5** | Advogados sobre a faixa escura com o busto da marca atrás dos números de 128px; título de seção em cartaz. Sem caixas vazias: **a versão sem tela é o layout principal**. Segura: o miolo continua tipo sobre branco/warm; só uma foto de pessoas. Com telas reais (K1–K3), estimo 7,5–8 (palpite). |
| Spectra | 2 | **6,5** | Tela dividida com foto de altura cheia (sala de operação), lista em cartaz com hover. Sem caixa vazia. Segura: página curta, só uma foto, sem número nem produto à vista; sem S1, o teto é este. |

Limites desta nota: eu mesmo a atribuo, a partir de PNGs estáticos; **não vi o movimento acontecendo** (scroll-driven animations só testadas por estarem declaradas e por não quebrarem a captura), e nenhuma página foi vista no navegador real do dono.

### 0.5 Rodada 2.1 (PO 8,5 → 9): três correções

**1. Kognis e Spectra sem caixas tracejadas.** A versão **sem tela** é o layout principal e a que vai ao ar; a tela é um **slot opcional** que, se existir, entra sem remontar a página. Os dois estados estão em PNG: [estados-kognis.png](comparativo/estados-kognis.png) e [estados-spectra.png](comparativo/estados-spectra.png) (esquerda: sem tela; direita: com tela, com um bloco cinza neutro que é só **exemplo de encaixe, não é tela real**). O Kognis ganha peso sem tela por: advogados em escala grande sobre a faixa de números, busto da marca (`kalidash-motion-statue.jpg`, já em `public/`) atrás dos números, título de seção em cartaz (88px), tabela e índice em tipo grande. Contrato do slot em §4.8.

**2. Spectra sem o retrato do operário.** O hero do Spectra reutilizava `ato-01-operacao.jpg`, que também está na colagem do Sobre nós e na oferta de Soluções. Proponho **`home/g10-agir.jpg`**: foto real de uma sala de operação com fileiras de estações e um painel grande, já usada na Home (a Agir é cliente). Mostra "o chão de operação" com telas e câmeras no teto, o contexto onde o Spectra roda, e não repete rosto nenhum de outra página. Tratamento: metade direita da tela dividida, corte à esquerda-baixo (30% 88%) para pegar as pessoas e o painel e deixar o forro de fora. **Decisões para o PO:** (a) trocar `src` do hero do Spectra (o checklist 3.1 só permite trocar imagem com decisão do PO); mantenho o **mesmo `alt`** ("Spectra AI visão computacional na operação"), então nenhuma string muda; (b) se o PO preferir não trocar, o fallback é manter `ato-01-operacao.jpg` com **recorte fechado** no capacete e no quadro de EPI (zoom ~2,2x, 4:5, sem o corpo inteiro), que deixa de repetir o retrato. O arquivo `ato-01` fica só no ato 1 do Sobre nós. Em `/solucoes` a oferta 02 usa a mesma `g10-agir` (protótipo `10-solucoes` alinhado). **Atenção:** em `pages.ts` as ofertas de Soluções **não têm imagem**; as duas fotos do protótipo (recorte do Kognis e `g10-agir`) são mídia nova na página e precisam de `alt`; sugiro reaproveitar os alts que já existem para cada produto ("Kognis — Escritório de Advocacia Inteligente" e "Spectra AI visão computacional na operação"), sem texto novo.

**3. Sobre nós: "Nossa história".** O mosaico pequeno + 3 atos em régua virou três layouts: **ato 1** retrato de operação em 5/12 (4:5,6, sombra de foto-herói) com o texto ao lado; **ato 2** a tese em escala de cartaz sobre fundo warm, parágrafos em duas colunas, sem foto; **ato 3** texto curto à direita e **mosaico grande e irregular** (6 fotos em 12 colunas, a do prêmio CBA em 7×4, as outras em alturas e larguras diferentes), com a legenda "Do chão de operação à formação executiva"; fecha o lema em escala de cartaz (128px, 4 linhas). Nenhuma régua restante na página. **Nota de implementação:** a ordem de `mosaic.items` decide a distribuição (item 1 = ato 1, itens 2–7 = mosaico do ato 3), mudança só de estrutura. Capturas: [depois/01-historia-1440.png](depois/01-historia-1440.png) e [depois/01-historia-390.png](depois/01-historia-390.png).

### 0.4 Auditoria dos protótipos r2 contra `tells.md`

| Tell | Resultado |
|---|---|
| Grade de 3+ cartões iguais / cartão em cartão / barra lateral | nenhum |
| Eyebrow + título + cinza em toda seção | o eyebrow continua como legenda em várias seções (não contei); os outros modos (sem eyebrow: lema, numeral, foto com título, split) cobrem o resto. **Risco declarado:** Kognis e Advisory ainda têm 4–5 seções com legenda + h2 |
| Ícone no lugar de objeto | nenhum ícone; os "objetos" são fotos, números e o diagrama de sequência |
| Blob/orb/glow | nenhum; **o único gradiente é o véu preto sob o título de foto (legibilidade)** |
| Entrada escalonada em todo bloco | nenhuma; um movimento por página |
| Dois estilos de raio/sombra | só 4 e 12px; sombra só em foto-herói (`--shadow-lift`) |
| Alternância claro/escuro como ritmo | no máximo uma faixa escura (ou a quente, no Advisory) por página, sempre com função |
| Texto sobre foto sem painel | só com véu de 78% de preto na base (Sobre nós, AI Culture); mobile do Sobre nós tira o título de cima da foto |
| Métrica ou depoimento inventado | nenhum; `copy-check` 0 extras |

## 1. Diagnóstico do estado atual (visto, não só lido)

Capturei as 7 rotas em 1440 e 390 com `shot.mjs` adaptado (página inteira). Servidor usado: o `next dev` que já rodava na porta 3000 (de outra sessão; só li). O `preview_start` desta sessão caiu porque a porta já estava ocupada.

### 1.1 Hipótese das faixas brancas em `/kognis`: **parcialmente confirmada, causa diferente da suposta**

- Captura de página inteira **sem rolar**: quatro faixas brancas de ~500px entre o `h2` e o rodapé de cada seção ([antes/kognis-1440-semscroll.png](antes/kognis-1440-semscroll.png)). São exatamente os blocos `cards` x3 e `steps`.
- Causa (lida em `Motion.tsx`): `Reveal` põe `data-state="hidden"` (opacity 0) em tudo que está abaixo de 90% da dobra e só libera com `IntersectionObserver` (limiar 0,25). Sem a rolagem passar, o bloco fica invisível.
- Captura **com rolagem gradual** ([antes/kognis-1440.png](antes/kognis-1440.png)): tudo aparece, sem faixa. **Não reproduzi o vazio em rolagem normal.** O relato do dono pode vir de salto de rolagem, captura de tela/impressão ou ferramenta que não rola; não testei salto nem impressão.
- Mesmo com tudo visível há **vazio real**: entre o `h2` e os cards sobram ~150px (lido na captura), por causa de `margin-bottom` do `.head` + gap do grid. Isso lê como espaço morto. O sistema fixa `--head-gap` 32→64px.
- Risco que fica: HTML renderiza visível ("idle") e só vira `hidden` após hidratar, então há também um pisca. Recomendação do D0: **tirar `Reveal` dos blocos de leitura** (ver 00-sistema §3).

### 1.2 O que está chapado (por página, contra `references/tells.md`)

| Tell | Onde aparece (visto) |
|---|---|
| Receita eyebrow + h2 + cinza em toda seção | todas as 7; em `/advisory` são 7 seções seguidas com a mesma estrutura |
| Grade de 3+ cartões iguais | `/kognis` (3 grades de 3 cartões, mais 3 passos), `/spectra` (3 cartões é a página inteira), `/execucao` (3+2 cartões; 4 passos), `/advisory` (3 cartões + 3 passos), `/treinamento-corporativo-ia` (4 passos) |
| Caixa com barra lateral terracota | `.highlight` em Sobre nós (ato "Hoje"), Advisory (2x), Execução, e `.closing` no Advisory; `.example` dos cards de Kognis/Execução tem a mesma barra |
| Cartão dentro de cartão | Kognis e Execução: o `example` é caixa com barra dentro do card com sombra |
| Ícone/pílula no lugar de objeto | pílula "01" rosa em todo card; chips em pílula no Advisory |
| Dois estilos de raio e sombra | raios 4, 6, 8, 10, 12 e 999px; sombras 4 níveis (contados no CSS) |
| Alternância de bandas para dar ritmo | AI Culture: warm → paper → foto → preto, sem função |
| Hover que sobe com sombra | `.card`, `.steps li`, `.checks li` |
| Cinza em 5 tons | `#3c373f`, `#514c53`, `#6b6670`, `#3c3c3c`, `#6b6670` etc. |
| Sem protagonista | `/spectra`: um retrato de operário (a mesma foto do Sobre nós) e três cartões; `/kognis`: a faixa de números é o único objeto real e fica pequena (28px) |
| Vazio de 100–150px entre título e conteúdo | `/kognis`, `/execucao`, `/spectra`, `/advisory` |
| Mobile | `/execucao` em 390: cards e métricas em trilho horizontal com o item seguinte cortado ("Ag…", "1…"); é `scroll-snap` intencional, mas lê como bug; `/solucoes` em 390 não revisado em detalhe |

### 1.3 O que já funciona (manter)

Fotos reais do time e dos eventos; o título curto em Inter com tracking apertado; o botão terracota; a faixa escura do `proof` do Sobre nós; o `details` do FAQ; o JSON-LD. Esta direção **mantém** o tom de voz e acrescenta escala, régua e um objeto por seção.

## 2. Referências: o que abri de fato

Abri com Chrome headless (`shot.mjs`, 1440) e **vi** as capturas. Nem tudo abriu; ao fim digo o que não foi visto. Quatro linhas por referência (composição, tipo, ar, detalhe), depois herda e recusa.

### 2.1 Linear — /about ([refs/linear-about.png](refs/linear-about.png), viewport em [refs/linear-about-vp.png](refs/linear-about-vp.png))
- **Composição:** manchete larga, foto/vídeo na largura inteira logo abaixo, depois blocos 2 colunas desiguais (título à esquerda, texto à direita), retratos em fileira, nomes em lista de colunas; só quebra a simetria no bloco "Backed by".
- **Tipo:** um único sans, h1 ~64px peso 500 com tracking apertado, texto corrido pequeno e cinza; sem serifa.
- **Ar:** muito: ~140px entre blocos, texto em coluna estreita (~50ch).
- **Detalhe:** raio pequeno na mídia (~8px), sem sombra, sem borda, hairline quase invisível; tudo é tipo e foto.
- **Herdo:** manchete → foto larga → texto 5/7 (Sobre nós, Advisory); retratos/fotos reais como prova de gente; ausência de sombra.
- **Recuso:** fundo escuro, vídeo de apresentação, lista de 100 nomes, o "Backed by".

### 2.2 Linear — /features ([refs/linear-features.png](refs/linear-features.png))
- **Composição:** manchete centrada + grade de painéis grandes em 1 e 2 colunas, cada painel com um artefato real (gráfico, tela, mapa) e uma legenda de 2 linhas.
- **Tipo:** título de painel ~20px peso 500, rótulo pequeno colorido; contraste por tamanho.
- **Ar:** painéis com 16–24px entre si e ~40px de padding interno.
- **Detalhe:** painéis de cinza muito claro, raio ~12px, seta discreta no canto.
- **Herdo:** a ideia de que cada bloco carrega **um artefato real** + 1 legenda; as seções do Kognis só ficam fortes quando houver telas reais (ver §6, pergunta 1).
- **Recuso:** a grade de painéis (é a mesma "grade de cartões" que o dono quer fora) e os ícones/ilustrações abstratas.

### 2.3 Anthropic — Academy /learn ([refs/anthropic-learn-vp.png](refs/anthropic-learn-vp.png), página inteira em [refs/anthropic-learn.png](refs/anthropic-learn.png))
- **Composição:** hero alinhado à esquerda com h1, subtítulo e dois botões; abaixo, cartões 3 por linha com **uma amostra do produto no topo** e título + 2 linhas embaixo.
- **Tipo:** serifa de display (estilo Tiempos) no título e nos títulos dos cartões, sans no resto; serifa dá calor editorial.
- **Ar:** hero com ~80px; cartões com 28–32px de padding.
- **Detalhe:** tema escuro, hairline clara de ~1px, raio ~14px, sem sombra; banner de cookies cobre parte.
- **Herdo:** hero editorial à esquerda, texto-primeiro; o conceito "amostra real no topo do item".
- **Recuso:** o tema escuro, a serifa (a Home usa Inter; **uma família de título**), a grade de 3 cartões iguais.

### 2.4 Stripe — /about ([refs/stripe-about.png](refs/stripe-about.png))
- **Composição:** uma coluna central estreita (~540px) de texto longo, uma ilustração de linha no topo, lista de 3 links ruled no fim ("Você tem alguma dúvida? → Entre em contato").
- **Tipo:** sans ~20px, cinza-azulado, entrelinha generosa.
- **Ar:** extremo; o respiro é o design.
- **Detalhe:** links com hairline entre linhas, seta; nada em caixa.
- **Herdo:** a **lista ruled de links** (usada nos itens do showcase e nos critérios) e a medida de leitura de ~60ch.
- **Recuso:** coluna única sem foto: o Sobre nós precisa dos rostos.

### 2.5 Thoughtworks — /what-we-do ([refs/thoughtworks.png](refs/thoughtworks.png))
- **Composição:** hero com foto cheia e frase em duas cores; bloco de afirmação centrado (parágrafo único); lista vertical à esquerda (3 itens) que troca o detalhe à direita; capacidades em cartões de foto; faixa azul de CTA.
- **Tipo:** serifa grossa no h2, sans no corpo; vermelho de marca só em uma palavra do hero.
- **Ar:** blocos de ~120px; muito branco.
- **Detalhe:** o trecho do meio da página veio vazio na minha captura (lazy), então só vi topo e rodapé em detalhe.
- **Herdo:** a **afirmação** como seção de uma frase só (aplicada ao `text` do Advisory) e a lista vertical de 3 itens (rituais).
- **Recuso:** fotos de stock, serifa, vermelho; cartões de foto.

### 2.6 BCG — /capabilities ([refs/bcg.png](refs/bcg.png))
- Grade de tiles de foto de stock (3 por linha, ~20 tiles) e filtros. Um banner de cookies cobriu o topo; a página é de catálogo, não de narrativa.
- **Herdo:** nada. **Recuso:** o tile de foto de banco de imagens e a grade. Útil como contraexemplo: é o que o dono chamaria de "cara de template".

### 2.7 Mistral — /products ([refs/mistral-vp.png](refs/mistral-vp.png), só a primeira dobra)
- **Composição:** faixa de abertura dividida por um filete vertical: h1 embaixo à esquerda, uma frase de apoio embaixo à direita, na mesma linha de base; abaixo, **dois produtos lado a lado com o mesmo peso**, cada um num painel com a tela do produto.
- **Tipo:** um sans grotesco, h1 ~64px peso 500, frase de apoio ~20px; rótulo "PRODUCTS" em caixa-alta pequena e cinza.
- **Ar:** abertura alta (~450px), painéis colados por hairline, sem folga entre eles.
- **Detalhe:** fundo escuro, hairlines de 1px, painéis laranja e azul saturados com um mock de UI, raio pequeno, mascote em pixel.
- **Herdo:** a abertura "h1 embaixo à esquerda + uma frase embaixo à direita" para o hero de Soluções, e **dois produtos de peso igual** (aqui: duas ofertas de largura total, alternadas).
- **Recuso:** fundo escuro, cores saturadas por produto, mascote e a UI simulada (a Kalidash não tem a tela do produto no repositório; não invento).
- **Limite:** só vi a primeira dobra; não sei como o resto da página trata cada produto.

### 2.8 Cohere — /north ([refs/cohere-north-vp.png](refs/cohere-north-vp.png), primeira dobra)
- **Composição:** tudo centrado: eyebrow, h1 em 2 linhas, parágrafo, vídeo de lançamento largo logo abaixo.
- **Tipo:** grotesco display de largura estendida, branco sobre preto.
- **Ar:** muito, mas o banner de cookies e a barra de anúncio disputam a dobra.
- **Detalhe:** botões em pílula branca, vídeo com render 3D abstrato.
- **Herdo:** nada. **Recuso:** hero centralizado com h1 curto e botões (tell "centered hero") e render abstrato no lugar de produto. Serve de contraexemplo.

### 2.9 O que tentei abrir e não serviu
- McKinsey (/capabilities) e Vercel (/solutions): voltaram só a primeira dobra (900px), sem conteúdo útil.
- **Samsara** (para Spectra, visão por câmera em operação): `/products/video-based-safety`, `/products/cameras-and-video` e `/products/video-safety` devolveram a página 404 ("Oops. Out of service") nas três tentativas. **Não consegui ver nenhuma página de produto de visão computacional.** PNGs apagados.
- **Landing AI** (landing.ai): abriu, mas vende leitura de documentos, não câmera; não serve para Spectra e não está salvo.
- Stripe /payments e Palantir /platforms/aip foram capturados e **não analisados**; PNGs apagados.

## 3. Âncora por página

| Página | Âncora (vista) | O que a âncora ensina | Observação |
|---|---|---|---|
| Sobre nós | **Linear /about** (+ Stripe /about para a lista ruled) | manchete → foto larga → texto 5/7; gente real | foto dos fundadores já existe e é boa |
| AI Culture | **Anthropic Academy** (hero editorial) + Stripe (lista ruled) | texto-primeiro, formatos em linhas, "amostra real" | foto de sala já existe |
| Advisory | **Thoughtworks** (afirmação e lista vertical) + Linear about | frase única, rituais em lista | sem foto de produto: o objeto é o texto |
| Execução | **Linear /features** (artefato real + legenda), adaptado a **um** caso | foto do caso CBA como protagonista | números reais da página viram a régua |
| Soluções | **Mistral /products** (vista, só primeira dobra); Cohere vista como contraexemplo | abertura h1 à esquerda + 1 frase à direita; dois produtos de peso igual | adaptado: sem UI simulada, sem fundo escuro |
| Kognis | **Linear /features** (artefato real + legenda) e **Mistral /products** (produto com a própria tela) | o produto como herói | **hoje não há tela do produto no repositório**; o dono disse que há prints do Kognis, sem caminho informado (ver §6) |
| Spectra | **Linear /about** (uma foto real grande + texto 5/7) | página enxuta conduzida por uma foto real | nenhuma referência de visão por câmera abriu (Samsara 404 nas 3 URLs); a página fica fotográfica e curta até haver imagem de câmera ou dado |

## 4. Direção por página e por seção

Para cada seção: **Papel** (o que ela faz), **Objeto** (protagonista real), **Domina** (o que o olho lê primeiro), **Próximo** (o que o leitor faz). Tratamentos vêm da tabela do D0. O "Protótipo" aponta o arquivo e o `data-sec`.

### 4.1 `/sobre-nos` — âncora Linear about
Ritmo: paper (hero) → paper (história) → warm (credo) → paper (time) → **band** (prova). Uma faixa escura, uma pausa warm.

| # | Seção (bloco) | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` landscape) | provar que entendemos a operação do cliente | foto dos fundadores `founders-studio.jpg`, 21:9 na largura do container | h1 "Já estivemos do seu lado da mesa." | rolar para a história |
| 2 | Nossa história (`timeline`) | contar de onde viemos em 3 atos | colagem das 7 fotos (a de operação em retrato grande) | frase-chave "Nós ensinamos o que vivemos. E vivemos o que ensinamos." | seguir para o credo |
| 3 | Crenças (`beliefs`) | dar o ponto de vista sobre IA | tipo: cada crença em `--t-h2` | as três frases de crença | seguir |
| 4 | Time (`team`) | mostrar quantos somos | `time-kalidash.jpg` 16:9 | a foto | seguir |
| 5 | Prova (`proof`) | dar credencial e abrir as frentes | números `+10 mil`, `170` em branco 56–64px | os 4 números | link para AI Culture / Advisory / Execução |

Protótipo: [proto/01-sobre-nos.html](proto/01-sobre-nos.html) (`hero`, `timeline`, `beliefs`, `team`, `proof`). Capturas: [hero](proto/shots/01-hero-1440.png), [timeline](proto/shots/01-timeline-1440.png).
Diferença visível vs hoje: a foto dos fundadores passa de 540px ao lado do texto para largura do container; o mosaico 2x4 igual vira colagem com uma foto dominante; o `highlight` com barra vira frase em tamanho de h2.

### 4.2 `/treinamento-corporativo-ia` (AI Culture) — âncora Anthropic Academy
Ritmo: paper (hero + régua) → warm (por que) → paper (método) → **foto-faixa + linhas** (formatos) → [testimonials, hoje não renderiza].

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` portrait) | vender o treinamento sobre a rotina da empresa | foto de sala (`evento-sala.jpg`) 4:5 | h1 de 3 linhas | CTA "Solicitar proposta" |
| 2 | Prova (`proofBar`) | dar tamanho | numerais `+10 mil` e `170` em `--t-figure` | os dois números | rolar |
| 3 | Por que capacitar (`text`) | nomear o problema | tipo | frase-chave "Nosso objetivo é criar capacidade dentro da empresa…" | rolar |
| 4 | Metodologia (`steps`, 4) | mostrar o método | linha de sequência com 4 pontos | os numerais 01–04 sobre a linha | rolar |
| 5 | Formatos (`formats`) | escolher entre 2 produtos | foto `metodo-reuniao.jpg` como faixa de cabeçalho | os dois títulos de formato | "Solicitar proposta" (primário) ou "Consultar disponibilidade" |
| 6 | Depoimentos (`testimonials`) | prova social em vídeo | vídeo 16:9 | o poster | assistir |

Protótipo: [proto/05-ai-culture.html](proto/05-ai-culture.html) (`hero`, `proofbar`, `text`, `steps`, `formats`). Capturas: [hero](proto/shots/05-hero-1440.png), [formats](proto/shots/05-formats-1440.png).
Nota: a seção 6 não renderiza em produção hoje (itens `pending`); o desenho só vale quando houver mídia aprovada. O logo strip também está desligado (faltam arquivos); o desenho reserva uma linha única cinza sob a régua.

### 4.3 `/advisory` — âncora Thoughtworks (afirmação, lista) + Linear about
Ritmo: paper (hero) → warm (a estratégia foi definida) → paper (o que fazemos) → paper (rituais) → warm (passos) → paper (para quem) → warm (FAQ). **Sem faixa escura** (não há prova numérica nesta página).

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` landscape) | posicionar como acompanhamento, não relatório | foto `metodo-reuniao.jpg` 21:9 | h1 | CTA "Conversar com um sócio" |
| 2 | "E agora?" (`text`) | nomear a dor depois do plano | tipo | frase-chave "Não entregamos um plano…" | rolar |
| 3 | O que fazemos (`text` com chips) | listar a postura | lista ruled numerada (5 frases) | as 5 frases | rolar |
| 4 | Rituais (`cards` x3, `animated`) | explicar como funciona | tipo: 3 linhas largas com título em `--t-h2` | os 3 nomes de ritual | rolar |
| 5 | Como começa (`steps`, 3) | mostrar o início | linha de sequência | numerais 01–03 | CTA repetido (já existe no bloco) |
| 6 | Para quem (`list`) | autoqualificar | lista de critérios ruled | as 5 frases a 24px | `noteLink` para o AI Culture |
| 7 | FAQ (`faq`) | tirar dúvida | tipo | as perguntas | falar com sócio |

Protótipo: [proto/03-advisory.html](proto/03-advisory.html) (`hero`, `text`, `chips`, `rituais`, `steps`, `list`, `faq`). Captura: [rituais](proto/shots/03-rituais-1440.png), [list](proto/shots/03-list-1440.png). O FAQ do protótipo tem as 6 perguntas.
**Ordem intocável (decisão do PO, 31/10):** as 7 seções ficam na ordem de `pages.ts`; **não fundir** nenhuma. Risco da página: sete seções de tipo parecem muitas. O ritmo vem de (a) alternar `paper`/`warm` (seções 2, 5 e 7 em warm), (b) variar o modo de cabeçalho: afirmação (2), legenda (3, 4, 5), tabela com título sticky (6, 7), e (c) variar o objeto: foto larga (1), frase-chave (2), lista numerada (3), linhas largas (4), linha de sequência (5), critérios com tique (6), perguntas (7). Nenhuma seção foi unida nem reordenada.

### 4.4 `/execucao` — âncora Linear features (artefato real), adaptado
Ritmo: paper (hero) → warm (problema) → paper (o que construímos) → paper (como entregamos) → paper (showcase).

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` portrait) | prometer solução rodando | foto `front-3-entrega.jpg` (a imagem **não foi indicada pela Carol**, marcada "confirmar" em `pages.ts`) | h1 | CTA "Falar sobre o meu projeto" |
| 2 | Problema (`text`) | nomear o gargalo | tipo | frase-chave "É aí que a Kalidash entra." | rolar |
| 3 | O que construímos (`cards` x5 com `example`) | listar entregas | **Tabela**: 5 linhas (numeral, título, texto, "Ex.:") | os 5 nomes | rolar |
| 4 | Como entregamos (`steps`, 4) | mostrar o método | linha de sequência | numerais | rolar |
| 5 | Feito para funcionar (`showcase`) | provar | foto do caso CBA 4:3 + régua `+100 · 170 · 12 horas` | os 3 números e a foto | link "Ver o case" ou ir a Kognis/Spectra |

Protótipo (r2): [proto/04-execucao.html](proto/04-execucao.html); capturas em [depois/](depois/). As capturas `proto/shots/04-*` e `01/02/03/05/06-*` são da rodada 1 e ficam só como histórico. A seção 3 usa o mesmo desenho Tabela do protótipo do Kognis ([cards-1](proto/shots/02-cards-1-1440.png)).
Observação: o card "Soluções sob medida" cita "captura inteligente de conhecimento na CBA": o showcase logo abaixo fecha o raciocínio. Boa costura; manter a ordem.

### 4.5 `/solucoes` — âncora Mistral /products (abertura dividida, dois produtos de peso igual)
Ritmo: paper (manchete) → paper (Kognis) → warm (Spectra). Sem faixa escura.

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`hero`, sem foto) | apresentar os dois produtos próprios | **tipo**: h1 `--t-display` em 2 linhas, ocupa 10 colunas; os dois parágrafos de apoio ficam à direita, abaixo (abertura à la Mistral) | "Tecnologia que nasce de problemas reais." | CTA "Falar sobre o meu caso" |
| 2 | Oferta 01 Kognis (`offers`) | apresentar o produto | recorte `kognis-heroes.png` (já em uso no `/kognis`) | h2 da oferta + numeral 01 | "Conhecer Kognis" |
| 3 | Oferta 02 Spectra (`offers`) | idem | `ato-01-operacao.jpg` (a mesma foto do hero do `/spectra`) | h2 + numeral 02 | "Conhecer Spectra AI" |

Protótipo (r2): [proto/10-solucoes.html](proto/10-solucoes.html); capturas em [depois/](depois/). O fundo cinza `#f8f8f8` atual dá lugar a `paper`/`warm`; o lado da imagem alterna entre as ofertas.
Fraqueza assumida: a foto da oferta 02 é uma pessoa de EPI, não o produto; a oferta 01 usa uma foto de modelos. Nenhuma das duas mostra o software. Ver §6.

### 4.6 `/kognis` — âncora: princípio do Linear /features (artefato real), **sem artefato disponível**
Ritmo: paper (hero + régua) → paper (tabela) → warm (índice) → paper (tabela) → paper (passos) → warm (FAQ). Ver o desenho em [proto/02-kognis.html](proto/02-kognis.html); capturas [hero](proto/shots/02-hero-1440.png), [cards-1](proto/shots/02-cards-1-1440.png), [steps](proto/shots/02-steps-1440.png), mobile [cards-1](proto/shots/02-cards-1-390.png).

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` frame none) | tirar a objeção "preciso trocar de sistema" | recorte dos dois advogados, alinhado à base do h1 | h1 | CTA "Agendar demonstração" |
| 2 | Resultados (`proofBar`) | dar prova | **os 4 números** `8 horas · 3x · +90% · 100%` em `--t-figure` | os numerais | rolar |
| 3 | Três problemas (`cards`, com `example`) | explicar a plataforma | Tabela (4 colunas) | os 3 títulos | rolar |
| 4 | Atendimento 24h (`cards`) | detalhar o 1º problema | Índice (título sticky à esquerda, 3 itens à direita) | o h2 | rolar |
| 5 | Financeiro (`cards`) | detalhar o 2º problema | Tabela de 3 colunas (sem exemplo) | o h2 | rolar |
| 6 | Como funciona (`steps`, 3) | mostrar a implantação | linha de sequência (diagrama de ordem) + "Implementação ágil em 2 a 3 semanas." | numerais 01–03 e a frase de prazo | FAQ |
| 7 | FAQ (`faq`) | tirar objeções | tipo | perguntas | **o CTA só existe no hero**; o fim da página não tem ação (ver §6) |

Três seções de `cards` seguidas é o ponto frágil: as variantes Tabela / Índice / Tabela evitam a repetição, mas **o ganho forte virá quando houver telas reais** (inbox do WhatsApp, painel financeiro, BI). Hoje o texto "Central de atendimento com histórico de conversas, filas e painel de performance" descreve uma tela que não temos; **não desenhei essa tela** (seria inventar produto).

### 4.7 `/spectra` — âncora Linear /about (foto real + texto 5/7); sem referência de visão por câmera
Ritmo: paper (hero) → warm (o que faz). Duas seções; o rodapé fecha.

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` portrait) | explicar visão computacional em uma frase | `ato-01-operacao.jpg` 9:16 (ver risco) | h1 "Visão computacional aplicada ao chão de operação." | CTA "Conhecer Spectra AI" (leva ao diagnóstico) |
| 2 | O que faz (`cards` x3 curtos) | listar 3 capacidades | Rituais: 3 linhas largas, título `--t-h2` | os 3 títulos | — |

Risco: o botão do hero diz "Conhecer Spectra AI" mas leva ao diagnóstico (mesmo destino de todas as páginas, regra "uma conversão só"); é rótulo da copy, não mexo. A foto é um operário sorrindo, não o produto. **Sem imagem de câmera/dado, o Spectra continua sem protagonista**; com a direção atual a página fica limpa e curta, mas não "elevada".

### 4.8 Espaços de objeto reservados (Kognis e Spectra)

Decisão do PO (31/10): o dono ainda não tem os prints (pediu à Carol). A direção **descreve o que entra e onde**, mas **o estado inicial, que vai ao ar, é SEM tela e sem nenhum bloco no lugar** (rodada 2.1). Nos protótipos ([02-kognis](proto/02-kognis.html), [06-spectra](proto/06-spectra.html)) o slot é `display: none` e só aparece com `#com-tela` na URL, como bloco cinza neutro rotulado por CSS (`data-label`, **não é copy**, fora do `copy-check`). Os dois estados em PNG: [Kognis](comparativo/estados-kognis.png) e [Spectra](comparativo/estados-spectra.png). Itens 5 abaixo: o bloco é opcional (`image?`) e a ausência não deixa buraco nem muda o resto do layout.

| Id | Onde (página · seção, ordem de `pages.ts` preservada) | O que entra | Formato | Tratamento |
|---|---|---|---|---|
| **K1** | `/kognis` · 1º bloco `cards` ("Três problemas resolvidos. Uma plataforma."), entre o `h2` e a tabela | tela real da plataforma com os indicadores (visão geral do BI: o que está em dia, atrasado, gargalo) | 16:9, largura do container | única mídia com `--shadow-lift` da página; `--r-surface`; sem moldura de dispositivo |
| **K2** | `/kognis` · 2º bloco `cards` ("Seu escritório atendendo 24h…"), na coluna esquerda sob o `h2` | tela real do atendimento no WhatsApp: fila e conversa, com histórico | 4:5, até 340px | sem sombra; hairline 1px |
| **K3** | `/kognis` · 3º bloco `cards` ("Seu financeiro fechando sozinho…"), entre o `h2` e a tabela | tela real do painel financeiro: conciliação e divisão de honorários | 16:9, largura do container | sem sombra; hairline 1px |
| **S1** | `/spectra` · bloco `cards` ("Transforme o que acontece na operação em dados objetivos."), entre o `h2` e as 3 linhas | uma de duas: **(a)** frame real de câmera de uma operação com a leitura do Spectra sobreposta, ou **(b)** tela real do painel de produtividade com o histórico estruturado | 16:9, largura do container | `--shadow-lift`; o hero (foto do operário) permanece |

Regras de entrada (valem para os quatro):
1. **Só imagem real do produto**, em captura de tela ou frame. Sem mock, sem ilustração, sem moldura de laptop/celular desenhada.
2. **Dados anonimizados e aprovados pela Carol**: nomes de clientes/processos e valores no Kognis; rostos e identificações de operadores no Spectra (LGPD). Se precisar desfocar, desfocar na origem, não por CSS.
3. Tema claro de preferência; mínimo 2000px de largura no K1/K3/S1 e 1000px no K2; WebP/PNG, enviado ao repositório em `apps/site/public/` com `next/image` e dimensões.
4. **O texto alternativo (`alt`) das novas imagens é conteúdo novo**: precisa ser escrito/aprovado pela Carol (a regra "alt editorial não muda" cobre só as imagens existentes). Sugestão de formato, a validar: descrever a tela em uma frase.
5. **Sem a imagem, o espaço não renderiza.** O bloco é opcional (`image?` no tipo): a página funciona como hoje, sem buraco. O layout não depende do espaço (tabela e linhas continuam alinhadas sem ele).
6. **A seção do `proofBar` do Kognis e a tabela já carregam o resto:** a tela não substitui nem repete os números; entra como prova de que o produto existe.
7. Se chegarem mais telas, **a ordem de preferência** é K1, K3, K2 (a visão geral vence a tela de detalhe); mais de uma imagem por seção vira carrossel ou grade e **fica fora**.

Pendências: K1–K3 aguardam os prints do Kognis (dono pedindo à Carol); S1 aguarda a decisão do dono sobre haver imagem de câmera/painel do Spectra.

## 5. Regras de execução para os devs (ordem sugerida)

1. **B0** tokens + `Reveal` removido dos blocos de leitura (maior ganho por menor risco: some a faixa branca, o pisca e a entrada escalonada).
2. **B1** hero/heroMedia, timeline, beliefs, team, proof (Sobre nós inteiro).
3. **B2** text, cards (3 variantes), steps (linha), list, faq.
4. **B3** offers, showcase, formats, testimonials, proofBar.
5. **B4** passada por rota; mobile: sem trilho horizontal, empilhar.
Cada bloco novo mantém `data-*`/estrutura semântica (`h1` único, `ol` nos passos, `details` no FAQ) e o JSON-LD.

## 6. Decisões do PO e perguntas em aberto

Decididas pelo PO (31/10):
1. **Ordem do conteúdo é intocável:** nenhuma fusão ou reordenação de seções (aplicado no Advisory, §4.3).
2. **Raio 4/12, sombra só na foto-herói e texto `#a4533c`: aprovados**, escopados ao CSS institucional. A Home não muda (os tokens ficam em `institucional.module.css`, não em `home.module.css`).
3. **Sem CTA novo.** Só reuso de CTA que já exista na página, com o mesmo rótulo, e só se a página já tiver bloco `cta`. Resultado: `/kognis` fica sem CTA no fim (nenhuma página tem bloco `cta` hoje, ele retorna `null`); retirei a sugestão anterior.
4. **Hero de `/execucao` mantém `front-3-entrega.jpg`.**
5. **Telas do Kognis:** usar só se o dono mandar; sem telas, nada de tela inventada.

Em aberto:
- O dono respondeu que **existem prints do Kognis**, mas **não informou o caminho**. Busquei no repositório (`**/*kognis*` em `Projetos/carol`): só há `kognis-logo.png` e `kognis-heroes.png` (o recorte dos advogados), nenhuma tela. Atualização do PO: o dono ainda **não tem** os prints (pediu à Carol); não esperei. O lugar de cada tela está reservado e descrito em §4.8 (K1–K3, S1), para encaixar quando chegarem.
- Spectra: o dono tem imagem de câmera ou painel de produtividade? (S1)

## 7. Auditoria dos protótipos contra os tells

| Tell | Resultado nos protótipos |
|---|---|
| Grade de 3+ cartões iguais | nenhum cartão. Colunas separadas por hairline só em passos/métricas (conteúdo sequencial/tabular) |
| Cartão dentro de cartão | nenhum |
| Barra lateral colorida | nenhuma (frase-chave com hairline em cima) |
| Eyebrow + título + cinza em toda seção | eyebrow vira legenda na hairline; seções alternam entre 5 modos de cabeçalho; ainda há legenda+h2 em 6 seções do Kognis (**risco declarado**) |
| Ícone no lugar de objeto | nenhum ícone; tique SVG fino na lista |
| Blob/orb/glow | nenhum |
| Entrada escalonada | nenhuma; os protótipos não têm JS |
| Dois estilos de raio/sombra | só 4 e 12px; sombra só na foto-herói |
| Métrica/depoimento inventado | nenhum; todos os números vêm de `pages.ts` (os `confirmed: true`; o NPS 97 e os logos continuam fora) |

## 8. Verificações e limites

**Feitas na segunda rodada:**
- **Diff de copy automático dos protótipos:** [proto/copy-check.mjs](proto/copy-check.mjs). Compara o texto visível de cada protótipo com `docs/po/relatorios/copy-baseline/<rota>.txt` (sem distinção de caixa, porque os eyebrows são `text-transform` de CSS) e, para texto de `<details>` recolhido (que não está na baseline), com o literal em `pages.ts`. Resultado: **0 linhas extras nos 7 protótipos** (incl. Soluções e Execução separados) (saída no relatório). Teste negativo: troquei uma palavra ("desafios" por "metas") e o script reprovou apontando a linha; revertido.
- **Overflow horizontal:** [proto/overflow-check.mjs](proto/overflow-check.mjs) mede `scrollWidth` em 390, 768, 1024 e 1440 nos 7 protótipos: **28 de 28 sem overflow**. O excesso de 9px do Kognis em 390 era o numeral de 56px nas duas colunas da régua de números; corrigido (36–48px no mobile).
- **Olhei em 390** (`proto/shots/*-390.png`): timeline do Sobre nós, showcase de Execução, passos e formatos do AI Culture (passos refeitos com trilho vertical, o anterior ficava com pontos soltos), rituais do Advisory, tabela do Kognis. **Olhei em 1440** também `beliefs`, `team`, `proof` e `offer-2` (a oferta 02 saía com a coluna da foto errada ao alternar; corrigido).

**Ainda não verifiquei:**
- Em 390 não abri `proof` (Sobre nós), a régua de números do Kognis (medida por script, não vista), FAQ nem o hero de nenhum protótipo. 768 e 1024: só medi overflow, não vi imagem.
- Referências: não vi página de produto de visão computacional. Mistral e Cohere: só a primeira dobra.
- O `copy-check` cobre o texto dos protótipos; **não prova** que a implementação em `SitePage.tsx` mantém a copy (isso é o `copy-diff.mjs` do aceite 3.1, rodado pelo dev). Na r2 a cobertura contra a baseline é de 100% por protótipo (`copy-check` com `MISSING=1` lista o que falta).
- O espaço título→conteúdo (~150px) foi lido na captura, não medido por `getBoundingClientRect`. Console, Web Vitals e CLS não foram medidos (fora do escopo D0/D1).
- Contraste: `--c-brand-text` (5,4:1) e `--accent` (4,3:1) são cálculo meu pela fórmula WCAG, sem ferramenta.
- Servidor: usei o `next dev` da porta 3000 de outra sessão; as capturas "antes" incluem o trabalho não commitado dela.
