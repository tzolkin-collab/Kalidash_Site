# Animação: `/advisory`

> Leia antes `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/motion-comum.md`. Faça o estudo da referência primeiro.
> Arquivos seus: `solucoes/AdvisoryMotion.tsx`, `solucoes/advisory-motion.module.css`, `solucoes/AdvisoryViews.tsx`, `solucoes/advisory-v3.module.css`, encaixe em `KitPage.tsx`, bloco `advisory` em `pages.ts`, `public/advisory/`.
> Copy conferida com o doc da Carol: não mude nenhuma palavra.

**Mensagem da página:** o plano não basta; a Kalidash fica ao lado da liderança até virar resultado. **O movimento precisa contar isso: o plano se desfaz com o tempo, e alguém o acompanha.**

**Palcos presos nesta página:** 2 (seção 2 e seção 3). O resto é simples.

## Seção por seção

### 1. Hero
- **Conteúdo:** eyebrow, H1 "Sua estratégia de IA, acompanhada até virar resultado.", apoio, CTA, foto do Drive no arco.
- **Estratégia:** promessa em uma frase; a foto prova presença real em sala.
- **Animação:**
  - mantenha a cascata de entrada e o `--drift` atuais;
  - filete ouro fino traçado (`pathLength`) contornando o arco, deslocado da foto, ao terminar a entrada;
  - foto com escala de 1,04 para 1 no carregamento e deslocamento leve na rolagem.
- **Assets:** `public/advisory/comite-fdc.webp`; SVG do arco inline.
- **Limite:** a foto é candidata a LCP, então nunca começa invisível.
- **Celular:** igual, sem deslocamento.

### 2. "A estratégia foi definida. E agora?"
- **Conteúdo:** título, dois parágrafos, 4 eventos na linha do tempo, "Não entregamos um plano. Acompanhamos o que acontece depois dele.", régua 01–04.
- **Estratégia:** é o coração da página. Mostra o plano sendo atropelado e a virada.
- **Animação (palco preso, padrão `ApplicationsMethodStory`, cerca de 260 svh):**
  - **Fase 1, em Limestone:** a linha é traçada pela rolagem; cada ponto acende e seu evento sobe, um por vez. O ponto do início é Imperial; os seguintes, terracota.
  - **Fase 2, a troca:** o conteúdo claro sobe e some, a laje Imperial sobe de baixo. A página não desce.
  - **Fase 3, em Imperial:** "Não entregamos um plano." entra forte e atenua; "Acompanhamos o que acontece" acende; "depois dele." aparece em ouro por último. O símbolo (círculo e triângulo) é traçado. A régua 01–04 acende em sequência com filete de progresso.
- **Assets:** SVG inline do símbolo e da linha.
- **Sem palco (celular ou movimento reduzido):** tudo empilhado, linha traçada e eventos em stagger ao entrar na tela.
- **Atenção:** o cabeçalho deve acompanhar a troca de fundo. Se precisar, marque cada fase com `data-tone`, sem editar `HeaderTone`. Hoje este capítulo tem as duas cores e o rótulo fica Limestone sobre Imperial: resolva isso aqui.

### 3. "Ajudamos sua liderança a decidir melhor sobre IA."
- **Conteúdo:** título, apoio, pentágono, lista I a V com ícones.
- **Estratégia:** mostra cinco frentes ligadas ao centro, a liderança. O diagrama precisa significar algo.
- **Animação (palco preso curto, cerca de 200 svh, padrão `ServicesSection`):**
  - o círculo e o pentágono são traçados na entrada;
  - a rolagem ativa os itens I a V; a linha ativa fica forte, o ícone é traçado, e no pentágono o vértice correspondente acende, com um pulso do centro até ele;
  - no último item, o polígono inteiro fica em ouro;
  - clicar ou passar o mouse em um item ativa o mesmo estado, com acesso por teclado.
- **Assets:** pentágono e ícones em SVG inline, traçáveis. Troque por `@phosphor-icons/react` só se o traçado continuar possível.
- **Celular:** sem palco; pentágono acima, itens em stagger.

### 4. "Três rituais que mantêm a IA na agenda da diretoria."
- **Conteúdo:** 3 cartões Aubergine, frases finais em ouro, faixa "O que a liderança recebe".
- **Estratégia:** os três rituais são coisas concretas e recorrentes. Cada ícone demonstra o ritmo do ritual.
- **Animação (sem palco):**
  - cartões sobem em stagger de 80 a 100 ms; filete do pé é traçado da esquerda; a frase em ouro entra depois;
  - **ícones vivos, só com o cartão visível:** Comitê, pontos orbitando o círculo em ritmo lento; Acompanhamento, a linha de tendência é traçada e o último ponto pulsa; Mentoria, os dois círculos se aproximam e se cruzam;
  - hover do cartão: sobe 4 px e o filete fica ouro;
  - faixa Limestone sobe por último; os ícones são traçados em sequência.
- **Limite:** mantenha `animated: true`, o surge e a cortina deste capítulo, que é o mais alto.
- **Celular:** cartões empilhados, um reveal por vez.

### 5. "Três passos para começar."
- **Conteúdo:** Diagnóstico, Desenho, Acompanhamento, CTA.
- **Estratégia:** baixar o risco: começar é simples.
- **Animação:** reutilize `StepsPin` como em Execução, adaptado a 3 passos: linha esticando e passos acendendo.
- **Atenção:** seção anterior também é Imperial. Crie separação visual (filete ou Aubergine), sem mudar a ordem.
- **Celular:** o comportamento atual de `StepsPin`.

### 6. "O Advisory faz sentido quando…"
- **Conteúdo:** 5 critérios e link para AI Culture.
- **Estratégia:** autoidentificação; leitura rápida.
- **Animação:** simples. Cada linha entra em stagger, o check é traçado e o filete cresce da esquerda. Sem palco.

### 7. "Perguntas frequentes"
- **Conteúdo:** 6 perguntas.
- **Estratégia:** tirar objeções sem distração.
- **Animação:** só a abertura: altura com `grid-template-rows` (0fr para 1fr), texto com `opacity`, `+` gira para `×`. Mantenha `<details>`, teclado e o JSON-LD `FAQPage`. Abertura instantânea com movimento reduzido.

### 8. Fechamento: "Ao lado da liderança. Dentro da execução."
- **Conteúdo:** frase, "execução." em ouro, CTA.
- **Estratégia:** repete a promessa e pede a conversa.
- **Animação:**
  - nuvens (`/marca/nuvens-douradas.jpg`) com deslocamento vertical leve ligado à rolagem;
  - a frase entra por linhas, a palavra em ouro por último;
  - seta do CTA desliza no hover.

## Prioridade se faltar tempo
2, 3, 4, 1, 8, 5, 6, 7. Faça 2 e 3 muito bem antes de seguir.
