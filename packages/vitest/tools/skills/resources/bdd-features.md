# BDD Features — Full Reference

Complete reference for writing BDD/Gherkin-style tests with `@swedevtools/livedoc-vitest`.

## Keywords

```
feature → scenario | scenarioOutline | background → given | when | then | and | but
```

All blocks receive a `ctx` parameter with framework metadata.

## Import Block

```typescript
import { feature, scenario, scenarioOutline, background, given, when, Then as then, and, but } from "@swedevtools/livedoc-vitest";
```

**CRITICAL**: Import `Then` (uppercase) and alias as `then` (lowercase). ESM thenable detection requires the uppercase export name.

## Feature

```typescript
feature("Shopping Cart", (ctx) => {
    // ctx.feature → { filename, title, description, tags }
});
```

## Scenario

```typescript
scenario("Adding items to cart", (ctx) => {
    // ctx.scenario → { title, description, tags, given?, steps }
    given("...", (ctx) => { /* ctx.step available */ });
    when("...", (ctx) => { /* ctx.step available */ });
    then("...", (ctx) => { /* ctx.step available */ });
});
```

## Background

Shared setup that runs before every scenario in a feature:

```typescript
feature("User Dashboard", () => {
    background("Authenticated user", (ctx) => {
        given("the user is logged in", () => {
            user = await login();
        });

        // Optional cleanup — runs after each scenario
        ctx.afterBackground(() => {
            user = null;
        });
    });

    scenario("Viewing the dashboard", () => {
        // 'given' from background runs first
        when("...", () => { });
        then("...", () => { });
    });
});
```

**Note**: `background()` requires a title as the first argument.

## Descriptions and Tags

Lines after the first line in titles provide descriptions and tags:

```typescript
feature(`Shopping Cart Checkout
    @checkout @critical
    Business rules for the shopping cart checkout flow.
    Covers GST calculation, shipping tiers, and discount codes.
    `, (ctx) => {

    scenario(`Free shipping for large orders
        Orders over $100 qualify for free shipping in Australia.
        `, (ctx) => {
        // steps...
    });
});
```

- **First line** = title
- **Lines starting with `@`** = tags (used for filtering)
- **Remaining lines** = description (appears in output and reports)

**Always add descriptions** to `feature` blocks for context. Optionally to `scenario` blocks.

## Value Extraction

### Quoted Values — auto-extracted, type-coerced

```typescript
given("user has '100' items and active is 'true'", (ctx) => {
    const [count, isActive] = ctx.step.values;
    // count = 100 (number), isActive = true (boolean)
});
```

### Named Parameters — `<name:value>` syntax

```typescript
given("a user with <email:john@test.com> and <age:25>", (ctx) => {
    const email = ctx.step.params.email; // "john@test.com"
    const age = ctx.step.params.age;     // 25
});
```

### Data Tables

```typescript
given(`users:
    | name  | age |
    | Alice |  30 |
    | Bob   |  25 |
    `, (ctx) => {
    // ctx.step.table => [{name: "Alice", age: 30}, {name: "Bob", age: 25}]
    // ctx.step.tableAsEntity => (2-col table as single object)
    // ctx.step.tableAsSingleList => (first column as flat array)
    // ctx.step.dataTable => (raw 2D array)
});
```

### Doc Strings

```typescript
given(`config:
    """
    {"debug": true, "level": 5}
    """
    `, (ctx) => {
    const raw = ctx.step.docString;         // '{"debug": true, "level": 5}'
    const parsed = ctx.step.docStringAsEntity; // {debug: true, level: 5}
});
```

## ScenarioOutline with Examples

Data-driven scenarios. Each row in the Examples table creates a separate test:

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

Access example data via `ctx.example.<columnName>`. Values are type-coerced.

## Step Attachment API

Attach files, screenshots, and data to steps. Attachments appear in the LiveDoc Viewer.

```typescript
// Attach JSON data
ctx.step.attachJSON(data, "API Response");

// Attach a screenshot (base64 PNG)
ctx.step.attachScreenshot(base64Data, "Login Page");

// Attach arbitrary data
ctx.step.attach(base64Data, { mimeType: "image/png", kind: "image", title: "Chart" });
```

**Methods:**
- `attach(base64Data, options?)` — options: `{mimeType, kind: 'image'|'screenshot'|'file', title}`
- `attachScreenshot(base64Data, title?)` — convenience for PNG screenshots
- `attachJSON(data, title?)` — convenience for JSON data

Read attachments: `ctx.step.attachments` (read-only array)

## Async Rules

- **Only step callbacks support `async`** (`given`, `when`, `then`, `and`, `but`)
- `feature`, `scenario`, `scenarioOutline`, `background` must be **synchronous**

```typescript
when("data is fetched", async (ctx) => {
    result = await fetchData();  // ✅ OK
});

scenario("Test", async (ctx) => { /* ❌ NOT ALLOWED */ });
```

## Context Reference

| Property | Type | Description |
| --- | --- | --- |
| `ctx.feature` | `FeatureContext` | `{filename, title, description, tags}` |
| `ctx.scenario` | `ScenarioContext` | `{title, description, tags, given?, steps}` |
| `ctx.step` | `StepContext` | `{title, type, values, docString, table, ...}` |
| `ctx.example` | `object` | Current example row (scenarioOutline only) |
| `ctx.background` | `BackgroundContext` | Background metadata |
| `ctx.afterBackground(fn)` | function | Register cleanup (background only) |

### StepContext Properties

| Property | Returns |
| --- | --- |
| `values` | Coerced quoted values array |
| `valuesRaw` | Raw string values |
| `params` | Coerced named values object `<n:v>` |
| `paramsRaw` | Raw named values string object |
| `docString` | Raw doc string content |
| `docStringAsEntity` | Parsed JSON or undefined |
| `table` | Headers as keys, array of row objects |
| `tableAsEntity` | 2-col table as single object |
| `tableAsSingleList` | First column as flat array |
| `dataTable` | Raw 2D array |
| `attachments` | Read-only `Attachment[]` |

## Validation Checklist

- [ ] All test data appears in step title strings (self-documenting)
- [ ] Descriptions provided on `feature` blocks for context
- [ ] Values extracted via `ctx.step.values`, `ctx.step.params`, or `ctx.example`
- [ ] `Then` imported as uppercase, aliased to lowercase `then`
- [ ] Async only on step callbacks
- [ ] File name ends in `.Spec.ts`
