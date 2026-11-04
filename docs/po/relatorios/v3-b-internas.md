# V3 · Sessão B (internas): primeira entrega, B0 + Advisory (V1 a V4), com a rodada de correções do PO

> **Rodada 2 (revisão do PO, nota 8,5):** ver a seção "Rodada de correções" logo abaixo; ela prevalece sobre o que estiver diferente no resto do texto (recorte da foto, web vitals, tipografia pequena).

Branch `claude/v3-internas-d70d92`, a partir de `240a2bb`. Sem push, sem merge. AI Culture e Execução **não foram tocadas** (aguardam aprovação do PO; C1 e E2 seguem bloqueados).
Capturas em `docs/po/relatorios/v3-b-internas/` (cada `V*-1440.png` empilha ANTES / DEPOIS / REFERÊNCIA; `V*-390.png` põe antes e depois lado a lado).

## O que mudou

| Item | Arquivo | Resumo |
|---|---|---|
| B0 | `KitPage.tsx`, `kit.module.css` | Kit Adobe `krs4uwp` via `<link precedence>` no `KitPage`, **só quando `.v3`** (hoje só a Advisory). Famílias aplicadas em `.v3 .main`; cabeçalho/menu/rodapé ficam de fora. `--w-title: 400` e `--w-strong: 700` em um único lugar (`.v3 .main`). Fundos: Limestone `#F1ECE4` / `#E9E1D6`, Ink `#19171B`. Títulos com `text-wrap: balance`. |
| B0 | `pages.ts`, `KitPage.tsx` | Campos opcionais `accent` (hero, text, cards) e `highlightAccent` (text). `LastWord` usa o campo e mantém o comportamento antigo sem ele. Nenhuma string mudou. |
| V1 | `pages.ts`, `public/advisory/comite-fdc.webp`, `KitPage.tsx` | Foto do Drive no arco, recortada (x 330–730, y 470–970 do original, 4:5, 800×1000 WebP, 26 KB). `HeroWide` lê `block.image`; só a Advisory aponta para ela. `alt` descritivo. |
| V2 a V4 | `AdvisoryViews.tsx` (novo), `advisory-v3.module.css` (novo) | `ProblemView`, `LeadershipView`, `RitualsView`, só para `slug === "advisory"`. Se a forma do texto não bater, o `KitPage` cai nas views antigas. |

Palavras em destaque (itálico dourado): Advisory `resultado.` (hero), `E agora?`, `depois dele.`, `melhor`, `rituais`. As demais ficam para a próxima etapa (proposta: AI Culture `capacidade`, Execução `entra`, conforme o brief).

## Seção por seção (três linhas antes de desenhar)

**V1 Hero.** `doc-17.png` (que faltava na 1ª entrega) é o hero "de hoje" do doc: serve de comparação, não de alvo. Reproduzo o arco atual com a foto do Drive; deixo de fora qualquer rótulo ou moldura nova. O recorte sobe para a tela projetada e o palestrante, e corta fora a bancada com as plaquinhas (ver `V1-recorte-da-foto.png`, retângulo vermelho).

**V2 "A estratégia foi definida".** A referência separa o problema (Limestone) da resposta (Imperial). Reproduzo: título com "E agora?" dourado + parágrafo à direita; linha do tempo com os 4 eventos (colunas com filete e ponto sobre a linha); parte Imperial com "Não entregamos um plano." atenuado, "Acompanhamos o que acontece" forte, "depois dele." dourado; régua 01–04 em ouro. Deixo de fora "Plano aprovado" e "Fim do 1º trimestre" (copy nova). Tudo no mesmo capítulo: contagem e cortina intactas.

**V3 "Ajudamos sua liderança".** A referência dá título + apoio à esquerda e uma coluna única de 5 linhas à direita. Reproduzo: coluna única com romano (I a V) à esquerda e ícone de linha à direita, filete entre as linhas, pentágono SVG inline `aria-hidden` em linha ouro. Deixo de fora o rótulo "Liderança" no centro (texto novo) e a numeração 01–05 (o brief proíbe).

**V4 "Três rituais".** A referência dá cartões escuros com ícone, título, descrição e frase final em itálico, mais uma faixa clara. Reproduzo: seção Imperial, 3 cartões Aubergine (raio 18 px), ícone ouro, frase final de "Comitê de IA" separada por filete em itálico ouro, faixa Limestone com 3 colunas e ícone (texto do `closing`). Deixo de fora as pílulas "Mensal/Contínuo/Individual", "I · Com a liderança", o texto de apoio à direita do título e os subtítulos da faixa (todos copy nova); aguardam decisão da Carol.

## Rodada de correções (revisão do PO)

1. **V4, cartões 2 e 3 com vazio.** Novo campo opcional `foot` nos itens de `cards` (`pages.ts`): é o trecho final do `text`, que a Advisory mostra à parte. "antes de virar problema de diretoria." e "e precisam de um olhar externo e experiente." vão ao pé, em itálico ouro; primeira letra maiúscula só por CSS. O texto de `pages.ts` não mudou. Os três cartões usam `subgrid`: ícone, título, texto e filete ficam na mesma altura no desktop. No celular volta a pilha simples.
2. **V2, ponto final.** Os quatro itens da linha do tempo terminam com ponto (CSS), todos iguais.
3. **V3.** Romanos de 17 px para 20 px (lista) e de 15 px para 20 px (pentágono), em Kepler Subhead e no ouro acessível `#8F7248`. Ícones 28 para 34 px, pentágono 300 para 360 px.
4. **Serifa pequena.** Nova variável `--font-sub` (`kepler-std-subhead`, `letter-spacing: 0`) para: linhas de V3, linha do tempo, régua 01–04, pé dos cartões, faixa Limestone de V4 e os romanos. Títulos grandes seguem em Display. Os `h3` dos cartões (26 a 34 px) ficaram em Display com tracking 0.
5. **V1.** Novo recorte (x 380–712, y 520–935 do original, 664×830, WebP): sem plaquinha nenhuma (conferi o canto inferior direito, onde aparecia a ponta de uma) e menos teto. O arco sobe 44 px do pé da abertura (`margin-bottom` com cantos de baixo arredondados), então a cortina do capítulo seguinte não corta mais o palestrante. Em 1440×900 e em 390 o palestrante aparece inteiro até os joelhos.
6. **FCP.** Mesmo padrão da Home (`081a733`), sem editar a Home: `preconnect` + `preload` do CSS no `KitPage`, e o novo `KitFonts.tsx` (cliente) aplica o CSS depois da carga e marca `main[data-fonts="ready"]` quando as fontes carregaram. Até lá valem as reservas `kit-kepler-reserva` e `kit-acumin-reserva` com métrica ajustada (`size-adjust`), então não há texto invisível.

**Web vitals da Advisory, depois da rodada** (build de produção, Lighthouse 12, mediana de 3; `webvitals-antes.json` × `webvitals-depois.json`):

| | LCP | CLS | TBT | FCP | Fonte transferida |
|---|---|---|---|---|---|
| mobile, baseline | 4885 ms | 0 | 42 ms | 1965 ms | 323 KB |
| mobile, 1ª entrega | 4723 ms | 0 | 47 ms | 2361 ms | 626 KB |
| mobile, agora | **4632 ms** | 0,015 | 35 ms | **1968 ms** | 876 KB |
| desktop, baseline | 942 ms | 0 | 0 | 495 ms | 323 KB |
| desktop, agora | **893 ms** | 0 | 0 | 535 ms | 876 KB |

O FCP volta ao nível do baseline no celular (de 2361 para 1968 ms) e o LCP melhora nos dois perfis. Sobra +40 ms de FCP no desktop e um CLS de 0,015 no celular (a troca da reserva pela fonte real; abaixo do limite de 0,1). O peso de fonte sobe (876 KB) porque a Subhead entrou na carga, mas agora sem bloquear a pintura.

**Conferências repetidas na rodada:** `tsc` e `build` passam; lint com o mesmo erro preexistente de `DiagnosticoForm.tsx`; `/kognis`, `/spectra` e `/solucoes` com 0 px de diferença, `/sobre-nos` 0 px contra o baseline recapturado; cabeçalho idêntico (JSON `antes` × `depois`); 1440, 1024, 768 e 390 sem rolagem horizontal e sem erro de console; quadros de movimento refeitos (desktop, iPhone simulado e movimento reduzido) com cascata do hero, cortina, rótulo e surge intactos. Copy: nenhuma palavra mudou (mesma análise de antes; os pés dos cartões 2 e 3 só repartem frases existentes).

## Decisões a registrar

- **Sócrates → símbolo.** Troquei o busto por um círculo com triângulo em linha ouro (como na referência). O fundo bege da foto brigava com o Imperial, e o busto de 340 px disputava com a frase. Perde-se um pouco do "repertório clássico"; o arquivo `socrates.jpg` continua em `public/marca/` se o PO preferir de volta (basta voltar a `figure` no `TextView`). Escola de Atenas deixou de aparecer na Advisory (continua no repositório).
- **Frases repartidas, não reescritas.** V2 divide `paragraphs[1]` (a 1ª frase fica no texto; as quatro orações viram a linha do tempo) e extrai as quatro ações de `paragraphs[0]` para a régua (o parágrafo continua inteiro na tela). Capitalização por CSS (`::first-letter`); pontuação interna (vírgulas) deixa de aparecer, o ponto final é desenhado por CSS. **O parágrafo 1 e as quatro ações se repetem** na tela (decidir o que priorizar etc.), como no desenho de referência; o PO deve avisar se prefere cortar o parágrafo.
- **V3 numeração:** romanos I–V são desenho, não copy; no DOM eles aparecem como texto (`aria-hidden` na lista; o SVG do pentágono também).
- **Tom dos capítulos da Advisory.** Os "rituais" saíram da alternância de claros: `light = LIGHT sem "cards"`. "Para quem é?" e "Perguntas" mudaram de Limestone/branco para a ordem recalculada. "Como começa" (Imperial) vem logo depois dos rituais (Imperial): a cortina separa pela borda arredondada e pelo rótulo "05 / 07"; vale olhar.
- **Rótulo do capítulo em V2.** O capítulo tem duas cores (Limestone e Imperial); o rótulo "nº / total" fica Limestone enquanto o fundo vira Imperial. Funciona, mas é a única costura visual; ajustar exige mexer na cor por capítulo (fora do escopo).
- **`.chapters .main li:first-child/last-child`** (kit.module.css) zeram a borda de cima/baixo de `li`: por isso as réguas e os cartões usam `li + li`, `box-shadow` e bordas no `ol`, sem tocar nesses seletores.

## Autoavaliação honesta

- **V1:** bom; a foto lê como sala de capacitação. A origem é só 400 px de largura útil: no arco (460 px, 2x em tela retina) fica um pouco mole. Pedir a foto original maior à Carol/Drive melhoraria. O topo do arco mostra bastante teto.
- **V2:** a hierarquia ficou clara (problema claro / resposta escura). A linha do tempo de quatro frases curtas fica ainda mais discreta que a referência, sem os rótulos das pontas. A faixa Imperial tem muito ar à direita do texto no 1440.
- **V3:** bom. O pentágono é pequeno perto do da referência; no 768 e no 390 fica centralizado com bastante espaço em volta. Ícones de linha desenhados à mão (o projeto não tem set; `@phosphor-icons/react` está instalado e sem uso, posso trocar se o PO quiser).
- **V4:** boa; os cartões 2 e 3 ficam com vazio embaixo porque só o 1º tem frase final. "Três rituais que mantêm a / IA na agenda..." deixa o "a" no fim da primeira linha (o `balance` não resolve sem mexer na string).
- A referência mostra uma faixa/título de apoio ao lado do título de V4 que não existe na copy: a seção ficou mais sóbria que a referência.

## Aceites

**Cabeçalho.** `getComputedStyle` (família, tamanho) e posição de logo/links iguais ao baseline em 1440 e 390 em `/advisory`, `/sobre-nos`, `/kognis`, `/spectra`, `/solucoes` (comparação do JSON `antes` × `depois`); nenhum arquivo do cabeçalho tocado. Não testei de novo "some ao rolar / volta ao subir" além dos quadros de movimento (o cabeçalho aparece e recolhe nos quadros).

**Animações** (quadros: `movimento-antes-1440.png`, `movimento-depois-1440.png`; celular com UA de iPhone, caminho JS `html[data-motion="js"]`: `movimento-*-390-ios.png`; `movimento-*-reduzido.png`). Em todos: entrada em cascata do hero, afundar do hero, cortina de cada capítulo, rótulo "nº / total" com fio que enche, surge dos títulos/linhas/cartões. Contagem 02/07 a 07/07 igual. Sem erro de console em nenhum perfil. Com `prefers-reduced-motion` nada se move e nada fica escondido. Cortina funciona no capítulo mais alto (V4, ~1250 px no 1440). `StepsPin`, `BuildStory` e `CountUp` não aparecem na Advisory e não foram tocados.

**Outras páginas.** Comparação pixel a pixel (limiar 30/765) de captura completa `antes` × `depois`: `/kognis`, `/spectra`, `/solucoes`: 0 px de diferença em 1440 e 390. `/sobre-nos`: 0 px contra um baseline recapturado com o código original (a primeira captura "antes" pegou o cabeçalho no meio de uma transição de cor; não é efeito do código).

**Responsivo.** Advisory em 1440, 1024, 768 e 390 sem rolagem horizontal e sem erro de console (`overflowX` 0).

**Lint/tipos/build.** `tsc --noEmit` passa; `next build` passa. `pnpm lint` falha com **1 erro que já existia** (`react-hooks/set-state-in-effect` em `home/DiagnosticoForm.tsx`) e 3 avisos antigos; nenhum em arquivos meus.

**Copy.** O `copy-diff.mjs` acusa tudo como diferente aqui porque as baselines `.txt` do checkout estão em CRLF (o script compara linha a linha); refiz a comparação normalizando CRLF. Advisory: nenhuma palavra mudou; só mudaram as quebras (frases divididas em peças), os numerais (`01–05` viram `I–V`, `01–04` novos na régua) e a pontuação interna das quatro orações da linha do tempo. `/kognis`, `/spectra`, `/treinamento-corporativo-ia`: OK. `/sobre-nos`, `/solucoes` e `/execucao` aparecem como diferentes por quebra de linha, deriva da baseline e mocks; as duas primeiras são pixel-idênticas ao antes.

**Web vitals** (`webvitals-antes.json` × `webvitals-depois.json`, Lighthouse 12, build de produção, mediana de 3, `/advisory`):

| | LCP | CLS | TBT | FCP | Fonte transferida |
|---|---|---|---|---|---|
| mobile antes → depois | 4885 → **4723** ms | 0 → 0 | 42 → 47 ms | 1965 → 2361 ms | 323 → 626 KB |
| desktop antes → depois | 942 → **933** ms | 0 → 0 | 0 → 0 | 495 → 719 ms | 323 → 626 KB |

LCP não piorou (a foto nova é 26 KB contra 91 a 109 KB da Escola de Atenas). O **FCP piora 220 a 400 ms** porque o CSS do Typekit é bloqueante e traz as fontes. Mitigação possível (não aplicada): `preconnect` a `use.typekit.net` e `p.typekit.net`.

## Riscos e o que falta

1. Typekit é terceiro (agora não bloqueia a pintura, ver a rodada de correções). O kit só traz 400 e 700; títulos usam 400 (certo). Quando a Carol incluir Light/Semibold, trocar `--w-title`/`--w-strong`.
2. `v3` está ligado só à Advisory (`const v3 = page.slug === "advisory"` em `KitPage`). AI Culture e Execução seguem com Fraunces/Archivo até a próxima etapa.
3. Foto com pouca resolução: o recorte novo tem 332 px de origem, ampliado para 664 (mole em tela retina). Uma foto maior do Drive resolveria.
4. Ícones desenhados à mão (`AdvisoryViews.tsx`).
6. `/consultoria-governanca-ia` renderiza o mesmo conteúdo e herda tudo (checar no merge).

## Commits

Dois commits no branch `claude/v3-internas-d70d92`: `524ec8c` (B0 + Advisory V1 a V4 + relatório) e o da rodada de correções.
