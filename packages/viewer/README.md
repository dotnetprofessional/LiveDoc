<div align="center">

# @swedevtools/livedoc-viewer

**Real-time BDD test results in your browser.**

[![npm version](https://img.shields.io/npm/v/@swedevtools/livedoc-viewer.svg)](https://www.npmjs.com/package/@swedevtools/livedoc-viewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

📖 [Documentation](https://livedoc.swedevtools.com/viewer/learn/getting-started) · [GitHub](https://github.com/dotnetprofessional/LiveDoc)

</div>

---

## What It Does

LiveDoc Viewer is a web-based dashboard that visualizes BDD test results as they run. Start the viewer, run your tests, and watch features, scenarios, and steps stream into the browser in real time.

- **Live updates** — results appear via WebSocket as each scenario completes
- **Failure details** — click any failed step to see the error and stack trace
- **Multi-framework** — works with [@swedevtools/livedoc-vitest](https://www.npmjs.com/package/@swedevtools/livedoc-vitest) (TypeScript) and [SweDevTools.LiveDoc.xUnit](https://www.nuget.org/packages/SweDevTools.LiveDoc.xUnit) (.NET)
- **Static export** — generate a self-contained HTML report you can share or archive

---

## Installation

```bash
# Global — use the CLI from any project
npm install -g @swedevtools/livedoc-viewer

# Or as a dev dependency in your project
npm install -D @swedevtools/livedoc-viewer
```

**Requires Node.js 18 or later.**

---

## Quick Start

**1. Start the viewer**

```bash
livedoc-viewer
```

This launches a local server at `http://localhost:3100` and opens your browser.

**2. Connect your test framework**

Add the LiveDoc reporter to your Vitest config:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    include: ['**/*.Spec.ts'],
    globals: true,
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' }),
    ],
  },
});
```

The reporter auto-discovers a running viewer — no extra configuration needed.

**3. Run your tests**

```bash
npx vitest run
```

Switch to the browser and watch results appear in real time.

---

## CLI Usage

### Server Mode (default)

```bash
livedoc-viewer [options]
```

| Option          | Short | Default     | Description                      |
| --------------- | ----- | ----------- | -------------------------------- |
| `--port <port>` | `-p`  | `3100`      | Port to run the server on        |
| `--host <host>` | `-H`  | `localhost` | Host interface to bind to        |
| `--no-open`     | —     | (opens)     | Don't open browser automatically |
| `--version`     | `-V`  | —           | Show version and exit            |
| `--help`        | `-h`  | —           | Show help and exit               |

```bash
# Custom port, no browser
livedoc-viewer -p 8080 --no-open

# Accessible on the network (CI/CD)
livedoc-viewer --host 0.0.0.0 --no-open
```

### Static Export

Generate a self-contained HTML report from a TestRunV1 JSON file. The output embeds all JS, CSS, and test data inline — open it in any browser with zero dependencies.

```bash
livedoc-viewer export -i <path> [-o <path>] [-t <title>]
```

| Option             | Short | Required | Default                   | Description                 |
| ------------------ | ----- | -------- | ------------------------- | --------------------------- |
| `--input <path>`   | `-i`  | Yes      | —                         | Path to TestRunV1 JSON file |
| `--output <path>`  | `-o`  | No       | `./livedoc-report.html`   | Output HTML file path       |
| `--title <title>`  | `-t`  | No       | Project name or "LiveDoc" | Custom report title         |

```bash
# Basic export
livedoc-viewer export -i ./test-results/lastrun.json

# Custom output path and title
livedoc-viewer export -i results.json -o ./reports/sprint-42.html -t "Sprint 42 Results"
```

---

## Documentation

📖 **[Full documentation at livedoc.swedevtools.com →](https://livedoc.swedevtools.com/viewer/learn/getting-started)**

- [Getting Started](https://livedoc.swedevtools.com/viewer/learn/getting-started) — install, connect, and run
- [Understanding the UI](https://livedoc.swedevtools.com/viewer/learn/understanding-the-ui) — what each panel shows
- [CLI Options Reference](https://livedoc.swedevtools.com/viewer/reference/cli-options) — all flags and subcommands
- [REST API](https://livedoc.swedevtools.com/viewer/reference/rest-api) — programmatic access
- [WebSocket API](https://livedoc.swedevtools.com/viewer/reference/websocket-api) — real-time protocol

---

## License

MIT © [Garry McGlennon](https://github.com/dotnetprofessional)
