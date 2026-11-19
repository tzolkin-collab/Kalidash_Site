# Spectra AI: filme de scroll da abertura

> **Abandonado em 19/11.** As gerações no Dreamina não ficaram boas e o vídeo saiu do plano. A /spectra ganhou a mesma história em código: `apps/site/src/app/spectra/SpectraTurno.tsx` traça o gráfico do turno pela rolagem, abre os retratos nas pontas e mostra uma ficha por vez. A logo animada da abertura está em `apps/site/public/spectra/logo/`. Este roteiro, as chaves e a maquete ficam só como registro.


Três takes de 8 s gerados no Google Flow (Veo). O ffmpeg transforma os takes em quadros, e a página desenha o quadro que corresponde à posição do scroll. Cada take sai em duas versões, desktop 16:9 e mobile 9:16, porque a composição muda. Recortar o 16:9 para celular corta o busto e o gráfico.

O que fica no vídeo e o que fica no código:

| Parte | Vídeo (Flow) | Código (página) |
|---|---|---|
| Busto em colagem, fundo roxo → branco | ✅ é o que só a IA faz bem | título, texto e botão por cima; a cor do texto acompanha o fundo |
| Linhas douradas virando gráfico | ✅ | rótulos das 3 linhas (Leitura em tempo real, Dados de produtividade, Oportunidades claras) |
| Fotos nas pontas das linhas | ✅ retratos dentro de aros dourados | **fichas** (nome, produtividade, retorno, tempo de casa) em HTML, nítidas e editáveis |

Texto, número e letra **nunca** vão no vídeo: a IA escreve errado, borra e o Google não indexa.

---

## Como gerar no Flow (vale para os 3 takes)

1. Modelo Veo com **Frames to Video** (quadro inicial). Proporção 16:9 para a versão desktop e 9:16 para a mobile.
2. **Take 1:** o quadro inicial é `quadro-inicial-desktop.png` / `quadro-inicial-mobile.png`, nesta pasta.
3. **Take 2 e take 3:** o quadro inicial é o **último quadro do take anterior**. É isso que faz os takes emendarem sem pulo. Para extrair:
   ```
   ffmpeg -sseof -0.1 -i take1.mp4 -frames:v 1 -update 1 take1-ultimo.png
   ```
   Se não tiver ffmpeg no PATH, este já existe no PC: `C:\Users\gusta\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe`
4. Gere 2 ou 3 variações de cada take e escolha a que **mantém a câmera mais estável**. No scroll, tremida e corte aparecem muito mais que num vídeo normal.
5. O som é descartado.

### Bloco de estilo (cole no começo de todos os prompts)

```
Premium editorial brand film for an industrial AI product. Hyperreal classical white Carrara marble bust of a young man with curly hair, in left-facing profile; the back of the head and the neck are cracked open, revealing dense micro-circuitry lit in warm gold (keep the bust exactly as in the start frame). Palette: deep imperial purple #28183B, champagne gold #A88A58 and #C4A673, marble white, and later pure white #FFFFFF. Soft museum key light from the left, gentle rim light. Minimal, luxurious, calm. One continuous shot, no cuts, 24 fps, smooth motion.
Avoid: any text, letters, numbers, logos, watermarks, UI, lens flare, bloom, glow, particles, sparks, smoke, extra statues, camera shake, fast motion.
```

---

## Take 1: colagem e o fundo que clareia

**Desktop 16:9** (quadro inicial: `quadro-inicial-desktop.png`)

```
[bloco de estilo]
The camera is locked off at first, then slowly trucks right so the bust moves from the right third to the left third of the frame by the end.
0–3 s: the bust comes apart like a hand-cut collage made of marble: the head separates from the neck along a jagged torn edge and floats a few centimeters upward, tilting slightly back; the neck and shoulders stay below, offset a little to the right. Each piece casts a thin, soft drop shadow, like layered cut paper. Calm, weightless, precise movement.
2–6 s: from the exposed gold circuitry at the back of the head, three thin metallic gold lines extend toward the right edge of the frame: parallel, evenly spaced, fine precise strokes with tiny round gold nodes along them, a slight metallic sheen, no glow.
3–8 s: the purple background brightens evenly until it is pure flat white #FFFFFF: no vignette, no gradient, no texture. The dotted gold orbit lines fade out.
Final frame: pure white background, the separated marble collage bust in the left third, three gold lines running from the back of its head to the right edge of the frame.
```

**Mobile 9:16** (quadro inicial: `quadro-inicial-mobile.png`)

```
[bloco de estilo]
Vertical frame. Keep the top 40% of the frame empty for the headline. The camera stays locked off, with a very slow pull-back.
0–3 s: the bust comes apart like a hand-cut collage made of marble: the head separates from the neck along a jagged torn edge and floats upward a little, tilting slightly back; the neck and shoulders stay below. Thin soft drop shadows, like layered cut paper.
2–6 s: from the exposed gold circuitry at the back of the head, three thin metallic gold lines extend to the right edge of the frame: parallel, evenly spaced, with tiny round gold nodes along them.
3–8 s: the purple background brightens evenly until it is pure flat white #FFFFFF, with no vignette and no texture. The orbit lines fade out.
Final frame: white background, the collage bust in the lower-left half, three gold lines exiting to the right edge.
```

## Take 2: as linhas viram gráfico

**Desktop 16:9** (quadro inicial: último quadro do take 1 desktop)

```
[bloco de estilo]
Pure white #FFFFFF background throughout. The camera trucks slowly to the right, following the three gold lines; the bust leaves the frame on the left within the first 2 seconds.
As the camera travels, the three lines start to rise and vary like line charts, each with its own character: one climbs steadily, one rises with small fluctuations, one steps up like a staircase. Small round gold nodes mark the data points. Very light grey horizontal hairlines (#ECE8F0) fade in behind the lines, like a chart grid, with no axes and no labels.
By 6 s the camera settles and holds still. The chart is complete: the three lines end at three clearly different heights in the right third of the frame, and each tip is marked by a slightly larger gold node.
Final 2 s: completely still.
```

**Mobile 9:16** (quadro inicial: último quadro do take 1 mobile)

```
[bloco de estilo]
Vertical frame, pure white #FFFFFF background. The camera trucks slowly to the right, following the three gold lines; the bust leaves the frame on the left within 2 seconds.
The lines start to rise and vary like line charts: one climbs steadily, one fluctuates gently, one steps up like a staircase. Small gold nodes mark the data points; very light grey horizontal hairlines (#ECE8F0) fade in behind them, with no axes and no labels. Keep the chart inside the middle band of the frame (from 25% to 65% of the height) and leave the bottom third empty.
By 6 s the camera holds still: the three lines end at three different heights at about 75% of the frame width, each tip marked by a slightly larger gold node. Final 2 s: completely still.
```

## Take 3: as pessoas na ponta das linhas

**Desktop 16:9** (quadro inicial: último quadro do take 2 desktop)

```
[bloco de estilo]
Pure white background. The camera is completely locked off, with no movement at all.
At the tip of each of the three lines, one after another from the lowest to the highest, a circular portrait opens with a thin gold ring (it scales up from the node with a soft ease). Each portrait is a natural-light editorial photo of a fictional factory worker in work uniform, with a softly blurred factory floor behind: first a woman in her 30s wearing safety glasses, then a man in his 50s with a grey beard, then a young man in his 20s. Realistic, warm and respectful, looking at the camera.
Leave clean empty white space to the right of each portrait; nothing appears there.
Final 2 s: completely still.
```

**Mobile 9:16** (quadro inicial: último quadro do take 2 mobile)

```
[bloco de estilo]
Vertical frame, pure white background, camera completely locked off.
At the tip of each of the three lines, one after another from the lowest to the highest, a circular portrait opens with a thin gold ring: natural-light editorial photos of fictional factory workers in work uniform with a softly blurred factory floor behind (a woman in her 30s with safety glasses, a man in his 50s with a grey beard, a young man in his 20s). Realistic, warm, respectful.
The bottom third of the frame stays empty and white.
Final 2 s: completely still.
```

---

## Do vídeo para os quadros (ffmpeg)

Com os 3 takes de cada formato baixados, rode da raiz do repo:

```
bash docs/spectra-video/quadros.sh desktop take1.mp4 take2.mp4 take3.mp4
bash docs/spectra-video/quadros.sh mobile take1-m.mp4 take2-m.mp4 take3-m.mp4
```

O script foi testado em 19/11 com takes de teste:
- 288 quadros 1600×900 a 12 fps;
- o Imperial se manteve (40,24,60 → 39,22,58);
- o branco fechou em 255.

Ele junta os takes sem repetir o quadro da emenda, tira o som e reduz a 12 fps. Também fecha o branco: canal ≥ 245 vira 255, para emendar com o `#fff` da seção seguinte. Por fim, grava WebP e `manifest.json` em `apps/site/public/spectra/filme/<formato>/`.

**Peso esperado** (a estimar de novo com os takes reais):

| Formato | Quadros | Tamanho por quadro | Total |
|---|---|---|---|
| Desktop | 288 de 1600 px | 40–70 KB | 12–18 MB |
| Mobile | 288 de 720 px | 15–30 KB | 5–8 MB |

Se ficar pesado, baixe para `FPS=10` e/ou `QUALIDADE=65`. Fundo branco comprime muito, então os takes 2 e 3 pesam pouco.

## Na página (o que o código faz)

- **Seção presa (sticky)** de cerca de 400svh no desktop e 350svh no celular, com um `<canvas>` cobrindo a tela. O quadro desenhado é `round(progresso × (n − 1))`. O desenho usa rAF e só acontece quando o quadro muda; a Lenis, que já está no site, suaviza o scroll.
- **Carregamento em duas passadas:**
  - o primeiro quadro entra como `<img priority>` (é o LCP e o pôster);
  - depois carrega 1 a cada 8 quadros, para o scroll já funcionar grosso;
  - por fim preenche o resto.
  - Desktop e mobile escolhem a pasta por `matchMedia` antes do primeiro fetch. O canvas tem tamanho fixo em CSS, sem CLS.
- **Texto por cima, sincronizado:**

  | Progresso | O que aparece |
  |---|---|
  | 0–30% | título, lead e botão, como hoje; o texto passa de claro para Imperial quando o fundo clareia |
  | 40–70% | os rótulos das 3 linhas, que são os 3 itens de "O que faz" |
  | 75–100% | as fichas ao lado de cada retrato (no celular, empilhadas no terço de baixo) |

  Com a câmera parada no take 3, as fichas ficam em coordenadas fixas medidas no último quadro.
- **`prefers-reduced-motion`:** sem scroll preso; mostra o primeiro quadro na abertura e o último com as fichas logo abaixo.
- **Verificação:** o mesmo `shot.mjs` em 1440, 1024 e 390, em vários pontos de rolagem, e `cls.mjs` abaixo de 0,1. É o mesmo ciclo da Reanimate (gravar, comparar, corrigir).

## Pontos para decidir antes de gerar

1. **Fichas por pessoa.**
   - Mostrar "produtividade" e "retorno" de um funcionário com rosto pode soar como vigilância para quem compra (e para o time dela). Isso vai contra o "sem interromper o time" da própria página.
   - Alternativa: a ficha é do **posto** (Torneamento, Montagem, Inspeção), com o operador só na foto.
   - De todo jeito, os números são **exemplo ilustrativo** e as pessoas são fictícias: vale um rótulo discreto "exemplo".
2. **"Retorno do funcionário":** retorno financeiro (R$ por hora, ROI do posto) ou retorno de feedback? Preciso da definição da Carol/César para escrever a ficha.
3. **Takes 2 e 3 no código, em vez de vídeo** (opcional):
   - as linhas e o gráfico podem ser SVG desenhado no scroll: nítidos em qualquer tela, dourado exato e cerca de 20 KB em vez de MBs;
   - aí só o take 1 é vídeo;
   - recomendo gerar os 3 takes e decidir vendo os dois lado a lado.

---

## Revisão do filme A (`Marble_bust_with_gold_circuitry_90321b58.mp4`, 19/11)

O arquivo tem 16 s, 1280×720, 24 fps, com som, em uma peça só (take 1 de 0 a 8 s, take 2 e 3 de 8 a 16 s). Quadros-chave em `quadros-chave/`. A medição de movimento quadro a quadro não achou corte seco em nenhum ponto.

| Tempo | O que acontece | Avaliação |
|---|---|---|
| 0,0–1,0 s | close no rosto, a câmera abre rápido | ✅ boa abertura. ⚠️ o roxo do vídeo é mais escuro que o Imperial do site (≈ 20,16,32 contra 40,24,60): a página usa a cor do vídeo atrás do canvas, ou o cabeçalho Imperial vira uma faixa |
| 1,0–2,0 s | cabeça desgruda do pescoço, colagem com sombra | ✅ exatamente a ideia |
| 2,0–3,0 s | linhas douradas saem dos circuitos | ✅ ⚠️ saem **4** linhas, não 3 |
| 3,0–5,5 s | roxo → cinza → branco, as órbitas somem às 4,5 s | ✅ transição limpa |
| 5,5–8,0 s | quase parado (só deriva leve) | ⚠️ 2,5 s "mortos" no scroll: comprimidos para 4 quadros |
| 8,1–8,8 s | linhas retas viram gráfico | ❌ **as linhas quebram em pedaços soltos** (emenda do segundo take). No scroll, quem para aqui vê o defeito. Hoje passa em 1 quadro; o certo é regerar |
| 8,9–10,5 s | câmera vai para a direita, o busto sai, grade cinza aparece | ✅ |
| 10,5–12,0 s | gráfico parado | ⚠️ comprimido para 3 quadros |
| 12,0–14,0 s | retratos abrem: mulher (escada), homem de barba (zigue-zague), jovem de boné (subida) | ✅ rostos bons e naturais. ⚠️ os retratos ficam **no meio** das linhas, não na ponta; a 4ª linha fica sem pessoa |
| 14,0–16,0 s | tudo parado | ✅ ótimo para as fichas em código (posições fixas). Comprimido para 1 quadro; o scroll segura o final |

**Branco:** o fundo do Veo fica em 244–246, não em 255. O script agora fecha o branco pelos três canais juntos. Em 19/11 o resultado foi `#fff` exato dos 5,4 s em diante, sem amarelar a transição, e o Imperial e o mármore ficaram intactos.

**Seleção usada** (121 quadros, 4,1 MB em WebP 1280×720):

```
TRECHOS="0-5.5:2,5.5-8.1:12,8.1-8.9:24,8.9-10.5:2,10.5-12:9,12-14.1:2,14.1-16.1:48" bash docs/spectra-video/quadros.sh desktop filme.mp4
```

**Posição dos retratos no último quadro** (1280×720, aproximada), para ancorar as fichas:

| Retrato | Centro (x, y) | Raio |
|---|---|---|
| Jovem | 825, 155 | ≈100 |
| Homem | 515, 368 | ≈100 |
| Mulher | 815, 557 | ≈108 |

### O que falta para ficar bom

1. **Regerar a parte do gráfico (8 s em diante)** com quadro inicial = `quadros-chave/filme-a-7.9s.png`, acrescentando ao prompt do take 2:
   `The lines never break or split: each line bends continuously as one unbroken stroke while it rises; no loose segments, no overlapping copies.`
2. **Baixar em 1080p** (o Flow tem upscale): 720p fica mole em tela de 1440 px ou mais.
3. **Versão 9:16 para o celular.**
   - Os retratos ocupam de x 410 a x 930, uns 520 px, e um recorte vertical de 720 px de altura tem só 405 px de largura. Não cabe; tem que gerar separado.
   - Paliativo, se não der: no celular o filme 16:9 fica preso no topo, ocupando a largura, e o texto e as fichas ficam embaixo.
4. **Decidir 3 ou 4 linhas.** Com 4, a 4ª pode ser a linha sem pessoa, ou o prompt pede "exactly three lines".

---

## Dreamina: takes separados (19/11)

O Dreamina recebe um take por vez, com **quadro inicial e quadro final**. O filme A já foi cortado em `takes/` (sem som, quadro exato de emenda):

| Arquivo | Trecho do filme A | Situação |
|---|---|---|
| `take1-flow.mp4` | 0–7,9 s | ✅ fica como está |
| `take2-flow-com-defeito.mp4` | 7,9–10,5 s | ❌ regerar no Dreamina (as linhas quebram) |
| `take3-flow.mp4` | 10,5–16 s | ✅ fica como está |
| `takeN-inicio.png` / `takeN-fim.png` | primeiro e último quadro de cada take, 1280×720 | `take1-fim` = `take2-inicio` e `take2-fim` = `take3-inicio`, por isso emendam sem pulo |

O script já aceita os 3 takes separados. Testado com estes cortes, deu os mesmos 121 quadros do filme inteiro:

```
TRECHOS="0-5.5:2,5.5-8.1:12,8.1-8.9:24,8.9-10.5:2,10.5-12:9,12-14.1:2,14.1-16.1:48" bash docs/spectra-video/quadros.sh desktop take1-flow.mp4 take2-dreamina.mp4 take3-flow.mp4
```

Se o take 2 novo tiver outra duração, os trechos de 8,1 s em diante mudam; eu recalculo quando o arquivo chegar.

### Take 2 desktop (Dreamina, 16:9, 5 s)

- Quadro inicial: `takes/take2-inicio.png`
- Quadro final: `takes/take2-fim.png`

```
Pure white background, minimal premium style. The camera trucks smoothly to the right and the cracked marble bust leaves the frame on the left. The four thin metallic gold lines that come out of the bust bend and rise continuously into line charts: the top line climbs steadily, the second one zigzags, the third stays mostly level with one small bump, and the bottom line steps up like a staircase. Every line is one single unbroken stroke the whole time: it never breaks, splits, duplicates or leaves loose segments. Small round gold dots travel along the lines. Very light grey horizontal grid lines fade in behind them. Calm, smooth motion, one continuous shot, no cuts, no text, no numbers, no glow, no particles.
```

Se o Dreamina deixar um pedaço solto mesmo assim, gere 2 ou 3 variações e fique com a que mantém as linhas inteiras. É o único critério que importa neste take.

### Versão celular (9:16): os 3 takes no Dreamina

Aqui não há vídeo anterior, então é uma cadeia: cada take começa no último quadro do anterior. Para extrair o último quadro:

```
ffmpeg -sseof -0.1 -i take1-m.mp4 -frames:v 1 -update 1 take1-m-fim.png
```

**Take 1 mobile** (10 s; quadro inicial `quadro-inicial-mobile.png`, sem quadro final):

```
Vertical 9:16. Deep imperial purple background with thin dotted gold orbit lines. The cracked marble bust with gold circuitry stays in the lower half; the top 40% of the frame stays empty. The camera slowly pulls back. The head separates from the neck like a hand-cut marble collage and floats up a little, with thin soft shadows. Four thin metallic gold lines grow out of the circuitry to the right edge. The purple background brightens evenly to pure flat white and the orbit lines fade away. Ends on a white background with the collage bust lower-left and the gold lines exiting right. One continuous shot, no cuts, no text, no glow.
```

**Take 2 mobile** (5 s; quadro inicial `take1-m-fim.png`): use o prompt do take 2 desktop e acrescente:

```
Vertical 9:16. Keep the chart in the middle band of the frame and the bottom third empty white.
```

**Take 3 mobile** (5 s; quadro inicial `take2-m-fim.png`):

```
Vertical 9:16, pure white background, camera completely still. On three of the gold lines, one after another, a circular portrait with a thin gold ring opens from a dot: a woman in her 30s with safety glasses, a man in his 50s with a grey beard, a young man in his 20s with a cap; fictional factory workers in work uniforms, natural light, softly blurred factory behind them, warm and respectful. The bottom third of the frame stays empty white. The last second is completely still. No text, no numbers.
```

Para o take 3 mobile casar com o desktop, dá para subir os 3 retratos do `take3-fim.png` como referência de rosto, se o Dreamina tiver essa opção.

---

## Plano final no Dreamina: chaves fixas (19/11)

Cada take é gerado **entre dois quadros-chave**, com quadro inicial e quadro final. As emendas são o mesmo arquivo dos dois lados, então não há pulo. O `quadro-inicial-mobile.png` antigo saiu: ele usava o busto da apresentação, que não é o mesmo rosto que o vídeo renderizou.

### Quadros-chave

| Chave | Desktop 16:9 | Celular 9:16 (`chaves-mobile/`) |
|---|---|---|
| K0 busto no roxo | `takes/take1-inicio.png` | `k0-mobile.png` ⏳ **expandir no Dreamina** (abaixo) |
| K1 colagem no branco | `takes/take1-fim.png` | `k1-mobile.png` ✅ |
| K2 gráfico pronto | ~~`takes/take2-fim.png`~~ → `chaves-desktop/k2-desktop.png` (seção abaixo) | `k2-mobile.png` (refeita a partir da maquete) |
| K3 retratos | ~~`takes/take3-fim.png`~~ → `chaves-desktop/k3-desktop.png` | `k3-mobile.png` (refeita a partir da maquete) |

As chaves K1 a K3 do celular são os quadros do desktop reenquadrados num 1080×1920 branco. O branco do vídeo já foi fechado em #fff antes, então não aparece faixa. O gráfico fica na faixa do meio, com o topo livre para o título e a base livre para as fichas.

**K0 mobile.** No "expandir imagem" do Dreamina:
- suba `takes/take1-inicio.png` e escolha 9:16, com a imagem na **parte de baixo do meio** (a `k0-mobile-base.png` mostra a posição: faixa de y 900 a 1508);
- salve o resultado como `chaves-mobile/k0-mobile.png`;
- prompt da expansão:

```
Extend the scene seamlessly: the same deep imperial purple textured background with thin dotted gold orbit lines and small gold dots; complete the top of the marble bust's curly hair above; below, continue the cracked marble neck and shoulder with the gold circuitry. Same lighting and grain. No text, no new objects.
```

### Gerações (4 takes novos)

| Take | Formato | Início → fim | Duração | Prompt |
|---|---|---|---|---|
| 2 | desktop | `take2-inicio` → `take2-fim` | 5 s | "Take 2 desktop (Dreamina)", acima |
| 1 | celular | `k0-mobile` → `k1-mobile` | 10 s | "Take 1 mobile", acima |
| 2 | celular | `k1-mobile` → `k2-mobile` | 5 s | "Take 2 desktop" + `Vertical 9:16. The camera pulls back slightly while trucking right.` |
| 3 | celular | `k2-mobile` → `k3-mobile` | 5 s | "Take 3 mobile", acima, trocando "camera completely still" por `the camera slowly pushes in toward the portraits` |

Os takes 1 e 3 do desktop continuam os do Flow (`takes/take1-flow.mp4`, `takes/take3-flow.mp4`).

**Ao baixar:** pegue em 1080p, se houver, e salve com nomes fáceis: `take2-dreamina.mp4`, `take1-m.mp4`, `take2-m.mp4`, `take3-m.mp4`. A conferência fica comigo: a emenda medida quadro a quadro, linhas quebradas, o branco e os trechos parados.

## Linhas com sentido e fichas (19/11, substitui K2, K3 e a tabela de gerações acima)

O gráfico do Flow era decorativo: 4 linhas sem eixo, retratos no meio das linhas. Agora ele conta uma história que a página consegue explicar.

**O que o gráfico mostra.** Um turno de verdade, das 06:00 às 15:48, com a pausa do almoço como uma faixa clara. A linha tracejada é o **padrão** (80%): o "trabalho padronizado" da citação do Ohno. A 4ª linha do Flow vira esse padrão. As 3 linhas cheias são 3 pessoas, cada uma com um desenho próprio:

| Linha | Pessoa | Desenho | O que conta |
|---|---|---|---|
| sobe constante | Ana Ribeiro, Torneamento | cruza o padrão às 10h15 e não volta | o Spectra viu uma troca de ferramenta mais rápida e validou como padrão |
| oscila em volta do padrão | Marcos Teixeira, Montagem (22 anos) | zigue-zague estreito em cima da tracejada | ele **é** a referência: o padrão foi aprendido com o jeito dele |
| sobe em degraus | Lucas Prado, Inspeção (8 meses) | escada, abaixo do padrão | está aprendendo; cada degrau é um comportamento validado |

O anel vazado em cada linha marca o momento da validação, e o mesmo anel aparece na ficha, ao lado da frase que explica o que aconteceu. As pontas das linhas ficam a 60% da largura: os 40% da direita são da ficha no desktop.

**Maquete:** `maquete/index.html` (sirva a pasta com `python -m http.server 8765`). Parâmetros: `?f=desktop|mobile`, `&k=2` (gráfico) ou `&k=3` (retratos), `&p=ana|marcos|lucas` (ficha aberta). Capturas: `maquete/ficha-desktop-*.png` e `maquete/ficha-mobile-*.png`.

**A ficha (HTML, nunca no vídeo).** Uma por vez, a da pessoa em foco, trocada pelo scroll. Nome em Kepler, posto e turno em Archivo, e três números lado a lado: Produtividade (com a diferença para o padrão), Retorno (R$ recuperados no mês) e Tempo de casa (com o ano de entrada). Embaixo, uma nota em Limestone com o anel do gráfico e o que o Spectra viu. Rodapé: "Exemplo ilustrativo" e os 3 traços de progresso. No desktop um fio liga o retrato à ficha; no celular a ficha fica embaixo do gráfico e o retrato ativo ganha um anel mais grosso.

### Quadros-chave novos

| Chave | Desktop 1280×720 (`chaves-desktop/`) | Celular 1080×1920 (`chaves-mobile/`) |
|---|---|---|
| K1 colagem no branco | `k1-desktop.png` (o `take2-inicio` com o branco fechado em #fff) | `k1-mobile.png` |
| K2 gráfico pronto | `k2-desktop.png` | `k2-mobile.png` |
| K3 retratos | `k3-desktop.png` (referência do código) | `k3-mobile.png` (referência do código) |

K2 e K3 saem da maquete (`?k=2` e `?k=3`, sem `p`), então o último quadro do vídeo é exatamente o gráfico que o código conhece: a posição de cada ponta é a mesma conta do SVG, e o retrato e a ficha caem certos em cima dela.

### Por que o take 3 virou código

Os retratos e as fichas precisam estar nítidos, no lugar exato e sincronizados com o scroll. No vídeo os rostos saem moles, não dá para trocar a pessoa sem gerar de novo e o rosto não casaria com a ficha. No código: o último quadro do take 2 fica parado, os retratos (`maquete/rosto-*.png`) abrem dentro dos anéis das pontas e a ficha entra ao lado. São 2 gerações a menos.

### Gerações (3 takes no Dreamina)

| Take | Formato | Primeiro quadro → último | Duração |
|---|---|---|---|
| 2 | desktop | `chaves-desktop/k1-desktop.png` → `chaves-desktop/k2-desktop.png` | 5 s |
| 1 | celular | `chaves-mobile/k0-mobile.png` → `chaves-mobile/k1-mobile.png` | 10 s ("Take 1 mobile", acima) |
| 2 | celular | `chaves-mobile/k1-mobile.png` → `chaves-mobile/k2-mobile.png` | 5 s |

O take 1 do desktop continua o do Flow (`takes/take1-flow.mp4`). Nomes ao baixar: `take2-dreamina.mp4`, `take1-m.mp4`, `take2-m.mp4`.

**A mudança que tira o defeito dos 8 s:** no Flow as linhas *se transformavam* em gráfico e quebravam em pedaços soltos. Agora elas são **desenhadas da esquerda para a direita, como a pena de um plotter**: a linha só existe até onde a pena passou, então não tem o que quebrar.

**Take 2 desktop (16:9):**

```
Clean editorial motion graphic on a pure white background. The camera trucks smoothly to the right and the marble bust leaves the frame on the left. The thin gold lines coming out of the bust keep going and are drawn progressively from left to right, like a plotter pen tracing a chart: one line climbs steadily, one oscillates in small zigzags right on top of a fine dashed gold reference line, one rises in small steps like a staircase. Small gold dots appear on each line exactly as the pen passes them. Faint grey hairline gridlines and one very pale beige vertical band fade in behind. Every line stays continuous: it never breaks into loose segments, never splits, never multiplies. Flat 2D, thin precise strokes, no glow, no particles, no text, no numbers, no labels, no people. End exactly on the reference last frame.
```

**Take 2 celular (9:16):** o mesmo prompt, trocando a primeira frase do movimento por `The camera trucks right and tilts slightly up; the bust leaves the frame on the left.` e acrescentando `Vertical 9:16.`

**Negativo (se o Dreamina tiver o campo):** `text, numbers, labels, broken lines, extra lines, glow, sparks, 3D, people, faces, cards`

Se mesmo assim quiser o take 3 em vídeo (não recomendo), use `k2` → `k3`, 5 s, câmera parada:

```
Pure white background, the finished gold line chart stays perfectly still. At the end of each of the three solid gold lines a small gold ring opens and a circular portrait photo fades in inside it: top line a young woman with glasses, middle line a bearded older man, bottom line a young man in a cap. Thin white and gold rings around each portrait. Camera completely still, nothing else moves. No text, no cards.
```

### Para decidir com a Carol

1. **"Retorno" na ficha.** Proposta: R$ de tempo produtivo recuperado no mês, pela diferença para o padrão × custo da hora. Ou trocar por outro número que a plataforma realmente mostre.
2. **Por pessoa ou por posto.** A ficha mostra nome e tempo de casa. Se o cliente não quiser expor pessoas, a mesma ficha funciona com o posto ("Torno 3 · Turno 1") e o retrato vira a foto do posto.
