# Animação das páginas internas: regras comuns

> Leia inteiro antes de abrir o brief da sua página. Vale junto com `D:/Códigos/Tzolkin/Projetos/carol/kalidash/docs/po/briefs/v3-comum.md` (cores, tipografia, cabeçalho e copy).
> Base de todo o trabalho: branch `claude/v3-preview`.

## 1. Etapa obrigatória antes de codar: estudo da referência

A linguagem de movimento vem do **site da Tzolkin** (`https://tzolkin.cloud`). O código dele está em:

`C:/Users/gusta/AppData/Local/Temp/claude/7d93ad790ff35fa3/cfa0c0d9-f201-4dc2-bbe8-82018f9f0402/scratchpad/tz/Tzolkin_Site`

Se a pasta não existir: `gh repo clone tzolkin-collab/Tzolkin_Site -- --depth 1`, numa pasta fora do projeto. Só leitura: não instale nada lá.

**Primeiro entenda só isto:** os elementos animados, os tipos de seção, o layout de cada uma e a animação de cada uma. Ignore copy, cor, preço e backend. Abra o site, role devagar e leia o código ao mesmo tempo.

Comece por estes arquivos, em `src/client/shared/ui/`:

| Arquivo | O que estudar |
|---|---|
| `ApplicationsMethodStory.tsx` | **O padrão principal.** Palco preso (`sticky`), altura dada em telas, `useScroll` + `useTransform`, troca de conteúdo sem a página descer, `inert` e `aria-hidden` na camada escondida |
| `ServicesSection.tsx` | Índice que abre um item por vez, ligado à rolagem e clicável |
| `MethodTOISection.tsx`, `apps/MethodPanels.tsx` | Três etapas com painel que muda, sem salto de layout: tudo empilhado na mesma célula |
| `hero/HeroPhoneRise.tsx`, `hero/HeroMockups.tsx` | Peça que sobe com a rolagem; `SETTLE`, escala e rotação pequenas |
| `hero/HeroBackground.tsx`, `assets/GradientBands.tsx` | Fundo que é parte da marca e reage à rolagem |
| `product/ProductWorkbench.tsx`, `product/*.module.css` | Demonstração viva: elementos da tela se movem (`layoutId`), com `useReducedMotion` |
| `apps/EcommerceSection.tsx`, `apps/EcommerceDevices.tsx` | Mesma ideia em outra seção, para ver a variação |
| `FounderSection.tsx`, `FinalCta.tsx`, `SectionHeader.tsx` | O que é simples de propósito: nem toda seção vira palco |
| `SmoothScrolling.tsx` | Só para conhecer. **Não usaremos Lenis** (seção 3) |

A sessão "O que construímos" da nossa Execução (`solucoes/BuildStory.tsx`, `solucoes/BuildMocks.tsx`) já veio desse padrão. Compare os dois.

**Entregue antes do código**, em `docs/po/relatorios/motion-estudo-<página>.md`:
1. Tabela: seção do tzolkin.cloud, tipo, layout, gatilho, o que se move, técnica, arquivo e linha.
2. Os princípios que você extraiu, em até 8 linhas.
3. Para cada seção da sua página: qual padrão usa e por quê.

Depois siga direto para o código, sem esperar aprovação.

## 2. O que copiar e o que não copiar

**Copie o método:**
- Movimento tem motivo: explica a mensagem da seção. Se não explica, não entra.
- O movimento segue a rolagem. "Nada se move sozinho", como diz o código dele. Laços contínuos só em detalhe pequeno, lentos e parados fora da tela.
- Curva `cubicBezier(0.33, 1, 0.68, 1)` (`SETTLE`).
- Um palco preso por página, no máximo dois. O resto é simples.
- Toda demonstração tem conteúdo específico do negócio, nunca um quadrado genérico.

**Não copie:** o visual da Tzolkin. Nada de vermelho, faixas diagonais, telefone ou notebook como padrão. A Kalidash é repertório clássico, linha fina em ouro, Imperial e Limestone (`v3-comum.md`, seções 1 e 2).

**Tradução dos recursos:**

| No tzolkin.cloud | Na Kalidash |
|---|---|
| Faixas vermelhas | Geometria em linha fina ouro (arcos, pentágono, constelação, como no pensador) |
| Telefone e notebook | Foto em arco, escultura, painel simples com dado real da copy |
| Laje que sobe | Capítulo Imperial que sobe sobre o Limestone |

## 3. Técnica

- **Biblioteca:** `framer-motion` (já está no `package.json` do branch), a mesma do tzolkin.cloud. Use `useScroll`, `useTransform`, `useReducedMotion`, `useInView`, `motion.path`. Componentes com `"use client"` só no que anima.
- **Peso:** use `m` com `LazyMotion` onde couber, e `next/dynamic` para peças abaixo da dobra. Nunca importe a biblioteca na parte do hero que afeta o LCP se CSS resolver.
- **Sem GSAP e sem Lenis.** O Lenis muda a rolagem do site inteiro e o cabeçalho e as cortinas dependem da rolagem nativa.
- **Só `transform` e `opacity`.** SVG pode usar `pathLength`. Sem animar `width`, `height`, `top`, `box-shadow` ou `filter`, salvo item pequeno justificado.
- **Assets animados:** ícones e diagramas em SVG inline, traçados com `pathLength`. Foto: leve deslocamento ou escala, sem esconder. Imagens em `public/marca/`; originais do Brand Guide em `docs/po/design/marca/pdf-assets/` (`CATALOGO.md`). **Não use nada de `evitar/`.** Otimize antes de publicar. Não invente imagem nem gere ilustração nova com IA.

## 4. Convivência com o que já existe

A página é dividida em capítulos com cortina (`ScrollMotion`, `data-motion="curtain"`, `.chapter`, rótulo "nº / total"):
- A cortina, o rótulo e a contagem de capítulos continuam funcionando.
- Palco preso vai **dentro** do capítulo, como `BuildStory` e `StepsPin`, que já resolvem isso. Copie a forma deles de lidar com `data-live`, altura e celular.
- Não ponha `overflow` em ancestrais do `sticky`. `overflow: clip` só no próprio palco.
- Elementos com animação própria precisam ficar fora do `surge` do `ScrollMotion` (veja a lista `own` em `ScrollMotion.tsx`).

## 5. Regras que reprovam a entrega

1. **Cabeçalho:** não mexer (`v3-comum.md`, seção 4). Ele precisa continuar acompanhando o fundo, inclusive dentro dos palcos.
2. **Animações existentes:** nenhuma se perde.
3. **Copy:** nenhuma palavra muda. Dividir frase em peças é permitido, sem alterar a ordem das palavras. `aria-label` novo pode.
4. **Conteúdo nunca nasce escondido sem JS.** Sem JS, com `prefers-reduced-motion` e em tela pequena, tudo aparece completo e empilhado.
5. **Celular primeiro na conferência:** palco preso só de 1024 px para cima e altura mínima de 600 px, como `BuildStory`. No celular: empilhado, com reveal por `useInView`. Teste com toque, sem salto, no caminho iOS.
6. **Desempenho:** LCP, CLS e TBT não pioram. Meça antes e depois. Sem queda perceptível de quadros: teste com CPU 4x mais lenta no DevTools.
7. **Outras páginas intactas:** `/`, `/sobre-nos`, `/solucoes`, `/kognis`, `/spectra` e a outra página da frente, com comparação de pixels em movimento reduzido.
8. Sem rolagem horizontal em 1440, 1024, 768 e 390. Sem erro de console.

## 6. Arquivos, para as três sessões não se atropelarem

Cada página cria seus próprios arquivos:
- `solucoes/<Pagina>Motion.tsx` e `solucoes/<pagina>-motion.module.css` (nomes abaixo, por página).
- Em `KitPage.tsx`: **só o ponto de encaixe** da sua página, o menor possível, com `if (page.slug === ...)`. Não reorganize o arquivo.
- `kit.module.css`: só acréscimos, em bloco próprio com comentário da sua página.
- `institucional/pages.ts`: só o objeto da sua página.

Não toque em `home/*`, `layout.tsx`, `globals.css`, `ScrollMotion.tsx`, `CountUp.tsx`, `HeaderTone.tsx`. `StepsPin` e `BuildStory`: só a sessão de Execução pode alterar; as outras reutilizam como estão.

## 7. Entrega

- Rode em porta própria (Advisory 3301, Execução 3302, AI Culture 3303). A **3300 é a versão única que o dono está vendo: não a derrube e não publique nela.**
- Commits pequenos, um por seção, no seu branch, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push e sem merge: o PO junta na `claude/v3-preview`.
- `docs/po/relatorios/motion-<página>.md`: por seção, o que fez, o padrão usado, o que ficou de fora e os números.
- Em `docs/po/relatorios/motion-<página>/`: sequência de 4 a 6 quadros por seção animada, em 1440 e 390, e **um vídeo curto (webm) da rolagem inteira**, gravado com Playwright. Movimento não se aprova por imagem parada.
- Autoavaliação honesta: "isso parece profissional ou enfeite?". Se uma animação não acrescenta nada, retire e diga por quê.
