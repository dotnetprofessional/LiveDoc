---
name: livedoc-vitest
description: Expert guidance for writing and modifying BDD/Gherkin and MSpec-style tests using the @swedevtools/livedoc-vitest framework. Generates self-documenting TypeScript specs with correct API usage, value extraction, and living documentation patterns.
sdk_version: 0.3.0
---

# LiveDoc Vitest Test Author

> **Progressive disclosure**: This file is the routing hub. Read the appropriate sub-resource for full API details.

## Version Check

This skill targets **@swedevtools/livedoc-vitest v0.3.0**. Before writing tests, verify the installed version matches:

```bash
npm ls @swedevtools/livedoc-vitest   # or: pnpm ls @swedevtools/livedoc-vitest
```

If the installed version differs from `0.3.0`, tell the developer: *"Your LiveDoc skill files target v0.3.0 but you have vX.Y.Z installed. Run `npx livedoc-vitest-setup` to update the skill files, or check the changelog for breaking changes."*

## Use this skill when
- Creating or modifying `.Spec.ts` test files using `@swedevtools/livedoc-vitest`
- Writing BDD `feature`/`scenario` tests → **read `resources/bdd-features.md`**
- Writing MSpec `specification`/`rule` tests → **read `resources/specifications.md`**
- Writing browser-based Playwright tests → **read `resources/web-testing.md` and `resources/playwright.md`**
- Running tag-scoped incremental tests that patch the Viewer → **read `resources/partial-testing.md`**
- Configuring reporters or static HTML export → **read `resources/reporter-config.md`**
- Configuring Vitest coverage for LiveDoc Viewer → **read `resources/reporter-config.md`**
- Debugging or fixing any LiveDoc Vitest test failures

## Do not use this skill when
- Writing C#/.NET xUnit tests (use `livedoc-xunit` skill instead)
- Working on non-test TypeScript code (application logic, UI components, build scripts)
- Writing plain Vitest tests without LiveDoc BDD/Specification patterns
- Working on the viewer, VS Code extension, or server packages (unless writing their specs)

---

## Inputs

- Behavior claim or defect to protect
- Relevant production code and existing tests
- Observable boundary: pure code, component, HTTP, browser, process, filesystem, or source tree
- Vitest configuration and installed package versions

## Outputs

- The smallest trustworthy LiveDoc test, or a recommendation to use a native specialist test
- Self-documenting titles with values extracted through LiveDoc context APIs
- Focused validation evidence, including isolated execution and false-green checks
- A clean LiveDoc report with no unintended rule violations
- A user-approved, sanitized upstream bug report when testing confirms a LiveDoc framework defect

## Workflow

1. Read `resources/test-strategy.md` and apply the two-question litmus.
2. Choose the lowest trustworthy boundary and an independent oracle.
3. Select Feature or Specification based on audience and journey shape.
4. For web claims, read `resources/web-testing.md`; do not use class names as appearance proxies.
5. Implement one reported row per independent claim using the matching syntax resource.
6. Review `resources/anti-patterns.md`.
7. For incremental validation, read `resources/partial-testing.md` and prefer affected tags over file or title filters.
8. Run the focused test alone, then its normal suite.
9. Inspect the LiveDoc output for rule violations and follow **Rule Violation Self-Correction** until no unintended violations remain.
10. Apply the false-green validation gate.
11. If the evidence indicates a LiveDoc framework defect, follow **Framework Defect Escalation**.

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

→ **Read `resources/web-testing.md`** to choose jsdom or a real browser, then
**read `resources/playwright.md`** for `useBrowser`, screenshots, lifecycle, and troubleshooting.

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

// Or use globals mode — requires BOTH settings in vitest.config.ts:
//   globals: true
//   setupFiles: ['@swedevtools/livedoc-vitest/setup']
// Note: globals mode only registers BDD keywords (feature, scenario, given, when, then, etc.)
// Specification keywords (specification, rule, ruleOutline) must still be imported explicitly.
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

- **Only step callbacks, `rule`, and `ruleOutline` support `async`**
- `feature`, `scenario`, `scenarioOutline`, `specification`, `background` must be **synchronous**

### Modifiers

```typescript
feature.only("...", fn);     feature.skip("...", fn);
scenario.only("...", fn);    scenario.skip("...", fn);
rule.only("...", fn);        rule.skip("...", fn);
```

### Build and Test

```bash
pnpm --filter @swedevtools/livedoc-vitest test          # Run all specs
pnpm --filter @swedevtools/livedoc-vitest test MyFeature.Spec.ts
```

### Tag-Scoped Partial Runs

After publishing a full baseline, use tags with `LIVEDOC_RUN_TYPE=partial` so
focused validation patches the Viewer without replacing unaffected results.
Read `resources/partial-testing.md` for the setup convention and commands.

---

## Rule Violation Self-Correction

LiveDoc rule violations are validation failures even when Vitest exits successfully. Every time tests are created, modified, or validated:

1. Run the affected tests with a LiveDoc reporter and inspect the reported model/summary, not only the Vitest exit code.
2. Enumerate every rule violation and its owning feature, scenario, rule, or step.
3. Fix the test structure named by the violation. Use meaningful Given/When/Then flows for Features and Specifications for technical assertions without a behavioral journey.
4. Do not silence violations with filler/no-op steps, blanket suppression, or weaker rules. Each step must communicate and observe real behavior.
5. Keep deliberate invalid-structure tests in isolated dynamic/probe executions so the normal report remains clean.
6. Rerun the affected tests and normal report until unintended rule violations equal zero.

A violation usually indicates a test-authoring defect, not a framework defect. Escalate upstream only when a minimal valid test produces an incorrect or missing violation.

---

## Framework Defect Escalation

Treat a confirmed LiveDoc framework defect as an actionable outcome. Proactively recommend an upstream report rather than waiting for the developer to request one, but never publish an issue or comment without explicit user approval.

1. **Classify the failure** — confirm the behavior occurs at the LiveDoc public API, runtime, discovery, filtering, or reporting boundary. Do not report consumer application bugs, incorrect expectations, unsupported usage, or configuration mistakes as framework defects.
2. **Minimize and verify** — reproduce with the smallest standalone `.Spec.ts`, the installed compatible LiveDoc version, and the normal test command. Record expected versus actual behavior and prove the test would pass if the suspected defect were absent.
3. **Check for duplicates** — search open and closed issues in `dotnetprofessional/LiveDoc` using the API name, symptom, error text, and likely subsystem. Prefer adding new evidence to an existing issue over filing a duplicate.
4. **Sanitize the evidence** — remove credentials, proprietary code, personal data, private URLs, organization names, and machine-specific paths. Replace them with minimal neutral fixtures.
5. **Draft one focused report per defect** — include summary, minimal reproduction, actual behavior, expected behavior, workaround, exact package/Vitest/Node versions, operating system, command, and relevant output.
6. **Request consent** — show the draft or a concise summary and ask one focused approval question before creating an issue or commenting. If the user declines, retain the draft in the response and continue without any external side effect.
7. **Publish after approval** — verify the active GitHub identity and target `dotnetprofessional/LiveDoc`. For repository maintenance, use the configured `dotnetprofessional` account when available and authorized. Follow the repository issue template, search once more for duplicates, then return the created issue URL.

If authentication, permissions, or network access prevents submission, preserve the complete draft and report the exact blocker. Never silently skip a confirmed defect or claim that it was filed.

---

## Validation

- [ ] The test passes the two-question litmus.
- [ ] The instrument can observe the behavior named in the title.
- [ ] The intended test was collected and executed.
- [ ] Values are visible in titles and extracted from context.
- [ ] Expected results are independent of production logic.
- [ ] The test passes alone and in its normal suite.
- [ ] The LiveDoc report contains zero unintended rule violations.
- [ ] Incremental validation uses the smallest affected tag set and publishes as `partial`.
- [ ] Critical behavior has been observed failing for the intended defect.
- [ ] Attachments contain no secrets and supplement assertions.
- [ ] Any suspected LiveDoc framework defect was disproved or handled through the escalation workflow.

## Examples

### Positive routing examples
- "Create a BDD test for shipping costs" → Read `resources/bdd-features.md`, write feature/scenario
- "Add data-driven tests for tax" → Read `resources/bdd-features.md`, use scenarioOutline
- "Write spec tests for email validator" → Read `resources/specifications.md`, write specification/rule
- "Write a Playwright test for the login page" → Read `resources/web-testing.md` and `resources/playwright.md`
- "Verify a responsive touch target" → Use a real browser and measure geometry
- "Configure LiveDoc reporter output" → Read `resources/reporter-config.md`
- "Configure LiveDoc coverage" → Read `resources/reporter-config.md`; install the provider matching the Vitest version
- "Generate static HTML test report" → Read `resources/reporter-config.md`
- "Validate changed checkout behavior incrementally" → Read `resources/partial-testing.md`; run affected tags as a partial
- "Tests pass but LiveDoc reports rule violations" → Fix the test semantics and rerun until the normal report is clean
- "This minimal LiveDoc spec reveals a framework bug" → Verify, deduplicate, sanitize, draft, and request approval to report it

### Negative routing examples
- "Create a C# test for shipping" → Use `livedoc-xunit` skill
- "Build a React component" → Use `frontend-design` skill
- "Write a plain vitest test" → No LiveDoc skill needed
- "Convert every low-level test to LiveDoc" → Decline; curate only behavior with lasting documentation value
- "Install AI skills for the team" → Run `npx livedoc-vitest-setup`

## Failure Handling
- Tests fail to compile → check imports, especially `Then as then` alias
- Values are `undefined` → verify single quotes `'value'` not backticks or double quotes
- `ctx.example` undefined → ensure inside `scenarioOutline`/`ruleOutline`, not plain `scenario`/`rule`
- Async hangs → ensure `async` only on step/rule callbacks, not on `feature`/`scenario`
- Playwright `page()` throws → `useBrowser()` must be at module scope; `page()` called inside steps
- Partial run replaces the full Viewer picture → ensure `LIVEDOC_RUN_TYPE=partial` and a full baseline already exists
- Tag filter selects nothing → verify the setup file reads `LIVEDOC_TAGS` and normalizes the `@` prefix
- Reporter issues → Read `resources/reporter-config.md`
- Rule violations remain after a green test run → treat the run as failed and follow **Rule Violation Self-Correction**
- Suspected LiveDoc framework bug → follow **Framework Defect Escalation**; do not publish without user approval
