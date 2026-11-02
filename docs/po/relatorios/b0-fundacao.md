# B0 Fundação (brief revisado) — páginas internas do site

Data: 02/11/2026. Brief: PO, 02/11 (substitui o B0 de `institucional.module.css`, que cobria só `/solucoes`). Checklist: `docs/po/design-site-checklist.md`.

## 1. Itens do checklist

| Item | Status | Evidência |
|---|---|---|
| (1) `/advisory`: frase "Não entregamos um plano..." grande demais | ✅ | `.assert h2` de `clamp(34px, 4.6vw, 68px)` / `line-height: 1` para `var(--t-claim)` = `clamp(28px, 3.2vw, 44px)`, `line-height: 1.1`, `max-width: 22ch`. Capturas `depois/advisory-1440.png` e `-390.png`. |
| (2) `/treinamento-corporativo-ia`: "Nosso objetivo é criar capacidade..." idem | ✅ | Mesmo `.assert h2` (a frase é um `highlight` tratado pela mesma classe). Captura `depois/treinamento-corporativo-ia-1440.png`. |
| (3) Escala de lemas com teto + cinzas/raios em variáveis | ✅ | Tokens novos em `.page` de `solucoes.module.css`: `--t-claim` (frase longa, teto 44px), `--t-lema` (lema curto, teto 56px), `--t-title` (título de seção, teto 56px). Aplicados em `.assert h2`, `.keyline` (sobre-nos), `.stepsNote`, `.h2Wide`, `.steps h2`, `.poster h3`, `.section h2`, `.beliefHead/.teamHead h2`, `.closing p`. Números de cartaz e `h1` de abertura não mudaram. Cinzas viraram `--text-2/#3c373f` (inclui `#514c53`), `--text-3`, `--rule`, `--brand-text`; raios viraram `--r-control` (4) e `--r-surface` (12). Pílula/arco `999px` e círculos `50%` ficam (forma, não raio de superfície). |
| (4) Cabeçalho fixo cobre o texto ao rolar | ✅ | Causa vista em `antes/scroll-treino-1440.png`: o header da Home tem `rgba(255,255,255,.88)` + blur e o texto da seção aparecia por baixo da logo. Correção escopada em `.page :global(header[data-block="home-header"])`: fundo `#fff`, sem blur, hairline. `scroll-margin-top: calc(var(--header) + 24px)` em `[id]`. Rolagem real vista em `depois/scroll-treino-1440.png` e `-390.png`. `home.module.css` não mudou. |
| (5) Detalhes em preto mantidos | ✅ | Nenhuma regra de `--night`/faixa escura foi alterada (só cinzas e escala de lema). |
| (6) Home: estátua alinhada ao topo do texto | ✅ | `HomeHero.module.css`: `.main { align-items: end }` para `start`. Topo da estátua em y≈170, eyebrow em y≈174 (1440): `antes/home-1440.png` vs `depois/home-1440.png`. Nada mais na Home. |
| Copy idêntica | ✅ | `copy-diff.mjs` rodado contra baseline gerada no HEAD (`30a18cb`) antes de editar: `OK` nas 10 rotas (7 internas, `/diagnostico`, `/blog`, `/blog/artigo-1`). Ver ressalva em 4. |
| Console limpo, sem rolagem horizontal | ✅ | Script CDP (Chrome headless), 8 rotas × 1440/390: 0 erros, `scrollWidth - clientWidth = 0` em todas. |
| CLS < 0,1 em 390/900/1440 | ✅ | `design-craft/scripts/cls.mjs`, 8 rotas × 3 larguras: CLS 0,000 em todas. |
| Lint, tsc, build | ✅ | `pnpm --filter @kalidash/site lint`: 0 erros, 2 avisos antigos de `<img>` em `home/ExperienceSyncGallery.tsx`. `tsc --noEmit`: sem saída. `next build`: compilou. |
| Capturas antes/depois 1440 e 390 (7 rotas + Home) | ✅ | `docs/po/relatorios/b0-fundacao/{antes,depois}/` (`shot.mjs`, resolução real, seletor `main`; Home viewport). |
| Web Vitals (LCP, TBT) | ⚠️ | Não medi LCP/TBT: a mudança é só CSS e o brief revisado não pediu. A medição "antes" que eu tinha começado foi interrompida. Só CLS foi medido. |

## 2. Arquivos alterados
- `apps/site/src/app/solucoes/solucoes.module.css`, `kit.module.css`, `product.module.css`
- `apps/site/src/app/sobre-nos/sobre-nos.module.css`
- `apps/site/src/app/home/HomeHero.module.css` (1 linha)
- Este relatório e `docs/po/relatorios/b0-fundacao/` (capturas)

## 3. Commits
- `770a667` fix(site): teto nos lemas, cabecalho solido e tokens de cinza/raio nas paginas internas
- `1eaac95` fix(site): estatua do hero da Home alinhada ao topo do bloco de texto

## 4. O que ficou de fora e por quê
- Meu trabalho anterior em `institucional/institucional.module.css` e `Motion.tsx` (brief antigo) foi **descartado** com `git checkout` (nunca commitado): esses arquivos hoje só servem `/solucoes` via `SitePage`... na prática o `/solucoes` usa `solucoes/page.tsx`, e `institucional/` ficou sem rota ativa além de tipos/`pages.ts`.
- A baseline de copy do repositório (C1) já divergia do HEAD (caixa-alta e quebra de itens, vindos do commit `30a18cb`). Gerei uma baseline nova do HEAD **fora do repositório** e comparei com ela; a do repo não foi alterada. O PO deve regenerar `copy-baseline/` com `copy-diff.mjs --save` num commit consciente.
- Blog: o servidor falso que usei não é o mesmo da C1, então o diff de blog só vale contra a minha baseline.
- Não toquei `Reveal`/`Motion.tsx`: as páginas novas não usam mais `Reveal` (movimento é CSS `animation-timeline`).
- Não toquei `diagnostico/**`: há alterações abertas de outra sessão (B5) que não são minhas.

## 5. Riscos
- `.page :global([id]) { scroll-margin-top }` vale para qualquer elemento com `id` dentro das páginas internas (inclui `<main id>` se houver); efeito só em âncoras.
- O header sólido nessas páginas difere do translúcido da Home (decisão do brief); a transição entre Home e interna fica visível.
- `#514c53` virou `--text-2 #3c373f`: dois textos de apoio ficam um pouco mais escuros.
- Nas capturas de página inteira de `/sobre-nos` aparece um vão grande sob "Quem somos". É o `<img>` do time (carregamento preguiçoso fora da viewport na captura em altura 6000); o CSS dessa imagem não mudou. Não confirmei por captura de viewport.
- O servidor local (`next start :3199`) e o servidor falso do blog (`:8299`) que subi continuam rodando na máquina.

## 6. O que o dono precisa fazer
- Nada obrigatório. Conferir o cabeçalho em rolagem real no aparelho dele (390) após o deploy.

## 7. Perguntas de produto para o PO
- O vão sob "Quem somos" em `/sobre-nos` é só artefato de captura? Posso conferir com captura de viewport se quiser.
- Quer o mesmo cabeçalho sólido na Home e no Blog? Hoje só nas páginas que usam `solucoes.module.css`.
