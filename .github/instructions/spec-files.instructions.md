---
applyTo: "**/*.{Spec,spec}.ts"
---

# LiveDoc Vitest API Reference

BDD test framework using Gherkin syntax. Tests are living documentation.

## Documentation Principle

**Embed all inputs and expected outputs in step titles.** This makes features self-documenting—readers see what was tested without reading code. 

### CRITICAL: Avoid Value Drift
To ensure the documentation matches the execution, **NEVER** hardcode values in step implementations that are already present in the title. Always extract them using the context APIs (`ctx.step.values`, `ctx.example`, etc.).

```typescript
// ✓ BEST: Values in title AND extracted from context
given("a user with balance '500' dollars", (ctx) => {
    account.balance = ctx.step.values[0]; // Uses 500
});
then("the balance should be '300' dollars", (ctx) => {
    expect(account.balance).toBe(ctx.step.values[0]); // Uses 300
});

// ✗ BAD: Value drift risk (Title says 300, code checks 200)
then("the balance should be '300' dollars", (ctx) => {
    expect(account.balance).toBe(200); 
});

// ✗ WORSE: Values hidden in code (Not Living Documentation)
given("a user with some balance", (ctx) => { balance = 500; });
then("the balance is correct", (ctx) => { expect(balance).toBe(300); });
```

## Import

```typescript
// Note: 'Then' must be uppercase due to ESM thenable detection, alias it for lowercase usage
import { feature, scenario, scenarioOutline, background, given, when, Then as then, and, but } from "@livedoc/vitest";

// Specification pattern imports
import { specification, rule, ruleOutline } from "@livedoc/vitest";

// Or use globals mode (vitest.config.ts: globals: true) for all lowercase without imports
```

## Structures

### BDD/Gherkin Pattern
```
feature → scenario|scenarioOutline|background → given|when|then|and|but
```

### Specification Pattern (MSpec-style)
```
specification → rule|ruleOutline
```

All blocks receive `ctx` parameter with framework metadata.

## Choosing a Pattern

### Use BDD/Gherkin (`feature`/`scenario`) when:
- **Stakeholder collaboration** — Requirements come from business discussions; non-technical people need to read tests
- **End-to-end/acceptance testing** — Testing user journeys through the system
- **Domain behavior** — Capturing business rules in ubiquitous language
- **Living documentation** — Tests serve as executable specifications for the team
- **Discovery sessions** — Using examples to explore and agree on requirements

### Use Specification (`specification`/`rule`) when:
- **Technical components** — Testing APIs, utilities, algorithms, or infrastructure
- **Many variations** — Data-driven tests with numerous input combinations
- **Direct assertions** — No need for Given/When/Then ceremony
- **Developer-focused** — Tests written by and for developers
- **Compact tests** — Single-assertion rules that are self-documenting

### Quick Decision Guide

|         Aspect          |         BDD/Gherkin          |      Specification       |
| ----------------------- | ---------------------------- | -----------------------  |
| Audience                | Business + Technical         | Technical                |
| Verbosity               | Higher (structured steps)    | Lower (direct code)      |
| Best for                | Workflows, user stories      | Units, edge cases        |
| Data-driven             | `scenarioOutline` + Examples | `ruleOutline` + Examples |
| Collaboration           | Discovery workshops          | Code reviews             |

**Tip:** You can mix patterns in the same project. Use `feature` for acceptance tests and `specification` for unit/component tests.

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
    when("checking <input>", (ctx) => {
        // Use ctx.example to access the current row's data
        result = validate(ctx.example.input);
    });
    then("result is <expected>", (ctx) => {
        // Use ctx.example for assertions to avoid hardcoding
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

## Specification Pattern (MSpec-style)

A simpler alternative to Gherkin BDD. No step functions—assertions live directly in rules.

### specification(title, fn)

Container for related rules. Similar to `feature` but without scenarios.

```typescript
specification(`Calculator Rules
    @math @validation
    Rules for calculator operations
    `, (ctx) => { /* rules */ });
```

- First line = title
- Lines starting with `@` = tags  
- Remaining lines = description
- Supports `.skip()` and `.only()` modifiers

### rule(title, fn)

Simple assertion block. No given/when/then—just direct test code.

```typescript
specification("Math Operations", () => {
    rule("Adding positive numbers increases the value", (ctx) => {
        const result = 5 + 3;
        expect(result).toBe(8);
    });

    rule("Multiplying by zero returns zero", async (ctx) => {
        // Async is supported in rules
        const result = await calculate(5, 0);
        expect(result).toBe(0);
    });
});
```

- Supports `.skip()` and `.only()` modifiers
- Supports `async` callbacks

### ruleOutline(title, fn)

Data-driven rules with Examples table. Access data via `ctx.example`.

```typescript
specification("Email Validation", () => {
    ruleOutline(`Valid emails are accepted
        Examples:
        | email           | valid |
        | test@test.com   | true  |
        | invalid         | false |
        | user@domain.org | true  |
        `, (ctx) => {
        // Always use ctx.example in ruleOutlines
        const result = isValidEmail(ctx.example.email);
        expect(result).toBe(ctx.example.valid);
    });
});
```

- Examples table parsed from title (same format as scenarioOutline)
- Access values via `ctx.example.columnName`
- Supports `.skip()` and `.only()` modifiers

### Specification Context

```typescript
specification("My Spec @tag1", (ctx) => {
    rule("Access context", (ctx) => {
        ctx.specification.title       // "My Spec"
        ctx.specification.tags        // ["tag1"]
        ctx.specification.description // description text
    });
    
    rule("Rule context", (ctx) => {
        ctx.rule.title       // "Rule context"
        ctx.rule.description // rule description
    });
});
```

## Data Extraction

### Quoted Values (`ctx.step.values`)

Auto-extracted and type-coerced from step title. Use these to avoid hardcoding values in your test logic.

```typescript
given("user has '100' items and active is 'true'", (ctx) => {
    const [count, isActive] = ctx.step.values;
    expect(count).toBe(100);      // count is a number
    expect(isActive).toBe(true);  // isActive is a boolean
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
    // ctx.step.table => [{name: "Alice", age: 30}]
    const user = ctx.step.table[0];
    expect(user.name).toBe("Alice");
    expect(user.age).toBe(30);
});
```

Two-column → entity object:
```typescript
given(`config:
    | key   | value |
    | debug | true  |
    `, (ctx) => {
    // ctx.step.tableAsEntity => {debug: true}
    // First column is the key, second is the value
    expect(ctx.step.tableAsEntity.debug).toBe(true);
});
```

Single-column → flat array:
```typescript
given(`codes:
    | 200 |
    | 404 |
    `, (ctx) => {
    // ctx.step.tableAsSingleList => [200, 404]
    expect(ctx.step.tableAsSingleList).toContain(200);
});
```

### Doc Strings

```typescript
given(`JSON input:
    """
    {"key": "value"}
    """
    `, (ctx) => {
    // ctx.step.docString => raw string
    // ctx.step.docStringAsEntity => parsed JSON object
    expect(ctx.step.docStringAsEntity.key).toBe("value");
});
```

## Context Reference

### BDD/Gherkin Context

|         Property          |        Type         |                   Description                   |
| ------------------------- | ------------------- | ----------------------------------------------- |
| `ctx.feature`             | `FeatureContext`    | `{filename, title, description, tags}`          |
| `ctx.scenario`            | `ScenarioContext`   | `{title, description, tags, given?, steps}`     |
| `ctx.step`                | `StepContext`       | `{title, type, values, docString, table, ...}`  |
| `ctx.example`             | `object`            | Current example row data (scenarioOutline only) |
| `ctx.background`          | `BackgroundContext` | Background metadata                             |
| `ctx.afterBackground(fn)` | function            | Register cleanup (background only)              |

### Specification Context

|       Property       |          Type          |                      Description                       |
| -------------------- | ---------------------- | ------------------------------------------------------ |
| `ctx.specification`  | `SpecificationContext` | `{title, description, tags}`                           |
| `ctx.rule`           | `RuleContext`          | `{title, description, tags, specification}`            |
| `ctx.example`        | `object`               | Current example row data (ruleOutline only)            |

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
// BDD/Gherkin
feature.skip("...", fn)       // Skip feature
feature.only("...", fn)       // Run only this feature
scenario.skip("...", fn)      // Skip scenario  
scenario.only("...", fn)      // Run only this scenario
scenarioOutline.skip/only     // Same pattern

// Specification pattern
specification.skip("...", fn) // Skip specification
specification.only("...", fn) // Run only this specification
rule.skip("...", fn)          // Skip rule
rule.only("...", fn)          // Run only this rule
ruleOutline.skip/only         // Same pattern
```

## File Naming

Use `.Spec.ts` extension: `UserAuth.Spec.ts`, `ShoppingCart.Spec.ts`
