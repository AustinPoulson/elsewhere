import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'elsewhere-release',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'release.json',
          source: JSON.stringify({
            version: 1,
            commit: process.env.GITHUB_SHA || null,
            builtAt: new Date().toISOString(),
          }),
        });
      },
    },
  ],
  base: process.env.PAGES_BASE_PATH || './',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'interface';
        },
      },
    },
  },
});
