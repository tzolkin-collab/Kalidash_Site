# Ajustes V3: regras comuns às sessões A e B

> Leia inteiro antes de abrir qualquer arquivo. Fonte: doc "Ajustes V3 - Site Kalidash" da Carol (02/11/2026), comentários dela, galeria Lovable e Brand Guide.
> Referências em `D:/Códigos/Tzolkin/Projetos/carol/kalidash/_assets-carol/v3/` (pasta ignorada pelo git; use o caminho absoluto). `doc-NN.png` é a imagem NN do doc.

## 1. A intenção da Carol (não é troca de texto)

A crítica dela é de **hierarquia e de desenho**: "hierarquia visual confusa", "frases cortadas", "fonte grosseira", "ficou extremamente simples". Trocar a copy e parar ali reprova a entrega.

O que ela quer ver:

1. **Uma casa de consultoria com repertório clássico, não um SaaS.** Roxo Imperial e Limestone como os dois mundos da página, ouro como assinatura.
2. **Mais dourado, com critério.** "Podemos explorar mais o dourado, por ser nossa cor secundária, pra combinar com os ícones e fotos." Ouro em palavra-chave, numeral, filete, ícone de linha e CTA sobre fundo escuro.
3. **Uma palavra de sentido em itálico dourado, não a última da frase.** Nas referências: "E agora?", "melhor", "rituais", "depois dele", "na sua operação.", "capacidade". A regra atual (`LastWord`) destaca a última palavra e por isso erra em "ferramenta". É o centro desta rodada.
4. **Dois níveis claros em cada seção:** título curto e fluido + apoio menor. A frase-manifesto vira assinatura, não um segundo título gigante.
5. **Conteúdo organizado com desenho:** filetes, numeração romana em ouro, ícones de linha, faixas, cartões escuros quando há três itens iguais. "Mais fluidez", sem amontoar.
6. **Frases inteiras.** Títulos com menos cortes, em duas linhas equilibradas (`text-wrap: balance`), sem palavra sozinha na última linha.

**As referências valem pela hierarquia, não para copiar.** Palavras dela: "não que é pra ficar 100% igual, mas se liga na hierarquia visual" e "tem muitos elementos, mas pra termos uma noção de como usar melhor a seção". Reproduza a ordem de leitura, os níveis e os recursos que servem. Não copie todos os enfeites.

## 2. Cores: papel de cada uma

Use estes valores; as cores das referências são inspiração. O pêssego de `doc-15.png` não é da marca e vira Limestone.

| Cor | Valor | Onde usar | Onde não usar |
|---|---|---|---|
| Imperial | `#28183B` | Fundos de seção escura, hero escuro, cartão escuro | Texto corrido sobre claro quando Ink couber |
| Aubergine | `#46304F` | Cartões sobre Imperial, superfícies secundárias | Competindo com o Imperial em seção inteira |
| Limestone | `#F1ECE4` | Fundo claro principal; texto sobre escuro | |
| Limestone fundo | `#E9E1D6` | Alternância clara, cartão claro sobre Limestone | |
| Ink | `#19171B` | Títulos e texto sobre claro | Fundo de seção (use Imperial, não preto) |
| Ouro | `#A88A58` | Palavra-chave, numerais, filetes, ícones, CTA sobre escuro (texto Imperial) | Texto pequeno sobre Limestone: use `#8F7248` para passar em contraste |
| Terracota | `#B7654D` | Apoio pontual: eyebrow em claro, CTA em claro, temas de pessoas e execução | Seção inteira, bloco de fundo grande |

Sobre escuro, o texto secundário é Limestone com 66% de opacidade. Contraste AA em todo texto; meça.

## 3. Tipografia

- Kit Adobe já pronto: `https://use.typekit.net/krs4uwp.css`. **Não use** o zip de `apps/site/docs/`: não tem licença e o repositório é público.
- Títulos: `"kepler-std-display", Georgia, serif`. Corpo: `"acumin-pro", system-ui, sans-serif`.
- Carregue o kit **só na sua página** (`<link rel="stylesheet" href="..." precedence="default" />` no componente), nunca em `layout.tsx`.
- Aplique as famílias **dentro do `<main>`**. Cabeçalho, menu e rodapé mantêm as fontes atuais.
- Pesos: hoje o kit só tem 400 e 700; a Carol vai incluir Light e Semibold. Declare `--w-title: 400` e `--w-strong: 700` em um único lugar, para trocar por 300 e 600 depois. **Títulos nunca em 700.**
- A Kepler é mais estreita que a Fraunces: reveja tamanho e quebra de cada título, não só a família.

## 4. O que é proibido

### Cabeçalho: não mexer
Não altere `home/HomeHeader.tsx`, `home/SidebarMenu.*`, `home/menu-font.ts`, `solucoes/HeaderTone.tsx`, `components/BrandLogo.*`, `nav`/`navCta` de `home/content.ts`, nem as classes `.header*`, `.nav*` de `home.module.css`.

Aceite: em 1440 e 390, com o cabeçalho sobre fundo claro e escuro, a família, o tamanho e a posição medidos em `getComputedStyle` ficam iguais ao commit de partida. O comportamento também: some ao rolar, volta ao subir, logo que recolhe, cor que segue o fundo, submenu. Se algo exigir mexer nele, **pare e pergunte**.

### Animações: nenhuma pode se perder
Reestilizar não pode remover nem enfraquecer movimento. Se o HTML mudar, mantenha os atributos e a estrutura de que a animação depende.

| Onde | Peça | Atenção |
|---|---|---|
| Global | `RouteTransition`, `LogoIntro` | Não tocar |
| Home | Entrada do hero (`data-enter`, `--enter-delay`), `AnthropicPartnerBadge`, faixa de logos em loop | O hero tem cascata depois da abertura |
| Home | `ProblemHologram`, `ChallengeBento`, cartões empilhados (`--stack`), `FlickeringGrid` | Trocar cor, não a animação |
| Home | `ExperienceSyncGallery`, `Reveal`, `TestimonialCard` | Não tocar a lógica |
| Internas | `ScrollMotion`: `data-motion="hero|curtain|surge|surge-within"` | Cortina depende de `.chapter`/`.curtain`; não pôr `overflow` em ancestrais, não trocar a ordem |
| Internas | Rótulo "nº / total" (`.chapterLabel`, `data-text`), barra de progresso | A contagem vem de `chapterBlocks` |
| Internas | `StepsPin`, `BuildStory`, `CountUp` | Pin e acordeão de Execução intactos |

Aceite: para cada peça da sua página, entregue uma sequência de 3 a 5 quadros antes e depois. Teste também com `prefers-reduced-motion` e no celular (390), incluindo iOS simulado: a cortina e o surge já quebraram lá (`5083884`).

### Outros limites
- `home.module.css` é importado por várias páginas. Não altere `.home`, `.primaryButton`, `.secondaryButton`, `.textLink`, `.whatsapp` nem o rodapé. Crie classes novas ou limite por `data-block`.
- `ProductPage.tsx` e `product.module.css` servem também Kognis e Spectra, que **não podem mudar**.
- Copy: só muda o que o brief manda. Nenhum rótulo novo, mesmo que apareça na referência ("Plano aprovado", "Contínuo", "Fim do 1º trimestre"). Ícone e numeral não são copy.
- Sem biblioteca nova. Animação só com `opacity` e `transform`.
- Não toque em `apps/admin` nem `apps/api`.
- Não dê push, não faça merge, não ligue flag. `git add` só dos seus arquivos.

## 5. Como trabalhar

Antes de escrever código, para **cada seção**, escreva no relatório em três linhas: o que a referência faz, o que você vai reproduzir, o que vai deixar de fora e por quê. Trabalhe uma seção por vez, olhando a tela. "Compila" não é aceite.

Rode o site em porta própria (A: 3201, B: 3202). A porta 3000 é de outra sessão: não a derrube.

## 6. Pronto quando

1. Cada item do brief visto no navegador em 1440, 1024, 768 e 390, sem rolagem horizontal e sem erro de console.
2. PNG real de antes e depois por seção, em 1440 e 390, em `docs/po/relatorios/v3-<sessão>/`, lado a lado com a referência.
3. Autoavaliação honesta por seção: "a hierarquia ficou clara?", olhando a imagem. Diga o que não ficou bom.
4. Aceites de cabeçalho e de animação da seção 4.
5. `pnpm --filter @kalidash/site lint`, `tsc --noEmit` e `build` passam.
6. Copy: `docs/po/relatorios/copy-diff.mjs` só acusa o que o brief manda.
7. LCP, CLS e TBT antes e depois (`docs/web-vitals.md`, mediana de 3). LCP não pode piorar; se piorar, explique a causa.
8. Relatório curto em `docs/po/relatorios/v3-<sessão>.md`: o que mudou, o que falta, riscos, commits.

Commits pequenos no **seu branch**, um por seção, terminando com:
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
Quem junta os branches em `main` é o PO, depois de o dono ver o antes e depois.
