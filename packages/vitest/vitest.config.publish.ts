import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { livedoc } from './_src/app/livedoc';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publishServer = process.env.LIVEDOC_SERVER_URL
  || process.env.LIVEDOC_PUBLISH_SERVER
  || 'http://localhost:3100';
const publishProject = process.env.LIVEDOC_PROJECT
  || process.env.LIVEDOC_PUBLISH_PROJECT
  || 'livedoc';
const publishEnvironment = process.env.LIVEDOC_ENVIRONMENT
  || process.env.LIVEDOC_PUBLISH_ENV
  || 'local';

// Enable publishing for this config
livedoc.options.publish.enabled = true;
livedoc.options.publish.server = publishServer;
livedoc.options.publish.project = publishProject;
livedoc.options.publish.environment = publishEnvironment;

export default defineConfig({
  test: {
    name: 'livedoc-publish',
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    reporters: [
      ['./_src/app/reporter/LiveDocSpecReporter.ts', { 
        detailLevel: 'spec+summary+headers',
        publish: {
          enabled: true,
          server: publishServer,
          project: publishProject,
          environment: publishEnvironment
        }
      }]
    ]
  }
});
