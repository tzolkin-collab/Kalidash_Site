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
| D0+D1 Direção | sessão designer | 8,0 (31/10); 9,0 após correções (c608559, a091e0a); **revisto para 8,0 em 31/10** (revisão visual: falta vida e variação de ritmo, rodada 2) | commits `65a4952`, `09b1805`, `21e78bc`; vi protótipos de Sobre nós e Kognis (editorial, régua, sem cartões) | -1 Soluções/Spectra sem âncora; -0,5 mobile dos protótipos e FAQ incompletos; -0,5 sem diff de copy; Kognis sem tela real |

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
- **D11 (31/10)** Trabalho aberto de `apps/site` commitado pelo PO em 4 commits (`1a7a31c` home, `6df114f` GTM/atribuição/domínio, `77e7a18` blog, `dc65771` sobre-nos). 🟡 A baseline C1 foi tirada com esse disco: mudanças de texto do Sobre nós (marcadores 01-03 removidos, legendas das fotos trocadas por uma nova) estão na baseline e o diff de copy não as pega; origem (Carol?) não confirmada.
- **D12 (31/10)** Critério novo de design, dito pelo dono: olhar a imagem, não o código. Direção precisa de "assinatura" por página, ritmo sem repetir padrão em seções vizinhas, foto real em escala grande e um micro-movimento por página.
- **D13 (31/10)** Rodada 2 do D1 vista em PNG real: 8,5. Fortes: Advisory, Execução, Sobre nós (hero). Fracos: Kognis/Spectra dependem de caixas vazias para prints inexistentes (não podem ir ao ar); Spectra repete a foto do herói do Sobre nós; "Nossa história" ainda é régua repetida. Devolvido para 9. Dev só começa após aceite.
- **D14 (31/10)** Rodada 2.1 do D1 aceita com 9,0 (commit `567212f`; vi `estados-spectra.png` e `02-kognis-sem-tela-1440.png`). Versão SEM tela é o layout que vai ao ar em Kognis e Spectra; tela real = slot opcional. Aprovado: Spectra usa `home/g10-agir.jpg` (mesmo `alt` atual; já pública na Home); busto `kalidash-motion-statue.jpg` atrás dos números do Kognis (arte da marca já em `public/`, não conta como segundo visual). Trocar o `src` do Spectra é a única mudança de dado permitida em `pages.ts`, e só dessa linha.
- **D15 (31/10)** Código começa: B0 (fundação CSS institucional) e B5 (Diagnóstico) em paralelo (arquivos distintos). B1..B4 em fila depois de B0 aceito; B6 (Blog) depois de B5, para limitar workers de código por vez.
- **D16 (02/11)** Fato novo: o commit `30a18cb` (outra sessão, 01/11) reescreveu as páginas com `KitPage` (/advisory, /execucao, /treinamento-corporativo-ia), `ProductPage` (/kognis, /spectra), `SobreNosPage` e `SolucoesStory`, e mexeu na Home e no Blog. Os pacotes B1..B4 baseados em `SitePage` ficam **obsoletos**; o trabalho vira revisão do que está no ar. B0 reescopado: teto de tamanho dos lemas, cabeçalho fixo cobrindo texto, estátua da Home (pedido do dono em 02/11). C2 (auditoria do 30a18cb) em andamento. B5 (Diagnóstico) segue valendo.
- **D17 (02/11)** Dono confirmou: o texto novo do Sobre nós (marcadores e legendas) veio da Carol, então a baseline C1 vale como copy de partida. Spectra: ainda sem prints/tela; segue o layout sem tela (D14). Dono iniciou B0 e B5 e conferirá depois.
- **D18 (02/11)** Cookies: o dono quer aviso de cookies "só para dados vitais". Interpretação do PO 🟡: aviso curto e discreto; sem consentimento não roda nada além do essencial (GTM, `_fbp`/`_fbc`, `attribution` de campanha e o `dataLayer` com objetivos/tamanho da equipe ficam desligados por padrão). Pendente: dono confirmar essa leitura e a Carol/jurídico o texto do aviso (texto novo = decisão deles, não do designer). Pacote futuro B7 (banner + gate do GTM/atribuição), depois de B0.
- **D19 (02/11)** Entregas conferidas pelo PO vendo PNG real: **B5 Diagnóstico 9,0** (`b9b0898`, `929b7b3`; passo 3 em 1440 limpo; ressalvas: botão primário 4,27:1 reprova AA, estado sem endpoint não testado, TBT móvel +44 ms dentro do ruído). **B0 revisto 8,5** (`770a667`, `1eaac95`; lemas com teto, header sólido, estátua alinhada ao texto, visto em advisory-1440 e home-1440; ressalvas: LCP/TBT não medidos, numerais 01-03 da faixa preta de Advisory com pouco contraste, baseline de copy do repo ainda é a pré-30a18cb).
- **D20 (02/11)** Em aberto para o dono/Carol: o terracota do botão (`#b6644d`, 4,27:1) é a cor de marca da Home; escurecer só nas internas criaria inconsistência. Decisão de marca, não minha.
- **D21 (02/11)** C2 (`e21753d`, snapshot 9bf172f; B0/B5 não medidos) lida pelo PO. Texto "novo" nas internas: conferi que "O resultado não aparece no certificado…", "Quando isso acontece, a gente constrói.", "Sobra tempo pra fazer…", "A operação fala e o Spectra AI traduz." e os CTAs já estavam em `pages.ts` desde commits de copy aprovada (b60e810, 73e122a): o 30a18cb passou a **exibi-los**, não os inventou. Aberto para o dono/Carol: (a) 6 descrições de card de /solucoes sumiram; (b) numerais 01/02/03 ocultos; (c) CTAs repetidos ao fim das páginas; (d) depoimentos novos na Home sem fonte no repo. Regra 3.3 (Home intacta) deixa de valer: o dono autorizou mudanças na Home. Baseline de copy deve ser regenerada num commit consciente após essas decisões. LCP móvel piorou em /solucoes (+390 ms) e /spectra (+263 ms): imagem virou o LCP; reavaliar com mais execuções e `priority`/tamanho da imagem. C2 ainda sem overflow/console e 28 de 33 CLS.
- **D22 (02/11)** Respostas do dono à C2: (a) restaurar as 6 descrições de card de /solucoes a partir do histórico aprovado; (c) CTAs repetidos ao fim das páginas podem ficar; Kognis: sem print nem tela de produto, a página é só hero e o botão leva a `kognis.com.br` (**D8 encerrada para o Kognis**); Spectra segue sem print e sem tela. (b) numerais 01/02/03 e (d) depoimentos da Home: **aguardando resposta** (dono não entendeu a pergunta; não mexer). B8 brifado (proposto): textos de /solucoes, href do Kognis, LCP móvel de /solucoes e /spectra.
- **D23 (02/11)** Decisão do dono (exceção à D7, só Kognis): /kognis fica SÓ com o hero (eyebrow, título, apoio, selos, botão "Agendar demonstração", foto do casal) + cabeçalho e rodapé. Todo o conteúdo abaixo sai da página (números, três soluções, atendimento 24h, financeiro, passos, FAQ). Os textos permanecem em `pages.ts`, só não renderizam (reversível). O JSON-LD FAQPage do Kognis sai junto. Botão leva a `kognis.com.br` em nova aba. **A Carol precisa saber**: isso remove copy dela do ar. A baseline de copy do Kognis é regenerada pelo PO num commit consciente após o B8. B8 reproposto com esta decisão.
- **D24 (02/11)** B8 conferido (vi `depois-kognis-1440` e `-390`: hero bate com o print do dono; HTML sem FAQ/ld+json; botão para kognis.com.br em nova aba): **8,5** (`f750e08`, `b89e034`, `46d6180`, relatório `d4fa8ac`). Causa das "descrições sumidas" de /solucoes achada: regra CSS que as escondia em celular baixo e o `copy-diff` rodando em janela 800x600; corrigido. Desconto: LCP móvel de /solucoes e /spectra **não resolvido** (+470 a +690 ms contra C1 no modelo simulado; LCP real ~200 ms; métrica bimodal). Aceito como risco conhecido: o ganho exige mexer em peso de imagem/fontes. Reavaliar na C3 com publicado.
- **D25 (02/11)** Baseline de copy: só regenero depois que o dono responder os numerais 01/02/03 e os depoimentos da Home; Kognis (só hero) entra nessa regeneração. C3 (auditoria final) espera isso.
- **D26 (02/11)** Frente de marca (B9, `docs/po/briefs/b9-marca.md`) **PAUSADA** por decisão do dono: ele já aprovou a Home e o escopo do brief (marca em tudo, inclusive Home) foi grande demais. B9 foi iniciado e o que ele deixou sem commit em `apps/site` foi revertido pela sessão que atende o dono (backup fora do repo: `b9-backup.patch` e `b9-home-marca.module.css`). **A Home não é mais tocada.** Proibido: iniciar novos devs de visual e espalhar tokens globais (um `--color-limestone` global mudaria todas as páginas). Se o dono retomar, será por pedido dele, **uma página interna por vez**, com antes/depois mostrado a ele **antes** de commitar. `apps/admin` e `apps/api` são de outra frente: não tocar. Fica valendo D23-D25 e o restante do plano (cookies, Blog, C3) sem novo código de visual até ele pedir.
- **D27 (02/11)** Dono decidiu, sem mais perguntas a ele: numerais 01/02/03 ficam **removidos** (marcadores vieram da Carol, D17); depoimentos novos da Home **ficam** (tudo veio da Carol, commit `1a7a31c`); CTAs repetidos ficam. C3 (baseline regenerada + auditoria final) em andamento na sessão de baseline. Servidores locais 3000/5173/8080 não reiniciar; API local aponta ao banco remoto: só leitura.

## 11. Triagem da revisão externa e do Brand Guide (02/11)

Fontes: `docs/po/design/marca/revisao-site.txt` e `brand-guide.txt`. Critério: só design/UI, copy intocável. Estado conferido por `grep` nos CSS e nos relatórios (não por captura nova): 🟡 onde só li o código. **Frente de marca pausada (D26): nada daqui entra sem o dono pedir, uma página interna por vez, antes/depois a ele antes do commit.**

| Item da revisão | Estado hoje | Classe |
|---|---|---|
| Tokens Imperial `#28183B`, Ink `#19171B`, Aubergine `#46304F` | já são variáveis do site (14, 8 e 1 usos nos CSS) | já feito |
| Hellenic Gold `#A88A58` pontual | 4 usos soltos nos CSS, sem papel de token | a fazer (pequeno) |
| Terracota `#B7654D` só como apoio | cor primária de botão, eyebrow e links (~25 usos de `#b6644d`; é a mesma cor da Home aprovada) | precisa de decisão do dono (ligada a D20, contraste do botão 4,27:1) |
| Fundo Limestone `#F1ECE4` no lugar do branco | não usado; páginas internas em branco/`#f9f8f7` | precisa de decisão do dono (token global mudaria todas as páginas; D26 proíbe espalhar) |
| Seções escuras em Imperial em vez de preto (rodapé, faixas, linha do tempo) | faixas e rodapé em preto `#111` | a fazer por página; **conflito**: dono elogiou "os detalhes em preto" no Advisory (D12). Perguntar antes de trocar |
| Fonte Kepler Std + Acumin | `globals.css` já declara `--font-display` Fraunces (provisória) atrás de variável; Kepler é Adobe Fonts | decisão do dono: licença/acesso Adobe Fonts para trocar; Fraunces fica provisória |
| Numerais em ouro serifa (i. ii. iii.) | D27: ficam removidos (dono) | decidido: não fazer; se voltarem, voltam assim |
| Advisory: itens 01-05 não são sequência, usar lista com filete | marcadores já ocultos (D27); lista em filete já no Kit | já feito 🟡 |
| Remover esfera de partículas, texto fantasma, textura pontilhada, faísca no botão, bolha de WhatsApp | estão na Home (`ProblemHologram`, botão do hero, bolha em todas as páginas) | **Home fora (D26)**; bolha do WhatsApp nas internas: precisa de decisão (muda o canal de contato visível) |
| Greca em faixa cinza de largura total (faixa grega no fim do hero) | presente (ex.: `/kognis` hero) | a fazer por página, pequena e em ouro; precisa do dono |
| Ritmo claro/escuro alternado | feito nas internas (faixa preta/branca/warm) | já feito |
| Bloco de fechamento terracota 100% | existe (ex.: Advisory) | precisa de decisão do dono (D12: gostou dos detalhes escuros; o terracota inteiro é outra coisa) |
| Frases-manifesto em serifa itálica | teto de tamanho feito (B0, D24); serifa itálica não | a fazer por página, depois da decisão de fonte |
| Advisory: foto de banco → foto real do Comitê de IA | usa `metodo-reuniao.jpg`; `home/front-2-comite.jpg` existe no repo | a fazer, **trocar `src`/mídia editorial = decisão do dono** (regra 3.1 do checklist) |
| Sobre nós: foto do capacete grande abrindo "O chão da operação" | é parte de um mosaico (D17: veio da Carol) | a fazer por página, sob pedido do dono |
| "Parceira" e "Finalista" como selos, não números | `AnthropicPartnerBadge` existe na Home; na faixa de números do Sobre nós ainda aparecem como palavra grande 🟡 | a fazer, sob pedido do dono |
| Diagnóstico: painel Imperial em vez de preto | B5 (9,0) já usa moldura warm/paper; sem painel escuro | já feito diferente; sem ação |
| Diagnóstico: inverter a ordem dos passos | mexe em fluxo e em validação | **só sugerir ao dono**; não implementar |
| Faixa de prova na 1ª dobra (Onde aplicamos / ensinamos) | já no painel do Diagnóstico; na Home não (fora) | Home fora; nas internas, sob pedido |

**Mexem na copy da Carol (não aplicar; decisão do dono/Carol):** novo H1 e eyebrow do hero da Home; unificar CTAs (D22c: dono manteve os repetidos); trocar números ("10 mil / 64 / 500+" vs "170"); frase-assinatura invertida entre Home e Sobre nós; cards "DEPOIMENTO REAL" vazios e foto do André (D27: depoimentos novos ficam); dois nomes para o Diagnóstico ("Sessão de Diagnóstico Estratégico" na aba, "Diagnóstico operacional" no eyebrow).

**Pendente do dono:** os dois áudios que a sessão que o atende não conseguiu ouvir; aviso de cookies (D18); cor do botão (D20); prints do Spectra.
- **D28 (02/11)** Dono pediu a frente de marca em áudio; **D26 sai só para** `/advisory`, `/execucao`, `/treinamento-corporativo-ia` (sistema nasce em `KitPage`/`kit.module.css`) e para o ajuste de tamanho/organização em `/sobre-nos`. A Home não muda (exceto a estátua, já feita). Revisão externa e mockups = referência de fluidez, não para copiar. Decisões: fonte da marca em vez de Inter (Kepler+Acumin são Adobe Fonts sem licença no projeto: **Fraunces provisória + Archivo, atrás de variáveis**; o dono precisa providenciar acesso Adobe Fonts para trocar); paleta Limestone/champagne + dourado `#A88A58` + preto + roxo escuro; dourado na palavra final das frases-manifesto (span, texto idêntico); manifestos mais baixos no desktop (~34-36px); Sobre nós com seções menores e frases inteiras; mais dourado e filetes; pensadores/estátua só com imagens que já estão no repo; **uma página por vez, antes/depois ao dono antes do commit**. Brief: `docs/po/briefs/b10-marca-paginas.md`. Seção 11 (triagem) segue como referência; "Cor do botão", "Limestone global" e "Preto→Imperial" ficam dentro de cada página, sem token global.
- **D29 (02/11)** C3 (`feae420`, HEAD 13853c9) **reprova** o critério 3.2: LCP móvel de /solucoes 3221→4844 ms e /spectra 3227→4815 ms (também Home 4445 ms), causa ligada ao padrão de seção fixada com cortina (o elemento de LCP virou `<i>`/imagem); B8 não resolveu. Copy: nenhuma página igual à C1 byte a byte; além das decisões do dono, ficam a confirmar: dois-pontos sumidos nas 4 frases de AI Culture, separador "·" de /solucoes, "TE" do avatar no artigo, e que o FAQ/soluções do Kognis saem de fato. Diagnóstico: o copy-diff só cobre o passo 1. Ações: B11 (LCP, proposto) ataca a causa. Referência de movimento do dono: `studionextlevel.com.br/kyvo/` (seção fixada + cortina, cabeçalho com número e progresso), adaptada à marca (Imperial/Limestone/ouro, fonte D28), com regras: copy intocada, teto D24, celular empilhado e testado, sem rolagem lateral, conteúdo nunca nasce escondido, **orçamento de LCP**: seção fixada não pode atrasar o primeiro paint. Formato: uma sessão por página, uma de cada vez, Advisory → Execução → AI Culture; cada uma entrega antes/depois em PNG real + sequência de quadros do movimento; **dono aprova antes do commit**. B10 segue com o Advisory.
- **D30 (04/11)** Frente "Ajustes V3" da Carol, em duas sessões (briefs `docs/po/briefs/v3-*.md`). Dono liberou a Home (revê D26/D28 nesta frente), hero da Home em Imperial, troca da foto do hero do Advisory pela do Drive com recorte, CTA do case para `/blog?categoria=cases`. Cabeçalho congelado e nenhuma animação pode se perder. Kit Adobe `krs4uwp` substitui a Fraunces no `<main>` das páginas da frente; demais páginas migram numa etapa posterior, antes de publicar. Aguardando a Carol: números de AI Culture, lista Kognis/Spectra em Execução, logos e pesos Light/Semibold do kit. Na revisão da primeira rodada, o dono confirmou a foto do Drive mesmo avisado da perda de nitidez e da comparação com a Escola de Atenas.
- **D31 (04/11)** Dono aprovou cabeçalho roxo no topo da Home, igual ao Advisory, por ajuste de página: os arquivos do cabeçalho continuam intocados. Pendente: mostrar o bloco do problema no celular.
- **D32 (05/11)** Dono recusou as direções A e B do redesenho e escolheu a Home de 02/11 (`13853c9`) como referência visual, com fundo branco e fotos grandes, mantendo Kepler e Acumin, a copy atual, os 28 logos em cor, o bloco roxo e o holograma. Sintomas de "O Problema" abertos, sem lista comandando retrato. Revê a parte de fundos da D30 na Home. Brief: `docs/po/briefs/home-0211.md`.
