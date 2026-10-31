# Relatório D2 + D3: direção do Diagnóstico e do Blog

> Designer. Só direção e protótipo: nada em `apps/` foi editado (conferido com `git status`; ver §3). Direção em [`design/02-diagnostico.md`](../design/02-diagnostico.md) e [`design/03-blog.md`](../design/03-blog.md); protótipos `07`, `08`, `09` em `design/proto/`.

## 1. Checklist

| Item | Estado | Evidência |
|---|---|---|
| Capturas "antes" do `/diagnostico`: todos os passos, erros e sucesso, 1440 e 390 | ✅ | `relatorios/antes/d2-d3/diag-1…10-*-{1440,390}.png` (9 estados + erro de envio). Vi em tamanho real: 1440 `p1`, `p1-erro`, `p3-erro`, `sucesso`, `envio-erro`; 390 `p1`. **Não revi** os demais PNGs (`p2`, `p2-erro`, `p3` em 390 etc.): foram gerados pelo mesmo script e o texto de cada estado bate com o texto lido (`copy-source/diagnostico-estados.txt`) |
| Capturas "antes" de `/blog`, `/blog/categoria/cases` e artigo, 1440 e 390 | ✅ | `blog-lista`, `blog-categoria-cases`, `blog-artigo`, `blog-artigo-semcapa` (página inteira) + `*-dobra-*` (viewport). Vi em tamanho real: lista 1440 e 390, categoria 1440, artigo (dobra 1440 e 390, página inteira 1440). **Não vi:** categoria 390, artigo sem capa. Nas páginas inteiras o **header fixo aparece no meio** (artefato de captura com `captureBeyondViewport`, não é bug do site: nas capturas de dobra ele está no topo) |
| Servidor falso do blog, fora do repo | ✅ | `relatorios/d2-d3-ferramentas/blog-fake-server.mjs` (7 artigos de teste, `POST` de lead com 200/500). **Cópia isolada** de `apps/site` fora do repo (webpack, `:3299`), porque o `next dev` da `:3000` é de outra sessão. Nada de produção, nenhum `.env` lido |
| Diagnóstico de "chapado" contra os tells | ✅ | `02-diagnostico.md` §1; `03-blog.md` §1. Valores de raio, cor e tamanhos **lidos no CSS** (e conferidos nas capturas) |
| Referências abertas de verdade (4 linhas, herdo/recuso, âncora) | ⚠️ | **Vi:** Stripe /contact/sales, cal.com (página de agendamento e home), Stripe /blog e /blog/product, Anthropic /news e um artigo. **Every:** abriu, mas a dobra é promoção de evento; a lista de ensaios não apareceu; **não serve de âncora** (dito em `03-blog.md` §2.4). Tamanhos das referências são **estimados a olho** nas capturas |
| Âncoras definidas | ✅ | Diagnóstico: Stripe /contact/sales (ritmo) + cal.com (contexto \| ação em uma moldura). Blog lista: Anthropic /news + Stripe /blog. Artigo: Anthropic (texto deslocado, ≈625px) |
| `02-diagnostico.md` por seção (papel, objeto, domina, próximo) | ✅ | §4 (8 linhas) |
| `03-blog.md` por seção + medida de leitura + hierarquia do corpo + capa | ✅ | §4.1, §4.2, §4.3 (tabela por elemento: `p`, `h2`, `h3`, `ul`, `ol`, `blockquote`, `figure`, `figcaption`) |
| Medida de leitura **medida**, não suposta | ✅ | `proto/measure-check.mjs` (`Range` por caractere): antes 93–96 caracteres/linha no 1440 (18,4px em 740px); depois 66–75 (20px em 616px). 390: ~50 → 40–46 |
| Protótipos HTML em 1440 e 390, vistos em tamanho real | ✅ / ⚠️ | `07` (1440: `p1`, `p1-erro`, `p3-erro`, `p3-ok`, `envio-erro`, `sucesso`; 390: `p1`, `p3-erro`, `p2-erro`, `sucesso`; 1024: `p3-ok`), `08` (1440: `todos`, `cat`, `stress-hero`; 390: `todos`, `um`, `vazio`, `cat`*; 1024: `todos`), `09` (1440 página inteira e dobra; 390 página inteira; 1024 dobra). *`08-cat-390` gerado, não revisto; `07` 390 de `p2`/`envio-erro` e 768 do 07 e do 09 não gerados como imagem |
| `copy-check.mjs` adaptado | ✅ | `proto/copy-check.mjs` agora aceita estados por hash, baseline de `copy-source/` e literais de vários arquivos do código. Saída abaixo. **Teste negativo feito** (trocar "Seus dados de contato" por "Seus dados pessoais" → `DIF`, `EXTRA: seus dados pessoais`; revertido) |
| `overflow-check.mjs` adaptado | ✅ | varre os estados por hash. **84/84 combinações sem overflow** (6 protótipos antigos + 07/08/09 em todos os estados × 390/768/1024/1440) |
| Contrato `data-*` do blog preservado | ✅ | `03-blog.md` §5: tabela atributo → elemento; `grep -oh 'data-[a-z-]*'` nos dois protótipos só traz atributos do contrato + `data-st/sec/fixture` (próprios do protótipo). `data-block-id` não está no protótipo (só existe no preview, no código atual) |
| Campos, ordem, rótulos, validação do formulário idênticos | ✅ | o `copy-check` lê o texto **real renderizado** de 8 estados (baseline `copy-source/diagnostico-estados.txt`): 0 extras |
| Restrições de sistema (raio 4/12, sombra só na foto-herói, `#a4533c` escopado, sem cartão em cartão, só opacity/transform) | ✅ | CSS dos 3 protótipos: raios 4 e 12; `--shadow-lift` só no destaque da lista e na capa do artigo; nenhuma animação (nenhuma `transition` nos protótipos). **Sem movimento nenhum** nesta direção (a barra de leitura continua a do código) |
| Console limpo / Web Vitals / interação real | ❌ não feito | protótipo estático: sem JS além de alternar estados por hash. Sem medição de LCP/CLS; sem teste de hover, foco, teclado e leitor de tela |

### Saída do `copy-check.mjs` (exit 0)

```
OK  07-diagnostico.html: 171 linhas, extras=0, só-no-código=0, cobertura da baseline=50/60 (83%)
OK  08-blog-lista.html: 28 linhas, extras=0, só-no-código=3, cobertura da baseline=8/56 (14%)
OK  09-blog-artigo.html: 44 linhas, extras=0, só-no-código=1, cobertura da baseline=16/74 (22%)
```
(Os 6 anteriores seguem `OK`.) **Cobertura baixa no blog é esperada**: a baseline do blog inclui header, rodapé e todo o conteúdo de teste (fixtures), que o protótipo não repete. A cobertura do 07 (83%) só perde o honeypot e linhas repetidas do aside.

**O que o `copy-check` NÃO prova no blog:** o texto de CMS (título, resumo, autor, data, categoria, corpo) está marcado `data-fixture` e é **removido** antes da comparação. Ele valida o texto "de código" (rótulos, hero de fallback, CTA, "Ler artigo", "Compartilhar"…), não o conteúdo editorial. Placeholders e `aria-label` também não entram (o `innerText` não os vê); conferi **à mão** que os placeholders do 07 são os do código.

## 2. Resumo da direção

- **Diagnóstico:** moldura de duas colunas `warm | paper` com filete, sem faixa escura; régua de 3 segmentos no lugar do trilho; passo 3 como **lista ruled com caixa de seleção** (sai a nuvem de pílulas); sucesso em tipo (sai o selo verde); erros com `--c-error` e borda de campo a 3,6:1 (era 1,3:1).
- **Lista do blog:** destaque 7/5 (única sombra) + dois médios + **índice ruled**; filtro texto + numeral. **A lista é a exceção** à "grade de 3+ cartões" e está justificada em `03-blog.md` §4.1 (tabela ruled; hierarquia em 3 tamanhos; nunca 3 peças iguais lado a lado).
- **Artigo:** texto entra 2 colunas, **medida 62ch a 20px**, capa 21:9 (único objeto), escala de leitura para o HTML exportado, `blockquote` sem barra, faixa escura única na conversão, "Continue explorando" sem caixa.

## 3. Arquivos alterados e commits

Todos em `docs/po/`. **Nada em `apps/`, `.env`, flags ou produção.** `git status` mostra o trabalho aberto de outra sessão em `apps/` intacto (não toquei). `git add` só dos meus caminhos.

- Novos: `design/02-diagnostico.md`, `design/03-blog.md`, `design/tokens-d2d3.css`, `design/proto/{07-diagnostico,08-blog-lista,09-blog-artigo}.html`, `design/proto/measure-check.mjs`, `design/proto/copy-source/*.txt`, `design/proto/shots/{07,08,09}-*.png`, `design/refs/d2d3-*.png`, `relatorios/antes/d2-d3/*.png`, `relatorios/d2-d3-ferramentas/*`, este relatório.
- Alterados: `design/proto/copy-check.mjs`, `design/proto/overflow-check.mjs` (só ampliam: os 6 protótipos antigos seguem passando).
- Commits: ver `git log --oneline` (mensagens `docs(po): …`, 4 commits; hashes no fim).

## 4. O que ficou de fora e por quê

- **Dados reais do blog.** Tudo é fixture. Não sei como ficam títulos reais longos, categorias reais, capas reais (retrato, sem foco), nem o corpo de artigos reais (tabelas, `code`, `pre`, `details`, `h4`–`h6`, que **não redesenhei**). Se o blog real tiver mais de ~12 artigos, o índice precisa de paginação ou "ver mais", que **não existe hoje** e não desenhei.
- **Hero real do blog.** Vem do editor (HTML livre). Testei só o fallback e um lead longo (`#stress-hero`, texto lido da `:3000` de outra sessão, origem desconhecida, fora do `copy-check`).
- **Interação:** hover, foco, teclado, leitor de tela, "dock" do filtro no header ao rolar, estado `sending`, `unconfigured` do formulário (a string existe; não desenhei porque só aparece sem endpoint).
- **Header e rodapé do site** (`HomeHeader`, `SiteFooter`) são compartilhados e fora do escopo; nos protótipos aparecem como espaço em branco/preto. Não vi como o novo artigo/lista convive com o header real em dobra (só vi no "antes").
- **Web Vitals:** não medi. Direção nova: capa 21:9 e miniaturas em `<img>` com dimensões; o dev deve manter `width/height`, `loading` e `fetchPriority` atuais.
- **768 como imagem:** só gerei `08-todos-768` (não revi). Overflow em 768 foi medido.
- **Fontes:** os protótipos carregam Inter e Source Sans 3 do Google Fonts; o site usa `next/font`. A renderização pode diferir milimetricamente.

## 5. Riscos

- **Estruturais (código):** a conversão em faixa de largura total exige tirar `conversionCta` da coluna de 960px (muda o `ArticleView`); o índice depende de `:has()` e de `:nth-last-child` (suporte amplo, mas confirmar o alvo de navegadores); o `blockquote` e a figura "abrem" além da medida, o que o editor do admin (preview) precisa mostrar igual.
- **Copy:** no celular o painel de contexto do Diagnóstico aparece (hoje some). Se o dono não quiser, esconder e dar um `h1` só para leitores de tela. **É texto novo em 390** para o `copy-diff`.
- **Contraste dos botões da Home:** branco sobre `#b6644d` = 4,27:1 (cálculo WCAG). O protótipo usa o mesmo botão (fiel à Home) e herda o problema; ver `02-diagnostico.md` §8.
- **Baseline de captura:** as capturas "antes" valem para o disco de 31/10 com ~650 linhas não commitadas de outra sessão; se o dono commitar, vale reconferir.

## 6. O que o dono precisa fazer

1. Commitar o trabalho aberto em `diagnostico/`, `blog/` e `institucional/` (pendência D1 do PO) antes da B5/B6.
2. Decidir as perguntas Q1–Q4 do Diagnóstico e Q1–Q5 do Blog (abaixo).
3. Dizer se o blog real tem poucos ou muitos artigos (decide paginação).

## 7. Perguntas de produto para o PO

**Diagnóstico** (`02-diagnostico.md` §8): Q1 painel esquerdo escuro → `warm`? Q2 tirar um entre "ETAPA N DE 3" e "PASSO N DE 3" (muda copy)? Q3 mostrar o contexto no celular (abaixo do formulário) ou esconder? Q4 pílulas → lista com caixa de seleção?
**Blog** (`03-blog.md` §9): Q1 capa 21:9 (corta mais) ou 16:9 limitada? Q2 tirar o avatar "EQ"? Q3 faixa escura de conversão em largura total? Q4 com 2 artigos o 1º vira destaque? Q5 restringir o hero do editor ao molde `p + h1(span) + div`?
**Transversal:** o botão primário da Home reprova AA (4,27:1); corrigir na Home está fora do escopo de design das internas, mas vale decidir uma vez.
