import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration via environment variables:
// LIVEDOC_VIEWER_SERVER - Server URL (default: http://localhost:3000)
// LIVEDOC_VIEWER_PROJECT - Project name (default: livedoc-vitest)  
// LIVEDOC_VIEWER_ENV - Environment name (default: local)

const viewerServer = process.env.LIVEDOC_VIEWER_SERVER || 'http://localhost:3000';
const viewerProject = process.env.LIVEDOC_VIEWER_PROJECT || 'livedoc-vitest';
const viewerEnvironment = process.env.LIVEDOC_VIEWER_ENV || 'local';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    reporters: [
      // Console output with BDD format
      ['./dist/app/reporter/LiveDocSpecReporter.js', { 
        detailLevel: 'spec+summary+headers',
        // Configure viewer reporter as post-reporter
        postReporters: [{
          execute: async (results: any, options: any) => {
            const { LiveDocViewerReporter } = await import('./dist/app/reporter/LiveDocViewerReporter.js');
            const reporter = new LiveDocViewerReporter({
              server: viewerServer,
              project: viewerProject,
              environment: viewerEnvironment
            });
            await reporter.execute(results, options);
          }
        }]
      }]
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
