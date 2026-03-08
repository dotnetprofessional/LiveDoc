# SweDevTools.LiveDoc.xUnit

A BDD-style testing framework for xUnit that brings the clarity and readability of Gherkin specifications to C#.

📖 **[Full Documentation →](http://livedoc.swedevtools.com/docs/xunit/learn/getting-started)**

## Quick Start

### 1. Install the package

```bash
dotnet add package SweDevTools.LiveDoc.xUnit
```

### 2. Create a test class

```csharp
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

[Feature]
public class ShippingCostsTests : FeatureTest
{
    public ShippingCostsTests(ITestOutputHelper output) : base(output) { }

    private ShoppingCart _cart = new();

    [Scenario]
    public void Free_shipping_in_Australia()
    {
        Given("the customer is from Australia", () =>
        {
            _cart.Country = "Australia";
        });

        When("the customer's order totals '$100'", ctx =>
        {
            _cart.AddItem(new CartItem { Price = ctx.Values[0] });
            _cart.Calculate();
        });

        Then("they are charged 'Free' shipping", ctx =>
        {
            Assert.Equal(ctx.ValuesRaw[0], _cart.ShippingType);
        });
    }
}
```

### 3. Run your tests

```bash
dotnet test
```

Output is beautifully formatted in Gherkin style in the Test Detail Summary panel.

---

## AI Coding Skills

Install the LiveDoc AI skill for your coding assistant:

```bash
dotnet msbuild -t:LiveDocInstallSkills
```

Supports GitHub Copilot, Claude Code, Roo Code, Cursor, and Windsurf. See the [AI Skill Setup Guide](http://livedoc.swedevtools.com/docs/xunit/guides/ai-skill-setup) for details.

---

## Journey Scaffolding from `.http` files

The package includes a journey generator executable and MSBuild target that can scaffold LiveDoc xUnit tests from annotated `.http` files.

Enable it in your test project:

```xml
<PropertyGroup>
  <LiveDocJourneysEnabled>true</LiveDocJourneysEnabled>
  <LiveDocJourneysDir>$(MSBuildProjectDirectory)\..\..\journeys</LiveDocJourneysDir>
  <LiveDocJourneyOutputDir>$(MSBuildProjectDirectory)\Journeys</LiveDocJourneyOutputDir>
  <LiveDocJourneyBaseNamespace>MyProject.Specs.Journeys</LiveDocJourneyBaseNamespace>
  <LiveDocJourneyInfrastructureNamespace>MyProject.Specs.Journeys.Infrastructure</LiveDocJourneyInfrastructureNamespace>
  <LiveDocJourneyFixtureType>JourneyServerFixture</LiveDocJourneyFixtureType>
  <LiveDocJourneyMode>scaffold</LiveDocJourneyMode>
  <LiveDocHttpYacEnsure>check</LiveDocHttpYacEnsure>
</PropertyGroup>
```

- `LiveDocJourneyMode`: `scaffold`, `validate`, or `force`
- `LiveDocHttpYacEnsure`: `check`, `auto-install`, or `off`

The generated journey tests expect the configured fixture type to expose the same runtime API used by the reference pattern (`RunJourneyAsync`, `LoadResponseFile`, `JourneysDir`).

### Capture Mode

Auto-generate `.Response.json` contract files by running journeys against a live server:

```bash
dotnet msbuild -t:LiveDocCaptureJourneys \
  -p:LiveDocCaptureVars="--var baseUrl=http://localhost:5000 --var adminToken=my-token"
```

This runs each `.http` file via httpYac, captures response bodies, and saves them as contract files. Use `-p:LiveDocCaptureOverwrite=true` to regenerate existing contracts.

---

## Documentation

📖 **[Full documentation at livedoc.swedevtools.com →](http://livedoc.swedevtools.com/docs/xunit/learn/getting-started)**

Covers getting started, features, specifications, value extraction, scenario outlines, viewer integration, debugging, best practices, and more.

---

## License

MIT
