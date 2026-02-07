#!/usr/bin/env node
import { program } from 'commander';
import { startServer } from './server/index.js';

program
  .name('livedoc-viewer')
  .description('LiveDoc BDD Test Results Viewer - Real-time test visualization')
  .version('1.0.0')
  .option('-p, --port <port>', 'Port to run server on', '3100')
  .option('-H, --host <host>', 'Host to bind to', 'localhost')
  .option('--no-open', 'Do not open browser automatically')
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

program.parse();
