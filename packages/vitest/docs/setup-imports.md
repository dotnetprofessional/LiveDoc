<div align="center">

# 📦 Setup: Imports Mode

### Explicit imports for full control

</div>

---

## When to use this

**Imports mode** is ideal when you want:
- Self-contained spec files that work anywhere
- Explicit dependencies (great for code review)
- Maximum IDE autocomplete support

---

## The `Then as then` pattern

You might wonder: *why not just import `then` directly?*

In ES modules, if a module's namespace object has a property named `then`, some tools treat it as a "thenable" (Promise-like object). This can cause subtle issues.

LiveDoc exports `Then` (uppercase) to avoid this. You simply alias it:

```ts
import { Then as then } from '@swedevtools/livedoc-vitest';
```

Now you write specs with lowercase `then` — clean and consistent.

---

## Full setup

### 1. Vitest config

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

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

### 2. Spec file template

```ts
import {
  feature,
  scenario,
  background,
  scenarioOutline,
  given,
  when,
  Then as then,
  and,
  but,
} from '@swedevtools/livedoc-vitest';

feature("User Authentication", () => {
  scenario("Successful login", () => {
    given("a registered user", () => {
      // setup
    });

    when("they enter valid credentials", () => {
      // action
    });

    then("they should see the dashboard", () => {
      // assertion
    });
  });
});
```

---

## Available imports

| Import | Purpose |
|--------|---------|
| `feature` | Top-level container for related scenarios |
| `scenario` | A single test case |
| `scenarioOutline` | Data-driven test with Examples table |
| `background` | Shared setup steps for all scenarios in a feature |
| `given` | Precondition step |
| `when` | Action step |
| `Then` | Assertion step (alias as `then`) |
| `and` | Continuation of previous step type |
| `but` | Negative continuation |
| `livedoc` | Options singleton for filters/rules |

---

## Prefer zero imports?

If you'd rather not have any imports in your spec files, check out [Setup: Globals](./setup-globals.md).

---

<div align="center">

[← Back to Docs](./index.md)

</div>
