import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const viewerServer = process.env.LIVEDOC_SERVER_URL
  || process.env.LIVEDOC_PUBLISH_SERVER
  || process.env.LIVEDOC_VIEWER_SERVER
  || 'http://localhost:3100';
const viewerProject = process.env.LIVEDOC_PROJECT
  || process.env.LIVEDOC_PUBLISH_PROJECT
  || process.env.LIVEDOC_VIEWER_PROJECT
  || 'livedoc';
const viewerEnvironment = process.env.LIVEDOC_ENVIRONMENT
  || process.env.LIVEDOC_PUBLISH_ENV
  || process.env.LIVEDOC_VIEWER_ENV
  || 'local';

export default defineConfig({
  test: {
    name: 'vitest', // Matches VS Code workspace name
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    reporters: [
      // Console output with BDD format + auto-discovers LiveDoc server for publishing
      ['./_src/app/reporter/LiveDocSpecReporter.ts', { 
        detailLevel: 'spec+summary+headers',
        publish: {
          enabled: true,
          server: viewerServer,
          project: viewerProject,
          environment: viewerEnvironment,
        },
      }],
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
