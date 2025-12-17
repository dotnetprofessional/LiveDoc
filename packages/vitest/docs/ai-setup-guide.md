<div align="center">

# 🤖 AI Setup Guide

### Copy-paste configurations for AI coding assistants

</div>

---

> **For AI agents:** This page contains complete, production-ready configurations. Copy the relevant sections directly into your project.

---

## Quick reference

| Decision      | Recommended choice                               |
| ----------    | -------------------                              |
| Step keywords | Lowercase: `given`, `when`, `then`, `and`, `but` |
| Import style  | Either works — see options below                 |
| File naming   | `*.Spec.ts`                                      |
| Reporter      | `LiveDocSpecReporter`                            |

---

## Option A: Imports mode (explicit dependencies)

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })
    ],
  },
});
```

### Spec file template

```ts
import {
  feature,
  scenario,
  scenarioOutline,
  background,
  given,
  when,
  Then as then,
  and,
  but,
} from '@livedoc/vitest';

feature("Feature Title", () => {
  scenario("Scenario Title", () => {
    given("a precondition", (ctx) => {
      // ctx.step?.values contains quoted values
    });
    when("an action occurs", () => {});
    then("an expected outcome", () => {});
  });
});
```

---

## Option B: Globals mode (zero imports)

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    setupFiles: ['@livedoc/vitest/setup'],
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })
    ],
  },
});
```

### tsconfig.json (for TypeScript support)

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@livedoc/vitest/globals"]
  }
}
```

### Spec file template

```ts
feature("Feature Title", () => {
  scenario("Scenario Title", () => {
    given("a precondition", (ctx) => {});
    when("an action occurs", () => {});
    then("an expected outcome", () => {});
  });
});
```

---

## Reporter configuration matrix

### LiveDocSpecReporter options

```ts
new LiveDocSpecReporter({
  // Detail level flags (combine with +)
  detailLevel: 'spec+summary+headers',
  
  // Write output to file
  output: './test-results.txt',
  
  // Strip text from headers (useful for monorepos)
  removeHeaderText: 'packages/',
  
  // Enable/disable colors
  colors: true,
  
  // Run additional reporters after completion
  postReporters: [],
})
```

**Detail level flags:**

| Flag      | Effect                        |
| ------    | --------                      |
| `spec`    | Show individual steps         |
| `summary` | Show pass/fail summary        |
| `headers` | Show feature/scenario headers |
| `list`    | List-style output             |
| `silent`  | Suppress all output           |

---

## Adding JSON output

```ts
import { LiveDocSpecReporter, JsonReporter } from '@livedoc/vitest/reporter';

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

---

## Adding Viewer integration

```ts
import { LiveDocSpecReporter, LiveDocViewerReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        detailLevel: 'spec+summary+headers',
        postReporters: [
          new LiveDocViewerReporter({
            server: 'http://localhost:3000',
            project: 'my-project',
            environment: 'local',
          })
        ],
      }),
    ],
  },
});
```

---

## Tag filtering

### Setup file approach (recommended)

```ts
// test/livedoc.setup.ts
import { livedoc } from '@livedoc/vitest';

livedoc.options.filters.include = ['@smoke', '@critical'];
livedoc.options.filters.exclude = ['@slow', '@flaky'];
livedoc.options.filters.showFilterConflicts = false;
```

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./test/livedoc.setup.ts'],
  },
});
```

### Using tags in specs

```ts
feature("API Tests @api @integration", () => {
  scenario("Health check @smoke @critical", () => {
    // This runs when @smoke or @critical is included
  });

  scenario("Load test @slow", () => {
    // This is skipped when @slow is excluded
  });
});
```

---

## Specification pattern (alternative to BDD)

For technical/domain rules instead of user stories:

```ts
import { specification, rule, ruleOutline } from '@livedoc/vitest';

specification("Email Validation Rules", () => {
  rule("Email must contain @ symbol", (ctx) => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
  });

  ruleOutline(`Domain validation
    Examples:
    | email          | valid |
    | user@gmail.com | true  |
    | user@localhost | false |
  `, (ctx) => {
    const { email, valid } = ctx.example;
    expect(isValidEmail(email)).toBe(valid === 'true');
  });
});
```

---

## Complete example project structure

```
my-project/
├── vitest.config.ts          # Vitest + LiveDoc config
├── tsconfig.json             # Add @livedoc/vitest/globals to types
├── test/
│   ├── livedoc.setup.ts      # Optional: filter/rule configuration
│   ├── auth.Spec.ts          # BDD specs
│   └── validation.Spec.ts    # Specification specs
└── package.json
```

---

<div align="center">

[← Back to Docs](./index.md)

</div>
