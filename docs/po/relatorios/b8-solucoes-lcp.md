# B8: Kognis só hero, descrições de /solucoes, LCP móvel

Data: 02/11/2026. Base: `aca038e` (HEAD no início; `apps/site` limpo). Build de produção do `apps/site` na porta própria 3210 (sem tocar a 3199). Medições em `docs/po/relatorios/b8-solucoes-lcp/`.

## 1. Itens

| # | Item | Status | Evidência |
|---|---|---|---|
| 1 | /kognis só com hero + cabeçalho + rodapé | ✅ | `depois-kognis-1440.png`, `depois-kognis-390.png`, `depois-kognis-390-hero-completo.png`. HTML de produção: 0 ocorrências de `faq`/`ld+json`; botão `href="https://kognis.com.br" target="_blank" rel="noopener noreferrer"`. Textos de `pages.ts` intactos (só o `href` mudou). |
| 1b | Hero bem resolvido sozinho, 1440 e 390 | ✅ visto | 1440: hero ocupa a viewport, foto ancorada na borda inferior, faixa grega logo abaixo. 390: título, apoio, selos, botão, foto, faixa. Nenhum texto inventado. |
| 2 | 6 descrições de /solucoes de volta | ✅ | `copy-diff` de /solucoes não lista mais as 6 frases. Vistas em `depois-solucoes-1440-painel-kognis.png`, `depois-solucoes-390x667-painel-spectra.png`. |
| 3 | LCP móvel /solucoes e /spectra | ⚠️ sem ganho demonstrável | Seção 4. |
| 4a | Rolagem horizontal e console, 1440/1024/768/390 × 3 rotas | ✅ | `overflow-console-depois.json`: 12 de 12 sem overflow, 0 erros, 1 `h1`. |
| 4b | CLS em 390/900/1440 × 3 rotas | ✅ | `cls-depois.txt`: 0,000 nas 9. |
| 5 | lint, tsc, build | ✅ | `eslint` nas pastas tocadas sem saída; `tsc --noEmit` sem erro; `next build` ok (o build serviu as medições). |

## 2. Causa das 6 descrições "sumidas"

Não foram apagadas: estavam no DOM, mas `solucoes.module.css` tinha `@media (max-width: 900px) and (max-height: 760px) { .story[data-live] .features p { display: none } }`. O `copy-diff.mjs` abre o Chrome headless na janela padrão (800×600), que cai nessa regra; então o `innerText` perdia as 6 frases. Em celular baixo (iPhone SE e parecidos) o visitante real também não as via.

Correção: em `SolucoesStory.tsx` a seção fixada (`data-live`) não liga quando a tela é `max-width: 900px` e `max-height: 760px` (escuta `change` do `matchMedia`); ali as duas telas ficam empilhadas, com todo o texto, como já ficam com `prefers-reduced-motion`. A regra que escondia o parágrafo foi removida. Sem cartão em cartão: segue a lista em linhas já existente. Texto conferido contra `pages.ts` e `7c34288` (idêntico: "Triagem e acompanhamento automatizados...", "Rotinas operacionais organizadas...", "Indicadores do escritório consolidados...", "Câmeras conectadas ao ambiente físico...", "O que antes dependia de observação manual...", "Identificação objetiva de gargalos...").

## 3. Copy-diff (`copy-diff-depois.txt`, contra a baseline pré-30a18cb)

- **/solucoes (12 linhas)**: nenhuma é descrição de card. Restam diferenças que já vinham do 30a18cb e que não toquei: título quebrado em 3 linhas (spans em bloco), "01 · KOGNIS" virou "01" + "KOGNIS" (marcador em flex, sem o "·"), e o fecho "Quando isso acontece, a gente constrói." + CTA "Falar sobre o meu caso" (repetição aceita pelo dono em D22c). O pedido era "só a volta das 6"; para isso o diff ficar limpo o PO regenera a baseline (ou decide se o "·" deve voltar, ver pergunta 1).
- **/kognis (65 linhas)**: só saída do conteúdo abaixo do hero (+ caixa-alta do selo, que é CSS). Saíram: os 4 números (8 horas, 3x, +90%, 100% e rótulos); "Soluções para escritórios de advocacia / Três problemas resolvidos. Uma plataforma." com Agentes de IA, Conciliação Bancária, BI e Indicadores (texto e exemplos); "Atendimento Inteligente 24h" com Venda e pré-atendimento, Atendimento ao cliente, Central completa; "Controle Financeiro" com Conciliação automática, Divisão de honorários, Painel financeiro; "Como funciona" (Conectamos, Configuramos, Você escala) e a nota de implementação; FAQ inteira (5 perguntas); fecho "Sobra tempo pra fazer o que você faz de melhor: advogar." e o CTA repetido; numerais 01/02/03. Hero idêntico.
- **/spectra**: sem mudança de minha autoria (restam as diferenças do 30a18cb: caixa-alta, 01/02/03 ocultos, fecho novo).

## 4. LCP móvel (Lighthouse mobile, mediana de 7, `docs/web-vitals.md`)

Antes = HEAD `aca038e`; depois = commits abaixo. Rodada 1 completa (móvel e desktop), rodada 2 só móvel.

| Rota | Referência C1 | Antes (7) | Depois rodada 1 | Depois rodada 2 |
|---|---|---|---|---|
| /solucoes móvel LCP | 3221 | 3691 | 3911 | 3840 |
| /spectra móvel LCP | 3227 | 3535 | 3038 | 3837 |
| /kognis móvel LCP (hero só) | 3479 | 3478 (página inteira) | 3615 | 3546 |
| /solucoes desktop | 677 | 784 | 791 | n/a |
| /spectra desktop | 772 | 737 | 786 | n/a |
| /kognis desktop | 744 | 716 | 732 | n/a |

TBT, CLS e FCP praticamente iguais (FCP ~1,22 s; CLS 0; TBT móvel 33 a 91 ms, ruído).

O que investiguei:
- O LCP real (observado) é pequeno: o busto de /solucoes carrega em ~50 ms e o breakdown é TTFB 10 ms, atraso 17 ms, download 29 ms, render 187 ms. Os 3,5 a 3,9 s são do modelo simulado (RTT 150 ms, 1,6 Mbps).
- **Achado concreto**: o `<img>` do hero (busto, foto do Spectra, casal do Kognis) era baixado com **prioridade Low**; o `priority` do `next/image` gera o preload mas o Chrome o tratava como Low. Adicionei `fetchPriority="high"` (agora `High` no trace). É a única mudança de LCP feita.
- Formato/tamanho: já servido em webp/avif pelo `next/image`, variante `w=640` (busto 92 KB, Spectra 104 KB) para um elemento de 255 px de largura a DPR 1,75 (precisa de ~446 px; a próxima variante abaixo, 384, ficaria mole, então não reduzi). `sizes` já é adequado. Fontes e JS (190 KB, 110 KB de fonte) não são do meu escopo.
- Imagens abaixo da dobra (cutout Kognis 42 KB e foto Spectra 128 KB em /solucoes) já são lazy; o Chrome as busca cedo porque estão dentro do limiar de ~1250 px. Bloquear essas duas imagens no Lighthouse deu 3756/3214/3887: dentro do ruído.
- **A métrica é bimodal e ruidosa**: execuções individuais caem em ~2,9 a 3,2 s ou em ~3,8 a 3,9 s para a mesma página e build (ex.: /spectra 2880, 2889, 3847; a mediana de 7 do /spectra foi 3038 numa rodada e 3837 na outra). Bloquear o próprio busto também não derruba o LCP de /solucoes (3375 a 3782), então o busto não é o único fator.

Conclusão honesta: **a regressão de /solucoes (+470 a +690 ms contra a C1) não foi resolvida** e a diferença antes/depois está dentro do ruído. /spectra: melhorou numa rodada e voltou ao nível anterior na outra. Mantive `fetchPriority="high"` porque corrige a prioridade real no trace e não custa nada, mas não afirmo ganho. Parte da distância contra a C1 vem de outros commits (30a18cb, B0), não só da imagem. Para resolver de verdade seria preciso mexer em escopo que me foi vedado (peso do PNG original, fontes pré-carregadas, `next.config` de imagens para permitir qualidade menor) ou tolerar o novo piso de ~3,5 s do modelo simulado.

## 5. Arquivos alterados

`apps/site/src/app/institucional/pages.ts` (só o `href` do CTA do hero do Kognis), `kognis/page.tsx`, `solucoes/ProductPage.tsx`, `solucoes/SolucoesStory.tsx`, `solucoes/solucoes.module.css`, `solucoes/page.tsx`. Mais evidências em `docs/po/relatorios/b8-solucoes-lcp/` e este relatório. Não toquei `home/**`, `diagnostico/**`, `blog/**`, `apps/admin`, `apps/api`, numerais 01/02/03 nem depoimentos.

## 6. Commits

- `f750e08` fix(site): /kognis só com o hero, botão leva a kognis.com.br em nova aba (D23) (inclui `fetchPriority` em `ProductPage`)
- `b89e034` fix(site): /solucoes mostra as 6 descrições de card em celular baixo
- `46d6180` fix(site): fetchPriority=high no busto do hero de /solucoes (LCP móvel)

## 7. O que ficou de fora

- A baseline de copy não foi regenerada (regra do pacote).
- Navegação por teclado/AA do botão externo não auditada além do foco herdado.
- Medição do LCP em rede real (não simulada) não feita.
- B0 e B5 não medidos separadamente (o "antes" já os inclui).

## 8. Riscos

- /kognis agora só tem hero: some copy da Carol do ar (decisão do dono, D23); reversível, textos em `pages.ts` e `heroOnly` em `kognis/page.tsx`.
- O botão leva a um domínio externo; `kognis.com.br` não foi aberto por mim.
- Build de medição feito em `apps/site/.next` do repositório principal (não havia servidor 3199 ativo; o worktree com junction de `node_modules` não compila). O `.next` agora reflete este código; o servidor 3210 foi desligado.
- O Kognis ficou com a imagem como LCP em móvel (era também antes).

## 9. O que o dono precisa fazer

- Avisar a Carol de que a página do Kognis perdeu todo o conteúdo abaixo do hero.
- Confirmar que `https://kognis.com.br` é o destino final.

## 10. Perguntas de produto para o PO

1. O marcador "01 · KOGNIS" / "02 · SPECTRA AI" do /solucoes deve voltar a ter o "·" e o título a ser um bloco de texto único, para o diff ficar limpo? (hoje é "01" e "KOGNIS" em linhas separadas, do 30a18cb.)
2. Aceita o piso de LCP móvel simulado de ~3,5 s nas páginas com imagem no hero, ou autoriza mexer em peso da imagem / pré-carga de fontes / `qualities` em `next.config`?
