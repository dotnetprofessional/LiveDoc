import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Detect if running under the VS Code Vitest extension.
// NOTE: VS Code debugging also sets VSCODE_* env vars, but we still want LiveDoc
// reporters when using our launch.json debug configs. The extension sets VITEST_VSCODE.
const isVSCodeVitest = !!process.env.VITEST_VSCODE;

// Log which config is being used
console.log('🟠 [VITEST CONFIG] Using livedoc.vitest.ts - WITH custom reporter');

export default defineConfig({
  test: {
    name: 'vitest', // Matches VS Code workspace name
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    exclude: [
      ...configDefaults.exclude,
      // Playwright browser tests require a running web server (port 3100)
      // Run with: npx vitest run _src/test/Playwright/playwright-integration.Spec.ts
      '_src/test/Playwright/playwright-integration.Spec.ts',
      '_src/test/Playwright/fresh-context-per-scenario.Spec.ts',
    ],
    testTimeout: 30_000, // Dynamic tests spawn child vitest processes which need extra time
    setupFiles: ['./_src/app/setup.ts'],
    // Use default reporter when running under VS Code extension to avoid conflicts
    // The custom reporter can cause "no test suite found" errors in debug mode
    reporters: isVSCodeVitest 
      ? undefined  // Let Vitest use its default
      : [
          ['./_src/app/reporter/LiveDocSpecReporter.ts', { detailLevel: 'spec+summary+headers' }],
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
