import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * CI configuration — exports a TestRunV1 JSON file for static report generation.
 * Used by the GitHub Actions livedoc-report workflow.
 */
export default defineConfig({
  resolve: {
    // Map self-imports to source so Playwright integration (which imports
    // onScenarioStart from '@swedevtools/livedoc-vitest') shares the same
    // module instance as the test files. Without this, the dist and source
    // copies have separate hook arrays and freshContextPerScenario breaks.
    alias: {
      '@swedevtools/livedoc-vitest': resolve(__dirname, '_src/app'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    exclude: [
      ...configDefaults.exclude,
    ],
    testTimeout: 30_000, // Dynamic tests spawn child vitest processes
    setupFiles: ['./_src/app/setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    allowOnly: true,  // LiveDoc tag filtering uses describe.only — must allow in CI
    deps: {
      interopDefault: true,
    },
    reporters: [
      'default',
      ['./_src/app/reporter/index.ts', {
        export: {
          output: '../../reports/vitest-report.json',
          project: 'livedoc-vitest',
        },
      }],
    ],
  }
});
