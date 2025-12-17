<div align="center">

# 📐 Specification Authoring

### Rules and specifications for technical domains

</div>

---

## When to use Specifications

The **Specification pattern** is ideal for:
- Domain rules and business logic
- Technical constraints and validations
- Unit-level specs that don't fit the user story mold
- Mathematical or algorithmic requirements

While BDD's `feature/scenario` pattern tells user stories, `specification/rule` describes **what the system must do**.

---

## Keywords reference

### `specification`

A specification groups related rules. It's analogous to `feature` in BDD.

```ts
import { specification, rule } from '@livedoc/vitest';

specification("Password Validation", () => {
  rule("Password must be at least 8 characters", (ctx) => {
    expect(isValidPassword("short")).toBe(false);
    expect(isValidPassword("longenough")).toBe(true);
  });

  rule("Password must contain a number", (ctx) => {
    expect(isValidPassword("noNumbers")).toBe(false);
    expect(isValidPassword("has1number")).toBe(true);
  });
});
```

### `rule`

A rule is a single testable requirement. It runs as a Vitest `it()` block.

```ts
rule("Email addresses must contain @", (ctx) => {
  expect(validateEmail("invalid")).toBe(false);
  expect(validateEmail("valid@example.com")).toBe(true);
});
```

Rules can be async:

```ts
rule("API returns user data", async (ctx) => {
  const response = await fetch("/api/user/1");
  const data = await response.json();
  expect(data.id).toBe(1);
});
```

### `ruleOutline`

Data-driven rules with an Examples table:

```ts
import { specification, ruleOutline } from '@livedoc/vitest';

specification("Tax Calculation", () => {
  ruleOutline(`Tax rate by income bracket
    Examples:
    | income  | rate |
    | 10000   | 0.10 |
    | 50000   | 0.22 |
    | 100000  | 0.32 |
  `, (ctx) => {
    const { income, rate } = ctx.example;
    expect(calculateTaxRate(Number(income))).toBe(Number(rate));
  });
});
```

The test runs once per example row, with results grouped under the rule outline.

---

## Context properties

### `ctx.specification`

```ts
specification("My Spec", () => {
  rule("A rule", (ctx) => {
    console.log(ctx.specification?.title);  // "My Spec"
  });
});
```

### `ctx.rule`

```ts
rule("Must do something", (ctx) => {
  console.log(ctx.rule?.title);  // "Must do something"
});
```

### `ctx.example` (in ruleOutline)

```ts
ruleOutline(`Examples:
  | a | b | sum |
  | 1 | 2 | 3   |
`, (ctx) => {
  const { a, b, sum } = ctx.example;
  expect(Number(a) + Number(b)).toBe(Number(sum));
});
```

---

## Skip and only

```ts
// Skip a rule
rule.skip("Not implemented yet", () => { /* ... */ });

// Focus on a rule
rule.only("Debugging this", () => { /* ... */ });

// Skip entire specification
specification.skip("Disabled spec", () => { /* ... */ });

// Focus on specification
specification.only("Only this spec", () => { /* ... */ });
```

---

## Comparing BDD vs Specification

| Aspect | BDD (`feature/scenario`) | Specification (`specification/rule`) |
|--------|--------------------------|--------------------------------------|
| **Best for** | User stories, acceptance tests | Technical rules, domain logic |
| **Structure** | Given/When/Then steps | Direct assertions |
| **Verbosity** | More structured | More concise |
| **Audience** | Cross-functional teams | Developers |

You can mix both patterns in the same project:

```
tests/
├── features/           # BDD specs
│   ├── auth.Spec.ts
│   └── checkout.Spec.ts
└── specs/              # Technical specs  
    ├── validation.Spec.ts
    └── calculations.Spec.ts
```

---

## Best practices

### 1. One rule, one concept

```ts
// ✅ Good - focused
rule("Discount applies to orders over $100", () => { /* ... */ });

// ❌ Avoid - testing multiple things
rule("Discount and shipping and tax calculation", () => { /* ... */ });
```

### 2. Use descriptive rule names

```ts
// ✅ Good - reads like a requirement
rule("Expired tokens are rejected with 401", () => { /* ... */ });

// ❌ Avoid - vague
rule("Token test", () => { /* ... */ });
```

### 3. Use ruleOutline for boundaries

```ts
ruleOutline(`Age verification boundaries
  Examples:
  | age | allowed |
  | 17  | false   |
  | 18  | true    |
  | 21  | true    |
`, (ctx) => {
  expect(isAllowed(Number(ctx.example.age))).toBe(ctx.example.allowed === 'true');
});
```

---

<div align="center">

[← Back to Docs](./index.md) · [Data Extraction →](./data-extraction.md)

</div>
