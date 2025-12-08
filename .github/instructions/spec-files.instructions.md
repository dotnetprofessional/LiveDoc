---
applyTo: "**/*.Spec.ts"
---

# Writing LiveDoc Tests

This file provides instructions for writing BDD-style tests using the LiveDoc framework with Gherkin syntax. The goal is to create living documentation that is readable, maintainable, and provides clear specifications.

## Core Principles

1. **Tests ARE Documentation** - Write tests that read like specifications a business person could understand
2. **Balance Verbosity** - Include enough detail to be self-documenting, but not so much it obscures intent
3. **Use Gherkin Naturally** - Feature → Scenario → Given/When/Then follows the natural flow of specifications

## Import Pattern

Always use this import pattern:

```typescript
import { feature, scenario, scenarioOutline, background, Given, When, Then, And, But } from "@livedoc/vitest";
```

## Structure Guidelines

### Feature Block

Features define the high-level capability being tested. Include:
- A clear, concise title
- Optional tags for filtering (prefixed with @ or not)
- A brief description explaining the business value or rules

```typescript
feature(`User Authentication
    @security @critical

    Users must be able to securely authenticate to access protected resources.
    
    Rules:
    * Valid credentials grant access
    * Invalid credentials are rejected
    * Accounts lock after 3 failed attempts
    `, (ctx) => {
    // scenarios go here
});
```

### Scenario Block

Scenarios describe specific test cases. Keep titles action-oriented and descriptive:

```typescript
scenario("User logs in with valid credentials", (ctx) => {
    // steps go here
});

scenario(`User account locks after failed attempts
    @slow
    This tests the security lockout feature
    `, (ctx) => {
    // steps go here
});
```

### Step Blocks (Given/When/Then/And/But)

Steps define the test implementation. Use the context parameter (`ctx`) to access metadata.

```typescript
Given("a registered user with email 'john@example.com'", (ctx) => {
    const email = ctx.step.values[0];
    user = createUser(email);
});

When("they enter password 'secret123'", (ctx) => {
    const password = ctx.step.values[0];
    result = authService.login(user.email, password);
});

Then("they should be granted access", (ctx) => {
    expect(result.success).toBe(true);
});

And("a session token should be created", (ctx) => {
    expect(result.token).toBeDefined();
});
```

## Extracting Values

### Quoted Values (Preferred for Simple Values)

Use single or double quotes to embed values in step titles. They are automatically extracted and type-converted:

```typescript
Given("the user has a balance of '100' dollars", (ctx) => {
    // ctx.step.values[0] === 100 (number, not string!)
    balance = ctx.step.values[0];
});
```

**Supported types in quoted values:**
- Numbers: `'1234'` → `1234`
- Booleans: `'true'` or `'false'` → `true` or `false`
- Arrays: `'[1, 2, 3]'` → `[1, 2, 3]`
- Dates: `'2024-01-15'` → `Date` object

### Data Tables (For Structured Data)

Use tables for multiple properties or lists of items:

```typescript
// Multi-column table - becomes array of objects
Given(`the following products are available:
    |  name  | price | stock |
    | Widget |  9.99 |   100 |
    | Gadget | 19.99 |    50 |
    `, (ctx) => {
    products = ctx.step.table;
    // products[0] === { name: "Widget", price: 9.99, stock: 100 }
});

// Two-column table - becomes single entity object
Given(`the user has the following profile:
    | name  | Alice             |
    | email | alice@example.com |
    | role  | admin             |
    `, (ctx) => {
    profile = ctx.step.tableAsEntity;
    // profile === { name: "Alice", email: "alice@example.com", role: "admin" }
});

// Single-column table - becomes array
Given(`the valid status codes:
    | 200 |
    | 201 |
    | 204 |
    `, (ctx) => {
    validCodes = ctx.step.tableAsSingleList;
    // validCodes === [200, 201, 204]
});
```

### Doc Strings (For Large Text or JSON)

Use triple quotes for multi-line content:

```typescript
Given(`the API returns the following response:
    """
    {
        "status": "success",
        "data": { "id": 123 }
    }
    """
    `, (ctx) => {
    expectedResponse = ctx.step.docStringAsEntity;
});

Given(`the email template is:
    """
    Dear {name},
    Thank you for your order.
    """
    `, (ctx) => {
    template = ctx.step.docString;
});
```

## Scenario Outlines (Data-Driven Tests)

Use scenario outlines to run the same test with multiple data sets:

```typescript
scenarioOutline(`Validate password strength

    Examples:
    | password  | strength | valid |
    | abc       | weak     | false |
    | Abc12345! | strong   | true  |
    `, (ctx) => {

    let result: PasswordValidation;

    Given("a password validator", (ctx) => {
        validator = new PasswordValidator();
    });

    When("validating password <password>", (ctx) => {
        result = validator.validate(ctx.example.password);
    });

    Then("the strength should be <strength>", (ctx) => {
        expect(result.strength).toBe(ctx.example.strength);
    });

    And("valid should be <valid>", (ctx) => {
        expect(result.isValid).toBe(ctx.example.valid);
    });
});
```

## Background (Shared Setup)

Use background for setup that applies to all scenarios in a feature:

```typescript
feature("Shopping Cart Operations", (ctx) => {
    let cart: ShoppingCart;

    background("User has an active cart", (ctx) => {
        Given("a logged-in user", (ctx) => {
            user = createTestUser();
        });

        And("an empty shopping cart", (ctx) => {
            cart = new ShoppingCart(user);
        });

        ctx.afterBackground(() => {
            cart.clear();
        });
    });

    scenario("Add item to cart", (ctx) => {
        When("they add a product", (ctx) => {
            cart.add(testProduct);
        });

        Then("the cart contains one item", (ctx) => {
            expect(cart.itemCount).toBe(1);
        });
    });
});
```

## Context Properties Reference

|        Property         |   Available In   |                      Description                      |
| ----------------------- | ---------------- | ----------------------------------------------------- |
| `ctx.feature`           | All blocks       | Feature metadata (title, description, tags, filename) |
| `ctx.scenario`          | Scenario/Steps   | Scenario metadata (title, description, tags)          |
| `ctx.step`              | Steps only       | Current step (title, values, table, docString)        |
| `ctx.example`           | Scenario Outline | Current example row data                              |
| `ctx.background`        | Background       | Background metadata                                   |
| `ctx.afterBackground()` | Background       | Register cleanup function                             |

## Best Practices

### DO ✓

1. **Write titles that tell a story:**
   ```typescript
   Given("a customer with premium membership", ...)
   When("they place an order over $50", ...)
   Then("free express shipping is applied", ...)
   ```

2. **Use descriptive variable names:**
   ```typescript
   let orderTotal: number;
   let appliedDiscount: Discount;
   ```

3. **Keep step implementations focused** - one action per step

4. **Use tables for complex test data**

### DON'T ✗

1. **Avoid implementation details in titles:**
   ```typescript
   // Bad
   Given("calling userService.create() with {name: 'test'}", ...)
   // Good
   Given("a new user named 'test'", ...)
   ```

2. **Don't repeat the step keyword in the title:**
   ```typescript
   // Bad
   Given("Given the user is logged in", ...)
   // Good
   Given("the user is logged in", ...)
   ```

3. **Avoid overly technical assertions in Then titles:**
   ```typescript
   // Bad
   Then("expect(result.status).toBe(200)", ...)
   // Good
   Then("the request succeeds", ...)
   ```

4. **Don't put too much logic in a single step** - break into logical steps

## Async Operations

Steps can be async when testing asynchronous code:

```typescript
scenario("Fetch user data from API", (ctx) => {
    let userData: User;

    When("requesting user profile", async (ctx) => {
        userData = await userService.getProfile(userId);
    });

    Then("the user data is returned", (ctx) => {
        expect(userData).toBeDefined();
    });
});
```

## File Naming Convention

- Test files should use `.Spec.ts` extension
- Name files after the feature being tested: `UserAuthentication.Spec.ts`, `ShoppingCart.Spec.ts`
