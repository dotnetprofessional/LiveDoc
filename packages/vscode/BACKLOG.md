# @livedoc/vscode Extension Backlog (DEPRECATED)

> **DEPRECATION NOTICE**: This document is now deprecated. Please refer to the new [packages/vscode/vscode-brd.md](vscode-brd.md) for the current source of truth.

## Vision

**Bridge the PM/Developer divide with Living Documentation.**

Developers work in VS Code writing BDD tests. PMs and stakeholders use the web Viewer to read specifications and verify coverage. Both see the same living documentation - tests that serve as verified, executable specifications.

### The Problem

Today, there's a disconnect:
- **Developers** run tests but results are ephemeral (console output, then gone)
- **PMs/Stakeholders** can't easily see what's tested or read specs in a friendly format
- **No single source of truth** for "what does the system do?"

### The Solution

A unified server that:
1. **Receives test results** as they execute (real-time streaming)
2. **Stores results** for viewing by developers and stakeholders
3. **Powers both VS Code extension and web Viewer** with the same data
4. **Works locally** (zero config) and scales to **team/CI** (hosted server)

### User Personas

|    Persona    |        Tool         |                     Primary Goal                      |
| ---------     | ------              | --------------                                        |
| **Developer** | VS Code + Extension | Write tests, see results, navigate to code            |
| **PM/BA**     | Web Viewer          | Read specs, verify coverage, share with stakeholders  |
| **QA**        | Either              | Identify gaps, track flaky tests, regression analysis |
| **CI/CD**     | Reporter + Server   | Aggregate results across builds, track trends         |

### Development Standards

**UI Development (Viewer & Webviews):**
- **Framework**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (do not reinvent primitives)
- **State**: Zustand
- **Design**: Professional, polished, and delightful

**Testing:**
- **Pattern**: BDD (Gherkin) or Specification
- **Rule**: **Self-Documenting Steps** (embed inputs/outputs in titles)
- **Reference**: `.github/instructions/livedoc-vitest.instructions.md`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                            │
├─────────────────────────────────────────────────────────────────────┤
│   ┌──────────────────┐     ┌─────────────────────────────────────┐  │
│   │  LiveDoc Server  │     │  UI Components                      │  │
│   │  (localhost:PORT)│     │                                     │  │
│   │                  │     │  ┌─────────────┐ ┌───────────────┐  │  │
│   │  • REST API      │◄────┼──│ Tree View   │ │ Webview Panel │  │  │
│   │  • WebSocket     │     │  │ (Quick Nav) │ │ (Full Viewer) │  │  │
│   │  • Results Store │     │  └─────────────┘ └───────────────┘  │  │
│   └────────▲─────────┘     └─────────────────────────────────────┘  │
│            │                                                         │
└────────────┼─────────────────────────────────────────────────────────┘
             │
             │  HTTP/WebSocket (localhost:19275)
             │
┌────────────┼─────────────────────────────────────────────────────────┐
│   ┌────────┴─────────┐     ┌─────────────────────────────────────┐   │
│   │  LiveDoc         │     │  Vitest                             │   │
│   │  Reporter        │◄────│  Test Runner                        │   │
│   │  • Stream events │     │  • feature(), scenario(), given()   │   │
│   └──────────────────┘     └─────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────────────────────────────────────────┐
│  External Viewer (Web) - connects to localhost or production server  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Decisions Log

|    Date    |        Decision         |         Choice         |               Rationale                |
| ------     | ----------              | --------               | -----------                            |
| 2024-12-07 | Server host             | VS Code extension      | Guaranteed running when dev is working |
| 2024-12-07 | Fallback when no server | Silent (no error)      | If nothing listening, dev doesn't care |
| 2024-12-07 | Configuration method    | VS Code settings       | Consistent with other extensions       |
| 2024-12-07 | Server scope            | Global (multi-project) | Less ports, unified view               |
| 2024-12-07 | Webview behavior        | Replace mode           | Like markdown preview, simpler UX      |
| 2024-12-07 | Tree view navigation    | Name→code, Icon→viewer | Clear separation of concerns           |
| 2024-12-07 | Protocol                | WebSocket + REST       | Real-time updates + queries            |
| 2024-12-07 | Default port            |                  19275 | Unlikely to conflict                   |

---

## Epics

---

### Epic 1: Server Extraction & Shared Infrastructure

#### Context

**We already have a working server!** The `@livedoc/viewer` package contains a fully functional server with:
- REST API (Hono framework)
- WebSocket real-time events
- Persistent file storage
- Project/Environment hierarchy
- Run history management
- Full BDD schema support
- Non-BDD test suite support (TestSuite/Test)

The goal is to **extract** this server into a shared `@livedoc/server` package that both the Viewer and VS Code extension can consume. This is a refactoring exercise, not a rewrite.

#### Existing Viewer Server Features (Already Implemented)

|              Feature              |  Status   |                 Location                  |
| ---------                         | --------  | ----------                                |
| REST API (Hono)                   | ✅ Working | `packages/viewer/src/server/index.ts`     |
| WebSocket Manager                 | ✅ Working | `packages/viewer/src/server/websocket.ts` |
| RunStore (persistent)             | ✅ Working | `packages/viewer/src/server/store.ts`     |
| Unified Schema                    | ✅ Working | `packages/viewer/src/shared/schema.ts`    |
| Project/Environment grouping      | ✅ Working | Hierarchy API                             |
| Run history (50 per env)          | ✅ Working | File-based storage                        |
| BDD model (Feature/Scenario/Step) | ✅ Working | Full Gherkin support                      |
| Non-BDD model (TestSuite/Test)    | ✅ Defined | Schema ready, viewer not using yet        |
| Multiple frameworks               | ✅ Working | vitest, xunit, mocha, jest                |

#### Existing API Endpoints (from `@livedoc/viewer`)

|  Method  |                 Endpoint                  |           Description           |
| -------- | ----------                                | -------------                   |
| GET      | `/api/projects`                           | List all projects               |
| GET      | `/api/hierarchy`                          | Get project tree for navigation |
| GET      | `/api/runs`                               | List all runs                   |
| GET      | `/api/runs/:runId`                        | Get run details                 |
| DELETE   | `/api/runs/:runId`                        | Delete a run                    |
| GET      | `/api/projects/:project/:env/runs`        | List runs for project/env       |
| GET      | `/api/projects/:project/:env/latest`      | Get latest run                  |
| POST     | `/api/runs/start`                         | Start streaming run             |
| POST     | `/api/runs/:runId/features`               | Add feature                     |
| POST     | `/api/runs/:runId/scenarios`              | Add scenario                    |
| POST     | `/api/runs/:runId/steps`                  | Add step                        |
| POST     | `/api/runs/:runId/scenarios/:id/complete` | Complete scenario               |
| POST     | `/api/runs/:runId/complete`               | Complete run                    |
| POST     | `/api/runs`                               | Post complete run (batch)       |

#### Existing WebSocket Events

|        Event         |   Direction   |        Description         |
| -------              | -----------   | -------------              |
| `run:started`        | Server→Client | New run started            |
| `feature:added`      | Server→Client | Feature added              |
| `feature:updated`    | Server→Client | Feature status changed     |
| `scenario:started`   | Server→Client | Scenario execution started |
| `scenario:completed` | Server→Client | Scenario finished          |
| `step:started`       | Server→Client | Step started               |
| `step:completed`     | Server→Client | Step finished              |
| `run:completed`      | Server→Client | Run finished               |
| `run:deleted`        | Server→Client | Run was deleted            |
| `subscribe`          | Client→Server | Subscribe to updates       |
| `unsubscribe`        | Client→Server | Unsubscribe                |
| `ping`               | Client→Server | Keep-alive                 |

#### Goals
- Extract server code into `@livedoc/server` package
- Update `@livedoc/viewer` to consume `@livedoc/server`
- Enable VS Code extension to embed the same server
- Maintain 100% backward compatibility

#### Non-Goals (for this epic)
- Adding new features to the server
- Changing the API structure
- Authentication (existing is optional, keep it)

---

#### Story E1-S1: Extract server code into `@livedoc/server` package

**As a** monorepo maintainer  
**I want** server code in a dedicated shared package  
**So that** both Viewer and VS Code extension can use the same server

**Context:**
Move the existing server code from `packages/viewer/src/server/` and `packages/viewer/src/shared/` to a new `packages/server/` package. The Viewer will then depend on `@livedoc/server`.

**Acceptance Criteria:**
- [x] New package `packages/server/` with name `@livedoc/server`
- [x] Move files:
  - `viewer/src/server/index.ts` → `server/src/index.ts`
  - `viewer/src/server/store.ts` → `server/src/store.ts`
  - `viewer/src/server/websocket.ts` → `server/src/websocket.ts`
  - `viewer/src/shared/schema.ts` → `server/src/schema.ts`
- [x] Export public API:
  ```typescript
  export { startServer, ServerOptions } from './index';
  export { RunStore } from './store';
  export { WebSocketManager } from './websocket';
  export * from './schema';  // All types
  ```
- [x] Dependencies: `hono`, `ws`, `@hono/node-server`
- [x] Viewer updated to import from `@livedoc/server`
- [x] All existing Viewer functionality still works
- [x] `pnpm test` passes in viewer package

**Package Structure:**
```
packages/server/
├── src/
│   ├── index.ts           # Server factory & exports
│   ├── store.ts           # RunStore (persistent)
│   ├── websocket.ts       # WebSocketManager
│   ├── schema.ts          # Unified schema types
│   └── cli.ts             # Standalone CLI
├── package.json
├── tsconfig.json
└── README.md
```

**Effort:** Medium (2-3 days) - mostly moving code and fixing imports

---

#### Story E1-S2: Make server embeddable (library mode)

**As a** VS Code extension developer  
**I want** to embed the server in my extension process  
**So that** I don't need a separate server process

**Context:**
Currently the server starts with `startServer()` which binds to a port. We need an option to create the server without immediately listening, so the extension can control the lifecycle.

**Acceptance Criteria:**
- [x] New function: `createServer(options)` returns server instance without listening
- [x] Server instance has methods:
  - `listen(port?)` - Start listening
  - `close()` - Stop listening
  - `getPort()` - Get actual port (after listen)
  - `getStore()` - Access the RunStore directly
  - `getWebSocketManager()` - Access WebSocket manager
- [x] Can pass custom logger (for VS Code output channel)
- [x] Existing `startServer()` still works (calls createServer + listen)
- [x] Works in Node.js and VS Code extension host

**Implementation Notes:**
```typescript
// New embeddable API
export interface LiveDocServer {
  listen(port?: number): Promise<number>;  // Returns actual port
  close(): Promise<void>;
  getPort(): number | null;
  getStore(): RunStore;
  getWsManager(): WebSocketManager;
  app: Hono;  // For advanced use
}

export function createServer(options?: ServerOptions): LiveDocServer;
export async function startServer(options?: ServerOptions): Promise<LiveDocServer>;
```

**Effort:** Small (1 day)

---

#### Story E1-S3: Update Viewer to use `@livedoc/server`

**As a** Viewer user  
**I want** the Viewer to work exactly as before  
**So that** the extraction doesn't break anything

**Context:**
After extracting the server, update the Viewer package to import from `@livedoc/server` instead of its local files. This validates the extraction worked correctly.

**Acceptance Criteria:**
- [x] Viewer's `package.json` depends on `@livedoc/server: workspace:*`
- [x] All imports updated:
  - `from '../shared/schema'` → `from '@livedoc/server'`
  - `from './store'` → `from '@livedoc/server'`
  - etc.
- [x] Viewer's `src/server/` directory removed (or just contains thin wrapper)
- [x] `npm run dev` works in viewer
- [x] `npm run build` works in viewer
- [x] Can still post test results and see them in UI
- [x] WebSocket real-time updates still work

**Effort:** Small (1 day)

---

#### Story E1-S4: Add health check and port discovery

**As a** client (reporter or extension)  
**I want** to discover if/where the server is running  
**So that** I can connect to it automatically

**Context:**
When the reporter starts, it needs to know if a server is available. The server should write its port to a discoverable location.

**Acceptance Criteria:**
- [x] Health endpoint: `GET /api/health` → `{ status: "ok", port: 19275, version: "1.0" }`
- [x] Port file written on startup:
  - Windows: `%TEMP%/livedoc-server.json`
  - Mac/Linux: `/tmp/livedoc-server.json`
- [x] File contents: `{ "port": 19275, "pid": 12345, "started": "ISO date" }`
- [x] File deleted on clean shutdown
- [x] Stale file detection (check if PID is alive)
- [x] Helper function: `discoverServer()` → `{ url: string } | null`

**Implementation Notes:**
```typescript
// In @livedoc/server
export async function discoverServer(): Promise<{ url: string; port: number } | null> {
  const portFile = getPortFilePath();
  if (!fs.existsSync(portFile)) return null;
  
  const info = JSON.parse(fs.readFileSync(portFile, 'utf-8'));
  
  // Verify server is actually running
  try {
    const response = await fetch(`http://localhost:${info.port}/api/health`);
    if (response.ok) {
      return { url: `http://localhost:${info.port}`, port: info.port };
    }
  } catch {
    // Server not responding, delete stale file
    fs.unlinkSync(portFile);
  }
  
  return null;
}
```

**Effort:** Small (0.5 days)

---

#### Story E1-S5: Non-BDD test support (TestSuite/Test)

**As a** team migrating from non-BDD to BDD  
**I want** to see all my tests in LiveDoc  
**So that** I can gradually adopt BDD without losing visibility

**Context:**
The schema already defines `TestSuite` and `Test` interfaces for non-BDD tests. The Viewer UI doesn't render them yet, but the server should accept and store them.

**Current Schema Support:**
```typescript
// Already defined in schema.ts
export interface TestSuite {
  id: string;
  title: string;
  filename: string;
  status: TestStatus;
  duration: number;
  tests: Test[];
  suites: TestSuite[];  // Nested suites
  statistics: Statistics;
}

export interface Test {
  id: string;
  title: string;
  status: TestStatus;
  duration: number;
  error?: ErrorInfo;
}

// TestRun already has:
export interface TestRun {
  // ...
  features: Feature[];   // BDD tests
  suites: TestSuite[];   // Non-BDD tests
}
```

**Acceptance Criteria:**
- [ ] Server accepts `suites` in POST /api/runs
- [ ] Server accepts POST /api/runs/:runId/suites (streaming)
- [ ] Server accepts POST /api/runs/:runId/tests (streaming)
- [ ] Suites stored alongside features in runs
- [ ] WebSocket events for suites: `suite:added`, `test:completed`
- [ ] Mixed runs (some BDD, some non-BDD) work correctly
- [ ] Statistics include both BDD and non-BDD tests

**Effort:** Medium (2 days)

---
### Epic 2: Extension Integration

#### Context

The VS Code extension hosts the LiveDoc server and provides the developer UI. When VS Code starts, the server starts. The tree view displays results from the server. Live updates appear as tests run.

This epic connects the server (Epic 1) to the VS Code UI.

#### Goals
- Start/stop server with extension lifecycle
- Configure via VS Code settings
- Tree view reads from server API
- Live updates via WebSocket

#### Non-Goals (for this epic)
- Embedded Viewer (Epic 4)
- Remote server connection (Epic 5)

---

#### Story E2-S1: Start server on extension activation

**As a** developer  
**I want** the LiveDoc server to start when I open VS Code  
**So that** test results are captured without manual setup

**Context:**
The extension's `activate()` function should start the server. The server runs in the extension host process. It should be resilient to startup failures.

**Acceptance Criteria:**
- [x] Server starts in `activate()` function
- [x] Server starts asynchronously (don't block activation)
- [x] If server fails to start, log error but don't crash extension
- [x] Server stops in `deactivate()` function
- [x] If server already running (port file exists, same PID), reuse it
- [x] Output channel "LiveDoc Server" shows server logs

**Implementation Notes:**
```typescript
// src/extension.ts
import { createServer } from '@livedoc/server';

let server: LiveDocServer | null = null;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('LiveDoc Server');
  
  try {
    const port = vscode.workspace.getConfiguration('livedoc').get('server.port', 19275);
    server = await createServer({ port, logger: outputChannel });
    outputChannel.appendLine(`LiveDoc server started on port ${server.port}`);
  } catch (error) {
    outputChannel.appendLine(`Failed to start server: ${error.message}`);
    vscode.window.showWarningMessage('LiveDoc server failed to start. Some features may be unavailable.');
  }
  
  // ... rest of activation
}

export function deactivate() {
  server?.stop();
}
```

**Effort:** Small (1 day)

---

#### Story E2-S2: VS Code settings for configuration

**As a** developer  
**I want** to configure LiveDoc via VS Code settings  
**So that** I can customize behavior without editing files

**Context:**
Settings should follow VS Code conventions. They appear in Settings UI under "LiveDoc" section. Changes take effect on next activation (or immediately where possible).

**Acceptance Criteria:**
- [x] Settings defined in `package.json` under `contributes.configuration`
- [x] Settings UI shows "LiveDoc" category
- [x] Settings implemented:

|              Setting               |  Type   |  Default  |                Description                |
| ---------                          | ------  | --------- | -------------                             |
| `livedoc.server.enabled`           | boolean | true      | Enable/disable the LiveDoc server         |
| `livedoc.server.port`              | number  |     19275 | Port for the LiveDoc server               |
| `livedoc.server.autoStart`         | boolean | true      | Start server when VS Code opens           |
| `livedoc.server.mode`              | enum    | "local"   | "local" (embedded) or "remote" (external) |
| `livedoc.server.remoteUrl`         | string  | ""        | URL of remote LiveDoc server              |
| `livedoc.treeView.autoRefresh`     | boolean | true      | Auto-refresh tree when results change     |
| `livedoc.treeView.showPassedSteps` | boolean | true      | Show passed steps in tree                 |

- [x] Settings changes trigger re-configuration where appropriate
- [x] Invalid settings show validation errors

**Implementation Notes:**
```json
// package.json contributes section
{
  "contributes": {
    "configuration": {
      "title": "LiveDoc",
      "properties": {
        "livedoc.server.port": {
          "type": "number",
          "default": 19275,
          "description": "Port for the LiveDoc server",
          "minimum": 1024,
          "maximum": 65535
        },
        "livedoc.server.mode": {
          "type": "string",
          "default": "local",
          "enum": ["local", "remote"],
          "enumDescriptions": [
            "Run server embedded in VS Code",
            "Connect to external server"
          ]
        }
      }
    }
  }
}
```

**Effort:** Small (1 day)

---

#### Story E2-S3: Tree view reads from server API

**As a** developer  
**I want** the tree view to show results from the server  
**So that** I see the current state of my tests

**Context:**
Replace the current mock data loading with API calls to the local server. The tree view structure remains the same (Feature → Scenario → Step), but data comes from the REST API.

**Acceptance Criteria:**
- [x] Tree view fetches from `GET /api/v1/projects/{id}/features`
- [x] Project ID determined from current workspace path
- [x] Shows loading state while fetching
- [x] Shows empty state if no results
- [x] Shows error state if server unavailable
- [x] Refresh command (`livedoc.refresh`) re-fetches from API
- [x] Pass/fail icons still work (same as before)
- [x] Clicking feature/scenario name navigates to source file

**Implementation Notes:**
```typescript
// ExecutionResultOutlineProvider.ts
export class ExecutionResultOutlineProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private serverUrl: string;
  private projectId: string;
  
  constructor(workspacePath: string, serverPort: number) {
    this.serverUrl = `http://localhost:${serverPort}`;
    this.projectId = generateProjectId(workspacePath);
  }
  
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level - fetch features
      try {
        const response = await fetch(`${this.serverUrl}/api/v1/projects/${this.projectId}/features`);
        if (!response.ok) {
          return [new vscode.TreeItem('No test results yet')];
        }
        const features = await response.json();
        return features.map(f => new FeatureTreeViewItem(f));
      } catch (error) {
        return [new vscode.TreeItem('Server unavailable')];
      }
    }
    // ... handle children
  }
}
```

**Effort:** Medium (2 days)

---

#### Story E2-S4: Live updates via WebSocket

**As a** developer  
**I want** the tree view to update automatically as tests run  
**So that** I see real-time progress without manual refresh

**Context:**
The extension connects to the server's WebSocket and listens for events. When events arrive, it updates the tree view. This provides live feedback during test runs.

**Acceptance Criteria:**
- [ ] Extension connects to `ws://localhost:PORT/ws` on activation
- [ ] Reconnects automatically if connection lost (with backoff)
- [ ] Events handled:
  - `run:started` → Show "Running..." indicator
  - `feature:completed` → Update feature status/icon
  - `scenario:completed` → Update scenario status/icon
  - `step:completed` → Update step if visible
  - `run:completed` → Full refresh, remove "Running..." indicator
- [ ] Tree view updates without losing scroll position
- [ ] Status bar shows connection state (optional)

**Implementation Notes:**
```typescript
// WebSocketClient.ts
export class LiveDocWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  constructor(
    private url: string,
    private onEvent: (event: any) => void
  ) {}
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.on('open', () => {
      console.log('Connected to LiveDoc server');
    });
    
    this.ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      this.onEvent(event);
    });
    
    this.ws.on('close', () => {
      this.scheduleReconnect();
    });
  }
  
  private scheduleReconnect() {
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }
  
  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
  }
}
```

**Effort:** Medium (2 days)

---

#### Story E2-S5: Status bar indicator

**As a** developer  
**I want** to see the server status in the status bar  
**So that** I know if LiveDoc is running

**Context:**
A small status bar item shows server state. Clicking it opens the output channel or triggers an action.

**Acceptance Criteria:**
- [ ] Status bar item on the right side
- [ ] States displayed:
  - `$(check) LiveDoc` - Server running (green)
  - `$(sync~spin) LiveDoc` - Starting/connecting
  - `$(warning) LiveDoc` - Server not running (yellow)
  - `$(error) LiveDoc` - Server error (red)
- [ ] Tooltip shows details: "LiveDoc server running on port 19275"
- [ ] Click action: Show quick pick with options:
  - "Show Server Output"
  - "Restart Server"
  - "Open Settings"
- [ ] Updates when server state changes

**Implementation Notes:**
```typescript
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
statusBarItem.command = 'livedoc.showServerMenu';
statusBarItem.text = '$(check) LiveDoc';
statusBarItem.tooltip = 'LiveDoc server running on port 19275';
statusBarItem.show();
```

**Effort:** Small (0.5 days)

---

### Epic 3: Reporter Integration

#### Context

The LiveDoc reporter runs during test execution. It captures test structure and results, then sends them to the server. The reporter is the "source of truth" for what happened during tests.

**Important:** The Viewer already defines a `ReporterConfig` interface in `@livedoc/server/schema.ts`:
```typescript
export interface ReporterConfig {
  server?: string;          // Server URL, e.g., 'http://localhost:3000'
  project?: string;         // Auto-detected if not provided
  environment?: string;     // Defaults to 'local'
  mode?: 'live' | 'batch' | 'file';
  outputFile?: string;      // For file mode
  fallbackToFile?: boolean; // If server unavailable
  apiToken?: string;        // Optional auth
}
```

The server already has streaming API endpoints:
- `POST /api/runs/start` → Returns `{ runId, websocketUrl }`
- `POST /api/runs/:runId/features` → Add feature
- `POST /api/runs/:runId/scenarios` → Add scenario
- `POST /api/runs/:runId/steps` → Add step
- `POST /api/runs/:runId/complete` → Complete run

#### Goals
- Reporter uses `@livedoc/server` types and API
- Data sent to server in real-time (streaming)
- Graceful fallback if server unavailable
- Support all existing ReporterConfig options

---

#### Story E3-S1: Create LiveDocServerReporter

**As a** test framework  
**I want** a reporter that sends results to the server  
**So that** the VS Code extension can display them

**Context:**
The reporter uses the existing server API (already working in Viewer). We need to integrate this into the `@livedoc/vitest` reporter.

**Acceptance Criteria:**
- [x] Reporter class in `@livedoc/vitest` sends to server
- [x] Uses types from `@livedoc/server` (not duplicating)
- [x] Uses the EXISTING server API endpoints (not `/api/v1/`, just `/api/`)
- [x] Supports `ReporterConfig` options from server schema
- [x] Events sent using existing endpoints:
  - `POST /api/runs/start` at suite start
  - `POST /api/runs/:runId/features` when feature starts
  - `POST /api/runs/:runId/scenarios` when scenario starts
  - `POST /api/runs/:runId/steps` when step completes
  - `POST /api/runs/:runId/scenarios/:id/complete` when scenario completes
  - `POST /api/runs/:runId/complete` at suite end

**Implementation Notes:**
```typescript
// packages/livedoc-vitest/_src/app/reporters/LiveDocServerReporter.ts
import { ReporterConfig, StartRunRequest, PostFeatureRequest } from '@livedoc/server';

export class LiveDocServerReporter extends LiveDocReporter {
  private config: ReporterConfig;
  private runId: string | null = null;
  private available = true;
  
  constructor(config?: ReporterConfig) {
    super();
    this.config = {
      server: 'http://localhost:3000',  // Default Viewer port
      environment: 'local',
      mode: 'live',
      ...config
    };
  }
  
  async onRunStart(files: string[]): Promise<void> {
    if (!this.available) return;
    
    const request: StartRunRequest = {
      project: this.config.project || path.basename(process.cwd()),
      environment: this.config.environment || 'local',
      framework: 'vitest'
    };
    
    try {
      const response = await fetch(`${this.config.server}/api/runs/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (response.ok) {
        const { runId } = await response.json();
        this.runId = runId;
      }
    } catch {
      this.available = false;
    }
  }
}
```

**Effort:** Medium (2 days)

---

#### Story E3-S2: Streaming during test run

**As a** developer  
**I want** results to stream as tests run  
**So that** I see live progress in VS Code

**Context:**
Instead of waiting until the end to send all results, the reporter sends events as each test completes. This enables live updating of the tree view.

**Acceptance Criteria:**
- [ ] Events sent immediately when:
  - Feature starts (for "in progress" indicator)
  - Scenario completes (with pass/fail status)
  - Feature completes (with summary)
  - Run completes (with final statistics)
- [ ] Each event includes timestamp for ordering
- [ ] Use run ID to correlate events
- [ ] If a send fails, continue with next event (don't block tests)
- [ ] Maximum queue size of 100 events (drop oldest if exceeded)

**Implementation Notes:**
```typescript
// Event queue with async processing
class EventQueue {
  private queue: TestEvent[] = [];
  private processing = false;
  
  async enqueue(event: TestEvent): Promise<void> {
    this.queue.push(event);
    if (this.queue.length > 100) {
      this.queue.shift(); // Drop oldest
    }
    
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      try {
        await this.client.post('/api/v1/run/event', event);
      } catch {
        // Continue with next event
      }
    }
    this.processing = false;
  }
}
```

**Effort:** Medium (2 days)

---

#### Story E3-S3: Graceful fallback when no server

**As a** developer  
**I want** tests to run normally even if server is down  
**So that** I'm not blocked by infrastructure issues

**Context:**
If the server isn't running (most common case: VS Code not open), the reporter should silently skip sending events. Tests should complete at the same speed.

**Acceptance Criteria:**
- [x] Health check on reporter initialization
- [x] If server not available:
  - Log single info message: "[LiveDoc] Server not available, offline mode"
  - Skip all subsequent send attempts (no retry)
  - No errors or warnings
- [x] If server becomes unavailable mid-run:
  - Log once when first failure detected
  - Skip remaining sends
  - Don't fail the test run
- [x] Test execution time should not be affected (async sends)
- [x] Works correctly when running tests in CI (no server)

**Implementation Notes:**
```typescript
class LiveDocServerClient {
  private available: boolean | null = null;
  
  async checkAvailability(): Promise<boolean> {
    if (this.available !== null) return this.available;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      this.available = response.ok;
    } catch {
      this.available = false;
    }
    
    return this.available;
  }
  
  async post(endpoint: string, data: any): Promise<void> {
    if (this.available === false) return; // Fast path
    
    // ... send logic with error handling
  }
}
```

**Effort:** Small (1 day)

---

#### Story E3-S4: Configuration via vitest.config or environment

**As a** developer  
**I want** to configure the reporter connection  
**So that** I can use non-default server settings

**Context:**
While zero-config is the goal, advanced users may need to change the server URL. This should be possible without modifying vitest.config.

**Acceptance Criteria:**
- [ ] Environment variable: `LIVEDOC_SERVER_URL`
- [ ] Default: `http://localhost:19275`
- [ ] Reporter checks environment on startup
- [ ] Can also pass via reporter options in vitest.config:
  ```ts
  reporters: [
    ['@livedoc/vitest/reporter', { serverUrl: 'http://...' }]
  ]
  ```
- [ ] Environment variable takes precedence over config
- [ ] Port file discovery: Check `%TEMP%/livedoc-server.port` if env not set
- [ ] Documentation in README

**Implementation Notes:**
```typescript
function resolveServerUrl(options?: ReporterOptions): string {
  // Priority: ENV > options > port file > default
  
  if (process.env.LIVEDOC_SERVER_URL) {
    return process.env.LIVEDOC_SERVER_URL;
  }
  
  if (options?.serverUrl) {
    return options.serverUrl;
  }
  
  // Try to read port from discovery file
  const portFile = getPortFilePath();
  if (fs.existsSync(portFile)) {
    const info = JSON.parse(fs.readFileSync(portFile, 'utf-8'));
    return `http://localhost:${info.port}`;
  }
  
  return 'http://localhost:19275';
}
```

**Effort:** Small (1 day)

---

### Epic 4: Embedded Viewer

#### Context

The Viewer is a web application that renders test results as readable documentation. PMs and stakeholders use it to review specifications. This epic brings the Viewer experience into VS Code.

Two options exist:
1. **Embed the existing viewer** via iframe (reuse existing code)
2. **Rebuild with VS Code Webview Toolkit** (native look and feel)

For MVP, we'll embed the existing viewer. This is faster and ensures parity with the standalone viewer.

#### Goals
- Full viewer experience inside VS Code
- Click item in tree → opens in viewer
- Replace mode (like markdown preview)
- Deep linking to specific features/scenarios

#### Non-Goals (for this epic)
- Editing specs in the viewer
- Two-way sync (changes in viewer → code)

---

#### Story E4-S1: Build viewer for webview consumption

**As a** VS Code extension  
**I want** the Viewer built as bundled JS/CSS assets  
**So that** I can load it in a VS Code webview

**Context:**
> **VS Code Limitation:** Webviews are sandboxed iframes that can only render HTML content provided as a string via `webview.html`. There is no native React runtime—all React/JS code must be bundled and loaded via `<script>` tags. This is a platform constraint, not a design choice. All major VS Code extensions with React UIs (GitLens, GitHub PR, etc.) use this approach.

The Viewer is currently a Vite-based React application. For VS Code integration:
1. **Build step**: Vite compiles the React app into standard `index.js` and `index.css` assets
2. **Runtime**: The extension generates minimal HTML dynamically, injecting the correct `vscode-resource` URIs

This is the standard, clean approach—no static HTML files or "embedding" required.

**Acceptance Criteria:**
- [ ] Vite build config (`vite.config.webview.ts`) produces assets in `packages/viewer/dist/webview/`:
  - `index.js` - Bundled React application
  - `index.css` - Bundled styles
- [ ] **UI Stack**: React 19, Tailwind CSS 4, shadcn/ui
- [ ] **Design**: Polished, professional aesthetic
- [ ] Bundle size < 500KB (gzipped)
- [ ] Build handles VS Code webview CSP requirements (no inline scripts/styles)
- [ ] Viewer communicates with extension via VS Code messaging API:
  ```typescript
  // In viewer (React app)
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: 'navigate', featureId: '...' });
  
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'loadData') { /* update state */ }
  });
  ```
- [ ] NPM script: `pnpm run build:webview` produces the bundle
- [ ] Assets copied to extension's `dist/viewer/` during extension build

**Implementation Notes:**
```typescript
// packages/viewer/vite.config.webview.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Predictable names for extension to reference
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  define: {
    'import.meta.env.VITE_WEBVIEW_MODE': 'true'
  }
});
```

**Effort:** Medium (2 days)

---

#### Story E4-S2: Webview panel integration

**As a** developer  
**I want** to open the Viewer in a VS Code tab  
**So that** I can read documentation alongside code

**Context:**
VS Code webviews are panels that can display web content. The extension dynamically generates the HTML shell at runtime, injecting the correct resource URIs for the bundled React assets.

**Acceptance Criteria:**
- [ ] Command: `livedoc.openViewer` opens the viewer
- [ ] Viewer opens in editor area (not sidebar)
- [ ] Uses "replace" behavior:
  - First call opens new panel
  - Subsequent calls reuse existing panel (focus it)
  - Like markdown preview behavior
- [ ] Panel title: "LiveDoc: [Project Name]"
- [ ] Panel icon: LiveDoc logo
- [ ] Webview persists when switching tabs (retainContextWhenHidden)
- [ ] Proper cleanup on panel close
- [ ] HTML generated dynamically with proper CSP and resource URIs

**Implementation Notes:**
```typescript
// src/viewer/ViewerPanel.ts
export class ViewerPanel {
  private static instance: ViewerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  
  static show(extensionUri: vscode.Uri, serverPort: number): ViewerPanel {
    if (ViewerPanel.instance) {
      ViewerPanel.instance.panel.reveal();
      return ViewerPanel.instance;
    }
    
    const panel = vscode.window.createWebviewPanel(
      'livedocViewer',
      'LiveDoc Viewer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'viewer')
        ]
      }
    );
    
    ViewerPanel.instance = new ViewerPanel(panel, extensionUri, serverPort);
    return ViewerPanel.instance;
  }
  
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    serverPort: number
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtmlContent(extensionUri, serverPort);
    
    this.panel.onDidDispose(() => {
      ViewerPanel.instance = undefined;
    });
    
    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'ready':
          // Webview is ready, send initial data
          this.sendInitialData();
          break;
        case 'navigateToSource':
          // User clicked to navigate to source code
          this.openSourceFile(message.file, message.line);
          break;
      }
    });
  }
  
  /**
   * Generates the HTML shell dynamically.
   * This is the standard pattern for React-based VS Code webviews.
   */
  private getHtmlContent(extensionUri: vscode.Uri, serverPort: number): string {
    const webview = this.panel.webview;
    
    // Get URIs for the bundled assets
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'viewer', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'viewer', 'index.css')
    );
    
    // Generate nonce for CSP
    const nonce = this.getNonce();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    connect-src http://localhost:${serverPort} ws://localhost:${serverPort};
    font-src ${webview.cspSource};
    img-src ${webview.cspSource} data:;
  ">
  <link rel="stylesheet" href="${styleUri}">
  <title>LiveDoc Viewer</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.livedocConfig = {
      serverPort: ${serverPort},
      vscode: acquireVsCodeApi()
    };
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
  
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
  
  navigateTo(featureId: string, scenarioId?: string): void {
    this.panel.webview.postMessage({
      type: 'navigate',
      featureId,
      scenarioId
    });
  }
}
```

**Effort:** Medium (2 days)

---

#### Story E4-S3: View button in tree

**As a** developer  
**I want** a button in the tree to open items in the viewer  
**So that** I can quickly view rendered documentation

**Context:**
Each tree item (feature, scenario) should have an inline action button that opens that item in the viewer. Clicking the item name still navigates to code.

**Acceptance Criteria:**
- [ ] Inline action on Feature tree items: "Open in Viewer" (eye icon)
- [ ] Inline action on Scenario tree items: "Open in Viewer" (eye icon)
- [ ] Clicking action opens viewer panel at that item
- [ ] If viewer already open, navigates to item and focuses viewer
- [ ] Tooltip on icon: "View as documentation"
- [ ] Works via command: `livedoc.viewItem` with item ID

**Implementation Notes:**
```typescript
// Tree item with inline action
class FeatureTreeViewItem extends vscode.TreeItem {
  constructor(feature: Feature) {
    super(feature.title, vscode.TreeItemCollapsibleState.Collapsed);
    
    // Click name → go to code
    this.command = {
      command: 'livedoc.goToSource',
      title: 'Go to Source',
      arguments: [feature.source]
    };
  }
}

// package.json menus contribution
{
  "menus": {
    "view/item/context": [
      {
        "command": "livedoc.viewItem",
        "when": "viewItem == livedocFeature || viewItem == livedocScenario",
        "group": "inline"
      }
    ]
  }
}
```

**Effort:** Small (1 day)

---

#### Story E4-S4: Replace mode behavior

**As a** developer  
**I want** the viewer to replace itself when opening new items  
**So that** I don't have many viewer tabs cluttering my workspace

**Context:**
Unlike typical editors that open new tabs, the viewer should reuse a single panel. This matches markdown preview behavior and keeps the workspace clean.

**Acceptance Criteria:**
- [ ] Only one viewer panel exists at a time
- [ ] Opening new item updates existing panel
- [ ] Panel focuses when updated (but doesn't steal focus if user is typing)
- [ ] "Pin" option could be added later (but not in MVP)
- [ ] Viewer remembers scroll position per feature

**Implementation Notes:**
```typescript
// Singleton pattern in ViewerPanel ensures single instance
// navigateTo() method updates content without opening new panel

public navigateTo(featureId: string, scenarioId?: string): void {
  this.panel.webview.postMessage({
    type: 'navigate',
    featureId,
    scenarioId
  });
  
  // Focus panel only if it's not already visible
  if (!this.panel.visible) {
    this.panel.reveal(vscode.ViewColumn.One, false); // false = don't take focus
  }
}
```

**Effort:** Small (0.5 days)

---

#### Story E4-S5: Deep linking from tree to viewer

**As a** developer  
**I want** to click a scenario in the tree and see it in the viewer  
**So that** I can quickly find and read specific documentation

**Context:**
When opening the viewer for a specific scenario, the viewer should scroll to that scenario and potentially highlight it.

**Acceptance Criteria:**
- [ ] Open at feature level → shows full feature with all scenarios
- [ ] Open at scenario level → scrolls to that scenario
- [ ] Open at step level → scrolls to containing scenario, highlights step
- [ ] Viewer receives navigation message with:
  - `featureId` (required)
  - `scenarioId` (optional)
  - `stepId` (optional)
- [ ] Smooth scroll animation
- [ ] Highlight fades after 2 seconds
- [ ] URL fragment updates (for potential bookmarking)

**Implementation Notes:**
```typescript
// Viewer-side message handler
window.addEventListener('message', (event) => {
  const message = event.data;
  
  if (message.type === 'navigate') {
    const { featureId, scenarioId, stepId } = message;
    
    // Find element
    const elementId = stepId || scenarioId || featureId;
    const element = document.getElementById(elementId);
    
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element.classList.add('highlight');
      setTimeout(() => element.classList.remove('highlight'), 2000);
    }
  }
});
```

**Effort:** Medium (2 days)

---

### Epic 5: Production Server

#### Context

For team collaboration, results need to persist beyond a single development session and be accessible by non-developers (PMs, stakeholders). This epic enables a hosted server that aggregates results from multiple developers and CI runs.

#### Goals
- Server can run standalone (outside VS Code)
- Persist results to database
- Support authentication
- Aggregate CI and developer results

#### Non-Goals (for this epic)
- User management UI
- Historical trends/analytics
- Slack/email notifications

---

#### Story E5-S1: Local vs Remote mode toggle

**As a** developer  
**I want** to switch between local and remote server  
**So that** I can work offline or contribute to team results

**Context:**
VS Code extension should support two modes:
- **Local:** Runs embedded server (current behavior)
- **Remote:** Connects to team server (doesn't start embedded)

**Acceptance Criteria:**
- [ ] Setting: `livedoc.server.mode` with values `"local"` | `"remote"`
- [ ] Setting: `livedoc.server.remoteUrl` for remote server URL
- [ ] When `mode = "local"`:
  - Start embedded server on activation
  - Tree view fetches from localhost
  - Status bar shows "LiveDoc (local)"
- [ ] When `mode = "remote"`:
  - Do NOT start embedded server
  - Tree view fetches from `remoteUrl`
  - Status bar shows "LiveDoc (team-server.com)"
- [ ] Mode can be changed without restarting VS Code
- [ ] Reporter also respects the mode setting

**Implementation Notes:**
```typescript
// src/configuration.ts
export function getServerConfig(): ServerConfig {
  const config = vscode.workspace.getConfiguration('livedoc.server');
  const mode = config.get<'local' | 'remote'>('mode', 'local');
  
  if (mode === 'remote') {
    return {
      mode: 'remote',
      url: config.get<string>('remoteUrl', ''),
      startServer: false
    };
  }
  
  return {
    mode: 'local',
    url: `http://localhost:${config.get<number>('port', 19275)}`,
    startServer: true
  };
}
```

**Effort:** Small (1 day)

---

#### Story E5-S2: API key authentication

**As a** team administrator  
**I want** to require API keys for server access  
**So that** only authorized clients can submit or view results

**Context:**
Remote servers should be protected. Each team member (or CI system) gets an API key. API keys are passed in the `Authorization` header.

**Acceptance Criteria:**
- [ ] Server supports `LIVEDOC_API_KEY` environment variable
- [ ] If set, all endpoints require `Authorization: Bearer <key>` header
- [ ] If not set, server operates without authentication (local dev)
- [ ] Reporter sends API key from environment or config
- [ ] Extension stores API key in VS Code secure storage
- [ ] Setting: `livedoc.server.apiKey` (encrypted in settings sync)
- [ ] Unauthorized requests return 401 with clear message
- [ ] Rate limiting: 1000 requests/minute per key (optional)

**Implementation Notes:**
```typescript
// src/api/middleware/auth.ts
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const requiredKey = process.env.LIVEDOC_API_KEY;
  
  // If no key configured, allow all requests (local mode)
  if (!requiredKey) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const providedKey = authHeader.slice(7);
  if (providedKey !== requiredKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}
```

**Effort:** Medium (2 days)

---

#### Story E5-S3: CI reporter mode

**As a** CI pipeline  
**I want** to submit test results to the server  
**So that** team members can see CI test results

**Context:**
In CI, there's no VS Code. The reporter runs directly from Vitest and POSTs to the remote server. The server must accept results from any project.

**Acceptance Criteria:**
- [ ] Reporter works in headless environment (no VS Code)
- [ ] Project ID derived from CI environment variables:
  - `CI_PROJECT_NAME` or `GITHUB_REPOSITORY`
  - Falls back to `cwd` basename
- [ ] Run metadata includes:
  - CI system name (GitHub Actions, GitLab CI, etc.)
  - Branch name
  - Commit SHA
  - PR number (if applicable)
  - Build URL
- [ ] Server stores CI runs separately from local runs
- [ ] Results marked as `source: "ci"` vs `source: "local"`

**Implementation Notes:**
```typescript
// packages/livedoc-vitest/_src/app/reporters/ciMetadata.ts
export function getCIMetadata(): CIMetadata | null {
  // GitHub Actions
  if (process.env.GITHUB_ACTIONS) {
    return {
      ci: 'github-actions',
      branch: process.env.GITHUB_REF_NAME,
      commit: process.env.GITHUB_SHA,
      prNumber: process.env.GITHUB_EVENT_NUMBER,
      buildUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      project: process.env.GITHUB_REPOSITORY
    };
  }
  
  // GitLab CI
  if (process.env.GITLAB_CI) {
    return {
      ci: 'gitlab-ci',
      branch: process.env.CI_COMMIT_REF_NAME,
      commit: process.env.CI_COMMIT_SHA,
      prNumber: process.env.CI_MERGE_REQUEST_IID,
      buildUrl: process.env.CI_JOB_URL,
      project: process.env.CI_PROJECT_PATH
    };
  }
  
  // Azure DevOps
  if (process.env.TF_BUILD) {
    return {
      ci: 'azure-devops',
      branch: process.env.BUILD_SOURCEBRANCHNAME,
      commit: process.env.BUILD_SOURCEVERSION,
      buildUrl: process.env.BUILD_BUILDURI,
      project: process.env.BUILD_REPOSITORY_NAME
    };
  }
  
  return null;
}
```

**Effort:** Medium (2 days)

---

#### Story E5-S4: Persistence layer

**As a** server  
**I want** to persist results to disk or database  
**So that** results survive server restarts

**Context:**
For production use, in-memory storage isn't sufficient. Results should persist. Start with SQLite for simplicity, with option to add PostgreSQL later.

**Acceptance Criteria:**
- [ ] Storage interface abstracts persistence:
  ```typescript
  interface ResultsStorage {
    saveRun(run: TestRun): Promise<void>;
    getRun(id: string): Promise<TestRun | null>;
    getRunsForProject(projectId: string): Promise<TestRun[]>;
    // ... etc
  }
  ```
- [ ] Two implementations:
  - `InMemoryStorage` (default, for local dev)
  - `SqliteStorage` (for production)
- [ ] Environment variable: `LIVEDOC_STORAGE=sqlite`
- [ ] SQLite file location: `LIVEDOC_DATA_DIR` or `./livedoc-data/`
- [ ] Schema migrations with version tracking
- [ ] Keep last 100 runs per project (configurable)
- [ ] Cleanup job for old data

**Implementation Notes:**
```typescript
// src/store/StorageFactory.ts
export function createStorage(): ResultsStorage {
  const storageType = process.env.LIVEDOC_STORAGE || 'memory';
  
  switch (storageType) {
    case 'sqlite':
      const dataDir = process.env.LIVEDOC_DATA_DIR || './livedoc-data';
      return new SqliteStorage(path.join(dataDir, 'livedoc.db'));
    
    case 'memory':
    default:
      return new InMemoryStorage();
  }
}

// SQLite schema
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    last_activity INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    source TEXT NOT NULL, -- 'local' or 'ci'
    status TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    metadata TEXT, -- JSON for CI info
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
  
  CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    data TEXT NOT NULL, -- JSON blob
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );
  
  CREATE INDEX idx_runs_project ON runs(project_id);
  CREATE INDEX idx_features_run ON features(run_id);
`;
```

**Effort:** Large (3-4 days)

---

## Technical Notes

### Existing Viewer Server (to be extracted to `@livedoc/server`)

The server already exists in `packages/viewer/src/server/` with this structure:
```
packages/viewer/src/
├── server/
│   ├── index.ts        # Hono app, REST endpoints
│   ├── store.ts        # RunStore with file persistence
│   └── websocket.ts    # WebSocketManager
└── shared/
    └── schema.ts       # Unified types (Feature, Scenario, Step, TestRun, etc.)
```

After extraction, the structure will be:
```
packages/server/
├── src/
│   ├── index.ts        # Server factory + exports
│   ├── store.ts        # RunStore (from viewer)
│   ├── websocket.ts    # WebSocketManager (from viewer)
│   ├── schema.ts       # Unified types (from viewer)
│   └── cli.ts          # Standalone CLI entry
├── package.json
└── tsconfig.json
```

### Existing API (from `@livedoc/viewer`)

The viewer already uses port 3000 by default. We should align the default port across all components.

|     Component     |  Current Default  |  Recommendation  |
| ----------------  | ----------------- | ---------------- |
| Viewer standalone |              3000 | Keep             |
| VS Code embedded  | 19275 (proposed)  | Use 3000         |
| Reporter          | Discover via file | Discover or 3000 |

### Unified Schema Types (already defined)

All types are in `packages/viewer/src/shared/schema.ts`:
- `TestRun`, `Feature`, `Scenario`, `Step` - BDD model
- `TestSuite`, `Test` - Non-BDD model  
- `Statistics`, `ErrorInfo`, `RuleViolation` - Supporting types
- `StartRunRequest`, `PostFeatureRequest`, etc. - API types
- `WebSocketEvent`, `WebSocketClientMessage` - Real-time types
- `ReporterConfig`, `ServerConfig` - Configuration types

### WebSocket Events (already implemented)

From server to clients:
- `run:started`, `run:completed`, `run:deleted`
- `feature:added`, `feature:updated`
- `scenario:started`, `scenario:completed`
- `step:started`, `step:completed`

From clients to server:
- `subscribe` (filter by runId, project, environment)
- `unsubscribe`
- `ping` (keep-alive)

### VS Code Settings Schema
```json
{
  "livedoc.server.port": {
    "type": "number",
    "default": 19275,
    "description": "Port for LiveDoc server"
  },
  "livedoc.server.autoStart": {
    "type": "boolean", 
    "default": true,
    "description": "Start server when extension activates"
  },
  "livedoc.server.mode": {
    "type": "string",
    "enum": ["local", "remote"],
    "default": "local",
    "description": "Use local embedded server or connect to remote"
  },
  "livedoc.server.remoteUrl": {
    "type": "string",
    "default": "",
    "description": "URL of remote LiveDoc server"
  }
}
```

### WebSocket Events
```typescript
// From Reporter → Server
interface TestEvent {
  type: 'test:start' | 'test:pass' | 'test:fail' | 'test:skip';
  projectId: string;
  featureId: string;
  scenarioId?: string;
  stepId?: string;
  timestamp: number;
  duration?: number;
  error?: { message: string; stack?: string };
}

// From Server → Clients (Extension, Viewer)
interface UpdateEvent {
  type: 'results:updated' | 'run:started' | 'run:complete';
  projectId: string;
  data: any;
}
```

---

## Open Questions

|  #  |                      Question                       |                    Options                    |      Decision       |                    Notes                    |
| --- | ----------                                          | ---------                                     | ----------          | -------                                     |
|   1 | Should server persist between VS Code restarts?     | Yes (background service) / No (per-session)   | Per-session         | Simplicity; prod server handles persistence |
|   2 | How to handle multiple VS Code windows?             | Shared server / Separate per window           | Shared              | One server, multiple projects (E1-S5)       |
|   3 | Viewer in VS Code: iframe or rebuild?               | Embed existing / Rebuild with VS Code toolkit | Embed first         | MVP speed; can rebuild later                |
|   4 | How to identify projects?                           | Hash of path / User-defined name              | Hash + display name | Auto-discovery with readable names          |
|   5 | Should tree view show all projects or just current? | All / Current only / Setting                  | Current + switch    | Dropdown to select project                  |
|   6 | WebSocket library for browser?                      | Native WebSocket / Socket.io                  | Native WebSocket    | Fewer dependencies                          |
|   7 | Should we support Mocha or just Vitest?             | Both / Vitest only                            | Vitest only (MVP)   | Can add Mocha adapter later                 |

---

## Definition of Done

### Per Story
- [ ] Implementation complete and working
- [ ] Tests written in **LiveDoc BDD format** (feature/scenario/given-when-then)
- [ ] All tests passing
- [ ] Code reviewed (if applicable)
- [ ] Documentation updated (README, JSDoc)
- [ ] No regressions in existing tests

### Per Epic
- [ ] All stories in epic completed
- [ ] Integration test with real test run
- [ ] Works on Windows, Mac, Linux
- [ ] Performance acceptable (no noticeable lag)
- [ ] Error handling covers edge cases

### For Release
- [ ] All Epics 1-3 complete (MVP)
- [ ] Extension installable from VSIX
- [ ] README with getting started guide
- [ ] Changelog updated
- [ ] Version bumped appropriately

---

## Testing Approach

**We eat our own dog food.** All tests for `@livedoc/server` and related packages must use the LiveDoc BDD format.

### Test Location
- `packages/server/_src/test/` - Server tests
- `packages/vscode/src/test/` - Extension tests (where applicable)

### Test Format Example
```typescript
feature(`Server API`, () => {
  scenario(`Starting a new test run`, () => {
    given("the server is running on port '3000'", () => { ... });
    when("I post a start run request for project 'MyProject'", () => { ... });
    then("the response status should be '200'", () => { ... });
    and("the response body should contain runId", () => { ... });
  });
});
```

### Test Categories by Epic

|      Epic      |            Test Focus             |                           Example Scenarios                            |
| ------         | ------------                      | -------------------                                                    |
| E1: Server     | API contracts, store operations   | "Adding a feature to a run", "WebSocket broadcasts on completion"      |
| E2: Extension  | Server lifecycle, settings        | "Server starts on activation", "Settings change restarts server"       |
| E3: Reporter   | HTTP client, fallback behavior    | "Reporter detects server availability", "Silent fallback when offline" |
| E4: Viewer     | Webview communication, navigation | "Opening viewer for a feature", "Deep link scrolls to scenario"        |
| E5: Production | Auth, CI metadata                 | "API key required for remote", "CI metadata extracted from env"        |

*Detailed test specifications will be created as part of each story implementation.*

---

## Effort Estimation Key

|       Size       |   Time    |                Description                 |
| ------           | ------    | -------------                              |
| S (Small)        | 0.5-1 day | Well-understood, limited scope             |
| M (Medium)       | 2-3 days  | Some complexity, may need design decisions |
| L (Large)        | 4-5 days  | Significant work, multiple components      |
| XL (Extra Large) | 1-2 weeks | Major feature, consider breaking down      |

---

## Suggested Implementation Order

### Phase 1: Server Extraction & Foundation (Mostly Complete)
1. **E1-S1:** Extract server code into `@livedoc/server` package (✅ Done)
2. **E1-S3:** Update Viewer to use `@livedoc/server` (✅ Done)
3. **E1-S2:** Make server embeddable (library mode) (✅ Done)
4. **E1-S4:** Add health check and port discovery (✅ Done)
5. **E2-S1:** Start server on extension activation (✅ Done)
6. **E2-S2:** VS Code settings for configuration (✅ Done)
7. **E3-S1:** Create LiveDocServerReporter (uses existing API) (✅ Done)
8. **E3-S3:** Graceful fallback when no server (✅ Done)
9. **E2-S3:** Tree view reads from server API (✅ Done)
10. **E2-S4:** Live updates via WebSocket (✅ Done)

**Outcome:** Running tests populates tree view in real-time. Viewer continues working.

### Phase 2: Viewer Integration
11. **E4-S1:** Build viewer as embeddable bundle (✅ Done)
12. **E4-S2:** Webview panel integration (✅ Done)
13. **E4-S3:** View button in tree (✅ Done)
14. **E4-S4:** Replace mode behavior (✅ Done)
15. **E4-S5:** Deep linking from tree to viewer (✅ Done)

**Outcome:** Full documentation viewer inside VS Code

### Phase 3: Non-BDD & Team Features
16. **E1-S5:** Non-BDD test support (TestSuite/Test)
17. **E5-S1:** Local vs Remote mode toggle (✅ Done)
18. **E5-S2:** API key authentication
19. **E5-S3:** CI reporter mode
20. **E5-S4:** Persistence layer (already exists in Viewer!)

**Outcome:** Team server with CI integration, supports all test types

### Polish & Enhancement (ongoing)
- **E2-S5:** Status bar indicator
- **E3-S2:** Streaming during test run
- **E3-S4:** Configuration via vitest.config

---

## Execution Plan

This backlog serves as the primary execution plan. The "Suggested Implementation Order" section above outlines the sequence of work.

- **Tracking:** Use the checkboxes `[ ]` vs `[x]` in this document to track progress.
- **Updates:** Update this document as stories are completed.
- **Next Up:** Focus on **Phase 3 (Non-BDD & Team Features)**.

## Changelog

| Date       | Change                                                                         |
| ------     | --------                                                                       |
| 2025-12-07 | Initial backlog created from design discussion                                 |
| 2025-12-07 | Updated Epic 1 to extract from existing Viewer server (not build from scratch) |
| 2025-12-07 | Added existing API/schema documentation from Viewer BRD                        |
| 2025-12-07 | Added non-BDD test support requirements (TestSuite/Test)                       |
| 2025-12-07 | Added Testing Approach section - all tests must use LiveDoc BDD format         |
