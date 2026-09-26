import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ['test/**/*.Spec.ts'],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
