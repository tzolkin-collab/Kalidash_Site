# Estudo do tzolkin.cloud para o movimento da /advisory

Fonte: código em `src/client/shared/ui/` do repositório Tzolkin_Site (só leitura). Não abri o site rodando; a leitura foi só do código. Cor, copy e preço ficaram de fora.

## 1. Seções do tzolkin.cloud

| Seção | Tipo | Layout | Gatilho | O que se move | Técnica | Arquivo |
|---|---|---|---|---|---|---|
| Aplicações + Como construímos | Palco preso, duas camadas | Altura de 660svh com `sticky` de 100lvh. Laje de faixas fixa. Conteúdo à esquerda, demo na laje à direita | `useScroll` no palco inteiro (`start start` a `end end`) | Acordeão com 5 itens. No fim, o conteúdo sobe 14vh e some e o próximo sobe de baixo. A barra de progresso enche | `useTransform` com `SETTLE`. `useMotionValueEvent` troca o índice ativo. `inert` e `aria-hidden` na camada escondida | `ApplicationsMethodStory.tsx:29-108` |
| Índice de aplicações | Acordeão guiado pela rolagem e clicável | Lista e detalhe na mesma célula de grid, sem salto | Índice vem da rolagem. Clique faz `scrollTo` na posição do item | Detalhe desliza por `translateY`. Linhas abaixo do item aberto descem por transform | `ResizeObserver` mede a altura. `goTo(i)` rola até `range * F1 * (i+0.5)/COUNT` | `ServicesSection.tsx:136-217` |
| Como construímos | Três etapas, painel que muda | Textos e folhas empilhados na mesma célula (`col-start-1 row-start-1`) | Etapa vem da rolagem do palco | Opacidade da folha ativa, filete de progresso (`scaleX`) | Sem altura animada, então sem layout shift | `MethodTOISection.tsx:97-170` |
| Hero no celular | Peça que sobe | Camada absoluta dentro do hero fixo | `useScroll` da seção | Aparelho sobe com escala, rotação e motion blur. Linhas bézier são traçadas. Texto recua | `pathLength` em `motion.path`. `useVelocity` e `useSpring` para o blur | `hero/HeroPhoneRise.tsx:297-387` |
| Fundo do hero | Marca que reage | Faixas com máscara de alpha | Estático no hero. No palco, a opacidade segue a troca | Só a opacidade entre as camadas | Máscara em CSS | `hero/HeroBackground.tsx` |
| Workbench de produto | Demo viva | Mini aplicação | Etapa controlada de fora ou por timer | Cartões e itens trocam de lugar | `layoutId`, `useReducedMotion` (duração zero) | `product/ProductWorkbench.tsx:25-` |
| Final CTA e Founder | Simples de propósito | Bloco com título, texto e botão | Nenhum | Nada, só o fundo | Sem JS | `FinalCta.tsx`, `SectionHeader.tsx` |

## 2. Princípios extraídos

1. O movimento explica a mensagem da seção. O que não explica não entra.
2. Tudo segue a rolagem. Nada se move sozinho, só detalhes pequenos e lentos.
3. Um progresso 0 a 1 por palco. O conteúdo troca por faixas desse progresso, com `SETTLE` nas trocas.
4. A página não desce durante a troca. O conteúdo sai e entra por `translateY` e `opacity` dentro do palco.
5. Camadas empilhadas na mesma célula. A altura não muda, então não há salto de layout.
6. A camada escondida fica `inert` e `aria-hidden`.
7. A lista guiada pela rolagem também é clicável, e o clique rola até aquele ponto.
8. Seções sem demonstração (Founder, CTA) não animam.

## 3. Padrão por seção da /advisory

| Seção | Padrão | Por quê |
|---|---|---|
| 1. Hero | Entrada em CSS. Filete em arco traçado com `pathLength`. Foto escala de 1,04 para 1 | O LCP não pode depender de biblioteca. A foto nunca nasce invisível |
| 2. "E agora?" | Palco preso, duas camadas (`ApplicationsMethodStory`). Progresso 0 a 1 vira variáveis CSS (`--p`, `--s`), como `StepsPin` e `BuildStory` | A troca Limestone para Imperial é o coração da mensagem. O cabeçalho acompanha por `data-tone` na camada |
| 3. Liderança | Índice guiado pela rolagem (`ServicesSection`). Pentágono e ícones por `pathLength` | O diagrama precisa ligar cada frente à liderança. Hover, clique e teclado ativam o mesmo estado |
| 4. Rituais | Sem palco. Stagger por `inView`. Ícones vivos só com o cartão visível | Cada ícone mostra o ritmo do ritual |
| 5. Três passos | `StepsPin` adaptado a 3 passos | Reuso do componente |
| 6. Critérios | Stagger simples | Leitura rápida |
| 7. FAQ | `grid-template-rows` 0fr para 1fr em `<details>` | Só a abertura se move |
| 8. Fechamento | Nuvens com deslocamento na rolagem. Frase por linhas | Repete a promessa |

## 4. Pontos de atenção no código atual
- `ScrollMotion` exclui do surge os capítulos que contêm `[class*="story"]`, `[class*="pin"]` ou `[data-live]`. Os palcos novos devem usar um nome de classe com "story" e não usar "pin" em classes do módulo.
- O rótulo "nº / total" tem fundo vindo de `--lbl-bg` do capítulo. Na troca para Imperial dentro do capítulo 2 ele precisa mudar. Dá para fazer com `[data-motion="curtain"]:has([data-phase="dark"])` no CSS do módulo, sem tocar no `kit.module.css`.
- `HeaderTone` observa `[data-tone]` com uma faixa de 8% no topo. Marcar a camada Imperial com `data-tone="dark"` faz o cabeçalho trocar quando ela chega ao topo.
- O capítulo 4 usa o surge no `li`. O stagger dos cartões precisa desligar o surge só nos cartões, com um override no módulo da página.

## 5. Estado da entrega
Este estudo é a única entrega até aqui. Nenhum código de movimento foi escrito. Ver o relatório da sessão.
