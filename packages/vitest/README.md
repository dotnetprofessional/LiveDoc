<div align="center">

# @swedevtools/livedoc-vitest

### Turn your tests into living documentation

[![npm version](https://img.shields.io/npm/v/@swedevtools/livedoc-vitest.svg)](https://www.npmjs.com/package/@swedevtools/livedoc-vitest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Write tests in Gherkin. Get documentation that never goes stale.**

📖 **[Full Documentation →](https://livedoc.swedevtools.com/vitest/learn/getting-started)**

</div>

---

## What is LiveDoc?

LiveDoc brings Behavior-Driven Development to Vitest with full Gherkin syntax — **Feature / Scenario / Given / When / Then**, **Specification / Rule**, **Scenario Outlines**, **Tags & Filtering**, and **beautiful reports**.

## Quick Start

### Install

```bash
npm install --save-dev vitest @swedevtools/livedoc-vitest
```

### Fastest Setup: Point Your AI at the Bootstrap URL

Tell your assistant:

> Read https://livedoc.swedevtools.com/ai/setup.md and configure this Vitest
> project for LiveDoc, Viewer publishing, V8 coverage, and a first `.Spec.ts`.

No LiveDoc package or skill needs to be installed first.
[AI project setup →](https://livedoc.swedevtools.com/guides/ai-project-setup)

After setup, `npx livedoc-vitest-setup` optionally installs reusable guidance for
future AI sessions.

### Create a spec

```ts
// tests/Calculator.Spec.ts
import { feature, scenario, given, when, Then as then, and } from '@swedevtools/livedoc-vitest';

feature("Calculator", () => {
  scenario("Adding two numbers", () => {
    let result = 0;

    given("I have entered '50' into the calculator", (ctx) => {
      result = ctx.step.values[0];
    });

    and("I have entered '70' into the calculator", (ctx) => {
      result += ctx.step.values[0];
    });

    when("I press add", () => {
      // Addition already happened above
    });

    then("the result should be '120'", (ctx) => {
      expect(result).toBe(ctx.step.values[0]);
    });
  });
});
```

> **Why `Then as then`?** ES modules treat `then` as a thenable indicator. We export `Then` (uppercase) and you alias it.

### Configure Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.Spec.ts'],
    reporters: [new LiveDocSpecReporter()],
  },
});
```

### Run

```bash
npx vitest run
```

### Publish a focused partial run

After publishing one full baseline, mark an isolated development run as partial so the Viewer keeps the complete latest-known picture:

```bash
LIVEDOC_RUN_TYPE=partial npx vitest run features/Login.Spec.ts
```

You can also set `publish.runType` or `LiveDocViewerReporter({ runType: 'partial' })` in configuration. Partial runs require a running LiveDoc server and a completed full baseline for the same project and environment. Direct JSON/static partial export is not supported; release and production exports should use a full run.

### Add coverage evidence

LiveDoc can attach Vitest coverage as optional run evidence. It does not change the test run status; threshold misses appear as warnings in the viewer.

Install the V8 provider on the same version as Vitest:

```bash
npm install --save-dev @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        coverage: { enabled: true, thresholds: { lines: 80 } },
      }),
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
```

```bash
npx vitest run --coverage
```

LiveDoc consumes Vitest's in-memory coverage map before the run is published. It also auto-detects `coverage/coverage-summary.json` and `coverage/lcov.info` as fallbacks. For custom artifact paths, set `coverage.artifactPath` in the reporter or use `LIVEDOC_COVERAGE_PATH`.

See the [Code Coverage guide](https://livedoc.swedevtools.com/viewer/guides/code-coverage) for provider choices, thresholds, troubleshooting, and the Viewer module hierarchy.

---

## Documentation

📖 **[Full documentation at livedoc.swedevtools.com →](https://livedoc.swedevtools.com/vitest/learn/getting-started)**

Covers getting started, BDD & Specification patterns, data extraction, scenario outlines, tags & filtering, reporters, viewer integration, CI/CD, troubleshooting, and more.

---

## License

MIT
