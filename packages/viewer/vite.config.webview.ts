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
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
    },
  },
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'index.css';
          }
          return '[name][extname]';
        },
      },
    },
  },
});
