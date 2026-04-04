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
    // .only filter tests use executeDynamicTestAsync which relies on
    // vitest's .only() propagation — doesn't work in CI environment
    exclude: ['_src/test/**/background-with-only-filter.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
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
