# B5 · Diagnóstico — relatório do dev

Direção: [02-diagnostico.md](../design/02-diagnostico.md) (protótipo 07). Só toquei `apps/site/src/app/diagnostico/**`.
Capturas e ferramentas em [b5-diagnostico/](b5-diagnostico/) (`antes-*` e `depois-*`, 9 estados × 1440/1024/768/390).

## 1. Checklist

| Item | | Evidência |
|---|---|---|
| Copy idêntica em todos os estados | ✅ (com 1 nota) | Regenerei o texto renderizado dos 8 estados (p1, p1-erro, p2, p2-erro, p3, p3-erro, envio-erro, sucesso) com o mesmo método de `d2-d3-ferramentas/texto-estados.mjs` e comparei com `proto/copy-source/diagnostico-estados.txt`. Única diferença: somem as 10 linhas `+` / `✓` (glifos decorativos `aria-hidden` das pílulas; viraram caixa de seleção desenhada em CSS, direção §4.2). Nenhuma palavra mudou. |
| Mesmos campos, ordem, rótulos, placeholders, validação, mensagens | ✅ | `validateStep`, `handleSubmit`, `getAttribution`, honeypot e `dataLayer` não foram editados (diff do TSX só tem marcação). Mensagens de erro vistas na tela: as 3 do passo 1 aparecem iguais. |
| Payload e `dataLayer` | ✅ | Servidor falso (`ferramentas/lead-fake.mjs`, :8199, fora de produção) gravou `{"name","email","phone","challenge":"Empresa: …\n\nCargo: …\n\nColaboradores na operação: 80\n\nObjetivos:\n- …","source":"site-pagina-diagnostico","website":"","attribution":{…}}`; `dataLayer` recebeu `lead_form_submitted` / `form_name: diagnostico` / `lead_source` / `goals` / `team_size`. |
| 3 passos, erros, envio ok, envio com erro | ✅ | Fluxo completo por teclado ([teste-teclado.txt](b5-diagnostico/teste-teclado.txt)) e capturas `depois-1…9`. Erro de envio: nome com "Falha" → servidor falso responde 500 → caixa `role="alert"`. Estado `unconfigured` (sem endpoint) **não testado no navegador**. |
| 1440 / 1024 / 768 / 390 | ✅ | 36 capturas `depois-*`, vistas: passo 1 e erros 1440, passo 3 erro 1440, passo 3 selecionado 1024, sucesso 390, erro de envio 390. Os demais 768/1024/390 foram gerados mas **não abertos um a um**. Sem rolagem horizontal nos 4 tamanhos (`scrollWidth == clientWidth`). |
| Teclado | ✅ | Tab percorre logo, WhatsApp, "Voltar ao site", campos; Enter em Continuar/Voltar/Solicitar; Espaço marca/desmarca objetivo (`aria-pressed`); foco = anel de 2px `--ink` em todos. Erros com `aria-invalid="true"` e `aria-describedby`. |
| Alvos ≥ 44 px | ✅ | Todos os `a/button/input/textarea` visíveis ≥ 44 px de altura nos 4 tamanhos (a marca do cabeçalho mobile estava com 28 px; corrigida para 44). |
| Contraste | ✅ campos/erros / ⚠️ botão | Borda de campo `#8a8490` (3,6:1), erro `#b42318` (6,5:1), placeholder `#6b6670` (5,6:1), texto de marca `#a4533c` (5,4:1). **Botão primário:** branco sobre `#b6644d` = 4,27:1, reprova AA em 16 px/600 (achado §8 da direção; ver §7). |
| `prefers-reduced-motion` | ✅ | Com a mídia emulada, `animation-name` do passo = `none`; transições de cor também desligam. |
| Só opacity/transform | ✅ | Única animação: entrada do passo e do sucesso (opacity + translateY 8 px). Hovers só mudam cor. |
| Sem cartão em cartão, raio 4/12, sombra só em foto-herói | ✅ | Raio 4 em campos/botões/caixa de erro; a página não tem foto, logo nenhuma sombra. Sai o painel escuro, a barra lateral da citação, as pílulas, o verde e o rosa. |
| Web Vitals | ✅ | Lighthouse 12, mediana de 7, `next build` + `next start` :3199 (método de `docs/web-vitals.md`). Desktop: Perf 100, LCP 580 ms, TBT 0, CLS 0 (baseline 100 / 584 / 0 / 0). Móvel: Perf 92, LCP 3184 ms, TBT 119 ms, CLS 0 (baseline 93 / 3179 / 75 / 0); JS 181 KB e fontes 110 KB iguais. A diferença de TBT (+44 ms) está dentro do ruído do script (execuções de 3 a 7 variam 75–133 ms no mesmo código); 🟡 não repeti na baseline com o mesmo servidor. |
| CLS ao trocar de passo | ✅ | `PerformanceObserver` com cliques reais do mouse (Input.dispatchMouseEvent), passos 1→3, erros e sucesso: **0,0000** em 1440/1024/768/390. (Com `.click()` sintético o número sobe a 0,4 em 390 porque o contexto abaixo do formulário se desloca; o navegador não conta isso quando é input real, mas vale saber.) |
| `lint`, `tsc --noEmit`, `build` | ✅ | `pnpm --filter @kalidash/site lint`: 0 erros, 2 avisos antigos de `<img>` em `home/ExperienceSyncGallery.tsx` (não meus). `npx tsc --noEmit`: sem saída. `pnpm build`: ok, `/diagnostico` estático. |
| Home sem diff | ⚠️ | Não toquei a Home. Mas o disco tem ` M apps/site/src/app/home/HomeHero.module.css` (1 linha) que **não é meu**: veio de outra sessão (provavelmente B0). Não stageei. |

## 2. O que mudou

- `diagnostico.module.css`: reescrito. Tokens do sistema (+ `--c-error`, `--c-field-line`) escopados em `.splitLayout`; grade 5/7 `warm | paper` com filete; abaixo de 1024 uma coluna com formulário primeiro e contexto depois (`order`); régua de 3 segmentos; campos 56 px; lista ruled de objetivos; sucesso em tipo; resets de `h1/h2/p` com `:where` para não vencer as classes.
- `DiagnosticoClient.tsx` (só marcação): logo `tone="dark"` no painel claro; `progressBarFill` → 3 `<i>` (mantém `role="progressbar"` e `aria-value*`); `pillGroup/pillItem` → `goalsList/goalItem` (continuam `<button aria-pressed>` dentro de `role="group" aria-label="Objetivos"`, caixa de seleção `aria-hidden`); removido `successIconBadge`; WhatsApp do sucesso vira link de texto; aviso `unconfigured` vira nota neutra; primeiro passo alinha "Continuar" à direita.

## 3. Commits

Ver `git log` da branch (mensagens `feat(site): diagnostico …`).

## 4. Ficou de fora

- Foco no primeiro campo inválido após erro (sugestão §7.4 da direção): é mudança de lógica; não fiz.
- Estado `unconfigured`: só estilizado, não exercitado.
- Leitor de tela: não testado.
- Botão primário com contraste 4,27:1 (ver §7).

## 5. Riscos

- **Ordem de foco no celular.** O DOM mantém o contexto (h1, WhatsApp) antes do formulário; visualmente ele fica depois. Quem navega por Tab no celular com teclado passa pelos links do contexto antes do formulário. Segui a direção (§5: `h1` primeiro para leitor de tela). Alternativa: aside depois do `main` no DOM e `order` no desktop (mesmo problema invertido).
- **Enter nos passos 1 e 2 não avança** (já era assim): o "Continuar" é `type="button"` e o formulário não tem botão de submit nesses passos, então o envio implícito não dispara. Não alterei (lógica). Candidato a pacote próprio.
- Usei o `next dev` em :3300 (e `next build`/`start` em :3199) com `NEXT_PUBLIC_LEAD_ENDPOINT` apontando para o servidor falso, em vez de `preview_start kalidash-site`, porque o `launch.json` não passa variáveis de ambiente e eu não podia mexer em `.env`. Nada de produção.

## 6. O que o dono precisa fazer

Nada técnico. Conferir no celular real (390) o contexto abaixo do formulário (Q3).

## 7. Perguntas ao PO

1. **Q1–Q4 da direção** (painel `warm` em vez de escuro; "Etapa" e "Passo" duplicados; contexto visível no celular; lista de objetivos em vez de pílulas): implementei as respostas padrão da direção (aprovada com 9,0): `warm`, os dois textos mantidos, contexto no celular **abaixo do formulário**, lista com caixas. Se Q3 for "esconder", é trocar `display:none` e dar um `h1` só para leitor de tela.
2. **Contraste do botão** `#fff` sobre `#b6644d` (4,27:1). Aplico 18,66 px/700 ou `--accent` mais escuro só nos botões desta página? Hoje ficou como a direção, 16 px/600.
3. Aceita abrir pacote para "Enter avança nos passos 1 e 2" e foco no primeiro erro?
