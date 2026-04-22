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

---

## Documentation

📖 **[Full documentation at livedoc.swedevtools.com →](https://livedoc.swedevtools.com/vitest/learn/getting-started)**

Covers getting started, BDD & Specification patterns, data extraction, scenario outlines, tags & filtering, reporters, viewer integration, CI/CD, troubleshooting, and more.

---

## License

MIT
