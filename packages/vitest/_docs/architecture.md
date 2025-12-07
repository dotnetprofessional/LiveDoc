# LiveDoc-Vitest Architecture

## Overview

This document outlines the architectural decisions for migrating LiveDoc from Mocha to Vitest. The migration maintains the core Gherkin BDD functionality while modernizing the implementation to leverage Vitest's capabilities and modern JavaScript patterns.

## Core Principles

1. **Immutable Context Management** - Replace mutable global contexts with immutable, type-safe patterns
2. **Modern TypeScript** - Leverage TypeScript 5.x features for better type safety
3. **Vitest-Native Integration** - Use Vitest's APIs rather than fighting against them
4. **Clean State Isolation** - Ensure scenarios cannot leak state between each other

## Architecture Components

### 1. Test Framework Integration

**Mocha Approach (Legacy):**
- Custom UI interface registered via `mocha.interfaces['livedoc-mocha']`
- Deep hooks into Mocha's internal suite/test creation
- Global context objects mutated throughout execution
- Background steps executed via suite.parent manipulation

**Vitest Approach (Modernized):**
- Leverage Vitest's extensible test context via `test.extend()`
- Use Vitest's task metadata for tracking suite relationships
- Implement context as immutable fixtures that cascade properly
- Background execution via `beforeEach` with proper fixture initialization

**Rationale:** Vitest's fixture system provides first-class support for context propagation with automatic cleanup and TypeScript inference. This eliminates the fragile global state management that caused bugs in the Mocha version.

### 2. Context Management System

**Critical Design Decision: Simple, Consistent Context Object (Like Original)**

After reviewing the original Mocha implementation and user feedback, the best approach is to **keep the simplicity of the original design** while using Vitest fixtures for proper lifecycle management.

**Original Mocha Pattern (Preserve This UX):**
```typescript
// Globals: featureContext, scenarioContext, stepContext always available
given("a user exists", () => {
  featureContext.user = createUser();  // User stores data
  stepContext.title;  // Step metadata available
});

when("they login", () => {
  scenarioContext.result = login(featureContext.user);
});
```

**Vitest Implementation (Same UX, Better Internals):**
```typescript
// Single consistent context object passed to all steps
interface LiveDocContext {
  feature: FeatureContext;   // User's shared feature data
  scenario: ScenarioContext; // User's scenario data
  step: StepContext;         // Current step metadata (title, table, docString)
  background?: BackgroundContext; // Background step metadata
  example?: ExampleContext;  // Scenario outline example data
}

// Usage - exactly like original, just one parameter
given("a user exists", async (ctx) => {
  ctx.feature.title;   // Feature metadata (read-only)
  ctx.step.title;      // "a user exists"
  ctx.step.table;      // Data tables
});

when("they login", async (ctx) => {
  // Use local variables for test data
  const result = await login(user);
});

then("they see dashboard", async (ctx) => {
  expect(result.url).to.equal("/dashboard");
});

// Scenario outlines - ctx.example ONLY available here
scenarioOutline(`Add numbers
    Examples:
    | num1 | num2 |
    |    5 |    3 |
`, () => {
  given("I have <num1>", async (ctx) => {
    const num = ctx.example.num1;  // Only in scenario outlines!
  });
});

// Named parameters (proposed) - ctx.params available when <name:value> used
given("the temperature is <temp:30> degrees", async (ctx) => {
  const temp = ctx.params.temp;  // Clearer than indexed access
});
```

**Context Structure:**
- `ctx.feature` - Framework metadata (filename, title, description, tags) - **Always available, READ-ONLY**
- `ctx.scenario` - Framework metadata (title, description, tags) - **Always available, READ-ONLY**
- `ctx.step` - Step metadata (title, values, table, docString) - **Always available, READ-ONLY**
- `ctx.background` - Background step metadata - **Available in all steps (after background runs), READ-ONLY**
- `ctx.example` - Example data - **Only available in scenario outline steps, READ-ONLY**
- `ctx.params` - Named parameters - **Only when step has `<name:value>` syntax, READ-ONLY (proposed)**

**Key Insight:** The original globals were actually **good UX**. Users didn't have to think about which context to import or which fixture to use - everything was available. We preserve this simplicity while using Vitest fixtures internally for proper cleanup.

**Benefits:**
- **Consistent API** - One parameter, always the same structure
- **No confusion** - Don't need to destructure different properties
- **Familiar** - Matches original Mocha design
- **Type-safe** - Full TypeScript support via single interface
- **Properly managed** - Vitest fixtures handle lifecycle/cleanup
- **Isolated** - Each scenario gets fresh contexts (no state leakage)

**Implementation Pattern:**
```typescript
// Vitest fixture provides the context
const test = base.extend<{ liveDocContext: LiveDocContext }>({
  liveDocContext: async ({}, use) => {
    const ctx: LiveDocContext = {
      feature: new FeatureContext(),
      scenario: new ScenarioContext(),
      step: new StepContext(),
    };
    await use(ctx);
    // Automatic cleanup
  }
});
```

**Alternative Considered & Rejected:**
- **Multiple fixture properties** `({ feature, scenario, step })` - Too confusing, inconsistent between step types
- **Immutable user contexts** - Original allowed mutation, users expect this
- **Global contexts** - Considered but Vitest fixtures provide better cleanup and isolation

### 3. Context Structure Deep Dive

**Critical Understanding: Contexts Are for Metadata, Not User Data**

After analyzing the original implementation, the key insight is:

**Contexts provide FRAMEWORK METADATA. User data lives in LOCAL VARIABLES.**

```typescript
// What contexts ACTUALLY contain in original Mocha
class FeatureContext {
  filename: string;      // Feature file path
  title: string;         // Feature title
  description: string;   // Feature description
  tags: string[];        // Feature tags
  // NO user data! This is read-only metadata
}

class ScenarioContext {
  title: string;         // Scenario title  
  description: string;   // Scenario description
  given: StepContext;    // Reference to last given step
  and: StepContext[];    // Reference to and steps
  tags: string[];        // Scenario tags
  // NO user data! This is read-only metadata
}

class StepContext {
  title: string;              // "a user exists"
  displayTitle: string;       // With interpolated values
  type: string;               // "given", "when", "then"
  dataTable: DataTableRow[];  // Raw table data
  docString: string;          // Doc string content
  table: DataTable;           // Parsed table
  tableAsEntity: any;         // Table as object
  tableAsSingleList: any[];   // Table as array
  docStringAsEntity: any;     // Parsed JSON doc string
  values: any[];              // Extracted quoted values
  valuesRaw: string[];        // Raw quoted values
  // Framework-provided parsing helpers
}
```

**How Tests Actually Work (Original Pattern):**

```typescript
feature("Shopping Cart", () => {
  // USER DATA in local variables (closure scope)
  const cart = new ShoppingCart();
  let total = 0;
  
  background("Setup", () => {
    given("a cart exists", () => {
      // stepContext provides metadata about THIS step
      console.log(stepContext.title);  // "a cart exists"
      
      // User stores data in local variables
      cart.reset();
    });
  });
  
  scenario("Add items", () => {
    given("a product costs '10'", () => {
      // stepContext.values has parsed quoted values
      const price = stepContext.values[0];  // 10
      cart.addItem("tea", price);
    });
    
    when("adding '5' items", () => {
      const qty = stepContext.values[0];  // 5
      cart.quantity = qty;
    });
    
    then("total is '50'", () => {
      const expected = stepContext.values[0];  // 50
      expect(cart.total).to.equal(expected);
    });
  });
  
  scenarioOutline(`Calculate shipping
      
      Examples:
      |  country  | total | shipping |
      | Australia |   100 |        0 |
      | USA       |   100 |       15 |
  `, () => {
    given("customer is from <country>", () => {
      // scenarioOutlineContext.example has current example row
      cart.country = scenarioOutlineContext.example.country;
    });
    
    when("order total is <total>", () => {
      cart.total = scenarioOutlineContext.example.total;
      cart.calculateShipping();
    });
    
    then("shipping is <shipping>", () => {
      expect(cart.shipping).to.equal(
        scenarioOutlineContext.example.shipping
      );
    });
  });
});
```

**Vitest Implementation (Preserve This Pattern!):**

```typescript
interface LiveDocContext {
  feature: FeatureContext;    // Read-only metadata
  scenario: ScenarioContext;  // Read-only metadata
  step: StepContext;         // Current step metadata + helpers
  background?: StepContext;  // Background step metadata
  example?: ExampleRow;      // Current example in outline
}

// Usage - same pattern!
feature("Shopping Cart", () => {
  // USER DATA in local variables (same as original!)
  const cart = new ShoppingCart();
  let total = 0;
  
  background("Setup", () => {
    given("a cart exists", async (ctx) => {
      // ctx.step provides metadata
      console.log(ctx.step.title);  // "a cart exists"
      
      // Store data in local variables
      cart.reset();
    });
  });
  
  scenario("Add items", () => {
    given("a product costs '10'", async (ctx) => {
      const price = ctx.step.values[0];  // 10
      cart.addItem("tea", price);
    });
    
    when("adding '5' items", async (ctx) => {
      const qty = ctx.step.values[0];  // 5
      cart.quantity = qty;
    });
    
    then("total is '50'", async (ctx) => {
      const expected = ctx.step.values[0];  // 50
      expect(cart.total).to.equal(expected);
    });
  });
  
  // Data table IN TITLE (not a method!)
  scenarioOutline(`Calculate shipping
      
      Examples:
      |  country  | total | shipping |
      | Australia |   100 |        0 |
      | USA       |   100 |       15 |
  `, () => {
    given("customer is from <country>", async (ctx) => {
      cart.country = ctx.example.country;
    });
    
    when("order total is <total>", async (ctx) => {
      cart.total = ctx.example.total;
      cart.calculateShipping();
    });
    
    then("shipping is <shipping>", async (ctx) => {
      expect(cart.shipping).to.equal(ctx.example.shipping);
    });
  });
});
```

**Key Takeaways:**

1. **ctx.feature** - Framework metadata about feature (filename, title, tags) - READ ONLY
2. **ctx.scenario** - Framework metadata about scenario (title, tags) - READ ONLY  
3. **ctx.step** - Current step metadata + parsing helpers (values, tables, docString) - READ ONLY
4. **ctx.background** - Background step metadata - **Available in all steps after background executes**, READ ONLY
5. **ctx.example** - Current example row data in scenario outlines - **Only in outlines**, READ ONLY
6. **ctx.params** - Named parameters from `<name:value>` syntax - **When defined**, READ ONLY (proposed)
7. **Local variables** - Where ALL user test data lives (cart, total, etc.)

**Why Local Variables?**
- JavaScript closures naturally share state across scenarios
- Simpler than managing context lifecycle
- More intuitive - reads like regular code
- Original design - if it ain't broke, don't fix it!

### Parameter Access Patterns

**Understanding When to Use `ctx.step.values` vs `ctx.example` vs `ctx.params`**

The original Mocha implementation can be confusing because the same `<placeholder>` syntax means different things in different contexts:

**Current Pattern (Original):**
```typescript
// 1. Regular steps - quoted values accessed by index
given("the temperature is '30' degrees", async (ctx) => {
  const temp = ctx.step.values[0];  // 30 (parsed from quotes)
});

// 2. Scenario outline steps - angle brackets bind to example row
scenarioOutline(`Weather checks
    Examples:
    | temp | condition |
    |   30 | hot       |
`, () => {
  given("the temperature is <temp> degrees", async (ctx) => {
    const temp = ctx.example.temp;  // 30 (from example row)
    // NOT ctx.step.values - that would be empty!
  });
});
```

**Problem:** It's not obvious when to use `ctx.step.values[0]` vs `ctx.example.temp`. The syntax looks similar but access is completely different.

**Proposed Enhancement - Unified Named Parameters:**

```typescript
// 1. Quoted values - indexed access (existing)
given("the temperature is '30' degrees", async (ctx) => {
  const temp = ctx.step.values[0];  // 30 (backward compatible)
});

// 2. Scenario outline - example data (existing)
scenarioOutline(`Weather checks
    Examples:
    | temp | condition |
    |   30 | hot       |
`, () => {
  given("the temperature is <temp> degrees", async (ctx) => {
    const temp = ctx.example.temp;  // 30 (from example row)
  });
});

// 3. Named inline parameters - NEW SYNTAX!
given("the temperature is <temp:30> degrees", async (ctx) => {
  const temp = ctx.params.temp;  // 30 (parsed from <name:value>)
  // Clearer than indexed access!
});

// 4. Multiple named parameters - NEW!
given("order from <country:Australia> totaling <amount:100>", async (ctx) => {
  const country = ctx.params.country;  // "Australia"
  const amount = ctx.params.amount;    // 100 (coerced to number)
  // Much clearer than ctx.step.values[0], ctx.step.values[1]
});

// 5. Mix quoted and named - NEW!
given("add '5' items at <price:10> each", async (ctx) => {
  const quantity = ctx.step.values[0];  // 5 (quoted)
  const price = ctx.params.price;       // 10 (named)
  // Clear distinction between syntaxes!
});

// 6. Dynamic runtime values - EXISTING!
let orderId;
given("order {{orderId}} is created", async (ctx) => {
  orderId = generateId();  // Runtime value
  // Step title displays with actual ID value
}, () => ({ orderId }));  // Passed as 3rd parameter

// Or with object directly
const order = { id: "ABC123" };
given("order {{id}} is processed", async (ctx) => {
  // ctx.step.displayTitle shows "order ABC123 is processed"
}, order);  // Binds object properties to {{placeholder}}
```

**Benefits of Named Parameters:**

1. **Self-documenting** - `ctx.params.temp` vs `ctx.step.values[0]`
2. **No index tracking** - Don't need to count quoted values
3. **Consistent with outlines** - `<temp>` syntax works everywhere
4. **Clearer intent** - When you see `<name:value>`, you know it's not an outline placeholder
5. **Better TypeScript** - Can type `ctx.params` as `Record<string, any>`
6. **Complements passedParam** - Static values via `<name:value>`, dynamic via `passedParam`

**When to Use Each:**

|      Syntax       |             Access             |                       Use Case                       |
| --------          | --------                       | ----------                                           |
| `'value'`         | `ctx.step.values[0]`           | Simple values, backward compatible                   |
| `<placeholder>`   | `ctx.example.placeholder`      | **Only in scenario outlines** - binds to example row |
| `<name:value>`    | `ctx.params.name`              | Named parameters anywhere (proposed)                 |
| `{{placeholder}}` | Via `passedParam` 3rd argument | Runtime dynamic values (IDs, timestamps, etc.)       |

**Migration Path:**

- **Phase 1** (Initial Vitest release): Support existing patterns
- **Phase 2** (Future enhancement): Add `<name:value>` syntax
- **Backward compatible**: Existing tests don't break
- **Opt-in**: New syntax optional, old syntax still works

**Implementation Notes:**

Parser would need to:
1. Detect `<name:value>` pattern in step titles
2. Extract name-value pairs
3. Coerce values (same as quoted values)
4. Populate `ctx.params` object
5. Leave `<placeholder>` (no colon) for outline binding

```typescript
// Parser enhancement
function parseNamedParams(title: string): Record<string, any> {
  const namedParamRegex = /<([a-zA-Z][a-zA-Z0-9_]*):(.*?)>/g;
  const params: Record<string, any> = {};
  let match;
  
  while ((match = namedParamRegex.exec(title)) !== null) {
    const name = match[1];
    const value = match[2];
    params[name] = coerceValue(value);  // Use existing coercion
  }
  
  return params;
}
```

### 4. Gherkin Grammar Parser

**Status: Framework-Agnostic - Port Directly**

The parser layer (`LiveDocGrammarParser`) is independent of Mocha:
- `createFeature()`, `addScenario()`, `addScenarioOutline()`, `createStep()`
- Handles tag parsing, scenario outline expansion, data table processing
- Contains validation logic and rule violation checking

**Changes Needed:**
- Update imports to reference new Vitest models
- Modernize string processing (remove polyfills for startsWith/endsWith)
- Keep validation logic intact

### 5. Model Layer

**Status: Mostly Framework-Agnostic - Port with Modernization**

Core models can be ported:
- `Feature`, `Scenario`, `ScenarioOutline`, `ScenarioExample`
- `StepDefinition`, `Background`
- `ExecutionResults`, `FeatureContext`, `ScenarioContext`, `StepContext`
- `RuleViolations`, `LiveDocRuleViolation`

**Modernizations:**
- Replace `@jsonIgnore` decorator with TypeScript's `Omit<>` utility types or JSON.stringify replacer
- Update `MochaTest` → `VitestTest` 
- Simplify context models (remove circular reference patterns)
- Add proper TypeScript discriminated unions for test types

### 5. Dynamic Test Generation

**Challenge: Scenario Outlines Create N Tests Dynamically**

**Mocha Approach:**
- Scenario outline title contains Examples data table
- Parser extracts examples from title string during suite definition
- Each example becomes a separate test execution
- **No `examples()` method** - it's all in the title!

**Original Pattern:**
```typescript
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
  
  then("result is <result>", () => {
    expect(total).to.equal(scenarioOutlineContext.example.result);
  });
});
```

**Vitest Approach (Preserve Exact Pattern):**
```typescript
// Data table in title - NO METHOD CHAINING!
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
  
  then("result is <result>", async (ctx) => {
    expect(total).to.equal(ctx.example.result);
  });
});
```

**Internal Implementation:**
```typescript
function scenarioOutline(titleWithExamples: string, fn: () => void) {
  // 1. Parse title to extract examples table
  const { title, examples } = parseScenarioOutlineTitle(titleWithExamples);
  
  // 2. Collect step definitions by executing fn
  const stepDefinitions = [];
  const originalGiven = global.given;
  global.given = (title, impl) => stepDefinitions.push({ type: 'given', title, impl });
  fn(); // Execute to collect steps
  global.given = originalGiven; // Restore
  
  // 3. Generate Vitest test for each example
  for (const [index, example] of examples.entries()) {
    test(`${title} - Example ${index + 1}`, async () => {
      const ctx = createContext({ example });
      
      // Execute each step with example-bound context
      for (const step of stepDefinitions) {
        const resolvedTitle = interpolate(step.title, example);
        ctx.step = createStepContext(resolvedTitle, step.type);
        await step.impl(ctx);
      }
    });
  }
}

// Parser extracts examples from title
function parseScenarioOutlineTitle(fullTitle: string) {
  const examplesMatch = fullTitle.match(/Examples:\s*\n([\s\S]*?)(?:\n\s*$|$)/);
  const title = fullTitle.split(/Examples:/)[0].trim();
  const examples = examplesMatch ? parseDataTable(examplesMatch[1]) : [];
  return { title, examples };
}
```

**Key Points:**
- **Examples in title** - Parser extracts from string, not method call
- **Multiple tables supported** - Can have multiple "Examples:" sections
- **Dynamic test generation** - Vitest tests created at module evaluation
- **Preserve syntax** - Zero API changes from original
- **Uses local variables** - Data stored in closure (like `total`)

**Decision: No `examples()` method - parse from title string**
- Maintains original DSL
- No breaking changes
- Parser handles extraction
- Multiple example tables work naturally

### 6. Background Execution Model

**Mocha Approach:**
- Background steps stored in feature
- Executed via `beforeEach` before each scenario
- `afterBackground()` **nested INSIDE background** - not a sibling!
- Background and scenarios are **siblings** (same indent level)

**Design Decision: Preserve Gherkin-Aligned API and Structure**

The original Mocha design intentionally:
1. Used `afterBackground()` instead of `afterEach()` for Gherkin alignment
2. Nested `afterBackground` **inside** `background` block
3. Placed `background` at feature level (sibling to scenarios)

**Original Pattern:**
```typescript
feature("Shopping", () => {
  let cart;
  
  // Background at FEATURE level (sibling to scenarios)
  background("Setup cart", () => {
    // afterBackground NESTED INSIDE!
    afterBackground(() => {
      cart.clear();
    });
    
    given("a shopping cart", () => {
      cart = new ShoppingCart();
    });
    
    and("test products loaded", () => {
      cart.loadTestData();
    });
  });
  
  // Scenario is sibling to background
  scenario("Add items", () => {
    when("adding items", () => {
      cart.addItem("tea");
    });
  });
});
```

**Vitest Approach (Preserve Structure!):**
```typescript
feature("Shopping", () => {
  let cart;
  
  // Background at FEATURE level (same as original)
  background("Setup cart", () => {
    // afterBackground NESTED INSIDE (same as original)
    afterBackground(async () => {
      await cart.clear();
    });
    
    given("a shopping cart", async (ctx) => {
      cart = new ShoppingCart();
    });
    
    and("test products loaded", async (ctx) => {
      await cart.loadTestData();
    });
  });
  
  // Scenario is sibling to background
  scenario("Add items", () => {
    when("adding items", async (ctx) => {
      cart.addItem("tea");
    });
  });
});
```

**Implementation:**
```typescript
let afterBackgroundCallback: Function | null = null;

// Background at feature level
function background(title: string, fn: () => void) {
  // Store background steps at feature level
  currentFeature.background = { title, steps: [] };
  
  // Temporarily override afterBackground to capture callback
  global.afterBackground = (callback: Function) => {
    afterBackgroundCallback = callback;
  };
  
  // Execute fn to collect steps and afterBackground
  fn();
  
  // Setup Vitest hooks
  beforeEach(async () => {
    const ctx = getCurrentContext();
    await executeBackgroundSteps(currentFeature.background, ctx);
  });
  
  if (afterBackgroundCallback) {
    afterEach(async () => {
      const ctx = getCurrentContext();
      await afterBackgroundCallback(ctx);
    });
  }
  
  // Reset
  global.afterBackground = () => {};
  afterBackgroundCallback = null;
}

// afterBackground available inside background
function afterBackground(fn: () => void | Promise<void>) {
  // Captured by background function above
  // This is a "magic" function that only works inside background block
}
```

**Key Points:**
- **Background at feature level** - Same indent as scenarios (siblings)
- **afterBackground nested inside** - Called within background block
- **Gherkin alignment** - Keywords match BDD language
- **Clearer intent** - Better than generic `afterEach`
- **Original structure preserved** - Maintains good UX decision
- **Uses local variables** - Not contexts (e.g., `let cart`)
- **Vitest-powered internally** - Maps to `beforeEach`/`afterEach`

**Note:** Standard `beforeEach`/`afterEach` also available if needed for non-background setup.

### 7. Filtering System

**Mocha Approach:**
- Custom command line args `--ld-include`, `--ld-exclude`
- Sets `mocha.options.hasOnly = true`
- Manually manipulates `_onlySuites` array

**Vitest Approach:**
- Leverage Vitest's native `--grep` for simple cases
- For complex tag filtering, use Vitest's suite filtering API:

```typescript
// During test registration
if (shouldInclude(tags, options.filters)) {
  test.only(...); // Mark as only
}

// Or implement custom filter via Vitest plugin
export default defineConfig({
  test: {
    include: ['**/*.Spec.ts'],
    testNamePattern: livedocFilterPattern(options.filters)
  }
});
```

### 9. Reporter System

**Mocha Approach:**
- Extends `mocha.reporters.Base`
- Hooks into runner events: `suite`, `suite end`, `test`, `test end`, `pass`, `fail`, `pending`, `end`
- Manually builds `ExecutionResults` from suite tree

**Vitest Approach:**
```typescript
import type { Reporter } from 'vitest';

export class LiveDocVitestReporter implements Reporter {
  onInit(ctx: Vitest) {
    // Setup
  }
  
  onTaskUpdate(tasks: Task[]) {
    // Real-time updates as tests run
  }
  
  onFinished(files: File[], errors: unknown[]) {
    // Build ExecutionResults from Vitest's task tree
    const results = buildExecutionResults(files);
    
    // Execute post reporters
    await executePostReporters(results, options.postReporters);
  }
}
```

**Key Differences:**
- Vitest provides cleaner task tree (`File` → `Suite` → `Test`)
- Built-in support for async reporters
- Better error handling and stack trace processing
- No need for `livedocComplete` flag hacks

**ExecutionResults Model:**
- Keep largely unchanged for backward compatibility with post-reporters
- Map Vitest's `Task` metadata to LiveDoc's model
- Source map resolution handled similarly

## Migration Strategy

### Phase 1: Core Infrastructure (Step 2)
1. Create package scaffold
2. Port parser (framework-agnostic)
3. Port models with modernization
4. Setup TypeScript 5.x + Vitest

### Phase 2: Test API (Step 3)
1. Implement fixture-based context system
2. Create global keyword registration (`feature`, `scenario`, etc.)
3. Implement scenario outline expansion
4. Add background execution
5. Implement filtering

### Phase 3: Reporter (Step 4)
1. Implement `LiveDocVitestReporter` base class
2. Port `LiveDocSpec` reporter
3. Create post-reporter hook system
4. Update `LiveDocOptions` for Vitest config

### Phase 4: Validation (Step 5)
1. Port test suite
2. Fix tests incrementally
3. Validate all Gherkin features work

## Testing During Migration

**Validation Strategy:**
- Each feature validated immediately after implementation
- Self-hosting: livedoc-vitest tests use livedoc-vitest
- Incremental test porting ensures progress visibility

**Test Execution Pattern:**
```typescript
// Test helper
async function executeLiveDocTest(testFile: string, options?: LiveDocOptions) {
  const vitest = await startVitest('test', [testFile], {
    config: {
      test: {
        reporters: ['livedoc-vitest']
      }
    }
  });
  
  return vitest.results;
}
```

## Risk Mitigation

### High Risk Areas

1. **Context state management** - Mitigated via fixtures + immutability
2. **Scenario outline expansion** - Prototype early in Step 3
3. **Background execution** - Validate with dedicated tests
4. **Parallel execution** - Vitest runs parallel by default, fixtures ensure isolation

### Validation Checklist

- [ ] Can create features, scenarios, steps
- [ ] Context accessible in step definitions
- [ ] Background executes before each scenario
- [ ] Scenario outlines expand correctly
- [ ] Tag filtering works
- [ ] Reporters receive correct data
- [ ] Post-reporters execute
- [ ] No state leakage between scenarios
- [ ] Parallel execution works
- [ ] All 24 original tests pass

## Future Enhancements

Post-migration opportunities:
- Vitest UI mode integration
- Better async/await support
- Native ESM (no transpilation)
- Watch mode improvements
- Improved error messages
- TypeScript performance improvements
