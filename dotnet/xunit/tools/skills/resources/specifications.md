# Specification Pattern — Full API Reference

> **Load this resource** when writing or modifying `[Specification]`, `[Rule]`, `[RuleOutline]`, or `[Example]` tests using the MSpec-style specification pattern in C# LiveDoc xUnit.

## Required Usings

```csharp
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;
```

## Base Class: `SpecificationTest`

All specification tests inherit from `SpecificationTest`:

```csharp
[Specification("Calculator Operations", Description = @"
    Callers can rely on the arithmetic results covered
    by these rules.
")]
public class CalculatorSpec : SpecificationTest
{
    public CalculatorSpec(ITestOutputHelper output) : base(output) { }
}
```

### Context Properties (inherited)

| Property        | Type                   | Description                                     |
| --------------- | ---------------------- | ----------------------------------------------- |
| `Specification` | `SpecificationContext` | Specification title, description, tags           |
| `Rule`          | `RuleContext`          | Current rule name, description, values, params   |
| `Example`       | `dynamic?`             | Current outline example row (RuleOutline only)   |

**Key difference from BDD**: No step methods (Given/When/Then). Rules contain direct assertions.

Specification, Rule, and RuleOutline titles supplied through `nameof(...)`
replace identifier underscores with spaces. Literal strings preserve underscores:

```csharp
[Specification(nameof(Calculator_operations))] // "Calculator operations"
[Rule("LIVEDOC_RUN_TYPE")]                     // "LIVEDOC_RUN_TYPE"
```

---

## Attributes

### `[Specification]` — Class Attribute

```csharp
// Minimal — title auto-derived from class name
[Specification]
public class CalculatorSpec : SpecificationTest { ... }

// Explicit title
[Specification("Calculator Operations")]
public class CalculatorSpec : SpecificationTest { ... }

// Title + description (strongly encouraged)
[Specification("Calculator Operations", Description = @"
    Callers can rely on the arithmetic results covered by these rules.
")]
public class CalculatorSpec : SpecificationTest { ... }
```

| Parameter     | Type     | Required | Description                          |
| ------------- | -------- | -------- | ------------------------------------ |
| `title`       | `string` | No       | Spec title (defaults to formatted class name) |
| `Description` | `string` | No       | Multi-line description text          |

Use the optional description to explain why this contract matters to its
callers. Rule titles, examples, and assertions provide the evidence; do not
imply integration or business outcomes that the rules do not observe.

### `[Rule]` — Method Attribute (one independent claim)

Inherits from xUnit's `[Fact]`. Each rule reports one independent contract
claim with direct assertions — no Given/When/Then steps. Multiple assertions
are fine when together they prove that one claim.

```csharp
// Auto-derived from method name (underscores → spaces)
[Rule]
public void Adding_positive_numbers_works()
{
    Assert.Equal(8, Add(5, 3));
}

// Explicit title with embedded values and optional supporting prose
[Rule(
    "Adding '5' and '3' returns '8'",
    Description = "Covers positive integer inputs; overflow is not exercised here.")]
public void Add_with_values()
{
    var (a, b, expected) = Rule.Values.As<int, int, int>();
    Assert.Equal(expected, Add(a, b));
}

// Named parameters
[Rule("Subtracting <b:3> from <a:10> returns <expected:7>")]
public void Subtract_with_named_params()
{
    var a = Rule.Params["a"].AsInt();
    var b = Rule.Params["b"].AsInt();
    var expected = Rule.Params["expected"].AsInt();
    Assert.Equal(expected, Subtract(a, b));
}
```

| Parameter       | Type     | Required | Description                                |
| --------------- | -------- | -------- | ------------------------------------------ |
| `title`         | `string` | No       | Rule title with optional `'value'` or `<name:value>` |
| `Description`   | `string` | No       | Secondary Markdown prose                    |

**Supports `async`:**
```csharp
[Rule("Async operation completes successfully")]
public async Task Async_rule()
{
    var result = await PerformAsync();
    Assert.NotNull(result);
}
```

### `[RuleOutline]` — Method Attribute (data-driven)

Inherits from xUnit's `[Theory]`. Runs once per `[Example]` row.

```csharp
// Title and description templates bind to the selected example row
[RuleOutline(
    "Adding '<a>' and '<b>' returns '<result>'",
    Description = "Integer inputs <a> and <b> are covered; overflow is outside this example.")]
[Example(1, 2, 3)]
[Example(5, 5, 10)]
[Example(-5, 5, 0)]
public void Addition_examples(int a, int b, int result)
{
    Assert.Equal(result, Add(a, b));
}

// Without a title — method name placeholders used
[RuleOutline]
[Example(10, 2, 5)]
[Example(100, 10, 10)]
public void Dividing_A_by_B_returns_RESULT(int a, int b, int result)
{
    // _A_, _B_, _RESULT_ in method name are replaced with actual values
    Assert.Equal(result, Divide(a, b));
}
```

| Parameter       | Type     | Required | Description                                  |
| --------------- | -------- | -------- | -------------------------------------------- |
| `title`         | `string` | No       | Positional title template with `<paramName>` placeholders |
| `Description`   | `string` | No       | Optional secondary Markdown prose (also binds placeholders) |

### Method Name Placeholders

When `[RuleOutline]` has no explicit title, the method name serves as the template:

```csharp
// Method name: Converting_INPUT_to_uppercase_returns_EXPECTED
// Display:     "Converting hello to uppercase returns HELLO"
[RuleOutline]
[Example("hello", "HELLO")]
[Example("World", "WORLD")]
public void Converting_INPUT_to_uppercase_returns_EXPECTED(string input, string expected)
{
    Assert.Equal(expected, input.ToUpperInvariant());
}
```

**Rules for method name placeholders:**
- `_ALLCAPS_` segments are matched to method parameters (case-insensitive)
- Underscores (`_`) between words become spaces in display
- Works best when placeholder names match parameter names

### `[Example]` — Data Row Attribute

Same attribute as used with `[ScenarioOutline]`:

```csharp
[Example(3, 4, 12)]           // int, int, int
[Example("test@test.com", "valid")]  // string, string
[Example("hello", 5)]         // string, int
```

- Positional parameters matching method signature
- Parameter count **must** match method parameter count

### `[Tag]` — Class or Method Attribute

```csharp
[Tag("math, core")]
[Specification("Calculator")]
public class CalculatorSpec : SpecificationTest { ... }
```

- Every tag is exposed as an xUnit `Category` trait for `dotnet test --filter "Category=<tag>"`
- For incremental Viewer updates, read `resources/partial-testing.md`

---

## Value Extraction

### Rule.Values — Quoted Values

Extracted from the `[Rule]` title string, not its optional `Description`. Use single quotes:

```csharp
[Rule("Adding '5' and '3' returns '8'")]
public void Add_with_values()
{
    // Index access
    int a = Rule.Values[0].AsInt();        // 5
    int b = Rule.Values[1].AsInt();        // 3
    int expected = Rule.Values[2].AsInt(); // 8

    Assert.Equal(expected, Add(a, b));
}
```

### Tuple Deconstruction

```csharp
[Rule("Adding '5' and '3' returns '8'")]
public void Add_typed()
{
    // Typed tuple — preferred for clean code
    var (a, b, expected) = Rule.Values.As<int, int, int>();
    Assert.Equal(expected, Add(a, b));
}
```

Supports up to 6 values: `.As<T1, T2>()` through `.As<T1, T2, T3, T4, T5, T6>()`.

### Rule.Params — Named Parameters

Use `<name:value>` syntax for named access:

```csharp
[Rule("Subtracting <b:3> from <a:10> returns <expected:7>")]
public void Subtract_named()
{
    var a = Rule.Params["a"].AsInt();           // 10
    var b = Rule.Params["b"].AsInt();           // 3
    var expected = Rule.Params["expected"].AsInt(); // 7

    Assert.Equal(expected, a - b);
}
```

- **Case-insensitive** lookup
- Check existence: `Rule.Params.ContainsKey("name")` or `TryGetValue("name", out var val)`

### RuleContext Properties

| Property    | Type                      | Description                              |
| ----------- | ------------------------- | ---------------------------------------- |
| `Name`      | `string`                  | Rule name (from method or title)         |
| `Description` | `string?`              | Rule description text                    |
| `Tags`      | `string[]`                | Merged class + method tags               |
| `Values`    | `LiveDocValueArray`       | Quoted values from description           |
| `ValuesRaw` | `string[]`                | Raw string values before coercion        |
| `Params`    | `LiveDocValueDictionary`  | Named `<name:value>` parameters          |
| `ParamsRaw` | `IReadOnlyDictionary<string, string>` | Raw parameter strings   |

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

All conversions use `CultureInfo.InvariantCulture`.

---

## Complete Specification Example

```csharp
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;

namespace MyApp.Tests.Validation;

[Specification("Email Validation Rules", Description = @"
    Helps callers reject the malformed address shapes covered
    by these rules before using an address.
")]
public class EmailValidationSpec : SpecificationTest
{
    public EmailValidationSpec(ITestOutputHelper output) : base(output) { }

    [Rule("Empty email '' is invalid")]
    public void Empty_email_is_invalid()
    {
        Assert.False(IsValidEmail(Rule.Values[0].AsString()));
    }

    [Rule("Null email is invalid")]
    public void Null_email_is_invalid()
    {
        Assert.False(IsValidEmail(null));
    }

    [RuleOutline("Email '<email>' is invalid without exactly one at-sign")]
    [Example("nodomain.com")]
    [Example("two@@domain.com")]
    public void Must_contain_at_symbol(string email)
    {
        Assert.False(IsValidEmail(email));
    }

    [RuleOutline("Email '<email>' is <validity>")]
    [Example("test@example.com", "valid")]
    [Example("user.name@domain.org", "valid")]
    [Example("invalid-email", "invalid")]
    [Example("@nodomain.com", "invalid")]
    [Example("spaces in@email.com", "invalid")]
    public void Email_validation(string email, string validity)
    {
        var isValid = IsValidEmail(email);
        var expected = validity == "valid";
        Assert.Equal(expected, isValid);
    }

    [RuleOutline]
    [Example("hello", 5)]
    [Example("", 0)]
    [Example("test", 4)]
    public void Length_of_STR_is_LEN(string str, int len)
    {
        Assert.Equal(len, str.Length);
    }

    private static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var atIndex = email.IndexOf('@');
        return atIndex > 0 && atIndex == email.LastIndexOf('@')
            && atIndex < email.Length - 1 && !email.Contains(' ');
    }
}
```

---

## When to Use Specification vs BDD

| Use Specification When...                    | Use BDD/Feature When...                       |
| -------------------------------------------- | --------------------------------------------- |
| Precise business policies or technical contracts | User and operator workflows                 |
| Readers inspect exact rules and examples          | Readers follow a Given/When/Then narrative  |
| Many input variations (data-driven)           | Narrative scenarios with Given/When/Then       |
| Direct assertions without ceremony            | Step-by-step workflow documentation            |
| One independent claim per reported rule       | Multi-step scenarios with state transitions    |

**You can mix both patterns** under the same business capability namespace.
Use `[Feature]` for workflows and `[Specification]` for exact policies and
contracts, even when product stakeholders want to read the rules.

---

## Error Handling

| Exception                     | Cause                                          | Fix                                          |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------- |
| `LiveDocConversionException`  | Invalid type conversion (e.g., `'abc'.AsInt()`) | Check quoted value format in `[Rule]` title |
| `LiveDocValueIndexException`  | `Rule.Values[n]` beyond available count         | Verify quoted value count in title     |
| `LiveDocParamNotFoundException` | `Rule.Params["x"]` for non-existent parameter | Check `<name:value>` syntax in title   |
| Test not in Test Explorer     | Missing `[Rule]` attribute                      | Add `[Rule]` — it inherits from `[Fact]`     |
| Placeholder not replaced      | `_PARAM_` doesn't match parameter name          | Match case-insensitively in method name      |

---

## Attachments and Evidence

Specifications can call `Attach`, `AttachScreenshot`, `AttachFile`, or
`AttachJson` to document meaningful evidence. Attach selected, sanitized
fields before an assertion that may fail, or after a successful assertion.
Read `resources/evidence.md` for the supported APIs and redaction rules.

---

## Validation Checklist

- [ ] Class inherits `SpecificationTest` and has `[Specification]` attribute
- [ ] If provided, `[Specification]` `Description` explains why the tested contract matters without overclaiming
- [ ] Each Rule reports one independent claim (multiple assertions may establish that same claim)
- [ ] Constructor accepts `ITestOutputHelper` and passes to `base(output)`
- [ ] Each rule method has `[Rule]` or `[RuleOutline]` attribute
- [ ] Quoted values in `[Rule]` titles are extracted via `Rule.Values`, never hardcoded
- [ ] Named parameters use `<name:value>` syntax and `Rule.Params["name"]`
- [ ] `[Example]` parameter count matches method parameter count
- [ ] `<Placeholder>` names in RuleOutline titles and descriptions match method parameter names
- [ ] Method name placeholders use `_ALLCAPS_` segments matching parameter names
- [ ] Attachments are redacted and support an explicit assertion
- [ ] Tests pass: `dotnet test`
