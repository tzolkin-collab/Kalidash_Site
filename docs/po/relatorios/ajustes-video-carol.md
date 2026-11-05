# Ajustes do vídeo da Carol (04/11/2026): relatório

Branch `claude/ajustes-video-88a74a`, partindo de `d10fbb1`. Um commit por item (16 commits). Sem push e sem merge. Servidor em `:3304` (build de produção); a `:3300` não foi tocada.
PNGs em `docs/po/relatorios/ajustes-video-carol/` (`NN-antes-1440/390.png`, `NN-depois-1440/390.png`; Sobre nós também em `sn/`, Advisory em `08/`). Capturas feitas com `prefers-reduced-motion: reduce` para o conteúdo aparecer inteiro.

## Item a item

| # | Item | O que mudou | Onde |
|---|---|---|---|
| 1 | AI Culture, "capacidade" | A frase saiu do corpo da seção e virou faixa baixa em **Aubergine `#46304F`**, esticada, 1 linha no desktop (≥1100). "capacidade" segue em itálico dourado e o filete continua traçado pela rolagem. Usei Aubergine e não Imperial porque o capítulo seguinte é Imperial e os dois se fundiriam. | `AiCultureMotion.tsx`, `ai-culture-motion.module.css` |
| 2 | AI Culture, fecho | `ClosingBg` com `/marca/nuvens-douradas.jpg`, igual à Advisory | `KitPage.tsx` |
| 3 | Execução, "Saber o que mudar" | 550 px → **389 px** (1440). Título em 2 linhas (`max-width: 30ch`), menos respiro. Animação dos gargalos intacta | `execucao-motion.module.css` |
| 4 | Execução, "O projeto termina…" | Frase em **uma linha** esticada (≥1100), apoio abaixo com 80ch, sem o tracking apertado que a deixava "cortada". Animação `--end` do `StepsPin` intacta | `kit.module.css` |
| 5 | Execução, fecho | Arcos trocados por `ClosingBg` (nuvens). O deslocamento antigo dos arcos (`arcsDrift`) foi **substituído** pela paralaxe do `ClosingBg`, não perdido | `KitPage.tsx`, `kit.module.css` |
| 6 | Execução, H1 | Ver "Divergências" abaixo. Agora `clamp(36px, 4.4vw, 64px)`, coluna de 56% | `kit.module.css` |
| 7 | Rótulo × faixa grega | A faixa (z-index 3) caía dentro dos 64 px que a cortina cobre e passava por cima do rótulo "02 / 05". A abertura da Execução ganhou 72 px no pé. **AI Culture não tinha o defeito** (a barra de provas fica entre a abertura e a cortina); conferido | `kit.module.css` |
| 8 | Advisory, palcos | `ProblemStage` 260 → **170 svh** (2340 → 1530 px a 900 de altura), `LeadStage` 230 → **170 svh**. Mesma sequência, janelas de rolagem mais justas. Correção do quadro vazio: "Não entregamos um plano." entra inteira junto da camada escura e "Acompanhamos o que acontece" parte de 70% (era 30%); "depois dele." parte de 40% (era 0). Folhas de quadros (p = 0,05 a 0,95) em `08/problema-depois-folha.png` e `08/lideranca-depois-folha.png`, tiradas com a versão anterior do ajuste fino (`--strong` de 0,6; o commit final usa 0,7) | `AdvisoryMotion.tsx`, `advisory-motion.module.css` |
| 9 | Sobre nós, foto CBA | `/home/g21-cba-premio.jpg` → **`/home/g06-saam.jpg`**, `alt`: "Executivos reunidos em torno de uma mesa de trabalho, com laptops, em uma jornada de alta gestão". **A Carol precisa aprovar.** Motivo: o slide da g21 traz o título do case da CBA (a imagem do mosaico dizia mais do que a legenda); a g06 é horizontal (o mosaico corta em 3:2 sem perder ninguém), não tem texto de case, já está publicada na galeria da Home e combina com a legenda "Do chão de operação à formação executiva". Alternativa: `g19-sifra-1` (grupo posando) ou `g20-sifra-2` (instrutor em ação, vertical) | `institucional/pages.ts` |
| 10 | Sobre nós, vazio | A seção que mudou: **"Nossa história" (mosaico + 3 atos)**, 2089 → **1830 px**. Menos respiro acima do mosaico, abaixo dele, entre atos e antes da frase final | `sobre-nos.module.css` |
| 11 | "Nós ensinamos o que vivemos…" | Uma linha no desktop (≥1100); no celular, uma frase por linha (`.keyPart`). Texto idêntico (verificado no DOM) | `SobreNosPage.tsx`, `sobre-nos.module.css` |
| 12 | "A inteligência artificial…" | **Criação de Adão** (`pdf-assets/pinturas/`) otimizada para `public/marca/criacao-de-adao.webp` (148 KB), 20% de opacidade à direita com máscara que some à esquerda. Contraste medido no pior fundo (desktop): título 10,1, apoio 6,4 | `sobre-nos.module.css` |
| 13 | Foto da equipe | O `max-height` + `object-fit: cover` cortava as cabeças de trás. Sem teto: a razão renderizada é 1,79 (a do arquivo) em 1440, 1024, 768 e 390 | `sobre-nos.module.css` |
| 14 | Blog, filtros | ≥1101: coluna de 200 px à esquerda da grade, `position: sticky`. Abaixo disso, faixa no topo como antes (e a cópia no cabeçalho em tablet/celular continua). Mantidos `?categoria=`, `data-block="category-filter"`, `aria-pressed`, `data-*` do contrato; a página `/preview/blog` usa o mesmo `BlogGalleryView`. No desktop `scrolled` nunca liga, então o cabeçalho não ganha a cópia dos filtros. Testado: clique em "Cases" gera `?categoria=cases` e 3 cartões; `?categoria=guias` abre filtrado; 1100 px ainda é faixa, 1101 já é lateral | `blog/views.tsx` (envolveu nav + grade em `div[data-block="blog-layout"]`; o resto do diff é indentação), `blog.module.css` |
| 15 | Menu | Só os três textos de `hint` em `nav`. Submenu desktop conferido (cada descrição quebra em 2 linhas, sem estourar); o menu do celular não mostra descrições | `home/content.ts` |
| 16 | Desempenho | Abaixo | `AiCultureMotion.tsx`, `AdvisoryMotion.tsx`, `KitPage.tsx` |

## Divergências entre o brief e a tela
- **Item 6 (H1 "três linhas enormes"):** a 1440 a Execução já saía em **duas** linhas, a **72 px**; a Advisory mede 74,9 px (e fica em 3 linhas porque a coluna é mais estreita). Em tamanho de fonte já estavam no mesmo nível. Reduzi para 4.4vw (63,4 px a 1440) para ficar abaixo da Advisory e perto da AI Culture (61 px). Pode ser que a Carol tenha visto antes de o kit de fontes carregar (a reserva Georgia é mais larga e quebra em 3). Se ela quiser ainda menor, é só `font-size` em `kit.module.css`.
- **Item 7:** o brief mandava conferir a AI Culture; lá não há sobreposição, então não mexi.
- **Item 8:** "um quadro com 'Acompanhamos…' apagada sem nada legível ao redor" confere: entre a chegada da camada escura (p≈0,55) e p=0,74 a frase "Não entregamos…" estava em opacidade 0 e a outra em 30%.

## 16. Desempenho (CPU 4x, Chromium/Playwright, build de produção, mediana de 5, desktop 1440)
Método: `Emulation.setCPUThrottlingRate(4)`, LCP por `PerformanceObserver`, TBT = soma de (long task − 50 ms) depois do FCP. Não é o Lighthouse do projeto (`docs/web-vitals.md`): os valores absolutos não batem com os 464/544 ms do brief, o que vale é a comparação entre as linhas.

| Página | Antes (HEAD do item 15) LCP / TBT | Sem o kit de fontes (Typekit bloqueado) | Depois (sem framer) LCP / TBT | Depois, sem fontes |
|---|---|---|---|---|
| AI Culture | 620 / 460 ms | 492 / 178 | **508 / 288** | 492 / 192 |
| Advisory | 596 / 401 | 568 / 217 | 572 / 410 | 600 / 236 |
| Execução | 632 / 310 | 636 / 163 | 624 / 286 | 636 / 157 |

Causas separadas:
- **Kit de fontes:** responde por cerca de 150 a 280 ms de TBT em cada página (com Typekit bloqueado, o TBT cai para 160–220 ms). É a troca de fonte (`data-fonts="ready"`) que refaz o layout do `<main>` inteiro.
- **framer-motion:** só a AI Culture usa o movimento por `useScroll`/`useTransform`; ela pagava ainda o import estático de `AdvisoryMotion` (que importava o framer) por causa do `KitPage`. Tirar o framer da AI Culture derrubou **TBT de 460 para 288 ms (−37%) e LCP de 620 para 508 ms**, na mesma ordem de grandeza do efeito das fontes. Advisory e Execução praticamente não mudaram (esperado: não usavam o `useScroll`), e **nenhuma página paga pelo código de outra**.
- Em vez de `next/dynamic` (que só adiaria o código), eliminei a dependência: `AiCultureMotion` calcula o progresso de rolagem direto do retângulo do elemento (mesmas janelas `start 75%/end 35%` etc.) e escreve opacity/transform/filete no estilo; `AdvisoryMotion` ganhou `bezier()` e `inView()` locais no lugar de `cubicBezier`/`inView` do framer. Nenhum import de `framer-motion` resta em `src/app/solucoes`.
- Conferido depois da troca (AI Culture, 1440, movimento permitido): nomes ChatGPT/Copilot/Gemini perdem o foco em sequência, a assinatura sobe de 0,35 a 1, o filete se traça, o fecho passa de 1 → 0,45 / 0,25 → 1, os blocos de formatos recebem `data-in` ao entrar. Sem erro de console.
- Residual: a AI Culture ainda é a página mais pesada em TBT (288 ms contra 286 da Execução e 410 da Advisory no mesmo teste), principalmente pela troca de fontes. Reduzir isso exigiria isolar o re-layout (por exemplo `content-visibility` nos capítulos), o que mexe nas cortinas e não foi feito.

## Conferências
- **Cabeçalho:** `git diff d10fbb1 --stat` não toca `HomeHeader`, `SidebarMenu`, `menu-font`, `HeaderTone`, `BrandLogo` nem `.header*`/`.nav*`. Em `content.ts` só mudam as 3 strings de `hint` (item 15). Não comparei `getComputedStyle` do cabeçalho antes/depois por script; confio na ausência de diff e olhei o cabeçalho nas capturas.
- **Copy:** DOM de `/sobre-nos` e `/treinamento-corporativo-ia` com o texto das frases tocadas idêntico. O `copy-diff.mjs` **não serve como está**: a baseline (`copy-baseline/`) é antiga e acusa diferença em todas as rotas (incluindo Kognis/Spectra, que não toquei); o blog também difere porque usei artigos falsos. Não rodei uma baseline nova em `d10fbb1`.
- **Rolagem horizontal e console:** 6 rotas × 1440/1024/768/390 sem rolagem horizontal e com 0 erros de console (`/blog` com API falsa).
- **`tsc --noEmit` e `next build`** passam. **`pnpm lint`** falha com 2 erros que já existiam em `d10fbb1` e não são de arquivos que editei nas linhas em questão (`AdvisoryMotion.tsx:231`, `useStage(live, apply.current)`, e `DiagnosticoClient.tsx:73`); confirmei o primeiro rodando o eslint no arquivo de `d10fbb1`.
- **Blog:** testado só com uma API falsa local (porta 8099); não toquei a de produção.

## Não conferi
- Animações por rolagem do CSS (cortina, `surge`, rótulo "nº / total") **antes e depois em sequência de quadros**: só os palcos da Advisory (item 8) e a AI Culture (item 16) foram lidos com rolagem real. Execução (itens 3–7) e Sobre nós foram vistos em quadros parados com movimento reduzido.
- iPhone/iOS simulado, toque, e `prefers-reduced-motion` em cada item: as capturas usam movimento reduzido, mas não testei o caminho iOS (`data-motion="js"`).
- Sem JS: não desliguei o JavaScript. O que mudei em CSS/HTML continua renderizado no servidor; os estados "armados" continuam só depois da hidratação.
- Item 8: não tirei quadros "antes" (a medição de 2380/2110 px é a do brief); os "depois" medem 1530 px cada.
- Item 14 no celular e tablet: confirmei por estilo computado (faixa em linha, sem sticky) e não por imagem lado a lado.
- Spot check do LCP real (Lighthouse do projeto) e de Kognis/Spectra: não rodei; nenhum arquivo deles foi tocado.
- Vídeo (webm) da rolagem: não gravei.
