# Relatório — Web Vitals do site (Entrega 1)

**Status:** linha de base medida (abaixo). Correções registradas na seção "Correções" a cada commit.

## Método e limites
- `npm run build` + `next start -p 3199` em apps/site, com `API_URL=http://localhost:8199` apontando para um servidor falso em Node (fora do repositório; 5 artigos, imagens servidas localmente). Produção (localhost:8080) não tocada; nenhum `.env` lido.
- Lighthouse 12 dirigindo o **Microsoft Edge** do sistema (headless), só performance, **mediana de 3 execuções**. Móvel = perfil padrão do Lighthouse (4G lento simulado, CPU 4x); desktop = preset desktop.
- Limites: throttling **simulado**; TTFB local (~5 ms) não reflete a Vercel; INP não é medido em carga (TBT como proxy); imagens do blog vêm de localhost, não do CDN real.
- Coordenação: `git status` sem mudança de outra sessão em apps/site antes de começar.

## Tabela ANTES (mediana de 3)
| Perfil / página | Perf | LCP ms | CLS | TBT ms | FCP ms | JS KB | Img KB | Fontes KB | Elemento LCP |
|---|---|---|---|---|---|---|---|---|---|
| Móvel `/` | 78 | 5749 | 0 | 95 | 1219 | 189 | 162 | 520 | h1 |
| Móvel `/treinamento-corporativo-ia` | 79 | 5668 | 0 | 88 | 1218 | 189 | 60 | 520 | img hero |
| Móvel `/advisory` | 77 | 5588 | 0 | 149 | 1539 | 189 | 28 | 520 | img hero |
| Móvel `/blog` | 77 | 6292 | 0 | 90 | 1072 | 184 | 457 | 520 | capa do 1º cartão |
| Móvel `/blog/artigo-1` | 75 | 7183 | 0 | 93 | 1217 | 189 | 272 | 520 | capa do artigo |
| Desktop `/` | 96 | 1143 | 0 | 97 | 341 | 397 | 285 | 520 | h1 |
| Desktop `/treinamento-corporativo-ia` | 98 | 1137 | 0 | 0 | 340 | 189 | 122 | 520 | img hero |
| Desktop `/advisory` | 98 | 1104 | 0 | 3 | 333 | 189 | 22 | 520 | img hero |
| Desktop `/blog` | 97 | 1220 | 0 | 0 | 290 | 184 | 457 | 520 | capa |
| Desktop `/blog/artigo-1` | 97 | 1304 | 0 | 0 | 334 | 189 | 363 | 520 | capa |

Metas móvel: CLS ≤ 0,1 ✅ (0); TBT ≤ 300 ms ✅ (88–149); **LCP ≤ 2,5 s ❌ (5,6–7,2 s)**.

## Diagnóstico (código)
- Fontes: o layout raiz carrega 4 famílias (~520 KB). Newsreader não é usada; Fraunces só em CSS morto (`motion.module.css` ← `components/Header.tsx`, que ninguém importa) e classes `.text-display-*` sem uso. Archivo é fallback do `body`; Manrope é usada em `/blog`.
- PixelTransition só roda em `/blog` e `/blog/[slug]` (não na home); cobre a página ~1,4 s e ignora `prefers-reduced-motion`.

## Correções
### 1. Fontes: remover Fraunces e Newsreader do layout raiz (`perf(site): remove fontes nao usadas`)
Sem uso em nenhum componente vivo; `--font-display` já tem fallback Georgia. Fontes: 520 → 135 KB.

| Móvel | LCP antes → depois | Perf | TBT |
|---|---|---|---|
| `/` | 5749 → 3593 | 78 → 90 | 95 → 42 |
| `/treinamento-corporativo-ia` | 5668 → 3445 | 79 → 91 | 88 → 41 |
| `/advisory` | 5588 → 3370 | 77 → 92 | 149 → 41 |
| `/blog` | 6292 → 4131 | 77 → 87 | 90 → 45 |
| `/blog/artigo-1` | 7183 → 4582 | 75 → 84 | 93 → 38 |

Desktop: LCP 1,1–1,3 s → 0,73–0,89 s; perf 99–100. CLS segue 0.

### 2. PixelTransition respeita `prefers-reduced-motion` (`9aba6b1`)
CSS `@media (prefers-reduced-motion: reduce)` esconde a grade. Sem efeito nas medições (o Lighthouse não ativa a preferência); não medido.

### 3. Capa do 1º cartão de `/blog` com `loading=eager` + `fetchpriority=high` (`a0f549b`)
Era `lazy`, mesmo sendo o elemento LCP. Efeito dentro do ruído (móvel `/blog` 4131 → 4145 ms); mantido por ser a prática correta, sem ganho medido.

### 4. FlickeringGrid/ProblemHologram sob demanda — **testado e descartado**
`next/dynamic` com `ssr:false` na home: JS 189 → 192 KB e LCP 3593 → 3575 ms (ruído); não reduz o que o Lighthouse mede. Revertido, não commitado.

## Tabela DEPOIS (mediana de 3, após correções 1–3)
| Perfil / página | Perf | LCP ms | CLS | TBT ms | FCP ms | JS KB | Img KB | Fontes KB |
|---|---|---|---|---|---|---|---|---|
| Móvel `/` | 91 | 3575 | 0 | 37 | 1060 | 192 | 158 | 135 |
| Móvel `/treinamento-corporativo-ia` | 91 | 3446 | 0 | 42 | 1209 | 187 | 60 | 135 |
| Móvel `/advisory` | 92 | 3374 | 0 | 42 | 1209 | 187 | 28 | 135 |
| Móvel `/blog` | 87 | 4145 | 0 | 45 | 1058 | 182 | 457 | 135 |
| Móvel `/blog/artigo-1` | 84 | 4516 | 0 | 41 | 1209 | 187 | 272 | 135 |
| Desktop `/` | 99 | 801 | 0 | 63 | 392 | 399 | 285 | 135 |
| Desktop `/treinamento-corporativo-ia` | 100 | 707 | 0 | 0 | 289 | 187 | 122 | 135 |
| Desktop `/advisory` | 100 | 691 | 0 | 0 | 288 | 187 | 22 | 135 |
| Desktop `/blog` | 99 | 835 | 0 | 0 | 249 | 182 | 457 | 135 |
| Desktop `/blog/artigo-1` | 99 | 903 | 0 | 0 | 289 | 187 | 363 | 135 |

## Metas (móvel) — resultado
- CLS ≤ 0,1 ✅ (0). TBT ≤ 300 ms ✅ (37–45 ms). **LCP ≤ 2,5 s ❌ (3,4–4,5 s)**, melhorou ~2 s mas não chegou.
- Por que não chegou (hipótese, não confirmada): FCP ~1,1–1,2 s e LCP 2–3 s depois dele no perfil 4G lento simulado; ainda há ~135 KB de fontes e ~190 KB de JS na carga; no blog o PixelTransition cobre a página 1,4 s (o Lighthouse mede o LCP sob a cobertura) e a capa é grande (457 KB no `/blog`). Próximos candidatos: ver decisões abaixo e investigar o que atrasa o FCP/LCP do `<h1>` na home (CSS bloqueante, hidratação de `HomePage` inteira como client component).

## Decisões propostas ao PO (NÃO implementadas)
1. PixelTransition só na 1ª visita da sessão (ou removido): ataca o LCP de `/blog` e `/blog/<slug>`. **Ganho não medido** — não houve tempo; medir tirando a cortina é o 1º passo.
2. Reduzir mais as fontes (Archivo + Manrope só onde usadas; pesos de Inter/Source Sans 3): ganho a medir (restam 135 KB).
3. Home como Server Component (hoje `"use client"` inteira por causa do hover dos cards): reduz hidratação; mudança maior, precisa de decisão.

## Arquivos, commits
`apps/site/src/app/layout.tsx` (`0fcd192`), `components/pixel.module.css` (`9aba6b1`), `blog/views.tsx` (`a0f549b`), `docs/web-vitals.md`, `docs/web-vitals-medir.mjs`, este relatório (`9327671` + atualizações).

## Verificação
`npx tsc --noEmit` ✅; `npm run build` ✅ (com a API falsa). **Conferência visual 1440/390 px NÃO feita** (a remoção das fontes não usadas e o CSS de reduced-motion não alteram o visual, mas não olhei no navegador) — o PO deve conferir.

## Riscos
Medição simulada e local. Imagem de capa do blog medida via localhost. Dois servidores de teste (3199 e 8199) podem estar ativos na máquina.

## O que o Gustavo precisa fazer
Decidir os itens acima e conferir o visual; depois rodar a medição na URL real da Vercel (Lighthouse/PageSpeed) para validar os números absolutos.

