# LiveDoc

A Living Documentation platform for BDD projects using JavaScript/TypeScript testing frameworks.

## Overview

LiveDoc brings Gherkin-style BDD syntax to modern testing frameworks, enabling you to write expressive, executable specifications that serve as living documentation.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [@swedevtools/livedoc-vitest](packages/vitest) | Gherkin BDD syntax for Vitest | ✅ Active |
| [@swedevtools/livedoc-viewer](packages/viewer) | Web UI for viewing test results | ✅ Active |
| [livedoc-vscode](packages/vscode) | VS Code extension with snippets | ✅ Active |
| [LiveDoc.xUnit](dotnet/xunit) | BDD syntax for xUnit (.NET) | ✅ Active |

## Quick Start

### Installation

```bash
npm install @swedevtools/livedoc-vitest vitest --save-dev
```

### Write Your First Feature

```typescript
import { feature, scenario, given, when, then } from '@swedevtools/livedoc-vitest';

feature('Calculator', () => {
    scenario('Adding two numbers', () => {
        let result: number;

        given('I have a calculator', () => {
            // Setup
        });

        when("I add '2' and '3'", (ctx) => {
            result = ctx.values[0] + ctx.values[1];
        });

        then("the result should be '5'", (ctx) => {
            expect(result).toBe(ctx.values[0]);
        });
    });
});
```

### Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
    test: {
        reporters: [new LiveDocSpecReporter()],
    },
});
```

### Run Tests

```bash
npx vitest
```

## Features

- ✨ **Gherkin Syntax** - Write tests using Given/When/Then
- 📊 **Data Tables** - Inline tables for test data
- 🔄 **Scenario Outlines** - Data-driven testing with examples
- 📋 **Beautiful Output** - Formatted test results
- 🎯 **Tag Filtering** - Include/exclude tests by tags
- 📄 **JSON Export** - Export results for reporting tools
- 🖥️ **Live Viewer** - Real-time web UI for test results

## Live Viewer

See your test results in real-time with the LiveDoc Viewer:

```bash
# Install the viewer globally
npm install -g @swedevtools/livedoc-viewer

# Start the viewer (opens browser automatically)
livedoc-viewer

# Run your tests in another terminal
npx vitest run
```

Results appear in your browser as tests run. See the [@swedevtools/livedoc-viewer README](packages/viewer/README.md) for full documentation.

## Documentation

See the [@swedevtools/livedoc-vitest README](packages/vitest/README.md) for full documentation.

## License

MIT
