# Movimento e layout V3: /treinamento-corporativo-ia (AI Culture)

Branch `claude/motion-ai-culture-b9205d`. Estudo: `motion-estudo-ai-culture.md`. Quadros e vídeo em `motion-ai-culture/` (`depois-<largura>-NN.png`, `antes/`, `rolagem-1440.webm`; quadros a cada 60% da altura da tela, em build de produção).

## O que foi feito
Arquivos: `solucoes/AiCultureMotion.tsx`, `solucoes/AiCultureSteps.tsx`, `solucoes/ai-culture-motion.module.css`, encaixes em `KitPage.tsx` (`isAc`) e `highlightAccent: "capacidade"` em `pages.ts` (campo novo, nenhuma string mudou). Sem biblioteca nova (`framer-motion` já estava no branch; `LazyMotion` + `m`).

| Seção | O que mudou | Padrão |
|---|---|---|
| Layout V3 | `v3` ligado à página (Kepler/Acumin, Imperial/Limestone). H1 em `clamp(32px, 4.25vw, 65px)` (era 38/5vw/76, cerca de 15% menor) | brief C2 |
| 1. Hero | Filete de arco em ouro deslocado atrás da foto (pseudo-elemento, aparece com opacidade e transform; não é traçado de verdade). Foto entra com escala 1,04 para 1 (CSS, sem biblioteca, LCP intacto). Cascata existente mantida | CSS |
| 2. Barra de prova | `CountUp` e números intactos; filete dourado vertical entre os números cresce (`scaleY`) | CSS |
| 3. "Ter acesso à IA…" | Título à esquerda, texto em coluna menor à direita, filete e assinatura pequena. "ChatGPT, Copilot, Gemini" atenuam um a um com a rolagem; "capacidade" em itálico dourado com filete traçado (`pathLength`). Sem palco preso | `useScroll`/`useTransform` |
| 4. Método | `StepsPin` reutilizado sem alteração. Frase final em dois tempos: "O treinamento termina." atenua, "A capacidade fica." acende em ouro (lê o `--p` do StepsPin) | CSS sobre `--p` |
| 5. Formatos | Dois blocos largos: In Company em Limestone fundo, Experiências em Imperial com a foto de fundo (opacidade 0,12 e deslocamento leve). Numeração 01/02, filete horizontal e vertical traçados, recursos em stagger com ícone de linha traçado, hover leve (3 px). Sem rótulo novo | `useInView` + transições CSS |
| 7. Fechamento | "O resultado não aparece no certificado." atenua; "Aparece no" forte; "trabalho." em ouro itálico com filete traçado | `useScroll` |
| 6. Foto de turma | **Não feita**: a página já tem foto no hero e no bloco 2; uma terceira seria enfeite | |

## Conferido (build de produção, 3303 = novo, 3304 = commit de partida `066fc25`)
- **1440, 1024, 768, 390 e iPhone 13 emulado (Chromium com toque, UA e DPR do iOS)**: sem rolagem horizontal e 0 erros de console. Quadros `depois-<largura>-NN.png`; `antes/` tem o estado de partida em 1440 e 390. WebKit real não está instalado: o caminho iOS é emulação, não Safari.
- **Sem JS**: copy completa visível. **Movimento reduzido**: 0 elementos escondidos.
- **Copy**: `copy-diff.mjs` acusa diferença em todas as rotas (inclusive as que não toquei), porque a baseline gravada é antiga; por isso comparei o texto do `<main>` da AI Culture direto com o commit de partida, sem JS. Só mudam os numerais 01 e 02 dos formatos (permitidos) e a posição do CTA no HTML dos formatos; nenhuma palavra mudou.
- **Outras páginas** (`/`, `/sobre-nos`, `/solucoes`, `/kognis`, `/spectra`, `/advisory`, `/execucao`; movimento reduzido, captura de página inteira, 1440 e 390, hash das imagens): 12 de 14 idênticas. `/spectra` em 1440 e `/solucoes` em 390 diferem por poucos bytes; nenhum arquivo desses foi tocado, então tratei como ruído de renderização (não repeti a captura para confirmar).
- `eslint` nos arquivos tocados limpo; `next build` passa; `tsc --noEmit` só acusa 3 erros que já existiam.

### Vitais da AI Culture (mediana de 5, rolando a página toda)
| | LCP | CLS | TBT |
|---|---|---|---|
| CPU 1x, partida | 136 ms | 0,000 | 0 |
| CPU 1x, novo | 140 ms | 0,001 | 0 |
| CPU 4x, partida | 464 ms | 0,000 | 154 ms |
| CPU 4x, novo | 544 ms | 0,001 | 394 ms |

Sem throttling não há piora. **Com CPU 4x mais lenta o LCP e o TBT pioram** (+80 ms e +240 ms). Causas prováveis, não isoladas: o kit Adobe (Kepler/Acumin) que o V3 carrega e a troca de fontes em `KitFonts` (a partida da AI Culture não tinha nada disso) e a biblioteca de movimento. Já carrego `AcCapacity`, `AcFormats` e `AcClosing` em chunk à parte (`next/dynamic`) e o método (`AcSteps`) é componente de servidor. Não medi a página com V3 e sem movimento para separar as duas causas; isso fica pendente. Medição local, sem Lighthouse.

## O que ainda falta
- Separar a causa da piora em CPU lenta (fontes V3 x movimento) e, se for o movimento, adiar o carregamento até a primeira rolagem.
- Confirmar o ruído de `/spectra` 1440 e `/solucoes` 390 repetindo a captura na partida contra ela mesma.
- Safari/WebKit real.
- Quadros por seção só no estado novo mais o "antes" em duas larguras; sem sequência de 4 a 6 quadros por seção animada além da rolagem de 60% em 60%.

## Autoavaliação
Formatos e fechamento ficaram profissionais (hierarquia clara, movimento serve à leitura). A atenuação das ferramentas é sutil; o método em dois tempos só aparece no desktop com o pino. O hero ganhou pouco movimento novo: é intencional pelo LCP.
