<div align="center">

# 🌐 Setup: Globals Mode

### Zero-import specs for maximum readability

</div>

---

## When to use this

**Globals mode** is perfect when you want:
- Ultra-clean spec files with no import boilerplate
- Specs that read like plain English documentation
- A central place to configure LiveDoc options

---

## How it works

LiveDoc provides a setup file that registers all keywords on `globalThis`:

```
feature, scenario, scenarioOutline, background,
given, when, then, and, but
```

Note: `then` is registered as **lowercase** — the ESM thenable issue doesn't apply to `globalThis` properties.

---

## Full setup

### 1. Vitest config

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    setupFiles: ['@livedoc/vitest/setup'],  // ← This is the magic
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })
    ],
  },
});
```

### 2. Spec file (no imports!)

```ts
// tests/login.Spec.ts

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

That's it. No imports needed.

---

## TypeScript support

For full IntelliSense, add the LiveDoc globals to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@livedoc/vitest/globals"]
  }
}
```

---

## Configuring options globally

With globals mode, you can set up filters and rules in a single setup file:

```ts
// test/livedoc.setup.ts
import { livedoc } from '@livedoc/vitest';

// Only run @smoke tests
livedoc.options.filters.include = ['@smoke'];

// Skip @slow tests
livedoc.options.filters.exclude = ['@slow'];
```

Then add it to your setupFiles:

```ts
setupFiles: [
  '@livedoc/vitest/setup',
  './test/livedoc.setup.ts'
],
```

---

## Troubleshooting

### "ReferenceError: feature is not defined"

Make sure `setupFiles` includes `'@livedoc/vitest/setup'` and that `globals: true` is set.

### TypeScript errors on step keywords

Add `@livedoc/vitest/globals` to your `types` in `tsconfig.json`.

---

<div align="center">

[← Back to Docs](./index.md)

</div>
