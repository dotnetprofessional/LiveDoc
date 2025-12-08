import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    reporters: [
      ['./dist/app/reporter/LiveDocSpecReporter.js', { detailLevel: 'list' }]
    ]
  }
});
