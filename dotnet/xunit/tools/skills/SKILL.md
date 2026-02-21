---
name: livedoc-xunit
description: Expert guidance for writing and modifying BDD/Gherkin and MSpec-style tests using the SweDevTools.LiveDoc.xUnit framework for C# and .NET. Generates self-documenting xUnit specs with correct attribute usage, value extraction, and living documentation patterns.
---

# LiveDoc xUnit Test Author

## Use this skill when
- Creating new C# test classes using `SweDevTools.LiveDoc.xUnit`
- Modifying existing LiveDoc xUnit tests in `dotnet/xunit`
- Writing BDD feature/scenario tests or MSpec specification/rule tests in C#
- Adding ScenarioOutline or RuleOutline data-driven tests with `[Example]` attributes
- Extracting values from step titles using `ctx.Step.Values`, `ctx.Step.Params`, or method parameters
- Extracting values from Rule/RuleOutline titles using `Rule.Values` and `Rule.Params`
- Debugging or fixing LiveDoc xUnit test failures

## Do not use this skill when
- Writing TypeScript/Vitest tests (use `livedoc-vitest` skill instead)
- Working on non-test C# code (application logic, build scripts)
- Writing plain xUnit tests without LiveDoc BDD/Specification patterns
- Working on the viewer, VS Code extension, or server packages

## Inputs
- `task`: What test to create or modify (feature name, scenario description, or bug to fix)
- `pattern`: BDD/Gherkin (`[Feature]`/`[Scenario]`) or Specification (`[Specification]`/`[Rule]`) — infer from context if not specified
- `target_path`: File path for the C# test class (e.g., `dotnet/xunit/tests/MyFeature.cs`)

## Outputs
- One or more C# test classes with correct LiveDoc xUnit syntax
- Tests that are self-documenting: all inputs and expected outputs visible in step titles and formatted output

## Workflow

### 1. Choose the correct base class and pattern

**BDD/Gherkin pattern** — inherit from `FeatureTest`:
```csharp
[Feature("Feature Title")]
public class MyTests : FeatureTest
{
    public MyTests(ITestOutputHelper output) : base(output) { }
}
```

**Specification pattern** — inherit from `SpecificationTest`:
```csharp
[Specification("Spec Title")]
public class MySpec : SpecificationTest
{
    public MySpec(ITestOutputHelper output) : base(output) { }
}
```

**Base classes**: Use `FeatureTest` for BDD tests, `SpecificationTest` for MSpec tests.

### IMPORTANT: Namespace determines report hierarchy

The **C# namespace** of each test class determines the visual tree structure in the LiveDoc Viewer. The reporter strips the assembly name prefix and converts namespace segments to a folder-like path (e.g., `MyApp.Tests.Checkout.CartSpec` → `Checkout/CartSpec.cs`).

**Pay special attention to namespace organization for optimum test grouping:**

```
MyApp.Tests/
├── Checkout/                    → "Checkout" node in viewer
│   ├── CartSpec.cs              → Checkout/CartSpec.cs
│   └── PaymentSpec.cs           → Checkout/PaymentSpec.cs
├── Shipping/                    → "Shipping" node in viewer
│   └── ShippingCostsSpec.cs     → Shipping/ShippingCostsSpec.cs
└── Auth/                        → "Auth" node in viewer
    └── LoginSpec.cs             → Auth/LoginSpec.cs
```

- **Group related tests** under a common namespace segment for logical grouping in reports
- **Avoid flat namespaces** — a single namespace with all tests produces a flat, hard-to-navigate list
- **Mirror domain boundaries** — align namespace segments with your bounded contexts or feature areas

### 2. Write required usings

```csharp
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core; // For LiveDocContext, StepContext
using Xunit;
using Xunit.Abstractions;
```

### 3. Choose the correct attributes

|                    Attribute                    |    xUnit Base     |            Use Case             |
| ---                                             | ---               | ---                             |
| `[Feature("title")]`                            | Class-level       | BDD feature container           |
| `[Feature("title", Description = "...")]`       | Class-level       | Feature with description        |
| `[Scenario]`                                    | `[Fact]`          | Single BDD scenario             |
| `[Scenario("display name")]`                    | `[Fact]`          | Scenario with custom display    |
| `[Scenario(Description = "...")]`               | `[Fact]`          | Scenario with description       |
| `[ScenarioOutline]`                             | `[Theory]`        | Data-driven scenario            |
| `[ScenarioOutline("display name")]`             | `[Theory]`        | Outline with custom display     |
| `[ScenarioOutline(Description = "...")]`        | `[Theory]`        | Outline with description        |
| `[Example(...)]`                                | `[DataAttribute]` | Data row for outlines           |
| `[Specification("title")]`                      | Class-level       | MSpec specification container   |
| `[Specification("title", Description = "...")]` | Class-level       | Spec with description           |
| `[Rule]`                                        | `[Fact]`          | Single assertion rule           |
| `[Rule("display name")]`                        | `[Fact]`          | Rule with custom display        |
| `[RuleOutline]`                                 | `[Theory]`        | Data-driven rule                |
| `[RuleOutline("display name")]`                 | `[Theory]`        | RuleOutline with custom display |

**Descriptions** are strongly encouraged on all container attributes (`[Feature]`, `[Specification]`) and optionally on test attributes (`[Scenario]`, `[ScenarioOutline]`, `[Rule]`, `[RuleOutline]`). Descriptions appear in the formatted test output and LiveDoc reports, providing context that is often lost — making tests easier to reason about:

```csharp
[Feature("Shopping Cart", Description = @"
    Business rules for the shopping cart checkout flow.
    Covers GST calculation, shipping tiers, and discount codes.")]
public class CartTests : FeatureTest { ... }

[Scenario(Description = "Tests the complete login flow for registered users")]
public void User_logs_in_successfully() { ... }

[Specification("Email Validation", Description = @"
    Rules for validating email addresses across different formats.
    Includes edge cases for international domains and special characters.")]
public class EmailSpec : SpecificationTest { ... }
```

### 4. Write BDD scenarios

**CRITICAL: Embed all inputs and expected outputs in step titles.** This is the core principle of living documentation — readers see what was tested without reading code. Never hardcode values inside step implementations that aren't visible in the title.

```csharp
// ✅ CORRECT: Values in titles, extracted from context
[Scenario(nameof(Free_shipping_in_Australia))]
public void Free_shipping_in_Australia()
{
    Given("the customer is from 'Australia'", ctx =>
    {
        _cart = new ShoppingCart { Country = ctx.Step!.Values[0].AsString() };
    });

    When("the order totals '100.00' dollars", ctx =>
    {
        var total = ctx.Step!.Values[0].AsDecimal();
        _cart.AddItem(new CartItem { Price = total });
        _cart.Calculate();
    });

    Then("shipping is 'Free'", ctx =>
    {
        Assert.Equal(ctx.Step!.Values[0].AsString(), _cart.ShippingType);
    });

    And("GST is '10.00'", ctx =>
    {
        Assert.Equal(ctx.Step!.Values[0].AsDecimal(), _cart.GST);
    });
}

// ❌ WRONG: Values hidden in code — not living documentation
[Scenario]
public void Free_shipping_in_Australia()
{
    Given("the customer is from Australia", () =>
    {
        _cart = new ShoppingCart { Country = "Australia" }; // Value not in title!
    });
    Then("GST is charged", () =>
    {
        Assert.Equal(10.00m, _cart.GST); // What GST? Reader has to read code
    });
}
```

**Step methods available**: `Given`, `When`, `Then`, `And`, `But` — all called via `this.StepName(...)` or just `StepName(...)`. Use the `Action<LiveDocContext>` overload (with `ctx`) to extract values from titles.

### 5. Write ScenarioOutline with Examples

```csharp
[ScenarioOutline(nameof(Calculate_shipping))]
[Example("Australia", 100.00, "Free")]
[Example("Australia", 99.99, "Standard Domestic")]
[Example("New Zealand", 100.00, "Standard International")]
public void Calculate_shipping(string country, decimal total, string expectedType)
{
    this.Given("the customer is from <country>", () =>
    {
        _cart = new ShoppingCart { Country = country };
    });

    this.When("the order totals <total>", () =>
    {
        _cart.Total = total;
        _cart.Calculate();
    });

    this.Then("shipping type is <expectedType>", () =>
    {
        Assert.Equal(expectedType, _cart.ShippingType);
    });
}
```

Example data is **automatically injected** — method parameters are typed by xUnit and placeholder replacement in output happens automatically. No manual setup needed.

### 6. Write Specification rules

Rules must also follow the self-documenting principle — **embed values in the rule title**, not hidden in code. Both `[Rule]` and `[RuleOutline]` support **inline value extraction** via `Rule.Values` and `Rule.Params`, mirroring how steps use `ctx.Step.Values`.

```csharp
[Specification("Calculator Operations", Description = @"
    Core arithmetic rules. Values in rule titles make
    the specification readable without inspecting code.")]
public class CalculatorSpec : SpecificationTest
{
    public CalculatorSpec(ITestOutputHelper output) : base(output) { }

    // ✅ CORRECT: Values visible in title AND extracted from Rule.Values
    [Rule("Adding '5' and '3' returns '8'")]
    public void Adding_positive_numbers()
    {
        var (a, b, expected) = Rule.Values.As<int, int, int>();
        Assert.Equal(expected, a + b);
    }

    // ✅ CORRECT: Named parameters extracted from Rule.Params
    [Rule("Subtracting <b:3> from <a:10> returns <expected:7>")]
    public void Subtracting_with_named_params()
    {
        var a = Rule.Params["a"].AsInt();
        var b = Rule.Params["b"].AsInt();
        var expected = Rule.Params["expected"].AsInt();
        Assert.Equal(expected, a - b);
    }

    // ✅ CORRECT: RuleOutline with Example data via method parameters
    [RuleOutline("Adding '<a>' and '<b>' returns '<result>'")]
    [Example(1, 2, 3)]
    [Example(5, 5, 10)]
    [Example(-1, 1, 0)]
    public void Addition_examples(int a, int b, int result)
    {
        Assert.Equal(result, a + b);
    }

    // ✅ CORRECT: RuleOutline with title value extraction + Example data
    // Rule.Values/Params from title are accessible alongside Example parameters
    [RuleOutline("Discount of '10' percent on orders over '100' dollars")]
    [Example(150, 15)]
    [Example(200, 20)]
    public void Discount_examples(int orderTotal, int expectedDiscount)
    {
        var (discountPct, threshold) = Rule.Values.As<int, int>(); // From title
        Assert.Equal(expectedDiscount, orderTotal * discountPct / 100); // Mixed
    }
}

// ❌ WRONG: Rule title hides what's being tested
[Rule("Adding positive numbers works")]
public void Adding_positive_numbers()
{
    var result = 5 + 3;       // What numbers? Reader can't tell from title
    Assert.Equal(8, result);  // What's expected? Hidden in code
}
```

### 7. Use method name placeholders

When no display name is provided in the attribute, `_ALLCAPS` segments in method names become placeholders matched to parameters:

```csharp
[RuleOutline]
[Example(10, 2, 5)]
[Example(100, 10, 10)]
public void Dividing_A_by_B_returns_RESULT(int a, int b, int result)
{
    Assert.Equal(result, a / b);
}
// Displays: "Dividing '10' by '2' returns '5'"
```

Rules:
- `_ALLCAPS` segments match parameter names case-insensitively
- `_A` matches parameter `a`, `A`, or `_a`
- Unmatched ALLCAPS segments remain as literal text

### 8. Use value extraction APIs

**Quoted values** — `ctx.Step.Values`:
```csharp
Given("a step with value '42' and name 'Alice'", ctx =>
{
    int num = ctx.Step!.Values[0].AsInt();        // 42
    string name = ctx.Step!.Values[1].AsString(); // "Alice"
});
```

**Typed tuple deconstruction**:
```csharp
When("I add '5' items at '9.99' each", ctx =>
{
    var (qty, price) = ctx.Step!.Values.As<int, decimal>();
    // qty = 5, price = 9.99m
});
```

**Named parameters** — `ctx.Step.Params`:
```csharp
Given("a user with <email:john@test.com> and <age:25>", ctx =>
{
    string email = ctx.Step!.Params["email"].AsString(); // "john@test.com"
    int age = ctx.Step!.Params["age"].AsInt();           // 25
});
// Displays: "a user with john@test.com and 25"
```

**LiveDocValue type conversions**:
| Method          | Returns                            |
| ---             | ---                                |
| `.AsString()`   | `string`                           |
| `.AsInt()`      | `int`                              |
| `.AsLong()`     | `long`                             |
| `.AsDecimal()`  | `decimal`                          |
| `.AsDouble()`   | `double`                           |
| `.AsBool()`     | `bool`                             |
| `.AsDateTime()` | `DateTime`                         |
| `.As<T>()`      | Any parseable type (enums, arrays) |

### 9. Async support

Steps support async via `Func<Task>` and `Func<LiveDocContext, Task>`:
```csharp
[Scenario("Async operation")]
public async Task Async_test()
{
    await this.Given("setup", async () =>
    {
        await Task.Delay(10);
    });

    await this.When("action", async () =>
    {
        result = await PerformAsync();
    });

    // Mix sync and async steps freely
    this.Then("sync assertion", () =>
    {
        Assert.NotNull(result);
    });
}
```

### 10. Build and test

```powershell
# Build the project
cd dotnet/xunit
dotnet build

# Run all tests (samples)
cd samples
dotnet test

# Or use the helper script from repo root
./scripts/run-dotnet-tests.ps1

# With LiveDoc Viewer integration
./scripts/run-dotnet-tests.ps1 -WithViewer
```

### 11. Validate test quality

- [ ] Correct base class used: `FeatureTest` for BDD, `SpecificationTest` for MSpec
- [ ] All test data appears in step title strings (self-documenting)
- [ ] `Description` provided on `[Feature]` and `[Specification]` attributes to give context
- [ ] Values extracted via `ctx.Step.Values` or `ctx.Step.Params` — never hardcoded
- [ ] Constructor accepts `ITestOutputHelper output` and passes to `base(output)`
- [ ] `[Example]` parameter count matches method parameter count
- [ ] Tests pass: `dotnet test`

## Error Handling

The framework provides descriptive exceptions:

|            Exception            |                       Cause                        |                 Fix                  |
| ---                             | ---                                                | ---                                  |
| `LiveDocConversionException`    | Invalid type conversion (e.g., `'abc'.AsInt()`)    | Check quoted value format            |
| `LiveDocValueIndexException`    | Accessing `Values[n]` beyond available count       | Verify quoted value count in title   |
| `LiveDocParamNotFoundException` | Accessing `Params["x"]` for non-existent parameter | Check `<name:value>` syntax in title |

All exceptions include the step title for context.

## Features NOT Supported (by design)

| Feature               | C# Alternative                                 |
| ---                   | ---                                            |
| Data Tables           | Use method parameters or constructor injection |
| Doc Strings           | Use normal string variables                    |
| Background            | Use class constructor or `IClassFixture<T>`    |
| `ctx.Example` dynamic | Method parameters provide typed access already |
| Tags/filtering        | Coming in future release                       |

## Validation
- [ ] Correct base class used: `FeatureTest` for BDD, `SpecificationTest` for MSpec
- [ ] All test data appears in step title strings (self-documenting)
- [ ] `Description` provided on container attributes for context
- [ ] Values extracted via `ctx.Step.Values` or `ctx.Step.Params`, never hardcoded
- [ ] Constructor accepts `ITestOutputHelper` and passes to `base(output)`
- [ ] `[Example]` parameter count matches method parameter count
- [ ] Tests pass: `dotnet test`

## Examples

### Positive routing examples
- "Create a C# BDD test for shipping costs" → Write class inheriting FeatureTest with [Feature]/[Scenario]
- "Add ScenarioOutline with Examples for tax calculation" → Use [ScenarioOutline], [Example] attributes with typed parameters
- "Fix value extraction — step says 500 but code checks 200" → Use ctx.Step.Values[0].AsInt()
- "Write a Specification with Rules for email validation" → Use [Specification]/[Rule]/[RuleOutline] with SpecificationTest

### Negative routing examples
- "Create a TypeScript spec for the parser" → Use `livedoc-vitest` skill instead
- "Build a React component for test results" → Use `frontend-design` skill
- "Write a plain xUnit Fact test" → No LiveDoc skill needed
- "Fix a bug in the LiveDocContext class" → Framework development, handle directly

## Failure handling
- If tests don't appear in Test Explorer, verify `[Scenario]` or `[Rule]` attributes are present — they inherit from `[Fact]`/`[Theory]`
- If placeholder replacement doesn't work in outline output, verify `<ParamName>` in step titles matches method parameter names
- If `ctx.Step` is null, ensure you're using the `Action<LiveDocContext>` overload, not `Action`
- If conversion fails, check the exception message — it includes the step title and available values
- Run `dotnet test` to verify all tests pass after changes
