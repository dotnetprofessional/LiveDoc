import { defineConfig } from 'vitest/config';

// JsonReporter will be passed as an option to the reporter
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['_src/test/**/*.Spec.ts'],
    setupFiles: ['./_src/app/setup.ts'],
    reporters: [
      ['./dist/app/reporter/LiveDocSpecReporter.js', { 
        detailLevel: 'summary',
        'json-output': 'results.json',
        postReporters: [{ 
          execute: async (results: any, options: any) => {
            const { JsonReporter } = await import('./dist/app/reporter/JsonReporter.js');
            const reporter = new JsonReporter();
            await reporter.execute(results, options);
          }
        }]
      }]
    ]
  }
});
