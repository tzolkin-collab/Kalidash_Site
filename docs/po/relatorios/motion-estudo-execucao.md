# Estudo do tzolkin.cloud para o movimento da /execucao

Complementa `motion-estudo-advisory.md` (tabela completa das seções do tzolkin.cloud, princípios e pontos de atenção do `ScrollMotion`); aqui só o que muda para Execução. Fonte: leitura do código em `src/client/shared/ui/` (Tzolkin_Site), só leitura.

## 1. O que importa para Execução

| Peça do tzolkin.cloud | Tipo | Gatilho | O que se move | Técnica | Arquivo |
|---|---|---|---|---|---|
| `ApplicationsMethodStory` | Palco preso | `useScroll` do palco, 0 a 1 | Item ativo do acordeão, demo troca (sobe/desce), barra de progresso | `useTransform` + `SETTLE`, `inert`/`aria-hidden` | `ApplicationsMethodStory.tsx:29-108` |
| `ServicesSection` | Índice clicável guiado pela rolagem | Rolagem e clique (`scrollTo`) | Detalhe do item por `translateY`; linhas abaixo descem | Mesma célula de grid, `ResizeObserver` | `ServicesSection.tsx:136-217` |
| `MethodTOISection` | 3 etapas, painel que muda | Progresso do palco | Opacidade da folha ativa e filete (`scaleX`) | Tudo empilhado na mesma célula, sem salto | `MethodTOISection.tsx:97-170` |
| `ProductWorkbench` | Demo viva | Etapa ativa vinda de fora | Cartões mudam de lugar; estados mudam | `layoutId`, `useReducedMotion` | `product/ProductWorkbench.tsx` |
| `Founder`/`FinalCta` | Simples | nenhum | nada | sem JS | `FounderSection.tsx`, `FinalCta.tsx` |

Comparação com a nossa "O que construímos" (`BuildStory`): o palco, o acordeão clicável e a troca de tela já seguem o padrão. A diferença está dentro das telas: as nossas são quase estáticas (só um fade de cena), enquanto a demo do tzolkin.cloud muda de estado com o progresso. É aí que está o trabalho.

## 2. Princípios (para esta página)
1. O movimento prova que a coisa funciona: cada tela mostra o fluxo da frente ativa.
2. O estado da tela vem do progresso do item ativo (`--s`, 0 a 1), não de timers soltos.
3. Troca de item: a tela sai para cima e a nova sobe, `SETTLE` (0,33, 1, 0,68, 1).
4. Camadas na mesma célula: sem salto de layout; escondida fica `aria-hidden`.
5. Só `transform`/`opacity` (e `pathLength` em SVG). Sem JS, reduzido e celular: tudo visível e completo.
6. Um palco por seção; as demais seções são simples (stagger, traçado de filete).

## 3. Padrão por seção
| Seção | Padrão | Por quê |
|---|---|---|
| Hero | Entrada CSS existente; filete em arco traçado (`pathLength`); foto 1,04 para 1 | LCP não depende de biblioteca |
| Saber o que mudar | Destaque sucessivo ligado à rolagem, sem palco | Seção de leitura |
| O que construímos | `BuildStory` + telas vivas (estado por item ativo) | Peça principal |
| Do problema à solução | `StepsPin` com 3 ou 4 passos; número e filete | Reuso (Advisory usa 3) |
| Projetos rodando | Stagger, máscara na foto, filete entre números | Prova |
| Fechamento | Frase por linhas, deslocamento leve de fundo | Simples |
