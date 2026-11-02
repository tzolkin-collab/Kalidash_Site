# C3 Auditoria final — HEAD `13853c9` (páginas internas, Home e Blog)

Data: 02/11/2026. Pacote: C3 (só leitura em `apps/`). Base de comparação: C1 (`a003d5c`, copy e Web Vitals) e C2 (`9bf172f`). O HEAD auditado é o `13853c9`, que inclui B0 (`770a667`, `1eaac95`), B5 (`b9b0898`) e B8 (`f750e08`, `b89e034`, `46d6180`, `db23d27`, `afe31be`). B9 foi pausada e revertida. `apps/site` estava limpo no início.

Ambiente: `next build` isolado em worktree temporário, servido na porta 3210, com servidor falso do blog na 8210 (fora do repo). Nenhuma conexão à API real nem ao `.env`. Nenhuma medição contra produção.

## Parte 1 — baseline de copy regenerada

- Commit `5dcc704` (`docs(po): baseline de copy regenerada (HEAD, decisoes D22-D26)`): `copy-diff.mjs` ganhou a rota `/` (Home, `home.txt`) e a baseline foi regenerada com `--save` a partir do build de `13853c9`.
- ⚠️ **Limite:** uma baseline gerada a partir do mesmo HEAD não pode dar diferença contra ele. Por isso o "copy-diff limpo" da Parte 2 é verdadeiro mas sem valor de auditoria. A auditoria de copy de verdade é a comparação contra a C1 (seção 2.2).

## Parte 2 — auditoria

### 2.1 Copy-diff contra a baseline regenerada

✅ Mecanicamente: 11 de 11 rotas `OK`, exit 0 (`/`, `/sobre-nos`, `/treinamento-corporativo-ia`, `/advisory`, `/execucao`, `/solucoes`, `/kognis`, `/spectra`, `/diagnostico`, `/blog`, `/blog/artigo-1`). Como explicado acima, esse resultado não prova nada sobre o HEAD.

### 2.2 Copy contra a C1 (o que mudou de fato)

Lista do que o texto visível do `<main>` tem hoje a mais ou a menos que o C1. Itens marcados "decisão" seguem as decisões do dono aceitas no C3 (Kognis só hero; 6 descrições de /solucoes voltaram; numerais 01/02/03 removidos; CTAs repetidos e depoimentos novos da Home ficam).

- **`/sobre-nos`**: caixa-alta no título "DO CHÃO DE OPERAÇÃO…" (só CSS).
- **`/treinamento-corporativo-ia`**: caixa-alta nas turmas; os dois-pontos sumiram de 4 frases, que viraram duas linhas ("Trilhas por área: conteúdo…" → "Trilhas por área" / "conteúdo…"); novo "O resultado não aparece no certificado. Aparece no trabalho." e novo CTA "Solicitar proposta". ⚠️ Os dois-pontos sumidos e a frase nova não estão claramente na decisão; confirmar.
- **`/advisory`**: "01/02/03" removidos (decisão); novo CTA "Conversar com um sócio" (decisão).
- **`/execucao`**: caixa-alta em duas linhas; "01/02" removidos (decisão); novo CTA "Falar sobre o meu projeto" (decisão).
- **`/solucoes`**: as 6 descrições de card voltaram (decisão). Mas "Tecnologia que nasce de problemas reais" aparece quebrada em três linhas e "01 · KOGNIS" / "02 · SPECTRA AI" perderam o separador "·" (passa a "01" e "KOGNIS" em linhas separadas). Novos: "Quando isso acontece, a gente constrói." e "Falar sobre o meu caso" (CTA, decisão).
- **`/kognis`**: página reduzida ao hero (decisão D23). Saem: os 3 números de impacto, a seção das três soluções (títulos, descrições e itens), a seção "Atendimento inteligente", "Controle financeiro", "Como funciona" (3 passos) e o FAQ. ⚠️ Isso é perda grande de copy, aceita pela decisão, mas não estava em nenhuma linha da decisão desta auditoria como "perder o FAQ"; o dono precisa confirmar que o FAQ e as soluções saem de fato, ou que ficam fora da página.
- **`/spectra`**: caixa-alta na frase de abertura; "01/02/03" removidos (decisão); novos "A operação fala e o Spectra AI traduz." e "Conhecer Spectra AI".
- **`/diagnostico`**: igual à C1. ⚠️ **Ponto cego:** a baseline da C1 só cobre o passo 1 do formulário. A B5 (`b9b0898`) mexeu na "régua de 3 passos" e na "lista de objetivos", que não estão cobertos pelo copy-diff. Não é possível afirmar que o texto dos passos 2 e 3 está íntegro.
- **`/blog`**: igual à C1.
- **`/blog/artigo-1`**: sumiu "TE" (iniciais de avatar do autor).
- **Home (`/`)**: sem baseline na C1. Contra o estado de `a003d5c` (medido na C2), os depoimentos mudaram, com nomes e empresas novos. Decisão do dono: depoimentos novos da Home ficam. ⚠️ A decisão aceita o conteúdo; a origem dos depoimentos (sem fonte no repo) continua sem documentação, e isso fica registrado aqui.

**Resumo:** nenhuma página mantém o texto da C1 byte a byte. As mudanças são de duas naturezas: decisões do dono (conteúdo removido ou acrescentado) e casos que não estão em nenhuma decisão (dois-pontos sumidos, separador "·" removido, frase quebrada em linhas, "TE" no artigo). Os dois últimos precisam de confirmação.

### 2.3 Web Vitals (mediana de 3, HEAD `13853c9`, isolado, na porta 3210)

Comparado com `docs/po/relatorios/webvitals-baseline.json` (C1).

| Rota | Móvel LCP C1 → HEAD | Móvel TBT | Perf móvel | Desktop LCP C1 → HEAD |
|---|---|---|---|---|
| /sobre-nos | 4046 → 3608 (−438) | 70 → 45 | 87 → 90 | 822 → 868 (+46) |
| /treinamento-corporativo-ia | 3624 → 3514 (−110) | 64 → 37 | 90 → 91 | 753 → 717 (−36) |
| /advisory | 3528 → 3507 (−21) | 71 → 36 | 90 → 91 | 697 → 1017 (+320) ⚠️ |
| /execucao | 3718 → 3727 (+9) | 74 → 64 | 89 → 89 | 693 → 749 (+56) |
| **/solucoes** | 3221 → **4844 (+1623)** ❌ | 41 → **116** | 93 → **82** | 677 → 932 (+255) ⚠️ |
| /kognis | 3479 → 3542 (+63) | 38 → 51 | 91 → 90 | 744 → 707 (−37) |
| **/spectra** | 3227 → **4815 (+1588)** ❌ | 40 → **99** | 93 → **82** | 772 → 738 (−34) |
| /diagnostico | 3179 → 3177 (−2) | 75 → 81 | 93 → 93 | 584 → 570 (−14) |
| /blog | 3001 → 2984 (−17) | 45 → 33 | 94 → 95 | 638 → 625 (−13) |
| /blog/artigo-1 | 3213 → 3132 (−81) | 40 → 34 | 93 → 93 | 662 → 665 (+3) |
| / (Home) | sem baseline | 68 | 82 | sem baseline (986) |

- **Repetição das duas regressões móveis:** `/solucoes` (3 execuções: 4847 ms) e `/spectra` (4370 ms) e Home (4445 ms) foram rodadas de novo. A regressão se mantém. O elemento de LCP mudou em `/solucoes` e `/spectra` (agora é um `<i>`/imagem; antes era `<h1>`).
- **Critério 3.2 (LCP, TBT e CLS não piores que a baseline): ❌ reprovado em `/solucoes` e `/spectra`** no mobile. Em relação à C2 (`9bf172f`), `/solucoes` mobile também piorou (3611 → 4844 ms); o commit `46d6180` (fetchPriority no busto, para LCP móvel) não produziu melhora nesta medição.
- Desktop: `/advisory` (+320 ms) e `/solucoes` (+255 ms) não foram repetidos; ⚠️ não conclusivo.
- Metodologia: simulado (padrão), TBT no lugar de INP, mediana de 3. O disco ficou cheio durante a auditoria (ver seção 5); a cadeia de Lighthouse terminou antes disso.

### 2.4 CLS (cls.mjs, 844 px de altura)

✅ 33 de 33 medidas. Todas com CLS 0,000, exceto `/blog` a 1440 com 0,003 (igual à C1) e `/treinamento-corporativo-ia` a 900 com 1 deslocamento de valor desprezível (total 0,000). Dentro do limite de 0,1.

### 2.5 Rolagem horizontal e erro de console (1440, 1024, 768, 390)

✅ 44 de 44 combinações (11 rotas × 4 larguras). `scrollWidth == clientWidth` em todas (sem rolagem horizontal). Nenhum erro de console nem exceção durante o carregamento. `h1` presente e único em todas as rotas. Limite: a captura cobre o carregamento, não interações (menus, FAQ abertos).

### 2.6 Capturas reais (1440 e 390) — `docs/po/relatorios/c3-final/`

✅ 22 PNGs (11 rotas × 2 larguras), capturadas com `design-craft/scripts/shot.mjs`, seletor `main`, altura 900. ⚠️ Vários arquivos têm altura exatamente 6000 px (Home 1440 e 390; `/execucao` 390): provável corte do script, não da página. Não recapturei.

### 2.7 Contrato `data-*` do blog

✅ Renderizado: os atributos `data-block`, `data-role`, `data-variant`, `data-focus` e `data-block-id` aparecem com os mesmos valores em `/blog`, `/blog/artigo-1` e `/blog/categoria/cases`, igual ao snapshot da C2.

- No código: contagens subiram (`data-block` 26→29, `data-role` 38→62, `data-variant` 18→32, `data-focus` 17→18). Nenhum valor documentado em `docs/blog-design-contrato.md` deixou de existir, exceto `data-role="chip"`, que nunca existiu no código (nem em `a003d5c`, nem no HEAD): lacuna anterior, não regressão.

## 3. Os commits B0 e B5 (pedido do C3 e do dono)

- **`770a667` (B0, "teto nos lemas, cabeçalho sólido, tokens")**: só CSS (`sobre-nos.module.css`, `kit.module.css`, `product.module.css`, `solucoes.module.css`). Sem mudança de texto.
- **`1eaac95` (B0, "estátua do hero da Home alinhada")**: 2 linhas em `HomeHero.module.css`. Sem mudança de texto. ⚠️ Toca a Home, o que a regra 3.3 proíbe sem aval; o aval não está documentado.
- **`b9b0898` (B5, "diagnóstico em moldura warm|paper, régua de 3 passos e lista de objetivos")**: muda estrutura e visual do `/diagnostico`. O copy-diff não cobre os passos 2 e 3 (ver ponto cego em 2.2). Precisa de baseline completa do formulário antes de aceitar.
- **B8 (`f750e08`, `b89e034`, `46d6180`, `db23d27`, `afe31be`)**: é o pacote que reduz `/kognis` a hero e restaura as descrições de `/solucoes`. As regressões de LCP de `/solucoes` e `/spectra` (seção 2.3) estão nesse intervalo de commits; a causa não foi isolada.

## 4. Riscos

1. **Regressão de LCP móvel** em `/solucoes` e `/spectra` (critério 3.2 reprovado), reproduzida em 3 execuções.
2. **Copy** com perdas grandes em `/kognis` (FAQ e soluções, além do hero) e alterações sem decisão (dois-pontos, separador, "TE").
3. **Diagnóstico**: 2 de 3 passos sem baseline; B5 não auditada no copy.
4. **Home**: mudanças visuais e de texto (depoimentos) com aval de decisão, sem fonte documentada; regra 3.3 não se cumpre.
5. **Capturas** com possível corte em 6000 px.

## 5. Incidente de disco (importante)

- O volume `C:` ficou sem espaço livre durante a auditoria (0 bytes), causado pelos perfis temporários de Chrome e Lighthouse e pelos builds em `scratchpad`. Uma tentativa de limpar perfis em `%TEMP%` foi **negada pelo classificador de segurança** ("Shared Scratch Sweep") e não foi repetida.
- Para liberar espaço, removi apenas o que é meu: uma pasta duplicada de medição (`scratchpad/lh2`, com os resultados preservados em `scratchpad/c3/keep`) e o worktree do HEAD (`scratchpad/c3/wt`) depois das capturas. Os servidores 3210 e 8210 foram parados. O servidor 3199 (outra sessão) e os servidores 3000, 5173 e 8080 não foram tocados.
- **O dono precisa liberar espaço em `C:`** (perfis temporários órfãos em `%TEMP%`: `lighthouse.*`, `shot-*`, `cls-*`, `copy-*`, `c2oc-*`). A medição de Lighthouse e a gravação de capturas dependem disso.

## 6. O que o dono precisa fazer

1. Decidir sobre a regressão de LCP mobile de `/solucoes` e `/spectra`: investigar ou aceitar com registro.
2. Confirmar se o FAQ e as soluções de `/kognis` saem de vez (decisão D23 diz "só hero").
3. Confirmar a origem dos depoimentos da Home (Iasmin Ramiro, Fernando Torquetti, Geraldo Nunes, Daniel Alves, Larissa Gomes) e da mudança visual da Home.
4. Confirmar os dois-pontos sumidos em `/treinamento-corporativo-ia` e o "TE" em `/blog/artigo-1`.
5. Pedir baseline completa de `/diagnostico` (3 passos) antes de aceitar a B5.
6. Liberar espaço em `C:`.

## 7. Veredito

❌ **Não aceito como C3 limpa.** Reprovado nos itens de Web Vitals (LCP móvel de `/solucoes` e `/spectra`), no aceite de copy contra a C1 (mudanças sem decisão), e na Home (regra 3.3). Aprovado: CLS (33/33), overflow e console (44/44), contrato `data-*` do blog.

## Commits

- Parte 1: `5dcc704` (baseline de copy regenerada).
- Parte 2: este relatório e `docs/po/relatorios/c3-final/` (22 capturas).
