# B9: vestir o site com a identidade da marca (fase 1: tokens + Home + Advisory)

Fonte: `docs/po/design/marca/revisao-site.txt` (revisão com mockups) e `brand-guide.txt` (Brand Guide 2026). Decisão do dono (02/11): prioridade máxima, **mudar o visual de fato**; menos medição e nota. Copy intocável; o hero da Home (texto), CTAs e estatísticas de texto ficam para a Carol.

## Escopo (só design)
1. **Tokens da marca**, num único lugar e usados no CSS institucional (`solucoes/`, `sobre-nos/`, `institucional/`) e na Home: Imperial `#28183B`, Limestone `#F1ECE4` (substitui o branco), Ink `#19171B`, Aubergine `#46304F`, Hellenic Gold `#A88A58` (números, filetes, detalhes), Terracota `#B7654D` só como apoio (pessoas/execução). Rodapé e seções escuras em Imperial, nunca preto.
2. **Tipografia**: serifa nos títulos (Kepler Std é Adobe; usar Fraunces via `next/font` atrás de variável `--font-display` para trocar depois), sans no corpo (Archivo ou a que já está carregada; ter no máximo 2 famílias no total, removendo Inter/Source Sans se deixarem de ser usadas). Numeração em serifa dourada (i. ii. iii.) onde hoje há 01/02/03. Frases-manifesto em serifa itálica sobre Limestone, **respeitando o teto de tamanho aprovado** (`--t-claim` ~44px).
3. **Remover ornamentos de IA**: esfera de partículas, texto fantasma, textura pontilhada dos cards, faísca no botão, greca em faixa cinza de largura total (manter uma greca pequena em ouro como detalhe de canto), bolha verde do WhatsApp (vira link de texto secundário, usando o texto que já existe no site).
4. **Ritmo**: alternar Limestone (claro) e Imperial (escuro) entre seções; o bloco de fechamento terracota de 100% da tela sai.
5. **Faixa de prova na primeira dobra** com "Onde aplicamos" (ArcelorMittal, CBA, Sicoob, Cooxupé) e "Onde ensinamos" (Conquer, Xperiun, Rocketseat, Tera), **só com nomes/logos que já existem no repositório**; sem inventar (os nomes já aparecem como texto em `diagnostico/`).
6. **Advisory**: trocar a foto de banco de imagens pela do "Comitê de IA" que já existe no repo (`public/home/front-2-comite.jpg` ou equivalente; conferir) mantendo o `alt` atual ou o mais próximo.

## Ordem (uma página por vez, olhar a imagem em tamanho real)
Fase 1 (este brief): tokens + fonte + Home + **/advisory** como prova. Pare e entregue antes/depois em `docs/po/relatorios/b9-marca/` (PNG real 1440 e 390 de Home e Advisory, antes e depois, lado a lado). **Só depois da aprovação do dono** o PO libera o espalhamento para as outras páginas e o Diagnóstico/Blog.

## Regras
Copy idêntica (conferir com `docs/po/relatorios/copy-diff.mjs` e listar o que mudou). Numerais 01/02/03 voltam em ouro serifa (proposta; o dono ainda não respondeu: faça só em /advisory e Home). Depoimentos da Home: não mexer. Sem cartão em cartão; só opacity/transform no movimento; `prefers-reduced-motion`. Web Vitals: não adicionar mais de 2 famílias de fonte, `display: swap`, subset latin, pesos mínimos; reporte o peso das fontes antes e depois, sem maratona de medição. Não tocar `apps/admin`, `apps/api`, `diagnostico/**`, `blog/**` nesta fase. `git status` antes; `git add` só dos seus arquivos; commits pequenos `feat(site): ...`. Relatório curto em `docs/po/relatorios/b9-marca.md` (apêndice C), honesto.
