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


## Decisões propostas ao PO
(preenchido ao final)
