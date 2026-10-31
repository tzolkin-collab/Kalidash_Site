# D0 — Sistema das páginas internas (proposta)

> Designer D0. Só direção; nada em `apps/site` foi tocado. Tokens em [tokens.css](tokens.css).
> Base: leitura de `home/home.module.css`, `institucional/{SitePage.tsx,pages.ts,institucional.module.css}` (inclusive as alterações não commitadas de outra sessão) e capturas reais em `antes/`.

## 1. O que o sistema faz (uma frase)

As internas hoje repetem uma receita (eyebrow + título à esquerda + corpo à direita, e caixas com sombra). O sistema troca **caixas por régua**: estrutura vem de hairline, escala de tipo e espaço; cada seção tem **um objeto** (foto, número ou diagrama de sequência); cor de marca só onde o olho precisa parar.

## 2. O que herdamos da Home (e não muda)

| Token da Home | Valor | Papel aqui |
|---|---|---|
| `--ink` | `#28183b` | títulos de seção, numerais |
| `--accent` | `#b6644d` | botão (preenchimento) e texto grande |
| `--black-1` | `#0e0e0e` | a faixa escura (prova), igual ao rodapé |
| `--line` | `#ececec` | hairline padrão |
| `--container` | `min(1280px, 100% - 48px)` | largura de todo conteúdo |
| `--font-title` | Inter | títulos, numerais |
| corpo | Source Sans 3 | texto corrido |
| botões | raio 4px, 56px, `primaryButton`/`secondaryButton` | CTAs não mudam |
| h2 da Home | 55px / -0.04em | teto de `--t-h2` |

## 3. Decisões do sistema

**Tipografia.** 5 níveis fluidos + numeral: display, h1, h2, h3, lead, corpo 18, small 15, meta 13. Peso 500 nos títulos (como a Home), tracking -0.04 a -0.05em acima de 40px. Caixa-alta só no `meta` de 13px (a Home já faz). Numerais com `font-variant-numeric: tabular-nums`. Três níveis de cinza: `text-1` (preto), `text-2` `#3c373f`, `text-3` `#6b6670`. Hoje há `#3c373f`, `#514c53`, `#6b6670`, `#3c3c3c` e outros (5 cinzas).

**Contraste (achado).** O `--accent #b6644d` sobre branco dá **4,3:1** (cálculo meu pela fórmula WCAG, não medido por ferramenta): reprova AA para texto abaixo de 24px. Hoje é usado em eyebrow 13px, `textLink` 18px, índice dos cards 12px. Proposta: `--c-brand-text #a4533c` (5,4:1) para texto pequeno; `--accent` fica para botão e texto >= 24px.

**Espaçamento.** Escala 8pt (`--s-1..8`). Toda seção usa `--pad-y` (64→128). Título -> conteúdo usa `--head-gap` (32→64): hoje a distância título→cards chega a ~150px em `/kognis` (lida na captura 1440), o que lê como vazio.

**Raio e sombra.** Uma família: 4px (controles) e 12px (fotos). Hoje existem 4, 6, 8, 10, 12 e 999px, mais `0 2px 10px`, `0 4px 16px`, `0 12px 28px` e `0 12px 32px`. Proposta: **sombra só na foto-herói** (`--shadow-lift`); o resto é hairline.

**Papéis de cor e ritmo de seção.** Quatro fundos, por função:
- `paper` (branco): padrão, a maior parte da página;
- `warm` `#faf8f7`: uma pausa editorial por página no máximo (hoje já existe no AI Culture e nos passos);
- `band` `#0e0e0e`: **uma** por página, é a prova/credenciais (hoje só o `proof` do Sobre nós);
- `photo-full`: foto sangrando com a mesma largura do container, sem fundo roxo atrás.
Sem alternar claro/escuro como ritmo (tell). A faixa roxa `#2a1840` dos cards (formats, showcase, texto destaque) sai: roxo vira só cor de título (`--ink`).

**Grade.** 12 colunas no container de 1280. Só três composições: 5/7 (título | corpo), 4/8 (rótulo | tabela), 7/5 (hero com retrato). Toda seção cai numa delas ou em largura total.

**Movimento.** Só `opacity` e `transform`, sem entrada escalonada. Regra: o conteúdo é **visível por padrão**; nenhum bloco de texto, card, passo ou lista usa `Reveal`. Exceções (uma por página, no máximo): a linha dos passos desenha uma vez (`scaleX`, 600ms) e o hover de link muda cor/sublinhado. Hover de card `translateY(-4px)` com sombra sai (tell). `prefers-reduced-motion` desliga tudo.

## 4. Modos de cabeçalho de seção (para não repetir a receita)

A receita "eyebrow empilhado + h2 grande à esquerda + corpo cinza à direita" é **um** dos modos e só pode aparecer onde a seção é de leitura. Os outros:

| Modo | Estrutura | Onde |
|---|---|---|
| **H-Afirmação** | h2 sem eyebrow, 5 colunas; corpo em 7 | `text` (Advisory, Execução, AI Culture) |
| **H-Legenda** | o eyebrow vira legenda **na mesma linha da hairline** (`meta` à esquerda, filete até a borda), h2 vem logo abaixo, largura total | `cards`, `steps`, `showcase`, `formats` |
| **H-Numeral** | o numeral é o título visual (`--t-figure`), o texto vem como legenda | `proofBar`, `proof` |
| **H-Sem** | nenhum cabeçalho: a seção abre com a foto ou com a frase | `heroMedia`, `team`, `highlight` |
| **H-Tabela** | h2 em 4 colunas à esquerda, **sticky**, linhas ruled à direita | `faq`, `list`, `beliefs` |

Regra de página: no máximo 2 seções seguidas no mesmo modo; o eyebrow acima do h2 (a receita velha) só em hero.

## 5. Tabela bloco -> tratamento

Cada tipo de `SitePage` ganha **um** tratamento. Nenhum texto muda; só estrutura/CSS. “Objeto” = o que o olho encontra primeiro. Classes de hoje entre parênteses.

| Bloco | Tratamento | Objeto | O que sai |
|---|---|---|---|
| `hero` (Soluções) | **Manchete tipográfica.** H-Sem: h1 `--t-display` em até 10 colunas; lead em 6 colunas, alinhado à direita embaixo (nota de margem); CTA. Hairline fecha. Sem eyebrow empilhado (eyebrow vira `meta` sobre a manchete, linha única). | tipo (o título) | pad. de 120px vazio à direita |
| `heroMedia` `landscape` (Sobre nós, Advisory) | **Manchete + foto larga.** h1 em 8 colunas; foto na largura do container, 21:9 (desktop) / 4:3 (mobile), `--r-surface`, `--shadow-lift`; lead + CTA numa linha 5/7 **abaixo** da foto. | a foto | foto de 540px de altura ao lado do texto (50/50) |
| `heroMedia` `portrait` (AI Culture, Execução, Spectra) | **Retrato sangrando.** 7/5; foto alta 4:5 colada à borda direita do container, sem sombra de caixa (usa `--shadow-lift`), eyebrow como `meta`, `support` como linha de rodapé do bloco com hairline acima. | a foto | cartão com canto grande (`border-radius` assimétrico atual) |
| `heroMedia` `frame:none` (Kognis) | **Recorte vazado.** PNG sem moldura; fica alinhado à baseline do h1; sem sombra. | o recorte | — |
| `proofBar` | **Régua de números.** H-Numeral: faixa com hairline em cima e embaixo; cada métrica = numeral `--t-figure` + legenda `--t-small` embaixo; 2x2 no mobile. Logos (quando existirem) em linha única cinza, abaixo da régua. | o número | numeral de 28px ao lado da legenda; vão extra |
| `text` | **Afirmação.** H-Afirmação 5/7. `paragraphs` a 20px, medida `--measure`. `highlight` vira **frase-chave**: Inter 500 `--t-h2`, hairline em cima, largura 12 colunas, sem fundo e sem barra lateral. `chips` vira **lista ruled** em 2 colunas (numeral `--t-small` + frase, hairline entre linhas), sem pílula. | a frase-chave | `.highlight` (barra terracota + gradiente), pílulas |
| `cards` | **Três variantes, por conteúdo** (nenhuma é grade de caixas): **Tabela** (4 colunas: numeral \| título \| texto \| exemplo em `--c-text-3`, hairline entre linhas; usada onde há `example`); **Índice** (título em 4 colunas sticky à esquerda, itens como parágrafos com título h3 à direita, sem numeral); **Rituais** (3 linhas largas, título `--t-h3` 5 colunas + texto 7). O `closing` vira **nota de rodapé de tabela**: hairline forte, rótulo em negrito (`strong` já existe), sem caixa. | texto em linhas, numeral | caixa com sombra, hover que sobe, pílula de índice, `example` em caixa com barra |
| `steps` | **Linha de sequência.** Uma hairline horizontal com um ponto por passo (diagrama de ordem, não decoração); numeral `--t-figure-sm` acima, título h3, texto. Linha desenha uma vez (`scaleX`). Mobile: trilho vertical. `closing`: 1a frase Inter 500 `--t-h3`. | a linha | 3–4 caixas cinzas lado a lado |
| `list` | **Critérios ruled.** H-Tabela: título em 4 colunas sticky; itens a 22px, hairline entre linhas, tique fino (SVG 1,5px, `--c-brand-text`); `note` é a última linha; `noteLink` é `textLink`. | a lista em tipo | caixa por item com sombra, hover que desliza |
| `faq` | **Perguntas ruled.** H-Tabela; `details` com hairline, pergunta `--t-h3`, "+" que gira 45° (`transform`), resposta a `--measure`. JSON-LD intacto. | tipo | — (já é ruled; só escala e foco) |
| `offers` | **Painel por produto.** Cada oferta é uma seção inteira, 5/7: de um lado o objeto (foto/recorte), do outro título h2 + texto + **lista ruled** de `features` (título h3 + texto, 3 linhas) + link; numeral `--t-figure` "01"/"02" como índice (é a ordem real, não métrica). Lados alternam entre as duas ofertas. | foto do produto | fundo cinza + três mini-caixas |
| `proof` (Sobre nós) | **Faixa escura única.** `credentials` em H-Numeral (numeral `--t-figure-sm` branco + legenda), `items` em 2 colunas com nomes em `--t-h3`, `links` em linha com `textLink` claro; `closing` já não existe aqui. | os números | divisores verticais de 28px |
| `timeline` (Sobre nós) | **Três atos.** Colagem assimétrica de 8 fotos (uma retrato grande + 7 menores, alturas diferentes, alinhadas à grade) acima; três atos em linhas ruled: legenda `meta` (o `marker`/`title`), `lead` em `--t-h2` (a tese), parágrafos em 7 colunas. `quote`/`highlight` do ato 3 = **frase-chave** em largura total. | as fotos e a frase | trilho vertical com ponto, mosaico 2x4 igual |
| `beliefs` | **Credo.** H-Tabela invertida: 3 linhas largas; a crença em `--t-h2` (5 colunas) e o texto em 7; numeral `--t-small`. Sem caixas. | tipo | numeração minúscula solta |
| `team` | **Foto-manifesto.** H-Sem: foto 16:9 na largura do container logo abaixo do `h2` (7 colunas) + texto (5 colunas); legenda com fundadores em `--t-small`, links com sublinhado. | a foto do time | — (já é bom; só ritmo e escala) |
| `formats` | **Dois formatos em linhas.** A foto `metodo-reuniao.jpg` vira faixa full-bleed só atrás do cabeçalho (com véu escuro, texto branco, `--t-h2`); abaixo, cada formato é uma linha 3 colunas sobre `paper`: título+público | texto+features (lista ruled) | suporte+CTA. O 1º formato (primário) leva hairline forte e CTA cheio. Sem cartão roxo. | cartões roxo/branco sobre foto desfocada |
| `testimonials` | **Vídeo em destaque.** 1 depoimento = poster 16:9 em 7 colunas + nome/cargo/empresa em 5; 2 = duas linhas assim. Só renderiza quando há mídia (como hoje); sem espaço reservado vazio. | o vídeo | — |
| `showcase` | **Caso + índice.** Métricas = régua de números (`proofBar`). Caso em destaque: foto 7 colunas + texto 5 (título `--t-h2`, texto, `badge` como texto simples com hairline, link). Itens (Kognis, Spectra) = **duas linhas ruled** com numeral, nome, frase, seta; nada de cartão. | a foto do caso | cartão roxo sólido, 2 mini-cartões |
| `cta` | Hoje retorna `null`. Se for usado: faixa `band`, `h2` em `--t-h1`, botão primário; só uma por página e nunca junto da faixa `proof`. | — | — |

## 6. Regras que valem para todos os blocos

1. Nada de cartão em cartão; nada de 3+ caixas iguais. Colunas separadas por hairline contam como tabela só se o conteúdo for tabular (passos, métricas).
2. Barra lateral colorida some. A ênfase vem de tamanho de tipo e hairline.
3. Ícone nunca é protagonista. Onde a página não tem objeto real (Kognis, Spectra), o protagonista é número, frase ou a sequência dos passos (ver D1).
4. Imagens: `next/image` com dimensões; uma proporção por papel (21:9 hero largo, 4:5 retrato, 16:9 prova), mesmo raio, mesmo tratamento (sem filtro).
5. Foco visível 2px `--ink` com offset 3px; alvo de toque >= 44px; links com sublinhado no hover.
6. Rolagem horizontal nos trilhos do mobile (`formatCard`, `features`, `showcaseMetrics`) deixa de ser padrão: preferir empilhar.

## 7. O que o dev (B0) faz com isto

1. Colar `tokens.css` no topo de `.page`; trocar as 5 cinzas por `--c-text-1/2/3`, os raios por `--r-*`, as sombras por `--shadow-lift` ou nenhuma.
2. Apagar `.highlight`, `.closing` (caixas com barra) e o hover de subir; criar `.keyline` (frase-chave), `.ruled` (tabela) e `.rule-caption` (H-Legenda).
3. Remover `Reveal` dos blocos de leitura; manter só `steps` (linha) se aprovado.

## 8. Limites

- Verifiquei o sistema por capturas do estado atual, não por implementação: tokens e proporções são propostos, não testados em código.
- Valores de contraste são cálculo (fórmula WCAG), não medição com ferramenta.
- Fontes: assumo Inter + Source Sans 3 como já carregadas pelo `layout.tsx` (conferido no arquivo, linhas 13–15).
