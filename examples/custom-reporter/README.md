# Custom Reporter Example - Emoji Reporter 🎉

This example demonstrates how to create a custom Vitest reporter. It shows a simple emoji-based reporter that outputs test results using emojis.

## Quick Start

```bash
# From the repository root
cd examples/custom-reporter

# Install dependencies
pnpm install

# Run tests with the emoji reporter
pnpm test
```

## Sample Output

```
🚀 Starting test run...

📂 Calculator.Spec.ts
😃 😃 😃 😃 😃 😃 😃 😃 😃 

✨ Test run complete!

📊 Results:
   😃 Passed: 9
   😡 Failed: 0
   😴 Skipped: 0
   📝 Total: 9

✅ All tests passed!
```

## How It Works

### Creating a Custom Reporter

A Vitest reporter implements the `Reporter` interface. Here are the key hooks:

```typescript
import type { Reporter, File, TaskResultPack } from 'vitest';

export class EmojiReporter implements Reporter {
    // Called when test run starts
    onInit(): void { }
    
    // Called when test files are collected
    onCollected(files?: File[]): void { }
    
    // Called when individual test results come in
    onTaskUpdate(packs: TaskResultPack[]): void { }
    
    // Called when all tests complete
    onFinished(files?: File[], errors?: unknown[]): void { }
}
```

### Using the Reporter

Configure it in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { EmojiReporter } from './src/EmojiReporter';

export default defineConfig({
    test: {
        reporters: [new EmojiReporter()],
    },
});
```

## LiveDoc-Aware Reporters

For reporters that understand LiveDoc's BDD structure (Features, Scenarios, Steps), you can:

1. **Use built-in reporters** like `LiveDocSpecReporter`
2. **Extend `LiveDocSpec`** for custom formatting with BDD awareness

### Example: Using LiveDocSpecReporter

```typescript
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
    test: {
        reporters: [new LiveDocSpecReporter({
            detailLevel: 'spec+summary+headers'
        })],
    },
});
```

### Available Detail Levels

- `spec` - Full specification output with steps
- `summary` - Summary statistics at the end
- `headers` - Show file headers
- `list` - List format output
- `silent` - No output (useful for JSON only)

Combine with `+`: `'spec+summary+headers'`

## Files in This Example

```
custom-reporter/
├── src/
│   └── EmojiReporter.ts    # The custom reporter implementation
├── test/
│   └── Calculator.Spec.ts  # Sample BDD tests
├── vitest.config.ts        # Vitest configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Step Function Naming

**Important:** In @swedevtools/livedoc-vitest, step functions use PascalCase:

```typescript
import { feature, scenario, Given, When, Then, And, But } from "@swedevtools/livedoc-vitest";

scenario("My test", () => {
    Given("some precondition", () => { });
    When("an action occurs", () => { });
    Then("verify result", () => { });
    And("additional check", () => { });
});
```

## Further Reading

- [Vitest Reporter API](https://vitest.dev/guide/reporters.html)
- [LiveDoc Documentation](../../packages/vitest/README.md)
