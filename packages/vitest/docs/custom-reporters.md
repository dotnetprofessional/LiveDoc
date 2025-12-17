<div align="center">

# 🔌 Custom Reporters

### Extend LiveDoc with your own reporting solutions

</div>

---

LiveDoc provides a powerful extension system for creating custom reporters. There are two types:

| Type              | When it runs                | Use case                               |
| ----              | ----                        | ----                                   |
| **Post Reporter** | After all tests complete    | JSON export, CI integration, summaries |
| **UI Reporter**   | During test execution       | Custom console output, live dashboards |

---

## Post Reporters

Post reporters receive the complete test results after execution finishes. They're perfect for generating reports, exporting data, or integrating with external systems.

### The interface

```ts
import { ExecutionResults } from '@livedoc/vitest/reporter';

interface IPostReporter {
  execute(results: ExecutionResults, options?: any): void | Promise<void>;
}
```

### Example: Custom JSON reporter

```ts
import * as fs from 'fs';
import { IPostReporter, ExecutionResults } from '@livedoc/vitest/reporter';

export class MyJsonReporter implements IPostReporter {
  execute(results: ExecutionResults, options?: any): void {
    const outputFile = options?.['my-output'] ?? 'results.json';
    
    // Extract what you need from results
    const summary = {
      timestamp: new Date().toISOString(),
      features: results.features.map(f => ({
        title: f.title,
        passed: f.statistics.passedCount,
        failed: f.statistics.failedCount,
        scenarios: f.scenarios.map(s => ({
          title: s.title,
          status: s.statistics.failedCount === 0 ? 'passed' : 'failed',
        })),
      })),
    };

    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
    console.log(`📄 Report written to: ${outputFile}`);
  }
}
```

### Using your post reporter

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';
import { MyJsonReporter } from './reporters/MyJsonReporter';

export default defineConfig({
  test: {
    reporters: [
      new LiveDocSpecReporter({
        postReporters: [new MyJsonReporter()],
        'my-output': './test-results/summary.json',
      }),
    ],
  },
});
```

---

## The ExecutionResults model

Post reporters receive a rich data structure containing all test results:

```
ExecutionResults
├── features[]
│   ├── title, description, tags, filename
│   ├── statistics { passedCount, failedCount, pendingCount, ... }
│   ├── background?
│   │   └── steps[]
│   ├── scenarios[]
│   │   ├── title, description, tags
│   │   ├── statistics
│   │   └── steps[]
│   │       ├── title, displayTitle, type (given/when/then/and/but)
│   │       ├── values[], table[], docString
│   │       └── status, error?, duration
│   └── scenarioOutlines[]
│       ├── title, tables[]
│       └── examples[]
│           └── (same as scenario)
└── statistics (aggregated totals)
```

### Accessing feature data

```ts
execute(results: ExecutionResults): void {
  for (const feature of results.features) {
    console.log(`Feature: ${feature.title}`);
    console.log(`  Tags: ${feature.tags.join(', ')}`);
    console.log(`  Passed: ${feature.statistics.passedCount}`);
    console.log(`  Failed: ${feature.statistics.failedCount}`);
    
    for (const scenario of feature.scenarios) {
      const status = scenario.statistics.failedCount === 0 ? '✓' : '✗';
      console.log(`  ${status} ${scenario.title}`);
      
      for (const step of scenario.steps) {
        console.log(`    ${step.type}: ${step.displayTitle}`);
        if (step.error) {
          console.log(`      Error: ${step.error.message}`);
        }
      }
    }
  }
}
```

---

## UI Reporters

For custom console output during test execution, extend `LiveDocReporter`:

### The base class

```ts
import * as model from '@livedoc/vitest/reporter';

abstract class LiveDocReporter {
  protected colorTheme: ColorTheme;
  protected useColors: boolean;
  
  // Override these lifecycle hooks
  protected executionStart(): void { }
  protected executionEnd(results: model.ExecutionResults): void { }
  
  protected featureStart(feature: model.Feature): void { }
  protected featureEnd(feature: model.Feature): void { }
  
  protected scenarioStart(scenario: model.Scenario): void { }
  protected scenarioEnd(scenario: model.Scenario): void { }
  
  protected scenarioOutlineStart(scenario: model.ScenarioOutline): void { }
  protected scenarioOutlineEnd(scenario: model.ScenarioOutline): void { }
  
  protected scenarioExampleStart(example: model.ScenarioExample): void { }
  protected scenarioExampleEnd(example: model.ScenarioExample): void { }
  
  protected backgroundStart(background: model.Background): void { }
  protected backgroundEnd(background: model.Background): void { }
  
  protected stepStart(step: model.StepDefinition): void { }
  protected stepEnd(step: model.StepDefinition): void { }
  
  // Utility methods
  protected writeLine(text: string): void { }
  protected write(text: string): void { }
  protected formatTable(dataTable: any[][], headerStyle: HeaderType): string { }
  protected highlight(content: string, regex: RegExp, color: any): string { }
  protected bind(content: string, model: any, color: any): string { }
}
```

### Example: Emoji reporter

A simple reporter that shows emoji for each scenario result:

```ts
import { LiveDocReporter } from '@livedoc/vitest/reporter';
import * as model from '@livedoc/vitest/reporter';

export class EmojiReporter extends LiveDocReporter {
  
  protected featureStart(feature: model.Feature): void {
    this.write(`${feature.title}: `);
  }

  protected featureEnd(feature: model.Feature): void {
    this.writeLine('');
  }

  protected scenarioEnd(scenario: model.Scenario): void {
    this.outputEmoji(scenario);
  }

  protected scenarioExampleEnd(example: model.ScenarioExample): void {
    this.outputEmoji(example);
  }

  private outputEmoji(scenario: model.Scenario): void {
    if (scenario.statistics.failedCount === 0) {
      this.write('😃 ');
    } else {
      this.write('😡 ');
    }
  }
}
```

**Output:**
```
Shopping Cart: 😃 😃 😃 
User Login: 😃 😡 😃 
```

---

## Helper methods

`LiveDocReporter` includes several utility methods:

### `writeLine(text)` / `write(text)`

Output text to the console. Automatically strips ANSI codes if `useColors` is false.

### `formatTable(data, headerStyle)`

Format a data table for console output:

```ts
const table = [
  ['Name', 'Price'],
  ['Widget', '$10'],
  ['Gadget', '$25'],
];
this.writeLine(this.formatTable(table, HeaderType.Top));
```

### `highlight(content, regex, color)`

Highlight matches in text:

```ts
const highlighted = this.highlight(
  "the price is $100", 
  /\$\d+/g, 
  this.colorTheme.highlight
);
```

### `bind(content, model, color)`

Substitute `<placeholders>` with values from a model:

```ts
const bound = this.bind(
  "the customer pays <amount>",
  { amount: "100" },
  this.colorTheme.highlight
);
// "the customer pays 100" (with 100 highlighted)
```

### `secondaryBind(content, model, color)`

Same as `bind` but for `{{placeholders}}` syntax.

---

## Built-in reporters

LiveDoc ships with several reporters you can use or extend:

| Reporter                  | Purpose                           |
| ----                      | ----                              |
| `LiveDocSpecReporter`     | Full spec output with summaries   |
| `JsonReporter`            | Export to JSON file               |
| `LiveDocViewerReporter`   | Send to LiveDoc Viewer web UI     |
| `LiveDocServerReporter`   | Auto-discover and post to server  |

### Extending built-in reporters

```ts
import { LiveDocSpec } from '@livedoc/vitest/reporter';

export class MySpecReporter extends LiveDocSpec {
  protected featureStart(feature: model.Feature): void {
    // Add custom header
    this.writeLine('═'.repeat(50));
    super.featureStart(feature);
  }
}
```

---

## Tips

### 1. Use post reporters for file output

Post reporters are simpler and have access to complete results. Prefer them for generating files or reports.

### 2. Avoid blocking in UI reporters

UI reporter methods are called synchronously. Keep them fast to avoid slowing down test execution.

### 3. Test with small suites first

When developing a custom reporter, test with a small test file first:

```bash
npx vitest run test/MyFeature.Spec.ts
```

### 4. Use the JSON reporter for exploration

Not sure what data is available? Use `JsonReporter` to dump the full results:

```ts
new LiveDocSpecReporter({
  postReporters: [new JsonReporter()],
  'json-output': 'debug-results.json',
})
```

---

<div align="center">

[← Reporting](./reporting.md) · [Architecture →](./architecture.md)

</div>
