# Relatório — admin-pwa (PARCIAL: limite de uso atingido)

## (a) Itens
| Item | Estado | Evidência |
|---|---|---|
| Manifesto (name, short_name, start_url, scope, standalone, theme/background, id, lang) | ✅ | `dist/manifest.webmanifest` do build: lang era `en` e não havia `id`; agora `pt-BR` e `id: "/"`. Não conferido no navegador. |
| Ícones 192/512 + maskable | ✅ | maskable 512 refeito com área segura (logo a 80%), maskable 192 criado; PNGs gerados da marca existente. |
| apple-touch-icon + metas mobile | ✅ | `apple-touch-icon.png` 180px; `theme-color`, `lang=pt-BR`, metas mobile no `index.html`. |
| Precache do app shell | ✅ | build: 24 entradas (3,7 MiB); chunk `Emails-*` fica de fora (editor de e-mail não funciona offline). |
| Fallback SPA offline | ⚠️ | `NavigationRoute` para `index.html` presente no `sw.js` gerado; **não testado offline no navegador**. |
| Segurança do cache (API/auth NetworkOnly) | ✅ no código / ⚠️ sem teste no navegador | `sw.js` gerado contém `registerRoute(({url})=>url.origin!==self.location.origin||/^\/(api\|auth)\//..., NetworkOnly)` e `denylist:[/^\/api\//,/^\/auth\//]`. Não há outro runtimeCaching: só o precache existe. |
| Logout limpa cache | ✅ (código) | `lib/cacheClean.ts` apaga todo cache que não seja `precache`; chamado em `logout()`. Não testado no navegador. |
| Atualização | ✅ (código) | `registerType: 'prompt'`; aviso "Atualizar" em `PwaPrompt.tsx`; checagem a cada 1 h. Antes era autoUpdate silencioso (risco de perder edição). Não visto no navegador. |
| Aviso de offline | ✅ (código) | faixa "Sem conexão" em `PwaPrompt.tsx`. |
| SW de dev em porta alternativa (B-F6) | ✅ (código) | `devOptions.enabled` só com `PWA_DEV=1`. |
| Instalabilidade Chrome / janela standalone | ❌ não verificado | exige HTTPS em produção + Chrome real. |

Testes: `tsc -b` ok, `npm test` 65/65, `npm run build` exit 0.

## (b) Arquivos
`apps/admin/vite.config.ts`, `index.html`, `tsconfig.app.json`, `package.json` (+`workbox-window@7.4.1`), `pnpm-lock.yaml` (3 linhas), `public/` (3 PNGs), `src/main.tsx`, `src/lib/pwa.ts`, `src/lib/cacheClean.ts`, `src/lib/auth.ts` (1 linha no logout), `src/components/PwaPrompt.tsx`.

## (c) Commits
`9dd3a13` (ícones, index.html), `c910e32` (SW, aviso, cache, deps).

## (d) Ficou de fora
- Prova no navegador (preview, `getRegistration`, `caches.keys()`, offline, aviso de atualização).
- `docs/pwa.md` (como instalar/atualizar, o que é cacheado) e atualização de `docs/pagesAdmin/settings.md`.
- Teste de unidade do `cacheClean`.

## (e) Riscos
- Offline com a API logada: `initAuth` cai em `status: 'off'` (trata "API fora do ar" como "sem login") e o app abre sem a tela de login, só com a faixa de offline. Isso está em `auth.ts`/`App.tsx`; precisa de decisão do PO.
- `theme_color` mudou de `#635bff` para `#28183b` (cor da marca): confirmar com o PO.

## (f) Gustavo
Em Chrome real, com o build em HTTPS: instalar pelo menu, abrir standalone, DevTools > Application > Cache Storage (só precache), offline numa rota profunda, e publicar uma versão nova para ver o aviso.
