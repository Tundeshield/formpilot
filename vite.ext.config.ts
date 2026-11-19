import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// The extension only needs the URL of the FormPilot web app/API. Supabase public
// config is fetched from {APP_URL}/api/config at runtime, so no secrets are baked in.
export default defineConfig({
  root: 'extension',
  base: './',
  plugins: [react()],
  envDir: '..',
  define: {
    __DEFAULT_APP_URL__: JSON.stringify(process.env.FORMPILOT_APP_URL || process.env.URL || 'http://localhost:8888'),
  },
  build: {
    outDir: '../dist/extension',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'extension/sidepanel.html'),
        background: resolve(__dirname, 'extension/src/background.ts'),
      },
      output: {
        entryFileNames: (c) => (c.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
});
