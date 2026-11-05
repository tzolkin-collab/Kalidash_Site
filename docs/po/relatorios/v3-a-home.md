# V3 · Sessão A · Home (`/`)

Branch `claude/v3-home-64510c`, sem push e sem merge. Capturas em `v3-a-home/` (JPG, `antes-*` do commit `240a2bb`, `depois-*` do build de produção). A4 (logos) não foi feito: aguarda os arquivos.

## O que mudou

| Item | Feito |
|---|---|
| A0 | Kit Adobe `krs4uwp` só na Home, só dentro do `<main>` (classe `.v3`). `--w-title: 400` e `--w-strong: 700` num lugar só. Fundo Limestone nas seções da Home. O seletor `:where(.home) :is(h1,h2,h3)` não foi editado. |
| A2 | Bloco do problema em Imperial com filete dourado; sombra e vinheta terracota trocadas por roxo. Holograma em bronze/ouro (só cor, animação intacta). Subtítulo em itálico dourado. Copy nova. Empilhamento dos cartões intacto. |
| A3 | Fundo Limestone / Limestone fundo, títulos Kepler com tamanho e quebra revistos (`text-wrap: balance`). Sem redesenho. |
| A5 | Eyebrow `Case destaque • CBA`; frase-chave em Kepler itálico com filete dourado; selo vira legenda discreta; CTA `Ver o case completo →` em botão Imperial, para `/blog?categoria=cases` (`pageReady: true`). |
| A6 | Diagnóstico em Imperial, largura total, textura `nuvens-douradas.jpg` (opacidade .13, lazy). "na sua operação." e "Primeiro entendemos…" em itálico dourado. CTA principal Limestone, secundário só contorno (classes novas `.diagPrimary/.diagSecondary`). `id="diagnostico"`, `scroll-margin` e o tagueamento ficaram. Emenda com o rodapé: filete dourado que o rodapé já tinha. |
| A1 | Hero Imperial. "falta" em itálico dourado. Pensador `hero-pensador.jpg` (1000×1200, 95 KB, `priority`) no arco com filete dourado; legenda "A IA faz a parte operacional. O **protagonismo** é nosso." CTA ouro com texto Imperial. Faixa de logos em branco translúcido, números em Kepler dourado. Mantidos: eyebrow, selo Anthropic (texto do selo no celular passou a Limestone), faixa em loop, números, cascata de entrada. |

Por seção (referência → reproduzi → deixei de fora):
- **Hero** (`doc-01`, Lovable): tese em primeiro plano, palavra de sentido em ouro, pensador no arco; deixei de fora o menu e os rótulos do Lovable.
- **Problema** (`doc-03/04`): voltar ao roxo; mantive o holograma e os cartões brancos, sem o quadriculado de quatro itens do Lovable (copy diferente).
- **Case** (`doc-05` não está na pasta): usei a ordem do brief.
- **Diagnóstico** (`doc-09`): reproduzi quase literalmente; sem os enfeites do cartão do Lovable.

## Fonte e LCP (decisão tomada, vale revisão)

O kit como `<link rel="stylesheet">` bloqueante levou o LCP móvel de 5,4 s para 10,6 s (FCP 1,8 → 3,0 s; texto invisível até a fonte chegar, `font-display: auto` do kit). Solução: o CSS do kit é pré-carregado (`rel="preload"`) e aplicado por `useEffect`; a classe `data-fonts="ready"` só entra depois de `document.fonts.load` das 4 faces. Até lá valem fontes de reserva com `size-adjust`. Efeito: nada some, mas há uma troca de fonte visível logo após o carregamento. Se a Carol/o dono preferir, no painel do Adobe Fonts dá para marcar `font-display: swap` no kit; aí o `<link>` simples basta.
`size-adjust: 88%` da reserva da Kepler é estimativa, não medido contra a Georgia em todos os sistemas.

## Números (Lighthouse 12, mediana de 3, `/`, build de produção local)

| | LCP | CLS | TBT | FCP | Perf |
|---|---|---|---|---|---|
| Móvel antes | 5109–5397 ms | 0 | 43–44 ms | 1,8 s | 73–78 |
| Móvel depois | 5145 ms | 0,001 | 62 ms | 2,0 s | 75 |
| Desktop antes | 1025 ms | 0 | 0 | 459 ms | 95 |
| Desktop depois | 1046 ms | 0,001 | 0 | 497 ms | 95 |

(Duas rodadas "antes" em móvel: 5397 e 5109 ms; "depois" cai dentro dessa variação.) O elemento de LCP móvel passou de imagem a `<p>` do hero (texto com a fonte de reserva); desktop continua a imagem. TBT +18 ms no móvel (hidratação + troca de fonte). Fontes: 323 → 626 KB transferidos (Kepler/Acumin).

## Aceites

- **Cabeçalho**: `getComputedStyle` (família, tamanho, peso, cor, fundo, posição) em 1440 e 390, topo, sobre fundo claro e sobre escuro: JSON idêntico ao de partida (`header-antes.json` = `header-final.json`). Nenhum arquivo do cabeçalho foi tocado.
- **Animações**: nenhum arquivo de animação alterado; entrada do hero (`data-enter`, `--enter-delay`), `ProblemHologram`, `--stack` dos cartões, `FlickeringGrid`, galeria, `Reveal`, faixa de logos mantidos. Quadros antes/depois em `v3-a-home/movimento/` (hero em 5 instantes e problema em 3, 1440 e 390, e versão `reduzido` com `prefers-reduced-motion`). Conferi o hero e a abertura nos quadros; **não** conferi iOS real nem iOS simulado.
- **Copy** (`copy-diff-home.txt`, mesmo texto visível antes × depois): só mudaram os itens do brief. O `copy-diff.mjs` oficial acusa a página inteira (baseline antiga, também nas páginas que não toquei), então usei um diff próprio da Home.
- `tsc --noEmit` e `next build` passam; `eslint src/app/home` sem erros (2 avisos antigos de `<img>`). 1440, 390: sem rolagem horizontal e sem erro de console. **Não** rodei 1024 e 768 com captura; `/advisory` e `/sobre-nos` não foram recapturados: não editei nenhuma regra compartilhada (`.eyebrow`, `.primaryButton`, `.secondaryButton`, `.textLink`, `.whatsapp`, `.home`); só acrescentei classes `.v3 …`.

## Autoavaliação

- **Hero**: hierarquia clara, ficou bom. Eyebrow, título, apoio, CTA e legenda do pensador leem em ordem; a legenda é discreta. Faixa de logos em branco translúcido perdeu cor de marca (inevitável sem arquivos novos).
- **Problema**: a hierarquia melhorou, mas o holograma ficou fraco: bronze sobre Limestone claro tem pouca presença. O cartão Imperial tem espaço vazio embaixo (altura herdada do holograma). Uma versão com a coluna do holograma em Imperial seria mais forte; não fiz porque muda o desenho do bloco.
- **O que fazemos / Experiência / Resultados**: só fonte e fundo; legível, sem desenho novo, como o brief pede. O destaque em itálico dourado não aparece aqui porque não há pedido de copy.
- **Case**: boa leitura (eyebrow → título → texto → frase-chave → selo → CTA). O selo ainda é um texto longo em caixa-alta.
- **Diagnóstico**: o mais próximo da referência.

## Riscos e pendências

- Troca de fonte pós-carregamento (acima); CLS medido ~0,001, mas em celular real e conexão lenta pode aparecer.
- Pesos 300/600 do kit ainda não existem: títulos em 400, negrito em 700.
- A4 (logos) bloqueado. `doc-05.png` não existe na pasta de referências.
- Sem teste em Safari/iOS.

## Commits

Ver `git log claude/v3-home-64510c` (código da Home; relatório e capturas).

---

# Rodada 2 (revisão do PO, nota 8,0)

Capturas em `v3-a-home/r2/` (JPG). Commits no branch, sem push nem merge.

## Correções

1. **Mancha clara sob "10 mil"**: era o halo do holograma (`.hologramWrapper::before`, branco) vazando sobre o hero Imperial. Corrigido com `overflow: clip` em `.v3 .problem` (já na rodada 1 depois das capturas) e o halo agora é roxo/ouro, não branco. Conferido em `seam-depois-clip.jpg`.
2. **Holograma**: o painel do holograma virou um cartão Imperial com filete dourado (mesma linguagem do cartão de texto); cérebro em ouro claro (`#D2B27A`/`#A88A58`), pontos de ancoragem em ouro claro, halo em roxo. Só cores e container: animação, luzes e camadas intactas. Presença bem melhor (`r2-home-problem-1440.png`).
3. **Vazio no cartão Imperial**: o conteúdo ficou centralizado na altura do cartão, com um filete dourado acima do título e texto em 20 px. Só no desktop (≥1101 px); abaixo disso o cartão continua oculto como antes (e o painel do holograma também), e o empilhamento dos cartões não mudou.
4. **Botões**: CTA do case e os dois do Diagnóstico agora são retângulos de raio 4 px, como o do hero; cores e contorno do secundário mantidos.
5. **Serifa pequena**: `kepler-std-subhead` com `letter-spacing: 0` nos títulos dos cartões do problema, frase-chave do case, itens "Onde aplicamos/ensinamos", microcopy do Diagnóstico, subtítulo do problema, métricas dos depoimentos, legenda do hero e, abaixo de 1000 px, nos títulos de seção e dos cartões "O que fazemos". Títulos grandes seguem em Display. Subhead entra na lista de fontes aguardadas antes da troca (`data-fonts="ready"`).
6. **Case × `doc-05.png`**: mesma estrutura (eyebrow, título, texto, imagem à direita); a nossa acrescenta frase-chave e CTA e troca o selo pílula por legenda; nenhum ajuste a mais.

## Entregas que faltavam

- **Cabeçalho na Home** (`r2/cabecalho-*`): topo real em 1440 e 390 (barra branca sobre o hero Imperial, logo e menu escuros, legíveis), submenu aberto em 1440 (`cabecalho-1440-submenu`), menu do celular, e depois de rolar sobre hero/problema/diagnóstico/fronts. Sobre Imperial a barra vira Imperial com logo e menu claros (`tone=dark`); sobre claro, branca (`tone=light`) (`r2/cabecalho-log.txt`). No topo da página a barra é branca porque o cabeçalho é sticky e ocupa 57 px acima do hero; é o comportamento existente, não mexi. No celular o logo recolhido fica sobre texto ao rolar, como nas outras páginas.
- **1024 e 768** (`r2/home-1024-*`, `r2/home-768-*`): sem rolagem horizontal, sem erro de console. No tablet o bloco do problema mostra só os cartões empilhados, como no original. Achado no caminho: o `display: none` do cartão Imperial abaixo de 1100 px que eu havia anulado sem querer (cartão gigante a 768) foi corrigido.
- **iOS (UA de iPhone, 390, DPR 3, toque)** (`r2/ios-*`): sem erro, sem rolagem horizontal, hero, problema, case e diagnóstico renderizam como no celular. É Chromium com UA de iPhone, **não WebKit/iOS real**.
- **`/advisory` e `/sobre-nos`, antes (`240a2bb`) × depois, pixel a pixel** (página inteira, 1440 e 390, movimento reduzido): **0 pixels diferentes** nas quatro comparações (`r2/pixel-*-antes/depois.jpg`, `r2/log.txt`). `home.module.css` não vazou.

## Números (Lighthouse 12, mediana de 3, `/`, build de produção, mesma máquina)

| | LCP | CLS | TBT | FCP |
|---|---|---|---|---|
| Móvel antes (`240a2bb`) | 5236 ms | 0 | 44 ms | 1,8 s |
| Móvel depois (r2) | 5144 ms | 0,001 | 48 ms | 2,0 s |
| Desktop antes | 1025 ms | 0 | 0 | 459 ms |
| Desktop depois (r2) | 1047 ms | 0,001 | 0 | 496 ms |

Fontes transferidas: 323 KB → 876 KB (Kepler Display + Subhead + Acumin). LCP móvel não piorou; o elemento passou de imagem a `<p>` (texto com fonte de reserva).

## Ainda não verificado / riscos

- Safari/iOS real; troca de fonte pós-carregamento em conexão lenta real.
- O cartão de texto do problema continua oculto abaixo de 1100 px (comportamento anterior); a leitura "Reconhece algum destes sintomas?" só existe no desktop.

---

# Rodada 3: cabeçalho roxo no topo da Home

Capturas e logs em `v3-a-home/r3/`. Só Home, no branch, sem push nem merge.

## O que mudou (nenhum arquivo do cabeçalho foi editado)

Mesmo padrão do Advisory (`kit.module.css .kitDark`), só em `home.module.css` e `HomePage.tsx`:
- Hero e Diagnóstico com `data-tone="dark"`: o `HeaderTone` (sem edição) passa a marcar `html[data-header-tone="dark"]` em y=0 e no Diagnóstico.
- Classe `.homeDark` no contêiner da Home. **Celular (≤1100 px):** cabeçalho com `margin-bottom: -76px` e o hero com `padding-top` +76 px (o hero não se move: diferença média de pixel abaixo do cabeçalho r2×r3 = 0,5 e 1,1 de 255, ruído de JPEG), logo `--logo-body` claro e, com tom claro, Imperial. **Desktop:** antes do JS (`html:not([data-header-tone])`) a barra já nasce Imperial, com menu e logo claros, para não haver faixa branca.

## Resultado (`r3/log.txt`, `r3/flash-log.txt`)

- **y=0, 1440 e 390:** `tone=dark`; desktop com barra `rgba(40,24,59,.94)`, logo e menu claros; celular com logo e botão de menu legíveis sobre o Imperial. Posição do cabeçalho e do `h1` inalteradas entre rolagens.
- **Carga fresca:** a abertura `LogoIntro` é branca por desenho (não tocada). A faixa do cabeçalho sai de branco (255) para Imperial (~49) de forma monótona (~1 s), sem voltar ao branco. No commit de partida a faixa ia a ~175 e voltava a ~251 (branco). Sem faixa branca depois da abertura.
- **Rolagem:** problema → claro; Diagnóstico → escuro; fronts → claro; voltar ao topo → escuro. Descer esconde, subir devolve o cabeçalho (`data-header-collapsed`, y=0). Recarregar no meio da página (Diagnóstico): `tone=dark`. Vindo de `/sobre-nos` pelo logo (transição): chega em `/` com `tone=dark`, faixa Imperial desde 150 ms no desktop e 600 ms no celular. Submenu legível (`submenu-1440.jpg`); menu do celular em `menu-aberto-390.jpg`.
- **Isolamento:** `/advisory` e `/sobre-nos` em 1440 e 390, página inteira, contra o commit de partida: **0 pixels diferentes** nas quatro.
- **Animações:** quadros de antes (`../movimento/antes-*`) e depois (`r3/movimento/r3-*`, e `r3-reduzido-*` com movimento reduzido) em 1440 e 390: entrada do hero, selo Anthropic e faixa de logos conferidos; nenhum arquivo de animação foi tocado.

## Números (Lighthouse 12, mediana de 3, `/`, produção)

| | LCP | CLS | TBT |
|---|---|---|---|
| Móvel antes (`240a2bb`) | 5236 ms | 0 | 44 ms |
| Móvel r3 | 5060 ms | 0,001 | 38 ms |
| Desktop antes | 1025 ms | 0 | 0 |
| Desktop r3 | 1042 ms | 0,001 | 0 |

CLS = 0,001, igual ao da rodada 2 (não subiu); em relação à partida (0) é 0,001, da troca de fonte. O bloco do problema no celular não foi tocado.

---

# Rodada 4: hero volta ao de `240a2bb`

Decisão do dono. Capturas em `v3-a-home/r4/` (`antes-*` = `240a2bb`, `depois-*` = agora); quadros de movimento em `r4/movimento/` (`r4-*`, e `r4-reduzido-*`) contra `movimento/antes-*`.

## O que mudou
- `home-hero` restaurado de `240a2bb`: markup, copy (título, subtexto, eyebrow), estátua `/kalidash-hero-sculpture.png` no arco roxo, botão terracota, faixa de logos e números nas cores originais; sai a legenda "protagonismo". `HomeHero.module.css` voltou ao original; `hero-pensador.jpg` removido.
- Única diferença visual: título em **Kepler** (regra geral dos h1 da Home), com tamanho `clamp(44px, 5.8vw, 86px)`, entrelinha 1,04 e tracking -0,015em, quebra equilibrada em 3 linhas (1440) e 3 (390). O resto do hero mantém as fontes originais da Home (Source Sans/Inter), restauradas dentro do `.v3 .hero`.
- O hero ocupa a largura toda com fundo branco (`.v3 .hero`), para não herdar o Limestone do `<main>`.
- Cabeçalho: saíram o `data-tone="dark"` do hero, `.homeDark` e as compensações de margem e `padding-top` da rodada 3. O Diagnóstico segue com `data-tone="dark"`.
- Problema, frentes, experiência, case e Diagnóstico: sem alteração.

## Conferido
- **Cabeçalho** (`r4/log.txt`): topo, emenda, problema e volta ao topo iguais ao de partida (`tone=light`, mesma cor de fundo e posição) em 1440 e 390; no Diagnóstico `tone=dark` e a barra escurece; `h1Top` idêntico a `240a2bb` (203 em 1440, 168 em 390).
- **Emenda hero × problema:** hero branco, números, depois o cartão Imperial sobre Limestone; o halo do holograma não vaza para os números (`depois-emenda-hero-problema-1440.jpg`).
- **Animações do hero:** CSS de entrada restaurado byte a byte; quadros antes × depois conferidos em 1440 e 390.
- **Isolamento:** `/advisory` e `/sobre-nos`, 1440 e 390, página inteira: 0 pixels diferentes das quatro comparações com `240a2bb`.

## Números (Lighthouse 12, mediana de 3, `/`, produção)

| | LCP | CLS | TBT |
|---|---|---|---|
| Móvel `240a2bb` | 5236 ms | 0 | 44 ms |
| Móvel r4 | 5278 ms | 0,001 | 56 ms |
| Desktop `240a2bb` | 1025 ms | 0 | 0 |
| Desktop r4 | 1018 ms | 0,001 | 0 |

O elemento de LCP voltou a ser a estátua. O CLS 0,001 vem da troca de fonte (Kepler) nos títulos do `<main>`.
