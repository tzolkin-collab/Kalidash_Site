import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Instalável na tela inicial (Android/desktop) e abre em tela cheia (standalone), sem a
    // barra do navegador. Ícones gerados do logo vetorial (Home.pdf): icon-192/512 com cantos
    // arredondados ("any") e icon-maskable-512 sem cantos, para o recorte do Android.
    VitePWA({
      registerType: 'autoUpdate',
      // Sem isto o plugin não injeta a chamada que registra o service worker — nada quebra,
      // mas o app nunca vira instalável de verdade.
      injectRegister: 'auto',
      // Sem isto, o plugin só gera manifest/service worker no build — e não dava pra testar
      // "instalar" rodando `pnpm dev`, que é como este app roda até agora.
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Kalidash CRM',
        short_name: 'Kalidash',
        description: 'CRM interno da Tzolkin: leads, oportunidades, pipelines e clientes.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#635bff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // O bundle do editor de e-mail (TipTap + MJML + easy-email) passa de 3 MB e o Workbox
        // recusa pré-cachear qualquer coisa acima de 2 MB. A tela já carrega sob demanda
        // (lazy) e é pouco usada — sem isto o build inteiro quebra por causa de um só chunk.
        globIgnores: ['**/Emails-*.js'],
      },
    }),
  ],
  build: {
    // O CSS do tema do Arco (@arco-themes/react-easy-email-theme) tem um seletor inválido
    // (".arco-input-tag:not(...)-clear-icon") que o lightningcss recusa ao minificar.
    cssMinify: 'esbuild',
  },
});
