# Animação da /advisory: relatório

Branch `claude/motion-advisory-598034`, a partir de `claude/v3-preview` (066fc25). Estudo da referência: `motion-estudo-advisory.md`. Quadros e vídeos: `motion-advisory/`.

## Como funciona (vale para as seções 2 e 3)
Um progresso de rolagem (0 a 1) é medido no retângulo do palco e escrito em variáveis CSS (`--p`, `--s`, `--e0..`). O CSS lê as variáveis: só `transform`, `opacity` e traço por `stroke-dashoffset` em elementos com `pathLength=1`. Mesmo método de `StepsPin` e `BuildStory`. O framer-motion entra com `inView` (revelações) e `cubicBezier` (`SETTLE`). **Não usei `useScroll`**: no teste não atualizou a ref depois da hidratação, então medi `getBoundingClientRect` direto. Sem `m`/`LazyMotion`, porque nada usa `animate` ou `whileInView`.

Palco só com `data-live`: 1024 px ou mais de largura, 600 px ou mais de altura, sem movimento reduzido. Fora disso tudo fica empilhado e completo. O estado "armado" (elementos escondidos até entrar) só existe depois da hidratação e sem movimento reduzido.

## Seção por seção
| Seção | O que foi feito | Padrão | Ficou de fora |
|---|---|---|---|
| 1 Hero | Filete ouro em arco, traçado com `pathLength` depois da entrada. Foto assenta de 1,04 para 1. Cascata de entrada e `--drift` intactos | CSS puro, sem biblioteca no hero | O filete ficou **dentro** do arco, a 14 px da borda, e não deslocado para fora: o arco tem `overflow:hidden` e mudar isso mexeria na foto. Sem deslocamento extra na rolagem, o `--drift` já faz |
| 2 "E agora?" | Palco de 260 svh. Fase 1: linha traçada, cada ponto acende e o evento sobe. Fase 2: o claro sobe e some, a laje Imperial sobe. Fase 3: "Não entregamos um plano." entra forte e atenua, a segunda frase acende, "depois dele." em ouro por último, símbolo traçado, régua 01–04 com filete de progresso. Camada escondida com `inert` e `aria-hidden` | `ApplicationsMethodStory` | O cabeçalho e o rótulo "nº / total" seguem a troca: o capítulo ganha fundo e `--lbl-bg` Imperial, e o tom do cabeçalho é posto na mesma hora. Não editei `HeaderTone` |
| 3 Liderança | Palco de 230 svh. Círculo e pentágono traçados na entrada. A rolagem ativa os itens I a V: linha forte, ícone traçado, vértice acende, raio do centro até ele é traçado. No item V o polígono inteiro fica em ouro. Clique, mouse e teclado ativam o mesmo estado (itens são `<button>`) | `ServicesSection` | Só os ícones atuais em SVG inline. Sem Phosphor |
| 4 Rituais | Cartões em stagger de 90 ms, filete do pé traçado da esquerda, frase em ouro depois. Ícones vivos só com o cartão visível: pontos em órbita (30 s), linha de tendência traçada e último ponto pulsando, círculos que se cruzam. Hover: sobe 4 px e filete fica ouro. Faixa Limestone sobe por último e traça os ícones em sequência | Sem palco | O surge do capítulo continua no título e na faixa. Nos cartões ele sai (`animation: none`), porque dois movimentos no mesmo `li` brigam |
| 5 Três passos | `StepsPin` reaproveitado como em Execução. Filete ouro no topo separa dos rituais, que também são Imperial | Reuso | O `StepsPin` foi feito para 4 passos: com 3, a linha termina um pouco depois de acender o último |
| 6 Critérios | Cada linha entra em stagger, o check é traçado (`clip-path`) e o filete cresce da esquerda | Simples | |
| 7 FAQ | `<details>` mantido. Altura por `grid-template-rows` 0fr→1fr, texto com `opacity`, `+` gira para `×`. JSON-LD `FAQPage` mantido. Instantâneo com movimento reduzido | CSS + estado do React | Mudei o markup do FAQ só na Advisory (nova `FaqView`). O `ProductPage` não foi tocado |
| 8 Fecho | Nuvens com deslocamento vertical ligado à rolagem. Frase entra por linhas e "execução." por último. Seta do CTA desliza no hover | | A frase passou a ter duas linhas fixas (uma por sentença); antes quebrava por largura |

## Números
- **Copy**: o `textContent` do `<main>` de `/advisory` é idêntico ao do commit de partida (4407 caracteres, comparado por script com movimento reduzido). Não rodei `copy-diff.mjs`: ele pede o build de produção em 3199 e a baseline fica no checkout principal.
- **LCP** (dev server, mediana de 3, 1440 / 390): antes 472 / 324 ms, depois 240 / 204 ms. **CLS** 0,0014 antes e depois. É servidor de desenvolvimento, então serve para mostrar que não piorou, não como número de produção. TBT **não medido**.
- **Movimento reduzido**: 0 palcos, 0 atributos de armado, 0 elementos com opacidade 0, altura do palco 1139 px (empilhado), sem rolagem horizontal.
- **CPU 4x** (rolagem do palco da seção 2, 4 s): 55 fps, pior quadro 73 ms.
- **Rolagem horizontal** em 1440, 1024, 768 e 390: 0. **Erros de console**: 0 (desktop e celular).
- `eslint` nos arquivos da página, `tsc --noEmit` (sem erros novos) e `next build` passam. Rodei o `eslint` só nesses 3 arquivos, não no projeto inteiro.

## Autoavaliação
- Seções 2 e 3 estão profissionais: a mensagem (o plano é atropelado, alguém acompanha) está no movimento. A troca Limestone→Imperial é a peça mais forte.
- A seção 4 tem movimento demais por cartão (stagger, filete, ícone vivo, hover). Se o dono achar pesado, o que eu tiraria primeiro é a pulsação do último ponto.
- O filete do hero dentro da foto é discreto; pode não ser o "deslocado" que o brief imaginou.

## Não verificado
- **iOS real e Safari**: só emulei toque e viewport de 390 px no Chromium. O caminho sem palco não usa `animation-timeline`, mas não foi visto num iPhone.
- **Cabeçalho**: não medi `getComputedStyle` antes e depois, só vi nos quadros que a cor da logo acompanha o fundo. Nenhum arquivo do cabeçalho foi alterado.
- **Outras páginas**: não comparei pixel a pixel `/`, `/solucoes`, `/kognis`, `/spectra`. Alterei `kit.module.css` (blocos novos, escopados por `.v3`, que só a Advisory usa) e `KitPage.tsx` (com `if` por página); a Execução e o AI Culture passam pelos mesmos caminhos de antes, mas não os testei.
- **Quadros "antes"** por seção, lado a lado com a referência: não gerei. Há só os quadros do depois.
- Vídeo gravado com Playwright, rolagem contínua em ritmo fixo, sem pausa por seção.

## Commits
`4943c3d` seções 2 e 3 · `1696a18` ícones da seção 3 · rituais · hero, critérios, FAQ, fecho e separação dos passos · `capture.cjs`, `vitals.cjs`, `text.cjs` e este relatório.
