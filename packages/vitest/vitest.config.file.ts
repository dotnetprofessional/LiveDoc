import { defineConfig } from 'vitest/config';

const viewerServer = process.env.LIVEDOC_VIEWER_SERVER || 'http://localhost:3000';
const viewerProject = process.env.LIVEDOC_VIEWER_PROJECT || 'livedoc-vitest';
const viewerEnvironment = process.env.LIVEDOC_VIEWER_ENV || 'local';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./dist/app/setup.js'],
    reporters: [
      ['./dist/app/reporter/LiveDocSpecReporter.js', { 
        detailLevel: 'summary',
        output: 'results.txt',
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
    ]
  }
});
