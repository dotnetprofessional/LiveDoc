import { defineConfig } from 'vitest/config';

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
      ['_src/app/reporter/LiveDocSpecReporter.ts', { 
        detailLevel: 'summary',
        output: 'results.txt',
        postReporters: [{
          execute: async (results: any, options: any) => {
            const { LiveDocViewerReporter } = await import('./_src/app/reporter/LiveDocViewerReporter.ts');
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
