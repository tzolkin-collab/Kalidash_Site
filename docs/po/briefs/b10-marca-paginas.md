# B10: marca nas páginas Advisory, Execução e AI Culture (uma por vez)

Pedido do dono em áudio (02/11), resumido pela sessão que o atende. Substitui a pausa D26 **só para estas três páginas** (+ o ajuste de tamanho em Sobre nós). **A Home não muda** (exceto a estátua, já feita). Copy intocável.

## O que o dono pediu
1. A revisão externa e os mockups são **referência de fluidez**, não para copiar tudo.
2. **Fonte da marca**: sair de Inter. Kepler Std + Acumin são Adobe Fonts (sem licença/acesso no projeto): usar **Fraunces provisória** nos títulos (já declarada em `globals.css` como `--font-display`) e **Archivo** no corpo (substituto de Acumin), tudo atrás de variáveis para trocar depois. Máximo 2 famílias carregadas. Cores: pode manter o Limestone/champagne que já usamos + **dourado `#A88A58`** + o preto que já existe + roxo escuro (Imperial `#28183B`, Aubergine `#46304F`).
3. **Dourado na palavra final** das frases-manifesto (ex.: "...acontece depois dele." → última palavra em dourado), sem mudar o texto (envolver a última palavra num `<span>`; `innerText` idêntico).
4. **Frases-manifesto ficaram grosseiras e gigantes no desktop** (no celular estão ok): reduzir mais o teto no desktop (hoje `--t-claim` ~44px; ir a ~34-36px, a revisar olhando a imagem). **Sobre nós** não cabe na tela do desktop e as frases cortam: seções um pouco menores, legíveis, frases inteiras onde der (`sobre-nos.module.css`).
5. **Elementos da marca**: mais dourado, filetes/linhas douradas, os pensadores/filósofos (a estátua e as imagens clássicas que **já existem** no repo: `public/kalidash-hero-sculpture.png`, `kalidash-motion-statue.jpg`, `home/`; se precisar de outra, **pare e peça** ao PO: banco de imagens só com decisão do dono). Os elementos do Brand Guide são referência. A primeira LP toda preta casava pela imagem da estátua: pode usar o preto com a estátua onde fizer sentido.
6. Onde mudar de verdade: **Advisory, Execução e AI Culture** (`/advisory`, `/execucao`, `/treinamento-corporativo-ia`; as três usam `solucoes/KitPage.tsx` + `kit.module.css`, então o sistema nasce lá e vale nas três).

## Regras
- **Uma página por vez, nesta ordem: Advisory → Execução → AI Culture.** Em cada uma, **pare e entregue antes/depois** (PNG real 1440 e 390, lado a lado, em `docs/po/relatorios/b10-marca/`) e **NÃO commite**: o dono vê antes. O PO avisa quando liberar o commit e a página seguinte.
- Copy idêntica: `copy-diff.mjs` contra `docs/po/relatorios/copy-baseline/` (regenerada em `5dcc704`) tem que ficar limpo; só pode diferir por quebra de span, que o `innerText` não mostra.
- Sem token global novo que mude outras páginas: escopar em `kit.module.css`/`sobre-nos.module.css`. `--font-display` já é global: usar, não redefinir.
- Não tocar `home/**`, `diagnostico/**`, `blog/**`, `apps/admin`, `apps/api`, `solucoes/ProductPage` (Kognis/Spectra).
- Sem cartão em cartão; só opacity/transform no movimento; `prefers-reduced-motion`; sem ornamentos de IA (partículas, brilho, faísca, texto fantasma).
- Sem maratona de medição: console limpo, sem rolagem lateral, lint/tsc/build, peso das fontes antes/depois.
- `git status` antes; `git add` só dos seus arquivos (e só depois da liberação); não editar o checklist; não usar porta 3199 nem `.next` de outro servidor (o site local da 3000 já roda; não reinicie).
- Relatório curto `docs/po/relatorios/b10-marca.md` (apêndice C), honesto.
