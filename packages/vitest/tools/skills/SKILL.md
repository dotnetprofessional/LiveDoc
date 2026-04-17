---
name: livedoc-vitest
description: Expert guidance for writing and modifying BDD/Gherkin and MSpec-style tests using the @swedevtools/livedoc-vitest framework. Generates self-documenting TypeScript specs with correct API usage, value extraction, and living documentation patterns.
sdk_version: 0.2.0
---

# LiveDoc Vitest Test Author

> **Progressive disclosure**: This file is the routing hub. Read the appropriate sub-resource for full API details.

## Version Check

This skill targets **@swedevtools/livedoc-vitest v0.2.0**. Before writing tests, verify the installed version matches:

```bash
npm ls @swedevtools/livedoc-vitest   # or: pnpm ls @swedevtools/livedoc-vitest
```

If the installed version differs from `0.2.0`, tell the developer: *"Your LiveDoc skill files target v0.2.0 but you have vX.Y.Z installed. Run `npx livedoc-vitest-setup` to update the skill files, or check the changelog for breaking changes."*

## Use this skill when
- Creating or modifying `.Spec.ts` test files using `@swedevtools/livedoc-vitest`
- Writing BDD `feature`/`scenario` tests → **read `resources/bdd-features.md`**
- Writing MSpec `specification`/`rule` tests → **read `resources/specifications.md`**
- Writing browser-based Playwright tests → **read `resources/playwright.md`**
- Configuring reporters or static HTML export → **read `resources/reporter-config.md`**
- Debugging or fixing any LiveDoc Vitest test failures

## Do not use this skill when
- Writing C#/.NET xUnit tests (use `livedoc-xunit` skill instead)
- Working on non-test TypeScript code (application logic, UI components, build scripts)
- Writing plain Vitest tests without LiveDoc BDD/Specification patterns
- Working on the viewer, VS Code extension, or server packages (unless writing their specs)

---

## Two Test Patterns

### 1. BDD Features (`resources/bdd-features.md`)

**Use when**: Testing user journeys, business flows, acceptance criteria. Audience is business + technical. Tests read as Given/When/Then narratives.

```typescript
import { feature, scenario, given, when, Then as then } from "@swedevtools/livedoc-vitest";

feature("Shipping Costs", () => {
    scenario("Free shipping for Australian orders over $100", () => {
        let cart: ShoppingCart;

        given("the customer is from 'Australia'", (ctx) => {
            cart = new ShoppingCart({ country: ctx.step.values[0] });
        });

        when("the order totals '100.00' dollars", (ctx) => {
            cart.total = ctx.step.values[0];
            cart.calculate();
        });

        then("shipping type is 'Free'", (ctx) => {
            expect(cart.shippingType).toBe(ctx.step.values[0]);
        });
    });
});
```

**Key concepts**: `feature`, `scenario`, `scenarioOutline`, `background`, `given`/`when`/`then`/`and`/`but`, `ctx.step.values`, `ctx.step.params`, `ctx.example`, data tables, doc strings.

→ **Read `resources/bdd-features.md`** for complete keyword reference, background patterns, scenarioOutline with Examples, value extraction API, data tables, doc strings, attachment API, and validation checklist.

### 2. Specifications (`resources/specifications.md`)

**Use when**: Testing APIs, utilities, algorithms, data-driven edge cases. Developer-only audience. Direct assertions in rules — no Given/When/Then ceremony.

```typescript
import { specification, rule, ruleOutline } from "@swedevtools/livedoc-vitest";

specification("Calculator Operations", () => {
    rule("Adding '5' and '3' returns '8'", (ctx) => {
        const [a, b, expected] = ctx.rule.values;
        expect(a + b).toBe(expected);
    });

    ruleOutline(`Discount calculations
        Examples:
        | price | discount | expected |
        |   100 |       10 |       90 |
        |   200 |       25 |      150 |
        `, (ctx) => {
        const result = ctx.example.price - (ctx.example.price * ctx.example.discount / 100);
        expect(result).toBe(ctx.example.expected);
    });
});
```

**Key concepts**: `specification`, `rule`, `ruleOutline`, `ctx.rule.values`, `ctx.rule.params`, `ctx.example`, data-driven testing.

→ **Read `resources/specifications.md`** for complete keyword reference, value extraction API, ruleOutline with Examples, async rules, and validation checklist.

### 3. Playwright Integration (`resources/playwright.md`)

**Use when**: Browser-based testing — UI validation, screenshot capture, end-to-end web testing.

```typescript
import { useBrowser, screenshot } from "@swedevtools/livedoc-vitest/playwright";

const { page } = useBrowser();

// Inside a scenario step:
when("navigating to the homepage", async (ctx) => {
    await page().goto("http://localhost:3000");
    await screenshot(page(), ctx);
});
```

→ **Read `resources/playwright.md`** for `useBrowser` options, `screenshot` API, lifecycle management, and troubleshooting.

---

## Shared Concepts

### Folder Structure = Report Hierarchy

The **file path** of each `.Spec.ts` file determines the visual tree in the LiveDoc Viewer:

```
_src/test/
├── Checkout/           → "Checkout" node in viewer
│   └── Cart.Spec.ts
├── Shipping/           → "Shipping" node
│   └── Costs.Spec.ts
└── Auth/               → "Auth" node
    └── Login.Spec.ts
```

### Import Pattern

```typescript
// BDD pattern
import { feature, scenario, scenarioOutline, background, given, when, Then as then, and, but } from "@swedevtools/livedoc-vitest";

// Specification pattern
import { specification, rule, ruleOutline } from "@swedevtools/livedoc-vitest";

// Playwright (optional)
import { useBrowser, screenshot } from "@swedevtools/livedoc-vitest/playwright";
```

**CRITICAL**: Import `Then` (uppercase) and alias as `then` (lowercase). ESM thenable detection requires the uppercase export name.

### CRITICAL: Self-Documenting Tests

**Embed all inputs and expected outputs in step/rule titles.** Extract them using context APIs. Never hardcode values that appear in titles.

```typescript
// ✅ Values in title AND extracted from context
given("a user with balance '500' dollars", (ctx) => {
    account.balance = ctx.step.values[0]; // 500
});

// ✅ Named parameters for clarity
given("a user with <balance:500> dollars", (ctx) => {
    account.balance = ctx.step.params.balance; // 500
});

// ❌ BAD: Value drift — title says 500, code uses 200
given("a user with balance '500' dollars", (ctx) => {
    account.balance = 200;
});
```

### Value Extraction Quick Reference

| Syntax in Title | Step Access | Rule Access |
| --- | --- | --- |
| `'value'` (quoted) | `ctx.step.values[0]` | `ctx.rule.values[0]` |
| `<name:value>` (named) | `ctx.step.params.name` | `ctx.rule.params.name` |
| `<Placeholder>` (outline) | `ctx.example.Placeholder` | `ctx.example.Placeholder` |

### Descriptions and Tags

Lines after the first line in titles provide descriptions and tags:

```typescript
feature(`Shopping Cart
    @checkout @critical
    Business rules for the shopping cart checkout flow.
    `, () => { ... });
```

- **First line** = title
- **Lines starting with `@`** = tags (used for filtering)
- **Remaining lines** = description (appears in reports)

### Async Rules

- **Only step callbacks and `rule` support `async`**
- `feature`, `scenario`, `scenarioOutline`, `background` must be **synchronous**

### Modifiers

```typescript
feature.only("...", fn);     feature.skip("...", fn);
scenario.only("...", fn);    scenario.skip("...", fn);
rule.only("...", fn);        rule.skip("...", fn);
```

### Build and Test

```bash
pnpm --filter @swedevtools/livedoc-vitest test          # Run all specs
pnpm --filter @swedevtools/livedoc-vitest test -- --testPathPattern="MyFeature"
```

---

## Routing Examples

### Positive (USE this skill)
- "Create a BDD test for shipping costs" → Read `resources/bdd-features.md`, write feature/scenario
- "Add data-driven tests for tax" → Read `resources/bdd-features.md`, use scenarioOutline
- "Write spec tests for email validator" → Read `resources/specifications.md`, write specification/rule
- "Write a Playwright test for the login page" → Read `resources/playwright.md`, use useBrowser
- "Configure LiveDoc reporter output" → Read `resources/reporter-config.md`
- "Generate static HTML test report" → Read `resources/reporter-config.md`

### Negative (DO NOT use this skill)
- "Create a C# test for shipping" → Use `livedoc-xunit` skill
- "Build a React component" → Use `frontend-design` skill
- "Write a plain vitest test" → No LiveDoc skill needed
- "Install AI skills for the team" → Run `npx livedoc-vitest-setup`

## Failure Handling
- Tests fail to compile → check imports, especially `Then as then` alias
- Values are `undefined` → verify single quotes `'value'` not backticks or double quotes
- `ctx.example` undefined → ensure inside `scenarioOutline`/`ruleOutline`, not plain `scenario`/`rule`
- Async hangs → ensure `async` only on step/rule callbacks, not on `feature`/`scenario`
- Playwright `page()` throws → `useBrowser()` must be at module scope; `page()` called inside steps
- Reporter issues → Read `resources/reporter-config.md`
