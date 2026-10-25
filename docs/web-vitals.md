# Web Vitals do site (apps/site)

Linha de base, correções e decisões: `docs/po/relatorios/site-webvitals.md`.

## Como repetir a medição
1. Servidor falso do blog (Node, fora do repo) em `:8199` servindo `GET /api/blog/articles?published=true` e `GET /api/blog/article?slug=` (5 artigos `artigo-1..5`).
2. Em `apps/site`: `API_URL=http://localhost:8199 npm run build` e `API_URL=http://localhost:8199 npx next start -p 3199`.
3. Instale `lighthouse@12` em uma pasta fora do repo, copie `docs/web-vitals-medir.mjs` para lá (ajuste `chromePath` se não for o Edge) e rode `node web-vitals-medir.mjs <rotulo> 3`. Saída: mediana de 3 por página, móvel e desktop, em `<rotulo>.json`.
Limites: throttling simulado, TTFB local, INP substituído por TBT.

## Achados que valem repetir
- O LCP simulado do Lighthouse é dominado pelo modelo de rede (RTT 150 ms/1,6 Mbps); sem simulação o LCP local é < 1 s.
- Fontes: Manrope só na galeria do blog (`blog/manrope.ts`); Inter/Source Sans 3 são variáveis; Fraunces/Newsreader foram removidas.
- Testados sem ganho de LCP e não adotados: `next/dynamic` para FlickeringGrid/ProblemHologram, `experimental.inlineCss`, remover a cortina do PixelTransition.
- Para medir só algumas páginas: `PAGES=/blog,/blog/artigo-1 PRESETS=mobile node web-vitals-medir.mjs rotulo 3`.
