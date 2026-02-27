# LiveDoc

[![CI](https://github.com/dotnetprofessional/LiveDoc/actions/workflows/ci.yml/badge.svg)](https://github.com/dotnetprofessional/LiveDoc/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![.NET](https://img.shields.io/badge/.NET-8.0-purple.svg)](https://dotnet.microsoft.com/)

A **Living Documentation** platform that brings Gherkin-style BDD syntax to modern testing frameworks, enabling executable specifications that serve as living documentation.

📖 **[Full Documentation →](http://livedoc.swedevtools.com/)**

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [@swedevtools/livedoc-vitest](packages/vitest) | Gherkin BDD syntax for Vitest | ✅ Active |
| [@swedevtools/livedoc-viewer](packages/viewer) | Real-time web UI for test results | ✅ Active |
| [livedoc-vscode](packages/vscode) | VS Code extension with snippets & formatting | ✅ Active |
| [SweDevTools.LiveDoc.xUnit](dotnet/xunit) | BDD syntax for xUnit (.NET) | ✅ Active |

## Quick Start — TypeScript (Vitest)

```bash
npm install @swedevtools/livedoc-vitest vitest --save-dev
```

```typescript
import { feature, scenario, given, when, Then as then } from '@swedevtools/livedoc-vitest';

feature('Calculator', () => {
    scenario('Adding two numbers', () => {
        let result = 0;

        given("I have entered '50' into the calculator", (ctx) => {
            result = ctx.step.values[0];
        });

        when("I press add and enter '70'", (ctx) => {
            result += ctx.step.values[0];
        });

        then("the result should be '120'", (ctx) => {
            expect(result).toBe(ctx.step.values[0]);
        });
    });
});
```

📖 [Vitest Getting Started →](http://livedoc.swedevtools.com/docs/vitest/learn/getting-started)

## Quick Start — C# (xUnit)

```bash
dotnet add package SweDevTools.LiveDoc.xUnit
```

```csharp
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

[Feature("Calculator")]
public class CalculatorTests : FeatureTest
{
    public CalculatorTests(ITestOutputHelper output) : base(output) { }

    [Scenario("Adding two numbers")]
    public void AddingTwoNumbers()
    {
        int result = 0;
        Given("I have entered '50' into the calculator", ctx => result = ctx.Values[0]);
        When("I press add and enter '70'", ctx => result += ctx.Values[0]);
        Then("the result should be '120'", ctx => Expect(result).ToBe(ctx.Values[0]));
    }
}
```

📖 [xUnit Getting Started →](http://livedoc.swedevtools.com/docs/xunit/learn/getting-started)

## Features

- ✨ **Gherkin Syntax** — Write tests using Given/When/Then
- 📊 **Data Tables & Scenario Outlines** — Data-driven testing
- 🎯 **Tag Filtering** — Include/exclude tests by tags
- 🖥️ **[Live Viewer](http://livedoc.swedevtools.com/docs/viewer/learn/getting-started)** — Real-time web UI for test results
- 📋 **Beautiful Output** — Formatted, colored test results in your terminal

## License

MIT
