# C1 Baseline (pacote só leitura) — páginas internas do site

Data: 31/10/2026. Checklist: `docs/po/design-site-checklist.md` (seções 2, 3, 7). Método de Web Vitals: `docs/web-vitals.md` + `docs/web-vitals-medir.mjs`.

**Estado do repositório na medição**
- `HEAD` de partida: `ea5d0b30b034b21e45d9ab6fc43375147300fad0`. Durante o trabalho o `HEAD` virou `21e78bc` (outras sessões commitaram só `docs/po/*`: D0, D1 e relatório d0-d1). Nenhum commit tocou `apps/site` desde o início.
- `git status --short apps/site`: **23 entradas** (19 `M`, 4 `??`), iguais às do começo da sessão. O dono **ainda não commitou** o trabalho aberto em `apps/site`, então **a baseline vale para o estado do disco nessa janela** (31/10). Se o dono commitar depois, as medições continuam válidas para o hash em que foram feitas, mas a comparação com o pós-trabalho precisa ser refeita no mesmo ponto.
- Medições feitas com `next build` + `next start -p 3199` sobre esse disco, com `API_URL=http://localhost:8199` (servidor falso do blog, fora do repo).

## 1. Itens do checklist

| Item | Status | Evidência |
|---|---|---|
| 3.1 Copy-baseline das 10 rotas | ⚠️ | `docs/po/relatorios/copy-baseline/*.txt` (10 arquivos, 421 linhas). Blog com dados falsos (ver 4). `/diagnostico` só com o passo 1 (ver 4). `node docs/po/relatorios/copy-diff.mjs` → 10× `OK`, exit 0. Não testei o caminho de falha com uma alteração real de texto. |
| 3.2 Web Vitals baseline (mediana de 3, móvel e desktop) | ✅ com ressalvas | `docs/po/relatorios/webvitals-baseline.json`: 10 rotas × 2 presets. Ver 2. |
| 3.2 CLS em 390, 900, 1440 | ✅ | Mesmo JSON, campo `cls_scroll` por largura, via `design-craft/scripts/cls.mjs`. |
| 3.5 Capturas "antes" em 1440, 1024, 768, 390 | ✅ | `docs/po/relatorios/antes/<rota>-<largura>.png`: 40 PNGs, 13 MB, resolução real (`shot.mjs`, seletor `main`). |
| Subir o site em produção local | ✅ | `next build` ok (rotas de todas as páginas geradas); `next start -p 3199` respondeu 200 para todas as rotas medidas. |
| Preview de dev `kalidash-site` | ❌ | `preview_start kalidash-site` subiu em 3001 e o processo saiu com código 1 após 3 s (não respondeu HTTP). Não investiguei a causa. Usei o servidor de produção, que é o que vale para Web Vitals. |
| Servidor falso do blog | ✅ | Fora do repo, em `…/scratchpad/blog-fake/server.mjs`, porta 8199: 5 artigos `artigo-1..5`, `/api/blog/categories` vazio, `/api/blog/settings` 404. |
| Script `copy-diff.mjs` | ✅ | `docs/po/relatorios/copy-diff.mjs`. Modo padrão compara; `--save` regrava a baseline. |

## 2. Web Vitals baseline (resumo; números completos no JSON)

Simulado (padrão do script). Mediana de 3 por página.

- **Móvel:** LCP entre 3.001 ms (`/blog`) e 4.046 ms (`/sobre-nos`); TBT entre 38 e 75 ms; CLS 0 em todas. Perf 87 a 94.
- **Desktop:** LCP entre 584 ms (`/diagnostico`) e 822 ms (`/sobre-nos`); TBT 0; CLS 0; Perf 99 a 100.
- **CLS por scroll (cls.mjs):** 0,000 em todas as rotas e larguras, exceto `/blog` a 1440: 0,003 (1 deslocamento). Abaixo do limite de 0,1.
- Ressalva do método: o INP não é medido (substituído por TBT, como em `web-vitals.md`). O LCP simulado é dominado pelo modelo de rede.
- O primeiro lote do Lighthouse saiu sem `/sobre-nos`: o Git Bash converteu o `/` inicial em caminho do Windows (`INVALID_URL`). Rodei a rota de novo com `MSYS_NO_PATHCONV=1` e juntei os resultados no JSON. Todas as 20 combinações estão presentes.

## 3. Arquivos alterados neste pacote

- `docs/po/relatorios/copy-diff.mjs` (novo)
- `docs/po/relatorios/copy-baseline/*.txt` (10 arquivos, novos)
- `docs/po/relatorios/webvitals-baseline.json` (novo)
- `docs/po/relatorios/antes/*.png` (40 arquivos, novos)
- `docs/po/relatorios/c1-baseline.md` (este arquivo)

Nada em `apps/` foi editado. Nenhum `.env` foi lido nem alterado. Nada de produção foi tocado (o `API_URL` local vem de variável de ambiente no `next start`).

## 4. O que ficou de fora e por quê

- **Blog com dados falsos.** O servidor falso devolve 5 artigos sintéticos, então `copy-baseline/blog.txt` e `blog-artigo-1.txt` congelam a estrutura da página, não o texto real. Quando o blog real estiver no ar, a baseline do blog precisa ser refeita.
- **`/diagnostico` com passo único.** A página mede 844 px de altura, só a viewport. O texto e a captura cobrem só o primeiro passo do formulário. Não verifiquei os passos seguintes (🟡 suspeito de container de altura fixa). Antes de usar esta baseline para aceite, é preciso capturar cada passo.
- **Rotas de categoria** (`/blog/categoria/[slug]`) e `/consultoria-governanca-ia`, `/spectra-ai`: fora do escopo desta lista.
- **Texto de imagens e alt** não entram no `innerText`. Só o texto visível do `<main>`. Atributos `alt` e `src` continuam fora do diff (ver checklist 3.1, que trata `alt` como cópia editorial).
- **Capturas** feitas só do elemento `main` (não da página inteira em 1440 com cabeçalho e rodapé) e com viewport de 900 px de altura. Não há captura de estados interativos (menu mobile aberto, FAQ expandido).
- **Teste negativo do `copy-diff.mjs`.** Rodei só o caminho "OK". Não alterei texto para ver a saída de diferença.

## 5. Riscos

- A baseline está presa ao disco de 31/10. Qualquer commit do trabalho aberto em `apps/site` altera a árvore; a comparação do C2 tem que cair no mesmo estado ou usar o hash de partida.
- Medição no mesmo PC com outras sessões ativas: o Lighthouse foi rodado com as outras sessões em segundo plano, então LCP/TBT têm ruído. A mediana de 3 reduz, mas não elimina.
- A sessão C1 não confirmou o CLS em `/diagnostico` no passo 2 e seguintes (ver 4).

## 6. O que o dono precisa fazer

1. Commitar (ou dizer o hash de partida que vale) o trabalho aberto em `apps/site/src/app/institucional`, `diagnostico`, `blog`, `home`, `layout.tsx` e `lib/siteUrl.ts`, para que a baseline fique presa a um commit. Hoje ela vale só para o disco de 31/10.
2. Dar acesso ao blog real (ou aprovar o servidor falso como fonte oficial da baseline de blog).
3. Confirmar se `/diagnostico` tem mais de um passo que deve entrar na baseline.

## 7. Perguntas de produto para o PO

- A baseline de copy do `/diagnostico` deve cobrir os passos do formulário? Ou só o primeiro (o que o visitante vê ao abrir)?
- O blog deve ser medido com os dados reais de produção ou com o servidor falso de 5 artigos? Os dados reais mudam a baseline do LCP do artigo.

## Commits

Ver `git log -1 --format=%H%n%s` após o commit desta sessão (mensagem `docs(po): baseline C1 das páginas internas`).
