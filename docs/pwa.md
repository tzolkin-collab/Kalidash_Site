# PWA do admin

Configuração em `apps/admin/vite.config.ts` (vite-plugin-pwa, Workbox). Só existe no build de produção; em `npm run dev` o service worker fica desligado (use `PWA_DEV=1 npm run dev` para testá-lo; ele só funciona na porta em que foi registrado, B-F6).

## Instalar
Chrome/Edge (desktop e Android): menu > "Instalar Kalidash" (exige HTTPS em produção). iOS: Compartilhar > "Adicionar à Tela de Início". Abre em janela própria (`display: standalone`), escopo `/`.

## Atualizar
Versão nova não troca sozinha: aparece o aviso "Há uma versão nova do Kalidash" com o botão **Atualizar** (recarrega a página; salve o que estiver editando antes). A aba aberta procura versão nova a cada hora e a cada navegação.

## O que é cacheado
Só o app shell e os assets estáticos gerados no build (precache: HTML, JS, CSS, fontes, ícones, manifesto). Rotas profundas sem rede abrem o `index.html` (SPA). O chunk do editor de e-mail (`Emails-*`) não é pré-cacheado: a tela de e-mails não abre offline.

## O que nunca é cacheado
Qualquer resposta de outra origem (a API em Go) e de `/api/*` e `/auth/*`: regra `NetworkOnly`. Nenhum dado de CRM, sessão ou token entra no Cache Storage. No logout, `clearUserCaches()` apaga qualquer cache que não seja o precache.

## Offline
Sem rede o app mostra a última interface carregada e uma faixa "Sem conexão"; os dados do CRM não carregam. A faixa depende do `navigator.onLine`.
