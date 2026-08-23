# Configure This Project for LiveDoc

You are configuring the current repository for LiveDoc. Inspect the repository
before changing files. Preserve existing package versions, test conventions,
Vitest configuration, `.runsettings`, CI workflows, and solution structure.

## Goal

Configure executable living documentation, LiveDoc Viewer publishing, and
optional code coverage for every supported test project in this repository.

## Detect the Project Type

1. If the repository contains `vitest.config.*`, `vite.config.*`, or a
   JavaScript/TypeScript package using Vitest, follow **Vitest Setup**.
2. If it contains `.csproj`/`.sln` test projects using xUnit, follow
   **xUnit Setup**.
3. In a mixed monorepo, configure both.
4. Do not replace working configuration files. Merge the required settings.

## Vitest Setup

### Install dependencies

Use the repository's existing package manager.

```bash
npm install --save-dev vitest @swedevtools/livedoc-vitest
```

For coverage, inspect the installed Vitest version and install the matching V8
provider version:

```bash
npm install --save-dev @vitest/coverage-v8
```

Use `@vitest/coverage-istanbul` only when the project explicitly prefers the
Istanbul provider.

### Configure `vitest.config.ts`

Merge these settings into the existing `test` block:

```typescript
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    include: ['**/*.Spec.ts'],
    reporters: [
      new LiveDocSpecReporter({
        coverage: {
          enabled: true,
          thresholds: {
            lines: 80,
            branches: 75,
          },
        },
      }),
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
```

Preserve existing include/exclude patterns, reporters, setup files, aliases,
environments, pools, and coverage settings. Do not enable globals unless the
project already uses them or the developer requests them.

### Add or convert a representative test

- Name LiveDoc files `*.Spec.ts`.
- Use `feature`/`scenario` for business behavior.
- Use `specification`/`rule` for developer-focused rules.
- Put all inputs and expected outputs in titles.
- Extract values from `ctx.step.values`, `ctx.step.params`, or `ctx.example`.
- Import `Then as then`; never import lowercase `then` directly.

### Validate

```bash
npx vitest run
npx vitest run --coverage
```

Confirm the Viewer receives tests plus line, branch, function, and statement
coverage.

## xUnit Setup

### Install dependencies

For each xUnit test project:

```powershell
dotnet add package SweDevTools.LiveDoc.xUnit
```

Verify the project also references:

- `Microsoft.NET.Test.Sdk`
- `xunit`
- `xunit.runner.visualstudio`

LiveDoc supports `net8.0` and `net10.0`. Preserve the project's existing target
frameworks.

### Configure tests

- Inherit BDD classes from `FeatureTest`.
- Inherit specification classes from `SpecificationTest`.
- Accept `ITestOutputHelper` in the constructor and pass it to `base(output)`.
- Use `[Feature]`/`[Scenario]` or `[Specification]`/`[Rule]`.
- Put inputs and expected outputs in titles.
- Extract values with `ctx.Step!.Values`, `ctx.Step!.Params`, `Rule.Values`,
  `Rule.Params`, or outline parameters.
- Preserve namespace hierarchy because it drives Viewer navigation.

### Configure Viewer publishing

No assembly attribute is required. Start the Viewer before tests; the package
auto-discovers `http://localhost:3100`. For another server or CI, configure:

```powershell
$env:LIVEDOC_SERVER_URL = "http://localhost:3100"
$env:LIVEDOC_PROJECT = "my-project"
$env:LIVEDOC_ENVIRONMENT = "local"
```

### Configure full solution coverage

Prefer Microsoft Code Coverage for complete Visual Studio-style module scope and
branch data. The LiveDoc package already includes the `LiveDocCoverage`
collector; do not add Coverlet for this path.

```powershell
dotnet test .\MySolution.sln --collect:"Code Coverage;Format=Cobertura"
```

If Visual Studio emits binary `.coverage` files, install:

```powershell
dotnet tool install --global dotnet-coverage
```

If the repository already selects a `.runsettings` file, preserve it and merge:

```xml
<DataCollector
  friendlyName="LiveDocCoverage"
  uri="datacollector://swedevtools/livedoc/coverage"
  enabled="True" />
```

XPlat/Coverlet is an alternative. It supports line, branch, and method coverage,
but install `coverlet.collector` in every participating test project. Coverlet
excludes test assemblies by default and commonly emits one attachment per
testhost.

```powershell
dotnet add package coverlet.collector
$env:LIVEDOC_COVERAGE = "true"
dotnet test .\MySolution.sln --collect:"XPlat Code Coverage"
```

### Validate

```powershell
dotnet test .\MySolution.sln
dotnet test .\MySolution.sln --collect:"Code Coverage;Format=Cobertura"
```

Confirm:

- VSTest and LiveDoc totals/failures match.
- Failed steps show assertion messages and stack traces.
- Coverage includes every expected module plus line and branch metrics.
- `LD-COV-000` appears when packaged runsettings are selected.
- Custom runsettings produce `LD-COV-001` until `LiveDocCoverage` is merged.

## Viewer Setup

Install and start the Viewer:

```bash
npm install --global @swedevtools/livedoc-viewer
livedoc-viewer
```

The default URL is `http://localhost:3100`.

Verify:

- Results update live.
- Coverage is hidden for ordinary runs and appears for coverage runs.
- Logical project groups contain related test projects only once.
- Contextual URLs restore the exact project, environment, run/group, projection,
  and page.

## Optional: Install Reusable AI Skills

After the project works, install LiveDoc's reusable skill files so future AI
changes follow the framework conventions automatically.

Vitest:

```bash
npx livedoc-vitest-setup
```

xUnit:

```powershell
dotnet msbuild -t:LiveDocInstallSkills
```

Commit the installed instruction files when the team wants shared AI guidance.

## Completion Report

Report:

1. Files changed.
2. Dependencies added and why.
3. Manual versus AI-managed configuration decisions.
4. Test and coverage commands executed.
5. Any warnings, missing modules, or runsettings conflicts.
6. The Viewer URL and the expected project/environment names.

