# BDD/Gherkin Features — Full API Reference

> **Load this resource** when writing or modifying `[Feature]`, `[Scenario]`, `[ScenarioOutline]`, or step methods (Given/When/Then/And/But) in C# LiveDoc xUnit tests.

## Required Usings

```csharp
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;
```

## Base Class: `FeatureTest`

All BDD tests inherit from `FeatureTest`:

```csharp
[Feature("Beautiful Tea Shipping Costs")]
public class ShippingCostsTests : FeatureTest
{
    public ShippingCostsTests(ITestOutputHelper output) : base(output) { }
}
```

### Context Properties (inherited)

| Property   | Type               | Description                                |
| ---------- | ------------------ | ------------------------------------------ |
| `Feature`  | `FeatureContext`   | Feature title, description, tags           |
| `Scenario` | `ScenarioContext`  | Current scenario name, description, tags, steps |
| `Example`  | `dynamic?`         | Current outline example row (ScenarioOutline only) |

---

## Attributes

### `[Feature]` — Class Attribute

```csharp
// Minimal — title auto-derived from class name
[Feature]
public class MyTests : FeatureTest { ... }

// Explicit title
[Feature("Shipping Costs")]
public class ShippingCostsTests : FeatureTest { ... }

// Title + description (strongly encouraged)
[Feature("Shipping Costs", Description = @"
    Business rules for calculating shipping fees
    based on customer country and order total.
")]
public class ShippingCostsTests : FeatureTest { ... }
```

| Parameter     | Type     | Required | Description                     |
| ------------- | -------- | -------- | ------------------------------- |
| `name`        | `string` | No       | Feature title (defaults to formatted class name) |
| `Description` | `string` | No       | Multi-line description text     |

### `[Scenario]` — Method Attribute (single test)

Inherits from xUnit's `[Fact]`. Each scenario is one test.

```csharp
// Auto-derived from method name (underscores → spaces)
[Scenario]
public void Free_shipping_in_Australia() { ... }

// Explicit name (recommended for readability)
[Scenario("Free shipping in Australia")]
public void Free_shipping_in_Australia() { ... }

// Using nameof for refactor safety
[Scenario(nameof(Free_shipping_in_Australia))]
public void Free_shipping_in_Australia() { ... }
```

| Parameter     | Type     | Required | Description                |
| ------------- | -------- | -------- | -------------------------- |
| `testMethodName` | `string` | No    | Auto-populated via `[CallerMemberName]` |
| `Description` | `string` | No       | Scenario description       |

### `[ScenarioOutline]` — Method Attribute (data-driven)

Inherits from xUnit's `[Theory]`. Runs once per `[Example]` row.

```csharp
[ScenarioOutline(nameof(Calculate_GST_and_shipping))]
[Example("Australia", 99.99, 9.999, "Standard Domestic")]
[Example("Australia", 100.00, 10.00, "Free")]
[Example("New Zealand", 100.00, 0, "Standard International")]
public void Calculate_GST_and_shipping(
    string CustomerCountry,
    decimal OrderTotal,
    decimal ExpectedGST,
    string ExpectedShippingRate)
{
    Given("the customer is from <CustomerCountry>", () =>
    {
        _cart = new ShoppingCart { Country = CustomerCountry };
    });

    When("the customer's order totals <OrderTotal>", () =>
    {
        _cart.AddItem(new CartItem { Name = "Tea", Price = OrderTotal });
        _cart.Calculate();
    });

    Then("the customer pays <ExpectedGST> GST", () =>
    {
        Assert.Equal(ExpectedGST, Math.Round(_cart.GST, 3));
    });

    And("they are charged the <ExpectedShippingRate> shipping rate", () =>
    {
        Assert.Equal(ExpectedShippingRate, _cart.ShippingType);
    });
}
```

**Key rules:**
- `<ParamName>` placeholders in step titles are replaced with actual values in test output
- Method parameters match `[Example]` values positionally
- Parameter count in `[Example]` must match method parameter count exactly

### `[Example]` — Data Row Attribute

```csharp
[Example("Australia", 100.00, "Free")]      // string, decimal, string
[Example("New Zealand", 50.00, "Standard")]  // same types, different values
```

- Accepts `params object[] data` — positional, not named
- Stack multiple `[Example]` on one method for multiple test runs

### `[Tag]` — Class or Method Attribute

```csharp
[Tag("smoke, regression")]
[Feature("Login")]
public class LoginTests : FeatureTest { ... }
```

- Comma-separated tags parsed into `string[]`
- Tags from class and method are merged with deduplication

---

## Step Methods

All step methods are defined on `FeatureTest` and have four overloads:

```csharp
// Sync without context
Given("step title", () => { /* code */ });

// Sync with context (for value extraction)
Given("step title with 'value'", ctx => { var v = ctx.Step!.Values[0]; });

// Async without context
await Given("step title", async () => { await DoSomething(); });

// Async with context
await Given("step with 'value'", async ctx => { await DoSomething(ctx.Step!.Values[0].AsInt()); });
```

Available steps: **`Given`**, **`When`**, **`Then`**, **`And`**, **`But`**

All steps can be called with `this.Given(...)` or just `Given(...)`.

### Async Support

**Only steps support `async`** — the scenario method itself can be `async Task`, but step lambdas are where async work happens:

```csharp
[Scenario("Async shipping calculation")]
public async Task Async_shipping_test()
{
    await Given("a customer from Australia", async () =>
    {
        await Task.Delay(10); // Simulate async setup
        _cart = new ShoppingCart { Country = "Australia" };
    });

    await When("we calculate shipping", async () =>
    {
        await Task.Delay(5);
        _cart.Calculate();
    });

    // Sync step in an async scenario — no await needed
    Then("shipping should be Free", () =>
    {
        Assert.Equal("Free", _cart.ShippingType);
    });
}
```

---

## Value Extraction

### CRITICAL: Self-Documenting Tests

**Embed all inputs and expected outputs in step titles.** Extract them using the context API. Never hardcode values that appear in titles.

```csharp
// ✅ CORRECT: Values in titles, extracted from context
[Scenario]
public void Free_shipping_in_Australia()
{
    Given("the customer is from 'Australia'", ctx =>
    {
        _cart = new ShoppingCart { Country = ctx.Step!.Values[0].AsString() };
    });

    When("the order totals '100.00' dollars", ctx =>
    {
        _cart.Total = ctx.Step!.Values[0].AsDecimal();
        _cart.Calculate();
    });

    Then("shipping is 'Free'", ctx =>
    {
        Assert.Equal(ctx.Step!.Values[0].AsString(), _cart.ShippingType);
    });
}

// ❌ WRONG: Values hidden in code — not living documentation
Given("the customer is from Australia", () =>
{
    _cart = new ShoppingCart { Country = "Australia" }; // Value not in title!
});

// ❌ WRONG: Value drift — title says 100, code uses 200
When("the order totals '100' dollars", ctx =>
{
    _cart.Total = 200; // Doesn't match title!
});
```

### Quoted Values — `ctx.Step!.Values`

Single quotes in titles are auto-extracted and type-coerced:

```csharp
Given("a step with a single value '42'", ctx =>
{
    int val = ctx.Step!.Values[0].AsInt(); // 42
});

When("I add '5' items of 'Byron Breakfast Tea' at '9.99' each", ctx =>
{
    int qty = ctx.Step!.Values[0].AsInt();        // 5
    string name = ctx.Step!.Values[1].AsString();  // "Byron Breakfast Tea"
    decimal price = ctx.Step!.Values[2].AsDecimal(); // 9.99
});
```

### Tuple Deconstruction

```csharp
// Direct deconstruction (returns LiveDocValue tuples)
When("I purchase '3' units of 'Green Tea' for '15.50'", ctx =>
{
    var (q, p, c) = ctx.Step!.Values;
    int qty = q.AsInt();
    string product = p.AsString();
    decimal cost = c.AsDecimal();
});

// Typed tuple deconstruction (preferred — cleaner)
When("I purchase '7' units of 'Oolong Tea' for '22.99'", ctx =>
{
    var (qty, product, cost) = ctx.Step!.Values.As<int, string, decimal>();
    // qty=7, product="Oolong Tea", cost=22.99
});
```

Typed deconstruction supports up to 6 values: `.As<T1, T2>()` through `.As<T1, T2, T3, T4, T5, T6>()`.

### Named Parameters — `ctx.Step!.Params`

Use `<name:value>` syntax for named, self-documenting parameters:

```csharp
Given("a user with email <email:john@example.com> and age <age:25>", ctx =>
{
    string email = ctx.Step!.Params["email"].AsString();  // "john@example.com"
    int age = ctx.Step!.Params["age"].AsInt();             // 25
});
```

- **Case-insensitive** lookup: `Params["EMAIL"]` works too
- **Display title**: `<email:john@example.com>` renders as `john@example.com` in output
- Check existence: `ctx.Step!.Params.ContainsKey("email")` or `TryGetValue("email", out var val)`

### LiveDocValue Conversion Methods

| Method         | Returns    | Example                    |
| -------------- | ---------- | -------------------------- |
| `.AsString()`  | `string`   | `"hello"`                  |
| `.AsInt()`     | `int`      | `42`                       |
| `.AsLong()`    | `long`     | `9999999999L`              |
| `.AsDecimal()` | `decimal`  | `9.99m`                    |
| `.AsDouble()`  | `double`   | `3.14159`                  |
| `.AsBool()`    | `bool`     | `true` / `false`           |
| `.AsDateTime()`| `DateTime` | `2024-01-15`               |
| `.As<T>()`     | `T`        | Enums, arrays, Guid, etc.  |

**Special As<T> types:**
```csharp
// Enum
Given("a day value <day:Monday>", ctx =>
    ctx.Step!.Params["day"].As<DayOfWeek>()); // DayOfWeek.Monday

// Array (JSON syntax in quotes)
Given("product IDs '[101, 102, 103]'", ctx =>
    ctx.Step!.Values[0].As<int[]>()); // [101, 102, 103]

// String array
Given("tags '[\"sale\", \"new\"]'", ctx =>
    ctx.Step!.Values[0].As<string[]>()); // ["sale", "new"]
```

All conversions use `CultureInfo.InvariantCulture`.

### StepContext Properties

| Property        | Type                    | Description                                   |
| --------------- | ----------------------- | --------------------------------------------- |
| `Title`         | `string`                | Original step description as written           |
| `DisplayTitle`  | `string`                | Step with `<name:value>` replaced by value only |
| `Type`          | `string`                | Step keyword: `"Given"`, `"When"`, `"Then"`, `"and"`, `"but"` |
| `Values`        | `LiveDocValueArray`     | Quoted values by index                         |
| `ValuesRaw`     | `string[]`              | Raw string values before coercion              |
| `Params`        | `LiveDocValueDictionary` | Named parameters by name (case-insensitive)   |
| `ParamsRaw`     | `IReadOnlyDictionary<string, string>` | Raw parameter strings |

---

## Complete Feature Example

```csharp
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;

namespace MyApp.Tests.Checkout;

[Feature("Shopping Cart Checkout", Description = @"
    Validates the complete checkout flow including
    cart totals, tax calculation, and payment processing.
")]
public class CheckoutTests : FeatureTest
{
    private ShoppingCart _cart = null!;

    public CheckoutTests(ITestOutputHelper output) : base(output) { }

    [Scenario("Customer checks out with a single item")]
    public void Single_item_checkout()
    {
        Given("a customer with '1' item priced at '29.99'", ctx =>
        {
            var (qty, price) = ctx.Step!.Values.As<int, decimal>();
            _cart = new ShoppingCart();
            _cart.AddItem(new CartItem { Quantity = qty, Price = price });
        });

        When("the customer proceeds to checkout", () =>
        {
            _cart.Calculate();
        });

        Then("the subtotal is '29.99'", ctx =>
        {
            Assert.Equal(ctx.Step!.Values[0].AsDecimal(), _cart.Subtotal);
        });

        And("the total including tax is '32.99'", ctx =>
        {
            Assert.Equal(ctx.Step!.Values[0].AsDecimal(), _cart.Total);
        });
    }

    [ScenarioOutline("Apply discount codes")]
    [Example("SAVE10", 10, 90.00)]
    [Example("SAVE20", 20, 80.00)]
    [Example("EXPIRED", 0, 100.00)]
    public void Apply_discount_codes(string code, int discountPct, decimal expectedTotal)
    {
        Given("a cart totaling '100.00'", ctx =>
        {
            _cart = new ShoppingCart();
            _cart.AddItem(new CartItem { Price = ctx.Step!.Values[0].AsDecimal() });
        });

        When("the customer applies code <code>", () =>
        {
            _cart.ApplyDiscount(code);
        });

        Then("the discount is <discountPct> percent", () =>
        {
            Assert.Equal(discountPct, _cart.DiscountPercent);
        });

        And("the total is <expectedTotal>", () =>
        {
            Assert.Equal(expectedTotal, _cart.Total);
        });
    }
}
```

---

## Error Handling

| Exception                     | Cause                                          | Fix                                          |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------- |
| `LiveDocConversionException`  | Invalid type conversion (e.g., `'abc'.AsInt()`) | Check quoted value format in title           |
| `LiveDocValueIndexException`  | `Values[n]` beyond available count              | Verify quoted value count matches index used |
| `LiveDocParamNotFoundException` | `Params["x"]` for non-existent parameter      | Check `<name:value>` syntax in title         |
| `ctx.Step` is `null`          | Using `Action` overload instead of `Action<LiveDocContext>` | Use the `ctx =>` lambda overload  |
| Test not in Test Explorer     | Missing `[Scenario]` attribute                  | Add `[Scenario]` — it inherits from `[Fact]` |
| Placeholder not replaced      | `<Param>` doesn't match method parameter name   | Matching is case-insensitive; check spelling |

All exceptions include the step title and available values/params for easy debugging.

---

## Features NOT Supported (by design)

| Gherkin Feature | C# Alternative                              |
| --------------- | ------------------------------------------- |
| Data Tables     | Use method parameters or constructor injection |
| Doc Strings     | Use normal string variables                 |
| Background      | Use class constructor or `IClassFixture<T>` |

---

## Validation Checklist

- [ ] Class inherits `FeatureTest` and has `[Feature]` attribute
- [ ] `Description` provided on `[Feature]` attribute
- [ ] Constructor accepts `ITestOutputHelper` and passes to `base(output)`
- [ ] Each scenario method has `[Scenario]` or `[ScenarioOutline]` attribute
- [ ] All test data appears in step title strings (self-documenting)
- [ ] Values extracted via `ctx.Step!.Values` or `ctx.Step!.Params`, never hardcoded
- [ ] `[Example]` parameter count matches method parameter count
- [ ] `<Placeholder>` names in step titles match method parameter names (case-insensitive)
- [ ] Async steps use `await` and the method returns `async Task`
- [ ] Tests pass: `dotnet test`
