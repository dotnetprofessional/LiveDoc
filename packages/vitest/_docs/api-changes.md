# LiveDoc API Changes - Mocha to Vitest Migration

## Overview

This document outlines all API changes between `livedoc-mocha` and `livedoc-vitest`. The migration prioritizes clean, modern design over backward compatibility while preserving all core Gherkin BDD functionality.

## Philosophy

**Core Principle:** API changes must provide clear developer experience improvements, not just be different for the sake of being different.

**Compatibility Requirement:** All Gherkin features (feature/scenario/given/when/then/background/scenario outline/tags/filtering) must be preserved.

## Breaking Changes

### 1. Context Access Pattern

**Mocha (v0.4.x):**
```typescript
// Global contexts available
feature("Shopping Cart", () => {
  // Tests use LOCAL VARIABLES for data
  const cart = new ShoppingCart();
  
  scenario("Add item to cart", () => {
    given("a product costs '10'", () => {
      // stepContext has step metadata (title, values, tables)
      const price = stepContext.values[0];
      cart.addItem("tea", price);
    });
    
    when("adding '5' items", () => {
      const quantity = stepContext.values[0];
      cart.quantity = quantity;
    });
    
    then("the total is '50'", () => {
      const expected = stepContext.values[0];
      expect(cart.total).to.equal(expected);
    });
  });
  
  scenario("Remove item from cart", () => {
    // cart still available via closure
    when("removing all items", () => {
      cart.clear();
    });
  });
});
```

**Vitest (v1.0.x):**
```typescript
// Same pattern - local variables + context for metadata
feature("Shopping Cart", () => {
  // Use LOCAL VARIABLES for test data (same as original!)
  const cart = new ShoppingCart();
  
  scenario("Add item to cart", () => {
    given("a product costs '10'", async (ctx) => {
      // ctx.step has step metadata
      const price = ctx.step.values[0];
      cart.addItem("tea", price);
    });
    
    when("adding '5' items", async (ctx) => {
      const quantity = ctx.step.values[0];
      cart.quantity = quantity;
    });
    
    then("the total is '50'", async (ctx) => {
      const expected = ctx.step.values[0];
      expect(cart.total).to.equal(expected);
    });
  });
  
  scenario("Remove item from cart", () => {
    when("removing all items", async (ctx) => {
      cart.clear();
    });
  });
});
```

**Critical Understanding:**

1. **`ctx.feature`** - Framework metadata ONLY (filename, title, description, tags)
   - **NOT for user data!** It's read-only metadata about the feature
   
2. **`ctx.scenario`** - Framework metadata ONLY (title, description, tags)
   - **NOT for user data!** It's read-only metadata about the scenario
   
3. **`ctx.step`** - Framework metadata (title, values, tables, docString)
   - Provides parsed step data (values from quotes, data tables, doc strings)
   
4. **`ctx.example`** - Current example data in scenario outlines
   - **Only available in scenario outline steps**
   
5. **`ctx.background`** - Background step metadata
   - **Available in all steps after background executes**
   - Contains references to background step contexts (given, and arrays)

6. **`ctx.params`** - Named inline parameters (proposed enhancement)
   - **Only when using `<name:value>` syntax in step title**

**Where to store test data:** Use **local variables** with closure (just like original!)

**Parameter Access Patterns:**

The same `<placeholder>` syntax can mean different things depending on context. Here's when to use each access pattern:

```typescript
// 1. Quoted values - indexed access (existing)
given("the temperature is '30' degrees", async (ctx) => {
  const temp = ctx.step.values[0];  // 30 (parsed from single quotes)
});

// 2. Scenario outline placeholders - example data (existing)
scenarioOutline(`Weather test
    Examples:
    | temp | condition |
    |   30 | hot       |
`, () => {
  given("the temperature is <temp> degrees", async (ctx) => {
    const temp = ctx.example.temp;  // 30 (from example row)
    // ctx.example ONLY available in scenario outlines!
  });
});

// 3. Named parameters - proposed new syntax!
given("the temperature is <temp:30> degrees", async (ctx) => {
  const temp = ctx.params.temp;  // 30 (parsed from <name:value>)
  // Clearer than ctx.step.values[0]!
  // ctx.params ONLY available when <name:value> used
});

// 4. Multiple named parameters
given("order from <country:Australia> totaling <amount:100>", async (ctx) => {
  const country = ctx.params.country;  // "Australia"
  const amount = ctx.params.amount;    // 100 (coerced to number)
});
```

**When Each Context Property is Available:**

| Property | Available When | Purpose |
|----------|---------------|---------||
|  `ctx.feature`   |              Always              |   Feature metadata (title, filename, tags)   |
| `ctx.scenario`   | Always                           | Scenario metadata (title, tags)              |
| `ctx.step`       | Always                           | Step metadata + parsed values/tables         |
| `ctx.background` | **All steps (after background)** | Background step metadata (given, and arrays) |
| `ctx.example`    | **Scenario outlines only**       | Current example row data                     |
| `ctx.params`     | **When `<name:value>` used**     | Named inline parameters (proposed)           |

**Benefits:**
- **Same mental model** - Local variables for data, contexts for metadata
- **Consistent API** - One `ctx` parameter instead of multiple globals
- **Full TypeScript** - Types inferred from context interface
- **Better isolation** - Vitest fixtures ensure clean state

**What Changed:**
- Instead of globals (`stepContext`, `scenarioOutlineContext`), receive `ctx` parameter
- `ctx.step` - Step metadata (was `stepContext`)
- `ctx.example` - Example data (was `scenarioOutlineContext.example`)
- `ctx.feature` - Feature metadata (was `featureContext` - but only for reading metadata)
- `ctx.scenario` - Scenario metadata (was `scenarioContext` - but only for reading metadata)

**Migration Notes:**
- Add `(ctx)` or `async (ctx)` parameter to all step definitions  
- Replace `stepContext.x` with `ctx.step.x`
- Replace `scenarioOutlineContext.example.x` with `ctx.example.x`
- Replace `backgroundContext.x` with `ctx.background.x`
- **Keep using local variables** for test data (don't change to contexts!)

### 2. Background Execution

**Mocha (v0.4.x):**
```typescript
// Background at FEATURE level (same level as scenarios)
feature("User Management", () => {
  let db;
  
  background("Setup", () => {
    // afterBackground is NESTED INSIDE background!
    afterBackground(() => {
      db.close();
    });
    
    given("a database connection", () => {
      db = connectDB();
    });
    
    and("test data loaded", () => {
      db.loadFixtures();
    });
  });
  
  scenario("Create user", () => {
    // Background runs before this
    when("creating a user", () => {
      // db is available from background
    });
  });
});
```

**Vitest (v1.0.x):**
```typescript
// SAME STRUCTURE - preserve nesting and placement!
feature("User Management", () => {
  let db;
  
  background("Setup", () => {
    // afterBackground NESTED INSIDE (same as original)
    afterBackground(async () => {
      await db.close();
    });
    
    given("a database connection", async (ctx) => {
      db = await connectDB();
    });
    
    and("test data loaded", async (ctx) => {
      await db.loadFixtures();
    });
  });
  
  scenario("Create user", () => {
    when("creating a user", async (ctx) => {
      // db available from closure
    });
  });
});
```

**Key Points:**
- **Background at feature level** - Same indent as scenarios (not nested in them)
- **afterBackground nested INSIDE background** - Not a sibling
- **Uses local variables** - Not contexts (db is `let db`, not `ctx.feature.db`)
- **Gherkin alignment** - Clearer than generic `afterEach`

**Migration Notes:**
- Keep same structure - background and scenarios as siblings
- `afterBackground` stays nested inside `background`
- Tests use local variables (closures) for shared data

### 3. Scenario Outline Examples

**Mocha (v0.4.x):**
```typescript
// Data table is IN THE TITLE STRING
scenarioOutline(`Add numbers
    
    Examples:
    | num1 | num2 | result |
    |    5 |    3 |      8 |
    |   10 |    2 |     12 |
`, () => {
  let total = 0;
  
  given("I have <num1>", () => {
    total = scenarioOutlineContext.example.num1;
  });
  
  when("I add <num2>", () => {
    total += scenarioOutlineContext.example.num2;
  });
  
  then("the result is <result>", () => {
    expect(total).to.equal(scenarioOutlineContext.example.result);
  });
});
```

**Vitest (v1.0.x):**
```typescript
// SAME PATTERN - data table in title string!
scenarioOutline(`Add numbers
    
    Examples:
    | num1 | num2 | result |
    |    5 |    3 |      8 |
    |   10 |    2 |     12 |
`, () => {
  let total = 0;
  
  given("I have <num1>", async (ctx) => {
    total = ctx.example.num1;
  });
  
  when("I add <num2>", async (ctx) => {
    total += ctx.example.num2;
  });
  
  then("the result is <result>", async (ctx) => {
    expect(total).to.equal(ctx.example.result);
  });
});
```

**Key Points:**
- **NO `examples()` method** - Data table is parsed from the title string
- **Exact same syntax** as original - just change context access
- **Parser handles it** - Framework extracts examples from title
- **Multiple tables supported** - Can have multiple "Examples:" sections

**Migration Notes:**
- Keep data tables in title string (no API change!)
- Only change: `scenarioOutlineContext.example.x` → `ctx.example.x`
- Tests use **local variables** (like `total` above), not contexts

### 4. Passed Parameters (Dynamic Runtime Values)

**Mocha (v0.4.x):**
```typescript
// For runtime values that can't be hardcoded
let orderId;

given("order {{orderId}} is created", function() {
  orderId = generateUniqueId();  // Runtime value
  // this.passedParam not used in implementation, only for display
}, () => ({ orderId }));  // Function evaluated at runtime

// Or with static object
const config = { apiKey: "ABC123", timeout: 5000 };
when("calling API with key {{apiKey}} and timeout {{timeout}}", function() {
  // Step title displays actual values for better readability
}, config);
```

**Vitest (v1.0.x):**
```typescript
// Same pattern - for runtime dynamic values
let orderId;

given("order {{orderId}} is created", async (ctx) => {
  orderId = generateUniqueId();
  // ctx.step.displayTitle shows interpolated value
}, () => ({ orderId }));

// Or with static object
const config = { apiKey: "ABC123", timeout: 5000 };
when("calling API with key {{apiKey}} and timeout {{timeout}}", async (ctx) => {
  // Better step output readability
}, config);
```

**Use Cases:**
- **Generated IDs** - Database IDs, GUIDs, transaction IDs
- **Timestamps** - Current date/time that changes per run
- **Environment values** - API keys, URLs from config
- **Computed values** - Values calculated during test execution

**Key Difference from `<placeholder>`:**
- `<placeholder>` - Static values in scenario outlines (from example table)
- `{{placeholder}}` - Dynamic values bound at runtime via `passedParam`
- Used for **display purposes** in step titles/docStrings, not for logic

**Benefits:**
- Better test output readability
- See actual values in step descriptions
- Useful for debugging - know what IDs/values were used
- No change from Mocha - same 3rd parameter pattern

### 5. Test Configuration

**Mocha (v0.4.x):**
```typescript
// In test file before imports
(global as any).livedoc = new LiveDoc();
(global as any).livedoc.options.filters.include = ["@smoke"];
(global as any).livedoc.options.rules.enforceTitle = LiveDocRuleOption.warning;

// Or via mocha.opts file
```

**Vitest (v1.0.x):**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { liveDocPlugin } from 'livedoc-vitest';

export default defineConfig({
  plugins: [
    liveDocPlugin({
      filters: {
        include: ["@smoke"],
        exclude: ["@wip"]
      },
      rules: {
        enforceTitle: "warning"
      },
      reporters: {
        spec: true,
        summary: true
      },
      postReporters: [
        JsonReporter
      ]
    })
  ]
});
```

**Benefits:**
- Configuration in standard Vitest config file
- Type-safe configuration
- Better IDE support
- No global mutations

### 6. Reporter API

**Mocha (v0.4.x):**
```typescript
import { LiveDocReporter } from 'livedoc-mocha';

export class CustomReporter extends LiveDocReporter {
  constructor(runner, mochaOptions) {
    super(runner, mochaOptions);
  }
  
  protected featureStart(feature: Feature): void {
    // Handle feature start
  }
}
```

**Vitest (v1.0.x):**
```typescript
import type { LiveDocReporter, LiveDocReporterHooks } from 'livedoc-vitest';

export class CustomReporter implements LiveDocReporter {
  onInit(ctx: Vitest) {
    // Setup
  }
  
  onFeatureStart(feature: Feature): void {
    // Handle feature start
  }
  
  onFeatureEnd(feature: Feature): void {
    // Handle feature end
  }
  
  async onFinished(results: ExecutionResults): Promise<void> {
    // Generate final report
  }
}
```

**Benefits:**
- Simpler interface (no inheritance required)
- Async support throughout
- Cleaner lifecycle hooks
- Better TypeScript types

### 7. Post-Reporters

**Mocha (v0.4.x):**
```typescript
// Command line
--ld-reporters ./my-reporter.js

// Or programmatically
mocha.options.livedoc.postReporters.push(require("./my-reporter"));

// Post-reporter interface
export class MyReporter implements IPostReporter {
  execute(results: ExecutionResults, options: any): void | Promise<void> {
    // Generate report
  }
}
```

**Vitest (v1.0.x):**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { liveDocPlugin } from 'livedoc-vitest';
import { MyReporter } from './my-reporter';

export default defineConfig({
  plugins: [
    liveDocPlugin({
      postReporters: [
        MyReporter,
        { 
          reporter: AnotherReporter, 
          options: { outputPath: './reports' }
        }
      ]
    })
  ]
});

// Post-reporter interface (unchanged)
export class MyReporter implements IPostReporter {
  async execute(results: ExecutionResults, options: any): Promise<void> {
    // Generate report
  }
}
```

**Benefits:**
- Type-safe configuration
- No command line parsing needed
- Support for reporter-specific options
- Better IDE autocomplete

### 8. Rule Violations

**No Breaking Changes**

The rule violation system remains unchanged:
- `enforceTitle`, `mustIncludeGiven`, `mustIncludeWhen`, etc.
- Rule options: `enabled`, `warning`, `disabled`
- API is identical

### 9. Test Execution API

**Mocha (v0.4.x):**
```typescript
// Programmatic execution not well-supported
// Users typically used mocha CLI
```

**Vitest (v1.0.x):**
```typescript
import { startVitest } from 'vitest/node';
import { liveDocPlugin } from 'livedoc-vitest';

async function runTests() {
  const vitest = await startVitest('test', ['**/*.Spec.ts'], {
    config: {
      plugins: [liveDocPlugin(/* options */)],
      test: {
        reporters: ['livedoc-spec']
      }
    }
  });
  
  return vitest.results;
}
```

**Benefits:**
- First-class programmatic API
- Easy integration in build tools
- Better for testing the framework itself

## Non-Breaking Changes (Enhancements)

### 1. Async/Await Support

**Mocha:** Limited async support, some scenarios required done callbacks

**Vitest:** Full native async/await everywhere
```typescript
given("an async operation", async ({ feature }) => {
  const result = await fetchData();
  return { data: result };
});
```

### 2. ESM Support

**Mocha:** Required transpilation, CommonJS-first

**Vitest:** Native ESM, no transpilation needed
```typescript
// Can use top-level await, ESM imports, etc.
```

### 3. TypeScript Support

**Mocha:** Required `@types/mocha` and separate compilation

**Vitest:** Built-in TypeScript support, no separate types needed

### 4. Watch Mode

**Mocha:** Limited watch support

**Vitest:** Advanced watch mode with HMR
```bash
vitest --watch
# Re-runs only changed tests with smart re-run
```

## Migration Checklist

For migrating from livedoc-mocha to livedoc-vitest:

- [ ] Update package.json dependencies
- [ ] Create vitest.config.ts with liveDocPlugin
- [ ] Replace global context access with fixture parameters
- [ ] Update step definitions to return data instead of mutating globals
- [ ] Replace `afterBackground` with standard `afterEach`
- [ ] Update scenario outline examples API
- [ ] Update custom reporters to new interface
- [ ] Move post-reporters to config file
- [ ] Update test execution scripts
- [ ] Run tests and fix any remaining issues

## Documentation Updates Required

- [ ] Update main README with new API
- [ ] Create migration guide
- [ ] Update tutorial with new patterns
- [ ] Update API reference
- [ ] Add TypeScript examples
- [ ] Document fixture patterns
- [ ] Add troubleshooting guide
