import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // O CSS do tema do Arco (@arco-themes/react-easy-email-theme) tem um seletor inválido
    // (".arco-input-tag:not(...)-clear-icon") que o lightningcss recusa ao minificar.
    cssMinify: 'esbuild',
  },
});
