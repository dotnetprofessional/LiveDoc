# Writing LiveDoc Tests with @livedoc/vitest

This prompt helps you write BDD-style tests using the LiveDoc framework with Gherkin syntax. The goal is to create living documentation that is readable, maintainable, and provides clear specifications.

## Core Principles

1. **Tests ARE Documentation** - Write tests that read like specifications a business person could understand
2. **Balance Verbosity** - Include enough detail to be self-documenting, but not so much it obscures intent
3. **Use Gherkin Naturally** - Feature → Scenario → Given/When/Then follows the natural flow of specifications

## Import Pattern

```typescript
import { feature, scenario, scenarioOutline, background, Given, When, Then, And, But } from "@livedoc/vitest";
```

## Basic Structure

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
    // ctx.step.values[0] === "john@example.com"
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

When("they withdraw '50' dollars", (ctx) => {
    // ctx.step.values[0] === 50
    withdrawal = ctx.step.values[0];
});

Then("the remaining balance is '50' dollars", (ctx) => {
    expect(balance - withdrawal).toBe(ctx.step.values[0]);
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
    | Gizmo  | 29.99 |    25 |
    `, (ctx) => {
    products = ctx.step.table;
    // products[0] === { name: "Widget", price: 9.99, stock: 100 }
});

// Two-column table - becomes single entity object
Given(`the user has the following profile:
    | name     | Alice             |
    | email    | alice@example.com |
    | role     | admin             |
    | verified | true              |
    `, (ctx) => {
    profile = ctx.step.tableAsEntity;
    // profile === { name: "Alice", email: "alice@example.com", role: "admin", verified: true }
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
        "data": {
            "id": 123,
            "name": "Test Item"
        }
    }
    """
    `, (ctx) => {
    expectedResponse = ctx.step.docStringAsEntity;
    // Automatically parsed as JSON object
});

Given(`the email template is:
    """
    Dear {name},

    Thank you for your order #{orderId}.

    Best regards,
    The Team
    """
    `, (ctx) => {
    template = ctx.step.docString;
    // Raw string with newlines preserved
});
```

## Scenario Outlines (Data-Driven Tests)

Use scenario outlines to run the same test with multiple data sets:

```typescript
scenarioOutline(`Validate password strength

    Examples:
    |  password   | strength | valid |
    | abc         | weak     | false |
    | abc12345    | medium   | false |
    | Abc12345!   | strong   | true  |
    | MyP@ssw0rd! | strong   | true  |
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

**Multiple Example Tables:**

```typescript
scenarioOutline(`Shipping cost calculation

    Examples: Domestic Orders
    |  country  | total | shipping |
    | Australia |    50 |        5 |
    | Australia |   100 |        0 |

    Examples: International Orders
    |   country   | total | shipping |
    | New Zealand |    50 |       15 |
    | USA         |   100 |       15 |
    `, (ctx) => {
    // Test implementation
});
```

## Background (Shared Setup)

Use background for setup that applies to all scenarios in a feature:

```typescript
feature("Shopping Cart Operations", (ctx) => {
    let cart: ShoppingCart;
    let user: User;

    background("User has an active cart", (ctx) => {
        Given("a logged-in user", (ctx) => {
            user = createTestUser();
        });

        And("an empty shopping cart", (ctx) => {
            cart = new ShoppingCart(user);
        });

        // Optional cleanup after each scenario
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

    scenario("Remove item from cart", (ctx) => {
        Given("the cart has an item", (ctx) => {
            cart.add(testProduct);
        });

        When("they remove the item", (ctx) => {
            cart.remove(testProduct.id);
        });

        Then("the cart is empty", (ctx) => {
            expect(cart.isEmpty).toBe(true);
        });
    });
});
```

## Tags for Filtering

Apply tags to features or scenarios for test filtering:

```typescript
feature(`Payment Processing
    @payments @integration
    `, (ctx) => {

    scenario(`Process credit card payment
        @smoke @critical
        `, (ctx) => {
        // This runs when filtering by @smoke, @critical, @payments, or @integration
    });

    scenario(`Process refund
        @slow
        `, (ctx) => {
        // Can be excluded with exclude filter for @slow
    });
});
```

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
   let finalPrice: number;
   ```

3. **Keep step implementations focused:**
   ```typescript
   Given("a product with price '29.99'", (ctx) => {
       product = createProduct({ price: ctx.step.values[0] });
   });
   ```

4. **Use tables for complex test data:**
   ```typescript
   Given(`these items in the cart:
       | product | quantity | price |
       | Book    |        2 | 15.00 |
       | Pen     |        5 |  2.50 |
       `, (ctx) => {
       ctx.step.table.forEach(item => cart.add(item));
   });
   ```

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

4. **Don't put too much logic in a single step:**
   ```typescript
   // Bad - too much happening
   Given("everything is set up", (ctx) => {
       user = createUser();
       cart = new Cart(user);
       product = createProduct();
       cart.add(product);
       payment = setupPayment(user);
   });
   
   // Good - broken into logical steps
   Given("a registered customer", ...)
   And("they have items in their cart", ...)
   And("a valid payment method", ...)
   ```

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
        expect(userData.id).toBe(userId);
    });
});
```

## Context Properties Reference

|        Property         |   Available In   |                      Description                      |
| ----------              | -------------    | -------------                                         |
| `ctx.feature`           | All blocks       | Feature metadata (title, description, tags, filename) |
| `ctx.scenario`          | Scenario/Steps   | Scenario metadata (title, description, tags)          |
| `ctx.step`              | Steps only       | Current step (title, values, table, docString)        |
| `ctx.example`           | Scenario Outline | Current example row data                              |
| `ctx.background`        | Background       | Background metadata                                   |
| `ctx.afterBackground()` | Background       | Register cleanup function                             |

## File Naming Convention

- Test files should use `.Spec.ts` extension
- Name files after the feature being tested: `UserAuthentication.Spec.ts`, `ShoppingCart.Spec.ts`

## Complete Example

```typescript
import { feature, scenario, scenarioOutline, background, Given, When, Then, And } from "@livedoc/vitest";
import { expect } from "chai";

feature(`Order Discount Calculation
    @orders @pricing

    The system applies discounts based on order total and customer tier.
    
    Rules:
    * Standard customers get 5% off orders over $100
    * Premium customers get 10% off all orders
    * VIP customers get 15% off all orders plus free shipping
    `, (ctx) => {

    let order: Order;
    let customer: Customer;

    background("Customer places an order", (ctx) => {
        Given("the pricing engine is configured", (ctx) => {
            PricingEngine.initialize();
        });
    });

    scenarioOutline(`Apply tier-based discounts

        Examples:
        |   tier   | orderTotal | expectedDiscount |
        | standard |         50 |                0 |
        | standard |        100 |                5 |
        | premium  |         50 |                5 |
        | vip      |         50 |              7.5 |
        `, (ctx) => {

        Given("a <tier> customer", (ctx) => {
            customer = new Customer({ tier: ctx.example.tier });
        });

        And("an order totaling <orderTotal> dollars", (ctx) => {
            order = new Order(customer, ctx.example.orderTotal);
        });

        When("calculating the discount", (ctx) => {
            order.calculateDiscount();
        });

        Then("the discount should be <expectedDiscount> dollars", (ctx) => {
            expect(order.discount).to.equal(ctx.example.expectedDiscount);
        });
    });

    scenario("VIP customers receive free shipping", (ctx) => {
        Given("a VIP customer", (ctx) => {
            customer = new Customer({ tier: "vip" });
        });

        And("an order with standard shipping", (ctx) => {
            order = new Order(customer, 50);
            order.shippingMethod = "standard";
        });

        When("finalizing the order", (ctx) => {
            order.finalize();
        });

        Then("shipping cost is waived", (ctx) => {
            expect(order.shippingCost).to.equal(0);
        });

        And("order notes indicate free shipping applied", (ctx) => {
            expect(order.notes).to.include("VIP Free Shipping");
        });
    });
});
```
