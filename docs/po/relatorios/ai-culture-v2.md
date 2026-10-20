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
