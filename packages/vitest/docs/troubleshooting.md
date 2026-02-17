<div align="center">

# 🔧 Troubleshooting

### Common issues and how to fix them

</div>

---

## "ReferenceError: feature is not defined"

**Cause:** Globals mode isn't set up correctly.

**Solution:** Ensure your `vitest.config.ts` has both settings:

```ts
export default defineConfig({
  test: {
    globals: true,  // ← Required
    setupFiles: ['@swedevtools/livedoc-vitest/setup'],  // ← Required for globals
  },
});
```

---

## "Cannot use 'import.meta' outside a module"

**Cause:** Your project isn't configured for ES modules.

**Solution:** Ensure your `package.json` has:

```json
{
  "type": "module"
}
```

Or rename your config to `vitest.config.mts`.

---

## TypeScript errors on step keywords

**Cause:** TypeScript doesn't know about LiveDoc globals.

**Solution:** Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@swedevtools/livedoc-vitest/globals"]
  }
}
```

---

## "The async keyword is not supported for Feature"

**Cause:** You used `async` on a feature or scenario function.

**Solution:** Remove `async` from containers — only steps can be async:

```ts
// ❌ Wrong
feature("Test", async () => { });

// ✅ Correct
feature("Test", () => {
  scenario("Example", () => {
    given("something", async () => {
      // async is fine here
      await someAsyncOperation();
    });
  });
});
```

---

## Steps running out of order

**Cause:** Using `async` steps without `await` in the step body.

**Solution:** Ensure async operations complete within the step:

```ts
// ❌ Wrong - fire and forget
given("data is loaded", () => {
  loadData();  // This is async but not awaited
});

// ✅ Correct
given("data is loaded", async () => {
  await loadData();
});
```

---

## "No test suite found" in VS Code

**Cause:** Custom reporter conflicts with VS Code's Vitest extension.

**Solution:** Detect VS Code and use default reporter:

```ts
const isVSCodeVitest = !!(
  process.env.VITEST_VSCODE ||
  process.env.VSCODE_PID
);

export default defineConfig({
  test: {
    reporters: isVSCodeVitest
      ? undefined  // Use Vitest default
      : [new LiveDocSpecReporter()],
  },
});
```

---

## Tags not filtering correctly

**Cause:** Filters not applied before tests run.

**Solution:** Set filters in a `setupFiles` module, not in the spec:

```ts
// ✅ Correct - setup file
// test/livedoc.setup.ts
import { livedoc } from '@swedevtools/livedoc-vitest';
livedoc.options.filters.include = ['@smoke'];
```

```ts
// vitest.config.ts
setupFiles: ['./test/livedoc.setup.ts'],
```

```ts
// ❌ Wrong - too late
// In a spec file
livedoc.options.filters.include = ['@smoke'];  // Other specs already registered
```

---

## Values not extracted from step titles

**Cause:** Values aren't in single quotes.

**Solution:** Use `'single quotes'` for extractable values:

```ts
// ❌ Wrong - double quotes or no quotes
given("the user has $100", (ctx) => {
  ctx.step?.values;  // []
});

// ✅ Correct
given("the user has '$100'", (ctx) => {
  ctx.step?.values;  // [100]
});
```

---

## Table data not parsing

**Cause:** Table formatting issues.

**Solution:** Ensure proper pipe alignment and spacing:

```ts
// ❌ Wrong - missing header row pipes
given(`users
  name | email
  Alice | alice@test.com
`, (ctx) => {});

// ✅ Correct
given(`users
  | name  | email          |
  | Alice | alice@test.com |
`, (ctx) => {});
```

---

## Background not running for all scenarios

**Cause:** Background placed after scenarios.

**Solution:** Always define background before scenarios:

```ts
feature("Test", () => {
  // ✅ Background first
  background("Setup", () => {
    given("common setup", () => {});
  });

  // Then scenarios
  scenario("First", () => {});
  scenario("Second", () => {});
});
```

---

## Reporter not showing output

**Cause:** `silent` flag enabled or output redirected.

**Solution:** Check your detail level:

```ts
// This produces no console output
new LiveDocSpecReporter({ detailLevel: 'silent' })

// Use this for full output
new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })
```

---

## Import errors with `Then`

**Cause:** Not aliasing the `Then` export.

**Solution:** Always alias:

```ts
// ❌ Wrong
import { then } from '@swedevtools/livedoc-vitest';  // Doesn't exist

// ✅ Correct
import { Then as then } from '@swedevtools/livedoc-vitest';
```

Or use globals mode where `then` is available directly.

---

## Still stuck?

1. Check the [GitHub Issues](https://github.com/user/livedoc/issues) for similar problems
2. Enable verbose Vitest output: `npx vitest run --reporter=verbose`
3. Open a new issue with:
   - Your `vitest.config.ts`
   - A minimal reproduction
   - Error message and stack trace

---

<div align="center">

[← Reporting](./reporting.md) · [Architecture →](./architecture.md)

</div>
