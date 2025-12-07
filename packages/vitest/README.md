# LiveDoc-Vitest

BDD extensions for Vitest that support LiveDoc reporting with Gherkin syntax.

## Overview

LiveDoc-Vitest brings Behavior-Driven Development (BDD) to Vitest with full Gherkin syntax support including:
- Feature / Scenario / Given / When / Then / And / But
- Scenario Outlines with Examples
- Background steps
- Tags and filtering
- Data tables and doc strings
- Beautiful LiveDoc reporting

This is a modern rewrite of livedoc-mocha leveraging Vitest's architecture and native TypeScript support.

## Installation

```bash
npm install --save-dev livedoc-vitest vitest
```

## Quick Start

### 1. Create a test file

```typescript
// tests/calculator.Spec.ts
import { feature, scenario, Given, When, Then } from 'livedoc-vitest';

feature("Calculator", (ctx) => {
  scenario("Adding two numbers", (ctx) => {
    let result = 0;

    Given("I have entered '50' into the calculator", (ctx) => {
      result = ctx.step?.values[0] || 0;
    });

    And("I have entered '70' into the calculator", (ctx) => {
      result += ctx.step?.values[0] || 0;
    });

    When("I press add", (ctx) => {
      // Addition already happened in the Given steps
    });

    Then("the result should be '120'", (ctx) => {
      const expected = ctx.step?.values[0];
      if (result !== expected) {
        throw new Error(`Expected ${expected} but got ${result}`);
      }
    });
  });
});
```

### 2. Configure Vitest

```typescript
// vitest.config.ts
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

### 3. Run tests

```bash
npx vitest run
```

Output:
```
LiveDoc Test Summary
────────────────────────────────────────────────────────────────
✓ 4 steps passed
  1 features, 1 scenarios, 4 total steps
```

## Features

### Context Access Pattern

LiveDoc-Vitest uses a context parameter (ctx) to access test metadata:

```typescript
feature("Shopping Cart", (ctx) => {
  scenario("Add item to cart", (ctx) => {
    let cart: any;
    let product: any;

    Given("an empty cart", (ctx) => {
      cart = { items: [] };
      // ctx.feature provides feature metadata
      console.log(ctx.feature?.title);
    });

    And("a product in stock", (ctx) => {
      product = { id: 1, name: "Book", price: 10 };
      // ctx.step provides step metadata
      console.log(ctx.step?.title);
    });

    When("the user adds the product", (ctx) => {
      cart.items.push(product);
    });

    Then("the cart contains the product", (ctx) => {
      if (cart.items.length !== 1) {
        throw new Error("Cart should have 1 item");
      }
    });
  });
});
```

**Note:** `ctx` provides metadata about the feature/scenario/step. Store your test data in local variables (closures).

### Scenario Outlines with Examples

```typescript
scenarioOutline(`Add two numbers
    Examples:
    | num1 | num2 | result |
    |    5 |    3 |      8 |
    |   10 |    2 |     12 |
    |    0 |    0 |      0 |
`, (ctx) => {
  let sum = 0;

  Given("I have <num1>", (ctx) => {
    sum = ctx.example?.num1 || 0;
  });

  When("I add <num2>", (ctx) => {
    sum += ctx.example?.num2 || 0;
  });

  Then("the result should be <result>", (ctx) => {
    const expected = ctx.example?.result;
    if (sum !== expected) {
      throw new Error(`Expected ${expected} but got ${sum}`);
    }
  });
});
```

### Background Steps

```typescript
feature("Bank Account", (ctx) => {
  let account: any;

  background("User has an account", (ctx) => {
    Given("a user with an account balance of $1000", (ctx) => {
      account = { balance: 1000 };
    });

    ctx.afterBackground(() => {
      // Cleanup after each scenario
      account = null;
    });
  });

  scenario("Withdraw money", (ctx) => {
    When("they withdraw $100", (ctx) => {
      account.balance -= 100;
    });

    Then("the balance is $900", (ctx) => {
      if (account.balance !== 900) {
        throw new Error(`Expected 900 but got ${account.balance}`);
      }
    });
  });

  scenario("Deposit money", (ctx) => {
    When("they deposit $500", (ctx) => {
      account.balance += 500;
    });

    Then("the balance is $1500", (ctx) => {
      if (account.balance !== 1500) {
        throw new Error(`Expected 1500 but got ${account.balance}`);
      }
    });
  });
});
```

### Data Tables

```typescript
Given(`a list of users
    | name  | email             | age |
    | Alice | alice@example.com |  30 |
    | Bob   | bob@example.com   |  25 |
`, (ctx) => {
  const users = ctx.step?.table;
  // users is an array of objects
  console.log(users[0].name);  // "Alice"
  console.log(users[1].email); // "bob@example.com"
});

// Two-column tables convert to entity
Given(`user details
    | name  | John              |
    | email | john@example.com  |
    | age   | 35                |
`, (ctx) => {
  const user = ctx.step?.tableAsEntity;
  console.log(user.name);  // "John"
  console.log(user.email); // "john@example.com"
});
```

### Doc Strings

```typescript
Given(`a JSON payload
    """
    {
      "name": "John",
      "email": "john@example.com"
    }
    """
`, (ctx) => {
  const payload = ctx.step?.docStringAsEntity;
  console.log(payload.name);  // "John"
  console.log(payload.email); // "john@example.com"
  
  // Or get raw string
  const raw = ctx.step?.docString;
});
```

### Tags and Filtering

```typescript
feature("API Tests @api @integration", (ctx) => {
  scenario("Create user @smoke", (ctx) => {
    // Test implementation
  });

  scenario("Update user @slow", (ctx) => {
    // Test implementation
  });
});

// Configure filtering
import { livedoc } from "livedoc-vitest";

livedoc.options.filters.include = ["@smoke"];
livedoc.options.filters.exclude = ["@slow"];
```

## Context Properties

The `ctx` parameter provides access to:

- **`ctx.feature`** - Feature metadata
  - `title`: Feature title
  - `description`: Feature description
  - `tags`: Array of tags
  - `filename`: Source filename

- **`ctx.scenario`** - Scenario metadata
  - `title`: Scenario title
  - `description`: Scenario description
  - `tags`: Array of tags

- **`ctx.step`** - Current step metadata
  - `title`: Step title
  - `values`: Quoted values from title (e.g., "value" → ["value"])
  - `table`: Data table as array of objects
  - `tableAsEntity`: Two-column table as object
  - `tableAsSingleList`: Single-column table as array
  - `docString`: Raw doc string content
  - `docStringAsEntity`: Parsed JSON doc string

- **`ctx.example`** - Example row data (in scenario outlines)
  - Access columns by name (e.g., `ctx.example?.columnName`)

- **`ctx.background`** - Background metadata (in background blocks)
  - `title`: Background title

- **`ctx.afterBackground(fn)`** - Register cleanup function (in background blocks)

## Migration from livedoc-mocha

See [MIGRATION.md](./MIGRATION.md) for a comprehensive migration guide.

Key changes:
- Step functions are capitalized: `Given`, `When`, `Then`, `And`, `But`
- Context accessed via `ctx` parameter instead of global variables
- Add `(ctx)` parameter to all feature/scenario/step functions
- Configure via `vitest.config.ts` instead of mocha.opts

## Documentation

- [Migration Guide](./MIGRATION.md) - Migrating from livedoc-mocha
- [Architecture](./architecture.md) - Internal architecture details
- [API Changes](./api-changes.md) - Detailed API differences

## License

MIT

## Credits

Created by Garry McGlennon. This is a modernized version of livedoc-mocha rebuilt for Vitest.
