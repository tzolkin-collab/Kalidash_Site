# Relatório D0 + D1: direção das páginas institucionais

> Designer. Entregue 31/10/2026. Nada em `apps/site` foi editado. Direção e protótipo para aprovação do PO (nota >= 9 antes de código).

## 1. Checklist

| Item | Estado | Evidência |
|---|---|---|
| Capturas reais "antes" das 7 rotas em 1440 e 390 | ✅ | 14 PNGs de página inteira em `docs/po/design/antes/` (`shot.mjs` adaptado: rolagem gradual + clip da página). Vi todas em 1440 e uma em 390 (execucao, sobre-nos); as outras 390 **não** abri |
| Diagnóstico do "chapado" + auditoria de tells | ✅ | `01-institucionais.md` §1 (tabela de tells com onde aparece cada um) |
| Hipótese das faixas brancas em `/kognis` | ⚠️ parcial | Reproduzi o vazio só **sem rolar** (4 faixas de ~500px, `antes/kognis-1440-semscroll.png`); causa lida em `Motion.tsx` (`Reveal` fica opacity 0 até o `IntersectionObserver`). Com rolagem gradual tudo aparece (`antes/kognis-1440.png`). Não testei salto de rolagem nem impressão. Vazio real que sobra: ~150px título→conteúdo |
| Abrir referências da seção 5 e escrever 4 linhas | ⚠️ parcial | Vi 6: Linear about, Linear features, Anthropic Academy, Stripe about, Thoughtworks, BCG (§2 do doc). **Não vi** McKinsey, Vercel (voltaram só 900px), Cohere, Stripe payments, Palantir (capturados, não analisados; PNGs apagados). Não usei esses como âncora |
| Âncora por página | ⚠️ | Definida para 5 de 7; Soluções sem âncora vista; Kognis/Spectra só pelo princípio de "artefato real" e não há artefato (§3 do doc) |
| D0: `00-sistema.md` + `tokens.css` | ✅ | escala tipográfica, 8pt, raio 4/12, sombra só na foto-herói, papéis de cor, ritmo (paper/warm/band/foto), grade, movimento; tabela dos 17 tipos de bloco (hero, heroMedia, proofBar, text, cards, steps, list, faq, offers, proof, timeline, beliefs, team, formats, testimonials, showcase, cta) |
| D1: `01-institucionais.md` por página e seção | ✅ | 7 páginas, cada seção com papel, objeto, domina, próximo |
| Protótipos HTML estáticos vistos em tamanho real | ⚠️ | 5 arquivos em `proto/` + 16 capturas em `proto/shots/`. Vi em 1440: hero e timeline (Sobre nós), hero/tabela/passos (Kognis), showcase e offer-1 (Execução/Soluções), rituais e lista (Advisory), hero e formatos (AI Culture). Em 390 só `cards-1` do Kognis |
| Copy idêntica nos protótipos | ⚠️ | Copiei de `pages.ts`; **sem diff automático**. FAQ do Advisory tem 4 de 6 perguntas no protótipo. O lead de `/solucoes` foi copiado da captura (arquivo lido só em parte) |
| Restrições (sem métrica/depoimento novos, sem cartão em cartão, só opacity/transform) | ✅ | auditoria §7 do doc; protótipos sem JS e sem animação |
| Console limpo / Web Vitals / 1024 e 768 | ❌ não feito | fora do escopo D0/D1; não medi |

## 2. Arquivos alterados (todos novos, só em `docs/po/`)

- `docs/po/design/00-sistema.md`, `docs/po/design/tokens.css`
- `docs/po/design/01-institucionais.md`
- `docs/po/design/proto/{proto.css, 01-sobre-nos, 02-kognis, 03-advisory, 04-execucao-solucoes, 05-ai-culture}.html` e `proto/shots/*.png`
- `docs/po/design/antes/*.png` (14), `docs/po/design/refs/*.png` (8)
- este relatório

## 3. Commits

- `65a4952` docs(po): D0 sistema e tokens das paginas internas
- `09b1805` docs(po): D1 direcao das institucionais, prototipos e capturas
- (este relatório num terceiro commit, `docs(po): relatorio d0-d1`)

`git add` só dos meus caminhos; não toquei em `docs/ambientes/` nem em `docs/po/relatorios/copy-baseline/` (de outra sessão).

## 4. O que ficou de fora e por quê

- **Protótipos das seções `beliefs`, `team`, `proof`, FAQ, `offer-2`, `testimonials`** foram escritos (menos `testimonials`, que hoje não renderiza) mas não olhados em tamanho real, por limite de contexto.
- **Mobile dos protótipos**: um bloco visto; o resto só tem CSS responsivo escrito. Indício de ~9px de overflow no `02-kognis` em 390 (largura de captura 399), não investigado.
- **Diff de copy automatizado**: ficou para quem implementa (aceite 3.1 do checklist).
- **Protótipo de `/spectra`**: sem objeto real, não desenhei tela; a direção está no doc.
- D2 (Diagnóstico) e D3 (Blog) não eram deste pacote.

## 5. Riscos

1. **Kognis e Spectra não passam de "limpas" sem artefato real.** O dono vai pedir "mais vida"; com texto e número só vamos até aqui. Desenhar uma tela falsa seria inventar produto.
2. **Mudança de impacto alto e baixo risco:** tirar `Reveal` dos blocos de leitura (some a faixa branca, o pisca e o escalonamento). Vale ser o primeiro commit do B0.
3. Advisory continua com 7 seções do mesmo peso; o doc propõe fundir duas, mas isso é decisão de ordem/produto.
4. O `--accent #b6644d` dá ~4,3:1 sobre branco (cálculo meu): reprova AA em texto pequeno. Proposta `#a4533c`. Aprovação do PO muda o contraste do eyebrow e dos links em todo o site (a Home usa o mesmo token e não deve mudar: definir o novo token só no CSS institucional).
5. A direção foi feita com o trabalho **não commitado** de outra sessão como base (servidor da porta 3000); se esse trabalho mudar, as capturas "antes" mudam.

## 6. O que o dono do projeto precisa fazer

- Commitar o trabalho aberto em `institucional/`, `diagnostico/` e `blog/` (pendência D1 do checklist) antes de qualquer B.
- Pedir à Carol prints reais do Kognis (atendimento, financeiro, BI) e imagem/dado do Spectra, se existirem.
- Ver os protótipos no navegador (abrir `docs/po/design/proto/*.html`) e dizer se a direção "régua + objeto" é a que ele quer, antes do dev começar.

## 7. Perguntas de produto para o PO

1. Existem telas reais de Kognis/Spectra? Se não, aceita páginas "limpas" sem protagonista visual do produto?
2. Repetir o CTA "Agendar demonstração" no fim de `/kognis` (hoje só no hero)?
3. Manter `front-3-entrega.jpg` no hero de `/execucao` (marcada "confirmar" em `pages.ts`)?
4. Aprova só uma sombra (foto-herói) e dois raios (4/12), e o token de texto `#a4533c`?
5. Fundir "O que fazemos" e "Rituais" no Advisory, ou manter a ordem original?

## 8. Auto-nota (para o PO desmentir)

Não me dou nota. Pontos fortes: capturas reais vistas, protótipos renderizados e olhados, hipótese testada nos dois estados. Fracos: referências verificadas só em 6 de ~11, Soluções sem âncora, mobile e copy-diff incompletos.
