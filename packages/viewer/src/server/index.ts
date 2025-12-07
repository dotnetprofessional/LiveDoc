import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketManager } from './websocket';
import { runStore } from './store';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import type {
  StartRunRequest,
  StartRunResponse,
  TestRun,
  Feature,
  Scenario,
  Step,
  WebSocketEvent
} from '../shared/schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Static file directory (built React app)
function getStaticDir(): string {
  return path.resolve(__dirname, '../client');
}

// Generate unique IDs
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface ServerOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

export async function startServer(options: ServerOptions = {}) {
  const port = options.port || 3000;
  const host = options.host || 'localhost';
  
  // Initialize persistent store (load existing data from disk)
  await runStore.initialize();
  
  const staticDir = getStaticDir();
  
  // Create HTTP server first
  const httpServer = createServer();
  
  // Initialize WebSocket manager
  const wsManager = new WebSocketManager(httpServer);
  
  // Create Hono app
  const app = new Hono();
  
  // Enable CORS
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-LiveDoc-Token']
  }));
  
  // =========================================================================
  // API Routes
  // =========================================================================
  
  // List projects
  app.get('/api/projects', (c) => {
    const projects = runStore.getProjects();
    return c.json({
      projects: projects.map(p => ({
        project: p.project,
        environment: p.environment,
        historyCount: p.historyCount,
        latestRun: p.latestRun ? {
          runId: p.latestRun.runId,
          status: p.latestRun.status,
          timestamp: p.latestRun.timestamp,
          summary: p.latestRun.summary
        } : null
      }))
    });
  });
  
  // Get project hierarchy for navigation
  app.get('/api/hierarchy', (c) => {
    const hierarchy = runStore.getProjectHierarchy();
    return c.json({ projects: hierarchy });
  });
  
  // List all runs
  app.get('/api/runs', (c) => {
    const runs = runStore.getAllRuns();
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
    const run = runStore.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    return c.json(run);
  });
  
  // Delete a run
  app.delete('/api/runs/:runId', async (c) => {
    const runId = c.req.param('runId');
    const run = runStore.getRun(runId);
    
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    const deleted = await runStore.deleteRun(runId);
    
    if (deleted) {
      // Broadcast deletion
      const event: WebSocketEvent = { 
        type: 'run:deleted', 
        runId 
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
      
      return c.json({ success: true });
    }
    
    return c.json({ error: 'Failed to delete run' }, 500);
  });
  
  // Get runs for project
  app.get('/api/projects/:project/:environment/runs', (c) => {
    const project = c.req.param('project');
    const environment = c.req.param('environment');
    const runs = runStore.getRunsForProject(project, environment);
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
    const run = runStore.getLatestRun(project, environment);
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
    
    runStore.createRun(runId, body.project, body.environment, body.framework, timestamp);
    
    // Broadcast
    const event: WebSocketEvent = {
      type: 'run:started',
      runId,
      project: body.project,
      environment: body.environment,
      framework: body.framework,
      timestamp
    };
    wsManager.broadcast(event, runId, body.project, body.environment);
    
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
    
    const run = runStore.getRun(runId);
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
      tags: body.tags,
      status: body.status,
      duration: 0,
      sequence: body.sequence,
      scenarios: [],
      ruleViolations: body.ruleViolations,
      statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 }
    };
    
    runStore.addFeature(runId, feature);
    
    const event: WebSocketEvent = { type: 'feature:added', runId, feature };
    wsManager.broadcast(event, runId, run.project, run.environment);
    
    return c.json({ success: true });
  });
  
  // Add scenario
  app.post('/api/runs/:runId/scenarios', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = runStore.getRun(runId);
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
    
    runStore.addScenario(runId, body.featureId, scenario);
    
    const event: WebSocketEvent = { 
      type: 'scenario:started', 
      runId, 
      featureId: body.featureId, 
      scenario 
    };
    wsManager.broadcast(event, runId, run.project, run.environment);
    
    return c.json({ success: true });
  });
  
  // Add step
  app.post('/api/runs/:runId/steps', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = runStore.getRun(runId);
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
    
    runStore.addStep(runId, body.scenarioId, step);
    
    const event: WebSocketEvent = { 
      type: 'step:completed', 
      runId, 
      scenarioId: body.scenarioId, 
      step 
    };
    wsManager.broadcast(event, runId, run.project, run.environment);
    
    return c.json({ success: true });
  });
  
  // Complete scenario
  app.post('/api/runs/:runId/scenarios/:scenarioId/complete', async (c) => {
    const runId = c.req.param('runId');
    const scenarioId = c.req.param('scenarioId');
    const body = await c.req.json();
    
    const run = runStore.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    runStore.updateScenarioStatus(runId, scenarioId, body.status, body.duration);
    
    const event: WebSocketEvent = { 
      type: 'scenario:completed', 
      runId, 
      scenarioId, 
      status: body.status, 
      duration: body.duration 
    };
    wsManager.broadcast(event, runId, run.project, run.environment);
    
    return c.json({ success: true });
  });
  
  // Complete run
  app.post('/api/runs/:runId/complete', async (c) => {
    const runId = c.req.param('runId');
    const body = await c.req.json();
    
    const run = runStore.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    
    runStore.completeRun(runId, body.status, body.duration, body.summary);
    
    const event: WebSocketEvent = { 
      type: 'run:completed', 
      runId, 
      status: body.status, 
      summary: body.summary, 
      duration: body.duration 
    };
    wsManager.broadcast(event, runId, run.project, run.environment);
    
    return c.json({ success: true });
  });
  
  // Post complete run (batch mode)
  app.post('/api/runs', async (c) => {
    const body = await c.req.json<Omit<TestRun, 'runId'>>();
    const runId = generateId();
    
    const run: TestRun = { ...body, runId };
    runStore.storeCompleteRun(run);
    
    const event: WebSocketEvent = { 
      type: 'run:completed', 
      runId, 
      status: run.status, 
      summary: run.summary, 
      duration: run.duration 
    };
    wsManager.broadcast(event, runId, run.project, run.environment);
    
    return c.json({ runId }, 201);
  });
  
  // =========================================================================
  // Static Files (SPA)
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
  
  app.get('*', async (c) => {
    try {
      const indexPath = path.join(staticDir, 'index.html');
      const html = await fs.readFile(indexPath, 'utf-8');
      return c.html(html);
    } catch {
      return c.text('LiveDoc Viewer', 200);
    }
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
  
  // =========================================================================
  // Start Server
  // =========================================================================
  
  httpServer.listen(port, host, () => {
    console.log(`
🍵 LiveDoc Viewer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Server:    http://${host}:${port}
  WebSocket: ws://${host}:${port}/ws
  API:       http://${host}:${port}/api
  Data:      ${runStore.getDataDir()}

  Endpoints:
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
  });
  
  if (options.open) {
    const open = await import('open');
    await open.default(`http://${host}:${port}`);
  }
  
  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await runStore.flush();
    console.log('Data saved. Goodbye! 👋');
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  return httpServer;
}

// Run if executed directly
const isMainModule = process.argv[1]?.includes('index');
if (isMainModule) {
  startServer({ port: 3000, open: false });
}
