# LiveDoc Migration Guide: Mocha to Vitest

## Overview

This guide helps you migrate from `livedoc-mocha` to `livedoc-vitest`. The core BDD functionality remains the same, but there are some important breaking changes to be aware of.

## Breaking Changes

### 1. Step Function Names are Capitalized

**Before (Mocha):**
```typescript
given("I have a value", () => { });
when("I perform an action", () => { });
then("I should see a result", () => { });
and("additional context", () => { });
but("exception case", () => { });
```

**After (Vitest):**
```typescript
Given("I have a value", () => { });
When("I perform an action", () => { });
Then("I should see a result", () => { });
And("additional context", () => { });
But("exception case", () => { });
```

**Reason:** JavaScript's Promise mechanism checks for `.then()` methods, which caused module loading issues with lowercase `then` exports.

### 2. Context Access Pattern Changed

**Before (Mocha):** Global variables
```typescript
feature("My Feature", () => {
    scenario("My Scenario", () => {
        given("a step", () => {
            const title = featureContext.title;
            const table = stepContext.table;
        });
    });
});
```

**After (Vitest):** Context parameter
```typescript
feature("My Feature", (ctx) => {
    scenario("My Scenario", (ctx) => {
        Given("a step", (ctx) => {
            const title = ctx.feature?.title;
            const table = ctx.step?.table;
        });
    });
});
```

**Available Context Properties:**
- `ctx.feature` - Feature context (title, description, tags, filename)
- `ctx.scenario` - Scenario context (title, description, tags)
- `ctx.background` - Background context (if in background block)
- `ctx.step` - Current step context (title, table, docString, values, etc.)
- `ctx.example` - Example data (in scenario outlines)

### 3. Test Runner Configuration

**Before (Mocha):** `mocha.opts` or `.mocharc.js`

**After (Vitest):** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    reporters: ['default', './node_modules/livedoc-vitest/dist/app/reporter/LiveDocVitestReporter.js']
  }
});
```

### 4. Package Dependencies

Update your `package.json`:

**Remove:**
```json
{
  "devDependencies": {
    "mocha": "^5.x",
    "livedoc-mocha": "^2.x"
  }
}
```

**Add:**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "livedoc-vitest": "^1.0.0"
  }
}
```

## What Stays the Same

### 1. Feature Structure
```typescript
feature("Feature Title @tag1 @tag2", (ctx) => {
    // Scenarios here
});
```

### 2. Scenario Outlines with Examples
```typescript
scenarioOutline(`Data-driven test
    Examples:
    | col1 | col2 |
    | val1 | val2 |
`, (ctx) => {
    Given("step with <col1>", (ctx) => {
        const value = ctx.example?.col1;
    });
});
```

### 3. Background Blocks
```typescript
feature("Feature with Background", (ctx) => {
    background("Common setup", (ctx) => {
        Given("common precondition", (ctx) => { });
        
        ctx.afterBackground(() => {
            // Cleanup after each scenario
        });
    });
});
```

### 4. Data Tables
```typescript
Given(`a table
    | name | value |
    | key1 | val1  |
    | key2 | val2  |
`, (ctx) => {
    const rows = ctx.step?.table;
    const entity = ctx.step?.tableAsEntity;
});
```

### 5. DocStrings
```typescript
Given(`a docstring
    """
    {
        "key": "value"
    }
    """
`, (ctx) => {
    const json = ctx.step?.docStringAsEntity;
});
```

### 6. Filtering by Tags
```typescript
import { livedoc } from "livedoc-vitest";

livedoc.options.filters.include = ["@smoke"];
livedoc.options.filters.exclude = ["@slow"];
```

## Migration Steps

1. **Update package.json**
   ```bash
   npm uninstall mocha livedoc-mocha
   npm install --save-dev vitest livedoc-vitest
   ```

2. **Create vitest.config.ts**
   ```bash
   # Copy example from above
   ```

3. **Update imports**
   ```typescript
   // Change from:
   import { feature, scenario, given, when, then } from "livedoc-mocha";
   
   // To:
   import { feature, scenario, Given, When, Then } from "livedoc-vitest";
   ```

4. **Update all step functions to capitalized versions**
   - Find/Replace: `given(` → `Given(`
   - Find/Replace: `when(` → `When(`
   - Find/Replace: `then(` → `Then(`
   - Find/Replace: `and(` → `And(`
   - Find/Replace: `but(` → `But(`

5. **Add ctx parameter to all blocks**
   ```typescript
   // Add (ctx) => to feature, scenario, scenarioOutline, background
   feature("Title", (ctx) => { /* ... */ });
   scenario("Title", (ctx) => { /* ... */ });
   Given("step", (ctx) => { /* ... */ });
   ```

6. **Replace global context variables**
   - Replace `featureContext` with `ctx.feature`
   - Replace `scenarioContext` with `ctx.scenario`
   - Replace `stepContext` with `ctx.step`
   - Replace `scenarioOutlineContext` with `ctx` (example available via `ctx.example`)

7. **Update test scripts**
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest watch"
     }
   }
   ```

## Benefits of Vitest

1. **Faster execution** - Vitest uses Vite for blazing fast HMR
2. **Better TypeScript support** - Native ESM and TS support
3. **Modern tooling** - Built for modern JavaScript ecosystem
4. **Watch mode** - Intelligent re-running of affected tests
5. **Parallel execution** - Tests run in parallel by default
6. **Better error messages** - Clearer stack traces and diffs

## Troubleshooting

### Issue: "Cannot find module 'livedoc-vitest'"
**Solution:** Ensure you've installed the package and run `npm install`

### Issue: Tests not running
**Solution:** Check your `vitest.config.ts` include patterns match your test files

### Issue: "then is not a function"
**Solution:** Make sure you're using capitalized `Then` not lowercase `then`

### Issue: "ctx is undefined"
**Solution:** Add the `(ctx)` parameter to your feature/scenario/step functions

## Support

For issues or questions:
- GitHub Issues: https://github.com/dotnetprofessional/LiveDoc
- Documentation: See README.md in the package

## Example Complete Migration

**Before:**
```typescript
///<reference path="../node_modules/livedoc-mocha/app/livedoc.d.ts" />

feature("Calculator", () => {
    scenario("Adding numbers", () => {
        let result = 0;
        
        given("I have entered '50'", () => {
            result = stepContext.values[0];
        });
        
        when("I add '30'", () => {
            result += stepContext.values[0];
        });
        
        then("the result should be '80'", () => {
            if (result !== 80) {
                throw new Error(`Expected 80 but got ${result}`);
            }
        });
    });
});
```

**After:**
```typescript
import { feature, scenario, Given, When, Then } from "livedoc-vitest";

feature("Calculator", (ctx) => {
    scenario("Adding numbers", (ctx) => {
        let result = 0;
        
        Given("I have entered '50'", (ctx) => {
            result = ctx.step?.values[0];
        });
        
        When("I add '30'", (ctx) => {
            result += ctx.step?.values[0];
        });
        
        Then("the result should be '80'", (ctx) => {
            if (result !== 80) {
                throw new Error(`Expected 80 but got ${result}`);
            }
        });
    });
});
```
