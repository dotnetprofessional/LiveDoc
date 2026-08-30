# @swedevtools/livedoc-server

Shared server infrastructure for the LiveDoc ecosystem. This package provides the core server functionality used by both the LiveDoc Viewer and VS Code extension.

> **Distribution:** This is a private workspace package embedded in
> `@swedevtools/livedoc-viewer`. It is not published to npm or supported as an
> independent installation.

## Features

- **REST API** for test run management (Hono framework)
- **WebSocket** real-time event streaming
- **Persistent storage** with file-based run history
- **Full/partial composition** with physical and combined historical projections
- **Coverage attachment** with durable persistence and live notification
- **BDD schema** types (Feature, Scenario, Step)
- **Non-BDD support** (TestSuite, Test)

## Workspace Usage

### Embedded Mode (Library)

```typescript
import { createServer } from '@swedevtools/livedoc-server';

// Create server instance
const server = createServer({
  port: 3000,
  host: 'localhost',
  dataDir: '.livedoc/data'
});

// Start listening
await server.listen();
console.log(`Server running on port ${server.getPort()}`);

// Later, gracefully shutdown
await server.close();
```

### Using Types

```typescript
import type { 
  TestRun, 
  Feature, 
  Scenario, 
  Step,
  ReporterConfig 
} from '@swedevtools/livedoc-server';

// Or import from schema subpath
import type { TestRun } from '@swedevtools/livedoc-server/schema';
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/hierarchy` | Get project/env tree |
| GET | `/api/runs` | List all runs |
| GET | `/api/runs/:runId` | Get run details |
| DELETE | `/api/runs/:runId` | Delete a run |
| GET | `/api/projects/:project/:env/runs` | List runs for project/env |
| GET | `/api/projects/:project/:env/latest` | Get latest run |
| POST | `/api/runs/start` | Start a streaming run |
| POST | `/api/runs/:runId/features` | Add feature |
| POST | `/api/runs/:runId/scenarios` | Add scenario |
| POST | `/api/runs/:runId/steps` | Add step |
| POST | `/api/runs/:runId/scenarios/:id/complete` | Complete scenario |
| POST | `/api/runs/:runId/complete` | Complete run |
| POST | `/api/runs` | Post complete run (batch) |
| GET | `/api/health` | Health check |

The current v1 API also exposes `POST /api/v1/runs/:runId/coverage` for
post-run coverage attachments and `GET /api/v1/runs/:runId?view=physical|combined`
for exact invocation or composed history.

### Full and partial v1 runs

`POST /api/v1/runs/start` accepts `runType: "full" | "partial"`; omission means full. A partial requires a completed full baseline for the same project, environment, and framework. The server stores each completed invocation as raw history, then composes partial updates by stable test ID.

```json
{
  "project": "checkout",
  "environment": "local",
  "framework": "vitest",
  "runType": "partial"
}
```

Use `GET /api/v1/runs/:runId?view=combined` for the baseline plus partial updates through that run, or `view=physical` for only that invocation. `/api/v1/projects/:project/:environment/latest` always returns the latest completed combined snapshot, so an active focused run never clears the current documentation picture.

## WebSocket Events

Connect to `/ws` for real-time updates:

| Event | Direction | Description |
|-------|-----------|-------------|
| `run:started` | Server→Client | New run started |
| `feature:added` | Server→Client | Feature added |
| `scenario:started` | Server→Client | Scenario started |
| `scenario:completed` | Server→Client | Scenario finished |
| `step:completed` | Server→Client | Step finished |
| `run:completed` | Server→Client | Run finished |
| `run:deleted` | Server→Client | Run deleted |
| `subscribe` | Client→Server | Subscribe to updates |
| `unsubscribe` | Client→Server | Unsubscribe |
| `ping` | Client→Server | Keep-alive |

## License

MIT
