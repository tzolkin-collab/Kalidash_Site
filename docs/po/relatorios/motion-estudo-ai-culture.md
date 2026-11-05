# Estudo do tzolkin.cloud para o movimento da AI Culture

Base: o estudo completo está em `motion-estudo-advisory.md` (branch `claude/motion-advisory-598034`, commit `6dac407`): tabela de seções, técnicas e arquivos de `ApplicationsMethodStory`, `ServicesSection`, `MethodTOISection`, `HeroPhoneRise`, `ProductWorkbench`, `FounderSection`/`FinalCta`. Não repito a tabela. Abaixo, só o que muda para AI Culture. Leitura feita sobre o código; ignorei cor, copy e preço.

## Princípios que valem aqui
1. O movimento explica a mensagem: aqui, capacidade que cresce e fica.
2. Tudo segue a rolagem; nada se move sozinho. Curva `cubic-bezier(0.33, 1, 0.68, 1)` (SETTLE).
3. Um palco preso por página, no máximo dois. Aqui o único palco é o `StepsPin` existente, reutilizado sem mudança.
4. Camadas na mesma célula de grid: altura constante, sem salto de layout.
5. Seções simples ficam simples (Founder/FinalCta do tzolkin.cloud: texto, sem palco).
6. Só `transform` e `opacity`; SVG com `pathLength`.
7. Foto real é protagonista: só escala leve e deslocamento, nunca escondida.

## Padrão por seção da AI Culture
| Seção | Padrão | Por quê |
|---|---|---|
| 1. Hero | Cascata CSS já existente; foto escala 1,04 → 1 na entrada; sem biblioteca | LCP: a foto é candidata a LCP e não nasce invisível |
| 2. Barra de prova | `CountUp` intacto; filete que cresce (CSS) | Autoridade simples, como Founder |
| 3. "Ter acesso à IA…" | Sem palco (decisão): progresso de rolagem por seção (`useScroll`, `useTransform`) apaga os nomes das ferramentas; filete sob "capacidade" traçado ao entrar | Um palco extra pesaria mais que a mensagem; é o mesmo princípio da ServicesSection (estado vem da rolagem) sem prender a tela |
| 4. Método | `StepsPin` como está; depois, "O treinamento termina." atenua e "A capacidade fica." acende em ouro (reveal por rolagem) | Reuso do palco; o fim é autonomia |
| 5. Formatos | Dois blocos sobem em sequência (`useInView`), filete do cabeçalho e vertical traçados (`scaleX/scaleY`), ícones por `pathLength`, recursos em stagger | Padrão MethodPanels: conteúdo específico, não genérico |
| 6. Foto de turma | Não será usada se a página já tem foto no hero e fundo nos formatos | Evitar enfeite |
| 7. Fechamento | Frase em duas peças: primeira atenuada, segunda forte; "trabalho." em ouro por último | Repete a promessa |

Celular / sem JS / movimento reduzido: tudo visível e empilhado; reveal só com `useInView` quando JS e movimento permitem.
