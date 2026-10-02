<div align="center">

# @swedevtools/livedoc-viewer

**Real-time BDD test results in your browser.**

[![npm version](https://img.shields.io/npm/v/@swedevtools/livedoc-viewer.svg)](https://www.npmjs.com/package/@swedevtools/livedoc-viewer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

📖 [Documentation](https://livedoc.swedevtools.com/viewer/) · [GitHub](https://github.com/dotnetprofessional/LiveDoc)

</div>

---

## What It Does

LiveDoc Viewer is a web-based dashboard that visualizes BDD test results as they run. Start the viewer, run your tests, and watch features, scenarios, and steps stream into the browser in real time.

- **Live updates** — results appear via WebSocket as each scenario completes
- **Failure details** — click any failed step to see the error and stack trace
- **Quality dashboard** — tests, failures, rule violations, coverage, and duration at a glance
- **Code coverage** — weighted module totals with line and branch drill-down
- **Run history** — Full and Partial views with optional automatic latest-run following
- **Deep links** — share the exact project, run, projection, folder, or test
- **Multi-framework** — works with [@swedevtools/livedoc-vitest](https://www.npmjs.com/package/@swedevtools/livedoc-vitest) (TypeScript) and [SweDevTools.LiveDoc.xUnit](https://www.nuget.org/packages/SweDevTools.LiveDoc.xUnit) (.NET)
- **Native tests** — inspect saved xUnit Facts and individual Theory cases beside Features and Specifications, including passed and skipped results. Both `Standard` and `Container` report kinds remain supported; existing reports need no conversion.
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

## Focused Partial Runs

Developers and AI agents can validate one file, scenario, or rule without replacing the complete latest-known documentation. Publish one full baseline, then configure the reporter with `runType: 'partial'` or `LIVEDOC_RUN_TYPE=partial` for focused runs.

The Run menu keeps one chronological history with **Full** and **Partial n** badges. Selecting a partial defaults to **Combined** (the full baseline plus completed partial updates); switch to **This partial** to inspect only what that invocation executed. Static exports remain full-run workflows.

## Included Test Types

Open **Viewer settings → Included test types** to include or exclude **Features**, **Specifications**, and **Standard tests (non-LiveDoc)**. All three are included by default, and your choices are remembered in this browser. Excluded results disappear from navigation, search, tags, failure lists, and test metrics, including grouped runs and both partial-run views. Reports are not changed or deleted; check a type again to restore it. Run duration and coverage still describe the whole invocation, because reports do not attribute that evidence to individual tests.

Standard tests without additional details stay inline, like passing Rules. Tests with descriptions, arguments, evidence, skip reasons, violations, or failures can still open their detail view. Qualified standard-test names show only the final method name, preserving argument text; this display rule is framework-neutral and leaves saved identities and links unchanged.

## Deleting Saved Results

In the live Viewer, open the **Project** or **Run** selector and use the small X beside an entry. The confirmation names the data that will be permanently removed. This action is unavailable in static exports.

- Deleting a source project removes all its stored runs across environments. Deleting a logical project group deletes **each listed source project**, including historical runs, across environments—not just its newest displayed set. These are separate server operations, not one atomic transaction; if one fails, the remaining sources stay visible and the dialog offers a retry.
- Deleting one raw run removes only that exact stored run ID. Deleting a grouped run set lists and deletes each of its physical run IDs, not the synthetic group ID. A baseline with dependent partial runs and an active run cannot be deleted individually; the server reports a conflict. Choose the whole project instead when you need to remove a complete run lineage.
- HTTP errors remain in the confirmation with a retry option. A successful deletion refreshes the server project hierarchy and run list, updates the selected run and link, and ignores delayed updates for deleted entries until the page is reloaded.

Project names are URL-encoded as a single path segment. The current server rejects stored names containing `/` or `\` even when encoded (HTTP 400); this endpoint cannot delete those existing records. Changing a producer's name affects future runs, not old stored results. Unicode names without forbidden path characters are supported.

---

## Coverage in the Viewer

When a reporter attaches file-level coverage, the dashboard adds a **Code Coverage** section with module health, file counts, and weighted line totals. Runs without coverage show no coverage controls.

The coverage explorer leads with the project/module hierarchy, shows line and branch percentages, removes redundant path prefixes, and keeps modules collapsed until you drill in. Coverage is invocation evidence, not a test result, so low coverage or threshold warnings do not change pass/fail status.

See the [Code Coverage guide](https://livedoc.swedevtools.com/viewer/guides/code-coverage) for complete Vitest, xUnit, and Visual Studio setup.

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
- [Code Coverage](https://livedoc.swedevtools.com/viewer/guides/code-coverage) — configure Vitest, xUnit, and Visual Studio coverage
- [CLI Options Reference](https://livedoc.swedevtools.com/viewer/reference/cli-options) — all flags and subcommands
- [REST API](https://livedoc.swedevtools.com/viewer/reference/rest-api) — programmatic access
- [WebSocket API](https://livedoc.swedevtools.com/viewer/reference/websocket-api) — real-time protocol

---

## License

MIT © [Garry McGlennon](https://github.com/dotnetprofessional)
