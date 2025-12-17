<div align="center">

# 🏗️ Architecture

### How LiveDoc works under the hood

</div>

---

## Overview

LiveDoc transforms Gherkin-style TypeScript into Vitest tests at runtime. Here's the flow:

```
Your Spec File
     ↓
┌─────────────────────────────────────────┐
│  LiveDoc DSL (feature, scenario, etc.)  │
│  • Parses titles and extracts metadata  │
│  • Builds model objects (Feature, etc.) │
│  • Registers with Vitest (describe/it)  │
└─────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────┐
│  Vitest Execution                       │
│  • Runs describe/it blocks              │
│  • Collects results                     │
│  • Calls reporter hooks                 │
└─────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────┐
│  LiveDoc Reporters                      │
│  • Rebuilds model from Vitest results   │
│  • Formats output                       │
│  • Exports JSON / posts to server       │
└─────────────────────────────────────────┘
```

---

## Core modules

### `livedoc.ts` — The DSL

This is the heart of LiveDoc. It exports the keywords (`feature`, `scenario`, `given`, etc.) and orchestrates registration.

**Key responsibilities:**
- Parse titles using `LiveDocGrammarParser`
- Extract tags, descriptions, tables, and doc strings
- Create model objects (`Feature`, `Scenario`, `StepDefinition`)
- Map to Vitest's `describe()` and `it()`
- Handle skip/only modifiers
- Apply tag filters

**Key state:**
```ts
let currentFeature: Feature | null = null;
let currentScenario: Scenario | null = null;
let currentBackground: Background | null = null;
let currentStep: StepDefinition | null = null;
```

These track the current execution context and are used to build the model tree.

### `parser/Parser.ts` — Title parsing

The `LiveDocGrammarParser` extracts structured data from step titles:

```ts
// Input: "the user has '$100' and '$50'"
// Output: { values: [100, 50], title: "the user has '$100' and '$50'" }

// Input: "users\n| name | email |"
// Output: { table: [...], title: "users" }
```

### `model/` — Data model

The model classes represent the test structure:

```
ExecutionResults
├── features: Feature[]
│   ├── background: Background
│   ├── scenarios: Scenario[]
│   │   ├── steps: StepDefinition[]
│   │   └── (for outlines) examples: ScenarioExample[]
│   └── ruleViolations: LiveDocRuleViolation[]
├── specifications: Specification[]
│   └── rules: Rule[]
└── suites: VitestSuite[] (non-LiveDoc tests)
```

### `reporter/` — Output formatters

**`LiveDocSpecReporter`**: Primary CLI reporter. Implements Vitest's `Reporter` interface.

```ts
interface Reporter {
  onInit(ctx: Vitest): void;
  onTestRunEnd(testModules: readonly TestModule[]): Promise<void>;
}
```

Key method: `buildFeatureFromSuite()` — reconstructs the LiveDoc model from Vitest's task tree.

**`LiveDocSpec`**: Formatting engine. Handles colors, tables, and the actual text output.

**`JsonReporter`**: Post-reporter that writes results to a JSON file.

**`LiveDocViewerReporter`**: Post-reporter that POSTs results to a web server.

---

## Registration flow

When you write:

```ts
feature("Cart", () => {
  scenario("Add item", () => {
    given("an empty cart", () => {});
  });
});
```

Here's what happens:

1. **`feature("Cart", fn)`** is called
   - Parser extracts title, tags, description
   - Creates `Feature` model object
   - Calls `vitestDescribe("Feature: Cart", fn)`

2. **Inside the describe callback, `scenario("Add item", fn)`** is called
   - Creates `Scenario` model, links to feature
   - Calls `vitestDescribe("Scenario: Add item", fn)`

3. **Inside that callback, `given("an empty cart", fn)`** is called
   - Creates `StepDefinition` model
   - Calls `vitestIt("given an empty cart", wrappedFn)`
   - The wrapped function handles timing, status, and context

---

## The `ctx` object

Each callback receives a context object dynamically built from current state:

```ts
const ctx = {
  get feature() {
    return currentFeature?.getFeatureContext();
  },
  get scenario() {
    return currentScenario?.getScenarioContext();
  },
  get step() {
    return currentStep?.getStepContext();
  },
  // ...
};
```

These getters ensure you always get the current context, even in async code.

---

## Tag filtering

Filtering happens at registration time:

```ts
function featureImpl(title, fn, opts) {
  // Parse title, extract tags
  const feature = parser.createFeature(title);
  
  // Check filters
  const shouldSkip = shouldMarkAsPending(feature.tags);
  const shouldOnly = shouldInclude(feature.tags);
  
  // Choose describe variant
  const describeFunc = shouldSkip 
    ? vitestDescribe.skip 
    : shouldOnly 
      ? vitestDescribe.only 
      : vitestDescribe;
  
  describeFunc(feature.displayTitle, () => { ... });
}
```

---

## Reporter reconstruction

Reporters don't have direct access to LiveDoc's model objects. Instead, they reconstruct the model from Vitest's task tree:

```ts
async onTestRunEnd(testModules) {
  const features: Feature[] = [];
  
  for (const module of testModules) {
    for (const suite of module.task.tasks) {
      if (suite.name.startsWith('Feature:')) {
        features.push(this.buildFeatureFromSuite(suite));
      }
    }
  }
  
  // Now format and output
  this.liveDocSpec.executionEnd({ features });
}
```

This design means reporters work even if tests are run in worker threads.

---

## Dynamic test execution

For advanced use cases (like the VS Code extension), LiveDoc supports dynamic execution:

```ts
import { executeDynamicTestAsync } from '@livedoc/vitest';

const results = await executeDynamicTestAsync(`
  feature("Dynamic", () => {
    scenario("Test", () => {
      given("something", () => {});
    });
  });
`);
```

This:
1. Writes code to a temp file
2. Spawns a Vitest subprocess
3. Reads results from a JSON file
4. Returns the `ExecutionResults` model

---

## Key design decisions

### Why map to Vitest's describe/it?

- Leverages Vitest's proven test runner
- Works with existing tooling (VS Code, CI, etc.)
- No custom test discovery needed

### Why reconstruct model in reporters?

- Vitest runs tests in worker threads
- Direct model access isn't reliable across processes
- Task tree is the stable contract

### Why `Then` instead of `then`?

- ES modules treat `then` as a thenable indicator
- Some tools await module namespace objects if they have `then`
- Uppercase export sidesteps this entirely

---

## Directory structure

```
packages/vitest/_src/app/
├── livedoc.ts           # DSL implementation
├── setup.ts             # Globals registration
├── index.ts             # Public exports
├── parser/
│   ├── Parser.ts        # Title parsing
│   └── TextBlockReader.ts
├── model/
│   ├── Feature.ts
│   ├── Scenario.ts
│   ├── StepDefinition.ts
│   ├── Specification.ts
│   ├── Rule.ts
│   └── ...
└── reporter/
    ├── LiveDocSpecReporter.ts
    ├── LiveDocSpec.ts
    ├── JsonReporter.ts
    ├── LiveDocViewerReporter.ts
    └── ...
```

---

<div align="center">

[← Troubleshooting](./troubleshooting.md) · [Contributing →](./contributing.md)

</div>
