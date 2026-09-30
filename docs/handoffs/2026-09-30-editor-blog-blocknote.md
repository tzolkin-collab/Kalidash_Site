# Handoff — editor do blog (BlockNote) e fidelidade do preview

**Data:** 30/09/2026
**Status:** editor de artigo e da Galeria Principal migrados pra BlockNote, preview com fidelidade de cor/tipografia/layout confirmada contra o site real. Cards de artigo na Galeria Principal ainda não são editáveis (só visualização). Unificação de tema claro/escuro entre lista e artigo não decidida.

## Objetivo da sessão

Unificar e finalizar o design do blog: reduzir o header, padronizar o layout "a nível extremo" e dar ao editor do admin um formato de edição modular, tipo Notion — com controle de posição/tamanho de imagem e o preview batendo de verdade com o que o site mostra.

## Decisão crítica registrada — Tiptap (Antigravity) vs BlockNote

Antes de trocar o editor, esta sessão já tinha reescrito `apps/admin/src/pages/Blog.tsx` de TipTap pra BlockNote. No meio do trabalho, apareceu evidência de que **o Antigravity (Gemini, sessão de 27/09) já tinha resolvido exatamente o mesmo problema em cima do TipTap** — drag-handle, resize de imagem, preview reaproveitando `article.module.css` do Next.js real, painel de SEO/slug/rascunho — depois de passar pelas mesmas queixas que se repetiram aqui ("não reflete a página real", "cadê o resto do design"). Transcript: `C:\Users\gusta\.gemini\antigravity-ide\brain\b2362e95-1005-4c4e-a5e9-6fc54fe6432e\.system_generated\logs\transcript.jsonl`.

Apresentada a escolha ao usuário (reverter pro TipTap do Antigravity vs. continuar no BlockNote corrigindo os problemas), a decisão foi **ficar com o BlockNote**. Os problemas de fidelidade que motivariam um revert (cor cortada, tipografia errada, preview incompleto) foram corrigidos nesta sessão — ver commits abaixo. Registro aqui pra quem retomar não reabrir essa decisão sem saber que ela já foi tomada conscientemente.

## O que foi feito

1. **Editor trocado de TipTap pra [BlockNote](https://www.blocknotejs.org/)** (`@blocknote/core` + `react` + `mantine`, núcleo MPL-2.0 — grátis em app fechado; pacotes `xl-*`, que são GPL/pagos, não foram usados). Menu "/", imagem com resize + alinhamento + legenda nativos, drag handle, tudo em **pt-BR** (dicionário `pt` de `@blocknote/core/locales`, confirmado que é pt-BR de verdade, não pt-PT).
2. **Armazenamento**: coluna nova `bodyJson` no MySQL (`Article`) guarda o documento nativo do BlockNote — fonte de verdade pra reedição. `body` (HTML) continua existindo e é regenerado a cada save via `blocksToHTMLLossy`; o site não mudou nada no consumo (`dangerouslySetInnerHTML` de sempre). Artigo sem `bodyJson` (os 4 migrados do mock antigo) é convertido de HTML pra blocos uma única vez, na entrada (`tryParseHTMLToBlocks`).
3. **Bugs de fidelidade achados e corrigidos** (todos via comparação numérica com `getComputedStyle`, não só visual):
   - `.bn-editor` (raiz do BlockNote) vinha com `background: white` e `color: rgb(63,63,63)` fixos do CSS padrão da lib (`bn-default-styles`), por cima do fundo/cor reais da página. Corrigido em `apps/admin/src/pages.css` (`.editor-box .bn-editor`) com `!important`.
   - `line-height` da lib se redefine em vários níveis da árvore (não só na raiz) — um `inherit` só no `.bn-editor` não bastava; precisou de `.editor-box .bn-editor :not(h1):not(h2):not(h3) { line-height: inherit !important }`.
   - `font-size`/`color` de h2/h3/p/li em `article.module.css` ganharam `!important` (inofensivo no site, necessário no admin pra vencer o CSS da lib carregado depois no bundle).
   - Reset de lista do Tailwind matava os números de `<ol>` — nunca tinha CSS pra restaurar (`list-style`), bug preexistente, não introduzido aqui.
4. **Header reduzido "bruscamente"**: h1 do artigo de `clamp(3rem,7vw,7rem)` pra `clamp(1.9rem,3.4vw,2.75rem)`; hero da lista de `clamp(3.5rem,7vw,7.5rem)` pra `clamp(2.1rem,3.6vw,3rem)`; título de card de `clamp(2rem,4vw,4.6rem)` pra `clamp(1.4rem,2vw,1.9rem)`. Título do artigo virou uma classe única (`.title` em `article.module.css`) usada pelo `<h1>` real do site **e** pelo `<input>` do editor — elimina o risco de desalinhamento que já causou um bug de fonte divergente numa fase anterior desta sessão.
5. **Suporte a imagem alinhada/redimensionada no site**: `figure[data-text-alignment]`, `width=` do `<img>`, `figcaption` — verificado offline com `@blocknote/server-util` rodando `blocksToHTMLLossy` fora do navegador (não advinhado da doc).
6. **Preview da Galeria Principal mostra a página `/blog` inteira** (header + hero editável + grade real de artigos publicados, incluindo o card em destaque + rodapé) — antes só mostrava o hero, um recorte. A grade em si **não é editável** aqui (decisão explícita, ver "Pendências").
7. **Conteúdo da Galeria Principal recuperado**: o `<span>` roxo de "na era dos agentes." (cor própria, `#b695d9`) tinha sido achatado pra texto simples pelo `tryParseHTMLToBlocks` ao converter o HTML legado — o site continuava certo (nunca tinha sido salvo pelo BlockNote), só o preview mostrava sem cor. Reconstruído via `textColor` inline do BlockNote (estilo por trecho, tipo bold/italic — não é prop de bloco) com o hex exato, salvo direto via API. CSS do hero trocado de seletor por nome de tag (`.hero>div`) pra posicional (`.hero>:first-child` / `.hero>:last-child`), porque o BlockNote só produz `<p>`, nunca `<div>`.
8. **Configs de dev server organizadas**: `kalidash-admin-alt`/`kalidash-admin-build` (duplicavam `kalidash-admin`) removidos de `.claude/launch.json`; `kalidash-archive-site` adicionado, apontando pro `.archive/v1.0_site` (porta 3001), fora do workspace pnpm, só como referência visual.

## Commits desta fase

```
a41e863 feat(blog): editor Notion-like com BlockNote, header do blog reduzido
7dd8714 feat(admin): editor do blog fala pt-BR (menu "/", tooltips)
4fdec7d fix(admin): preview do blog tinha fundo branco fixo vindo do BlockNote
25c4839 fix(admin): preview do artigo tinha tamanho/cor de texto errados (BlockNote)
7b5fb38 feat(admin): preview da Galeria Principal mostra a página /blog inteira
edfba16 chore: remove configs de preview duplicadas do admin, adiciona site v1.0 arquivado
```

Todos pushados pra `main` em `https://github.com/tzolkin-collab/Kalidash_Site`.

## Estado técnico atual

- **Portas:** admin 5173, API 8080, site 3000, site v1.0 arquivado 3001 (novo, só referência).
- **Schema:** tabela `Article` (MySQL) ganhou coluna `bodyJson LONGTEXT NULL` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`-equivalente (idempotente, checa "Duplicate column"). Nenhuma migration formal — é feito direto no `ensureBlogSchema()` do Go.
- **BlogSettings**: tabela e rota `/api/blog/settings` existem (trabalho de outra sessão/IDE, não desta), mas **não são a fonte real do hero** — o site consome o `body` HTML do artigo com `slug = 'blog-global'` via `dangerouslySetInnerHTML` (`apps/site/src/app/blog/page.tsx:46`). Confirmado lendo o código, não assumido.

## Riscos e avisos — não resolvidos nesta sessão

1. **`reseed_blog.js` na raiz do repo** tem a senha do MySQL de produção (`easypanel.landcriativa.com`) em texto puro. Não está commitado (arquivo não rastreado), mas existe no disco — cuidado pra não subir sem querer.
2. **Trabalho paralelo em andamento** (outra sessão/IDE, não esta): arquivos novos não commitados em `apps/site` (`MotionView.tsx`, `Iphone3D.tsx`, `ParticleImage.tsx`, novos assets em `public/`) parecem reintroduzir a landing Motion no site novo — isso contraria a decisão registrada de 26/09 ("site vem depois do admin, Motion fica arquivada"). Não mexi nisso; só um aviso pra quem retomar não presumir que está resolvido.
3. **Inconsistência de tema não resolvida**: a lista (`/blog`, fundo escuro) e o artigo (`/blog/slug`, fundo claro) têm cores opostas hoje. Perguntei ao usuário se deveria unificar — a resposta ("Não entendi") não fechou a decisão, e o fio se desviou pra outros problemas antes de voltar ao tema. **Decisão em aberto.**

## Pendências / decisões em aberto

- **Cards de artigo na Galeria Principal não são editáveis.** O usuário pediu (resposta de múltipla escolha, todas marcadas): escolher/reordenar qual artigo é destaque, editar título/resumo/imagem direto pelo card, e mudar posição/tamanho dos cards como blocos — "aquela lógica do Notion que tínhamos feito só que com o CSS pronto". Isso significa construir um **block type customizado do BlockNote** (`createReactBlockSpec`) que referencia um Article real, é arrastável/editável nativamente, e onde a posição no documento (1º bloco = destaque) espelha a mesma regra que o site já usa (`index === 0`). Não foi iniciado — é o maior pedaço de trabalho ainda em aberto.
- **Resize de imagem e drag-reorder de bloco não foram confirmados via automação** (limitação da ferramenta de teste — drag sintético de um passo só não dispara os eventos intermediários que o ProseMirror precisa). Alinhamento de imagem e toolbar de formatação foram confirmados ao vivo. Recomendo o usuário testar manualmente pelo menos uma vez.
- **Tema claro/escuro** entre `/blog` e `/blog/slug`: decisão não tomada (ver acima).
- Artigo de teste usado nas verificações (`checklist-de-qualificacao-de-leads`, id `1790727270560522700`) foi devolvido ao conteúdo original depois de cada teste — nenhum dado de teste ficou preso nele.

## Fora do escopo desta sessão

Não foi alterado: schema do `BlogSettings`, autenticação/RBAC da API (CORS continua aberto), o trabalho da landing Motion em andamento em paralelo, nem a decisão de tema claro/escuro da lista vs. artigo.
