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
