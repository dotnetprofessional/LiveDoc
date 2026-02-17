<div align="center">

# 🏷️ Tags and Filtering

### Run exactly the tests you need

</div>

---

## What are tags?

Tags let you categorize and filter tests. Add them to feature or scenario titles:

```ts
feature("User Management @api @critical", () => {
  scenario("Create user @smoke", () => { /* ... */ });
  scenario("Delete user @destructive", () => { /* ... */ });
  scenario("Bulk import @slow @integration", () => { /* ... */ });
});
```

Common tag conventions:

| Tag | Typical use |
|-----|-------------|
| `@smoke` | Quick sanity checks |
| `@slow` | Long-running tests |
| `@integration` | Tests requiring external services |
| `@api` | API-level tests |
| `@ui` | Browser/UI tests |
| `@wip` | Work in progress |
| `@critical` | Must-pass tests |

---

## Configuring filters

Filters are set via `livedoc.options.filters`:

```ts
import { livedoc } from '@swedevtools/livedoc-vitest';

// Include only these tags
livedoc.options.filters.include = ['@smoke', '@critical'];

// Exclude these tags
livedoc.options.filters.exclude = ['@slow', '@wip'];
```

### Where to configure

**Option 1: In a setup file (recommended)**

```ts
// test/livedoc.setup.ts
import { livedoc } from '@swedevtools/livedoc-vitest';

livedoc.options.filters.include = ['@smoke'];
livedoc.options.filters.exclude = ['@slow'];
```

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./test/livedoc.setup.ts'],
  },
});
```

**Option 2: In vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { livedoc } from '@swedevtools/livedoc-vitest';

livedoc.options.filters.include = ['@smoke'];

export default defineConfig({
  test: {
    // ...
  },
});
```

---

## Filter logic

### Include filter

When `include` is set, **only** matching tests run:

```ts
livedoc.options.filters.include = ['@smoke'];

// ✅ Runs - has @smoke
scenario("Quick check @smoke", () => {});

// ❌ Skipped - no matching tag
scenario("Full test @integration", () => {});
```

### Exclude filter

When `exclude` is set, matching tests are skipped:

```ts
livedoc.options.filters.exclude = ['@slow'];

// ✅ Runs - no excluded tag
scenario("Fast test @unit", () => {});

// ❌ Skipped - has @slow
scenario("Performance test @slow", () => {});
```

### Combined filters

When both are set, the logic is:

1. If a test matches `include` → candidate to run
2. If that test also matches `exclude` → skipped (unless conflicts are shown)

```ts
livedoc.options.filters.include = ['@api'];
livedoc.options.filters.exclude = ['@slow'];

// ✅ Runs - matches @api, no excluded tag
scenario("Fast API test @api", () => {});

// ❌ Skipped - matches @api but also @slow
scenario("Slow API test @api @slow", () => {});

// ❌ Skipped - doesn't match @api
scenario("UI test @ui", () => {});
```

---

## Filter conflicts

What happens when a test matches both include and exclude?

By default, **exclude wins** — the test is skipped.

To see these conflicts (useful for debugging):

```ts
livedoc.options.filters.showFilterConflicts = true;
```

When enabled, conflicting tests run but are marked in the output.

---

## Tag inheritance

Tags cascade from features to scenarios:

```ts
feature("Payments @api", () => {
  // This scenario inherits @api
  scenario("Process payment @critical", () => {
    // Effective tags: @api, @critical
  });
});
```

If you filter for `@api`, all scenarios in this feature are candidates.

---

## Dynamic filtering

For CI/CD, you might want environment-based filtering:

```ts
// test/livedoc.setup.ts
import { livedoc } from '@swedevtools/livedoc-vitest';

if (process.env.CI === 'true') {
  // In CI, skip slow tests
  livedoc.options.filters.exclude = ['@slow', '@flaky'];
} else {
  // Locally, run everything
  livedoc.options.filters.exclude = [];
}

if (process.env.SMOKE_TEST === 'true') {
  livedoc.options.filters.include = ['@smoke'];
}
```

---

## Combining with Vitest's native filtering

LiveDoc's tag filtering works alongside Vitest's built-in options:

```bash
# Vitest file filtering
npx vitest run tests/api/

# Vitest test name filtering
npx vitest run -t "Payment"

# Both work with LiveDoc tag filtering active
```

---

## Quick reference

| Setting | Type | Effect |
|---------|------|--------|
| `filters.include` | `string[]` | Only run tests with these tags |
| `filters.exclude` | `string[]` | Skip tests with these tags |
| `filters.showFilterConflicts` | `boolean` | Show tests matching both include and exclude |

---

<div align="center">

[← Data Extraction](./data-extraction.md) · [Reporting →](./reporting.md)

</div>
