#!/usr/bin/env node
import { program } from 'commander';
import { startServer } from './server/index';

program
  .name('livedoc-viewer')
  .description('LiveDoc BDD Test Results Viewer')
  .version('1.0.0')
  .option('-p, --port <port>', 'Port to run server on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('-o, --open', 'Open browser automatically', false)
  .action(async (options) => {
    await startServer({
      port: parseInt(options.port, 10),
      host: options.host,
      open: options.open
    });
  });

program.parse();
