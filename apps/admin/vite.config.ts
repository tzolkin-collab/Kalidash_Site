import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// A função de runtimeCaching abaixo é serializada para dentro do service worker, onde `self` existe.
declare const self: { location: { origin: string } };

export default defineConfig({
  plugins: [
    react(),
    // Instalável na tela inicial (Android/desktop) e abre em tela cheia (standalone), sem a
    // barra do navegador. Ícones gerados do logo vetorial (Home.pdf): icon-192/512 com cantos
    // arredondados ("any") e icon-maskable-512 sem cantos, para o recorte do Android.
    VitePWA({
      // 'prompt': a versão nova espera o aviso "Atualizar" (src/components/PwaPrompt.tsx). Com
      // autoUpdate o app recarregava sozinho e a pessoa perdia o que estava editando.
      registerType: 'prompt',
      // O registro é nosso (src/lib/pwa.ts, via virtual:pwa-register), para ligar o aviso.
      injectRegister: false,
      // O service worker de dev só sobe com PWA_DEV=1 (docs/pwa.md). Ligado sempre, ele falhava
      // ao registrar fora da porta 5173 (B-F6) e podia servir arquivos velhos durante o dev.
      devOptions: { enabled: process.env.PWA_DEV === '1', type: 'module' },
      manifest: {
        name: 'Kalidash CRM',
        short_name: 'Kalidash',
        description: 'CRM interno da Tzolkin: leads, oportunidades, pipelines e clientes.',
        id: '/',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#28183b',
        theme_color: '#28183b',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // O bundle do editor de e-mail (TipTap + MJML + easy-email) passa de 3 MB e o Workbox
        // recusa pré-cachear qualquer coisa acima de 2 MB. A tela já carrega sob demanda
        // (lazy) e é pouco usada — sem isto o build inteiro quebra por causa de um só chunk.
        globIgnores: ['**/Emails-*.js'],
        // Rota profunda sem rede abre o index.html (SPA), mas nunca para API/login: essas rotas
        // não são páginas do app.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        // SEGURANÇA: dado de CRM, sessão e tokens nunca ficam no cache. Tudo que é de outra origem
        // (a API em Go) e tudo em /api/* e /auth/* vai direto à rede, sem gravar nada. Só o
        // app shell e os assets estáticos (precache) existem no Cache Storage.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.origin !== self.location.origin || /^\/(api|auth)\//.test(url.pathname),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    // O CSS do tema do Arco (@arco-themes/react-easy-email-theme) tem um seletor inválido
    // (".arco-input-tag:not(...)-clear-icon") que o lightningcss recusa ao minificar.
    cssMinify: 'esbuild',
  },
});
