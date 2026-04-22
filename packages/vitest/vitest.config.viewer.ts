import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log("Vitest config viewer loaded");

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: 'vitest', // Matches VS Code workspace name
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    reporters: [
      // Console output with BDD format + auto-discovers LiveDoc server for publishing
      ['./_src/app/reporter/LiveDocSpecReporter.ts', { 
        detailLevel: 'spec+summary+headers'
      }],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '_src/test/**'
      ]
    }
  }
});
