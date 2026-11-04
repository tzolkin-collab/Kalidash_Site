# Layout V3 e animação: `/treinamento-corporativo-ia` (AI Culture)

> Leia antes `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/motion-comum.md`. Faça o estudo da referência primeiro.
> Arquivos seus: `solucoes/AiCultureMotion.tsx`, `solucoes/ai-culture-motion.module.css`, encaixe em `KitPage.tsx`, bloco `aiCulture` em `pages.ts`, `public/ai-culture/`.
> Copy conferida com o doc da Carol: não mude nenhuma palavra.

**Mensagem da página:** não é sobre a ferramenta; é sobre o time aprender a usá-la no trabalho e continuar depois. **O movimento precisa mostrar capacidade crescendo e ficando na empresa.** Esta é a página mais humana: fotos de gente real têm protagonismo.

## Primeiro: ligar o layout V3 nesta página

Faça antes da animação, em commits próprios. A intenção está em `docs/po/briefs/v3-b-internas.md`, itens C2, C3 e C4; referências em `D:/Códigos/Tzolkin/Projetos/carol/kalidash/_assets-carol/v3/`.
1. Inclua `treinamento-corporativo-ia` na condição `v3` do `KitPage` (comentário "Ajustes V3" em `kit.module.css`).
2. **C2** (`doc-11.png`, `doc-12.png`): H1 cerca de 15% menor; "Ter acesso à IA…" à esquerda e texto em coluna menor à direita; "Nosso objetivo…" bem menor, como assinatura; só "capacidade" em destaque.
3. **C3:** "O treinamento termina. A capacidade fica." sem quebra no meio.
4. **C4** (`doc-14.png` e `doc-15.png`): dois blocos largos em linhas horizontais, com hierarquia clara, In Company em Limestone fundo, Experiências em Imperial/Aubergine. Sem o rótulo novo; o texto é o de `pages.ts`.
5. **Não troque os números da barra de prova.** "+200" e "+4.000" esperam a confirmação da Carol, porque contradizem "+10 mil" no resto do site. NPS, logos e depoimentos continuam desligados por `confirmed: false`.

## Seção por seção

### 1. Hero
- **Conteúdo:** eyebrow, "Não basta aprender IA. Seu time precisa saber o que fazer com ela.", apoio, linha de apoio, CTA, foto `/home/evento-sala.jpg`.
- **Estratégia:** contraste entre ter e saber usar; a foto real de turma prova que é prática.
- **Animação:** mantenha a cascata; filete do arco traçado; foto com escala leve de 1,04 para 1 e deslocamento na rolagem.
- **Limite:** a foto é candidata a LCP e não nasce invisível.

### 2. Barra de prova
- **Conteúdo:** "+10 mil pessoas capacitadas", "170 operações atendidas".
- **Estratégia:** autoridade logo depois da promessa.
- **Animação:** `CountUp` intacto; filete cresce entre os números; barra sem cortina, como já é. Simples.

### 3. "Ter acesso à IA não é saber trabalhar com ela."
- **Conteúdo:** título, texto (ChatGPT, Copilot, Gemini), "Nosso objetivo é criar capacidade dentro da empresa, não ensinar mais uma ferramenta."
- **Estratégia:** nomeia o gargalo real. A palavra "capacidade" é a tese da página.
- **Animação (palco preso curto opcional, cerca de 160 svh; se não acrescentar, sem palco):**
  - os nomes "ChatGPT, Copilot ou Gemini" atenuam com a rolagem, como ferramentas que perdem o foco;
  - a frase de assinatura entra e "capacidade" é a última, em destaque, com um filete traçado sob ela.
- **Celular:** sem palco, reveal ao entrar.

### 4. "Começamos pelo trabalho, não pela ferramenta."
- **Conteúdo:** Contexto, Capacitação, Aplicação, Cultura; "O treinamento termina. A capacidade fica."; "O próprio time continua evoluindo, sem depender de consultoria."
- **Estratégia:** método em quatro passos; o fim é autonomia.
- **Animação:**
  - reutilize `StepsPin` como está (só a sessão de Execução pode alterá-lo);
  - depois da linha terminar: "O treinamento termina." entra e atenua, "A capacidade fica." acende em ouro e permanece.
- **Celular:** o comportamento atual de `StepsPin`.

### 5. "Dois formatos, conforme o seu objetivo."
- **Conteúdo:** In Company e Experiências, com recursos, apoio e CTA.
- **Estratégia:** ajudar a escolher e facilitar a defesa do orçamento interno.
- **Animação:**
  - os dois blocos sobem um depois do outro, com o filete do cabeçalho de cada um crescendo; o vertical é traçado;
  - recursos entram em stagger, com ícone de linha traçado;
  - In Company tem CTA primário; hover dos blocos leve, sem competir com o botão.
- **Fundo:** `background` em `pages.ts` é uma foto; se usar, deslocamento leve e contraste AA.
- **Celular:** blocos empilhados, recursos legíveis.

### 6. Foto de turma (opcional, só se ajudar)
Se a página continuar pobre em imagem depois de 1 a 5, use uma foto real de turma de `public/home/` (`g01` a `g21`, ver `docs/po/relatorios/imagens-carol.md`) como faixa com deslocamento de rolagem, sem legenda nova. Justifique no relatório. Nada de foto de banco.

### 7. Fechamento: "O resultado não aparece no certificado. Aparece no trabalho."
- **Animação:** "O resultado não aparece no certificado." atenuado, "Aparece no trabalho." forte, com "trabalho." em ouro por último. Fundo Imperial; se usar asset, deslocamento leve. Seta do CTA desliza no hover.

## Prioridade se faltar tempo
Layout V3, 5, 4, 3, 7, 1, 2.
