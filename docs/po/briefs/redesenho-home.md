# Redesenho da Home (Kalidash)

> Base: branch `claude/v3-preview`. Porta **3305** (a 3300 é do dono e a 3304 é de outra sessão: não derrube).
> Decisão do dono em 04/11: "Acho que é mais design mesmo." Trocar cor, fonte ou um componente não resolve. O problema é de composição.

## Diagnóstico do PO (confira na tela e discorde se a imagem mostrar outra coisa)

1. **Mesma receita em toda seção:** eyebrow, título à esquerda, texto à direita.
2. **Falta protagonista:** muitas seções não têm um objeto que domine. A imagem acompanha o texto em vez de carregar a mensagem.
3. **Salto brusco de escala:** títulos enormes com texto de 13 a 16 px, sem nível intermediário. A seção parece grande e vazia ao mesmo tempo.
4. **Ritmo de faixas:** blocos claros e escuros de altura parecida, sem que o fundo pareça escolhido pela função.
5. **Caixas sem critério:** cartões arredondados, botões retos, pílulas, arcos e faixas gregas sem regra clara.

O pior componente na auditoria foram os cartões do problema: três cartões iguais, com textura de pontos e rótulo "Depoimento real". Além disso, o bloco fica oculto abaixo de 1100 px, então o celular não vê esse conteúdo.

## Regras fixas

**Não mude:**
- Copy da Carol: nenhuma palavra, salvo proposta explícita para o PO levar ao dono.
- Hero original da Home: composição e imagem ficam (decisão do dono). O ajuste de ritmo com a seção seguinte pode ser proposto.
- Holograma e bloco roxo ao lado dele: a Carol pediu para manter. Podem ganhar novo enquadramento só se a proposta disser isso claramente e o dono aprovar.
- Logos de parceiros: **cores originais**, sem cinza, sem transparência e sem tom único (decisão do dono). O loop continua.
- Cabeçalho.

**Mantenha o que funciona:** animações existentes continuam, salvo quando a nova composição pedir troca; nesse caso diga qual sai e por quê. Não perca movimento sem avisar.

**Sistema já decidido:** `docs/po/briefs/v3-comum.md` (paleta, Kepler e Acumin pelo kit Adobe, destaque por palavra de sentido) e `docs/po/briefs/motion-comum.md` (`framer-motion`, palco `sticky`, só transform, opacity e pathLength, sem GSAP e sem Lenis).

**Assets:** só fotos e marcas reais que já existam (`public/`, `docs/po/relatorios/imagens-carol.md`, `docs/po/design/marca/pdf-assets/`, nunca `evitar/`). Nada inventado: nem número, nem cliente, nem foto de banco.

**Repositório:** sem push, merge em `main` ou escrita em produção. A API local aponta para banco remoto: só leitura. `git add` só dos seus arquivos. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Leitura obrigatória antes de propor

No diretório `D:/Códigos/Tzolkin/Interno/tzolkin_ estrutura/Aplicativos internos/agents/plugins/tzolkin-design/skills/design-craft/`:
- `SKILL.md`, `references/tells.md`, `references/principles.md`, `references/checklist.md`.
- Capturas: `scripts/shot.mjs`.

Referências da Carol em `_assets-carol/v3/` no checkout principal (`D:/Códigos/Tzolkin/Projetos/carol/kalidash/_assets-carol/v3/`): valem pela hierarquia, não para copiar.
Referência de movimento e tipos de seção: `tzolkin-collab/Tzolkin_Site`, clone em `C:/Users/gusta/AppData/Local/Temp/claude/7d93ad790ff35fa3/cfa0c0d9-f201-4dc2-bbe8-82018f9f0402/scratchpad/tz/Tzolkin_Site`.

## Como o dono acompanha

Tudo fica em `docs/po/redesenho-home/`, commitado na sua branch:
- **`ACOMPANHAMENTO.md`:** a etapa atual, o que terminou, o que vem depois e o que você não conferiu. Uma tela. Atualize ao começar e ao terminar cada etapa, em português simples.
- **`img/`:** capturas reais, em resolução real.

**Ao fim de cada etapa, encerre o turno** com um resumo curto e os caminhos das imagens. Não avance sem a mensagem do PO.

## Etapas

### Etapa 1: mapa da página (sem código)
Capture a Home atual inteira em 1440 e 390. Depois, em `01-mapa.md`, uma linha por seção, na ordem:
| Seção | Papel em uma frase | Protagonista | O que domina | O que o visitante faz depois | Fundo e por quê |

Marque o que fica, o que muda e o que se funde. Diga também o que faria o visitante não chegar ao fim e qual a ordem ideal; a mudança de ordem é proposta, não decisão. **Pare.**

### Etapa 2: duas direções visuais
Com o mapa aprovado, construa **duas** direções que difiram de verdade em composição, escala e ritmo, não só em detalhe. Cada uma cobre a Home inteira, com copy real.
- Rotas temporárias `/prototipo/a` e `/prototipo/b`, com `noindex`, sem link no site e sem tocar nos arquivos da Home atual. Elas não entram na versão final.
- Cada direção recebe um nome e três linhas: a ideia, o risco, onde a animação entra.
- Capturas em 1440, 1024, 768 e 390, por seção, olhadas em resolução real antes de mostrar.
- Em `02-direcoes.md`: comparação lado a lado e sua recomendação, com o motivo.

Protótipo não precisa de todo o movimento final. Mostre o movimento principal de cada direção. **Pare: quem escolhe é o dono.**

### Etapa 3: implementação
Só com a direção escolhida, e uma seção por vez, na ordem que o PO indicar. Um commit por seção. Para cada uma: antes e depois em 1440, 1024, 768 e 390, console limpo, sem rolagem horizontal, CLS abaixo de 0,1 e LCP e TBT comparados com a versão anterior. Teste também em 1366x768 se houver palco preso. No fim, remova as rotas de protótipo.

## Critério de qualidade

Para cada seção, em uma frase: qual é o protagonista? Se não conseguir dizer, a seção ainda não está pronta. Nada de grade com três ou mais cartões iguais nem de cartão dentro de cartão. Celular não é o desktop sem os efeitos: o conteúdo que hoje some abaixo de 1100 px precisa aparecer. Diga sempre o que está fraco e o que não conferiu.
