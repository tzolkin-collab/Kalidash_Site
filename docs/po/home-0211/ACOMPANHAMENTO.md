# Home com a aparência de 02/11, em Kepler

Veja em `http://localhost:3307` (build de produção). Branch `claude/home-0211-ff4737`, sem push e sem merge.

## Terminou

- **Fundos:** branco e cinza claro `#f8f8f8`, medidos na 3306. O Diagnóstico e o rodapé continuam roxos.
- **Títulos:** Kepler em toda a Home, maiores que antes para ter a presença de 02/11.
- **O que fazemos:** xadrez de três fotos grandes encostadas no texto, sem cartão.
- **Experiência, case e depoimentos:** como em 02/11, com a galeria, os retratos grandes e o selo do prêmio.
- **O Problema:** bloco roxo e holograma atuais, e três sintomas abertos, cada um com seu depoimento.
- **Celular e tablet:** título, texto, holograma e sintomas aparecem. Holograma conferido por imagem em 360, 390 e 768.
- **Mantidos:** 28 logos em cor, loop de 75 s e copy atual (`content.ts` não mudou).

## Antes e depois

Em `img/`, sempre 3306 à esquerda e 3307 à direita: `<largura>-<seção>.png`, em 1440, 1024, 768 e 390. Primeira tela: `1366x768-primeira-tela-antes.png` e `-depois.png`. Holograma: `holo-360.png`, `holo-390.png`, `holo-768.png`. Quadros de animação: `<largura>-quadro-*.png`.

## Medições

| Item | v3-preview (3300) | Nova Home (3307) |
|---|---|---|
| LCP computador / celular | 668 / 456 ms | 576 / 376 ms |
| CLS computador / celular, com rolagem | 0,0014 / 0,0012 | 0,0017 / 0,0017 |
| TBT computador / celular, sem rolar | 330 / 345 ms | 294 / 290 ms |
| TBT celular, rolando até o fim (outra rodada) | 238 ms | 629 ms |

Mediana de 3, com CPU 4x mais lenta e sem rede simulada; não é Lighthouse. **Os números de carregamento variam entre rodadas:** no celular, sem rolar, a segunda rodada deu 238 ms na 3300 e 332 ms na 3307.

**Custo do holograma:** o aumento do TBT ao rolar no celular vem, muito provavelmente, de ele agora carregar lá. Antes ele não existia nessa largura. Isso acontece ao chegar na seção, não na abertura da página.

- **Rolagem horizontal:** nenhuma em 1440, 1024, 768 e 390.
- **Console:** sem erros. Só avisos de pré-carregamento de CSS do Next em produção.
- **`tsc` e build:** passam.
- **Lint:** 2 erros, em `DiagnosticoClient` e `AdvisoryMotion`, arquivos que esta entrega não mexeu.
- **Outras páginas:** Advisory e Sobre nós têm 0,000% de pixels diferentes da 3300, em 1440 e 390, com movimento reduzido.

## Animações que saíram

Só as que estavam nos cartões do problema: a abertura lateral, o escurecimento dos vizinhos ao passar o mouse e a grade piscante dentro de cada cartão. A grade do bloco roxo continua.

## Onde ainda difere da 3306

- **Hero:** título em 3 linhas, não 4, porque a Kepler é mais estreita. A seção fica cerca de 66 px mais baixa em 1440.
- **O Problema:** mais alto, porque os sintomas ficam abertos. Em 1440 os blocos não encostam mais na marca-d'água, que saiu.
- **Case:** mais alto, porque a copy atual tem uma frase e um link a mais.
- **Diagnóstico:** roxo com textura, botões claros e fecho dourado sem itálico, por decisão do brief.
- **Peso dos títulos:** Kepler 400. O kit não tem Semibold e títulos em 700 são proibidos, então a presença vem do tamanho.

## Para o PO decidir

O texto de apoio e os números do hero seguem em Inter e Source Sans, porque o brief manda não mexer no hero, mas também diz que essas fontes não voltam. Deixei como está.

## Não conferi

- iPhone ou Android de verdade: o celular foi emulado no Chrome.
- Home com movimento reduzido.
- Sumiço do cabeçalho ao rolar: o teste automático não o detectou nem na 3300 nem na 3307. Os arquivos do cabeçalho não mudaram.
- Execução, AI Culture, Soluções, Kognis, Spectra e Blog: só o teste de Advisory e Sobre nós rodou. O CSS mudou só em regras limitadas à Home.
