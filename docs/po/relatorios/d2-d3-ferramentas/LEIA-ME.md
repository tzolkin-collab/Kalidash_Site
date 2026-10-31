# Ferramentas do pacote D2/D3 (só desenho; nada toca `apps/`)

Rodam fora do repo, contra uma **cópia** de `apps/site` (para não colidir com o `next dev` de outra sessão):

1. `node blog-fake-server.mjs`: API falsa em `:8199` (7 artigos "de teste", `POST /api/public/leads` responde 200; nome com "Falha" responde 500).
2. Copiar `apps/site` (sem `.next`) para uma pasta **no mesmo disco**, ligar `node_modules` por junction e subir:
   `API_URL=http://localhost:8199 NEXT_PUBLIC_LEAD_ENDPOINT=http://localhost:8199/api/public/leads npx next dev --webpack -p 3299`
   (Turbopack recusa o junction fora da raiz; webpack não funciona com a pasta em outro disco.)
3. `node capturas-antes.mjs` → PNGs em `relatorios/antes/d2-d3/`. `node texto-estados.mjs` → `design/proto/copy-source/*.txt`.

Os dois scripts têm o caminho de saída e `http://localhost:3299` fixos no topo.
