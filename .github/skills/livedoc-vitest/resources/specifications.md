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
        expect(add(a, b)).toBe(expected);
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
    expect(applyOperation(ctx.rule.params.operation, ctx.example.input, ctx.rule.params.factor))
        .toBe(ctx.example.expected);
});
```

## Descriptions and Tags

```typescript
specification(`Email Validation
    @validation
    Helps callers reject the malformed address shapes covered
    by the rules below before using an address.
    `, (ctx) => {
    // rules...
});
```

- **First line** = title
- **Lines starting with `@`** = tags
- **Remaining lines** = description

Descriptions are optional. Use them for why the tested contract matters, not
an inventory of rules. A Specification can document a business-owned policy
such as shipping rates when exact rules serve the reader better than a
workflow; a technical contract can have a developer-facing purpose without
claiming an untested business outcome. Rule titles, example rows, and
assertions show the proof.

## API Request and Response Evidence

`ctx.rule.attachJSON(data, title)` adds an attachment to the Rule's execution.
Record a safe authored request and selected fields from the **actual**
response before potentially failing assertions. This makes both successful
and failing contracts easier to inspect without leaking the full exchange:

```typescript
import { expect } from "vitest";
import { specification, rule } from "@swedevtools/livedoc-vitest";

specification(`Widget API
    Clients can rely on a stable response when creating a widget.
`, () => {
    rule("Creating widget 'sample' returns status '201' and name 'sample'", async (ctx) => {
        const [name, expectedStatus, expectedName] = ctx.rule.values;
        const baseUrl = process.env.API_BASE_URL;
        if (!baseUrl) throw new Error("API_BASE_URL must point to an isolated test server");

        const request = { name };
        ctx.rule.attachJSON(request, "Create widget request (safe fields)");
        const response = await fetch(`${baseUrl}/api/widgets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        });
        ctx.rule.attachJSON({ status: response.status }, "Create widget HTTP status");

        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null ||
            !("name" in body) || typeof body.name !== "string") {
            throw new Error("Create widget response is missing a string name");
        }
        ctx.rule.attachJSON({ name: body.name }, "Widget response name (safe field)");
        expect(response.status).toBe(expectedStatus);
        expect(body.name).toBe(expectedName);
    });
});
```

Use only reviewed, non-sensitive fields in these objects. Do not attach
authorization headers, cookies, tokens, personal data, or an unreviewed full
response. Attachments supplement the assertion; they do not establish
correctness on their own. Browser features can additionally attach meaningful
screenshots with `screenshot(page(), ctx)`; a screenshot does not replace a
behavioral assertion.

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
- [ ] If provided, specification descriptions explain why the tested contract matters without overclaiming
- [ ] API attachments select safe fields before assertions and do not replace them
- [ ] Values extracted via `ctx.rule.values`, `ctx.rule.params`, or `ctx.example`
- [ ] Async only on `rule` callbacks, not `specification`
- [ ] File name ends in `.Spec.ts`
