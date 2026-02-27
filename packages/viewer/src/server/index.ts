/**
 * LiveDoc Viewer Server
 * 
 * This wraps @swedevtools/livedoc-server and adds static file serving for the React app.
 */

import { createServer, type LiveDocServer } from '@swedevtools/livedoc-server';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Static file directory (built React app)
function getStaticDir(): string {
  return path.resolve(__dirname, '../client');
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32'
      ? { cmd: process.env.ComSpec ?? 'cmd.exe', args: ['/c', 'start', '', url] }
      : process.platform === 'darwin'
        ? { cmd: 'open', args: [url] }
        : { cmd: 'xdg-open', args: [url] };

  const child = spawn(command.cmd, command.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', (error) => {
    console.warn(`Unable to open browser automatically: ${error.message}`);
  });
  child.unref();
}

export interface ViewerServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  historyLimit?: number;
  open?: boolean;
}

/**
 * Start the LiveDoc Viewer server with static file serving
 */
export async function startViewerServer(options: ViewerServerOptions = {}) {
  const port = options.port || 3100;
  const host = options.host || '0.0.0.0';
  const staticDir = getStaticDir();
  
  // Create base server from @swedevtools/livedoc-server
  const server = createServer({
    port,
    host,
    dataDir: options.dataDir,
    historyLimit: options.historyLimit
  });
  
  const app = server.getApp();
  const store = server.getRunStore();
  const dataDir =
    (store as any).getDataDir?.() ??
    (store as any).dataDir ??
    options.dataDir ??
    path.join(process.cwd(), '.livedoc', 'data');
  
  // =========================================================================
  // Static Files (SPA) - Add these routes to the existing Hono app
  // =========================================================================
  
  // Serve static assets from the built React app
  app.get('/assets/*', async (c) => {
    const filePath = c.req.path;
    const fullPath = path.join(staticDir, filePath);
    
    try {
      const content = await fs.readFile(fullPath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      return new Response(content, {
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' }
      });
    } catch {
      return c.notFound();
    }
  });
  
  // SPA fallback - serve index.html for all other routes
  app.get('*', async (c) => {
    // Skip API routes
    if (c.req.path.startsWith('/api')) {
      return c.notFound();
    }
    
    try {
      const indexPath = path.join(staticDir, 'index.html');
      const html = await fs.readFile(indexPath, 'utf-8');
      return c.html(html);
    } catch {
      return c.text('LiveDoc Viewer', 200);
    }
  });
  
  // =========================================================================
  // Start Server
  // =========================================================================
  
  const actualPort = await server.listen(port);
  
  console.log(`
🍵 LiveDoc Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Server:    http://${host}:${actualPort}
  WebSocket: ws://${host}:${actualPort}/ws
  API:       http://${host}:${actualPort}/api
  Data:      ${dataDir}

  Endpoints:
    GET    /api/health                Health check
    GET    /api/projects              List all projects
    GET    /api/hierarchy             Get project/env tree
    GET    /api/runs/:runId           Get run details
    DELETE /api/runs/:runId           Delete a run
    POST   /api/runs/start            Start a new run
    POST   /api/runs/:runId/features  Add a feature
    POST   /api/runs/:runId/scenarios Add a scenario
    POST   /api/runs/:runId/steps     Add a step
    POST   /api/runs/:runId/complete  Complete a run
    POST   /api/runs                  Post complete run (batch)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  
  if (options.open) {
    openBrowser(`http://${host}:${actualPort}`);
  }
  
  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await server.stop();
    console.log('Data saved. Goodbye! 👋');
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  return server;
}

// Re-export for backward compatibility
export { startViewerServer as startServer };

// Run if executed directly
const isMainModule = process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js');
if (isMainModule) {
  const port = parseInt(process.env.PORT || '3100', 10);
  startViewerServer({ port, open: false });
}
