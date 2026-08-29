# Configure This Project for LiveDoc

You are configuring the current repository for LiveDoc. Inspect the repository
before changing files. Preserve existing package versions, test conventions,
Vitest configuration, `.runsettings`, CI workflows, and solution structure.

## Goal

Configure executable living documentation, LiveDoc Viewer publishing, and
optional code coverage for every supported test project in this repository.

## Required Discovery Conversation

Do not edit files, install packages, or start services immediately. Inspect the
repository first, then ask the developer configuration questions **one at a
time**. Skip questions already answered explicitly in the developer's prompt.

Use the detected repository state to recommend a default as the first option,
but let the developer decide:

1. **Scope** — Which detected test projects should use LiveDoc: all supported
   projects or a selected subset?
2. **Project identity** — What project name should the Viewer display? In a
   monorepo, should projects remain distinct or share one logical group?
3. **Viewer setup and publishing** — Should the agent install the Viewer
   globally, add it as a development dependency, use an existing installation,
   or skip it? Should local runs publish through auto-discovery, a specified
   server URL, or not publish yet?
4. **Environment identity** — Which environment names are needed, such as
   `local`, `ci`, or `staging`?
5. **Code coverage** — Enable coverage now? If yes, recommend V8 for Vitest and
   Microsoft Code Coverage with Cobertura for xUnit unless the repository
   already has a deliberate alternative.
6. **Coverage policy** — Should LiveDoc only display coverage, or also report
   non-fatal line and branch thresholds? Ask for threshold values when enabled;
   do not invent them.
7. **Incremental testing** — Should stable capability tags be configured as the
   primary selector for partial runs that patch the latest full Viewer baseline?
8. **Starter content** — Add a new representative LiveDoc test, convert a
   suitable existing test, or configure infrastructure only?
9. **AI tools** — Which repository-aware tools should receive LiveDoc skills?
   Support multiple selections from GitHub Copilot, OpenAI Codex, Claude Code,
   Roo Code, Cursor, and Windsurf.

After the final answer:

1. Summarize the proposed files, dependencies, project names, publishing
   behavior, coverage choices, AI tool destinations, and validation commands.
2. Ask for approval.
3. Make no changes until the developer approves that summary.

Do not ask for information the repository can answer mechanically, such as the
package manager, installed Vitest version, target frameworks, solution paths, or
existing configuration files.

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

If the developer enables coverage, inspect the installed Vitest version and
install the matching V8 provider version:

```bash
npm install --save-dev @vitest/coverage-v8
```

Use `@vitest/coverage-istanbul` only when the project explicitly prefers the
Istanbul provider.

### Configure `vitest.config.ts`

Merge the selected settings into the existing `test` block. Omit `coverage`
configuration when the developer declines coverage. Use the approved project
and environment names in `publish` configuration or the corresponding
environment variables:

```typescript
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    include: ['**/*.Spec.ts'],
    reporters: [
      new LiveDocSpecReporter({
        publish: {
          project: 'approved-project-name',
          environment: 'local',
        },
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

### Add repeatable commands

Preserve existing package scripts. Add these scripts when the names are
available; if an equivalent script already exists, reuse it and report its
name:

```json
{
  "scripts": {
    "test:livedoc": "vitest run",
    "test:livedoc:coverage": "vitest run --coverage"
  }
}
```

Always add `test:livedoc`. Add `test:livedoc:coverage` only when coverage is
enabled and the matching provider is installed. Use the repository's package
manager in the completion report:

```bash
npm run test:livedoc
npm run test:livedoc:coverage
```

For pnpm, use `pnpm test:livedoc`; for Yarn, use `yarn test:livedoc`.

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

Only configure this section when the developer enables coverage. Prefer
Microsoft Code Coverage for complete Visual Studio-style module scope and branch
data. The LiveDoc package already includes the `LiveDocCoverage` collector; do
not add Coverlet for this path.

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

### Add repeatable commands

Create repository-local launchers so developers never need to remember the
coverage collector syntax:

- `scripts/test-livedoc.ps1`
- `scripts/test-livedoc.sh`

Use the repository's existing scripts directory and naming conventions when
they differ. Embed the approved solution or test-project paths discovered
during setup. Prefer a solution; when no solution contains all selected test
projects, include each selected project and stop after the first failure.

Generate the PowerShell launcher from this structure, replacing the target:

```powershell
[CmdletBinding()]
param(
    [switch]$Coverage,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TestArguments
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$testTargets = @(
    (Join-Path $repoRoot "MySolution.sln")
)

foreach ($target in $testTargets) {
    $dotnetArguments = @("test", $target)
    if ($Coverage) {
        $dotnetArguments += @("--collect", "Code Coverage;Format=Cobertura")
    }
    $dotnetArguments += $TestArguments

    & dotnet @dotnetArguments
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
```

Generate the shell launcher from this structure and mark it executable:

```bash
#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_targets=("$repo_root/MySolution.sln")

coverage=false
if [[ "${1:-}" == "--coverage" ]]; then
  coverage=true
  shift
fi

for target in "${test_targets[@]}"; do
  dotnet_arguments=(test "$target")
  if [[ "$coverage" == "true" ]]; then
    dotnet_arguments+=(--collect "Code Coverage;Format=Cobertura")
  fi

  dotnet "${dotnet_arguments[@]}" "$@"
done
```

The resulting commands are:

```powershell
.\scripts\test-livedoc.ps1
.\scripts\test-livedoc.ps1 -Coverage
```

```bash
./scripts/test-livedoc.sh
./scripts/test-livedoc.sh --coverage
```

Do not add `dotnet-coverage` merely to support these launchers. Direct
Cobertura collection uses the packaged LiveDoc collector. Install
`dotnet-coverage` only for binary `.coverage` conversion.

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

When the developer selects a global Viewer installation, install and start it:

```bash
npm install --global @swedevtools/livedoc-viewer
livedoc-viewer
```

For a development dependency, use the repository package manager and add
`@swedevtools/livedoc-viewer` as a dev dependency instead. Preserve an existing
installation when present. The default URL is `http://localhost:3100`.

Verify:

- Results update live.
- Coverage is hidden for ordinary runs and appears for coverage runs.
- Logical project groups contain related test projects only once.
- Contextual URLs restore the exact project, environment, run/group, projection,
  and page.

## Install Version-Matched AI Skills

AI-led setup always installs the package-provided LiveDoc skills for every tool
the developer selected. Install them inside the repository, never in a user or
global location. Repository-local skills:

- remain aligned with the LiveDoc package version used by this project;
- can be reviewed and committed with the project;
- do not change behavior in unrelated repositories;
- work for every developer who clones the repository.

Vitest:

```bash
npx livedoc-vitest-setup --tool copilot,codex,claude
```

xUnit:

```powershell
dotnet msbuild -t:LiveDocInstallSkills -p:LiveDocAITool=copilot,codex,claude
```

Use only the approved tool keys. Supported keys are `copilot`, `codex`,
`claude`, `roo`, `cursor`, and `windsurf`; `all` installs every supported
target. In a mixed repository, install both SDK skills for the same selected
tools. Commit the generated instruction files with the project.

## Completion Report

Report:

1. Files changed.
2. Dependencies added and why.
3. Manual versus AI-managed configuration decisions.
4. Test and coverage commands executed.
5. Any warnings, missing modules, or runsettings conflicts.
6. The Viewer URL and the expected project/environment names.
7. AI tools configured and their repository-local skill paths.
8. Normal and coverage commands created for developers.
