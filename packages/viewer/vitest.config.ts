import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.Spec.ts'],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
