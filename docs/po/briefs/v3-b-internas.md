# Sessão B: AI Culture, Advisory e Execução

> Leia antes `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/v3-comum.md`. Referências em `.../_assets-carol/v3/`.
> Páginas: `/treinamento-corporativo-ia`, `/advisory` (e `/consultoria-governanca-ia`, mesmo conteúdo), `/execucao`.

## Arquivos seus

`solucoes/KitPage.tsx`, `solucoes/kit.module.css`, `institucional/pages.ts` (só os blocos `aiCulture`, `advisory`, `execucao`), `public/advisory/`. Em `solucoes/ProductPage.tsx` e `solucoes/product.module.css`, só acréscimos que **não alterem** Kognis, Spectra, `/solucoes` e `/sobre-nos`; compare essas páginas antes e depois.

**Não toque:** `home/*`, `sobre-nos/*`, `layout.tsx`, `globals.css`, `kit-font.ts`, `StepsPin`, `BuildStory`, `ScrollMotion`, `CountUp`. Regras do cabeçalho e da animação na seção 4 do comum.

## Bloqueios

| Item | Depende de |
|---|---|
| C1 | Carol confirmar os números: "+4.000 profissionais" contradiz "+10 mil pessoas" da Home e de Sobre nós |
| E2 | Confirmar que "retirar essa parte" é a lista Kognis/Spectra (`doc-28.png`) |

Decidido pelo dono em 04/11/2026: em V1, trocar a Escola de Atenas pela foto do Drive, com o recorte pedido.

Execute o resto. Fechamentos e hero de Sobre nós já foram resolvidos: só confira depois da fonte.

## Ordem

Comece por B0. Advisory primeiro (B0, V1 a V4): é onde a hierarquia mais muda e o PO vai mostrá-la ao dono antes de seguir. Depois AI Culture e Execução.

### B0. Base: tipografia e destaque por sentido
- Carregue o kit em `KitPage`. No `.main`, família Acumin; em `.main :is(h1, h2, h3, summary)`, `--font-title` com Kepler Display. Só em páginas do `KitPage`: `SobreNosPage` também importa `kit.module.css`, então use uma classe nova no root do `KitPage`.
- Destaque por palavra escolhida: novo campo opcional no bloco (`accent: "capacidade"`), sem mudar nenhuma string. `LastWord` passa a usar o campo e mantém o comportamento atual quando ele faltar.
- Palavras: Advisory `E agora?`, `depois dele.`, `melhor`, `rituais`, `resultado.`; AI Culture `capacidade`; defina as demais e registre no relatório.
- Títulos de `TextView` e similares: hoje juntam as linhas com `join(" ")`. Continue e use `text-wrap: balance`.

## Advisory

### V1. Hero, refs `doc-17.png` e `advisory-foto-drive.jpg`
Foto do Drive (FDC, 1200×1600) no arco atual, **com recorte que esconda as plaquinhas de nome dos alunos** (ex.: "Fernando Nogueira") e sem cortar o palestrante. Otimize em `public/advisory/` e escreva `alt` descritivo. A imagem hoje está fixa em `KitPage` (`HeroWide`): passe a ler de `pages.ts`, garantindo que só Advisory use esse caminho.

### V2. "A estratégia foi definida", refs `doc-18.png` (hoje) e `doc-19.png` (alvo)
**Intenção:** ela achou "grosseiro, cortado". A referência divide em dois momentos: o problema em Limestone e a resposta em Imperial.

- Parte clara: título com "E agora?" em itálico dourado, texto à direita.
- Linha do tempo: as 4 frases de "Surgem informações novas, prioridades mudam, uma tecnologia não entrega o esperado, uma área resiste." em colunas com filetes, sobre uma linha com pontos. **Sem** os rótulos "Plano aprovado" e "Fim do 1º trimestre", que não existem na copy.
- Parte Imperial: "Não entregamos um plano." atenuado, "Acompanhamos o que acontece" forte e "depois dele." em itálico dourado.
- Régua de 4 itens, com numerais em ouro: decidir o que priorizar, medir o que funciona, definir responsáveis, corrigir a rota. As palavras saem do texto acima; não altere o parágrafo sem avisar o PO se ficarem repetidas.
- Sócrates: a referência troca a foto por um símbolo. Avalie e justifique no relatório.
- Tudo dentro do mesmo capítulo: não altere a contagem nem quebre a cortina.

### V3. "Ajudamos sua liderança", refs `doc-20.png` (hoje) e `doc-21.png` (alvo)
**Intenção:** "extremamente simples, números confusos (o 5 embaixo do 3?), traria mais fluidez". Não são sequência, então não use 01–05.

- Esquerda: título com "melhor" em itálico dourado, apoio menor, diagrama de pentágono.
- Direita: **coluna única** de 5 linhas, separadas por filete, com romano (I a V) à esquerda e ícone de linha à direita (use os do projeto).
- Pentágono em SVG inline, `aria-hidden`, em linha ouro fina com os romanos. Sem o rótulo "Liderança" se ele for texto novo visível. Um desenho só; a referência "tem muitos elementos".

### V4. "Três rituais", refs `doc-22.png` (hoje) e `doc-23.png` (alvo)
**Intenção:** tirar o ar de lista e fazer os três rituais parecerem coisas concretas.

- Seção Imperial, título com "rituais" em itálico dourado.
- Três cartões Aubergine, com raio moderado e ícone de linha em ouro no topo. Título em Kepler, descrição e, separada por filete, a frase final do texto em itálico ouro quando existir (ex.: "É o ritual que impede a iniciativa de morrer na primeira urgência do mês."). Dividir a string em dois elementos é permitido; o texto segue igual.
- Sem pílulas "Mensal/Contínuo/Individual" e sem "I · Com a liderança": são rótulos novos. Avise o PO se a Carol quiser.
- Faixa Limestone embaixo com "O que a liderança recebe": três colunas (painel, relatório, roadmap), com ícone. O texto vem do `closing` e não muda.
- Mantenha `animated: true` e o surge. Esta é a seção mais alta: confirme que a cortina funciona quando o capítulo é maior que a tela.
- Celular: cartões empilhados, sem carrossel.

## AI Culture

### C1. Números, ref `doc-10.png` (bloqueado)
`+200` Times treinados e `+4.000` Profissionais capacitados. O `CountUp` lê `+4.000` como 4 mais o sufixo `.000`: confira que anima de forma natural, sem alterar o componente.

### C2. "Por que capacitar?", refs `doc-11.png` (hoje) e `doc-12.png` (alvo)
- H1 da página cerca de 15% menor.
- "Ter acesso à IA..." à esquerda, texto em coluna menor à direita, filete abaixo.
- "Nosso objetivo..." bem menor: assinatura, não título. **Só "capacidade" em destaque**, em terracota ou ouro conforme o contraste. Em `doc-12.png` ela fica em linha própria; prove as duas formas e escolha a mais fluida.

### C3. Metodologia, ref `doc-13.png`
Título já está fluido; confira na Kepler. "O treinamento termina. A capacidade fica." sem quebra no meio: em largura total ou com `text-wrap: balance`. Mantenha a linha e a entrada dos passos.

### C4. Formatos, refs `doc-14.png` (hoje) e `doc-15.png` (alvo)
**Intenção:** "hierarquia confusa". A referência dá um nível para cada coisa. Ela mesma pediu para manter em linhas horizontais, mas mais claras.

- Dois blocos largos, um sob o outro: In Company em Limestone fundo e Experiências em Imperial/Aubergine, com raio moderado.
- Cabeçalho de cada bloco com filete; numeração `01` e `02` em ouro. Sem o rótulo "Capacitação corporativa", que é novo.
- Esquerda: título grande, público, CTA. Filete vertical. Direita: recursos em linhas de duas colunas, com ícone de linha; nota de rodapé pequena.
- Texto e CTAs de `pages.ts` sem alteração, inclusive "Mão na massa" e similares. A referência tem outra copy: ela mesma pediu "ajustar com a copy certa que já está no site".
- Celular: empilhado, com os recursos legíveis.

## Execução

### E1. Hero, refs `doc-25.png` e `doc-26.png`
Linha fina deslocada atrás da foto em arco, como em `doc-26.png`, em ouro ou no tom do fundo. Só CSS (`::before`), sem deslocar o layout nem afetar o LCP. Só em Execução: os outros heros não mudam.

### E2. Retirar a lista, ref `doc-28.png` (bloqueado)
Tirar Kognis e Spectra só de Execução, sem apagar `/kognis` e `/spectra`. Com o bloco vazio, ajuste o espaço e confirme a contagem dos capítulos. Mantenha `pages.ts` reversível (campo que oculta), sem apagar o texto.

### E3. "Saber o que mudar", ref `doc-27.png`
Já está menor. Confira quebra e destaque na Kepler. "É aí que a Kalidash entra." pede a palavra certa em destaque, provavelmente "entra".

### E4. Pin e acordeão
Não pode mudar nada além da fonte herdada. `StepsPin` e `BuildStory` são o coração do movimento desta página: registre os quadros antes e depois.
