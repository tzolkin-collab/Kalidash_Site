# Relatório B10 — marca em /advisory (1ª página) e tamanho do /sobre-nos

Status: **nada commitado**. Parado na Advisory. Execução e AI Culture herdam o sistema (mesmo `KitPage`), mas só passaram por revisão minha, não foram liberadas.

## Revisão crítica da Advisory (2ª versão tinha ai-slop) e o que mudou
Removido por parecer template de IA ou contrariar o brand guide / `revisao-site.txt`:
anel dourado em volta do busto; busto recortado sobre arco (adesivo); greca cinza de largura total; foto de banco de imagem; painel preto com estátua e gradiente; estátua tingida de roxo no fecho (blend screen); filetes dourados entre todas as seções; dourado em títulos comuns; bolinhas de "como funciona" na faixa de passos.

Agora, com os assets do próprio guide (extraídos do PDF para `docs/po/design/marca/pdf-assets/`, catálogo em `CATALOGO.md`; só três foram para `apps/site/public/marca/`):
- **Hero** Imperial: texto à esquerda, *Escola de Atenas* (um comitê de pensadores, ligado ao "Comitê de IA" da página) em arco à direita; última palavra em **dourado itálico**; botão dourado.
- **Manifesto** ("Não entregamos um plano…") em Limestone, serifa, um filete dourado e **Sócrates** (fundo bege combina com o claro) como figura editorial.
- **Faixa de passos** em Imperial, números em dourado, botão dourado; **fecho** em Imperial com as **nuvens douradas** do guide ao fundo (textura, sem tingir).
- Dourado só em: legendas, palavra final dos manifestos, números dos passos, botões sobre escuro, um filete.

Sistema (todas as páginas do KitPage), em `kit.module.css` escopado em `.main`: Fraunces (normal + itálico) nos títulos, Archivo no corpo, `--soft` champagne, Imperial nas faixas, `--t-claim` 34px. Execução e AI Culture: manifesto sem imagem (só texto, filete e palavra final em dourado itálico), fecho em Imperial liso.
Sobre nós: só tamanho/organização (`.sobre`): hero, títulos e seções menores; página de >6000px para ~4960px em 1440.

## Verificação
- PNG real 1440 e 390 em `docs/po/relatorios/b10-marca/` (`advisory-*` antes/depois/lado a lado, `sobre-nos-*`). O "antes" é o original pré-B10.
- `copy-diff.mjs` (BASE=localhost:3000): as 9 rotas OK. `tsc` e `eslint` em `solucoes`: limpos. Console limpo, sem rolagem lateral.
- Não medido: `next build` e peso das fontes (disco C: cheio; `npx`/build falham). Fraunces variável latin + itálico: +2 woff2 só nas 4 rotas do KitPage. As imagens novas (Atenas 346 KB, Sócrates 167 KB, nuvens 970 KB) passam pelo `next/image`.
- Não visto em aparelho real.

## Pendências / riscos
- **Imagens do PDF em produção precisam de OK do PO/dono** (banco de imagens é decisão do dono). Atenas, Sócrates e nuvens estão em `public/marca/` só para esta revisão; reverter se negado.
- O hero da Advisory deixou de usar a foto de reunião de `pages.ts` (o dado continua lá, sem uso nesta página). O `alt` das novas imagens vive em `KitPage.tsx`.
- Heroes da Execução e AI Culture (foto em arco, fundo claro) vêm do `ProductPage` (proibido tocar) e destoam do hero Imperial da Advisory.
- "01…05" da lista "O que fazemos" são numeração sem sequência (apontado em `revisao-site.txt`); o texto "01" faz parte do `copy-diff`, não removi.
- Números "01..03" da faixa de passos usam fade por rolagem do `ProductPage`; em captura sem rolagem aparecem apagados.
- Fontes: Kepler/Acumin continuam pendentes (Adobe Fonts).

## Movimento de rolagem da Advisory (referência: Studio Next Level / KYVO)
Só CSS, sem JS novo (`kit.module.css`, `KitPage.tsx` só para a Advisory): o hero fica fixado e é coberto; cada capítulo sobe em "cortina" (canto de cima arredondado, alternando Imperial / Limestone / branco) e tem um cabeçalho fino "nº / total · título" com fio dourado que enche com a leitura (`animation-timeline`, só transform). O rótulo vem de `data-text` via CSS, fora do texto da página (copy-diff OK).
- Só atua em desktop (>=901px), altura >=740px e sem movimento reduzido; celular, tela baixa e movimento reduzido ficam empilhados e parados. Sem suporte a `animation-timeline`, o cabeçalho aparece sem o fio e nada se mexe. Conteúdo nunca nasce escondido.
- **LCP**: sem seção fixada com imagem; o maior elemento da primeira dobra em 390 é a imagem do hero (`priority`, 54 mil px²). Medido no navegador local (dev), não no build.
- Quadros: `advisory-sequencia-rolagem-1440.png` (8 pontos) e `-390.png` (6 pontos); individuais em `sequencia/`.
- Não feito: o "símbolo em linha fina como textura" (o SVG da marca é sólido; fazer em linha pede o arquivo vetorial do dono); seção longa com palco fixado interno (a Advisory é curta, e foi o que piorou o LCP em /solucoes).
- Cabeçalhos de capítulos anteriores ficam visíveis por instantes durante a subida da próxima cortina (empilhamento passageiro).

## Correções após revisão do PO e do dono (movimento e celular)
- **Aprovado no desktop** pelo dono. No celular/tablet (<=1100px) o cabeçalho da Home é transparente e flutua sobre o texto, e a abertura mostrava uma faixa branca acima do hero. Na Advisory o cabeçalho agora é uma barra Imperial sólida, com fio dourado, sempre visível (sem esconder ao rolar), logo em Limestone; o hero Imperial continua nela, sem branco. Escopo: só a Advisory (`.kitDark`); Home e outras páginas não mudam. Quadros em 390 com rolagem real em 3 posições: `sequencia/v2-390-y0|y1200|y3000.png`.
- **Rótulos de capítulo no desktop**: só o do capítulo atual fica no topo; o do capítulo que sai desaparece (fade por `animation-timeline`) antes de o próximo aparecer. Quadros em 1440: `sequencia/v2-1440-y1500|y2700.png`. Sem suporte a `animation-timeline`, os rótulos podem se empilhar por instantes.
- **Rótulo é só UI**: "02 / 07" e o fio são interface; o texto de cada rótulo é o eyebrow ou título que já existe na seção (nenhum texto novo), vem de `data-text` via CSS e não entra no texto da página (copy-diff OK nas 9 rotas).
- **WhatsApp**: a bolha continua fixa sobre o conteúdo no celular (o brief não pediu link discreto); fica como pendência para o PO decidir.
- Faixa 901–1100px: rótulo desce para 76px para não ficar sob o cabeçalho de 76px.

## Cabeçalho no celular, 2ª versão (pedido do dono: sem fundo roxo e menor depois do scroll)
Substitui a barra Imperial acima. No topo (<=1100px) o cabeçalho é transparente sobre o hero Imperial, com logo clara e sem faixa branca; depois de rolar vira uma barra Limestone compacta de 56px (antes 76px) com fio dourado e logo escura. O elemento segue com 76px mas não ocupa espaço no fluxo (margin-bottom negativo), então nada pula. Só na Advisory. Quadros: `sequencia/v3-390-y0|y1200|y3000.png`. Observação: sobre seções Limestone a barra se funde ao fundo e só o fio dourado a separa.

## Cabeçalho no celular, 3ª versão (substitui as duas anteriores)
As versões anteriores sobrescreviam o cabeçalho da Home (sempre visível, barra própria) e tiravam os comportamentos dela. Agora o cabeçalho da Home volta ao original: flutuante e transparente, some ao rolar para baixo, volta ao subir, logo que recolhe em animação. Só duas correções, só na Advisory e em <=1100px: (1) o cabeçalho não ocupa espaço no fluxo (margin-bottom -76px) e o hero sobe para baixo dele, sem faixa branca; (2) a logo muda de cor conforme o fundo sob ela (clara sobre Imperial, escura sobre claro) por `HeaderTone.tsx`, um observador pequeno que só escreve `html[data-header-tone]` (não renderiza nada nem mexe no layout). Quadros: `sequencia/v4-390-y0|y1200|y3000.png`. Pendência: como na Home, o texto passa por baixo da logo flutuante por instantes, até o cabeçalho sumir ao rolar.
