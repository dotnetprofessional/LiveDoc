# SweDevTools.LiveDoc.xUnit

A BDD-style testing framework for xUnit that brings the clarity and readability of Gherkin specifications to C#.

📖 **[Full Documentation →](https://livedoc.swedevtools.com/xunit/learn/getting-started)**

## Quick Start

### 1. Install the package

```bash
dotnet add package SweDevTools.LiveDoc.xUnit
```

### Fastest Setup: Point Your AI at the Bootstrap URL

Tell your assistant:

> Read https://livedoc.swedevtools.com/ai/setup.md and configure this xUnit
> solution for LiveDoc. Inspect it first, ask me one configuration question at a
> time, and wait for approval before making changes.

No LiveDoc package or skill needs to be installed first.
[AI project setup →](https://livedoc.swedevtools.com/guides/ai-project-setup)

AI setup installs version-matched skills inside the repository for every
selected tool. Run
`dotnet msbuild -t:LiveDocInstallSkills -p:LiveDocAITool=copilot,codex,claude`
later to refresh them or add another tool. It also creates repository-local
`scripts/test-livedoc.ps1` and `scripts/test-livedoc.sh` launchers with a simple
coverage switch.

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
            _cart.AddItem(new CartItem { Price = ctx.Step!.Values[0].AsDecimal() });
            _cart.Calculate();
        });

        Then("they are charged 'Free' shipping", ctx =>
        {
            Assert.Equal(ctx.Step!.Values[0].AsString(), _cart.ShippingType);
        });
    }
}
```

### 3. Run your tests

```bash
dotnet test
```

Output is beautifully formatted in Gherkin style in the Test Detail Summary panel.

### Share setup across scenarios

Override `BackgroundAsync` on a `FeatureTest` to describe common preconditions
with `Given` and `And`. It runs on a fresh test instance before **each** Scenario
and Scenario Outline example. A scenario can supply its own `Given` as well;
the Background's `Given` also satisfies the precondition when it does not.
The Viewer shows these steps once in the Feature's **Background** section,
separate from any Given in the Scenario. The Background display aggregates
step status and evidence across invocations; each Scenario or example retains
its own test result and failure.

Override `AfterBackgroundAsync` for per-invocation cleanup. It runs after the
scenario even if a Background step or scenario step fails; cleanup exceptions
fail the test without discarding the original failure. Both hooks return `Task`,
so async setup and cleanup can be awaited. For example:

```csharp
[Feature("Buffer Operations")]
public class BufferTests : FeatureTest
{
    private MemoryStream? _buffer;

    public BufferTests(ITestOutputHelper output) : base(output) { }

    protected override Task BackgroundAsync()
    {
        Given("an empty buffer is available", () => _buffer = new MemoryStream());
        return Task.CompletedTask;
    }

    protected override Task AfterBackgroundAsync()
    {
        _buffer?.Dispose();
        return Task.CompletedTask;
    }

    [Scenario("A byte is written")]
    public void Write_byte()
    {
        When("the byte '42' is written", ctx =>
            _buffer!.WriteByte(ctx.Step!.Values[0].As<byte>()));
        Then("the buffer contains '1' byte", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), _buffer!.Length));
    }
}
```

The hooks do not share state across tests or disable xUnit's parallel test
collections. Continue using xUnit fixtures for expensive shared resources and
collection isolation when that resource cannot safely run concurrently.

### 4. Publish a tag-scoped partial run

Use `[Tag]` on stable product capabilities. LiveDoc exposes each tag as an xUnit
`Category` trait:

```csharp
[Tag("authentication")]
[Feature("Login")]
public class LoginTests : FeatureTest { }
```

After publishing one full baseline, run affected tags as a partial so the Viewer
patches those results into the complete latest-known picture:

```powershell
$env:LIVEDOC_RUN_TYPE = "partial"
dotnet test --filter "Category=authentication"
```

Partial runs require a running LiveDoc server and a completed full baseline for the same project and environment. Set `LIVEDOC_RUN_TYPE=full` (or clear the variable) for the next complete run. Direct partial JSON export is not supported; release and production exports should use a full run.

### 5. Add coverage evidence

LiveDoc can attach .NET coverage as optional run evidence. The package includes the `LiveDocCoverage` collector and attachment processor.

The recommended command uses Microsoft Code Coverage, requests Cobertura directly, and includes branch data:

```powershell
dotnet test .\MySolution.sln --collect:"Code Coverage;Format=Cobertura"
```

In this repository:

```powershell
dotnet test .\dotnet\xunit\livedoc-xunit.sln --collect:"Code Coverage;Format=Cobertura"
```

No Coverlet package is required for that command. XPlat Code Coverage is a
Coverlet alternative that also supports branches and emits Cobertura directly.
Install `coverlet.collector` in every participating test project, set
`LIVEDOC_COVERAGE=true`, and run `dotnet test --collect:"XPlat Code Coverage"`.
Coverlet excludes test assemblies by default and can emit separate artifacts
per testhost, so Microsoft Code Coverage remains the recommended option for a
complete Visual Studio-style solution/module view.

Visual Studio's **Analyze Code Coverage for All Tests** may produce binary `.coverage` files. Install Microsoft's converter once:

```powershell
dotnet tool install --global dotnet-coverage
```

Visual Studio and VSTest finalize coverage after the in-process reporter. The packaged collector matches that attachment to the completed LiveDoc run and uploads normalized module/file coverage. Disable automatic post-run collection with `-p:LiveDocPostRunCoverageEnabled=false`.

The SDK selects the packaged `RunSettingsFilePath` when coverage is requested (`--collect:"Code Coverage"`, `--collect:"XPlat Code Coverage"`, `LIVEDOC_COVERAGE=true`, or Visual Studio test execution) and only when the project has not already set `RunSettingsFilePath` or `VSTestSetting`. Plain CLI `dotnet test` does not activate post-run coverage. Custom runsettings are never replaced: `LD-COV-001` identifies that case and points to the collector entry that must be merged explicitly. `LD-COV-000` confirms the selected settings, SDK path, and extension paths.

If the converter is missing, LiveDoc emits `LD-COV-062` with the legacy `dotnet-coverage-missing` code and install command. For local tool manifests or non-standard paths, set `LIVEDOC_DOTNET_COVERAGE_TOOL`. A run with no coverage attachment emits informational `LD-COV-051` and does not affect ordinary `dotnet test`. Successful uploads write a per-run accepted sentinel; `LD-COV-081` means that accepted run was seen again and was not posted twice, while failed uploads remain retryable. `LD-COV-080` means the server returned 2xx after durable persistence and includes websocket matched/sent/failed counts plus REST hydration availability; it does not claim viewer rendering. The viewer emits `LD-COV-090` only after coverage is in its store and `LD-COV-091` when hydration/application fails.

See the [Code Coverage guide](https://livedoc.swedevtools.com/viewer/guides/code-coverage) for dependencies, Visual Studio setup, custom runsettings, thresholds, and troubleshooting.

---

## AI Coding Skills

Install the LiveDoc AI skill for your coding assistant:

```bash
dotnet msbuild -t:LiveDocInstallSkills
```

Supports GitHub Copilot, OpenAI Codex, Claude Code, Roo Code, Cursor, and
Windsurf. Skills are installed inside the repository so they stay aligned with
the project's LiveDoc version. See the [AI Skill Setup Guide](https://livedoc.swedevtools.com/xunit/guides/ai-skill-setup) for details.

The installed skill also teaches agents how to resolve coverage diagnostics. If an agent sees `dotnet-coverage-missing`, it should install `dotnet-coverage` as a setup step or configure `LIVEDOC_DOTNET_COVERAGE_TOOL`.

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

📖 **[Full documentation at livedoc.swedevtools.com →](https://livedoc.swedevtools.com/xunit/learn/getting-started)**

Covers getting started, features, specifications, value extraction, scenario outlines, viewer integration, debugging, best practices, and more.

---

## License

MIT
