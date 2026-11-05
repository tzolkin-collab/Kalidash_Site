# Movimento e layout V3: /treinamento-corporativo-ia (AI Culture)

Branch `claude/motion-ai-culture-b9205d`. Estudo: `motion-estudo-ai-culture.md`. Quadros e vídeo em `motion-ai-culture/` (`1440-NN.png`, `390-NN.png`, `rolagem-1440.webm`, quadros a cada 60% da altura da tela, em build de produção).

## O que foi feito
Arquivos: `solucoes/AiCultureMotion.tsx`, `solucoes/ai-culture-motion.module.css`, encaixes em `KitPage.tsx` (`isAc`) e `highlightAccent: "capacidade"` em `pages.ts` (campo novo, nenhuma string mudou). Sem biblioteca nova (`framer-motion` já estava no branch; `LazyMotion` + `m`).

| Seção | O que mudou | Padrão |
|---|---|---|
| Layout V3 | `v3` ligado à página (Kepler/Acumin, Imperial/Limestone). H1 em `clamp(32px, 4.25vw, 65px)` (era 38/5vw/76, cerca de 15% menor) | brief C2 |
| 1. Hero | Foto entra com escala 1,04 para 1 (CSS, sem biblioteca, LCP intacto). Cascata existente mantida | CSS |
| 2. Barra de prova | Sem mudança (`CountUp` e números intactos) | simples de propósito |
| 3. "Ter acesso à IA…" | Título à esquerda, texto em coluna menor à direita, filete e assinatura pequena. "ChatGPT, Copilot, Gemini" atenuam um a um com a rolagem; "capacidade" em itálico dourado com filete traçado (`pathLength`). Sem palco preso | `useScroll`/`useTransform` |
| 4. Método | `StepsPin` reutilizado sem alteração. Frase final em dois tempos: "O treinamento termina." atenua, "A capacidade fica." acende em ouro (lê o `--p` do StepsPin) | CSS sobre `--p` |
| 5. Formatos | Dois blocos largos: In Company em Limestone fundo, Experiências em Imperial com a foto de fundo (opacidade 0,12 e deslocamento leve). Numeração 01/02, filete horizontal e vertical traçados, recursos em stagger com ícone de linha traçado, hover leve (3 px). Sem rótulo novo | `useInView` + transições CSS |
| 7. Fechamento | "O resultado não aparece no certificado." atenua; "Aparece no" forte; "trabalho." em ouro itálico com filete traçado | `useScroll` |
| 6. Foto de turma | **Não feita**: a página já tem foto no hero e no bloco 2; uma terceira seria enfeite | |

## Conferido
- 1440 e 390: sem rolagem horizontal, 0 erros de console (Playwright).
- Sem JS: copy completa visível. Movimento reduzido: 0 elementos escondidos.
- `eslint` nos arquivos tocados limpo; `next build` passa. `tsc --noEmit` só acusa 3 erros que já existiam (`ReactNode` em HomePage, SitePage, ProductPage), nenhum nos meus arquivos.
- LCP (build de produção local, 3 execuções): 156, 156, 140 ms; CLS 0,001. **Não medi o antes** nem TBT: falta rodar o mesmo script no commit de partida.

## O que falta / riscos
- Filete do arco do hero traçado: não feito (a foto fica em `HeroView`, de `ProductPage`, que não pode mudar; um pseudo-elemento seria cortado pelo `overflow`).
- Filete que cresce entre os números da barra de prova: não feito.
- Teste com CPU 4x mais lenta, iOS simulado, 1024 e 768: não feitos. Quadros foram só em 1440 e 390.
- Quadros "antes" não gravados (só o estado novo).
- `copy-diff.mjs` não rodado. A partição da frase do método usa `split` por ponto: se a Carol mudar o texto, revisar `AcSteps`.
- Números "+200" e "+4.000" permanecem não trocados, como pedido.

## Autoavaliação
Formatos e fechamento ficaram profissionais (hierarquia clara, movimento serve à leitura). A atenuação das ferramentas é sutil; o método em dois tempos só aparece no desktop com o pino. O hero ganhou pouco movimento novo: é intencional pelo LCP.
