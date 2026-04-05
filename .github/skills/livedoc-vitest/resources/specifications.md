# Specifications — Full Reference

Complete reference for writing MSpec-style specification/rule tests with `@swedevtools/livedoc-vitest`.

## Keywords

```
specification → rule | ruleOutline
```

## Import Block

```typescript
import { specification, rule, ruleOutline } from "@swedevtools/livedoc-vitest";
```

## Specification

Top-level container grouping related rules:

```typescript
specification("Calculator Operations", (ctx) => {
    // ctx.specification → { title, description, tags }
});
```

## Rule

Individual test cases with direct assertions:

```typescript
specification("Calculator Operations", () => {
    rule("Adding '5' and '3' returns '8'", (ctx) => {
        const [a, b, expected] = ctx.rule.values; // [5, 3, 8]
        expect(a + b).toBe(expected);
    });
});
```

## Value Extraction

### Quoted Values — auto-extracted, type-coerced

```typescript
rule("Adding '5' and '3' returns '8'", (ctx) => {
    const [a, b, expected] = ctx.rule.values;
    // a = 5 (number), b = 3, expected = 8
});
```

### Named Parameters — `<name:value>` syntax

```typescript
rule("Subtracting <b:3> from <a:10> returns <expected:7>", (ctx) => {
    const a = ctx.rule.params.a;             // 10
    const b = ctx.rule.params.b;             // 3
    expect(a - b).toBe(ctx.rule.params.expected); // 7
});
```

## RuleOutline with Examples

Data-driven rules. Each row in the Examples table creates a separate test:

```typescript
ruleOutline(`Discount calculations
    Examples:
    | price | discount | expected |
    |   100 |       10 |       90 |
    |   200 |       25 |      150 |
    `, (ctx) => {
    const result = ctx.example.price - (ctx.example.price * ctx.example.discount / 100);
    expect(result).toBe(ctx.example.expected);
});
```

### Combining Title Values and Example Data

RuleOutline supports both title values and example table data:

```typescript
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
```

### Named Params in RuleOutline

```typescript
ruleOutline(`Applying <operation:multiply> with factor <factor:3>
    Examples:
    | input | expected |
    |     5 |       15 |
    |    10 |       30 |
    `, (ctx) => {
    expect(ctx.rule.params.operation).toBe("multiply");
    expect(ctx.example.input * ctx.rule.params.factor).toBe(ctx.example.expected);
});
```

## Descriptions and Tags

```typescript
specification(`Email Validation
    @validation
    Rules for validating email addresses across formats.
    `, (ctx) => {
    // rules...
});
```

- **First line** = title
- **Lines starting with `@`** = tags
- **Remaining lines** = description

## Async Rules

`rule` callbacks support `async`. `specification` callbacks must be **synchronous**.

```typescript
rule("Fetching user returns valid data", async (ctx) => {
    const user = await fetchUser(1);
    expect(user.name).toBeTruthy();  // ✅ OK
});

specification("Test", async (ctx) => { /* ❌ NOT ALLOWED */ });
```

## Context Reference

| Property | Type | Description |
| --- | --- | --- |
| `ctx.specification` | `SpecificationContext` | `{title, description, tags}` |
| `ctx.rule` | `RuleContext` | `{title, description, tags, specification, values, valuesRaw, params, paramsRaw}` |
| `ctx.example` | `object` | Current example row (ruleOutline only) |

### RuleContext Properties

| Property | Returns |
| --- | --- |
| `values` | Coerced quoted values array |
| `valuesRaw` | Raw string values |
| `params` | Coerced named values object `<n:v>` |
| `paramsRaw` | Raw named values string object |

## Validation Checklist

- [ ] All test data appears in rule title strings (self-documenting)
- [ ] Descriptions provided on `specification` blocks
- [ ] Values extracted via `ctx.rule.values`, `ctx.rule.params`, or `ctx.example`
- [ ] Async only on `rule` callbacks, not `specification`
- [ ] File name ends in `.Spec.ts`
