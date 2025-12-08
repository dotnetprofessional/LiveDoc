import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.Spec.ts'],
    testTimeout: 10000,
    // Run test files sequentially to avoid port conflicts and shared state issues
    fileParallelism: false,
    // Also run tests within each file sequentially for BDD scenarios
    sequence: {
      concurrent: false,
    },
  },
});
