# Execução: layout V3 e movimento

Branch `claude/motion-execucao-05cab8`. Estudo: `motion-estudo-execucao.md` (complementa o da Advisory). Quadros e vídeo em `motion-execucao/`.
O vídeo `rolagem-1440.webm` (17 MB, 1440x900, rolagem inteira, Playwright) está na pasta mas **não foi commitado** (peso); copie dali.

## O que foi feito, por seção
| Seção | Padrão | Resultado |
|---|---|---|
| Layout V3 | `v3` inclui `execucao`; `advisoryV3` mantém o que é só da Advisory | Kepler/Acumin, Limestone, linha fina atrás do arco (`::before`), "entra" em ouro (`highlightAccent`) |
| 1. Hero | CSS | Foto assenta 1,04 para 1; linha sai de trás do arco depois da entrada. **Não é `pathLength`**: é `::before` com opacity/translate (só CSS, sem JS no LCP). A foto não nasce invisível |
| 2. Saber o que mudar | Rolagem (`--g`), sem palco | Os 3 gargalos acendem em sequência com sublinhado ouro; filete e frase final entram por último. Texto só repartido em spans |
| 3. O que construímos | `BuildStory` mantido + telas vivas | Cada tela é função do progresso do item ativo (`--s`): triagem com fila e revisão humana; etapas riscadas e relatório que se monta; pulso ERP para CRM e registros; números que contam (+100, 170, 12 horas, vindos da copy), barras e linha traçada; onda de áudio, linhas de texto e campos (Problema, Solução, Criticidade, Prazo). Troca: a anterior sai para cima, a nova sobe (`SETTLE`). Celular/tela baixa: tela dentro de cada item, toca uma vez ao entrar na vista; movimento reduzido mostra o estado final |
| 4. Como entregamos | `StepsPin` | Instantes dos passos calculados pelo número de `li` (3 ou 4); número em ouro, filete por passo, frase final entra depois da linha. API intacta |
| 5. Projetos rodando | `Fx` (IntersectionObserver) | `CountUp` intacto; filete sobre os números; máscara que abre na foto; 1.681 e 97% em ouro com sublinhado (sem contar: o `CountUp` não lê "1.681"); lista em stagger e seta que desliza. Campo `hideItems` em `pages.ts` oculta Kognis/Spectra (a lista continua visível, aguardando a Carol) |
| 6. Fechamento | CSS + `Fx` | Frase por linhas, "começar." por último em ouro; `arcos-sepia` (`public/marca/arcos-sepia.webp`, 121 KB, 32% de opacidade) com deslocamento por `animation-timeline: view()` |

## Números e verificações (build de produção local)
- Sem rolagem horizontal em 1440, 1024, 768 e 390; zero erro de console.
- Sem JS e com movimento reduzido: nenhum texto com opacidade 0.
- LCP 136 a 352 ms (mediana 152 ms, sem throttling). **CLS 0,043** (/advisory: 0,002): o deslocamento é do hero, na troca da fonte reserva pela Kepler (H1, foto, lead), vem do layout V3 e não da animação; abaixo de 0,1. Sem medida do commit de partida nem TBT, e sem teste com CPU 4x.
- `tsc --noEmit` e `next build` passam. `eslint`: 1 erro anterior em `diagnostico/DiagnosticoClient.tsx` (não tocado).
- Copy: `pages.ts` só ganhou `highlightAccent: "entra"` e o tipo `hideItems`. O `copy-diff.mjs` acusa tudo (a baseline é antiga, todas as rotas divergem), então não serviu de aceite; os textos novos estão só dentro das telas ilustrativas (aria-hidden): "Solicitações recebidas", "Reunião diária", "Registro estruturado" e os campos pedidos no brief. Removi "12 abertas · 9 resolvidas hoje" e "1.240/2,1%/96%" (inventados).

## Não feito / riscos
- `StepsPin` com 3 passos só validado pela lógica (a Advisory não o usa hoje neste branch); testado com 4.
- Comparação de pixels das outras páginas, iOS simulado, CPU 4x, TBT e antes/depois lado a lado com a referência não foram feitos.
- Quadros: `mocks-*` (desktop, uma por frente e transições), `m390-mocks-*` (celular), `pin-*`, `sec-*`, `fim-0`. Não há quadros "antes".
- Cabeçalho não foi tocado; não medi `getComputedStyle`.

## Autoavaliação
As telas de "O que construímos" são a parte que mais acrescenta: explicam cada frente. A linha atrás do arco no hero e o deslocamento dos arcos no fecho são enfeite leve. Os destaques da seção 2 e 5 são sutis; julguem em movimento.

## Commits
`4ea1cf7` estudo, `a631cc7` layout V3, `314dd3b` telas, StepsPin, `0add9ec` seções 1, 2, 5 e fecho (hash do StepsPin: ver `git log`).
