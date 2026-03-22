---
name: livedoc-vitest
description: Expert guidance for writing and modifying BDD/Gherkin and MSpec-style tests using the @swedevtools/livedoc-vitest framework. Generates self-documenting TypeScript specs with correct API usage, value extraction, and living documentation patterns.
---

# LiveDoc Vitest Test Author

## Use this skill when
- Creating new `.Spec.ts` test files using `@swedevtools/livedoc-vitest`
- Modifying existing LiveDoc Vitest tests in `packages/vitest`
- Writing BDD feature/scenario tests or MSpec specification/rule tests in TypeScript
- Adding scenarioOutline or ruleOutline data-driven tests
- Extracting values from step titles using `ctx.step.values`, `ctx.step.params`, or `ctx.example`
- Extracting values from rule/ruleOutline titles using `ctx.rule.values` and `ctx.rule.params`
- Debugging or fixing LiveDoc Vitest test failures

## Do not use this skill when
- Writing C#/.NET xUnit tests (use `livedoc-xunit` skill instead)
- Working on non-test TypeScript code (application logic, UI components, build scripts)
- Writing plain Vitest tests without LiveDoc BDD/Specification patterns
- Working on the viewer, VS Code extension, or server packages (unless writing their specs)

## Inputs
- `task`: What test to create or modify (feature name, scenario description, or bug to fix)
- `pattern`: BDD/Gherkin (`feature`/`scenario`) or Specification (`specification`/`rule`) — infer from context if not specified
- `target_path`: File path ending in `.Spec.ts` (e.g., `packages/vitest/_src/test/MyFeature.Spec.ts`)

## Outputs
- One or more `.Spec.ts` files with correct LiveDoc Vitest syntax
- Tests that are self-documenting: all inputs and expected outputs visible in step titles

## Workflow

### 1. Choose the correct pattern

Use **BDD/Gherkin** (`feature` → `scenario` → `given`/`when`/`then`) when:
- Tests describe user-facing behavior or business rules
- Non-technical stakeholders need to read the tests
- Testing workflows or end-to-end journeys

Use **Specification** (`specification` → `rule`) when:
- Testing technical components, APIs, utilities, or algorithms
- Tests are developer-focused with direct assertions
- Many data-driven variations needed

### IMPORTANT: Folder structure determines report hierarchy

The **file path** of each `.Spec.ts` file determines the visual tree structure in the LiveDoc Viewer. The reporter uses the relative folder path to create a navigable hierarchy.

**Pay special attention to folder organization for optimum test grouping:**

```
_src/test/
├── Checkout/                    → "Checkout" node in viewer
│   ├── Cart.Spec.ts             → Checkout/Cart.Spec.ts
│   └── Payment.Spec.ts          → Checkout/Payment.Spec.ts
├── Shipping/                    → "Shipping" node in viewer
│   └── ShippingCosts.Spec.ts    → Shipping/ShippingCosts.Spec.ts
└── Auth/                        → "Auth" node in viewer
    └── Login.Spec.ts            → Auth/Login.Spec.ts
```

- **Group related specs** under a common folder for logical grouping in reports
- **Avoid flat directories** — putting all spec files in one folder produces a flat, hard-to-navigate list
- **Mirror domain boundaries** — align folder segments with your bounded contexts or feature areas

### 2. Write the import block

```typescript
// BDD pattern
import { feature, scenario, scenarioOutline, background, given, when, Then as then, and, but } from "@swedevtools/livedoc-vitest";

// Specification pattern
import { specification, rule, ruleOutline } from "@swedevtools/livedoc-vitest";

// Or use globals mode (vitest.config.ts: globals: true) — no imports needed
```

**CRITICAL**: Import `Then` (uppercase) and alias as `then` (lowercase). ESM thenable detection requires the uppercase export name.

### 3. Structure the test

**BDD Pattern:**
```
feature → scenario | scenarioOutline | background → given | when | then | and | but
```

**Specification Pattern:**
```
specification → rule | ruleOutline
```

All blocks receive a `ctx` parameter with framework metadata.

### IMPORTANT: Use descriptions to provide context

Descriptions are included in the formatted test output and LiveDoc reports. They provide context that is often lost — making tests easier to reason about. **Always add descriptions** to `feature` and `specification` blocks; optionally to `scenario` and `rule` blocks.

In the title string, lines after the first line that don't start with `@` become the description:

```typescript
feature(`Shopping Cart Checkout
    @checkout @critical
    Business rules for the shopping cart checkout flow.
    Covers GST calculation, shipping tiers, and discount codes.
    `, (ctx) => {

    scenario(`Free shipping for large orders
        Orders over $100 qualify for free shipping in Australia.
        This rule applies regardless of product category.
        `, (ctx) => {
        // steps...
    });
});

specification(`Email Validation
    @validation
    Rules for validating email addresses across formats.
    Includes edge cases for international domains.
    `, (ctx) => {
    // rules...
});
```

- **First line** = title
- **Lines starting with `@`** = tags
- **Remaining lines** = description (appears in output and reports)

### 4. Embed values in step titles (CRITICAL)

**NEVER** hardcode test data inside step implementations. All inputs and expected outputs MUST appear in the step title string, then be extracted via context APIs.

```typescript
// ✅ CORRECT: Values in title, extracted from context
given("a user with balance '500' dollars", (ctx) => {
    account.balance = ctx.step.values[0]; // 500
});

// ✅ BETTER: Named parameters
given("a user with <balance:500> dollars", (ctx) => {
    account.balance = ctx.step.params.balance; // 500
});

// ❌ WRONG: Value drift risk
given("a user with balance '500' dollars", (ctx) => {
    account.balance = 200; // Says 500, uses 200!
});

// ❌ WRONG: Hidden values (not living documentation)
given("a user with some balance", (ctx) => {
    account.balance = 500;
});
```

### 5. Use data extraction APIs correctly

**Quoted values** — auto-extracted, type-coerced:
```typescript
given("user has '100' items and active is 'true'", (ctx) => {
    const [count, isActive] = ctx.step.values;
    // count = 100 (number), isActive = true (boolean)
});
```

**Named parameters** — `<name:value>` syntax:
```typescript
given("a user with <email:john@test.com> and <age:25>", (ctx) => {
    const email = ctx.step.params.email; // "john@test.com"
    const age = ctx.step.params.age;     // 25
});
```

**Data tables** — multi-column, entity, or single-column:
```typescript
given(`users:
    | name  | age |
    | Alice |  30 |
    | Bob   |  25 |
    `, (ctx) => {
    // ctx.step.table => [{name: "Alice", age: 30}, {name: "Bob", age: 25}]
});
```

**Doc strings** — raw or parsed JSON:
```typescript
given(`config:
    """
    {"debug": true, "level": 5}
    """
    `, (ctx) => {
    const config = ctx.step.docStringAsEntity; // {debug: true, level: 5}
});
```

**Scenario/Rule Outlines** — `ctx.example`:
```typescript
scenarioOutline(`Validate inputs
    Examples:
    | input | expected |
    | foo   | true     |
    | bar   | false    |
    `, (ctx) => {
    when("checking <input>", (ctx) => {
        result = validate(ctx.example.input);
    });
    then("result is <expected>", (ctx) => {
        expect(result).toBe(ctx.example.expected);
    });
});
```

**Rule value extraction** — both `rule` and `ruleOutline` support the same `'quoted values'` and `<name:value>` patterns as steps, accessible via `ctx.rule.values` and `ctx.rule.params`:

```typescript
specification("Calculator Rules", () => {
    // Quoted values — auto-extracted, type-coerced
    rule("Adding '5' and '3' returns '8'", (ctx) => {
        const [a, b, expected] = ctx.rule.values; // [5, 3, 8]
        expect(a + b).toBe(expected);
    });

    // Named parameters
    rule("Subtracting <b:3> from <a:10> returns <expected:7>", (ctx) => {
        const a = ctx.rule.params.a;             // 10
        const b = ctx.rule.params.b;             // 3
        expect(a - b).toBe(ctx.rule.params.expected);
    });

    // RuleOutline — title values + example table data (both accessible)
    ruleOutline(`Discount of '10' percent applies to orders over '100' dollars
        Examples:
        | orderTotal | expectedDiscount |
        |        150 |               15 |
        |        200 |               20 |
        `, (ctx) => {
        const [discountPct, threshold] = ctx.rule.values; // From title: [10, 100]
        const discount = ctx.example.orderTotal * (discountPct / 100); // From table
        expect(discount).toBe(ctx.example.expectedDiscount);
    });

    // RuleOutline with named params
    ruleOutline(`Applying <operation:multiply> with factor <factor:3>
        Examples:
        | input | expected |
        |     5 |       15 |
        |    10 |       30 |
        `, (ctx) => {
        expect(ctx.rule.params.operation).toBe("multiply"); // From title
        expect(ctx.example.input * ctx.rule.params.factor).toBe(ctx.example.expected); // Mixed
    });
});
```

### 6. Respect async rules

- **Only steps (`given`/`when`/`then`/`and`/`but`) and `rule` support `async`**
- `feature`, `scenario`, `scenarioOutline`, `background` callbacks must be **synchronous**

```typescript
// ✅ Async step
when("data is fetched", async (ctx) => {
    result = await fetchData();
});

// ❌ WRONG: async scenario
scenario("Test", async (ctx) => { /* NOT ALLOWED */ });
```

### 7. Use modifiers for focus/skip

```typescript
feature.only("Run only this feature", (ctx) => { ... });
feature.skip("Skip this feature", (ctx) => { ... });
scenario.only("Focus scenario", (ctx) => { ... });
scenario.skip("Skip scenario", (ctx) => { ... });
rule.only("Focus rule", (ctx) => { ... });
rule.skip("Skip rule", (ctx) => { ... });
```

### 8. Reporter configuration

`LiveDocSpecReporter` is the **only reporter** needed. It handles both console output and auto-discovery of a running LiveDoc server.

**Simplest config:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: [
      ["@swedevtools/livedoc-vitest/reporter", { detailLevel: "spec+summary+headers" }],
    ],
  },
});
```

**With explicit publish config:**
```typescript
import { LiveDocSpecReporter } from "@swedevtools/livedoc-vitest/reporter";

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        detailLevel: "spec+summary+headers",
        publish: {
          enabled: true,
          server: "http://localhost:3000",
          project: "my-project",
          environment: "local",
        },
      }),
    ],
  },
});
```

**Auto-discovery priority:** env vars (`LIVEDOC_SERVER_URL`/`LIVEDOC_PUBLISH_SERVER`) → explicit `publish` config → `discoverServer()` fallback from `@swedevtools/livedoc-server`.

:::note Backward compatibility
`LiveDocServerReporter` is still exported as a deprecated re-export of `LiveDocSpecReporter`. Old configs with two reporters still work but the second reporter is unnecessary.
:::

### 9. Build and test

```powershell
# Run all LiveDoc specs
pnpm --filter @swedevtools/livedoc-vitest test

# Run a specific spec file
pnpm --filter @swedevtools/livedoc-vitest test -- --testPathPattern="MyFeature"

# Watch mode
pnpm --filter @swedevtools/livedoc-vitest test:watch
```

### 10. Validate test quality

- [ ] All test data appears in step title strings (self-documenting)
- [ ] Descriptions provided on `feature` and `specification` blocks to give context
- [ ] Values are extracted via `ctx.step.values`, `ctx.step.params`, or `ctx.example` — never hardcoded
- [ ] File name ends in `.Spec.ts`
- [ ] `Then` imported as uppercase, aliased to lowercase `then`
- [ ] Async only used on step callbacks and `rule`, not on `feature`/`scenario`/`scenarioOutline`/`background`
- [ ] Tests pass: `pnpm --filter @swedevtools/livedoc-vitest test`

## Context Reference

### BDD/Gherkin Context

|         Property          |        Type         |                  Description                   |
| ---                       | ---                 | ---                                            |
| `ctx.feature`             | `FeatureContext`    | `{filename, title, description, tags}`         |
| `ctx.scenario`            | `ScenarioContext`   | `{title, description, tags, given?, steps}`    |
| `ctx.step`                | `StepContext`       | `{title, type, values, docString, table, ...}` |
| `ctx.example`             | `object`            | Current example row (scenarioOutline only)     |
| `ctx.background`          | `BackgroundContext` | Background metadata                            |
| `ctx.afterBackground(fn)` | function            | Register cleanup (background only)             |

### Specification Context

|      Property       |          Type          |                                    Description                                    |
| ---                 | ---                    | ---                                                                               |
| `ctx.specification` | `SpecificationContext` | `{title, description, tags}`                                                      |
| `ctx.rule`          | `RuleContext`          | `{title, description, tags, specification, values, valuesRaw, params, paramsRaw}` |
| `ctx.example`       | `object`               | Current example row (ruleOutline only)                                            |

### RuleContext Properties

| Property    | Returns                                                   |
| ---         | ---                                                       |
| `values`    | Coerced quoted values array (from rule/ruleOutline title) |
| `valuesRaw` | Raw string values                                         |
| `params`    | Coerced named values object `<n:v>`                       |
| `paramsRaw` | Raw named values string object                            |

### StepContext Properties

| Property            | Returns                               |
| ---                 | ---                                   |
| `values`            | Coerced quoted values array           |
| `valuesRaw`         | Raw string values                     |
| `params`            | Coerced named values object `<n:v>`   |
| `paramsRaw`         | Raw named values string object        |
| `docString`         | Raw doc string content                |
| `docStringAsEntity` | Parsed JSON or undefined              |
| `table`             | Headers as keys, array of row objects |
| `tableAsEntity`     | 2-col table as single object          |
| `tableAsSingleList` | First column as flat array            |
| `dataTable`         | Raw 2D array                          |
| `attachments`       | Read-only `Attachment[]` on current step |

### Step Attachment API

Attach files, screenshots, and data to steps for enhanced test documentation and debugging. Attachments flow through the reporter and appear in the LiveDoc Viewer.

#### Methods

**`ctx.step.attach(base64Data, options?)`** — Attach arbitrary data to the current step
- `base64Data`: string — Base64-encoded content
- `options.mimeType`: string — MIME type (default: `'application/octet-stream'`)
- `options.kind`: `'image' | 'screenshot' | 'file'` — Attachment kind (default: `'file'`)
- `options.title`: string — Optional display title

**`ctx.step.attachScreenshot(base64Data, title?)`** — Attach a screenshot (convenience wrapper)
- Shorthand for `attach()` with `kind='screenshot'` and `mimeType='image/png'`
- `base64Data`: string — Base64-encoded PNG data
- `title`: string (optional) — Display title

**`ctx.step.attachJSON(data, title?)`** — Attach JSON data
- Shorthand for `attach()` with `kind='file'` and `mimeType='application/json'`
- `data`: any — Will be JSON.stringify'd with pretty-printing; if already a string, used as-is
- `title`: string (optional) — Display title

#### Example

```typescript
scenario("Capturing API response data", () => {
    let response: Response;

    when("calling the users API endpoint", async (ctx) => {
        response = await fetch("/api/users");
        const json = await response.json();
        ctx.step.attachJSON(json, "API Response");
    });

    then("the response should contain user data", (ctx) => {
        // Attachments are visible in the LiveDoc Viewer
        expect(ctx.step.attachments).toHaveLength(0); // attachments are on the 'when' step
    });
});

scenario("Capturing a screenshot during UX testing", () => {
    when("viewing the login page", async (ctx) => {
        const screenshot = await page.screenshot(); // Playwright returns Buffer
        ctx.step.attachScreenshot(screenshot.toString("base64"), "Login Page");
    });
});
```

Attachments appear in step execution traces and are accessible via `ctx.step.attachments` (read-only array) for assertion or inspection.

## Validation
- [ ] All test data appears in step title strings (self-documenting)
- [ ] Descriptions provided on `feature` and `specification` blocks for context
- [ ] Values extracted via context APIs, never hardcoded in step implementations
- [ ] File name ends in `.Spec.ts`
- [ ] `Then` imported as uppercase, aliased to `then`
- [ ] Async only on step/rule callbacks
- [ ] Tests pass: `pnpm --filter @swedevtools/livedoc-vitest test`

## Examples

### Positive routing examples
- "Create a BDD test for the shopping cart checkout" → Write `.Spec.ts` with feature/scenario/given/when/then
- "Add data-driven tests for email validation" → Use scenarioOutline or ruleOutline with Examples table
- "Fix value drift in UserAuth.Spec.ts" → Replace hardcoded values with ctx.step.values extraction
- "Convert unit tests to LiveDoc specification pattern" → Use specification/rule/ruleOutline

### Negative routing examples
- "Create a C# test for shipping costs" → Use `livedoc-xunit` skill instead
- "Build a React component for test results" → Use `frontend-design` skill
- "Write a plain vitest describe/it test" → No LiveDoc skill needed
- "Fix the vitest config" → Handle directly, not test authoring

## Failure handling
- If tests fail to compile, check imports — especially `Then as then` alias
- If values are `undefined`, verify quoted values use single quotes `'value'` not backticks or double quotes
- If `ctx.example` is undefined, ensure you are inside a `scenarioOutline` or `ruleOutline`, not a plain `scenario` or `rule`
- If async tests hang, ensure `async` is only on step/rule callbacks, not on scenario/feature
- Run `pnpm --filter @swedevtools/livedoc-vitest test` to verify all tests pass after changes
