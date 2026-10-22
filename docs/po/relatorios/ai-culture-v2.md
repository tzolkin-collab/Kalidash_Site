# Relatório: AI Culture V2 (alterações da Carol, 20/10/2026)

Brief: `docs/po/briefs/ai-culture-v2-carol.md`. Escopo: §1, §2, §4 e checklist do §5.

## (a) Checklist do §5

| Item | Status | Evidência |
|---|---|---|
| 7 alterações com a copy do §2; seção "O que muda" removida | ✅ | Copy copiada de `pages.ts` (`aiCulture`). Navegador: texto "O que muda" ausente na página. Ressalva: o doc diz "Por que capacitar" sem eyebrow; mantive sem eyebrow (sem inventar) |
| Hero com imagem à direita + barra de prova; sem NPS/logos | ✅ | 1440 px: imagem `evento-sala.jpg` à direita (width/height 633×814, `priority`). Barra renderiza só `+10 mil pessoas capacitadas` e `170 operações atendidas`; `97` e logos têm `confirmed: false` (JS: texto "97" ausente) |
| Metodologia e formatos com animação leve, reduced-motion, sem salto de layout | ✅ | `Reveal` + CSS só com opacity/transform; linha de progresso `scaleX`; `@media (prefers-reduced-motion: reduce)` desliga transições e o JS marca `in` direto. Não medi CLS com ferramenta, só garanti que nada altera layout |
| Formatos: 2 cards lado a lado, mesmo peso, blur, contraste | ✅ ⚠️ | 1440 px: dois cards 628×527 px idênticos; 390 px: empilham na mesma ordem (342 px cada, sem overflow). Foto `metodo-reuniao.jpg` com `blur(14px)` e véu branco 86% (texto #3c373f/#28183b sobre branco ≈ véu: contraste > 4,5:1 por cálculo, não medi com ferramenta). Botões diferem como a Carol pediu (primário × secundário) |
| Depoimentos com player sob demanda; nenhum vídeo no repo | ✅ ⚠️ | `TestimonialCard` só monta o iframe no clique, só para embeds YouTube-nocookie/Vimeo. Lista com Daniel e Larissa como `pending`: em `next dev` aparecem como espaço reservado; no build de produção a seção some (0 ocorrências de "Depoimentos" no HTML estático). Falta URL hospedada e autorização |
| Rodapé novo nas 7 páginas internas e Home; links funcionando | ✅ | Home e `/sobre-nos` conferidas (1440 e 390 px). Componente único `SiteFooter`, então vale para todas. `mailto:comercial@kalidash.com`, cidade em texto, links internos para `/treinamento-corporativo-ia`, `/advisory`, `/execucao`, `/diagnostico`, `/solucoes#kognis`, `/solucoes#spectra-ai`. Não cliquei em cada link |
| Build limpo, sem erro de console, 1440 e 390 px | ✅ | `npm run build` (apps/site) ok, 17 rotas; `npx tsc --noEmit` sem erros; console sem erros em `/treinamento-corporativo-ia`; sem overflow horizontal em 390 px |

Todo CTA continua em `/diagnostico`.

## (b) Arquivos
`apps/site/src/app/institucional/{pages.ts, SitePage.tsx, Motion.tsx (novo), institucional.module.css}`, `home/{content.ts, SiteFooter.tsx, home.module.css}`, `docs/pagesClient/home.md`.

## (c) Commits
Ver `git log` (`feat(site): ...`).

## (d) O que ficou de fora
- NPS 97 e logos (só código pronto, `confirmed: false`).
- Depoimentos reais: sem URLs/autorização.
- Não medi LCP/CLS com Lighthouse; não rodei verificação automática de contraste.
- Rodapé em largura 641–1100 px (regra nova de 2 colunas) não conferida visualmente.

## (e) Riscos
- Pergunta 4: os rótulos "Cultura de IA · Governança · Execução" foram mapeados para `/treinamento-corporativo-ia`, `/advisory`, `/execucao`; se a Carol mantiver "AI Culture, Advisory, Execução", é troca de texto em `content.ts`.
- Card 2 mantém "A partir de 5 pessoas" e "Certificado e plano de aplicação…" como no doc (pergunta 2) e a promessa de certificado no Card 1 (pergunta 3) está publicada como no doc.
- O rodapé mudou para 4 colunas; revisar visualmente em tablet.
- Descartei o eyebrow "Nossa metodologia" e "Por que capacitar?" porque o doc não os traz; confirmar.

## (f) O que Gustavo e Carol precisam fazer
- Carol: responder as perguntas 1 (fonte do NPS), 2, 3, 4, 5 (ok de uso de logos + arquivos de CBA, Sicoob, Cooxupé), 6 (autorização dos depoimentos) e 7 do §3 do brief.
- Gustavo: decidir o hosting dos vídeos (YouTube/Vimeo não listado recomendado); depois preencher `embedUrl`/`posterUrl` e trocar `status` para `approved` em `pages.ts`; trocar `confirmed` para `true` na barra de prova quando aprovado.

## Adendo (20/10, depois da entrega): Home V2 e imagens

Pedido direto da Carol, fora do brief original. Commits `5392533` (copy da Home: hero, problema, três frentes, WhatsApp `wa.link/v9grih`), `ce19381` (fotos das frentes e da galeria, doc "V3 - Imagens") e `85d7c7d` (case CBA, remoção de "Por trás da transformação", CTA "Fale com a Kalidash").

- **Fonte:** docs do Drive da Carol lidos por metadados/PDF; imagens baixadas por link público para `_assets-carol/` (fora do git) e otimizadas em `public/home/`.
- **Não feito:** alt. 8 (depoimentos em 3 cards: faltam dados reais e autorização), selos Anthropic/Inovativos na barra de prova (a Home não tem barra), página `/cases/cba` (CTA oculto por `caseCba.pageReady`), logos (ok de uso).
- **Suposições:** "Química Anastácio" omitida (link repete o da Imersão de Claude); 16ª foto da galeria ("Esse pode manter") assumida como `evento-sala.jpg`; as três imagens das frentes mapeadas pela ordem do doc.
- **Não verificado:** build completo com a API do blog no ar (o build avisa "Falha ao buscar artigo do blog", que é o blog sem API local, e termina com exit 0); olhar visual de cada foto da galeria.

## Adendo 2 (20/10): cards da Home, Advisory e Execução

Commits: `8fcc1ec` (cards de depoimento da Home, alt. 8), `82ca18e` (foto da Química Anastácio), `7219177` (Advisory e Execução V2), `201e9f3` (header no reload).

- **Advisory** (`/advisory`): hero com imagem, chips, rituais animados, "Como começa" em 3 passos, "Para quem é" com link para o AI Culture e FAQ com JSON-LD FAQPage (confirmado no navegador). URL mantida; renomear para `/consultoria-governanca-ia` com 301 é decisão do Gustavo.
- **Execução** (`/execucao`): hero com imagem (a Carol não indicou qual; usei a da frente Execução), cards com exemplo e animação, "Nosso diferencial" e a faixa antiga removidos, vitrine "Feito para funcionar". `+100` e `170` publicados; "12 horas por semana" e os números do piloto da CBA ficam atrás de `confirmed: false`; CTA `/cases/cba` oculto até a página existir.
- **Verificação:** `tsc` limpo, `npm run build` com exit 0, conteúdo e animações conferidos no navegador (~770 px) e sem overflow horizontal a 390 px em Home, Advisory, Execução e AI Culture. Não conferi 1440 px nas páginas novas nem o hover. O build mostra "Falha ao buscar artigo do blog" porque a API do blog não está no ar localmente.
- **Header no reload:** `scrolled` volta correto; o caso mobile (header escondido após reload) não foi confirmado porque o painel de preview oculto bloqueia `requestAnimationFrame`. Conferir num reload real.
- **Pendências de terceiros:** selos da alt. 1 da Home (onde entram), depoimentos reais, `/cases/cba`, logos, fonte do NPS 97 e de "12 horas", entregáveis do Advisory, imagem do hero da Execução.

## V2.1 (22/10): respostas da Carol ao PO

HEAD de partida: `8ddfede`.

| # | Item | Status | Evidência |
|---|---|---|---|
| 1 | Rodapé "Para empresas": AI Culture · Advisory · Execução · Diagnóstico | ✅ | `home/content.ts`; navegador (1440 e 390 px): coluna mostra os quatro nomes; links já apontavam para `/treinamento-corporativo-ia`, `/advisory`, `/execucao`, `/diagnostico` |
| 2 | Eyebrows "Por que capacitar?" e "Nossa metodologia" | ✅ | `pages.ts` (`aiCulture`); navegador: ambos presentes em 1440 e 390 px |
| 3 | Card 1 mantido; Card 2 inalterado | ✅ | sem mudança de copy |
| 4 | NPS 97 desligado | ✅ | `confirmed: false`; HTML de produção tem 0 ocorrências de "NPS" |
| 5 | Faixa de logos só com os 4 arquivos | ✅ | `resolveLogos` em `SitePage.tsx` procura `public/logos/{arcelormittal,cba,sicoob,cooxupe}.(svg\|png\|webp)`. Testado com arquivos temporários (removidos): 4 arquivos + `confirmed: true` → faixa aparece; faltando 1 → some. Hoje: `confirmed: false` e só existe `arcelormittal.svg` |
| 6 | Player com MP4, `ALLOWED_MEDIA_HOSTS`, aprovação | ✅ ⚠️ | `institucional/media.ts` (lista vazia, com comentário para o Gustavo) e `Motion.tsx` (`<video controls autoplay playsinline preload="none" poster>` no clique; YouTube-nocookie e Vimeo mantidos). `mediaKind` testado em Node: host vazio bloqueia MP4; com host só `https` + `.mp4`; `http`, outro host e `javascript:` bloqueados. Em produção só aparece item `approved` com mídia válida, cargo e empresa. HTML de produção: 0 ocorrências de "Depoimentos". ⚠️ O `<video>` em si não foi exercitado no navegador (não há URL de MP4 nem host); só a lógica |
| 7 | Não tocar blog, preview, admin, api | ✅ | só `apps/site/src/app/institucional` e `home/content.ts` |

**Restauração do `content.ts`:** a cópia de trabalho de `apps/site/src/app/home/content.ts` estava numa versão anterior aos meus commits (mtime 21/10 19:11), o que desfazia a Home V2 (WhatsApp `wa.link/v9grih`, hero, frentes, cards, rodapé). Com o OK do PO restaurei **só esse arquivo** com `git checkout HEAD -- apps/site/src/app/home/content.ts` (HEAD `8ddfede`) e apliquei o item 1 por cima. O backup da versão antiga ficou com o PO. Conferi `git status` depois do build e do navegador: o arquivo não voltou a regredir. `apps/admin/src/lib/site.ts` (porta 3001) está modificado por outra sessão e não foi tocado.

**Verificação:** `npx tsc --noEmit` limpo; `npm run build` exit 0 (o aviso "Falha ao buscar artigo do blog" é a API do blog fora do ar localmente); navegador em 1440 e 390 px sem overflow. Console: só um erro de script injetado (`<anonymous>`), não do site.

**Ajuste extra:** a legenda dos depoimentos não mostra mais " · " solto quando cargo e empresa estão vazios.

**Para o Gustavo:** colocar `cba`, `sicoob` e `cooxupe` (svg, png ou webp) em `apps/site/public/logos/` e trocar `confirmed` para `true` na faixa de logos; subir os MP4 e posters no R2, preencher `ALLOWED_MEDIA_HOSTS` em `institucional/media.ts`, e preencher `embedUrl`, `posterUrl`, cargo, empresa e `status: "approved"` de Daniel e Larissa.
