<div align="center">

# @swedevtools/livedoc-viewer

### Real-time BDD test results visualization

[![npm version](https://img.shields.io/npm/v/@swedevtools/livedoc-viewer.svg)](https://www.npmjs.com/package/@swedevtools/livedoc-viewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**See your test results as they run. Beautiful, real-time, in your browser.**

</div>

---

## Quick Start

```bash
# Install globally
npm install -g @swedevtools/livedoc-viewer

# Start the viewer (opens browser automatically)
livedoc-viewer
```

That's it! The viewer is now running at `http://localhost:3100`.

---

## What is LiveDoc Viewer?

LiveDoc Viewer is a web-based dashboard for visualizing BDD test results from various testing frameworks. It provides:

- **Real-time updates** — Watch tests pass/fail as they run
- **Beautiful UI** — Clean, modern interface with collapsible features and scenarios
- **Failure details** — Stack traces, error messages, and step-by-step debugging
- **Run history** — Compare current runs with previous ones
- **Project organization** — Group results by project and environment

### Supported Frameworks

| Framework | Language | Integration Guide |
|-----------|----------|-------------------|
| [@swedevtools/livedoc-vitest](../vitest/README.md) | TypeScript/JavaScript | [Vitest Integration](../vitest/docs/reporting.md#livedoc-viewer-integration) |
| [LiveDoc.xUnit](../../dotnet/xunit/README.md) | C# / .NET | [xUnit Integration](../../dotnet/xunit/README.md#livedoc-viewer-integration) |

---

## CLI Options

```bash
livedoc-viewer [options]
```

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--port <port>` | `-p` | `3100` | Port to run server on |
| `--host <host>` | `-H` | `localhost` | Host to bind to |
| `--no-open` | — | (opens) | Don't open browser automatically |
| `--version` | `-V` | — | Show version number |
| `--help` | `-h` | — | Display help |

### Examples

```bash
# Default: opens browser on port 3100
livedoc-viewer

# Custom port
livedoc-viewer --port 8080

# Don't auto-open browser (for CI/scripts)
livedoc-viewer --no-open

# Bind to all interfaces (for remote access)
livedoc-viewer --host 0.0.0.0

# Combine options
livedoc-viewer -p 3200 --no-open --host 0.0.0.0
```

---

## API Endpoints

The viewer exposes a REST API for programmatic access:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/projects` | List all projects |
| GET | `/api/hierarchy` | Get project/environment tree |
| GET | `/api/runs` | List all runs |
| GET | `/api/runs/:runId` | Get run details |
| DELETE | `/api/runs/:runId` | Delete a run |
| POST | `/api/runs` | Post complete run (batch) |
| POST | `/api/runs/start` | Start streaming run |

### WebSocket

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3100/ws');
ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data);
  // type: 'run:started', 'scenario:completed', 'step:completed', etc.
};
```

---

## Data Storage

Test results are stored locally in `.livedoc/data` within your project directory. Each run is saved as a JSON file, enabling:

- **Persistent history** — Results survive server restarts
- **Comparison** — Compare current run with previous runs
- **Export** — JSON files can be processed by other tools

---

## Troubleshooting

### Port already in use

```bash
❌ Port 3100 is already in use.
   Try a different port: livedoc-viewer --port 3200
```

**Solutions:**
1. Use a different port: `livedoc-viewer --port 3200`
2. Find and stop the process using port 3100
3. On Windows: `netstat -ano | findstr :3100` then `taskkill /PID <pid> /F`

### Viewer not receiving results

1. **Check the viewer is running**: Visit `http://localhost:3100/api/health`
2. **Check reporter configuration**: See framework-specific integration guides above
3. **Check the port matches**: Viewer and reporter must use the same port

### Results not updating in real-time

- Ensure you're using WebSocket-enabled browser (all modern browsers)
- Check browser console for WebSocket connection errors
- Try refreshing the page

---

## Related Packages

| Package | Description |
|---------|-------------|
| [@swedevtools/livedoc-vitest](../vitest/README.md) | Gherkin BDD syntax for Vitest |
| [@swedevtools/livedoc-server](../server/README.md) | Core server infrastructure |
| [livedoc-vscode](../vscode/README.md) | VS Code extension with snippets |
| [LiveDoc.xUnit](../../dotnet/xunit/README.md) | BDD syntax for xUnit (.NET) |

---

## License

MIT

---

<div align="center">

Created by Garry McGlennon

**[📖 Documentation](https://github.com/dotnetprofessional/LiveDoc)** · **[🐛 Report a Bug](https://github.com/dotnetprofessional/LiveDoc/issues)** · **[💡 Request a Feature](https://github.com/dotnetprofessional/LiveDoc/issues)**

</div>
