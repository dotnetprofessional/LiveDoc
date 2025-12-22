import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { livedoc } from './_src/app/livedoc';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Enable publishing for this config
livedoc.options.publish.enabled = true;
livedoc.options.publish.server = process.env.LIVEDOC_PUBLISH_SERVER || 'http://127.0.0.1:3200';
livedoc.options.publish.project = process.env.LIVEDOC_PUBLISH_PROJECT || 'LiveDoc';
livedoc.options.publish.environment = process.env.LIVEDOC_PUBLISH_ENV || 'local';

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
          server: process.env.LIVEDOC_PUBLISH_SERVER || 'http://127.0.0.1:3200',
          project: process.env.LIVEDOC_PUBLISH_PROJECT || 'LiveDoc',
          environment: process.env.LIVEDOC_PUBLISH_ENV || 'local'
        }
      }]
    ]
  }
});
