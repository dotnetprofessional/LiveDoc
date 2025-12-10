import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import LiveDocServerReporter from './_src/app/reporter/LiveDocServerReporter';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect if running under VS Code Vitest extension or in debug mode
// VITEST_VSCODE is set by the Vitest extension
// VSCODE_* env vars are set when running from VS Code
const isVSCodeVitest = !!(
  process.env.VITEST_VSCODE || 
  process.env.VSCODE_PID || 
  process.env.VSCODE_IPC_HOOK
);

// Log which config is being used
console.log('🟠 [VITEST CONFIG] Using vitest.config.ts - WITH custom reporter');

export default defineConfig({
  test: {
    name: 'vitest', // Matches VS Code workspace name
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    // Use default reporter when running under VS Code extension to avoid conflicts
    // The custom reporter can cause "no test suite found" errors in debug mode
    reporters: isVSCodeVitest 
      ? undefined  // Let Vitest use its default
      : [
          ['./_src/app/reporter/LiveDocSpecReporter.ts', { detailLevel: 'spec+summary+headers' }],
          new LiveDocServerReporter()
        ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '_src/test/**'
      ]
    }
  }
});
