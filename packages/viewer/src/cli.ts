#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'node:fs';
import { startServer } from './server/index.js';
import { runExport } from './export.js';

const packageJsonUrl = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version: string };

program
  .name('livedoc-viewer')
  .description('LiveDoc BDD Test Results Viewer - Real-time test visualization')
  .version(packageJson.version)
  .option('-p, --port <port>', 'Port to run server on', '3100')
  .option('-H, --host <host>', 'Host to bind to', 'localhost')
  .option('--no-open', 'Do not open browser automatically')
  .addHelpText('after', `
Examples:
  $ livedoc-viewer                              Start viewer on localhost:3100
  $ livedoc-viewer -p 8080 --no-open            Custom port, no browser
  $ livedoc-viewer export -i results.json       Export static HTML report
  $ livedoc-viewer export --help                Show export options`)
  .action(async (options) => {
    try {
      await startServer({
        port: parseInt(options.port, 10),
        host: options.host,
        open: options.open
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('EADDRINUSE')) {
        console.error(`\n❌ Port ${options.port} is already in use.`);
        console.error(`   Try a different port: livedoc-viewer --port 3200\n`);
        process.exit(1);
      }
      throw error;
    }
  });

program
  .command('export')
  .description('Export as self-contained static HTML  (-i <input> [-o <path>] [-t <title>])')
  .requiredOption('-i, --input <path>', 'Path to a TestRunV3 JSON file (e.g. lastrun.json)')
  .option('-o, --output <path>', 'Output HTML file path', './livedoc-report.html')
  .option('-t, --title <title>', 'Custom report title (defaults to project name from JSON)')
  .action((options: { input: string; output: string; title?: string }) => {
    runExport({
      input: options.input,
      output: options.output,
      title: options.title,
    });
  });

program.parse();
