import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), playtest: resolve(import.meta.dirname, 'playtest.html') },
    },
  },
});
