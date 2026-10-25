# Web Vitals do site (apps/site)

Linha de base, correções e decisões: `docs/po/relatorios/site-webvitals.md`.

## Como repetir a medição
1. Servidor falso do blog (Node, fora do repo) em `:8199` servindo `GET /api/blog/articles?published=true` e `GET /api/blog/article?slug=` (5 artigos `artigo-1..5`).
2. Em `apps/site`: `API_URL=http://localhost:8199 npm run build` e `API_URL=http://localhost:8199 npx next start -p 3199`.
3. Instale `lighthouse@12` em uma pasta fora do repo, copie `docs/web-vitals-medir.mjs` para lá (ajuste `chromePath` se não for o Edge) e rode `node web-vitals-medir.mjs <rotulo> 3`. Saída: mediana de 3 por página, móvel e desktop, em `<rotulo>.json`.
Limites: throttling simulado, TTFB local, INP substituído por TBT.
