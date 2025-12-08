import { defineConfig } from 'vitest/config';

// Simplified config for VS Code Vitest extension
// This avoids the custom reporter which can cause issues with debugging
console.log('🔵 [VITEST CONFIG] Using vitest.config.vscode.ts - NO custom reporter');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    // No custom reporter - use Vitest defaults for VS Code compatibility
    fileParallelism: false,
    // Use forks pool for debugging (vmForks has ESM issues)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Inline chai to fix ESM compatibility issues  
    deps: {
      interopDefault: true,
    }
  }
});
