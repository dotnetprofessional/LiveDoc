# Playwright Integration — Full Reference

Browser-based testing with `@swedevtools/livedoc-vitest/playwright`.

## Prerequisites

```bash
npm install -D playwright         # or: pnpm add -D playwright
npx playwright install chromium   # install browser binary
```

## Import

```typescript
import { useBrowser, screenshot } from "@swedevtools/livedoc-vitest/playwright";
```

## useBrowser(options?)

Manages browser lifecycle for the current feature file. **Call at module scope** (outside any scenario). Launches the browser in `beforeAll`, closes in `afterAll`.

```typescript
import { feature, scenario, given, when, Then as then } from "@swedevtools/livedoc-vitest";
import { useBrowser, screenshot } from "@swedevtools/livedoc-vitest/playwright";

const { page, context, browser } = useBrowser();

feature("Viewer Navigation", () => {
    scenario("Loading the homepage", () => {
        when("navigating to the homepage", async (ctx) => {
            await page().goto("http://localhost:3000");
            await screenshot(page(), ctx);
        });

        then("the page title should be visible", async () => {
            const title = await page().locator("h1").textContent();
            expect(title).toBeTruthy();
        });
    });
});
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `browser` | `'chromium' \| 'firefox' \| 'webkit'` | `'chromium'` | Browser engine |
| `headless` | `boolean` | `true` | Run headless (set `false` for debugging) |
| `viewport` | `{width, height}` | `1280×720` | Browser viewport size |
| `freshContextPerScenario` | `boolean` | `false` | Create a fresh browser context for each scenario |

### Return Value

`useBrowser()` returns **getter functions**, not direct references:

- `page()` — returns the current Playwright Page
- `context()` — returns the current BrowserContext
- `browser()` — returns the Browser instance

```typescript
const { page } = useBrowser({ headless: false });

// ✅ CORRECT: Call page() inside a step
when("clicking the button", async () => {
    await page().click("button#submit");
});

// ❌ WRONG: page() at module scope — browser not launched yet
const p = page(); // Will throw or return undefined
```

### Headed Mode (Debugging)

```typescript
const { page } = useBrowser({ headless: false });
```

The browser window stays visible for debugging. Combine with `scenario.only()` to focus on a single test.

## screenshot(page, ctx, options?)

Captures a screenshot and attaches it to the current step.

```typescript
when("viewing the dashboard", async (ctx) => {
    await screenshot(page(), ctx);
    // Auto-named: "viewing-the-dashboard-0.png"
});
```

### Parameters

- `page` — Playwright Page instance (use `page()` getter)
- `ctx` — Step context from the step callback
- `options.name` — Custom screenshot name (optional; auto-generated from step title if omitted)
- `options.fullPage` — Capture full page vs viewport only (optional)

### Custom Named Screenshots

```typescript
when("viewing the dashboard", async (ctx) => {
    await screenshot(page(), ctx, { name: "dashboard-initial-load" });
    // ... interact with page ...
    await screenshot(page(), ctx, { name: "dashboard-after-filter" });
});
```

## Global Setup for Dev Server

When testing against a local dev server, use Vitest's `globalSetup` to start it:

```typescript
// vitest.config.ts
export default defineConfig({
    test: {
        globalSetup: './global-setup.ts',
    },
});

// global-setup.ts
export async function setup() {
    // Start your dev server, wait for it to be ready
}
export async function teardown() {
    // Stop the server
}
```

## CI Configuration

```yaml
# .github/workflows/test.yml
- name: Install Playwright
  run: npx playwright install --with-deps chromium
- name: Run tests
  run: npx vitest run
```

## Troubleshooting

| Problem | Cause | Solution |
| --- | --- | --- |
| `Cannot find module 'playwright'` | Not installed | `npm install -D playwright` |
| `Browser not found` | Binaries not installed | `npx playwright install chromium` |
| `page() returns undefined` | Called at module scope | Call `page()` inside step callbacks only |
| `useBrowser is not a function` | Wrong import path | Use `@swedevtools/livedoc-vitest/playwright` |
| Tests timeout | Slow network/server | Increase vitest timeout, ensure server is running |
| Screenshots are blank | Page not loaded | Add `await page().waitForLoadState()` before screenshot |
