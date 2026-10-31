# D1 — Direção das 7 páginas institucionais

> Designer D0/D1. Só direção e protótipo; nada em `apps/site` foi editado. Sistema em [00-sistema.md](00-sistema.md) e [tokens.css](tokens.css). Copy: **só** as strings de `pages.ts` (conferi os protótipos contra o arquivo; ver §8).
> Capturas reais do estado atual em [antes/](antes/) (PNG de página inteira, 1440 e 390, rolagem gradual para disparar o `Reveal`). Referências em [refs/](refs/). Protótipos em [proto/](proto/) com capturas de seção em [proto/shots/](proto/shots/).

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

### 2.7 Não consegui ver (e por isso não uso como âncora)
McKinsey (/capabilities) e Vercel (/solutions) devolveram só a primeira dobra (900px), sem conteúdo útil (provável bloqueio/consentimento); Cohere (/north), Stripe (/payments) e Palantir (/platforms/aip) capturaram em página inteira, mas **eu não os abri** por limite de contexto. Apaguei esses PNGs de `refs/` para não deixar arquivo não analisado no repositório. As referências "McKinsey, Vercel, Palantir, Cohere/Mistral, Stripe payments" do checklist seguem **não verificadas**; não as cito como âncora.

## 3. Âncora por página

| Página | Âncora (vista) | O que a âncora ensina | Observação |
|---|---|---|---|
| Sobre nós | **Linear /about** (+ Stripe /about para a lista ruled) | manchete → foto larga → texto 5/7; gente real | foto dos fundadores já existe e é boa |
| AI Culture | **Anthropic Academy** (hero editorial) + Stripe (lista ruled) | texto-primeiro, formatos em linhas, "amostra real" | foto de sala já existe |
| Advisory | **Thoughtworks** (afirmação e lista vertical) + Linear about | frase única, rituais em lista | sem foto de produto: o objeto é o texto |
| Execução | **Linear /features** (artefato real + legenda), adaptado a **um** caso | foto do caso CBA como protagonista | números reais da página viram a régua |
| Soluções | **Sem âncora externa vista** (candidata Cohere/Mistral não aberta) | — | solução própria: dois painéis alternados com o produto de cada lado |
| Kognis / Spectra | **Linear /features** só no princípio (artefato real) | produto como herói | **hoje não há artefato do produto** (ver §6) |

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

Protótipo: [proto/03-advisory.html](proto/03-advisory.html) (`hero`, `text`, `chips`, `rituais`, `steps`, `list`, `faq`). Captura: [rituais](proto/shots/03-rituais-1440.png), [list](proto/shots/03-list-1440.png). **O FAQ do protótipo mostra 4 das 6 perguntas** (corte meu para o desenho; as 6 entram no código).
Risco da página: sete seções de tipo parecem muitas; o ritmo depende de alternar paper/warm e de variar os modos de cabeçalho (afirmação, legenda, tabela). Se ainda parecer repetitivo, a recomendação é fundir "O que fazemos" e "Rituais" (decisão de produto sobre a ordem, **não** de copy).

### 4.4 `/execucao` — âncora Linear features (artefato real), adaptado
Ritmo: paper (hero) → warm (problema) → paper (o que construímos) → paper (como entregamos) → paper (showcase).

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` portrait) | prometer solução rodando | foto `front-3-entrega.jpg` (a imagem **não foi indicada pela Carol**, marcada "confirmar" em `pages.ts`) | h1 | CTA "Falar sobre o meu projeto" |
| 2 | Problema (`text`) | nomear o gargalo | tipo | frase-chave "É aí que a Kalidash entra." | rolar |
| 3 | O que construímos (`cards` x5 com `example`) | listar entregas | **Tabela**: 5 linhas (numeral, título, texto, "Ex.:") | os 5 nomes | rolar |
| 4 | Como entregamos (`steps`, 4) | mostrar o método | linha de sequência | numerais | rolar |
| 5 | Feito para funcionar (`showcase`) | provar | foto do caso CBA 4:3 + régua `+100 · 170 · 12 horas` | os 3 números e a foto | link "Ver o case" ou ir a Kognis/Spectra |

Protótipo: [proto/04-execucao-solucoes.html](proto/04-execucao-solucoes.html) (`showcase`), captura [showcase](proto/shots/04-showcase-1440.png). A seção 3 usa o mesmo desenho Tabela do protótipo do Kognis ([cards-1](proto/shots/02-cards-1-1440.png)).
Observação: o card "Soluções sob medida" cita "captura inteligente de conhecimento na CBA": o showcase logo abaixo fecha o raciocínio. Boa costura; manter a ordem.

### 4.5 `/solucoes` — sem âncora externa vista
Ritmo: paper (manchete) → paper (Kognis) → warm (Spectra). Sem faixa escura.

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`hero`, sem foto) | apresentar os dois produtos próprios | **tipo**: h1 `--t-display` em 2 linhas, ocupa 10 colunas | "Tecnologia que nasce de problemas reais." | CTA "Falar sobre o meu caso" |
| 2 | Oferta 01 Kognis (`offers`) | apresentar o produto | recorte `kognis-heroes.png` (já em uso no `/kognis`) | h2 da oferta + numeral 01 | "Conhecer Kognis" |
| 3 | Oferta 02 Spectra (`offers`) | idem | `ato-01-operacao.jpg` (a mesma foto do hero do `/spectra`) | h2 + numeral 02 | "Conhecer Spectra AI" |

Protótipo: [proto/04-execucao-solucoes.html](proto/04-execucao-solucoes.html) (`solucoes-hero`, `offer-1`, `offer-2`); captura [offer-1](proto/shots/04-offer1-1440.png). O fundo cinza `#f8f8f8` atual dá lugar a `paper`/`warm`; o lado da imagem alterna entre as ofertas.
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

### 4.7 `/spectra` — mesma situação do Kognis
Ritmo: paper (hero) → warm (o que faz). Duas seções; o rodapé fecha.

| # | Seção | Papel | Objeto | Domina | Próximo |
|---|---|---|---|---|---|
| 1 | Hero (`heroMedia` portrait) | explicar visão computacional em uma frase | `ato-01-operacao.jpg` 9:16 (ver risco) | h1 "Visão computacional aplicada ao chão de operação." | CTA "Conhecer Spectra AI" (leva ao diagnóstico) |
| 2 | O que faz (`cards` x3 curtos) | listar 3 capacidades | Rituais: 3 linhas largas, título `--t-h2` | os 3 títulos | — |

Risco: o botão do hero diz "Conhecer Spectra AI" mas leva ao diagnóstico (mesmo destino de todas as páginas, regra "uma conversão só"); é rótulo da copy, não mexo. A foto é um operário sorrindo, não o produto. **Sem imagem de câmera/dado, o Spectra continua sem protagonista**; com a direção atual a página fica limpa e curta, mas não "elevada".

## 5. Regras de execução para os devs (ordem sugerida)

1. **B0** tokens + `Reveal` removido dos blocos de leitura (maior ganho por menor risco: some a faixa branca, o pisca e a entrada escalonada).
2. **B1** hero/heroMedia, timeline, beliefs, team, proof (Sobre nós inteiro).
3. **B2** text, cards (3 variantes), steps (linha), list, faq.
4. **B3** offers, showcase, formats, testimonials, proofBar.
5. **B4** passada por rota; mobile: sem trilho horizontal, empilhar.
Cada bloco novo mantém `data-*`/estrutura semântica (`h1` único, `ol` nos passos, `details` no FAQ) e o JSON-LD.

## 6. Perguntas de produto para o PO

1. **Telas reais do Kognis e do Spectra.** Sem screenshot/foto do produto, Kognis e Spectra ficam sem protagonista (só número e frase). A Carol tem prints do painel de atendimento, do financeiro e do BI do Kognis, e imagens de câmera/dado do Spectra? Sem isso, a elevação dessas duas páginas tem teto.
2. `/kognis` não tem CTA no fim da página; as outras páginas têm CTA em mais de um ponto. Quer repetir "Agendar demonstração" depois do FAQ? (O bloco `cta` hoje retorna `null`.)
3. `/execucao`: a foto do hero (`front-3-entrega.jpg`) está marcada "confirmar" em `pages.ts`. Mantém?
4. O AI Culture tem o `testimonials` e o logo strip desligados. A direção vale quando ligarem; confirma que a seção pode sumir sem deixar buraco até lá?
5. Sombra e raio: a proposta é uma sombra só (na foto-herói) e dois raios (4/12). Aprova tirar a sombra de todo o resto?

## 7. Auditoria dos protótipos contra os tells

| Tell | Resultado nos 5 protótipos |
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

## 8. O que não verifiquei / limites

- **Copy:** conferi os protótipos contra as strings de `pages.ts` lendo o arquivo e copiando; **não rodei diff automático**. O FAQ do Advisory no protótipo tem 4 de 6 perguntas (declarado acima). Dois textos do hero de `/solucoes` e o `lead` de `/solucoes` foram copiados da captura (não do arquivo, que li só em parte).
- **Referências:** não vi McKinsey, Vercel, Palantir, Cohere e Stripe /payments (ver §2.7). As análises das referências são de capturas de página inteira reduzidas a ~2000px de altura e de uma captura de viewport (Linear about, Anthropic); não rolei as páginas com olho humano.
- **Protótipos:** vi em 1440 as seções-chave (hero e timeline do Sobre nós; hero, tabela e passos do Kognis; showcase e oferta 01; rituais e lista do Advisory; hero e formatos do AI Culture). **Não vi** em 1440: `beliefs`, `team`, `proof` (Sobre nós), FAQ, `steps` do Advisory/AI Culture, `offer-2`. Vi em 390 só as seções `hero` (não abri a imagem) e `cards-1` do Kognis. Não testei 1024 nem 768. Nenhum teste de overflow numérico: a captura de 390 saiu com largura 399 no cálculo do `clip`, indício de ~9px de excesso em algum bloco do protótipo `02-kognis`, **não investigado**.
- **Estado atual:** medi o espaço título→conteúdo (~150px) olhando a captura, não por `getBoundingClientRect`. Console, Web Vitals e CLS **não** foram medidos (fora do escopo D0/D1).
- **Contraste:** `--c-brand-text` (5,4:1) e o `--accent` (4,3:1) são cálculos meus pela fórmula WCAG, sem ferramenta.
- **Servidor:** usei o `next dev` da porta 3000 de outra sessão; o conteúdo capturado inclui o trabalho não commitado dessa sessão.
