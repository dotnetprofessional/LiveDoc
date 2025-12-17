<div align="center">

# @livedoc/vitest

### Turn your tests into living documentation

[![npm version](https://img.shields.io/npm/v/@livedoc/vitest.svg)](https://www.npmjs.com/package/@livedoc/vitest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Write tests in Gherkin. Get documentation that never goes stale.**

</div>

---

## What is LiveDoc?

LiveDoc brings Behavior-Driven Development to Vitest with full Gherkin syntax:

- **Feature / Scenario / Given / When / Then** — the classic BDD pattern
- **Specification / Rule** — for technical and domain-level specs
- **Scenario Outlines** — data-driven tests with Examples tables
- **Tags & Filtering** — run `@smoke` tests, skip `@slow` ones
- **Beautiful Reports** — human-readable output, JSON export, live visualization

```ts
feature("Shopping Cart", () => {
  scenario("Adding items increases the total", () => {
    given("an empty cart", () => { /* ... */ });
    when("the user adds a '$25' book", () => { /* ... */ });
    then("the cart total should be '$25'", () => { /* ... */ });
  });
});
```

---

## Quick Start

### Install

```bash
npm install --save-dev vitest @livedoc/vitest
```

### Create a spec

```ts
// tests/calculator.Spec.ts
import { feature, scenario, given, when, Then as then, and } from '@livedoc/vitest';

feature("Calculator", () => {
  scenario("Adding two numbers", () => {
    let result = 0;

    given("I have entered '50' into the calculator", (ctx) => {
      result = ctx.step?.values?.[0] ?? 0;
    });

    and("I have entered '70' into the calculator", (ctx) => {
      result += ctx.step?.values?.[0] ?? 0;
    });

    when("I press add", () => {
      // Addition already happened above
    });

    then("the result should be '120'", (ctx) => {
      const expected = ctx.step?.values?.[0] ?? 0;
      expect(result).toBe(expected);
    });
  });
});
```

> **Why `Then as then`?** ES modules treat `then` as a thenable indicator. We export `Then` (uppercase) and you alias it. See [Setup: Imports](./docs/setup-imports.md).

### Configure Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    reporters: [new LiveDocSpecReporter()],
  },
});
```

### Run

```bash
npx vitest run
```

```
Feature: Calculator

  Scenario: Adding two numbers
    ✓ given I have entered '50' into the calculator
    ✓ and I have entered '70' into the calculator
    ✓ when I press add
    ✓ then the result should be '120'

──────────────────────────────────────────────────────
LiveDoc Test Summary
  ✓ 4 steps passed
  1 feature, 1 scenario, 4 steps
```

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| **[Getting Started](./docs/getting-started.md)** | Install and run your first spec in 5 minutes |
| [Setup: Imports](./docs/setup-imports.md) | Explicit imports with `Then as then` |
| [Setup: Globals](./docs/setup-globals.md) | Zero-import specs via setup file |
| [AI Setup Guide](./docs/ai-setup-guide.md) | Copy-paste configs for AI assistants |

### Writing Specs

| Guide | Description |
|-------|-------------|
| [BDD Authoring](./docs/authoring-bdd.md) | Features, scenarios, backgrounds, outlines |
| [Specification Authoring](./docs/authoring-specification.md) | Rules for technical/domain specs |
| [Data Extraction](./docs/data-extraction.md) | Tables, doc strings, quoted values |
| [Tags & Filtering](./docs/tags-and-filtering.md) | Run subsets with `@smoke`, `@slow`, etc. |

### Output & Operations

| Guide | Description |
|-------|-------------|
| [Reporting](./docs/reporting.md) | CLI output, JSON export, Viewer integration |
| [Troubleshooting](./docs/troubleshooting.md) | Common issues and fixes |

### Contributing

| Guide | Description |
|-------|-------------|
| [Architecture](./docs/architecture.md) | How LiveDoc works under the hood |
| [Contributing](./docs/contributing.md) | Dev setup and PR guidelines |

---

## Two Authoring Patterns

### BDD (for user stories)

```ts
feature("User Authentication @auth", () => {
  background("User exists", () => {
    given("a registered user", () => { /* ... */ });
  });

  scenario("Successful login @smoke", () => {
    when("they enter valid credentials", () => { /* ... */ });
    then("they see the dashboard", () => { /* ... */ });
  });
});
```

### Specification (for domain rules)

```ts
specification("Password Validation", () => {
  rule("Password must be at least 8 characters", () => {
    expect(isValid("short")).toBe(false);
    expect(isValid("longenough")).toBe(true);
  });

  ruleOutline(`Complexity requirements
    Examples:
    | password   | valid |
    | abc123     | false |
    | Abc123!@#  | true  |
  `, (ctx) => {
    expect(isValid(ctx.example.password)).toBe(ctx.example.valid === 'true');
  });
});
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [@livedoc/viewer](../viewer/README.md) | Web-based test results visualization |
| [@livedoc/vscode](../vscode/README.md) | VS Code extension with snippets |
| [@livedoc/server](../server/README.md) | Results server for live updates |

---

## Migration from livedoc-mocha

> ⚠️ **livedoc-mocha is deprecated.** This Vitest-based package is the active, maintained version.
>
> The legacy Mocha implementation remains available for reference at [`_archive/livedoc-mocha`](../../_archive/livedoc-mocha).

See [MIGRATION.md](./MIGRATION.md) for a comprehensive migration guide.

Key changes:
- Step keywords are **lowercase**: `given`, `when`, `then`, `and`, `but`
- Use `Then as then` in imports (or use globals mode)
- Context accessed via `ctx` parameter
- Configure via `vitest.config.ts`

---

## License

MIT

---

<div align="center">

Created by Garry McGlennon

**[📖 Read the Docs](./docs/index.md)** · **[🐛 Report a Bug](https://github.com/user/livedoc/issues)** · **[💡 Request a Feature](https://github.com/user/livedoc/issues)**

</div>
