# LiveDoc for xUnit

A BDD-style testing framework for xUnit that brings the clarity and readability of Gherkin specifications to C#.

## Features

- 🎯 **Clean Syntax** - Write readable tests without noise
- 📊 **ScenarioOutlines** - Data-driven tests with named examples
- 🎨 **Beautiful Output** - Gherkin-style formatted test results
- 🐛 **Perfect Debugging** - F11 steps directly into your test code
- 📝 **Living Documentation** - Tests that serve as specification

## Quick Start

### 1. Install the package

```bash
dotnet add package SweDevTools.LiveDoc.xUnit
```

### 2. Create a test class

```csharp
using SweDevTools.LiveDoc.xUnit;
using Xunit;

[Feature]
public class ShippingCostsTests : FeatureTest
{
    private ShoppingCart _cart = new();

    [Scenario]
    public void Free_shipping_in_Australia()
    {
        Given("the customer is from Australia", () => 
        {
            _cart.Country = "Australia";
        });
        
        When("the customer's order totals $100", () => 
        {
            _cart.AddItem(new CartItem { Price = 100 });
            _cart.Calculate();
        });
        
        Then("they are charged Free shipping", () => 
        {
            Assert.Equal(0, _cart.Shipping);
        });
    }

    [ScenarioOutline]
    [Example("Australia", 99.99, "Standard")]
    [Example("Australia", 100.00, "Free")]
    [Example("New Zealand", 100.00, "International")]
    public void Calculate_shipping_rates(string CustomerCountry, decimal OrderTotal, string ShippingRate)
    {
        Given("the customer is from <CustomerCountry>", () => 
        {
            _cart.Country = Example.CustomerCountry;
        });
        
        When("the customer's order totals <OrderTotal>", () => 
        {
            _cart.AddItem(new CartItem { Price = Example.OrderTotal });
            _cart.Calculate();
        });
        
        Then("they are charged <ShippingRate> shipping", () => 
        {
            Assert.Equal(Example.ShippingRate, _cart.ShippingType);
        });
    }
}
```

### 3. Run your tests

The output will be beautifully formatted:

```
Feature: Shipping Costs

  Scenario: Free shipping in Australia
    Given the customer is from Australia
    When the customer's order totals $100
    Then they are charged Free shipping
    
    ✓ 3 passing (12ms)

  Scenario Outline: Calculate shipping rates
    Example #1: Australia, 99.99, Standard
      Given the customer is from Australia
      When the customer's order totals 99.99
      Then they are charged Standard shipping
      
      ✓ 3 passing (8ms)
```

## Visual Studio Test Explorer

Tests appear in Test Explorer as:
```
📁 ShippingCostsTests
  ✅ Free_shipping_in_Australia
  ✅ Calculate_shipping_rates (CustomerCountry: "Australia", OrderTotal: 99.99, ...)
  ✅ Calculate_shipping_rates (CustomerCountry: "Australia", OrderTotal: 100.00, ...)
```

Click any test to see the detailed BDD-formatted output in the Test Detail Summary panel.

## Documentation

See the [samples](./samples) directory for more examples.

---

## LiveDoc Viewer Integration

Visualize your test results in real-time with the LiveDoc Viewer web UI.

### Setup

```bash
# Install the viewer globally (requires Node.js)
npm install -g @swedevtools/livedoc-viewer

# Start the viewer
livedoc-viewer
```

The viewer opens at `http://localhost:3100`.

### Configure your tests

Add the `LiveDocViewerReporter` to your test project:

```csharp
// In your test assembly, add an assembly attribute or configure via runsettings
[assembly: LiveDocViewerReporter("http://localhost:3100")]
```

Or configure via `.runsettings`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <LiveDoc>
    <ViewerUrl>http://localhost:3100</ViewerUrl>
    <Project>my-dotnet-app</Project>
    <Environment>local</Environment>
  </LiveDoc>
</RunSettings>
```

### Workflow

1. Start the viewer: `livedoc-viewer`
2. Run your tests: `dotnet test`
3. Results appear in the browser as tests execute

> **📖 Full documentation:** See the [@swedevtools/livedoc-viewer README](../../packages/viewer/README.md) for CLI options and troubleshooting.

---

## AI Coding Skills

LiveDoc includes AI skills that help your coding assistant write better BDD and Specification tests — with correct patterns, value extraction, and living documentation best practices.

### Supported AI Tools

| Tool | Scope | CLI Key |
|------|-------|---------|
| GitHub Copilot (VS Code / CLI) | Project & User | `copilot` |
| Claude Code | Project & User | `claude` |
| Roo Code | Project & User | `roo` |
| Cursor | Project only | `cursor` |
| Windsurf | Project only | `windsurf` |

### Install the Skill

```bash
# 1. Add a local tool manifest (skip if you already have one)
dotnet new tool-manifest

# 2. Install the LiveDoc CLI tool
dotnet tool install SweDevTools.LiveDoc.Tool

# 3. Interactive install — select your AI tool(s) and scope
dotnet livedoc install-skill

# Or non-interactive:
dotnet livedoc install-skill --tool copilot --scope project
dotnet livedoc install-skill --all  # Install for all tools at project level
```

---

## License

MIT
