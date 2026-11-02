# C2 Auditoria — commit 30a18cb (páginas internas, Home e Blog)

Data: 02/11/2026. Pacote: C2 (só leitura, sem edição em `apps/`). Base: baseline C1 `a003d5c`, com textos em `docs/po/relatorios/copy-baseline/`.

**Snapshot auditado: `9bf172f`** (HEAD no início da auditoria). O HEAD atual é `33cbedd`, que acrescenta `770a667` e `1eaac95` (B0) e `b9b0898` (B5), além de commits só de `docs/po`. **Esses três commits não foram medidos aqui.** O que está abaixo vale para `9bf172f`. Entre `a003d5c` e `9bf172f` o diff de `apps/site` tem 45 arquivos (+2830/-240); o 30a18cb sozinho tem 27 arquivos (+1946/-32).

Ambiente: `next build` isolado em worktrees fora do repo (`9bf172f` na porta 3201; `a003d5c` na porta 3200); servidor falso do blog na 8198 (fora do repo). Nenhuma medição contra produção.

## 1. Itens

| # | Item | Status | Evidência |
|---|---|---|---|
| 1 | Copy-diff contra C1, todas as rotas (incl. Home) | ❌ | Ver seção 2. Há diferença de texto em 7 rotas e na Home. |
| 2 | Web Vitals (mediana de 3) contra C1 | ⚠️ | Seção 3. Sem regressão grande em LCP na maioria; `/solucoes` e `/spectra` pioram no mobile (ver 3). Home sem baseline. |
| 2 | CLS em 390/900/1440 | ⚠️ não concluído | 5 de 33 medições rodadas, todas com CLS 0. As demais não foram medidas. |
| 3 | Rolagem horizontal e erro de console em 1440/1024/768/390 | ⚠️ não medido | Script escrito (`scratchpad/c2/overflow-console.mjs`), não concluído. Nenhum resultado. |
| 4 | Diff `a003d5c..HEAD` em `home` e `page.tsx`, e o que mudou | ❌ | Seção 4. Home mudou em texto (depoimentos) e em visual (hero, galeria, hologram). |
| 5 | Contrato `data-*` do blog | ✅ | Seção 5. Mesmo conjunto de atributos renderizados em `/blog`, `/blog/artigo-1` e `/blog/categoria/cases`. |

## 2. Copy-diff (HEAD `9bf172f` contra C1)

Lista completa do que mudou no texto visível do `<main>`. Diferenças de caixa-alta podem ser só CSS (`text-transform`), mas o innerText as captura, então entram aqui; cabe ao PO decidir.

**`/sobre-nos` (2 linhas)**
- "DO CHÃO DE OPERAÇÃO À FORMAÇÃO EXECUTIVA" → "Do chão de operação à formação executiva" (caixa).

**`/treinamento-corporativo-ia` (16 linhas)**
- "Turmas a partir de 12 pessoas · Online ou presencial · Carga horária personalizada" → versão em caixa-alta (caixa).
- "Trilhas por área: conteúdo diferente para cada função", "Casos da sua empresa: …", "Uso responsável: …", "Mão na massa: …": os dois-pontos sumiram e a frase quebrou em duas linhas (**texto alterado**: pontuação removida).
- Novo: "O resultado não aparece no certificado. Aparece no trabalho." (**texto novo**)
- Novo: "Solicitar proposta" (**CTA novo**)

**`/advisory` (6 linhas)**
- Somem os números "01", "02", "03" (**texto removido** ou ocultado; confirmar).
- Novo: "Conversar com um sócio" (**CTA novo**).

**`/execucao` (11 linhas)**
- "Escopo, prazo e métricas definidos antes de começar." → caixa-alta; "Finalista Prêmio Inovativos 2026" → caixa-alta (caixa).
- "As reuniões diárias … 97% de encaminhamento definido." quebrou em duas linhas (sem mudança de palavra).
- Somem "01" e "02" (**removido** ou ocultado).
- Novo: "Falar sobre o meu projeto" (**CTA novo**).

**`/solucoes` (18 linhas)**
- "Tecnologia que nasce de problemas reais." → quebrada em três linhas (estrutura).
- "01 · KOGNIS" → "01" + "KOGNIS"; "02 · SPECTRA AI" → "02" + "SPECTRA AI" (**separador "·" removido**).
- Somem as descrições de cards: "Triagem e acompanhamento automatizados sem perder o contexto de cada cliente.", "Rotinas operacionais organizadas em fluxo contínuo, com menos retrabalho.", "Indicadores do escritório consolidados em tempo real para apoiar decisões.", "Câmeras conectadas ao ambiente físico traduzem a rotina sem interromper o time.", "O que antes dependia de observação manual vira histórico estruturado.", "Identificação objetiva de gargalos e pontos de melhoria na operação." (**textos removidos** ou ocultados; confirmar).
- Novo: "Quando isso acontece, a gente constrói." e "Falar sobre o meu caso" (**texto e CTA novos**).

**`/kognis` (10 linhas)**
- "Sem trocar de ERP · Sem migrar dados · Atendimento 24h no WhatsApp" → caixa-alta (caixa).
- Somem "01/02/03" duas vezes (**removido** ou ocultado).
- Novo: "Sobra tempo pra fazer o que você faz de melhor: advogar." e "Agendar demonstração" (**texto e CTA novos**).

**`/spectra` (7 linhas)**
- "Leitura visual em tempo real …" → caixa-alta (caixa).
- Somem "01/02/03" (**removido** ou ocultado).
- Novo: "A operação fala e o Spectra AI traduz." e "Conhecer Spectra AI" (**texto e CTA novos**).

**`/diagnostico`**: ✅ igual à C1.

**`/blog`**: ✅ igual à C1 (a lista de artigos fictícios bate).

**`/blog/artigo-1` (1 linha)**: sumiu "TE" (iniciais de avatar do autor, provavelmente). Visual, mas é texto visível.

**Resumo:** 7 rotas com diferença de texto (sem contar caixa-alta e quebra de linha, há ao menos 14 textos novos ou alterados, incluindo CTAs e frases de efeito, e pelo menos 12 textos removidos ou ocultados). Pelo critério 3.1 do checklist, isso é **reprovado** até o PO aceitar ou reverter cada item.

## 3. Web Vitals (HEAD `9bf172f`, isolado, mediana de 3)

Comparado com `docs/po/relatorios/webvitals-baseline.json` (C1, disco de 31/10).

| Rota | Móvel LCP (C1→HEAD) | Móvel TBT | Desktop LCP (C1→HEAD) | CLS |
|---|---|---|---|---|
| /sobre-nos | 4046 → 3750 ms | 70 → 59 | 822 → 805 | 0 |
| /treinamento-corporativo-ia | 3624 → 3435 | 64 → 63 | 753 → 693 | 0 |
| /advisory | 3528 → 3443 | 71 → 57 | 697 → 718 | 0 |
| /execucao | 3718 → 3486 | 74 → 60 | 693 → 702 | 0 |
| /solucoes | 3221 → **3611** (+390) | 41 → 48 | 677 → 739 | 0 |
| /kognis | 3479 → 3422 | 38 → 56 | 744 → 674 | 0 |
| /spectra | 3227 → **3490** (+263) | 40 → 56 | 772 → 705 | 0 |
| /diagnostico | 3179 → 3176 | 75 → 90 | 584 → 587 | 0 |
| /blog | 3001 → 3008 | 45 → 47 | 638 → 628 | 0 |
| /blog/artigo-1 | 3213 → 3218 | 40 → 44 | 662 → 664 | 0 |
| **/ (Home)** | sem baseline | 39 (HEAD) | sem baseline | 0 |

- **Leitura:** LCP mobile melhora em 6 rotas e piora em `/solucoes` (+390 ms) e `/spectra` (+263 ms). Em ambas o elemento de LCP mudou de `<h1>` para uma imagem. ⚠️ Pelo critério 3.2, isso é regressão a confirmar com mais execuções. TBT sobe de 40 para 56 em `/kognis` e `/spectra`; são poucos ms, mas também merecem repetição. Desktop: sem regressão grande.
- **Home**: a C1 não incluiu a Home, então não há como comparar. HEAD: mobile LCP 3980 ms, desktop 780 ms, TBT 39, Perf 86 (mobile) e 98 (desktop). O elemento de LCP é uma imagem sem `alt`.
- Ruído: só mediana de 3, em máquina com outras sessões ativas. Diferenças abaixo de ~100 ms não são conclusivas.

**CLS (cls.mjs, 844 px):** 0,000 em 5 medições (`/sobre-nos` 390 e 900; `/treinamento-corporativo-ia` 900 e 1440; `/advisory` 390). As demais (28 de 33) **não foram medidas**.

## 4. Home (`a003d5c..HEAD`, `apps/site/src/app/home` e `page.tsx`)

- Diff: 8 arquivos em `home/` (+228/-158). `page.tsx` sem mudança. Commits que mexeram na Home dentro do snapshot: `1a7a31c` (depoimentos), `dc65771`, `30a18cb`, `77e7a18`, `6df114f`. O B0 (`1eaac95`) mexe em `HomeHero.module.css` e está fora desta auditoria.
- **Texto:** os três depoimentos mudaram. Antes: "Aline Motta, empresária", "Daniel, participante de treinamento Kalidash", "Larissa, participante de treinamento Kalidash". Agora: "Iasmin Ramiro, COO", "Fernando Torquetti, empresário", "Geraldo Nunes, Head de TI", "Daniel Alves, Projetos Logísticos na DHL Supply Chain", "Larissa Gomes, CEO da Aliança Representações", com depoimentos novos. **Sem fonte documentada no repo**: a primeira aparição dos nomes é o commit `1a7a31c`. Pode ser conteúdo fornecido pelo dono (há `depoimento-iasmin.jpg` novo em `public/home/`), mas precisa confirmação de que os depoimentos e as empresas são reais e autorizados. Pelo critério 6 do checklist, depoimento sem origem é reprovação.
- **Visual:** `HomeHero.module.css` novo (+36), `HomePage.tsx` (+27/-…), `ProblemHologram` reescrito, `home.module.css` (117 linhas alteradas). A regra 3.3 ("Home intacta") **não se cumpre**.

## 5. Contrato `data-*` do blog

- Renderizado (HTML do servidor) em `/blog`, `/blog/artigo-1` e `/blog/categoria/cases`: os atributos `data-block`, `data-role`, `data-variant`, `data-focus` e `data-block-id` aparecem com os mesmos valores em `a003d5c` e em `9bf172f`. ✅
- Limite: o artigo de teste não tem `figure`, `data-text-alignment` nem blocos de corpo complexos, então esses atributos não foram verificados no render.
- A contagem em código-fonte (`git grep`) subiu: `data-role` 38→62, `data-variant` 18→32, `data-block` 26→28, `data-focus` 17→18. Não é regressão (nenhum atributo sumiu), mas o contrato do admin deve ser conferido com o `docs/blog-design-contrato.md`.

## 6. Arquivos e commits

- Só este relatório entra no commit.
- Nada em `apps/` foi editado.
- Artefatos fora do repo (scratchpad): cópias dos scripts, builds, `copy-a003/`, JSONs de Lighthouse.
- Worktrees temporários criados em `scratchpad/wt-head` e `scratchpad/wt-a003` (metadados em `.git/worktrees`). Serão removidos ao fim.

## 7. Fora deste relatório e por quê

- Overflow e console (4 larguras × 11 rotas): script pronto, não rodou até o fim. **Não medido.**
- CLS: 28 de 33 medições não rodaram. **Não medido.**
- Commits `770a667`, `1eaac95` (B0) e `b9b0898` (B5), que entraram depois de `9bf172f`. **Não medidos.** O pedido separa o que veio do 30a18cb do que veio deles: o 30a18cb é o `9bf172f`-ancestral, e os três são posteriores.
- Baseline da Home: nunca foi capturada na C1. Medi a Home só no HEAD.
- Teste negativo do `copy-diff.mjs` (alterar texto e ver a falha): não feito.

## 8. Riscos e incidentes (importante)

1. **Porta 3199 não é minha.** Há um `next start -p 3199` de outra sessão (PID 10228), servido a partir de `apps/site` e com dados fictícios diferentes. Minhas primeiras medições contra 3199 foram descartadas.
2. **Dano colateral na pasta compartilhada.** O `apps/site/.next` é compartilhado com esse servidor. Ao reconstruir o HEAD em `apps/site` (`rm -rf .next` + `npm run build`), troquei o build em uso por ele. As páginas que ele serve podem estar inconsistentes até ser reiniciado. **Quem roda o servidor 3199 deve reiniciá-lo.** Não o matei porque não é meu.
3. **Porta 8199** é de outro processo (`lead-fake.mjs`). Não toquei. Usei a 8198.
4. Junction de `node_modules` tentada em um worktree; falhou no Turbopack e foi removida. O `node_modules` real de `apps/site` está intacto (verificado).
5. Vários processos de Chrome headless órfãos podem existir; não encerrei os que não consegui atribuir com segurança.
6. Testimonials sem fonte documentada (seção 4).

## 9. O que o dono precisa fazer

1. Decidir, item a item, quais textos da seção 2 são intencionais (CTAs novos, frases de efeito, números removidos, descrições de cards removidas). Sem isso, o aceite 3.1 falha.
2. Confirmar a origem e a autorização dos depoimentos da Home (nomes, cargos e empresas).
3. Reiniciar o servidor 3199 (de outra sessão) para não servir o build misturado.
4. Decidir se `1eaac95` e `770a667` (B0) e `b9b0898` (B5) precisam de auditoria própria. O pedido de medir o HEAD atual exige uma passada nova.

## 10. Perguntas de produto para o PO

- A remoção de "01/02/03" e das descrições dos cards de `/solucoes`, `/kognis` e `/spectra` foi intencional?
- Os CTAs novos ("Solicitar proposta", "Conversar com um sócio", "Falar sobre o meu projeto", "Falar sobre o meu caso", "Agendar demonstração", "Conhecer Spectra AI") foram aprovados?
- A Home pode mudar visualmente (regra 3.3)? Se sim, a regra precisa ser reescrita; se não, o 30a18cb precisa ser revisto.

## Riscos finais

- LCP mobile de `/solucoes` e `/spectra` piorou (ver seção 3); precisa de repetição.
- Testimonials sem fonte (seção 4).
- Medições incompletas (seção 7).
