# LiveDoc for xUnit - Architecture & Design

## Overview

LiveDoc for xUnit brings BDD-style testing with Gherkin-inspired syntax to C# and xUnit. It prioritizes:
1. **Clean, minimal syntax** - no noise, just readable tests
2. **Perfect debugging experience** - F11 steps directly into test code
3. **Beautiful formatted output** - Gherkin-style test results
4. **Full xUnit compatibility** - works with existing xUnit tooling

## Architecture

### Component Structure

```
livedoc-xunit/
├── src/
│   ├── Attributes/           # Test discovery attributes
│   │   ├── FeatureAttribute.cs
│   │   ├── ScenarioAttribute.cs
│   │   ├── ScenarioOutlineAttribute.cs
│   │   └── ExampleAttribute.cs
│   ├── Core/                 # Core execution engine
│   │   ├── LiveDocModels.cs  # Data models
│   │   └── LiveDocContext.cs # Execution context
│   ├── Formatters/           # Output formatting
│   │   └── LiveDocFormatter.cs
│   └── LiveDocTest.cs        # Base test class
├── samples/                  # Example tests
└── tests/                    # Unit tests (future)
```

### Key Classes

#### 1. `LiveDocTest` (Base Class)
- Provides `Given`, `When`, `Then`, `And`, `But` methods
- Manages test execution context
- Integrates with xUnit's `ITestOutputHelper`
- Implements `IDisposable` for cleanup and summary output

#### 2. `LiveDocContext` (Execution Engine)
- Tracks step execution and timing
- Handles placeholder replacement (e.g., `<CustomerCountry>`)
- Manages feature/scenario/example context
- Outputs formatted test results

#### 3. `LiveDocFormatter` (Output Formatter)
- Formats output in BDD/Gherkin style
- Provides indentation and structure
- Handles feature/scenario/step formatting
- Outputs pass/fail summaries

#### 4. Attributes
- `[Feature]` - Marks a test class as a feature
- `[Scenario]` - Marks a test method as a scenario (inherits `[Fact]`)
- `[ScenarioOutline]` - Marks a data-driven scenario (inherits `[Theory]`)
- `[Example]` - Provides data for scenario outlines (inherits `[InlineData]`)

## Design Decisions

### 1. Base Class Approach
**Decision**: Require inheritance from `LiveDocTest`

**Rationale**:
- Eliminates `_ctx` prefix noise
- Provides clean `Given()` / `When()` / `Then()` syntax
- Encapsulates context management
- Maintains perfect debugging via protected methods

**Trade-off**: Prevents inheritance from other base classes (solvable with composition)

### 2. xUnit Attribute Inheritance
**Decision**: Inherit from `FactAttribute` and `TheoryAttribute`

**Rationale**:
- Full xUnit compatibility
- Works with existing test runners
- No custom test discovery needed
- Leverages xUnit's mature infrastructure

**Trade-off**: Limited to xUnit's test model (no custom step-level test nodes)

### 3. Lambda-Based Steps
**Decision**: Use lambdas for step implementations

**Rationale**:
- **Perfect debugging** - F11 steps directly into code
- No IL weaving or code generation
- No runtime proxy creation
- Simple, understandable model

**Trade-off**: Slightly more verbose than pure attributes (minimal)

### 4. ITestOutputHelper Integration
**Decision**: Use xUnit's `ITestOutputHelper` for output

**Rationale**:
- Standard xUnit mechanism
- Output appears in Test Explorer
- Works with all test runners
- Captured in test results XML

**Trade-off**: Output is text-based (can add HTML reporter separately)

## Output Formatting

### Visual Studio Test Explorer
Tests appear as:
```
📁 FeatureClassName
  ✅ Scenario_Method_Name
  ✅ ScenarioOutline_Method(param1: value1, param2: value2, ...)
```

### Test Output (Console/Test Detail)
```
  Feature: Beautiful Tea Shipping Costs

    Scenario: Free shipping in Australia
      Given the customer is from Australia
      When the customer's order totals $100
      Then the customer pays GST
        and they are charged Free shipping
      
      ✓ 4 passing (12ms)
```

## Extension Points

### Custom Formatters
Inherit from `LiveDocFormatter` and override format methods:

```csharp
public class HtmlFormatter : LiveDocFormatter
{
    public override string FormatFeature(string name)
    {
        return $"<h1>Feature: {name}</h1>";
    }
}
```

### Custom Reporters
Implement a post-execution reporter that reads test results:

```csharp
public class LiveDocHtmlReporter
{
    public void GenerateReport(TestResults results)
    {
        // Parse xUnit output and generate HTML
    }
}
```

### Tags and Filtering
(Future enhancement)
```csharp
[Feature(Tags = new[] { "smoke", "critical" })]
[Scenario(Tags = new[] { "fast" })]
```

Integrate with xUnit's trait system for filtering.

## Comparison with JavaScript LiveDoc

### What's the Same
✅ Gherkin-style syntax (Given/When/Then)
✅ ScenarioOutline with Examples
✅ Placeholder replacement (`<PropertyName>`)
✅ Formatted output
✅ Feature/Scenario/Step hierarchy

### What's Different
⚠️ **No per-step test nodes** - VS Test Explorer shows scenarios, not individual steps
⚠️ **No dynamic test execution** - C# requires compile-time test discovery
⚠️ **No Background keyword** - use class constructor or `IClassFixture` instead
✅ **Better debugging** - C# debugger is more mature than JS debuggers
✅ **Compile-time safety** - C# type system catches errors at compile time

### What's Better in C#
✅ **Type safety** - compiler catches type mismatches
✅ **IntelliSense** - parameter hints show what data is expected
✅ **Compile-time validation** - errors caught before runtime

## Performance Characteristics

- **Zero reflection overhead at runtime** - attributes parsed at discovery time
- **Minimal formatting overhead** - string concatenation only
- **No proxies or IL weaving** - direct method invocation
- **Memory efficient** - context disposed after each test

## Future Enhancements

### Phase 1 (Complete)
✅ Core attributes and base class
✅ Given/When/Then/And/But support
✅ ScenarioOutline with Examples
✅ Formatted output
✅ Placeholder replacement

### Phase 2 (Planned)
- Tag-based filtering via xUnit traits
- Background step support
- Custom formatters
- HTML reporter
- JSON export

### Phase 3 (Future)
- VS Test Explorer integration (custom adapter)
- Visual Studio extension for syntax highlighting
- Roslyn analyzer for BDD rules enforcement
- Code snippets for Visual Studio

## Testing Strategy

The package itself should be tested using xUnit (dogfooding):

```csharp
[Feature]
public class LiveDocFormatterTests : LiveDocTest
{
    [Scenario]
    public void Format_feature_with_correct_indentation()
    {
        Given("a formatter instance", () => { ... });
        When("formatting a feature name", () => { ... });
        Then("it should have proper indentation", () => { ... });
    }
}
```

## Contributing

When adding features:
1. Maintain backward compatibility
2. Keep debugging experience pristine (no code generation)
3. Follow xUnit conventions
4. Add samples demonstrating the feature
5. Update documentation

## License

MIT - same as the parent LiveDoc project
