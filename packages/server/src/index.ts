import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createServer as createHttpServer, IncomingMessage, ServerResponse, Server as HttpServer } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { WebSocketManager } from './websocket.js';
import { RunStore, RunStoreError, runStore } from './store.js';
import type {
  ServerConfig,
  TestRunV1,
  TestCase,
  AnyTest,
  StepTest,
  V1WebSocketEvent,
  V1StartRunRequest,
  V1StartRunResponse,
  V1UpsertTestCaseRequest,
  V1UpsertTestCasesBatchRequest,
  V1UpsertTestRequest,
  V1UpsertScenarioStepsRequest,
  V1PatchExecutionRequest,
  V1UpsertOutlineExampleResultsRequest,
  V1CompleteRunRequest,
  V1AttachCoverageRequest
} from './schema.js';
import {
  V1StartRunRequestSchema,
  V1UpsertTestCaseRequestSchema,
  V1UpsertTestCasesBatchRequestSchema,
  V1UpsertTestRequestSchema,
  V1UpsertScenarioStepsRequestSchema,
  V1PatchExecutionRequestSchema,
  V1UpsertOutlineExampleResultsRequestSchema,
  V1CompleteRunRequestSchema,
  V1AttachCoverageRequestSchema,
} from './schema.js';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function legacyExecution(node: JsonObject): AnyTest['execution'] {
  const execution = asObject(node.execution);
  const status = asString(execution?.status ?? node.status, 'pending') as AnyTest['execution']['status'];
  return {
    status,
    duration: asNonNegativeNumber(execution?.duration ?? node.duration),
    ...(asObject(execution?.error ?? node.error)
      ? { error: asObject(execution?.error ?? node.error) as AnyTest['execution']['error'] }
      : {}),
  };
}

function legacyStatistics(value: unknown): TestCase['statistics'] {
  const statistics = asObject(value);
  return {
    total: asNonNegativeNumber(statistics?.total),
    passed: asNonNegativeNumber(statistics?.passed),
    failed: asNonNegativeNumber(statistics?.failed),
    pending: asNonNegativeNumber(statistics?.pending),
    skipped: asNonNegativeNumber(statistics?.skipped),
  };
}

function legacyStep(node: JsonObject): StepTest {
  const keyword = asString(node.keyword ?? node.type, 'given').toLowerCase();
  return {
    id: asString(node.id),
    kind: 'Step',
    title: asString(node.title),
    ...(typeof node.description === 'string' ? { description: node.description } : {}),
    ...(Array.isArray(node.tags) ? { tags: node.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
    keyword: (['given', 'when', 'then', 'and', 'but'].includes(keyword) ? keyword : 'given') as StepTest['keyword'],
    execution: legacyExecution(node),
  };
}

function legacyTest(node: JsonObject): AnyTest {
  const kind = asString(node.kind ?? node.type, 'Test').toLowerCase();
  const children = Array.isArray(node.children)
    ? node.children.map(asObject).filter((child): child is JsonObject => child !== undefined)
    : Array.isArray(node.steps)
      ? node.steps.map(asObject).filter((child): child is JsonObject => child !== undefined)
      : [];

  if (kind === 'scenario') {
    return {
      id: asString(node.id),
      kind: 'Scenario',
      title: asString(node.title),
      ...(typeof node.description === 'string' ? { description: node.description } : {}),
      ...(Array.isArray(node.tags) ? { tags: node.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
      steps: children.map(legacyStep),
      execution: legacyExecution(node),
    };
  }

  return {
    id: asString(node.id),
    kind: kind === 'rule' ? 'Rule' : 'Test',
    title: asString(node.title),
    ...(typeof node.description === 'string' ? { description: node.description } : {}),
    ...(Array.isArray(node.tags) ? { tags: node.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
    execution: legacyExecution(node),
  };
}

function legacyTestCase(node: JsonObject): TestCase {
  const children = Array.isArray(node.children)
    ? node.children
    : Array.isArray(node.scenarios)
      ? node.scenarios
      : Array.isArray(node.tests)
        ? node.tests
        : [];
  const tests = children
    .map(asObject)
    .filter((child): child is JsonObject => child !== undefined)
    .map(legacyTest);

  return {
    id: asString(node.id),
    kind: asString(node.kind, 'Feature').toLowerCase() === 'suite' ? 'Suite' : 'Feature',
    title: asString(node.title),
    ...(typeof node.filename === 'string' ? { path: node.filename } : {}),
    ...(typeof node.description === 'string' ? { description: node.description } : {}),
    ...(Array.isArray(node.tags) ? { tags: node.tags.filter((tag): tag is string => typeof tag === 'string') } : {}),
    tests,
    statistics: legacyStatistics(node.statistics ?? node.stats),
  };
}

function legacyRunResponse(run: TestRunV1): JsonObject {
  const documents = run.documents.map((document) => {
    const children = document.tests.map((test) => {
      const steps = test.kind === 'Scenario' && Array.isArray((test as { steps?: StepTest[] }).steps)
        ? (test as { steps: StepTest[] }).steps.map((step) => ({
            ...step,
            type: step.keyword,
            status: step.execution.status,
            duration: step.execution.duration,
            ...(step.execution.error ? { error: step.execution.error } : {}),
          }))
        : [];
      return {
        ...test,
        type: test.kind,
        status: test.execution?.status,
        duration: test.execution?.duration,
        steps,
        children: steps,
      };
    });
    const status = document.statistics.failed > 0
      ? 'failed'
      : document.statistics.pending > 0
        ? 'running'
        : document.statistics.total > 0
          ? 'passed'
          : 'pending';
    return {
      ...document,
      filename: document.path,
      status,
      duration: children.reduce((sum, test) => sum + asNonNegativeNumber(test.duration), 0),
      children,
      scenarios: children,
    };
  });

  return {
    ...run,
    version: '1.0',
    documents,
    features: documents,
    suites: [],
    summary: { ...run.summary, duration: run.duration },
  };
}

// Re-export all schema types
export * from './schema.js';

// Re-export store
export { RunStore, RunStoreError, runStore } from './store.js';
export { composeTestRun } from './run-composition.js';

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
      const response = await fetch(`http://localhost:${port}/api/health`, {
        headers: { 'Connection': 'close' },
      });
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
  const runStoreError = (error: unknown): { status: 404 | 409 | 410 | 500; body: { error: string; code: string } } => {
    if (error instanceof RunStoreError) {
      if (error.code === 'run-cancelled') return { status: 410, body: { error: error.message, code: error.code } };
      if (error.code === 'no-baseline' || error.code === 'run-active' || error.code === 'framework-mismatch' || error.code === 'dependent-run') {
        return { status: 409, body: { error: error.message, code: error.code } };
      }
      return { status: 404, body: { error: error.message, code: error.code } };
    }
    return {
      status: 500,
      body: {
        error: error instanceof Error ? error.message : 'Run persistence failed',
        code: 'run-persistence-failed',
      },
    };
  };
  const requireActiveRun = (runId: string): TestRunV1 => store.assertMutable(runId);
  const forwardToV1 = async (request: Request, pathname: string): Promise<Response> => {
    const url = new URL(request.url);
    url.pathname = pathname;
    const body = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();
    return app.fetch(new Request(url, {
      method: request.method,
      headers: request.headers,
      body,
    }));
  };

  const legacyHierarchy = () => {
    const projects = new Map<string, Map<string, TestRunV1[]>>();
    for (const run of store.getAllRuns()) {
      const environments = projects.get(run.project) ?? new Map<string, TestRunV1[]>();
      const runs = environments.get(run.environment) ?? [];
      runs.push(run);
      environments.set(run.environment, runs);
      projects.set(run.project, environments);
    }

    return Array.from(projects, ([name, environments]) => ({
      name,
      environments: Array.from(environments, ([environmentName, runs]) => ({
        name: environmentName,
        latestRun: runs[0],
        historyCount: runs.length,
        history: runs.map((run) => ({
          runId: run.runId,
          timestamp: run.timestamp,
          status: run.status,
          summary: run.summary,
          runType: run.runType ?? 'full',
          ...(run.baselineRunId ? { baselineRunId: run.baselineRunId } : {}),
        })),
      })),
    }));
  };

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
    const hierarchy = legacyHierarchy();
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
    const hierarchy = legacyHierarchy();
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
      timestamp: r.timestamp,
      runType: r.runType ?? 'full',
      ...(r.baselineRunId ? { baselineRunId: r.baselineRunId } : {}),
    })));
  });

  // Get run by ID
  app.get('/api/runs/:runId', (c) => {
    const runId = asString(c.req.param('runId'));
    const run = store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    return c.json(legacyRunResponse(run));
  });

  // Delete a run
  app.delete('/api/runs/:runId', async (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);

    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }

    if (store.cancelRun(runId)) {
      return c.json({ success: true });
    }

    let deleted: boolean;
    try {
      deleted = await store.deleteRun(runId);
    } catch (error) {
      const apiError = runStoreError(error);
      return c.json(apiError.body, apiError.status);
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
        summary: r.summary,
        runType: r.runType ?? 'full',
        ...(r.baselineRunId ? { baselineRunId: r.baselineRunId } : {}),
      }))
    });
  });

  // Get latest run for project
  app.get('/api/projects/:project/:environment/latest', (c) => {
    const project = c.req.param('project');
    const environment = c.req.param('environment');
    const run = store.getLatestRun(project, environment);
    if (!run) {
      return c.json({ error: 'No runs found' }, 404);
    }
    return c.json(run);
  });

  // =========================================================================
  // v1 API Routes (Reporter Model v1)
  // =========================================================================

  // Read endpoints (used by Viewer/clients)
  app.get('/api/v1/hierarchy', (c) => {
    const hierarchy = store.getProjectHierarchy();
    return c.json({ projects: hierarchy });
  });

  app.get('/api/v1/runs', (c) => {
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
        runType: r.runType ?? 'full',
        ...(r.baselineRunId ? { baselineRunId: r.baselineRunId } : {}),
      }))
    );
  });

  app.get('/api/v1/runs/:runId', (c) => {
    const runId = c.req.param('runId');
    const view = c.req.query('view');
    const run = view === 'combined' ? store.getCombinedRun(runId) : store.getRun(runId);
    if (!run) {
      return c.json({ error: 'Run not found' }, 404);
    }
    return c.json(run);
  });

  app.get('/api/v1/diagnostics', (c) => {
    return c.json({ diagnostics: store.getDiagnostics() });
  });

  app.get('/api/v1/projects/:project/:environment/latest', (c) => {
    const project = c.req.param('project');
    const environment = c.req.param('environment');
    const run = store.getLatestRun(project, environment);
    if (!run) {
      return c.json({ error: 'No runs found' }, 404);
    }
    return c.json(run);
  });

  app.post('/api/v1/runs/start', async (c) => {
    const json = await c.req.json().catch(() => null);
    const parsed = V1StartRunRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1StartRunRequest = parsed.data;
    const runId = generateId();
    const timestamp = body.timestamp || new Date().toISOString();

    let run: TestRunV1;
    try {
      run = store.createRun(runId, body.project, body.environment, body.framework, timestamp, body.runType ?? 'full');
    } catch (error) {
      const apiError = runStoreError(error);
      return c.json(apiError.body, apiError.status);
    }

    eventEmitter.emit('run:v1:started', runId);

    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'run:v1:started',
        runId,
        project: run.project,
        environment: run.environment,
        framework: run.framework,
        timestamp: run.timestamp,
        runType: run.runType,
        ...(run.baselineRunId ? { baselineRunId: run.baselineRunId } : {}),
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    const response: V1StartRunResponse = {
      protocolVersion: '1.0',
      runId,
      websocketUrl: `/ws`,
    };

    return c.json(response, 201);
  });

  app.post('/api/v1/runs/:runId/testcases', async (c) => {
    const runId = c.req.param('runId');
    let run: TestRunV1;
    try { run = requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1UpsertTestCaseRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1UpsertTestCaseRequest = parsed.data;
    store.upsertTestCase(runId, body.testCase as TestCase);

    if (wsManager) {
      const event: V1WebSocketEvent = { type: 'testcase:upsert', runId, testCase: body.testCase };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  // Batch upsert multiple test cases in a single request
  app.post('/api/v1/runs/:runId/testcases/batch', async (c) => {
    const runId = c.req.param('runId');
    let run: TestRunV1;
    try { run = requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1UpsertTestCasesBatchRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1UpsertTestCasesBatchRequest = parsed.data;
    for (const tc of body.testCases) {
      store.upsertTestCase(runId, tc as TestCase);

      if (wsManager) {
        const event: V1WebSocketEvent = { type: 'testcase:upsert', runId, testCase: tc };
        wsManager.broadcast(event, runId, run.project, run.environment);
      }
    }

    // Optionally complete the run in the same request (avoids extra HTTP call)
    if (body.complete) {
      let completedRun: TestRunV1;
      try {
        completedRun = await store.completeRun(
          runId,
          body.complete.status,
          body.complete.duration,
          body.complete.summary,
          body.complete.coverage
        );
      } catch (error) {
        const apiError = runStoreError(error);
        return c.json(apiError.body, apiError.status);
      }

      eventEmitter.emit('run:v1:completed', runId);

      if (wsManager) {
        const event: V1WebSocketEvent = {
          type: 'run:v1:completed',
          runId,
          status: body.complete.status,
          duration: body.complete.duration,
          summary: completedRun.summary,
          coverage: completedRun.coverage,
        };
        wsManager.broadcast(event, runId, run.project, run.environment);
      }
    }

    return c.json({ success: true, count: body.testCases.length });
  });

  app.post('/api/v1/runs/:runId/tests', async (c) => {
    const runId = c.req.param('runId');
    let run: TestRunV1;
    try { run = requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1UpsertTestRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1UpsertTestRequest = parsed.data;
    store.upsertTest(runId, body.testCaseId, body.test as AnyTest);

    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'test:upsert',
        runId,
        testCaseId: body.testCaseId,
        test: body.test,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.put('/api/v1/runs/:runId/scenarios/:scenarioId/steps', async (c) => {
    const runId = c.req.param('runId');
    const scenarioId = c.req.param('scenarioId');
    try { requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1UpsertScenarioStepsRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1UpsertScenarioStepsRequest = parsed.data;
    store.replaceScenarioSteps(runId, scenarioId, body.steps as AnyTest[]);

    // Steps are part of the scenario model; producers are expected to upsert the scenario itself,
    // so we don't emit an extra event here.
    return c.json({ success: true });
  });

  app.patch('/api/v1/runs/:runId/tests/:testId/execution', async (c) => {
    const runId = c.req.param('runId');
    const testId = c.req.param('testId');
    let run: TestRunV1;
    try { run = requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1PatchExecutionRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const patch: V1PatchExecutionRequest = parsed.data;
    store.patchTestExecution(runId, testId, patch);

    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'test:execution',
        runId,
        testId,
        patch: { execution: patch },
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v1/runs/:runId/outlines/:outlineId/example-results', async (c) => {
    const runId = c.req.param('runId');
    const outlineId = c.req.param('outlineId');
    let run: TestRunV1;
    try { run = requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1UpsertOutlineExampleResultsRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1UpsertOutlineExampleResultsRequest = parsed.data;
    store.upsertOutlineExampleResults(runId, outlineId, body.results);

    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'outline:exampleResults',
        runId,
        outlineId,
        results: body.results,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v1/runs/:runId/cancel', (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found', code: 'run-not-found' }, 404);
    if (!store.cancelRun(runId)) {
      const apiError = runStoreError(new RunStoreError('run-not-active', `Run '${runId}' is not active.`));
      return c.json(apiError.body, apiError.status);
    }

    eventEmitter.emit('run:v1:completed', runId);
    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'run:v1:completed',
        runId,
        status: 'cancelled',
        duration: run.duration,
        summary: run.summary,
        coverage: run.coverage,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v1/runs/:runId/complete', async (c) => {
    const runId = c.req.param('runId');
    let run: TestRunV1;
    try { run = requireActiveRun(runId); } catch (error) {
      const apiError = runStoreError(error); return c.json(apiError.body, apiError.status);
    }

    const json = await c.req.json().catch(() => null);
    const parsed = V1CompleteRunRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1CompleteRunRequest = parsed.data;
    let completedRun: TestRunV1;
    try {
      completedRun = await store.completeRun(runId, body.status, body.duration, body.summary, body.coverage);
    } catch (error) {
      const apiError = runStoreError(error);
      return c.json(apiError.body, apiError.status);
    }

    eventEmitter.emit('run:v1:completed', runId);

    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'run:v1:completed',
        runId,
        status: body.status,
        duration: body.duration,
        summary: completedRun.summary,
        coverage: completedRun.coverage,
      };
      wsManager.broadcast(event, runId, run.project, run.environment);
    }

    return c.json({ success: true });
  });

  app.post('/api/v1/runs/:runId/coverage', async (c) => {
    const runId = c.req.param('runId');
    const run = store.getRun(runId);
    if (!run) return c.json({ error: 'Run not found' }, 404);

    const json = await c.req.json().catch(() => null);
    const parsed = V1AttachCoverageRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.format() }, 400);
    }

    const body: V1AttachCoverageRequest = parsed.data;
    let persistence: { completed: true; paths: string[] };
    try {
      persistence = await store.attachCoverage(runId, body.coverage);
    } catch (error) {
      if (error instanceof RunStoreError) {
        const apiError = runStoreError(error);
        return c.json(apiError.body, apiError.status);
      }
      const message = error instanceof Error ? error.message : String(error);
      const diagnostic = `LD-COV-072 coverage-persistence-failed: runId=${runId}; message=${message}`;
      options.logger?.(diagnostic);
      console.error(diagnostic);
      return c.json({
        error: 'Coverage persistence failed',
        code: 'LD-COV-072',
        diagnostic,
        retryable: true,
      }, 500);
    }

    let broadcast = { matched: 0, sent: 0, failed: 0 };
    if (wsManager) {
      const event: V1WebSocketEvent = {
        type: 'run:v1:coverage',
        runId,
        coverage: body.coverage,
      };
      broadcast = wsManager.broadcast(event, runId, run.project, run.environment);
    }

    const restHydrationAvailable = store.getRun(runId)?.coverage !== undefined;
    options.logger?.(
      `LD-COV-080 server-accepted: runId=${runId}; persistenceCompleted=${persistence.completed}; ` +
      `broadcastMatched=${broadcast.matched}; broadcastSent=${broadcast.sent}; ` +
      `broadcastFailed=${broadcast.failed}; restHydrationAvailable=${restHydrationAvailable}`
    );

    return c.json({
      success: true,
      code: 'LD-COV-080',
      request: { received: true },
      persistence,
      broadcast,
      restHydration: { available: restHydrationAvailable },
    });
  });

  // Unversioned endpoints remain supported for existing reporters. Their
  // lifecycle semantics and persisted data are delegated to the v1 model.
  app.post('/api/runs/start', (c) => forwardToV1(c.req.raw, '/api/v1/runs/start'));
  app.post('/api/runs/:runId/complete', (c) =>
    forwardToV1(c.req.raw, `/api/v1/runs/${c.req.param('runId')}/complete`));

  const upsertLegacyNode = (
    run: TestRunV1,
    parentId: string | undefined,
    node: JsonObject
  ): { success: boolean; event?: V1WebSocketEvent } => {
    const kind = asString(node.kind ?? node.type).toLowerCase();
    if (kind === 'feature' || kind === 'suite' || (!parentId && Array.isArray(node.scenarios))) {
      const testCase = legacyTestCase(node);
      if (!testCase.id || !testCase.title) return { success: false };
      store.upsertTestCase(run.runId, testCase);
      return {
        success: true,
        event: { type: 'testcase:upsert', runId: run.runId, testCase },
      };
    }

    const parentDocument = parentId
      ? run.documents.find((document) => document.id === parentId)
      : undefined;
    if (kind === 'scenario' || kind === 'rule' || kind === 'test') {
      if (!parentDocument) return { success: false };
      const test = legacyTest(node);
      if (!test.id || !test.title) return { success: false };
      store.upsertTest(run.runId, parentDocument.id, test);
      return {
        success: true,
        event: { type: 'test:upsert', runId: run.runId, testCaseId: parentDocument.id, test },
      };
    }

    if (kind === 'step') {
      const scenario = parentId
        ? run.documents.flatMap((document) => document.tests).find((test) => test.id === parentId)
        : undefined;
      if (!scenario || scenario.kind !== 'Scenario') return { success: false };
      const step = legacyStep(node);
      if (!step.id || !step.title) return { success: false };
      const steps = [...((scenario as { steps?: StepTest[] }).steps ?? [])];
      const existing = steps.findIndex((candidate) => candidate.id === step.id);
      if (existing >= 0) steps[existing] = step;
      else steps.push(step);
      store.replaceScenarioSteps(run.runId, scenario.id, steps);
      return { success: true };
    }

    return { success: false };
  };

  const legacyNodeHandler = async (
    c: Context,
    getPayload: (body: JsonObject) => { parentId?: string; node?: JsonObject }
  ) => {
    const runId = asString(c.req.param('runId'));
    let run: TestRunV1;
    try {
      run = requireActiveRun(runId);
    } catch (error) {
      const apiError = runStoreError(error);
      return c.json(apiError.body, apiError.status);
    }

    const body = asObject(await c.req.json().catch(() => null));
    if (!body) return c.json({ error: 'Invalid request' }, 400);
    const payload = getPayload(body);
    if (!payload.node) return c.json({ error: 'Invalid request' }, 400);
    const result = upsertLegacyNode(run, payload.parentId, payload.node);
    if (!result.success) return c.json({ error: 'Parent or node not found' }, 404);
    if (wsManager && result.event) {
      wsManager.broadcast(result.event, runId, run.project, run.environment);
    }
    return c.json({ success: true });
  };

  app.post('/api/runs/:runId/features', (c) =>
    legacyNodeHandler(c, (body) => ({ node: { ...body, kind: 'Feature' } })));
  app.post('/api/runs/:runId/scenarios', (c) =>
    legacyNodeHandler(c, (body) => ({
      parentId: typeof body.featureId === 'string' ? body.featureId : undefined,
      node: { ...body, kind: body.kind ?? body.type ?? 'Scenario' },
    })));
  app.post('/api/runs/:runId/steps', (c) =>
    legacyNodeHandler(c, (body) => ({
      parentId: typeof body.scenarioId === 'string' ? body.scenarioId : undefined,
      node: { ...body, kind: 'Step' },
    })));
  app.post('/api/runs/:runId/scenarios/:scenarioId/complete', async (c) => {
    const runId = c.req.param('runId');
    try {
      requireActiveRun(runId);
    } catch (error) {
      const apiError = runStoreError(error);
      return c.json(apiError.body, apiError.status);
    }
    const body = asObject(await c.req.json().catch(() => null));
    if (!body) return c.json({ error: 'Invalid request' }, 400);
    store.patchTestExecution(runId, c.req.param('scenarioId'), {
      status: asString(body.status, 'pending') as AnyTest['execution']['status'],
      duration: asNonNegativeNumber(body.duration),
    });
    return c.json({ success: true });
  });

  app.post('/api/runs', async (c) => {
    const body = asObject(await c.req.json().catch(() => null));
    if (!body) return c.json({ error: 'Invalid request' }, 400);
    const project = asString(body.project);
    const environment = asString(body.environment);
    const framework = asString(body.framework);
    if (!project || !environment || !framework) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    const runId = generateId();
    let run: TestRunV1;
    try {
      run = store.createRun(
        runId,
        project,
        environment,
        framework,
        asString(body.timestamp, new Date().toISOString())
      );
      const legacyDocuments = [
        ...(Array.isArray(body.features) ? body.features : []),
        ...(Array.isArray(body.suites) ? body.suites : []),
      ];
      for (const value of legacyDocuments) {
        const document = asObject(value);
        if (document) store.upsertTestCase(runId, legacyTestCase(document));
      }
      run = await store.completeRun(
        runId,
        asString(body.status, 'passed') as TestRunV1['status'],
        asNonNegativeNumber(body.duration),
        legacyStatistics(body.summary)
      );
    } catch (error) {
      store.cancelRun(runId);
      const apiError = runStoreError(error);
      return c.json(apiError.body, apiError.status);
    }

    eventEmitter.emit('run:v1:completed', runId);
    if (wsManager) {
      wsManager.broadcast({
        type: 'run:v1:completed',
        runId,
        status: run.status,
        duration: run.duration,
        summary: run.summary,
        coverage: run.coverage,
      }, runId, run.project, run.environment);
    }
    return c.json({ runId }, 201);
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
  let stopPromise: Promise<void> | null = null;
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
      if (stopPromise) {
        return stopPromise;
      }

      if (!running) {
        return;
      }

      stopPromise = (async () => {
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

        // 1. Close WebSocket connections before HTTP shutdown so upgraded
        // connections do not keep httpServer.close() waiting forever.
        if (wsManager) {
          await wsManager.close();
          wsManager = null;
        }

        // 2. Close inbound traffic (HTTP stops accepting new connections)
        await new Promise<void>((resolve, reject) => {
          httpServer.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // 3. Flush pending saves (no new traffic can arrive now)
        await store.flush();
      })();

      try {
        await stopPromise;
      } finally {
        stopPromise = null;
      }
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
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received, shutting down gracefully...`);
    try {
      await server.stop();
      console.log('Data saved. Goodbye! 👋');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  return server;
}
