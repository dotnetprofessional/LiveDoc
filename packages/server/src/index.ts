import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createServer as createHttpServer, IncomingMessage, ServerResponse, Server as HttpServer } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { WebSocketManager } from './websocket.js';
import { RunStore, runStore } from './store.js';
import type {
  StartRunRequest,
  StartRunResponse,
  TestRun,
  Feature,
  Scenario,
  Step,
  WebSocketEvent,
  ServerConfig
} from './schema.js';

// Re-export all schema types
export * from './schema.js';

// Re-export store
export { RunStore, runStore } from './store.js';

// Re-export WebSocketManager
export { WebSocketManager } from './websocket.js';

function getPortFilePath(): string {
  const tempDir = os.tmpdir();
  return path.join(tempDir, 'livedoc-server.json');
}

// Generate unique IDs
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  historyLimit?: number;
  open?: boolean;
  logger?: (message: string) => void;
}

export interface LiveDocServer {
  /** Start listening on the configured port */
  listen(port?: number): Promise<number>;
  /** Stop the server */
  stop(): Promise<void>;
  /** Get the port the server is listening on */
  getPort(): number;
  /** Get the underlying Hono app */
  getApp(): Hono;
  /** Get the WebSocket manager */
  getWebSocketManager(): WebSocketManager;
  /** Get the run store */
  getRunStore(): RunStore;
  /** Check if server is running */
  isRunning(): boolean;
  /** Subscribe to server events */
  on(event: string, listener: (...args: any[]) => void): void;
}

/**
 * Discover a running LiveDoc server.
 * Checks the port file and verifies the server is responsive.
 */
export async function discoverServer(): Promise<{ url: string; port: number } | null> {
  const portFile = getPortFilePath();
  if (!fs.existsSync(portFile)) return null;
  
  try {
    const info = JSON.parse(fs.readFileSync(portFile, 'utf-8'));
    const port = Number(info?.port);
    const pid = Number(info?.pid);

    // If PID is provided and not alive, clean up stale file immediately.
    if (Number.isFinite(pid) && pid > 0) {
      try {
        // Signal 0 checks liveness without killing.
        process.kill(pid, 0);
      } catch {
        try {
          fs.unlinkSync(portFile);
        } catch {}
        return null;
      }
    }

    if (!Number.isFinite(port) || port <= 0) {
      return null;
    }
    
    // Verify server is actually running
    const response = await fetch(`http://localhost:${port}/api/health`);
    if (response.ok) {
      return {
        url: `http://localhost:${port}`,
        port
      };
    }

    // Not a LiveDoc server (or wrong port). If PID isn't alive, we already cleaned.
    // If PID wasn't provided, don't delete automatically (might be managed externally).
  } catch {
    // Server not responding or file invalid
    try {
      // Optional: clean up stale file if we're sure it's stale
      // fs.unlinkSync(portFile);
    } catch {}
  }
  
  return null;
}

/**
 * Create a LiveDoc server instance without starting it.
 * Use this when you want to control the server lifecycle (e.g., in VS Code extension).
 */
export function createServer(options: ServerOptions = {}): LiveDocServer {
  // Use port 0 for ephemeral port assignment, otherwise default to 3100
  const port = options.port !== undefined ? options.port : 3100;
  const host = options.host || '0.0.0.0';
  
  // Use the singleton store or create a new one with custom options
  const store = options.dataDir || options.historyLimit
    ? new RunStore(options.historyLimit || 50, options.dataDir)
    : runStore;
  
  // Create HTTP server first
  const httpServer = createHttpServer();
  
  // Initialize WebSocket manager
  let wsManager: WebSocketManager | null = null;
  
  // Create Hono app
  const app = new Hono();
  
  // Logging middleware
  if (options.logger) {
    app.use('*', async (c, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      options.logger?.(`[${c.req.method}] ${c.req.path} - ${c.res.status} (${ms}ms)`);
    });
  }

  // Enable CORS
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-LiveDoc-Token']
  }));
  
  // =========================================================================
  // API Routes
  // =========================================================================
  
  // Health check
  app.get('/api/health', (c) => {
    return c.json({ 
      status: 'ok', 
      port: actualPort,
      version: '1.0',
      clients: wsManager?.getClientCount() || 0
    });
  });
  
  // List projects
  app.get('/api/projects', (c) => {
    // Derive this from the same hierarchy used by the UI navigation endpoint,
    // to avoid any divergence/staleness between endpoints.
    const hierarchy = store.getProjectHierarchy();
    const projects = hierarchy.flatMap((project) =>
      project.environments.map((environment) => ({
        project: project.name,
        environment: environment.name,
        historyCount: environment.historyCount,
        latestRun: environment.latestRun
          ? {
              runId: environment.latestRun.runId,
              status: environment.latestRun.status,
              timestamp: environment.latestRun.timestamp,
              summary: environment.latestRun.summary
            }
          : null
      }))
    );

    return c.json({ projects });
  });
  
  // Get project hierarchy for navigation
  app.get('/api/hierarchy', (c) => {
    const hierarchy = store.getProjectHierarchy();
    return c.json({ projects: hierarchy });
  });
  
  // List all runs
  app.get('/api/runs', (c) => {
    const runs = store.getAllRuns();
    return c.json(runs.map(r => ({
      id: r.runId,
      runId: r.runId,
      project: r.project,
      environment: r.environment,
      framework: r.framework,
      status: r.status,
      timestamp: r.timestamp
    })));
  });

  // Get run by ID
  app.get('/api/runs/:runId', (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    return c.json(run);
  });
  
  // Delete a run
  app.delete('/api/runs/:runId', async (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    const deleted = await store.deleteRun(runId);
    
    if (deleted && wsManager) {
      // Broadcast deletion
      const event: WebSocketEvent = { 
        type: 'run:deleted', 
        runId 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    if (deleted) {
      return c.json({ success: true });
    }
    
    return c.json({ error: 'Failed to delete run' }, 500);
  });
  
  // Get runs for project
  app.get('/api/projects/:project/:environment/runs', (c) => {
    const project = c.req.param('project');
    const environment = c.req.param('environment');
    const runs = store.getRunsForProject(project, environment);
    return c.json({
      runs: runs.map(r => ({
        runId: r.runId,
        status: r.status,
        timestamp: r.timestamp,
        duration: r.duration,
        summary: r.summary
      }))
    });
  });
  
  // Get latest run for project
  app.get('/api/projects/:project/:environment/latest', (c) => {
    const project = c.req.param('project');
    const environment = c.req.param('environment');
    const run = store.getRunsForProject(project, environment)[0];
    if (!run) {
      return c.json({ error: 'No runs found' }, 404);
    }
    return c.json(run);
  });
  
  // Start a new run
  app.post('/api/runs/start', async (c) => {
    const body = await c.req.json<StartRunRequest>();
    const runId = generateId();
    const timestamp = body.timestamp || new Date().toISOString();
    
    store.createRun(runId, body.project, body.environment, body.framework, timestamp);
    
    eventEmitter.emit('run:started', runId);

    // Broadcast
    if (wsManager) {
      const event: WebSocketEvent = {
        type: 'run:started',
        runId,
        project: body.project,
        environment: body.environment,
        framework: body.framework,
        timestamp
      };
      wsManager.broadcast(event, runId, body.project, body.environment);
    }
    
    const response: StartRunResponse = {
      runId,
      websocketUrl: `/ws`
    };
    
    return c.json(response, 201);
  });
  
  // Add feature
  app.post('/api/runs/:runId/features', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    // Pass through ALL fields from the reporter - don't filter data
    const feature: Feature = {
      id: body.id,
      title: body.title,
      displayTitle: body.displayTitle,
      description: body.description,
      rawDescription: body.rawDescription,
      filename: body.filename,
      path: body.path,
      tags: body.tags,
      status: body.status,
      duration: 0,
      sequence: body.sequence,
      scenarios: [],
      ruleViolations: body.ruleViolations,
      statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 }
    };
    
    store.addFeature(runId, feature);
    
    eventEmitter.emit('run:updated', runId);

    if (wsManager) {
      const event: WebSocketEvent = { type: 'feature:added', runId, feature };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    return c.json({ success: true });
  });
  
  // Add scenario
  app.post('/api/runs/:runId/scenarios', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    // Pass through ALL fields from the reporter - don't filter data
    const scenario: Scenario = {
      id: body.id,
      type: body.type,
      title: body.title,
      displayTitle: body.displayTitle,
      description: body.description,
      rawDescription: body.rawDescription,
      tags: body.tags,
      status: body.status,
      duration: 0,
      sequence: body.sequence,
      steps: body.steps || [],  // Include template steps for ScenarioOutline
      ruleViolations: body.ruleViolations,
      exampleIndex: body.exampleIndex,
      exampleValues: body.exampleValues,
      exampleValuesRaw: body.exampleValuesRaw,
      outlineId: body.outlineId  // Link examples to their parent outline
    };
    
    store.addScenario(runId, body.featureId, scenario);
    
    eventEmitter.emit('run:updated', runId);

    if (wsManager) {
      const event: WebSocketEvent = { 
        type: 'scenario:started', 
        runId, 
        featureId: body.featureId, 
        scenario 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    return c.json({ success: true });
  });
  
  // Add step
  app.post('/api/runs/:runId/steps', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    // Pass through ALL fields from the reporter - don't filter data
    const step: Step = {
      id: body.id,
      type: body.type,
      title: body.title,
      displayTitle: body.displayTitle,
      rawTitle: body.rawTitle,
      status: body.status,
      duration: body.duration,
      sequence: body.sequence,
      error: body.error,
      docString: body.docString,
      docStringRaw: body.docStringRaw,
      dataTable: body.dataTable,
      values: body.values,
      valuesRaw: body.valuesRaw,
      ruleViolations: body.ruleViolations,
      code: body.code
    };
    
    store.addStep(runId, body.scenarioId, step);
    
    eventEmitter.emit('run:updated', runId);

    if (wsManager) {
      const event: WebSocketEvent = { 
        type: 'step:completed', 
        runId, 
        scenarioId: body.scenarioId, 
        step 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    return c.json({ success: true });
  });
  
  // Complete scenario
  app.post('/api/runs/:runId/scenarios/:scenarioId/complete', async (c) => {
    const runId = c.req.param('runId');
    const scenarioId = c.req.param('scenarioId');
    const body = await c.req.json();
    
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    store.updateScenarioStatus(runId, scenarioId, body.status, body.duration);
    
    eventEmitter.emit('run:updated', runId);

    if (wsManager) {
      const event: WebSocketEvent = { 
        type: 'scenario:completed', 
        runId, 
        scenarioId, 
        status: body.status, 
        duration: body.duration 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    return c.json({ success: true });
  });
  
  // Complete run
  app.post('/api/runs/:runId/complete', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    store.completeRun(runId, body.status, body.duration, body.summary);
    
    eventEmitter.emit('run:updated', runId);

    if (wsManager) {
      const event: WebSocketEvent = { 
        type: 'run:completed', 
        runId, 
        status: body.status, 
        summary: body.summary, 
        duration: body.duration 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    return c.json({ success: true });
  });
  
  // Post complete run (batch mode)
  app.post('/api/runs', async (c) => {
    const body = await c.req.json<Omit<TestRun, 'runId'>>();
    const runId = generateId();
    
    const run: TestRun = { ...body, runId };
    store.storeCompleteRun(run);
    
    if (wsManager) {
      const event: WebSocketEvent = { 
        type: 'run:completed', 
        runId, 
        status: run.status, 
        summary: run.summary, 
        duration: run.duration 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }
    
    return c.json({ runId }, 201);
  });
  
  // =========================================================================
  // HTTP Request Handler
  // =========================================================================
  
  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }
    
    let body: string | undefined;
    if (req.method === 'POST' || req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString();
    }
    
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });
    
    try {
      const response = await app.fetch(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const responseBody = await response.text();
      res.end(responseBody);
    } catch (error) {
      console.error('Request error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  
  let actualPort = port;
  let running = false;
  const eventEmitter = new EventEmitter();
  
  const server: LiveDocServer = {
    on(event: string, listener: (...args: any[]) => void): void {
      eventEmitter.on(event, listener);
    },
    async listen(listenPort?: number): Promise<number> {
      // Use listenPort if explicitly provided (including 0 for ephemeral port), otherwise use default port
      const targetPort = listenPort !== undefined ? listenPort : port;
      
      // Initialize store
      await store.initialize();
      
      // Initialize WebSocket manager
      wsManager = new WebSocketManager(httpServer);
      
      return new Promise((resolve, reject) => {
        httpServer.listen(targetPort, host, () => {
          // Get the actual assigned port (important when using port 0 for ephemeral port)
          const address = httpServer.address();
          if (address && typeof address === 'object') {
            actualPort = address.port;
          } else {
            actualPort = targetPort;
          }
          running = true;

          // Write port file for discovery
          try {
            const portFile = getPortFilePath();
            const info = {
              port: actualPort,
              pid: process.pid,
              started: new Date().toISOString()
            };
            fs.writeFileSync(portFile, JSON.stringify(info, null, 2));
          } catch (err) {
            console.error('Failed to write port file:', err);
          }

          console.log(`🍵 LiveDoc Server running on http://${host}:${actualPort}`);
          resolve(actualPort);
        });
        
        httpServer.on('error', (err) => {
          reject(err);
        });
      });
    },
    
    async stop(): Promise<void> {
      running = false;
      
      // Delete port file
      try {
        const portFile = getPortFilePath();
        if (fs.existsSync(portFile)) {
          // Only delete if it's our file (check PID)
          const info = JSON.parse(fs.readFileSync(portFile, 'utf-8'));
          if (info.pid === process.pid) {
            fs.unlinkSync(portFile);
          }
        }
      } catch (err) {
        // Ignore errors during cleanup
      }
      
      // Flush pending saves
      await store.flush();
      
      // Close WebSocket connections
      if (wsManager) {
        wsManager.close();
        wsManager = null;
      }
      
      // Close HTTP server
      return new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    
    getPort(): number {
      return actualPort;
    },
    
    getApp(): Hono {
      return app;
    },
    
    getWebSocketManager(): WebSocketManager {
      if (!wsManager) {
        throw new Error('WebSocket manager not initialized. Call listen() first.');
      }
      return wsManager;
    },
    
    getRunStore(): RunStore {
      return store;
    },
    
    isRunning(): boolean {
      return running;
    }
  };
  
  return server;
}

/**
 * Create and start a LiveDoc server.
 * Convenience function that calls createServer() and listen().
 */
export async function startServer(options: ServerOptions = {}): Promise<LiveDocServer> {
  const server = createServer(options);
  await server.listen(options.port);
  
  if (options.open) {
    const open = await import('open');
    await open.default(`http://${options.host || 'localhost'}:${server.getPort()}`);
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
