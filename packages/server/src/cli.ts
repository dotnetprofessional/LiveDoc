#!/usr/bin/env node
/**
 * LiveDoc Server CLI
 * Standalone server for receiving and viewing test results
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { startServer } from './index.js';

const packageJsonUrl = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version: string };

const program = new Command();

program
  .name('livedoc-server')
  .description('LiveDoc Server - Receive and view test results')
  .version(packageJson.version);

program
  .option('-p, --port <port>', 'Port to listen on', '3100')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('-d, --data-dir <dir>', 'Data directory for persistent storage')
  .option('--history-limit <limit>', 'Max runs to keep per project/environment', '50')
  .option('-o, --open', 'Open browser on start')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const historyLimit = parseInt(options.historyLimit, 10);
    
    console.log('🍵 Starting LiveDoc Server...');
    
    try {
      await startServer({
        port,
        host: options.host,
        dataDir: options.dataDir,
        historyLimit,
        open: options.open
      });
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  });

program.parse();
