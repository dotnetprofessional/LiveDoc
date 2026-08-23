---
name: livedoc-xunit
description: Expert guidance for writing and modifying BDD/Gherkin and MSpec-style tests using the SweDevTools.LiveDoc.xUnit framework for C# and .NET. Generates self-documenting xUnit specs with correct attribute usage, value extraction, and living documentation patterns. Also covers Journey testing via annotated .http files.
sdk_version: 0.2.0-beta.2
---

# LiveDoc xUnit Test Author

> **Progressive disclosure**: This file is the routing hub. Read the appropriate sub-resource for full API details.

## Version Check

This skill targets **SweDevTools.LiveDoc.xUnit v0.2.0-beta.2**. Before writing tests, verify the installed version matches:

```bash
dotnet list package | grep -i livedoc
```

If the installed version differs from `0.2.0-beta.2`, tell the developer: *"Your LiveDoc skill files target v0.2.0-beta.2 but you have vX.Y.Z installed. Run `dotnet msbuild -t:LiveDocInstallSkills` to update the skill files, or check the changelog for breaking changes."*

## Use this skill when
- Creating or modifying C# test classes using `SweDevTools.LiveDoc.xUnit`
- Writing BDD `[Feature]`/`[Scenario]` tests → **read `resources/features.md`**
- Writing MSpec `[Specification]`/`[Rule]` tests → **read `resources/specifications.md`**
- Creating `.http` journey files or `.Response.json` contracts → **read `resources/journey-testing.md`**
- Attaching screenshots, files, or JSON evidence → **read `resources/evidence.md`**
- Running tag-scoped incremental tests that patch the Viewer → **read `resources/partial-testing.md`**
- Configuring Microsoft or XPlat coverage for LiveDoc Viewer, including dependencies and diagnostics
- Debugging or fixing any LiveDoc xUnit test failures

## Do not use this skill when
- Writing TypeScript/Vitest tests (use `livedoc-vitest` skill instead)
- Working on non-test C# code (application logic, build scripts)
- Writing plain xUnit tests without LiveDoc BDD/Specification patterns
- Working on the viewer, VS Code extension, or server packages

---

## Inputs

- Behavior claim or defect to protect
- Relevant production code, test project, and existing tests
- Observable boundary: in-process, test host, real process, HTTP journey, filesystem, or source tree
- Target frameworks, package references, runsettings, and LiveDoc configuration

## Outputs

- The smallest trustworthy LiveDoc xUnit test, or a recommendation to use a native specialist test
- Correct Feature/Scenario or Specification/Rule structure with self-documenting values
- Deterministic fixture/process cleanup and actionable failure output

## Workflow

1. Read `resources/test-strategy.md` and apply the two-question litmus.
2. Select the lowest trustworthy boundary; use a test host unless a real process is load-bearing.
3. Choose Feature or Specification by audience and journey shape.
4. Read the matching syntax resource or `resources/journey-testing.md`.
5. Use `resources/evidence.md` when attachments add reader value.
6. Review `resources/anti-patterns.md`.
7. For incremental validation, read `resources/partial-testing.md` and prefer affected categories over type-name filters.
8. Run the test alone, then its normal suite, with deterministic cleanup.
9. Apply the false-green validation gate.

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

### Tag-Scoped Partial Runs

After publishing a full baseline, select affected categories and set
`LIVEDOC_RUN_TYPE=partial` so the Viewer patches those results into the
baseline. In v0.2.0-beta.2, pair LiveDoc `[Tag]` metadata with xUnit
`[Trait("Category", "...")]` until `[Tag]` becomes runner-filterable.
Read `resources/partial-testing.md` for the exact workflow.

### Coverage Tooling

When a LiveDoc run reports coverage diagnostics, use this routing:

- `dotnet-coverage-missing` → install Microsoft's converter with `dotnet tool install --global dotnet-coverage`, or install it as a local tool and set `LIVEDOC_DOTNET_COVERAGE_TOOL` to the executable path.
- `dotnet-coverage-conversion-failed` → rerun `dotnet-coverage merge <file.coverage> -f cobertura -o coverage.cobertura.xml` manually and inspect the tool output.
- `coverage-pending-post-run` → informational only. The in-process reporter flushed before VSTest finalized coverage. The packaged `LiveDocCoverage` data collector and attachment processor perform the automatic post-run attach; the CLI logger remains as a compatibility path.
- `artifact-missing` after Visual Studio Code Coverage or XPlat Code Coverage → look for coded lifecycle evidence. `LD-COV-010`/`020` prove collector discovery and testhost metadata injection; `LD-COV-040`/`050` prove the attachment processor received coverage; `LD-COV-053`/`054` identify missing or stale metadata.
- `InvalidLoggerException: Could not find ... 'LiveDocCoverage'` → this applies only when the manual CLI fallback `--logger LiveDocCoverage` was explicitly requested. Ensure `SweDevTools.LiveDoc.xUnit.TestLogger.dll` is on `TestAdaptersPaths`; the package never auto-enables this logger.
- `coverage-invocation-scope` → informational only. VSTest coverage attachments are produced for the whole test invocation, so LiveDoc attaches the report to each LiveDoc run recorded during that invocation.
- `unsupported-format` → generate Cobertura XML with Coverlet/XPlat Code Coverage or configure `LIVEDOC_COVERAGE_PATH` to a supported artifact.

Do not make the SDK install global tools during test execution. AI setup agents may install `dotnet-coverage` as an explicit development setup step when the user asks for Visual Studio `.coverage` support or when a `dotnet-coverage-missing` diagnostic appears. Post-run Visual Studio coverage can be disabled with `-p:LiveDocPostRunCoverageEnabled=false`.

The package selects `build/livedoc-coverage.runsettings` through `RunSettingsFilePath` when coverage is requested (a Code Coverage collector, `LIVEDOC_COVERAGE=true`, or Visual Studio test execution) and only when neither `RunSettingsFilePath` nor `VSTestSetting` is already set. Plain CLI `dotnet test` stays quiet. `LD-COV-000` confirms automatic selection. `LD-COV-001` means custom settings were preserved; copy the `LiveDocCoverage` data collector entry into that file rather than replacing user configuration.

In Visual Studio, collector warnings and errors appear in **Output → Tests**. Informational attachment-processor messages can be suppressed by the IDE; every processor invocation also writes `livedoc-coverage-processor.log` under the `metadataDir` printed by `LD-COV-020` and `LD-COV-040`. `LD-COV-051` is informational when no coverage was requested. A successful run shows `LD-COV-030` → `040` → `050` → `052` → `060`/`061` → `064` → `070` → `080`. `LD-COV-080` means server-accepted after durable persistence and reports websocket plus REST hydration evidence; viewer application is separately logged as `LD-COV-090`, with `LD-COV-091` for hydration/application failure. `LD-COV-081` is an idempotent skip for a previously accepted run.

```powershell
dotnet test .\MySolution.sln --collect:"Code Coverage;Format=Cobertura"
```

The Microsoft Code Coverage command above is preferred for solution/module
hierarchy and branch data. The package already includes `LiveDocCoverage`; no
Coverlet dependency is required. For Visual Studio binary `.coverage` output:

```powershell
dotnet tool install --global dotnet-coverage
```

For the XPlat alternative:

```powershell
$env:LIVEDOC_COVERAGE = "true"
dotnet add package coverlet.collector
dotnet test --collect:"XPlat Code Coverage"
```

XPlat/Coverlet supports line, branch, and method coverage and emits Cobertura
directly. Install `coverlet.collector` in every participating test project.
Coverlet excludes test assemblies by default and commonly emits one attachment
per testhost; LiveDoc merges every attachment it receives but cannot represent a
project that emitted none. Prefer Microsoft Code Coverage for the most
consistent Visual Studio-style solution/module view.

---

## Validation

- [ ] The test passes the two-question litmus.
- [ ] The instrument observes the public behavior named in the title.
- [ ] The intended test was discovered and executed.
- [ ] Values are visible in titles and extracted through LiveDoc APIs.
- [ ] Expected results are independent of production logic.
- [ ] The test passes alone and in its normal suite.
- [ ] Incremental validation uses the smallest affected category set and publishes as `partial`.
- [ ] Fixtures, processes, ports, files, and streams are released.
- [ ] Critical behavior has been observed failing for the intended defect.
- [ ] Failure output exposes no secrets.

## Examples

### Positive routing examples
- "Create a BDD test for shipping costs" → Read `resources/features.md`, write `FeatureTest`
- "Add data-driven tests for tax calculation" → Read `resources/features.md`, use `[ScenarioOutline]`
- "Write unit tests for the email validator" → Read `resources/specifications.md`, write `SpecificationTest`
- "Fix value drift — step says 500 but code checks 200" → Use `ctx.Step!.Values[0]` extraction
- "Create HTTP journey tests for Users API" → Read `resources/journey-testing.md`
- "Set up journey testing in my project" → Read `resources/journey-testing.md`
- "Fix LiveDoc coverage diagnostic dotnet-coverage-missing" → Install/configure `dotnet-coverage`
- "Configure full solution coverage" → Prefer Microsoft Code Coverage with `Format=Cobertura`; verify line and branch modules in the Viewer
- "Validate changed checkout behavior incrementally" → Read `resources/partial-testing.md`; run affected categories as a partial

### Negative routing examples
- "Create a TypeScript spec" → Use `livedoc-vitest` skill
- "Build a React component" → Use `frontend-design` skill
- "Write a plain xUnit Fact test" → No LiveDoc skill needed
- "Add sleeps to stabilize a process test" → Decline; add readiness and bounded cleanup
- "Convert every low-level xUnit test to LiveDoc" → Decline; curate only behavior with documentation value
- "Fix a bug in LiveDocContext" → Framework development, handle directly

## Failure Handling
- Tests missing from Test Explorer → verify `[Scenario]` or `[Rule]` attributes are present
- `ctx.Step` is null → use the `Action<LiveDocContext>` overload, not `Action`
- Conversion fails → check exception message — includes step title and available values
- `dotnet-coverage-missing` → install `dotnet-coverage` or set `LIVEDOC_DOTNET_COVERAGE_TOOL`
- Placeholder not replaced → `<Param>` matching is case-insensitive; check spelling
- `[Tag]` filter selects nothing → v0.2.0-beta.2 requires a matching `[Trait("Category", "...")]`
- Partial run replaces the full Viewer picture → ensure `LIVEDOC_RUN_TYPE=partial` and a full baseline already exists
- Journey failures → see `resources/journey-testing.md` → Failure Handling section
