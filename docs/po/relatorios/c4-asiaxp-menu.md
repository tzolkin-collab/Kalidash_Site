# Auditoria do menu do asiaxp.co (item 16 da lista do dono)

Data: 2026-11-03. Referência pedida pelo dono para a entrada e o menu. Medido no Chrome do dono (plugin Claude in Chrome), abrindo `https://asiaxp.co/` e clicando no botão "Menu". As animações abaixo foram lidas de `document.getAnimations()` no instante do clique, então os tempos, atrasos e curvas são os reais do site, não estimados a olho.

**ATENÇÃO: a medição que vale para o Kalidash é a do CELULAR (seção "Medição no celular" no fim).** A primeira passada, mais abaixo, foi feita sem querer em desktop (o plugin do Chrome não emula celular) e fica só como contexto. A do celular foi refeita no navegador integrado, em 375×812 com agente Android (Pixel 8), abrindo E fechando o menu.

**Limites**
- Os quadros são capturas durante a animação, não um vídeo contínuo. Desktop: [1](../design/refs/asiaxp-menu-1-abrindo.jpg), [2](../design/refs/asiaxp-menu-2-linhas-e-itens.jpg), [3](../design/refs/asiaxp-menu-3-aberto.jpg). Celular: [antes](../design/refs/asiaxp-mobile-1-antes.jpg), [painel entrando](../design/refs/asiaxp-mobile-2-painel-entrando.jpg), [aberto](../design/refs/asiaxp-mobile-3-aberto.jpg), [fechando](../design/refs/asiaxp-mobile-4-fechando.jpg).
- A abertura de entrada do asiaxp (logo que se revela por máscara horizontal, antes do site) foi só vista, não medida.

## (Contexto) O que acontece ao abrir em DESKTOP (t = 0 no clique)

| O quê | Movimento | Duração | Atraso | Curva |
|---|---|---|---|---|
| Painel do menu (tela inteira, laranja) | `translateX(-100%)` para `0` | 800 ms | 0 | `cubic-bezier(0.215, 0.61, 0.355, 1)` (ease-out cúbica) |
| Botão hambúrguer vira X | barras de cima e de baixo giram ±45°; a do meio some | 400 ms (giro), 200 ms (opacidade) | 0 | `ease-in-out` |
| Cor do botão e do cabeçalho | branco para preto | 200 ms | 0 | `ease-in-out` / `ease-out` |
| Linhas verticais da grade | `scaleY(0)` para `1` | 800 ms | 250 ms | `cubic-bezier(0.645, 0.045, 0.355, 1)` (ease-in-out cúbica) |
| Linhas horizontais (borda de cada item) | `scaleX(0)` para `1` | 800 ms | 100 ms | a mesma ease-in-out cúbica |
| Título de cada item (SOBRE, PROJETOS...) | `scaleY(0)` para `1`, como uma máscara que sobe | 600 ms | 250 ms | ease-in-out cúbica |
| Seta de cada item | opacidade 0 para 1 e `translateX(-46px)` para `0` | 600 ms | 200 ms | ease-out cúbica |
| Redes sociais, busca | `translate` + opacidade | 600 ms | 300 ms | ease-out cúbica |
| Formulário "Hello" e botão Enviar | `translate` + opacidade | 600 ms | 400 e 450 ms | ease-out cúbica |

## Leitura de desenho

1. **Uma só ideia forte:** o painel cobre tudo de uma vez, com uma cor sólida de marca, e só depois a "arquitetura" do menu se desenha dentro dele.
2. **A grade se desenha sozinha:** as linhas finas crescem de zero (horizontais da esquerda para a direita, verticais de cima para baixo). Os textos aparecem por máscara, sem fade longo.
3. **Defasagem curta e em cascata:** nada espera o anterior terminar. Os atrasos vão de 100 a 450 ms e as animações se sobrepõem, o que dá a sensação de fluidez.
4. **Duas curvas só:** ease-out cúbica para entrar e ease-in-out cúbica para desenhar. Sem `linear` e sem a curva padrão do CSS.
5. **O ícone participa:** o hambúrguer vira X no mesmo instante, com a cor invertida para ler sobre o painel.

## Tradução para o Kalidash (menu mobile) — versão inicial, ver a seção do celular abaixo

- Painel Imperial (#28183b) entrando da MESMA direção do menu atual do Kalidash, em 800 ms com `cubic-bezier(0.215, 0.61, 0.355, 1)`.
- Hairlines douradas (#a88a58) que se desenham (`scaleX` nas bordas de cada item, delay 100 ms; `scaleY` nas verticais, se houver) com `cubic-bezier(0.645, 0.045, 0.355, 1)`.
- Itens do menu em Limestone (#f1ece4), revelados por máscara a 250 ms, com a seta entrando a 200 ms.
- Botão: hambúrguer vira X em 400 ms.
- Fechamento: espelhar a abertura em ~60% do tempo (não medido na referência).
- A transição de página do item 15 usa as mesmas duas curvas, para o menu e a troca de página parecerem o mesmo sistema.

Tudo só com `transform` e `opacity`, desligado em `prefers-reduced-motion`.


## Medição no celular (375×812, a que vale)

Lida de `document.getAnimations()` ao clicar em "Menu" e de novo ao fechar. No celular o menu é o mesmo painel laranja de tela inteira: uma faixa vertical à esquerda ("THE EXPERIENCE CO.") fica fixa, o painel entra cobrindo a página, e dentro dele a lista de itens (SOBRE, PROJETOS, NOVIDADES, LOJA, LADO B, CULTURA), os links sociais e o idioma. Os itens aparecem empilhados com borda fina entre eles e uma seta à direita.

### Abertura (celular)

| O quê | Movimento | Duração | Atraso | Curva |
|---|---|---|---|---|
| Painel | entra da esquerda (`translateX`) | **600 ms** (no desktop eram 800) | 0 | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| Hambúrguer vira X | barras ±45°, a do meio some | 400 / 200 ms | 0 | `ease-in-out` |
| Cor do botão e do cabeçalho | invertem | 200 ms | 0 | `ease-in-out` / `ease-out` |
| Bloco da lista | `scaleY(0)` para `1` | 800 ms | 250 ms | `cubic-bezier(0.645, 0.045, 0.355, 1)` |
| Borda de cada item | `scaleX(0)` para `1` | 800 ms | 100 ms | a mesma ease-in-out cúbica |
| Texto de cada item (máscara que sobe) | `transform` | 800 ms | **cascata de 100 ms por item** (200, 300, 400, 500...) | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| Seta de cada item | opacidade + `translateX(-46px)` para `0` | 600 ms | cascata de 100 ms (200, 400, 500, 600, 700...) | `cubic-bezier(0.215, 0.61, 0.355, 1)` |

Tempo até tudo parado: cerca de 1,4 s. Mas o painel já cobre a tela aos 600 ms e a leitura começa por volta de 700 ms.

### Fechamento (celular), não medido na primeira passada

O fechamento NÃO é o espelho da abertura. A ordem se inverte e o conteúdo some ANTES do painel:

| O quê | Movimento | Duração | Atraso | Curva |
|---|---|---|---|---|
| Lista, textos, setas, bordas, busca, formulário | recolhem | **400 a 600 ms** | 0 (bordas 200) | `cubic-bezier(0.645, 0.045, 0.355, 1)` |
| Hambúrguer volta de X | giro de volta | 400 ms | 0 | `ease-in-out` |
| Painel | sai | **800 ms** | **400 ms** | `cubic-bezier(0.645, 0.045, 0.355, 1)` |
| Cores do botão voltam | | 200 ms | 600 ms | `ease-out` |

Total do fechamento: cerca de 1,2 s (conteúdo recolhe em 0,5 s e o painel sai em seguida, começando a 0,4 s).

### O que isso ensina para o Kalidash

1. **Abrir: painel primeiro (600 ms, ease-out), conteúdo depois, em cascata.** Os itens se desenham enquanto o painel ainda termina de entrar (atraso de 100 a 250 ms), sem esperar.
2. **Fechar: conteúdo recolhe primeiro (400 a 600 ms), painel sai por último**, com ease-in-out e 400 ms de atraso. Não espelhar a abertura.
3. **Cascata de 100 ms por item** é o que dá o efeito de fluidez; sem ela as linhas parecem aparecer de uma vez.
4. **Mesmas duas curvas em tudo:** ease-out cúbica para entrar e ease-in-out cúbica para desenhar e para sair.
5. Para o Kalidash ficar **mais rápido que o asiaxp** (pedido do dono para a transição de página): comprimir tudo em ~70%: painel 420 a 480 ms, cascata de 60 a 70 ms por item, fechamento em ~0,8 s no total.
