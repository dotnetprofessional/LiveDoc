<div align="center">

# @swedevtools/livedoc-viewer

### Real-time BDD test results visualization

[![npm version](https://img.shields.io/npm/v/@swedevtools/livedoc-viewer.svg)](https://www.npmjs.com/package/@swedevtools/livedoc-viewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**See your test results as they run. Beautiful, real-time, in your browser.**

📖 **[Full Documentation →](https://livedoc.swedevtools.com/viewer/learn/getting-started)**

</div>

---

## Quick Start

```bash
# Install globally
npm install -g @swedevtools/livedoc-viewer

# Start the viewer (opens browser automatically)
livedoc-viewer
```

The viewer runs at `http://localhost:3100`. Run your tests in another terminal and results appear in real-time.

### CLI Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--port <port>` | `-p` | `3100` | Port to run server on |
| `--host <host>` | `-H` | `localhost` | Host to bind to |
| `--no-open` | — | (opens) | Don't open browser automatically |

---

## What is LiveDoc Viewer?

A web-based dashboard for visualizing BDD test results with real-time updates, failure details, run history, and project organization. Works with [@swedevtools/livedoc-vitest](https://www.npmjs.com/package/@swedevtools/livedoc-vitest) (TypeScript) and [SweDevTools.LiveDoc.xUnit](https://www.nuget.org/packages/SweDevTools.LiveDoc.xUnit) (.NET).

---

## Documentation

📖 **[Full documentation at livedoc.swedevtools.com →](https://livedoc.swedevtools.com/viewer/learn/getting-started)**

Covers UI walkthrough, CLI options, REST API, WebSocket API, CI/CD dashboards, and multi-project setup.

---

## License

MIT
