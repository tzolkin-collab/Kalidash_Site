# Relatório — admin-pwa

## (a) Itens (provados em Chrome real contra `npm run build` + `vite preview`, porta 4173, HTTP em localhost)
| Item | Estado | Evidência |
|---|---|---|
| Manifesto | ✅ | `fetch('/manifest.webmanifest')`: `id:"/"`, `lang:"pt-BR"`, `display:"standalone"`, scope/start_url `/`, 4 ícones (any 192/512, maskable 192/512). Antes: `lang:"en"`, sem `id`. |
| Ícones, apple-touch-icon, metas | ✅ | maskable com área segura (logo a 80%); `apple-touch-icon.png` 180; `<html lang="pt-BR">`, theme-color `#28183b`. Não vi o ícone instalado (precisa de instalação real). |
| SW registrado no build | ✅ | `getRegistration()`: scope `http://localhost:4173/`, `active: activated`; `controller` ativo após o 2º load. |
| Precache do app shell | ✅ | `caches.keys()` = só `workbox-precache-v2-http://localhost:4173/`, 24 entradas (index.html, assets, ícones, manifesto). |
| Segurança: API/auth fora do cache | ✅ | Com a página controlada pelo SW: `fetch('/api/leads')`, `fetch('/auth/me')` e `fetch('http://localhost:8080/auth/me')` (cross-origin; recusado, sem API local) → depois, 24 entradas, nenhuma com `/api`, `/auth` ou `8080`. `sw.js` gerado tem `NetworkOnly` para outra origem e `/api|auth` e `denylist` na navegação. |
| Logout limpa cache | ✅ | `lib/cacheClean.ts` + `tests/cacheClean.test.ts` (apaga tudo menos precache; não quebra sem Cache Storage). O clique de logout em si não foi exercitado (sem login real). |
| Rota profunda offline | ✅ | Derrubei o servidor de preview e recarreguei `/pipelines` (rota inexistente): o SW serviu o app shell completo (menu e a tela "Página não encontrada" do próprio app). |
| Aviso de nova versão | ✅ | Rebuild com `<title>` alterado + servidor novo: `reg.update()` → `waiting:true` e `role=alert` "Há uma versão nova do Kalidash…" com botão "Atualizar". Clique: recarregou, título novo, `waiting:false`, sem aviso, 24 entradas. (A mudança de título foi só para o teste e foi revertida.) |
| Faixa "Sem conexão" | ⚠️ | Só no código: depende de `navigator.onLine`, que não mudou com o servidor derrubado. Não testado com o DevTools offline. |
| SW de dev em porta alternativa (B-F6) | ✅ (código) | `devOptions.enabled` só com `PWA_DEV=1`; não rodei o dev server. |
| Instalabilidade / janela standalone | ⚠️ | Manifesto e SW atendem os critérios; instalar de fato e a janela standalone não foram testados. Produção precisa ser HTTPS. |
| Painel de navegador embutido | — | Não registra service workers (erro "unknown error fetching the script" mesmo com `sw.js` 200); por isso a prova foi no Chrome real. |

Testes: `tsc -b` ok, `npm test` 67/67, `npm run build` exit 0.

## (b) Arquivos
`apps/admin/vite.config.ts`, `index.html`, `tsconfig.app.json`, `package.json` (+`workbox-window@7.4.1`), `pnpm-lock.yaml` (3 linhas), `public/` (3 PNGs), `src/main.tsx`, `src/lib/pwa.ts`, `src/lib/cacheClean.ts`, `src/lib/auth.ts` (1 linha no logout), `src/components/PwaPrompt.tsx`, `tests/cacheClean.test.ts`, `docs/pwa.md`.

## (c) Commits
`9dd3a13` (ícones, index.html), `c910e32` (SW, aviso, cache, deps), este relatório + docs + teste.

## (d) Ficou de fora
- Tela de e-mails offline (chunk > 2 MB fora do precache).
- Push notifications (planejado nos docs, não faz parte deste pacote).
- Página offline dedicada: o app shell serve de fallback.

## (e) Riscos
- Offline com sessão: `initAuth` cai em `status:'off'` (trata "API fora do ar" como "sem login") e o app abre sem a tela de login, só com o shell. Está em `auth.ts`/`App.tsx`; decisão do PO.
- `theme_color`/`background_color` passaram de `#635bff`/`#ffffff` para `#28183b` (cor da marca): confirmar.
- Quem tem o app aberto só vê a versão nova ao clicar em "Atualizar" (ou fechar todas as abas).

## (f) Gustavo, num Chrome real, em HTTPS
1. Instalar pelo menu e abrir a janela standalone; ver o ícone (maskable no Android).
2. DevTools > Application > Cache Storage: só `workbox-precache`; Service Workers > Offline e abrir uma rota profunda.
3. Logar, navegar, sair e confirmar que o Cache Storage continua só com o precache.
4. Publicar uma versão nova e ver o aviso "Atualizar".
