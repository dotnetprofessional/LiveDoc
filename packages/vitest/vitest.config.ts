import { defineConfig } from 'vitest/config';

// Default config for VS Code Vitest extension
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    // No custom reporter - use Vitest defaults for VS Code compatibility
    pool: 'forks',
    // Inline chai to fix ESM compatibility issues  
    deps: {
      interopDefault: true,
    }
  }
});
