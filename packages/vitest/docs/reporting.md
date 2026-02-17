<div align="center">

# 📊 Reporting

### Beautiful output, JSON export, and live visualization

</div>

---

## Available reporters

LiveDoc provides several reporters for different use cases:

| Reporter | Purpose |
|----------|---------|
| `LiveDocSpecReporter` | Primary CLI output with Gherkin formatting |
| `JsonReporter` | Export results to JSON file |
| `LiveDocViewerReporter` | Send results to LiveDoc Viewer web UI |
| `LiveDocServerReporter` | Auto-discover and post to LiveDoc server |

---

## LiveDocSpecReporter

The main reporter for console output:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        detailLevel: 'spec+summary+headers',
      })
    ],
  },
});
```

### Output example

```
Feature: Shopping Cart

  Scenario: Adding an item
    ✓ given an empty cart
    ✓ when the user adds a product
    ✓ then the cart contains 1 item

──────────────────────────────────────────────────────
LiveDoc Test Summary
  ✓ 3 steps passed
  1 feature, 1 scenario, 3 steps
```

### Options

```ts
new LiveDocSpecReporter({
  // What to display (combine with +)
  detailLevel: 'spec+summary+headers',

  // Write output to a file
  output: './test-results.txt',

  // Remove prefix from file paths (useful for monorepos)
  removeHeaderText: 'packages/',

  // Enable/disable colors
  colors: true,

  // Additional reporters to run after completion
  postReporters: [],
})
```

### Detail level flags

| Flag | Effect |
|------|--------|
| `spec` | Show individual steps with pass/fail |
| `summary` | Show totals at the end |
| `headers` | Show feature and scenario names |
| `list` | Compact list format |
| `auto` | Automatic detail level |
| `silent` | No output (useful with post-reporters) |

**Common combinations:**

```ts
// Full output (default)
detailLevel: 'spec+summary+headers'

// Summary only
detailLevel: 'summary'

// Silent (only post-reporters run)
detailLevel: 'silent'
```

---

## JSON export

Export results to a JSON file for CI integration or custom processing:

```ts
import { LiveDocSpecReporter, JsonReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        detailLevel: 'spec+summary+headers',
        postReporters: [new JsonReporter()],
        'json-output': './livedoc-results.json',
      }),
    ],
  },
});
```

The JSON file includes:
- All features with scenarios and steps
- Pass/fail status and timing
- Error messages and stack traces
- Tags and metadata

---

## LiveDoc Viewer integration

Visualize test results in real-time with the LiveDoc Viewer web UI.

### Setup

```bash
# Install the viewer globally (one-time)
npm install -g @swedevtools/livedoc-viewer

# Start the viewer
livedoc-viewer
```

The viewer opens at `http://localhost:3100` and automatically receives results from your tests.

### Option 1: Auto-discovery (Recommended)

The `LiveDocServerReporter` automatically finds a running viewer:

```ts
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';
import LiveDocServerReporter from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' }),
      new LiveDocServerReporter(),  // Auto-discovers running viewer
    ],
  },
});
```

### Option 2: Explicit configuration

Specify the viewer URL directly:

```ts
import { LiveDocSpecReporter, LiveDocViewerReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        postReporters: [
          new LiveDocViewerReporter({
            server: 'http://localhost:3100',
            project: 'my-project',
            environment: 'local',
          })
        ],
      }),
    ],
  },
});
```

### Viewer options

| Option | Default | Description |
|--------|---------|-------------|
| `server` | `'http://localhost:3100'` | Viewer server URL |
| `project` | `'default'` | Project name for grouping |
| `environment` | `'local'` | Environment label |
| `timeout` | `5000` | HTTP request timeout (ms) |
| `silent` | `true` | Fail silently if server unavailable |

> **📖 Full documentation:** See the [@swedevtools/livedoc-viewer README](../../viewer/README.md) for CLI options and troubleshooting.

---

## LiveDoc Server Reporter

Auto-discovers a running LiveDoc server and posts results:

```ts
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';
import LiveDocServerReporter from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' }),
      new LiveDocServerReporter(),
    ],
  },
});
```

If no server is found, the reporter silently disables itself.

---

## VS Code considerations

When running tests through the VS Code Vitest extension, custom reporters can sometimes cause issues. The LiveDoc config handles this automatically:

```ts
// Detect VS Code environment
const isVSCodeVitest = !!(
  process.env.VITEST_VSCODE ||
  process.env.VSCODE_PID ||
  process.env.VSCODE_IPC_HOOK
);

export default defineConfig({
  test: {
    // Use default reporter in VS Code, custom reporter elsewhere
    reporters: isVSCodeVitest
      ? undefined
      : [new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })],
  },
});
```

---

## Multiple reporters

Combine reporters for different outputs:

```ts
export default defineConfig({
  test: {
    reporters: [
      // Console output
      new LiveDocSpecReporter({
        detailLevel: 'spec+summary+headers',
        postReporters: [
          // JSON for CI artifacts
          new JsonReporter(),
          // Live visualization
          new LiveDocViewerReporter({ server: 'http://localhost:3000' }),
        ],
        'json-output': './test-results.json',
      }),
      // Server discovery
      new LiveDocServerReporter(),
    ],
  },
});
```

---

## CI/CD integration

### GitHub Actions example

```yaml
- name: Run tests
  run: npx vitest run

- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: livedoc-results.json
```

### Output to file for logs

```ts
new LiveDocSpecReporter({
  detailLevel: 'spec+summary+headers',
  output: './test-output.txt',
})
```

---

<div align="center">

[← Tags & Filtering](./tags-and-filtering.md) · [Troubleshooting →](./troubleshooting.md)

</div>
