import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./dist/app/setup.js'],
    reporters: [
      ['./dist/app/reporter/LiveDocSpecReporter.js', { detailLevel: 'summary' }]
    ]
  }
});
