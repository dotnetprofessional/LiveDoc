# LiveDoc .NET API Specification

> **Status:** Design Complete - Ready for Implementation  
> **Version:** 1.0  
> **Last Updated:** 2026-02-06

This document defines the API specification for LiveDoc .NET (SWEDevTools.LiveDoc.xUnit). It provides a subset of the Vitest LiveDoc API adapted for idiomatic C# usage.

---

## Design Principles

1. **Self-Documenting Tests** - All inputs and expected outputs should be visible in test output
2. **Type Safety** - Leverage C#'s type system wherever possible
3. **Minimal Ceremony** - No boilerplate when not needed
4. **Fail Fast** - Invalid test data should throw immediately with clear errors
5. **Culture Invariant** - All conversions use `CultureInfo.InvariantCulture`

---

## Context Structure

The `ctx` object provides access to step metadata and extracted values:

```csharp
public class LiveDocContext
{
    public FeatureContext Feature { get; }      // Feature metadata (read-only)
    public ScenarioContext Scenario { get; }    // Current scenario metadata (read-only)
    public StepContext Step { get; }            // Current step with extracted values
}

public class StepContext
{
    public string Title { get; }                // Original step title
    public string DisplayTitle { get; }         // With placeholders replaced
    public string Type { get; }                 // "Given", "When", "Then", etc.
    
    // Extracted values from quoted strings: 'value'
    public LiveDocValue[] Values { get; }
    public string[] ValuesRaw { get; }
    
    // Extracted named parameters: <name:value>
    public LiveDocValueDictionary Params { get; }
    public Dictionary<string, string> ParamsRaw { get; }
}
```

**Note:** For ScenarioOutline/RuleOutline, use method parameters directly for example data (already typed via xUnit).

---

## LiveDocValue Wrapper

All extracted values return `LiveDocValue` which provides fluent type conversion:

```csharp
public class LiveDocValue
{
    private readonly object? _raw;
    
    // Convenience methods - throw on invalid conversion (dev error)
    // All use CultureInfo.InvariantCulture for consistent behavior
    public string AsString() => _raw?.ToString() ?? "";
    public int AsInt() => Convert.ToInt32(_raw, CultureInfo.InvariantCulture);
    public long AsLong() => Convert.ToInt64(_raw, CultureInfo.InvariantCulture);
    public decimal AsDecimal() => Convert.ToDecimal(_raw, CultureInfo.InvariantCulture);
    public double AsDouble() => Convert.ToDouble(_raw, CultureInfo.InvariantCulture);
    public bool AsBool() => Convert.ToBoolean(_raw, CultureInfo.InvariantCulture);
    public DateTime AsDateTime() => Convert.ToDateTime(_raw, CultureInfo.InvariantCulture);
    
    // Generic for any type (including enums, arrays)
    public T As<T>() => (T)Convert.ChangeType(_raw, typeof(T), CultureInfo.InvariantCulture);
    
    // Raw value access
    public object? Raw => _raw;
}
```

### Tuple Deconstruction Extensions

```csharp
public static class LiveDocValueExtensions
{
    // Basic deconstruction (still need .AsX() calls)
    public static void Deconstruct(this LiveDocValue[] values, 
        out LiveDocValue v1, out LiveDocValue v2) { ... }
    
    // Typed deconstruction - get typed values directly
    public static (T1, T2) As<T1, T2>(this LiveDocValue[] values)
        => (values[0].As<T1>(), values[1].As<T2>());
    
    public static (T1, T2, T3) As<T1, T2, T3>(this LiveDocValue[] values)
        => (values[0].As<T1>(), values[1].As<T2>(), values[2].As<T3>());
    
    // Up to 6 parameters supported
}
```

### Error Handling

All conversions fail-fast with descriptive errors including step context:

```
LiveDocConversionException: Cannot convert '' to Int32 
  in step: "Given the user has '' items"

LiveDocValueIndexException: Index 1 out of range (1 values available)
  in step: "Given only one value '42'"
```

---

## Value Extraction Patterns

### 1. Quoted Values (`'value'`)

Extract values from single-quoted strings in step descriptions.

```csharp
When("I add '3' items of 'Byron Breakfast Tea' at '9.99' each", ctx =>
{
    // Option A: Array indexer
    var quantity = ctx.Step.Values[0].AsInt();      // 3
    var name = ctx.Step.Values[1].AsString();       // "Byron Breakfast Tea"
    var price = ctx.Step.Values[2].AsDecimal();     // 9.99m
    
    // Option B: Typed tuple deconstruction
    var (qty, name, price) = ctx.Step.Values.As<int, string, decimal>();
});
```

### 2. Named Parameters (`<name:value>`)

Use angle bracket syntax for named extraction. Placeholder replaced with value only.

```csharp
Given("a user with email <email:john@example.com> and age <age:25>", ctx =>
{
    string email = ctx.Step.Params["email"].AsString();  // "john@example.com"
    int age = ctx.Step.Params["age"].AsInt();            // 25
});
// Displays: "a user with email john@example.com and age 25"
```

### 3. Outline Placeholders (`<Name>`)

For ScenarioOutline/RuleOutline, use method parameters directly (already typed).

```csharp
[ScenarioOutline]
[Example("Australia", 99.99)]
public void Calculate_tax(string country, decimal total)
{
    Given("the customer is from <country>", () =>
    {
        _cart.Country = country;  // Already typed!
    });
}
```

### 4. Array Parsing

Arrays in quoted values are automatically parsed:

```csharp
Given("product IDs are '[101, 102, 103]'", ctx =>
{
    int[] ids = ctx.Step.Values[0].As<int[]>();
});
```

---

## Supported Attributes

| Attribute | Description |
|-----------|-------------|
| `[Feature("title")]` | BDD feature container |
| `[Feature("title", Description = "...")]` | Feature with description |
| `[Scenario]` | Single test case |
| `[ScenarioOutline]` | Data-driven scenario |
| `[ScenarioOutline("description")]` | With custom display text |
| `[Example(...)]` | Data row for outline |
| `[Specification("title")]` | MSpec-style spec container |
| `[Rule]` | Single assertion/rule (uses method name) |
| `[Rule("description")]` | Rule with custom display text |
| `[RuleOutline]` | Data-driven rule (uses method name) |
| `[RuleOutline("description")]` | RuleOutline with custom display text |

---

## Method Name Placeholder Parsing

When no description attribute is provided, placeholders can be embedded in method names using `_ALLCAPS` syntax.

### Parsing Rules

1. **Extract Placeholders** (BEFORE underscore-to-space conversion)
   - Pattern: `_[A-Z][A-Z0-9]*` followed by `_` or end of name
   
2. **Convert Underscores to Spaces**

3. **Normalize Whitespace & Insert Values**

### Example

```
Method:  "User_NAME_has_BALANCE"
Step 1:  Extract NAME, BALANCE → "User__has_"
Step 2:  Underscores to spaces → "User  has "
Step 3:  Insert values → "User 'John' has '500'"
```

### Quick Reference

| Method Name | Parameters | Display |
|-------------|------------|---------|
| `_EMAIL_is_valid` | `(string email)` | `'test@x.com' is valid` |
| `User_NAME_exists` | `(string name)` | `User 'John' exists` |
| `Total_is_AMOUNT` | `(decimal amount)` | `Total is '99.99'` |
| `Add_QTY_items_at_PRICE` | `(int qty, decimal price)` | `Add '5' items at '9.99'` |

### Matching Behavior

- Placeholder names match parameter names **case-insensitively**
- `_EMAIL` matches parameter `email`, `Email`, or `EMAIL`
- Unmatched ALLCAPS segments remain as literal text
- If description attribute is provided, it takes precedence

---

## Method Signatures

```csharp
// Without context (backward compatible)
protected void Given(string description, Action step);
protected Task Given(string description, Func<Task> step);

// With context (value extraction)
protected void Given(string description, Action<LiveDocContext> step);
protected Task Given(string description, Func<LiveDocContext, Task> step);
```

Same signatures apply to: `When`, `Then`, `And`, `But`

---

## API Quick Reference

| Pattern | Syntax | Access |
|---------|--------|--------|
| Quoted value | `'value'` | `ctx.Step.Values[0].AsInt()` |
| Typed tuple | `'a' 'b'` | `ctx.Step.Values.As<int, string>()` |
| Named param | `<name:value>` | `ctx.Step.Params["name"].AsInt()` |
| Outline placeholder | `<Name>` | Method parameter (already typed) |
| Array | `'[1,2,3]'` | `ctx.Step.Values[0].As<int[]>()` |
| No extraction | (none) | `() => { }` (no ctx param) |

---

## Not Supported (By Design)

These Vitest features don't translate naturally to C# and are intentionally omitted:

| Feature | Reason |
|---------|--------|
| Data Tables | C# doesn't have multi-line string interpolation in attributes |
| Doc Strings | Same - no natural C# syntax for inline multi-line content |
| Background | xUnit has constructor/IClassFixture for shared setup |
| `ctx.Example` | Method parameters provide typed access already |

---

## Examples

### Basic Scenario

```csharp
[Feature("Shopping Cart")]
public class ShoppingCartTests : LiveDocTest
{
    [Scenario]
    public void Add_item_to_empty_cart()
    {
        Given("an empty shopping cart", () => _cart = new ShoppingCart());
        When("I add a product", () => _cart.Add(new Product("Tea", 9.99m)));
        Then("the cart should have one item", () => Assert.Equal(1, _cart.ItemCount));
    }
}
```

### ScenarioOutline with Examples

```csharp
[Feature("Shipping Costs")]
public class ShippingTests : LiveDocTest
{
    [ScenarioOutline]
    [Example("Australia", 99.99, "Standard")]
    [Example("Australia", 100.00, "Free")]
    public void Calculate_shipping(string country, decimal total, string expectedType)
    {
        Given("the customer is from <country>", () => _cart.Country = country);
        When("the order totals <total>", () => _cart.Total = total);
        Then("shipping should be <expectedType>", () => 
            Assert.Equal(expectedType, _cart.ShippingType));
    }
}
```

### Specification with Rules

```csharp
[Specification("Email Validation")]
public class EmailSpec : LiveDocTest
{
    [RuleOutline("Email '<email>' should return <valid>")]
    [Example("test@example.com", true)]
    [Example("invalid", false)]
    public void Validate_email(string email, bool valid)
    {
        Assert.Equal(valid, EmailValidator.IsValid(email));
    }
}
```

### Using Method Name Placeholders

```csharp
[Specification("Calculator")]
public class CalcSpec : LiveDocTest
{
    [RuleOutline]
    [Example(5, 3, 8)]
    [Example(10, 20, 30)]
    public void Adding_A_and_B_returns_RESULT(int a, int b, int result)
    {
        Assert.Equal(result, Calculator.Add(a, b));
    }
    // Displays: "Adding '5' and '3' returns '8'"
}
```
