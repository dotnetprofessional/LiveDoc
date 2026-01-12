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
  ServerConfig,
  TestRunV3,
  TestCase,
  AnyTest,
  V3WebSocketEvent,
  V3StartRunRequest,
  V3StartRunResponse,
  V3UpsertTestCaseRequest,
  V3UpsertTestRequest,
  V3UpsertScenarioStepsRequest,
  V3PatchExecutionRequest,
  V3UpsertOutlineExampleResultsRequest,
  V3CompleteRunRequest
} from './schema.js';
import {
  V3StartRunRequestSchema,
  V3UpsertTestCaseRequestSchema,
  V3UpsertTestRequestSchema,
  V3UpsertScenarioStepsRequestSchema,
  V3PatchExecutionRequestSchema,
  V3UpsertOutlineExampleResultsRequestSchema,
  V3CompleteRunRequestSchema,
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
  if (!fs.existsSync(portFile)) {
    return null;
  }
  
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
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) {
        return {
          url: `http://localhost:${port}`,
          port
        };
      }
    } catch (fetchError: any) {
      // Server might be starting up or not a LiveDoc server
    }
  } catch (e: any) {
    // Ignore errors during discovery
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
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  // =========================================================================
  // v3 API Routes (Reporter Model v3)
  // =========================================================================

  // Read endpoints (used by Viewer/clients)
  app.get('/api/v3/hierarchy', (c) => {
    const hierarchy = store.getProjectHierarchy();
    return c.json({ projects: hierarchy });
  });

  app.get('/api/v3/runs', (c) => {
    const runs = store.getAllRuns();
    return c.json(
      runs.map((r) => ({
        protocolVersion: r.protocolVersion,
        runId: r.runId,
        project: r.project,
        environment: r.environment,
        framework: r.framework,
        status: r.status,
        timestamp: r.timestamp,
      }))
    );
  });

  app.get('/api/v3/runs/:runId', (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    return c.json(run);
  });

  app.get('/api/v3/projects/:project/:environment/latest', (c) => {
    const project = c.req.param('project');
    const environment = c.req.param('environment');
    const run = store.getLatestRun(project, environment);
    if (!run) {
      return c.json({ error: 'No runs found' }, 404);
    }
    return c.json(run);
  });

  app.post('/api/v3/runs/start', async (c) => {
    const json = await c.req.json().catch(() => null);
    const parsed = V3StartRunRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V3StartRunRequest = parsed.data;
    const runId = generateId();
    const timestamp = body.timestamp || new Date().toISOString();

    const run = store.createRun(runId, body.project, body.environment, body.framework, timestamp);

    eventEmitter.emit('run:v3:started', runId);

    if (wsManager) {
      const event: V3WebSocketEvent = {
        type: 'run:v3:started',
        runId,
        project: run.project,
        environment: run.environment,
        framework: run.framework,
        timestamp: run.timestamp,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    const response: V3StartRunResponse = {
      protocolVersion: '3.0',
      runId,
      websocketUrl: `/ws`,
    };

    return c.json(response, 201);
  });

  app.post('/api/v3/runs/:runId/testcases', async (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V3UpsertTestCaseRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V3UpsertTestCaseRequest = parsed.data;
    store.upsertTestCase(runId, body.testCase as TestCase);

    if (wsManager) {
      const event: V3WebSocketEvent = { type: 'testcase:upsert', runId, testCase: body.testCase };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v3/runs/:runId/tests', async (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V3UpsertTestRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V3UpsertTestRequest = parsed.data;
    store.upsertTest(runId, body.testCaseId, body.test as AnyTest);

    if (wsManager) {
      const event: V3WebSocketEvent = {
        type: 'test:upsert',
        runId,
        testCaseId: body.testCaseId,
        test: body.test,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.put('/api/v3/runs/:runId/scenarios/:scenarioId/steps', async (c) => {
    const runId = c.req.param('runId');
    const scenarioId = c.req.param('scenarioId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V3UpsertScenarioStepsRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V3UpsertScenarioStepsRequest = parsed.data;
    store.replaceScenarioSteps(runId, scenarioId, body.steps as AnyTest[]);

    // Steps are part of the scenario model; producers are expected to upsert the scenario itself,
    // so we don't emit an extra event here.
    return c.json({ success: true });
  });

  app.patch('/api/v3/runs/:runId/tests/:testId/execution', async (c) => {
    const runId = c.req.param('runId');
    const testId = c.req.param('testId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V3PatchExecutionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const patch: V3PatchExecutionRequest = parsed.data;
    store.patchTestExecution(runId, testId, patch);

    if (wsManager) {
      const event: V3WebSocketEvent = {
        type: 'test:execution',
        runId,
        testId,
        patch: { execution: patch },
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v3/runs/:runId/outlines/:outlineId/example-results', async (c) => {
    const runId = c.req.param('runId');
    const outlineId = c.req.param('outlineId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V3UpsertOutlineExampleResultsRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V3UpsertOutlineExampleResultsRequest = parsed.data;
    store.upsertOutlineExampleResults(runId, outlineId, body.results);

    if (wsManager) {
      const event: V3WebSocketEvent = {
        type: 'outline:exampleResults',
        runId,
        outlineId,
        results: body.results,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v3/runs/:runId/complete', async (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V3CompleteRunRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V3CompleteRunRequest = parsed.data;
    store.completeRun(runId, body.status, body.duration, body.summary);

    eventEmitter.emit('run:v3:completed', runId);

    if (wsManager) {
      const event: V3WebSocketEvent = {
        type: 'run:v3:completed',
        runId,
        status: body.status,
        duration: body.duration,
        summary: body.summary ?? run.summary,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });
  
  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }
    
    let body: string | undefined;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
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
