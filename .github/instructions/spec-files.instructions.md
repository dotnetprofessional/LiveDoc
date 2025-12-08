---
applyTo: "**/*.Spec.ts"
---

# LiveDoc Vitest API Reference

BDD test framework using Gherkin syntax. Tests are living documentation.

## Documentation Principle

**Embed all inputs and expected outputs in step titles.** This makes features self-documenting—readers see what was tested without reading code. Use the built-in data extraction apis to extract and use them in step implementations.

```typescript
// ✓ Good: Values visible in documentation
given("a user with balance '500' dollars", ...);
when("they withdraw '200' dollars", ...);
then("the balance should be '300' dollars", ...);

// ✗ Bad: Values hidden in code
given("a user with some balance", (ctx) => { balance = 500; });
then("the balance is correct", (ctx) => { expect(balance).toBe(300); });
```

## Import

```typescript
// Note: 'Then' must be uppercase due to ESM thenable detection, alias it for lowercase usage
import { feature, scenario, scenarioOutline, background, given, when, Then as then, and, but } from "@livedoc/vitest";

// Or use globals mode (vitest.config.ts: globals: true) for all lowercase without imports
```

## Structure

```
feature → scenario|scenarioOutline|background → given|when|then|and|but
```

All blocks receive `ctx` parameter with framework metadata.

## Keywords

### feature(title, fn)

```typescript
feature(`Feature Title
    @tag1 @tag2
    Optional description text
    `, (ctx) => { /* scenarios */ });
```

- First line = title
- Lines starting with `@` = tags
- Remaining lines = description
- Supports `.skip()` and `.only()` modifiers

### scenario(title, fn)

```typescript
scenario(`Scenario Title
    @optional-tags
    Optional description
    `, (ctx) => { /* steps */ });
```

- Supports `.skip()` and `.only()` modifiers
- `async` NOT supported on scenario callback (use async in steps instead)

### scenarioOutline(title, fn)

Data-driven tests. Examples table in title, access via `ctx.example`.

```typescript
scenarioOutline(`Validate inputs
    Examples:
    | input | expected |
    | foo   | true     |
    | bar   | false    |
    `, (ctx) => {
    When("checking <input>", (ctx) => {
        result = validate(ctx.example.input);
    });
    Then("result is <expected>", (ctx) => {
        expect(result).toBe(ctx.example.expected);
    });
});
```

- `<placeholder>` in step titles for display only
- Access values via `ctx.example.columnName`
- Cannot be `async`

### background(title, fn)

Runs before each scenario in the feature.

```typescript
background("Setup", (ctx) => {
    given("precondition", (ctx) => { /* setup */ });
    
    ctx.afterBackground(() => { /* cleanup after each scenario */ });
});
```

### Steps: given/when/then/and/but

```typescript
given("step title with 'value'", (ctx) => { /* implementation */ });
when("action", async (ctx) => { /* async supported */ });
then("assertion", (ctx) => { expect(x).toBe(y); });
```

- **Only steps support `async`** - feature, scenario, scenarioOutline, background do NOT

## Data Extraction

### Quoted Values (`ctx.step.values`)

Auto-extracted and type-coerced from step title:

```typescript
given("user has '100' items and active is 'true'", (ctx) => {
    ctx.step.values[0] // 100 (number)
    ctx.step.values[1] // true (boolean)
});
```

Coerces: numbers, booleans, arrays (`'[1,2]'`), dates (`'2024-01-15'`)

### Data Tables

Multi-column → array of objects:
```typescript
given(`data:
    | name  | age |
    | Alice |  30 |
    `, (ctx) => {
    ctx.step.table // [{name: "Alice", age: 30}]
});
```

Two-column → entity object:
```typescript
given(`config:
    | key   | value |
    | debug | true  |
    `, (ctx) => {
    ctx.step.tableAsEntity // {key: "value", debug: true} — WRONG
    // Actually: {debug: true} — first col = key, second = value
});
```

Single-column → flat array:
```typescript
given(`codes:
    | 200 |
    | 404 |
    `, (ctx) => {
    ctx.step.tableAsSingleList // [200, 404]
});
```

### Doc Strings

```typescript
given(`JSON input:
    """
    {"key": "value"}
    """
    `, (ctx) => {
    ctx.step.docString        // raw string
    ctx.step.docStringAsEntity // parsed JSON object
});
```

## Context Reference

|         Property          |        Type         |                   Description                   |
| ----------                | ------              | -------------                                   |
| `ctx.feature`             | `FeatureContext`    | `{filename, title, description, tags}`          |
| `ctx.scenario`            | `ScenarioContext`   | `{title, description, tags, given?, steps}`     |
| `ctx.step`                | `StepContext`       | `{title, type, values, docString, table, ...}`  |
| `ctx.example`             | `object`            | Current example row data (scenarioOutline only) |
| `ctx.background`          | `BackgroundContext` | Background metadata                             |
| `ctx.afterBackground(fn)` | function            | Register cleanup (background only)              |

### StepContext Properties

| Property            | Returns                               |
| ----------          | ---------                             |
| `values`            | Coerced quoted values array           |
| `valuesRaw`         | Raw string values                     |
| `docString`         | Raw doc string content                |
| `docStringAsEntity` | Parsed JSON or undefined              |
| `table`             | Headers as keys, array of row objects |
| `tableAsEntity`     | 2-col table as single object          |
| `tableAsSingleList` | First column as flat array            |
| `dataTable`         | Raw 2D array                          |

## Modifiers

```typescript
feature.skip("...", fn)    // Skip feature
feature.only("...", fn)    // Run only this feature
scenario.skip("...", fn)   // Skip scenario  
scenario.only("...", fn)   // Run only this scenario
scenarioOutline.skip/only  // Same pattern
```

## File Naming

Use `.Spec.ts` extension: `UserAuth.Spec.ts`, `ShoppingCart.Spec.ts`
