# Layout V3 e animação: `/execucao`

> Leia antes `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/motion-comum.md`. Faça o estudo da referência primeiro.
> Arquivos seus: `solucoes/ExecucaoMotion.tsx`, `solucoes/execucao-motion.module.css`, `solucoes/BuildStory.tsx`, `solucoes/BuildMocks.tsx`, `solucoes/build-story.module.css`, `solucoes/StepsPin.tsx`, `solucoes/steps-pin.module.css`, encaixe em `KitPage.tsx`, bloco `execucao` em `pages.ts`.
> Copy conferida com o doc da Carol: não mude nenhuma palavra.

**Mensagem da página:** saber o que mudar não basta; a Kalidash constrói e entrega. **O movimento precisa mostrar coisa funcionando.** Esta é a página mais "técnica": menos clássico, mais sistema rodando, sempre em linguagem da marca.

## Primeiro: ligar o layout V3 nesta página

A página ainda está no visual anterior. Faça antes da animação, em um commit próprio:
1. Inclua `execucao` na condição `v3` do `KitPage` (Kepler, Acumin, Limestone, destaque por sentido). Confira as regras em `kit.module.css`, comentário "Ajustes V3".
2. **E1:** linha fina deslocada atrás da foto em arco (`_assets-carol/v3/doc-26.png`; caminho absoluto: `D:/Códigos/Tzolkin/Projetos/carol/kalidash/_assets-carol/v3/`).
3. **E3:** "Saber o que mudar…" e "É aí que a Kalidash entra." com "entra" em destaque (`doc-27.png`).
4. **Não retire a lista Kognis/Spectra.** Isso espera a confirmação da Carol. Deixe um campo em `pages.ts` para ocultar, sem apagar o texto.
5. Veja também o trecho de Execução em `docs/po/briefs/v3-b-internas.md`, que tem a intenção dela.

## Seção por seção

### 1. Hero
- **Conteúdo:** eyebrow, "Da ideia à solução de IA rodando na sua operação.", apoio, "Escopo, prazo e métricas definidos antes de começar.", CTA, foto `/home/front-3-entrega.jpg`.
- **Estratégia:** entrega real, com prova logo na abertura.
- **Animação:** a linha atrás do arco é traçada (`pathLength`) ao terminar a entrada; foto com escala leve de 1,04 para 1 e deslocamento na rolagem. Mantenha a cascata.
- **Limite:** a foto é candidata a LCP e não nasce invisível.

### 2. "Saber o que mudar não é o mesmo que conseguir implementar."
- **Conteúdo:** título, parágrafo, "É aí que a Kalidash entra."
- **Estratégia:** nomeia a dor e faz a virada.
- **Animação:** simples. Os três gargalos do parágrafo ("Processos manuais, tarefas repetitivas, sistemas que não conversam") ganham destaque sucessivo ligado à rolagem, sem mudar o texto. A frase final entra por último, com "entra" em ouro e um filete traçado. Sem palco.

### 3. "O que construímos": a peça principal
- **Conteúdo:** as 5 frentes com texto e exemplo, já em `BuildStory`.
- **Estratégia:** é o momento de provar capacidade: cada frente mostra um sistema funcionando, com o exemplo da copy.
- **Hoje:** o palco e o acordeão funcionam, mas as telas são quase estáticas. A referência direta é `product/ProductWorkbench.tsx`.
- **Animação:** mantenha `BuildStory` e melhore as telas de `BuildMocks`, ligando o estado ao item ativo e à rolagem:

| Frente | Exemplo da copy | O que a tela demonstra |
|---|---|---|
| Agentes de IA | Triagem de solicitações | Solicitações entram, o agente classifica, cada uma vai para sua fila; uma fica marcada para revisão humana |
| Automações | Relatório semanal gerado sozinho | As etapas manuais se riscam em sequência e o relatório se monta |
| Integrações | ERP conectado ao CRM | Pulso de dado corre pela linha entre os dois sistemas; o registro aparece do outro lado |
| Dados | Painel de indicadores da produção | Barras crescem, número conta, a linha é traçada |
| Soluções sob medida | Captura de conhecimento na CBA | Onda de áudio vira linhas de texto e depois campos estruturados: problema, solução, criticidade, prazo |

- **Regras:** todo texto novo dentro das telas é ilustrativo, curto e já usado na copy ou no case (nada de número inventado); `aria-hidden` na tela; marca "Tela ilustrativa" mantida. Só `transform` e `opacity`.
- **Troca entre itens:** a tela anterior sai para cima e a nova sobe, usando `SETTLE`, sem salto no acordeão.
- **Cores:** Limestone, Imperial e ouro. Hoje as telas têm cores soltas: alinhe à paleta.
- **Celular:** sem `data-live`, tudo aberto e empilhado, cada tela anima ao entrar na vista.

### 4. "Do problema à solução rodando."
- **Conteúdo:** Entendimento, Escopo, Construção, Entrega, frase de fecho.
- **Estratégia:** método previsível para quem já se queimou com fornecedor.
- **Animação:** mantenha `StepsPin`. Acrescente: número em ouro conta ou acende ao ativar; filete abaixo do texto; a frase final entra quando a linha termina.
- **Limite:** a Advisory reutiliza este componente com 3 passos. Qualquer mudança tem que funcionar com 3 e 4 passos, sem quebrar a API atual.

### 5. "Projetos que já estão rodando."
- **Conteúdo:** números (+100, 170, 12 horas), case CBA com foto e selo, lista Kognis e Spectra.
- **Estratégia:** prova. O número "1.681 problemas" é o mais persuasivo da página.
- **Animação:**
  - `CountUp` dos números intacto; filete cresce entre eles;
  - foto do case com máscara que abre e leve deslocamento;
  - "1.681 problemas registrados em 3 meses de piloto, com 97% de encaminhamento definido." ganha destaque: conte só 1.681 e 97%, se o `CountUp` servir, sem alterar o texto;
  - lista: linhas entram em stagger, seta desliza no hover.

### 6. Fechamento: "Escopo, prazo e métricas definidos antes de começar."
- **Animação:** a frase entra por linhas e "começar." por último, em ouro. Aqui a Advisory usa nuvens; use um asset próprio da marca que combine (`arcos-sepia` em `docs/po/design/marca/pdf-assets/atmosfera/`, otimizado e em baixa opacidade), com deslocamento leve. Avalie e justifique.

## Prioridade se faltar tempo
Layout V3, 3, 4, 5, 1, 2, 6. Faça a 3 muito bem.
