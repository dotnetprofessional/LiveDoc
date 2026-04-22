import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    // No explicit dynamic excludes: @dynamic tests auto-skip when LIVEDOC_DISABLE_DYNAMIC is set.
    setupFiles: ['./_src/app/setup.nodynamic.ts'],
    reporters: [
      ['./_src/app/reporter/LiveDocSpecReporter.ts', { detailLevel: 'spec+summary+headers' }]
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
