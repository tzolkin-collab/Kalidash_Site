# Relatório D0 + D1: direção das páginas institucionais (v2, após revisão do PO)

> Designer. v1 entregue 31/10 (nota do PO 8,0); esta v2 fecha as correções a–e. Nada em `apps/site` foi editado; só `docs/po/design/` e `docs/po/relatorios/`.

## 1. Checklist

| Item | Estado | Evidência |
|---|---|---|
| Capturas reais "antes" das 7 rotas em 1440 e 390 | ✅ | 14 PNGs de página inteira em `docs/po/design/antes/` (`shot.mjs` adaptado: rolagem gradual). Vi as 7 em 1440; em 390 vi só Execução e Sobre nós |
| Diagnóstico do "chapado" + auditoria de tells | ✅ | `01-institucionais.md` §1 |
| Hipótese das faixas brancas em `/kognis` | ⚠️ parcial | Reproduzi o vazio só **sem rolar** (`antes/kognis-1440-semscroll.png`); causa em `Motion.tsx` (`Reveal` opacity 0 até o `IntersectionObserver`). Com rolagem gradual tudo aparece (`antes/kognis-1440.png`). Salto de rolagem e impressão não testados. Vazio real: ~150px título→conteúdo (lido na captura) |
| **(a) Âncora vista e escrita para Soluções e Spectra** | ⚠️ parcial | **Soluções: ✅ Mistral /products** (vi a primeira dobra; 4 linhas + herdo/recuso em `01-institucionais.md` §2.7; Cohere /north como contraexemplo, §2.8). **Spectra: Linear /about** (vista), mas **nenhuma referência de visão por câmera abriu**: Samsara devolveu 404 em 3 URLs, Landing AI é de documentos (§2.9). Escrevi isso em vez de fingir âncora |
| Referências da seção 5 do checklist | ⚠️ | Vi 8: Linear about, Linear features, Anthropic Academy, Stripe about, Thoughtworks, BCG, Mistral, Cohere. Não vi McKinsey, Vercel, Palantir, Stripe /payments |
| D0: `00-sistema.md` + `tokens.css` | ✅ | + §9 com as decisões do PO (tokens escopados ao CSS institucional) |
| D1: `01-institucionais.md` por página e seção | ✅ | **Ordem do conteúdo respeitada**: Advisory sem fusão de seções (§4.3) |
| **(b) FAQ do Advisory com as 6 perguntas** | ✅ | `proto/03-advisory.html`; `copy-check` confirma as 6 respostas contra `pages.ts` |
| **(c) Diff de copy automático dos protótipos** | ✅ | `proto/copy-check.mjs` (modelo: `copy-diff.mjs`); saída em §2 abaixo: 0 extras nos 6 protótipos. Teste negativo feito (uma palavra trocada → reprovou) |
| **(d) Protótipos em 390 + overflow do Kognis** | ✅ / ⚠️ | `proto/overflow-check.mjs`: **24/24 sem overflow** (6 protótipos × 390/768/1024/1440). Overflow de 9px do Kognis achado e corrigido (numeral 56px em 2 colunas). Vi em 390: timeline, showcase, offer-2, passos e formatos do AI Culture, rituais, tabela do Kognis. Passos do AI Culture em 390 estavam com pontos soltos: refeitos com trilho vertical e revistos. **Não vi em 390:** proof, régua do Kognis, FAQ, hero dos 5 |
| **(e) Abrir beliefs, team, proof, offer-2 em tamanho real** | ✅ | `proto/shots/01-beliefs-1440.png`, `01-team-1440.png`, `01-proof-1440.png`, `04-offer-2-1440.png`. A `offer-2` tinha a coluna da foto trocada ao alternar (corrigido e revisto) |
| Telas do Kognis/Spectra | ✅ espaço reservado | Dono ainda não tem os prints (pediu à Carol). `01-institucionais.md` §4.8 descreve K1, K2, K3 (Kognis) e S1 (Spectra): onde, o que entra, formato, regras (só imagem real, dado anonimizado, `alt` novo precisa de aprovação, sem imagem o bloco não renderiza). Protótipos `02-kognis` (K1–K3) e novo `06-spectra` mostram o espaço tracejado, rotulado por CSS. Nada inventado |
| Decisões do PO aplicadas | ✅ | ordem intocável; raio 4/12, sombra única e `#a4533c` só no CSS institucional; sem CTA novo (`/kognis` sem CTA no fim; nenhuma página usa o bloco `cta`, conferido por grep); hero de `/execucao` mantém a foto |
| Console limpo / Web Vitals / 1024 e 768 como imagem | ❌ não feito | fora do escopo; 768/1024 só medi overflow |

## 2. Saídas dos testes automáticos

`node docs/po/design/proto/copy-check.mjs` (exit 0):

```
OK  01-sobre-nos.html: 45 linhas, extras=0, só-em-pages.ts=0, cobertura da baseline=45/45 (100%)
OK  02-kognis.html: 59 linhas, extras=0, só-em-pages.ts=1, cobertura da baseline=58/58 (100%)
OK  03-advisory.html: 52 linhas, extras=0, só-em-pages.ts=1, cobertura da baseline=50/50 (100%)
OK  04-execucao-solucoes.html: 42 linhas, extras=0, só-em-pages.ts=0, cobertura da baseline=40/80 (50%)
OK  05-ai-culture.html: 42 linhas, extras=0, só-em-pages.ts=0, cobertura da baseline=41/41 (100%)
OK  06-spectra.html: 13 linhas, extras=0, só-em-pages.ts=0, cobertura da baseline=13/13 (100%)
```

Como ler: "extras" = linha do protótipo que não existe nem na baseline nem literalmente em `pages.ts`. "só-em-pages.ts" = resposta de `<details>` recolhido (a baseline não a captura); no Kognis e no Advisory é a 1ª resposta, aberta no protótipo. Comparação sem distinção de caixa (eyebrows são `text-transform` de CSS); seta decorativa `→` e numeral solto de 2 dígitos ignorados. A cobertura de `04` é 50% porque ele traz só o showcase de Execução e a página Soluções. **Teste negativo:** trocar "desafios" por "metas" em `05` gerou `DIF ... EXTRA: mapeamos áreas, processos e metas do time...`; revertido.

`node docs/po/design/proto/overflow-check.mjs`: 24 linhas `ok`, 0 `OVERFLOW`. O `clientWidth` do 390 sai 375 porque o Chrome headless reserva 15px de barra de rolagem; a checagem compara `scrollWidth` com `clientWidth`, então o 9px antigo apareceu como `scrollWidth=399`.

**O que esses testes não provam:** que `SitePage.tsx` implementado mantém a copy (aceite 3.1 é do dev, com `copy-diff.mjs`), nem a aparência.

## 3. Arquivos alterados

- `docs/po/design/00-sistema.md`, `tokens.css`, `01-institucionais.md`
- `docs/po/design/proto/`: `proto.css`, `01…05-*.html`, `copy-check.mjs`, `overflow-check.mjs`, `06-spectra.html`, `shots/*.png`
- `docs/po/design/antes/` (14 PNG), `docs/po/design/refs/` (Linear x2, Anthropic x2, Stripe about, Thoughtworks, BCG, Mistral, Cohere)
- este relatório

## 4. Commits

- `65a4952` D0 sistema e tokens · `09b1805` D1 direção, protótipos e capturas · `21e78bc` relatório v1
- v2 (esta revisão): commit `docs(po): D0/D1 v2 ...` logo após este arquivo (hash no resumo da sessão).

Não toquei em `docs/ambientes/` nem em `docs/po/relatorios/copy-baseline/` e `copy-diff.mjs` (de outra sessão; só li).

## 5. O que ficou de fora

- As telas reais em si (K1–K3, S1): só o espaço está reservado e especificado.
- Ver em 390: `proof`, régua do Kognis, FAQ e heros; ver 768/1024 como imagem.
- Protótipo de `testimonials` (não renderiza hoje) e de `/spectra` (sem objeto real, não desenhei tela).
- D2 (Diagnóstico) e D3 (Blog): outros pacotes.

## 6. Riscos

1. Kognis e Spectra só passam de "limpas" com imagem real do produto.
2. Tirar `Reveal` dos blocos de leitura é o maior ganho por menor risco (some a faixa branca, o pisca e o escalonamento): sugiro como primeiro commit do B0.
3. Advisory fica com 7 seções do mesmo tipo de peso; a ordem não pode mudar, então o ritmo depende de paper/warm, modos de cabeçalho e objeto por seção (§4.3 do doc). Se o PO achar ainda repetitivo, a alavanca é visual (escala/fundo), não estrutural.
4. As capturas "antes" incluem o trabalho não commitado de outra sessão; se ele mudar, mudam.
5. O `copy-check` aceita texto que aparece literalmente em `pages.ts` mesmo que não esteja nessa página (ex.: resposta de FAQ); limite aceito, mas um texto movido de página não seria pego por ele.

## 7. O que o dono do projeto precisa fazer

- Conseguir com a Carol os prints do Kognis (K1 visão geral, K2 atendimento, K3 financeiro) e, se houver, imagem de câmera ou painel do Spectra (S1), anonimizados, e o texto de `alt` de cada uma.
- Abrir `docs/po/design/proto/*.html` no navegador e dizer se a direção "régua + objeto" é a desejada antes do dev começar.
- Commitar o trabalho aberto em `institucional/`, `diagnostico/` e `blog/` (pendência D1 do checklist).

## 8. Perguntas de produto para o PO

1. O espaço reservado (§4.8) é opcional no tipo (`image?`) e a página funciona sem ele. Aprova esse contrato para o dev?
2. Quem escreve o `alt` das novas telas (Carol)?

## 9. Auto-avaliação

Sem nota. Melhor que na v1: copy e overflow agora medidos por script (com teste negativo), todos os protótipos vistos em 1440 e a maioria das seções-chave em 390, âncora de Soluções vista. Pior ou aberto: nenhuma referência de visão por câmera abriu; Mistral/Cohere só primeira dobra; hero e FAQ não revistos em 390; Kognis sem tela real.
