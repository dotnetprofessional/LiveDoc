# Reporter Configuration — Full Reference

Configure LiveDoc reporters for console output, real-time viewer streaming, JSON export, and static HTML reports.

## Available Reporters

| Reporter | Purpose | Import |
| --- | --- | --- |
| `LiveDocSpecReporter` | Console output + auto-discover viewer | `@swedevtools/livedoc-vitest/reporter` |
| `LiveDocViewerReporter` | Stream to viewer only (no console) | `@swedevtools/livedoc-vitest/reporter` |
| `JsonReporter` | Write JSON file for static export | `@swedevtools/livedoc-vitest/reporter` |
| `SilentReporter` | Suppress all output | `@swedevtools/livedoc-vitest/reporter` |

## LiveDocSpecReporter

The primary reporter. Produces structured Gherkin-style console output and auto-discovers a running LiveDoc Viewer server.

### Simplest Config

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        reporters: [
            ["@swedevtools/livedoc-vitest/reporter", { detailLevel: "spec+summary+headers" }],
        ],
    },
});
```

### Detail Levels

Combinable with `+`:

| Level | Output |
| --- | --- |
| `spec` | Full step-by-step output |
| `summary` | Pass/fail/skip counts |
| `headers` | Feature and scenario titles |
| `list` | One-line-per-test list |
| `silent` | No output |

Examples: `"spec+summary+headers"`, `"list+headers"`, `"summary"`

### Explicit Publish Config

```typescript
import { LiveDocSpecReporter } from "@swedevtools/livedoc-vitest/reporter";

export default defineConfig({
    test: {
        reporters: [
            new LiveDocSpecReporter({
                detailLevel: "spec+summary+headers",
                publish: {
                    enabled: true,
                    server: "http://localhost:3000",
                    project: "my-project",
                    environment: "local",
                },
            }),
        ],
    },
});
```

### Auto-Discovery Priority

The reporter automatically finds the viewer server:

1. **Environment variables**: `LIVEDOC_SERVER_URL` or `LIVEDOC_PUBLISH_SERVER`
2. **Explicit config**: `publish.server` in reporter options
3. **Discovery**: `discoverServer()` fallback from `@swedevtools/livedoc-server`
4. **Default local viewer**: health check on `http://localhost:3100`

Project and environment can also be set with `LIVEDOC_PROJECT` and `LIVEDOC_ENVIRONMENT`.

### Coverage Evidence

LiveDoc can attach coverage artifacts to the completed `TestRunV1` as supporting evidence. Coverage never changes the run pass/fail status; threshold misses are reported as warnings.

Install the provider that matches the Vitest version:

```bash
npm install --save-dev @vitest/coverage-v8
```

```typescript
import { LiveDocSpecReporter } from "@swedevtools/livedoc-vitest/reporter";

export default defineConfig({
    test: {
        reporters: [
            new LiveDocSpecReporter({
                detailLevel: "spec+summary+headers",
                coverage: {
                    enabled: true,
                    thresholds: { lines: 80, branches: 70 },
                },
            }),
        ],
        coverage: {
            enabled: true,
            provider: "v8",
            reporter: ["text", "html", "json-summary"],
        },
    },
});
```

Run `npx vitest run --coverage`. LiveDoc consumes Vitest's in-memory coverage map during the reporter lifecycle. File reporters are optional fallbacks for static export and external coverage tooling.

Supported fallback artifacts:

| Artifact | Auto-detected path | Notes |
| --- | --- | --- |
| Istanbul summary JSON | `coverage/coverage-summary.json` | Preferred for run and file summaries |
| LCOV | `coverage/lcov.info` | Useful when summary JSON is not available |

Use `coverage.artifactPath` or `LIVEDOC_COVERAGE_PATH` when the artifact is outside the standard coverage directory. Use `LIVEDOC_COVERAGE=true` to request diagnostics when coverage is expected but no supported artifact is found.

### Additional Options

| Option | Type | Description |
| --- | --- | --- |
| `detailLevel` | string | Output detail level (see above) |
| `output` | string | Write output to file |
| `removeHeaderText` | string | Strip text from headers (monorepo prefix) |
| `colors` | boolean | Enable/disable ANSI colors |
| `postReporters` | `IPostReporter[]` | Chain additional reporters after this one |

## LiveDocViewerReporter

Streams results to the LiveDoc Viewer in real-time without console output. Use when you want viewer integration only.

```typescript
import { LiveDocViewerReporter } from "@swedevtools/livedoc-vitest/reporter";

export default defineConfig({
    test: {
        reporters: [
            new LiveDocViewerReporter({
                server: "http://localhost:3000",
                project: "my-project",
                environment: "local",
                runType: "full",
            }),
        ],
    },
});
```

Set `runType: "partial"` or `LIVEDOC_RUN_TYPE=partial` for an isolated development run after a full baseline has been published. The Viewer preserves the baseline and lets users switch between the combined snapshot and only that partial invocation. Partial runs require server history and cannot be written directly as static JSON.

## JsonReporter

Writes test results to a JSON file. Used for CI/CD static report generation.

```typescript
import { JsonReporter } from "@swedevtools/livedoc-vitest/reporter";

export default defineConfig({
    test: {
        reporters: [
            new JsonReporter({ outputFile: "test-results.json" }),
        ],
    },
});
```

## Static HTML Export

Generate a self-contained HTML report from a JSON results file:

```bash
npx livedoc-viewer export -i test-results.json -o report.html
```

### CI/CD Pipeline

```yaml
steps:
    - name: Run tests with JSON output
      run: npx vitest run --config vitest.config.json.ts

    - name: Generate HTML report
      run: npx livedoc-viewer export -i test-results.json -o report.html

    - name: Upload report
      uses: actions/upload-artifact@v4
      with:
          name: test-report
          path: report.html
```

### Environment-Driven Config

Use environment variables for flexible CI configurations:

```json
{
    "scripts": {
        "test:spec": "cross-env LIVEDOC_DETAIL_LEVEL=spec+headers vitest run",
        "test:list": "cross-env LIVEDOC_DETAIL_LEVEL=list+headers vitest run",
        "test:summary": "cross-env LIVEDOC_DETAIL_LEVEL=summary+headers vitest run"
    }
}
```

## Backward Compatibility

`LiveDocServerReporter` is a deprecated re-export of `LiveDocSpecReporter`. Old configs still work.
