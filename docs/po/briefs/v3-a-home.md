# Sessão A: Home

> Leia antes `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/v3-comum.md`. Referências em `.../_assets-carol/v3/`.
> Página: `/`. Referência geral: `lovable-pagina-inteira.png` (ritmo e cor, não copiar).

## Arquivos seus

`home/HomePage.tsx`, `home/content.ts` (exceto `nav` e `navCta`), `home/HomeHero.module.css`, `home/ProblemHologram.module.css`, `home/ProblemHologram.tsx` (só cor), `home/home-font.ts`, `home/home.module.css` (só blocos da Home, limitados por classe nova ou `data-block`), `public/home/`, `public/logos/`.

**Não toque:** `solucoes/*`, `institucional/*`, `sobre-nos/*`, `layout.tsx`, `globals.css`. Regras do cabeçalho e da animação na seção 4 do comum.

## Bloqueios

Decidido pelo dono em 04/11/2026: **Home liberada**, **hero em Imperial** e CTA do case indo para `/blog?categoria=cases`.

Não execute este item até o PO avisar:

| Item | Depende de |
|---|---|
| A4 | Arquivos de logo: só existe `arcelormittal.svg`; faltam Cooxupé, CBA, Sicoob, Clara Resorts. Não improvise logo em texto |

Fora desta rodada: descrições do menu (Ajuste 6), que aparecem no cabeçalho, e WhatsApp, já em ouro (Ajuste 5).

## Ordem e itens

Comece por A0. Depois A2, A3, A5, A6, A1 e A4. O hero fica depois porque é o mais sensível no LCP.

### A0. Tipografia e fundo
Carregue o kit na Home e aplique Kepler e Acumin dentro do `<main>`. O seletor `:where(.home) :is(h1,h2,h3)` em `home.module.css` redefine `--font-title` em cada título e é usado por outras páginas: sobrescreva por uma classe da Home, sem editá-lo. Fundo geral branco passa a Limestone só nas seções da Home.

### A1. Hero (`home-hero`), refs `doc-01.png` e `lovable-pagina-inteira.png`
**Intenção:** tese em primeiro plano, marca clássica e ouro; hoje parece startup em branco com recorte.

- Título: `A inteligência que falta na IA.` com **"falta" em itálico dourado**, como no Lovable.
- Apoio: `A IA executa. Quem define onde chegar são as pessoas. Treinamos equipes, estruturamos a governança e implementamos agentes de IA e automações em empresas da economia real.`
- Pensador: `_assets-carol/v3/hero-thinker-lovable.jpg` (1280×1536) no arco, um pouco mais alto e alinhado ao texto, otimizado em `public/home/` e com dimensões declaradas.
- Abaixo dele: `A IA faz a parte operacional. O protagonismo é nosso.` com "protagonismo" em ouro; legenda discreta, não um título.
- Fundo Imperial, com CTA em ouro e texto Imperial: a foto tem fundo escuro e em hero claro viraria adesivo.
- Mantenha: eyebrow, CTA, selo Anthropic, faixa de logos, números e a entrada em cascata.
- O pensador é candidato a LCP: mantenha `priority`, sem esconder na entrada. Meça antes e depois.

### A2. Problema (`home-problem`), refs `doc-03.png` e `doc-04.png`
**Intenção:** voltar ao roxo escuro; terracota em bloco inteiro é contra o papel dela.

- Fundo do bloco de `#85402e...` para Imperial, com filete ou borda sutil em ouro. Remova a sombra terracota e a vinheta avermelhada (`.topVignette`), trocando por tom de roxo.
- Holograma do cérebro em ouro: mude só as cores, mantendo toda a animação.
- Subtítulo "É operacional..." pode ganhar itálico dourado.
- Texto: `Quando pessoas, processos e tecnologia andam em ritmos diferentes, a execução trava e as decisões demoram. Reconhece algum destes sintomas?`
- A frase final agora aponta para os cartões logo abaixo: confira que a leitura flui. Mantenha o empilhamento dos cartões.

### A3. O que fazemos e experiência
Sem pedido de texto. Ajuste só o que a nova fonte e o fundo Limestone exigem: tamanho, quebra e contraste. Não redesenhe.

### A4. Faixa de logos, ref `doc-01.png` (bloqueado)
Adicionar ArcelorMittal, Cooxupé, CBA, Sicoob e Clara Resorts à faixa, com peso visual equilibrado e o loop preservado.

### A5. Case CBA (`home-case`), ref `doc-05.png`
**Intenção:** o case com prova e saída clara.

- Eyebrow: `Case destaque • CBA`.
- Frase final depois do texto: `Consultas que antes eram impossíveis agora levam segundos.` Com peso de frase-chave, não um parágrafo a mais.
- CTA `Ver o case completo →` visível, indo para `/blog?categoria=cases` (`pageReady`).
- Hierarquia: eyebrow, título, texto, frase-chave, selo, CTA. Sem competição entre selo e CTA.

### A6. Diagnóstico (`home-diagnostico`), refs `doc-08.png` (hoje) e `doc-09.png` (alvo)
**Intenção:** fechar a página no mundo Imperial. Esta é a referência mais direta dela.

- Fundo Imperial em largura total, com textura muito sutil (pode usar `/marca/nuvens-douradas.jpg` em baixa opacidade, `loading="lazy"`).
- Título em branco/Limestone com **"na sua operação." em itálico dourado**.
- "Primeiro entendemos. Depois construímos juntos." em itálico dourado.
- CTA principal claro e secundário só com contorno, como em `doc-09.png`. Se os botões atuais não servirem, crie classes novas: não altere `.primaryButton`.
- Mantenha `id="diagnostico"`, o `scroll-margin` e o tagueamento do formulário.
- Confira a emenda com o rodapé, que também é Imperial: precisa de separação (filete em ouro).
