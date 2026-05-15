import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

export default defineConfig({
  define: {
    __LIVEDOC_VIEWER_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
    },
  },
  server: {
    port: 3200,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:3100',
        ws: true,
      },
    },
  },
});
