import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { mjmlPlugin } from './src/mjml-plugin.ts';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    mjmlPlugin()
  ],
  resolve: {
    alias: {
      'mjml-browser': path.resolve(__dirname, './src/mjml-mock.js')
    }
  }
});
