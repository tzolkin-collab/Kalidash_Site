# Design do site público (páginas internas): checklist do PO

> PO: Claude. Início: 31/10/2026. Prompt-base: `docs/po/prompt-po-reutilizavel.md`.
> Estado: **planejamento pronto; workers só começam depois que o dono commitar o trabalho aberto em `institucional/` (decisão D1).**

## 1. Objetivo e definição de pronto

As páginas internas do site (fora da Home) estão simples e chapadas. O objetivo é elevar **só o design (UX e UI)**: layout, tipografia, espaçamento, hierarquia, cor, imagem/ilustração, movimento, componentes e responsivo.

**Pronto quando, para cada página do escopo:**
1. Foi vista funcionando no navegador, em 1440, 1024, 768 e 390, sem rolagem horizontal e sem erro de console.
2. Passa na auditoria de ai-slop (seção 6) sem nenhum "tell" proibido.
3. **Copy idêntica**: nenhum texto, título, rótulo, alt de imagem editorial ou ordem de conteúdo mudou (aceite 3.1).
4. Sem regressão de Web Vitals (aceite 3.2).
5. A Home não mudou (aceite 3.3).
6. Reaproveita o sistema visual da Home (tokens em `home/home.module.css`: `--ink #28183b`, `--purple #462f4f`, `--accent #b6644d`, `--line`, `--container`, `--font-title` = Inter). Nada de segundo visual.

## 2. Estado de partida (31/10/2026)

**Escopo (decisão do dono, 31/10):** 7 institucionais + Diagnóstico + Blog. Home fora.

| Página | Rota | Origem do código |
|---|---|---|
| Sobre nós | `/sobre-nos` | `institucional/SitePage.tsx` + `pages.ts` (`sobreNos`: heroMedia, timeline, beliefs, team, proof) |
| AI Culture | `/treinamento-corporativo-ia` | idem (`aiCulture`: heroMedia, proofBar, text, steps, formats, testimonials) |
| Advisory | `/advisory` (e `/consultoria-governanca-ia`, mesmo conteúdo) | idem (`advisory`: heroMedia, text x2, cards, steps, list, faq) |
| Execução | `/execucao` | idem (`execucao`: heroMedia, text, cards, steps, showcase) |
| Soluções | `/solucoes` | idem (`solucoes`: hero, offers) |
| Kognis | `/kognis` | idem (`kognis`: heroMedia, proofBar, cards x3, steps, faq) |
| Spectra AI | `/spectra` (`/spectra-ai` redireciona) | idem (`spectra`) |
| Diagnóstico | `/diagnostico` | `diagnostico/DiagnosticoClient.tsx` + `diagnostico.module.css` |
| Blog (lista, categoria, artigo) | `/blog`, `/blog/categoria/[slug]`, `/blog/[slug]` | `blog/views.tsx`, `blog.module.css`, `blog/[slug]/article.module.css` |

**Fatos que mudam o plano:**
- As 7 institucionais compartilham **um único molde** (`SitePage.tsx`, 633 linhas, 1021 de CSS). Melhorar os blocos (`cards`, `steps`, `text`, `list`, `faq`, `offers`, `proof`, `timeline`...) melhora as 7 de uma vez. Por isso o trabalho se organiza **por bloco**, não por rota.
- O blog tem contrato de design em `docs/blog-design-contrato.md`: o admin e o preview dependem dos atributos `data-block`, `data-role`, `data-variant`, `data-focus`, `data-block-id`. **Nunca renomear nem remover.**
- Há ~650 linhas **não commitadas** de outra sessão em `institucional/{SitePage.tsx, pages.ts, institucional.module.css}`, `diagnostico/DiagnosticoClient.tsx`, `blog/{views.tsx, blog.module.css}` e na Home. Elas são o ponto de partida real; ver D1.
- Um worker de ideação/outra ferramenta (Antigravity) pode editar o site em paralelo (memória do projeto, 18/10). Cada worker lê o arquivo de novo antes de editar.

### Diagnóstico do "chapado" (primeira passada; designers refinam com capturas reais)

Visto no navegador (painel ~800 px) e no código:
- **Receita repetida em toda seção:** eyebrow em caixa-alta + título grande à esquerda + corpo à direita, separadas por linha fina. Sete páginas viram a mesma página.
- **Cardificação:** `cards`/`offers`/`proof` são grades de caixas iguais com título + 2 linhas (ex.: Spectra, três caixas "Leitura em tempo real / Dados de produtividade / Oportunidades claras"). Sem objeto real como protagonista.
- **Blocos de destaque genéricos:** `highlight` e `closing` são uma caixa com barra lateral terracota (tell clássico).
- **Pouca vida:** só `Reveal` de opacidade; nenhuma peça com ponto de vista (diagrama, número dominante, imagem trabalhada, ritmo de escala).
- **Vazios grandes:** em `/kognis` apareceram faixas brancas enormes na rolagem. 🟡 HIPÓTESE: `Reveal` não dispara no salto de rolagem, ou espaçamento excessivo. Confirmar no navegador.
- **Hierarquia fraca:** quase tudo no mesmo cinza (#3c373f / #514c53), pouco contraste entre níveis; pouca variação de escala.
- **FAQ, passos e listas** sem tratamento próprio (provavelmente texto em linhas).

## 3. Aceite testável (vale para todo pacote)

**3.1 Copy idêntica.** Antes de começar, o worker gera o texto visível de cada página em `docs/po/relatorios/copy-baseline/<rota>.txt` (via `get_page_text` ou `innerText` do `<main>`, no commit de partida). No fim gera de novo e roda `diff`. **Diferença = reprovado** (exceto espaço em branco). `pages.ts` e `content.ts`: só estrutura de tipos pode mudar, **nenhuma string**. Se um bloco novo precisar de dado (ex.: ícone, `variant`), pode ser campo novo sem texto. Imagens: `alt` e `src` editoriais não mudam; trocar imagem só com decisão do PO.

**3.2 Web Vitals.** Seguir `docs/web-vitals.md`. Meta: LCP, CLS e TBT de cada rota não piores que a baseline (medir antes e depois, mediana de 3). CLS < 0,1 em 390, 900 e 1440 (`cls.mjs` da skill design-craft). Sem fonte nova, sem biblioteca pesada, imagens com `next/image` e dimensões. Animação só `opacity`/`transform`, respeitando `prefers-reduced-motion`.

**3.3 Home intacta.** `git diff <base> -- apps/site/src/app/home apps/site/src/app/page.tsx` vazio, **exceto** se o dono já tinha alterações abertas lá (D1). Mudanças em arquivo compartilhado (`home.module.css`, `SiteFooter`, `HomeHeader`) são proibidas; se precisar, criar token/classe no CSS institucional.

**3.4 Responsivo e a11y.** 1440 / 1024 / 768 / 390 sem overflow horizontal; alvos de toque >= 44 px; foco visível; contraste AA em texto; um `h1` por página; ordem de leitura = ordem original.

**3.5 Visto no navegador.** O worker anexa capturas **em resolução real** (PNG via `scripts/shot.mjs` da skill design-craft, não miniatura do painel) de cada seção alterada em 1440 e 390. "Compila" não é aceite.

**3.6 Sem quebra.** `pnpm --filter @kalidash/site lint`, `tsc --noEmit` e `build` passam. Blog: atributos do contrato preservados (`grep` antes/depois). JSON-LD da FAQ preservado. `/spectra-ai` e `/consultoria-governanca-ia` continuam funcionando.

## 4. Pacotes de trabalho (WP)

Regra: pacotes de código rodam **um por vez por conjunto de arquivos**. Design (designers) é só leitura/protótipo e roda em paralelo.

### Fase A: direção (designers, não escrevem em `apps/site`)

Saída em `docs/po/design/` (markdown + imagens/HTML de protótipo, fora de `apps/site`).

| WP | Escopo | Entrega |
|---|---|---|
| **D0 Sistema** | Tokens e escala para páginas internas, em cima do que a Home já usa: escala tipográfica (título/subtítulo/corpo/legenda), espaçamento 8pt, 1 família de raio, 1 de sombra, papéis de cor, ritmo de seção (claro, escuro, imagem cheia), grade. Biblioteca de **bloco -> tratamento** (cada tipo de bloco de `SitePage` com 1 tratamento definido e **sem repetir a receita**). | `docs/po/design/00-sistema.md` + `tokens.css` proposto |
| **D1 Institucionais** | Direção e protótipo (HTML estático em `docs/po/design/proto/`) das 7 páginas, por seção: papel, objeto protagonista, número/frase dominante. Inclui o relatório de referências (seção 5). | `docs/po/design/01-institucionais.md` + protótipos |
| **D2 Diagnóstico** | Idem para `/diagnostico` (formulário em contexto, confiança, estados de erro/sucesso). | `docs/po/design/02-diagnostico.md` + protótipo |
| **D3 Blog** | Idem para lista, categoria e artigo (leitura longa), respeitando o contrato de `data-*`. | `docs/po/design/03-blog.md` + protótipo |

Cada designer entrega **capturas reais do estado atual** (1440 e 390) de cada página e a auditoria de tells. O PO aprova a direção (nota >= 9) antes de qualquer código.

### Fase B: implementação (devs), depois de D0 aprovado

| WP | Arquivos que toca | Depende de |
|---|---|---|
| **B0 Fundação** | `institucional/institucional.module.css` (tokens no topo, escala, ritmo), `institucional/Motion.tsx` | D0 |
| **B1 Hero + Sobre nós** | `SitePage.tsx` (blocos `hero`, `heroMedia`, `timeline`, `beliefs`, `team`, `proof`), CSS correspondente | B0, D1 |
| **B2 Texto, cards, passos, lista, FAQ** | `SitePage.tsx` (blocos `text`, `cards`, `steps`, `list`, `faq`, `cta`) + CSS | B1 |
| **B3 Ofertas, vitrine, formatos, depoimentos, barra de prova** | `SitePage.tsx` (`offers`, `showcase`, `formats`, `testimonials`, `proofBar`) + CSS | B2 |
| **B4 Passada por rota** | só CSS/props: acertos finos nas 7 páginas, `media.ts` | B3 |
| **B5 Diagnóstico** | `diagnostico/DiagnosticoClient.tsx`, `diagnostico.module.css` | D2 (pode rodar em paralelo a B1..B4: arquivos distintos) |
| **B6 Blog** | `blog/views.tsx`, `blog.module.css`, `blog/[slug]/article.module.css` | D3 (paralelo aos demais) |

`SitePage.tsx` e `institucional.module.css` são o gargalo: B0..B4 em fila, nunca dois ao mesmo tempo. B5 e B6 não tocam esses arquivos.

### Fase C: auditoria (leitura, roda a qualquer hora)

| WP | Escopo |
|---|---|
| **C1 Baseline** | Antes de qualquer B: copy-baseline (3.1), Web Vitals baseline (3.2), capturas "antes" em 4 larguras para as 9 áreas. |
| **C2 Auditoria final** | Diff de copy, Web Vitals depois, varredura de overflow/console em 4 larguras, contrato do blog, Home intacta. |

## 5. Referências âncora (🟡 a confirmar pelos designers abrindo as páginas)

A busca na web desta sessão não devolveu referências úteis (só templates). **Nenhuma referência abaixo foi vista por mim nesta sessão**: são candidatas por conhecimento prévio. O designer D1 deve abrir cada uma, capturar e escrever as 4 linhas (composição, tipo, ar, detalhe) + o que herda e o que recusa, **antes** de desenhar.

| Página | Candidata âncora | Por quê |
|---|---|---|
| Sobre nós | stripe.com/about, linear.app/about, 🟡 revistas editoriais | Prova de pessoas e história com fotos reais, ritmo de escala, sem grade de cartões |
| AI Culture | anthropic.com/learn, 🟡 Maven/Reforge | Formatos de curso e prova social com respiro editorial |
| Advisory | mckinsey.com/capabilities, bcg.com, 🟡 Thoughtworks | Serviço de alto nível, tipografia como protagonista, FAQ discreto |
| Execução | vercel.com/solutions, 🟡 Palantir | Entrega e vitrine com artefato real em vez de ícone |
| Soluções | 🟡 Cohere/Mistral páginas de produto | Dois produtos em contraste claro |
| Kognis / Spectra | linear.app/features, stripe.com/payments | Produto como herói (UI/diagrama), não cartões |
| Diagnóstico | cal.com, stripe.com/contact/sales | Formulário calmo, confiança ao lado |
| Blog | stripe.com/blog, anthropic.com/news, 🟡 Every.to | Lista editorial e leitura longa com medida confortável |

Proibido copiar layout: herdar princípios. Sistema visual da Home tem prioridade sobre a referência.

## 6. Auditoria de ai-slop (todo pacote passa por isto)

Reprovado se aparecer: grade de 3+ cartões iguais; cartão dentro de cartão; caixa com barra lateral colorida como "destaque"; eyebrow + título + cinza em toda seção; ícone no lugar de objeto real; blobs/orbs/brilho neon; entrada escalonada em todo bloco; dois estilos de raio ou sombra na mesma página; invenção de métrica ou depoimento. Ver `~/.claude/skills/design-craft/references/tells.md` e `checklist.md`.

## 7. Regras para todo worker

- Leia primeiro: este arquivo (seções 1, 3, 6, 7), `docs/blog-design-contrato.md` (se blog), `docs/web-vitals.md`, os arquivos do pacote, e a skill `design-craft`.
- **Copy intocável.** Nenhuma string de `pages.ts`/`content.ts` muda. Em dúvida, pare e pergunte no relatório.
- **Não tocar:** `apps/admin`, `apps/api`, Home (`home/**`, `page.tsx`), `.env`, flags, produção.
- `git status` antes; reler o arquivo antes de editar (outra ferramenta pode estar editando); `git add` só dos seus arquivos, nunca `git add -A`; commits pequenos no padrão (`feat(site): ...`, `fix(site): ...`).
- Uma seção por vez: referência, tokens, construir, **olhar em resolução real**, auditar, só então a próxima.
- Prova no navegador (`preview_start kalidash-site`), não só compilação. Capturas reais em `docs/po/relatorios/<pacote>/`.
- Não editar este checklist. Se faltar decisão de produto, pare e pergunte no relatório.
- Relatório em `docs/po/relatorios/<pacote>.md` no formato do apêndice C do prompt de PO.

## 8. Régua de nota

Base: apêndice A do prompt de PO, adaptada.

| Critério | Peso |
|---|---|
| Visto e funcionando no navegador nas 4 larguras, capturas reais (não só código) | 35% |
| Qualidade de design: referência, hierarquia, ritmo, sem tells de ai-slop | 25% |
| Aderência: copy idêntica (diff), escopo, Home intacta, contrato do blog | 20% |
| Web Vitals, acessibilidade, código e CSS no padrão do repositório | 10% |
| Relatório honesto | 10% |

>= 9 aceito; 7 a 8,9 devolve ao mesmo worker com lista; < 7 refaz. **Texto alterado, Home alterada ou regressão de Web Vitals limita a nota a 6.**

## 9. Registro de entregas

| WP | Worker | Nota | Evidência | Descontos |
|---|---|---|---|---|
| C1 Baseline | sessão baseline | pendente de conferência | commit `a003d5c`: copy de 10 rotas, Web Vitals, 40 capturas, `copy-diff.mjs`. Ressalvas: blog com servidor falso, /diagnostico só passo 1, teste negativo do diff não feito; medido com 23 arquivos não commitados | |
| D0+D1 Direção | sessão designer | 8,0 (31/10); revisado 9,0 após correções (c608559, a091e0a) | commits `65a4952`, `09b1805`, `21e78bc`; vi protótipos de Sobre nós e Kognis (editorial, régua, sem cartões) | -1 Soluções/Spectra sem âncora; -0,5 mobile dos protótipos e FAQ incompletos; -0,5 sem diff de copy; Kognis sem tela real |

## 10. Decisões do PO

- **D1 (31/10)** Dono escolheu: ele commita o trabalho aberto em `institucional/`, `diagnostico/` e `blog/` antes de os workers de código começarem. Até lá rodam só pacotes de leitura/direção (C1, D0..D3). 🟡 Pendência do dono.
- **D2 (31/10)** Escopo: 7 institucionais + Diagnóstico + Blog; Home fora (dono).
- **D3 (31/10)** Trabalho por **bloco** do `SitePage`, não por rota, porque as 7 páginas compartilham o molde.
- **D4 (31/10)** Designers entregam direção e protótipo fora de `apps/site`; dev só implementa direção aprovada.
- **D5 (31/10)** Referências citadas são candidatas não verificadas; verificação é tarefa do designer D1.
- **D6 (31/10)** `/consultoria-governanca-ia` e `/advisory` seguem iguais (decisão de URL/301 é da Carol, fora desta frente).

- **D7 (31/10)** Ordem do conteúdo é intocável: sem fundir seções (ex.: Advisory). Tokens aprovados: raio 4/12, sombra só na foto-herói, texto `#a4533c` escopado ao CSS institucional. CTA novo proibido; só reuso de CTA existente com o mesmo rótulo. Hero de /execucao mantém a imagem.
- **D8 (31/10)** Kognis/Spectra: sem tela de produto inventada. Aguardando prints reais do dono.
- **D9 (31/10)** D0/D1 aceito com 9,0: reproduzi `copy-check.mjs` (0 extras nos 6 protótipos) e `overflow-check.mjs` (sem excesso). Espaços K1-K3 e S1 reservados para prints reais. Próximo: D2 (Diagnóstico) e D3 (Blog); código só após o dono commitar o trabalho aberto e aprovar a direção.
- **D10 (31/10)** D2/D3 aceito (9,0). Lista do blog é exceção justificada à regra de grade. Próximo: dono commita o trabalho aberto e aprova a direção; então B0 (fundação).
