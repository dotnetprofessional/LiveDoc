import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    exclude: [
      // Exclude tests that depend on executeDynamicTestAsync
      '_src/test/DynamicExecution.Spec.ts',
      '_src/test/Rule Violations/**',
      '_src/test/Reporter/**',
      '_src/test/Filtering/**',
      '_src/test/Vitest_Features/**',
      '_src/test/Background_Keyword/Background_reports_errors.Spec.ts',
      '_src/test/Background_Keyword/Background_support_only.Spec.ts',
    ],
    setupFiles: ['./dist/app/setup.js'],
    reporters: [
      ['./dist/app/reporter/LiveDocSpecReporter.js', { detailLevel: 'spec+summary+headers' }]
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
