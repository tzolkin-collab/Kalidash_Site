# D2: Direção do `/diagnostico`

> Designer D2/D3. Só direção e protótipo; nada em `apps/site` foi editado. Sistema em [00-sistema.md](00-sistema.md), [tokens.css](tokens.css) e o acréscimo [tokens-d2d3.css](tokens-d2d3.css) (4 variáveis). Coerência com as institucionais: [01-institucionais.md](01-institucionais.md).
> Capturas "antes" (disco de 31/10, com o trabalho aberto do dono): [../relatorios/antes/d2-d3/](../relatorios/antes/d2-d3/) (`diag-*`, 1440 e 390, 9 estados + erro de envio). Referências: [refs/](refs/) (`d2d3-*`). Protótipo: [proto/07-diagnostico.html](proto/07-diagnostico.html), estados por hash; capturas em [proto/shots/](proto/shots/) (`07-*`).
> Origem do "antes": `DiagnosticoClient.tsx` + `diagnostico.module.css` com as alterações não commitadas de outra sessão, lidas e não editadas. Servidor falso (`:8199`) só para o `POST` do lead; **nada de produção**.

## 1. Diagnóstico do estado atual (visto nas capturas)

A página é o único fluxo de conversão e hoje é a mais "de formulário padrão" do site. O que vi:

| Tell (`references/tells.md`) | Onde aparece |
|---|---|
| Caixa com barra lateral colorida | a citação "Primeiro entendemos. Depois construímos juntos." no painel esquerdo (barra terracota + texto) |
| Painel escuro fora do sistema | painel esquerdo em roxo-preto `--ink-deep #1a1025` (variável local do módulo), que não é nenhum token do sistema (a faixa escura do sistema é `--black-1 #0e0e0e`, uma por página). Ocupa 44% da tela só com texto |
| Nuvem de pílulas | passo 3: cinco botões de largura diferente quebrando em 4 linhas irregulares, cada um com "+" ou "✓" como ícone |
| Redundância de rótulo | "ETAPA 1 DE 3" na barra e "PASSO 1 DE 3" acima do título, os dois com a mesma função |
| Duas famílias de raio e cores fora da paleta | campos, pílulas e botões em **6px** (a Home usa 4px nos botões), caixa de erro em **8px** com fundo rosa `#fff4f2`; selo de sucesso em verde translúcido e botão do WhatsApp em verde `#edf8ee` |
| Sem hierarquia de escala | título do passo 28px, rótulo 13px, campo 15px, descrição 15px, erro 12,5px, pílula 13,5px (lido no CSS): abaixo dos 14px mínimos de `tells.md` em quase tudo; a página lê como uma coluna de campos |
| Selo de sucesso | quadrado verde com um "✓" desenhado, depois dois botões com cores de famílias diferentes (roxo e verde) |
| Mobile | o painel de contexto **some** (`display:none`): no celular a página perde o `h1`, a prova social e a citação, e fica sem `h1` visível (checklist 3.4: um `h1` por página) |
| Erro de campo | o campo ganha borda vermelha de 1px e fundo `#fffafa` (legível na captura `diag-2-passo1-erros`), mas a mensagem é de 12,5px, abaixo dos 14px de `tells.md`; os três erros do passo 1 aparecem de uma vez, sem resumo |
| Bordas de campo | `--surface-border #e6e2dc` sobre branco: **1,3:1** (cálculo WCAG); 1.4.11 pede 3:1 |

O que funciona e **fica**: formulário em 3 passos curtos (3, 3 e 5 campos), progresso visível, validação inline em português, honeypot, `aria-invalid` + `aria-describedby`, painel de confiança ao lado no desktop, "Voltar ao site" sempre visível.

## 2. Referências (abertas e vistas)

Abri com o Chrome instalado (`shot.mjs`, 1440) e **vi** as capturas. Quatro linhas + herdo/recuso.

### 2.1 Stripe — /contact/sales ([refs/d2d3-stripe-contact-vp.png](refs/d2d3-stripe-contact-vp.png))
- **Composição:** um único cartão estreito (~610px) centrado sobre uma fita de cor; no topo do cartão um **stepper de três passos** (círculo + rótulo, filete sob o passo atual); o formulário é de **uma pergunta por linha**: rótulo à esquerda, campo à direita; "Continuar" alinhado à direita.
- **Tipo:** grotesco único; título do passo ~26px peso 400, subtítulo cinza ~18px; rótulos 14px peso 500.
- **Ar:** muito: ~40px de padding no cartão, ~24px entre campos, ~48px antes do botão.
- **Detalhe:** campo de ~48px, raio 4px, borda cinza nítida (≈3:1), sombra difusa só no cartão; botão cheio na cor da marca com seta; banner de cookies cobria o canto.
- **Herdo:** o passo atual **sempre nomeado** e o conjunto de passos visível como estrutura (aqui: segmentos da régua de progresso, sem texto novo); o botão alinhado à direita; o ritmo de ar entre campos.
- **Recuso:** a fita de cor com gradiente (é a decoração mais forte da página, e é "gradiente padrão"), o cartão com sombra flutuando, o rótulo à esquerda do campo (os rótulos da Kalidash são longos, "Nº de pessoas na equipe ou operação", e quebrariam em 3 linhas).

### 2.2 cal.com — página de agendamento ([refs/d2d3-cal-book-vp.png](refs/d2d3-cal-book-vp.png)) e home ([refs/d2d3-cal-home-vp.png](refs/d2d3-cal-home-vp.png))
- **Composição:** uma moldura única dividida por **filetes verticais** em colunas de função: contexto à esquerda (quem, o quê, duração), ação no meio e à direita; nada em cartão dentro de cartão.
- **Tipo:** um sans; nome em peso 600 ~24px; descrição cinza ~15px; datas em numerais tabulares.
- **Ar:** apertado dentro da moldura (~20px), generoso fora; a moldura tem ~480px de altura, cabe na dobra.
- **Detalhe:** raio ~8px, 1px de borda, **sem sombra**; estado selecionado = inversão de cor (branco sobre cinza), não cor de marca; foco com anel.
- **Herdo:** a divisão **contexto | ação** separada por um filete (nosso painel esquerdo/direito), e o estado selecionado como mudança de tom/forma, não decoração.
- **Recuso:** o tema escuro, o calendário e os horários (não há agenda neste fluxo), a bolinha de avatar.
- **Limite:** a página aberta é uma página pública de exemplo ("Get Rickrolled"); não vi o fluxo de confirmação/erro do cal.com.

### 2.3 Stripe — /about, Linear — /about (já vistos no D1)
Dão a lista ruled e o título grande sem eyebrow; usados aqui só para a lista de objetivos (§4).

**Âncora do D2:** *Stripe /contact/sales* para o **ritmo do formulário** (passo nomeado, régua de passos, um botão à direita) **+ cal.com** para a **estrutura contexto | ação** em uma só moldura, sem sombra. Princípios, não layout; o sistema da Home e o D0 têm prioridade.

## 3. Direção (uma frase)

A página deixa de ser "painel escuro + formulário padrão" e vira **uma moldura de duas colunas, `warm | paper`, separada por um filete**: à esquerda, a confiança como tipo e tabela (manchete, citação-chave, prova ruled); à direita, **um passo por vez** em escala de h2, com a régua de três segmentos como diagrama de ordem. Zero caixas com barra, zero pílulas, zero verde.

## 4. Seção por seção

Tokens: os do D0 + `--c-error #b42318` (6,5:1), `--c-field-line #8a8490` (3,6:1) de [tokens-d2d3.css](tokens-d2d3.css). Raio 4 (controles). Sombra: nenhuma (esta página não tem foto-herói). Uma faixa escura por página: **aqui nenhuma** (ver pergunta Q1).

| # | Seção | Papel | Objeto protagonista | O que domina | Próximo passo | Tratamento |
|---|---|---|---|---|---|---|
| 1 | **Contexto** (aside, `warm`) | dar confiança **antes** de pedir dado | a manchete (tipo) | "Existe uma oportunidade de eficiência na sua operação." em `--t-h1` reduzido (46px no 1440) | olhar para a direita e começar | `meta` + h1 + lead; **frase-chave** (hairline em cima, Inter 500 24px, sem barra) para "Primeiro entendemos…"; prova em **tabela ruled** (rótulo `meta` sobre os nomes); WhatsApp como `textLink` com glifo |
| 2 | **Barra + régua** (topo do painel direito) | situar: em que passo estou | a régua de 3 segmentos | "ETAPA N DE 3" | preencher | `meta` + "Voltar ao site" (botão fantasma 44px); segmentos de 4px (preenchido = `--accent`) no lugar do trilho contínuo |
| 3 | **Passo 1 · contato** | pedir quem é | os 3 campos | título "Seus dados de contato" em `--t-h2` (44px) | "Continuar" | `meta` "Passo 1 de 3" → h2 → descrição 18px; campos de 56px, rótulo 15px/600, borda 3,6:1; "Continuar" à direita |
| 4 | **Passo 2 · operação** | pedir o porte | os 3 campos | "Sobre a sua operação" | "Continuar" / "Voltar" | igual ao 3; "Voltar" é botão de texto (não compete com o primário) |
| 5 | **Passo 3 · objetivos** | pedir a intenção | **a lista ruled de objetivos** | "O que sua empresa busca hoje?" | "Solicitar diagnóstico" | 5 linhas de 60px com filete entre elas e caixa de seleção 22px (selecionada: `--ink` com traço branco, texto 600); textarea de 112px |
| 6 | **Estado de erro de campo** | dizer o que falta, ao lado do campo | a borda | a mensagem de 15px | corrigir | borda 2px `--c-error`, mensagem logo abaixo; **o texto de cada mensagem é o da validação atual** |
| 7 | **Erro de envio** | avisar que não enviou | a caixa de aviso | a frase | tentar de novo / WhatsApp | caixa de 1px `--c-error`, raio 4, sem fundo rosa e sem barra; `role="alert"` mantido |
| 8 | **Sucesso** | fechar e dizer o prazo | o título | "Solicitação enviada com sucesso!" em `--t-h2`; "24 horas úteis" em 600 | "Voltar para o início" / WhatsApp | tipo no lugar do selo verde; régua com 3 segmentos cheios; primário em `--accent` + WhatsApp como `textLink` (some o verde) |

### 4.1 O que **não** muda (restrições, conferidas)
- **Campos, ordem, rótulos, validação:** idênticos. Os 3 + 3 + 5 + textarea (opcional), a mesma ordem, os mesmos `placeholder`, as mesmas 8 mensagens de erro, o mesmo "(opcional)". O `copy-check` (§6) lê o texto real renderizado pelo código em cada estado e compara.
- **Honeypot** `website`, atribuição, `dataLayer`, `source`, estados `idle/sending/sent/error/unconfigured`: lógica intacta; o design mexe só em CSS e em marcação.
- **Copy duplicada é copy:** "ETAPA 1 DE 3" e "PASSO 1 DE 3" continuam os dois, porque o dono vetou mudança de texto. A direção só os diferencia (a primeira é o `meta` da barra; a segunda, o `meta` do título). Se o dono aceitar tirar um, é decisão de produto (Q2).
- **Sem texto novo:** o stepper **não** nomeia os 3 passos ("Seus dados de contato" etc.) porque isso mostraria no passo 1 títulos que hoje só aparecem nos passos 2 e 3. A régua é só 3 segmentos.

### 4.2 Como cada tell some

| Tell | Como sai |
|---|---|
| Barra lateral colorida | a citação vira frase-chave (hairline + tipo) |
| Painel escuro fora do sistema | painel `warm #faf8f7` com texto em tinta; nenhuma faixa escura na página |
| Pílulas com "+" | lista ruled com caixa de seleção; os botões continuam `button` com `aria-pressed` (o "+"/"✓" é decorativo, `aria-hidden`) |
| Duas famílias de raio / cores fora da paleta | só raio 4; sai o verde (selo e botão) e o rosa do erro |
| Sem hierarquia de escala | h1 46 → h2 44 → rótulo 15/600 → ajuda 18; um só tamanho de corpo (18) |
| Selo de sucesso | tipo e régua |
| Redundância | mantida (é copy), mas com papéis visuais distintos |
| Mobile sem `h1`/prova | ver §5 |
| Contraste de borda 1,4:1 | borda de campo e de caixa a 3,6:1; placeholder `--c-text-3` (5,6:1) |

## 5. Responsivo

- **≥1024:** duas colunas 5/7 (`warm | paper`), o painel esquerdo acompanha a altura do conteúdo (não é `100svh`: no protótipo a página inteira rola junto; evita corte do painel em 768 de altura). O passo começa sempre na mesma altura (`align-content:start`): trocar de passo não "pula" a coluna.
- **<1024:** uma coluna (hoje o corte do aside é 900px, `@media (max-width: 900px)`; em 900–1023 o painel 5/7 aperta o formulário a ~400px, por isso o protótipo corta em 1024). **O formulário vem primeiro; o contexto (h1, lead, citação, prova, WhatsApp) desce para depois do botão.** Barra com a marca-símbolo à esquerda, "Etapa N de 3" e "Voltar". Alvos de toque ≥44px (campos 56px, linhas de objetivo 60px, botões 56px). Os botões "Voltar" e o primário dividem a linha; no sucesso empilham.
- **Decisão de produto (Q3):** hoje o painel de contexto **não aparece** no celular. A direção mostra o mesmo texto abaixo do formulário no celular. É **texto que hoje não aparece em 390**; se o dono não quiser, esconder como hoje e dar à página um `h1` só para leitores de tela (não muda o texto visível).
- Ordem visual no celular (formulário antes) difere da ordem do DOM (aside antes): no código, `flex-direction: column-reverse` ou `order` no `<aside>` (só visual). Para leitor de tela o `h1` fica primeiro, o que é o que se quer.

## 6. Verificação

| Item | Resultado |
|---|---|
| Copy (`proto/copy-check.mjs`) | `07-diagnostico.html`: **0 extras** em 171 linhas nos 8 estados (`p1`, `p1-erro`, `p2`, `p2-erro`, `p3`, `p3-erro`, `envio-erro`, `sucesso`), cobertura da baseline 50/60 (as 10 linhas que faltam são o honeypot "Não preencha este campo" e repetições do aside). A baseline é o **texto real renderizado pelo código** em cada estado (`proto/copy-source/diagnostico-estados.txt`, gerado do site de teste) + os literais de `DiagnosticoClient.tsx`/`content.ts`. **Teste negativo feito:** trocar "Seus dados de contato" por "Seus dados pessoais" reprova (`EXTRA: seus dados pessoais`) |
| Overflow (`proto/overflow-check.mjs`) | 9 estados × 390/768/1024/1440 sem overflow horizontal |
| Visto em tamanho real | 1440: `p1`, `p1-erro`, `p3-erro`, `p3-ok`, `envio-erro`, `sucesso`. 390: `p1`, `p3-erro`, `p2-erro` (página inteira), `sucesso`. 1024: `p3-ok` (achou um estouro de 41px do `.col`; corrigido e revisto) |
| Não visto | 390 de `p2`, `envio-erro`; 768 como imagem; hover/foco/teclado; leitor de tela |

## 7. O que a B5 (dev) faz com isto

1. Colar `tokens-d2d3.css` junto com o `tokens.css` do D0 no CSS do diagnóstico (módulo próprio, não `home.module.css`).
2. `DiagnosticoClient.tsx`: trocar `pillGroup`/`pillItem` por lista ruled mantendo `<button aria-pressed>` e o `role="group" aria-label="Objetivos"`; trocar o trilho `progressBar*` por 3 segmentos (manter `role="progressbar"` e `aria-value*`); remover `successIconBadge`; `quoteCard` vira frase-chave; WhatsApp do sucesso vira link de texto.
3. Mobile: o `<aside>` visível abaixo do formulário (Q3).
4. Foco: 2px `--ink` com offset 3px em todos os controles (já no protótipo). Sugestão (não existe hoje, não li nenhum `focus()` no componente): ao errar, mover o foco para o primeiro campo inválido.
5. Contraste do botão primário: ver §8.

## 8. Achados e perguntas

- **Achado de contraste (não é desta página):** texto branco sobre `--accent #b6644d` dá **4,27:1** (cálculo meu, WCAG). Os botões de 16px/600 reprovam AA (4,5:1); em 18,66px negrito passaria (3:1). Vale para o botão da Home também. Opções: botão a 18-19px/700 ou `--accent` mais escuro só em botões. **Decisão do PO/dono**, não aplicada aqui.
- **Q1.** O painel esquerdo passa de escuro (roxo-preto) para `warm`. Aprovar? (Alternativa: manter escuro em `--black-1`, que seria a faixa única da página; a direção `warm` evita o contraste forte que desvia o olhar do formulário, mas o dono pode preferir a identidade escura.)
- **Q2.** "ETAPA N DE 3" e "PASSO N DE 3" são redundantes. Tirar um? (Mexe em copy.)
- **Q3.** Mostrar o contexto no celular (abaixo do formulário), ou esconder como hoje?
- **Q4.** Passo 3: lista com caixas de seleção em vez de pílulas muda a aparência de "tags" para "checklist". Aprovar?
