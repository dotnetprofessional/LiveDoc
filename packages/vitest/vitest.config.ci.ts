import { defineConfig } from 'vitest/config';

/**
 * CI configuration — exports a TestRunV1 JSON file for static report generation.
 * Used by the GitHub Actions livedoc-report workflow.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    exclude: ['_src/test/Playwright/**'],  // Playwright tests need a running viewer + browsers — run locally or in dedicated e2e job
    setupFiles: ['./_src/app/setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    allowOnly: true,  // LiveDoc tag filtering uses describe.only — must allow in CI
    deps: {
      interopDefault: true,
    },
    reporters: [
      'default',
      ['@swedevtools/livedoc-vitest/reporter', {
        export: {
          output: '../../reports/vitest-report.json',
          project: 'livedoc-vitest',
        },
      }],
    ],
  }
});
