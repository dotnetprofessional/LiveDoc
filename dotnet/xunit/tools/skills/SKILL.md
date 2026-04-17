---
name: livedoc-xunit
description: Expert guidance for writing and modifying BDD/Gherkin and MSpec-style tests using the SweDevTools.LiveDoc.xUnit framework for C# and .NET. Generates self-documenting xUnit specs with correct attribute usage, value extraction, and living documentation patterns. Also covers Journey testing via annotated .http files.
sdk_version: 0.2.0
---

# LiveDoc xUnit Test Author

> **Progressive disclosure**: This file is the routing hub. Read the appropriate sub-resource for full API details.

## Version Check

This skill targets **SweDevTools.LiveDoc.xUnit v0.2.0**. Before writing tests, verify the installed version matches:

```bash
dotnet list package | grep -i livedoc
```

If the installed version differs from `0.2.0`, tell the developer: *"Your LiveDoc skill files target v0.2.0 but you have vX.Y.Z installed. Run `dotnet msbuild -t:LiveDocInstallSkills` to update the skill files, or check the changelog for breaking changes."*

## Use this skill when
- Creating or modifying C# test classes using `SweDevTools.LiveDoc.xUnit`
- Writing BDD `[Feature]`/`[Scenario]` tests → **read `resources/features.md`**
- Writing MSpec `[Specification]`/`[Rule]` tests → **read `resources/specifications.md`**
- Creating `.http` journey files or `.Response.json` contracts → **read `resources/journey-testing.md`**
- Debugging or fixing any LiveDoc xUnit test failures

## Do not use this skill when
- Writing TypeScript/Vitest tests (use `livedoc-vitest` skill instead)
- Working on non-test C# code (application logic, build scripts)
- Writing plain xUnit tests without LiveDoc BDD/Specification patterns
- Working on the viewer, VS Code extension, or server packages

---

## Three Test Patterns

### 1. BDD Features (`resources/features.md`)

**Use when**: Testing user journeys, business flows, acceptance criteria. Audience is business + technical. Tests read as Given/When/Then narratives.

```csharp
[Feature("Shipping Costs", Description = "Business rules for shipping fees")]
public class ShippingTests : FeatureTest
{
    public ShippingTests(ITestOutputHelper output) : base(output) { }

    [Scenario("Free shipping in Australia")]
    public void Free_shipping()
    {
        Given("the customer is from 'Australia'", ctx =>
            _cart = new ShoppingCart { Country = ctx.Step!.Values[0].AsString() });
        When("the order totals '100.00' dollars", ctx =>
            { _cart.Total = ctx.Step!.Values[0].AsDecimal(); _cart.Calculate(); });
        Then("shipping is 'Free'", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsString(), _cart.ShippingType));
    }

    [ScenarioOutline]
    [Example("Australia", 100.00, "Free")]
    [Example("New Zealand", 50.00, "Standard International")]
    public void Calculate_shipping(string country, decimal total, string expectedType)
    {
        Given("customer from <country>", () => _cart = new ShoppingCart { Country = country });
        When("order totals <total>", () => { _cart.Total = total; _cart.Calculate(); });
        Then("shipping is <expectedType>", () => Assert.Equal(expectedType, _cart.ShippingType));
    }
}
```

**Key concepts**: `FeatureTest` base class, `[Feature]`, `[Scenario]`, `[ScenarioOutline]`, `[Example]`, Given/When/Then/And/But steps, `ctx.Step!.Values`, `ctx.Step!.Params`, async steps.

→ **Read `resources/features.md`** for complete attribute reference, all step method overloads, value extraction API, tuple deconstruction, named parameters, async patterns, error handling, and validation checklist.

### 2. Specifications (`resources/specifications.md`)

**Use when**: Testing APIs, utilities, algorithms, data-driven edge cases. Developer-only audience. No Given/When/Then ceremony — direct assertions in rules.

```csharp
[Specification("Calculator Operations", Description = "Core arithmetic rules")]
public class CalculatorSpec : SpecificationTest
{
    public CalculatorSpec(ITestOutputHelper output) : base(output) { }

    [Rule("Adding '5' and '3' returns '8'")]
    public void Addition()
    {
        var (a, b, expected) = Rule.Values.As<int, int, int>();
        Assert.Equal(expected, Add(a, b));
    }

    [Rule("Subtracting <b:3> from <a:10> returns <expected:7>")]
    public void Subtraction()
    {
        Assert.Equal(Rule.Params["expected"].AsInt(),
            Rule.Params["a"].AsInt() - Rule.Params["b"].AsInt());
    }

    [RuleOutline("Adding '<a>' and '<b>' returns '<result>'")]
    [Example(1, 2, 3)]
    [Example(-5, 5, 0)]
    public void Addition_examples(int a, int b, int result)
    {
        Assert.Equal(result, Add(a, b));
    }
}
```

**Key concepts**: `SpecificationTest` base class, `[Specification]`, `[Rule]`, `[RuleOutline]`, `[Example]`, `Rule.Values`, `Rule.Params`, method name placeholders (`_ALLCAPS_`), async rules.

→ **Read `resources/specifications.md`** for complete attribute reference, value extraction API, tuple deconstruction, named parameters, method name placeholder syntax, error handling, and validation checklist.

### 3. Journey Testing (`resources/journey-testing.md`)

**Use when**: End-to-end HTTP API testing. Annotated `.http` files scaffold LiveDoc xUnit tests that execute against a real server and validate JSON response contracts.

```http
# Feature: Widget API
# Scenario: Create and verify a widget

# Given a new widget is created
# @name createWidget
POST {{baseUrl}}/api/widgets
Content-Type: application/json

{ "name": "test-widget", "type": "standard" }

?? status == 201

###

# Then the widget can be retrieved
# @name getWidget
GET {{baseUrl}}/api/widgets/test-widget

?? status == 200
```

**Key concepts**: BDD comment annotations (`# Feature:`, `# Scenario:`, `# Given/When/Then`, `# @name`), `.Response.json` contract files, `property-rules.txt` for dynamic fields, capture mode, MSBuild configuration, generated `.Journey.cs` test classes.

**Library-provided infrastructure** (`SweDevTools.LiveDoc.xUnit.Journeys` namespace): `JourneyFixtureBase` (server lifecycle + httpYac runner), `JourneyResult` / `StepResult` (output parser), `JsonAssertions` / `PropertyRules` (JSON comparison engine). Users create a minimal fixture subclass specifying their server path — all heavy lifting is built-in.

→ **Read `resources/journey-testing.md`** for complete .http format reference, BDD annotation table, CRUD example, contract pattern, capture mode CLI/MSBuild, property-rules syntax, fixture setup, and validation checklist.

---

## Shared Concepts

### Namespace = Report Hierarchy

The C# namespace determines the visual tree in the LiveDoc Viewer. Mirror domain boundaries:

```
MyApp.Tests/
├── Checkout/       → "Checkout" node in viewer
│   └── CartSpec.cs
├── Shipping/       → "Shipping" node
│   └── CostsSpec.cs
└── Auth/           → "Auth" node
    └── LoginSpec.cs
```

### Required Usings

```csharp
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;
```

### CRITICAL: Self-Documenting Tests

**Embed all inputs and expected outputs in step/rule titles.** Extract them using the context API. Never hardcode values that appear in titles.

```csharp
// ✅ Values in title AND extracted from context
Given("a user with balance '500' dollars", ctx =>
    account.Balance = ctx.Step!.Values[0].AsDecimal());

// ✅ Named parameters for clarity
Given("a user with <balance:500> dollars", ctx =>
    account.Balance = ctx.Step!.Params["balance"].AsDecimal());

// ❌ BAD: Value drift risk — title says 500, code uses 200
Given("a user with balance '500' dollars", ctx =>
    account.Balance = 200);

// ❌ WORSE: Values hidden — not living documentation
Given("a user with some balance", () =>
    account.Balance = 500);
```

### Value Extraction Quick Reference

**Both Features and Specifications** share the same value extraction API:

| Syntax in Title | Access in Features | Access in Specifications |
| --------------- | ------------------ | ------------------------ |
| `'value'` (quoted) | `ctx.Step!.Values[0]` | `Rule.Values[0]` |
| `<name:value>` (named) | `ctx.Step!.Params["name"]` | `Rule.Params["name"]` |
| `<Placeholder>` (outline) | Method parameter | Method parameter |

**Conversion methods** (on `LiveDocValue`): `.AsString()`, `.AsInt()`, `.AsLong()`, `.AsDecimal()`, `.AsDouble()`, `.AsBool()`, `.AsDateTime()`, `.As<T>()`

**Typed tuple deconstruction** (up to 6): `var (a, b, c) = ctx.Step!.Values.As<int, string, decimal>()`

### Build and Test

```powershell
cd dotnet/xunit && dotnet build
cd samples && dotnet test
```

---

## Routing Examples

### Positive (USE this skill)
- "Create a BDD test for shipping costs" → Read `resources/features.md`, write `FeatureTest`
- "Add data-driven tests for tax calculation" → Read `resources/features.md`, use `[ScenarioOutline]`
- "Write unit tests for the email validator" → Read `resources/specifications.md`, write `SpecificationTest`
- "Fix value drift — step says 500 but code checks 200" → Use `ctx.Step!.Values[0]` extraction
- "Create HTTP journey tests for Users API" → Read `resources/journey-testing.md`
- "Set up journey testing in my project" → Read `resources/journey-testing.md`

### Negative (DO NOT use this skill)
- "Create a TypeScript spec" → Use `livedoc-vitest` skill
- "Build a React component" → Use `frontend-design` skill
- "Write a plain xUnit Fact test" → No LiveDoc skill needed
- "Fix a bug in LiveDocContext" → Framework development, handle directly

## Failure Handling
- Tests missing from Test Explorer → verify `[Scenario]` or `[Rule]` attributes are present
- `ctx.Step` is null → use the `Action<LiveDocContext>` overload, not `Action`
- Conversion fails → check exception message — includes step title and available values
- Placeholder not replaced → `<Param>` must match method parameter name exactly
- Journey failures → see `resources/journey-testing.md` → Failure Handling section
