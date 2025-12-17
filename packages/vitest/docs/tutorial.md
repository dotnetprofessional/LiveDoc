<div align="center">

# 🎓 Tutorial: Your First Living Specification

### From business requirements to executable documentation

</div>

---

> This tutorial is adapted from [Alister Scott's](https://www.thoughtworks.com/profiles/alister-scott) excellent article [Specification by Example: a Love Story](https://watirmelon.files.wordpress.com/2011/05/specificationbyexamplealovestory1.pdf). It demonstrates how to think in Gherkin and write specifications that anyone on your team can understand.

---

## The Scenario

Imagine you're working for **Beautiful Tea**, an Australian company that ships tea worldwide. The business comes to you with this requirement:

> _"We need to charge different amounts for our customers overseas versus Australia. The tax office says we must charge GST for Australian customers but not for overseas ones. Also, we got a great deal with a local shipping company—we can ship anywhere in Australia for free if they spend more than AUD$100, but we still have to charge overseas customers."_

Your mission: Implement this in a way that's **testable**, **readable**, and serves as **living documentation**.

---

## Part 1: Writing Features (The "What")

### ❌ The Technical Approach

A developer's first instinct might be:

```gherkin
Feature: Add additional shipping options to shopping cart
```

This describes *what you're building* but not *why*. It focuses on the implementation, not the business value.

### ✅ The Business Approach

Let's rewrite it from the business perspective:

```gherkin
Feature: Beautiful Tea Shipping Costs

  * Australian customers pay GST
  * Overseas customers don't pay GST
  * Australian customers get free shipping for orders $100 and above
  * Overseas customers all pay the same shipping rate regardless of order size
```

**Notice the difference?**
- No mention of websites, carts, or technical details
- Focuses on business rules anyone can understand
- A new team member could read this and understand the shipping policy

---

## Part 2: Writing Scenarios (The "How")

### ❌ The UI-Focused Approach

A common mistake is writing scenarios that mirror the UI:

```gherkin
Scenario: Free shipping in Australia
  Given I am on the Beautiful Tea home page
  When I search for 'Byron Breakfast' tea
  Then I see the page for 'Byron Breakfast' tea
  When I add 'Byron Breakfast' tea to my cart
    And I select 10 as the quantity
  Then I see 10 x 'Byron Breakfast' tea in my cart
  When I select 'Check Out'
    And I enter my country as 'Australia'
  Then I see the total including GST
    And I see that I am eligible for free shipping
```

**Problems:**
- Very long and repetitive
- Tied to UI implementation (what if the UI changes?)
- Doesn't clearly explain the *rules*
- You'd need many similar scenarios for different cases

### ✅ The Declarative Approach

Instead, focus on the business rules using a **Scenario Outline**:

```gherkin
Scenario Outline: Calculate GST status and shipping rate

Given the customer is from <country>
When the customer's order totals <order total>
Then the customer pays <GST amount> GST
  And they are charged the <shipping rate> shipping rate

Examples:
  |   country   | order total | GST amount |     shipping rate      |
  | Australia   |       99.99 |      9.999 | Standard Domestic      |
  | Australia   |      100.00 |      10.00 | Free                   |
  | New Zealand |       99.99 |          0 | Standard International |
  | New Zealand |      100.00 |          0 | Standard International |
  | Zimbabwe    |      100.00 |          0 | Standard International |
```

**Benefits:**
- Crystal clear what the rules are
- Easy to add new test cases (just add a row)
- Not tied to any UI or implementation
- Serves as documentation for the business rules

---

## Part 3: Implementing in LiveDoc

Now let's turn this specification into executable code with LiveDoc.

### Step 1: Set Up Your Test File

Create `ShippingCosts.Spec.ts`:

```ts
import { feature, scenarioOutline, given, when, Then as then, and } from '@livedoc/vitest';
import { expect } from 'vitest';

// We'll build these classes as we go
import { ShoppingCart, CartItem, ShippingRates } from '../src/ShoppingCart';
```

### Step 2: Define the Feature

```ts
feature(`Beautiful Tea Shipping Costs

  * Australian customers pay GST
  * Overseas customers don't pay GST
  * Australian customers get free shipping for orders $100 and above
  * Overseas customers all pay the same shipping rate regardless of order size
`, () => {

  // Scenarios will go here

});
```

> 💡 **Tip:** Use backticks (\`) for multi-line descriptions. The description becomes part of your living documentation.

### Step 3: Add the Scenario Outline

```ts
feature(`Beautiful Tea Shipping Costs

  * Australian customers pay GST
  * Overseas customers don't pay GST
  * Australian customers get free shipping for orders $100 and above
  * Overseas customers all pay the same shipping rate regardless of order size
`, () => {

  scenarioOutline(`Calculate GST status and shipping rate

    Examples:
    |   country   | order total | GST amount |     shipping rate      |
    | Australia   |       99.99 |      9.999 | Standard Domestic      |
    | Australia   |      100.00 |      10.00 | Free                   |
    | New Zealand |       99.99 |          0 | Standard International |
    | New Zealand |      100.00 |          0 | Standard International |
    | Zimbabwe    |      100.00 |          0 | Standard International |
  `, (ctx) => {
    const cart = new ShoppingCart();

    given("the customer is from '<country>'", () => {
      cart.country = ctx.example?.country;
    });

    when("the customer's order totals '<order total>'", () => {
      const item = new CartItem();
      item.quantity = 1;
      item.price = ctx.example?.orderTotal;
      item.product = "tea";
      cart.items.push(item);
      cart.calculateInvoice();
    });

    then("the customer pays '<GST amount>' GST", () => {
      expect(cart.gst).toBe(ctx.example?.GSTAmount);
    });

    and("they are charged the '<shipping rate>' shipping rate", () => {
      const expectedRate = ShippingRates[ctx.example?.shippingRate];
      expect(cart.shippingCost).toBe(expectedRate);
    });
  });

});
```

---

## Part 4: Understanding the Code

### The Context Object

Each `scenarioOutline` callback receives a `ctx` object with the current example row:

```ts
scenarioOutline(`...
  Examples:
  | country   | order total |
  | Australia |      100.00 |
`, (ctx) => {
  // Access example data
  console.log(ctx.example?.country);     // "Australia"
  console.log(ctx.example?.orderTotal);  // 100 (as number!)
});
```

**Column name conversion:**
- Spaces are removed and camelCased: `order total` → `orderTotal`
- Type coercion is automatic: `100.00` → `100` (number)

### The Given-When-Then Steps

Each step is a function that:
1. **Describes** what's happening (in the title)
2. **Implements** the action (in the callback)

```ts
given("the customer is from '<country>'", () => {
  // The '<country>' placeholder documents the data source
  // The callback implements the setup
  cart.country = ctx.example?.country;
});
```

> 💡 The `<placeholder>` syntax in step titles helps readers understand where data comes from. LiveDoc highlights these in the output.

---

## Part 5: Running the Test

Run your test:

```bash
npx vitest run ShippingCosts.Spec.ts
```

You'll see beautiful output like:

```
Feature: Beautiful Tea Shipping Costs
  * Australian customers pay GST
  * Overseas customers don't pay GST
  * Australian customers get free shipping for orders $100 and above
  * Overseas customers all pay the same shipping rate regardless of order size

  Scenario Outline: Calculate GST status and shipping rate
     given the customer is from <country>
     when the customer's order totals <order total>
     then the customer pays <GST amount> GST
       and they are charged the <shipping rate> shipping rate

    Example: 1
      ✓ given the customer is from Australia
      ✓ when the customer's order totals 99.99
      ✓ then the customer pays 9.999 GST
      ✓   and they are charged the Standard Domestic shipping rate

    Example: 2
      ✓ given the customer is from Australia
      ✓ when the customer's order totals 100.00
      ✓ then the customer pays 10.00 GST
      ✓   and they are charged the Free shipping rate

    ... (more examples)

──────────────────────────────────────────────────────
LiveDoc Test Summary
  ✓ 20 steps passed
  1 feature, 1 scenario outline, 5 examples, 20 steps
```

---

## Part 6: The Implementation

For completeness, here's a simple implementation of the shopping cart:

```ts
// src/ShoppingCart.ts

export const ShippingRates: Record<string, number> = {
  'Free': 0,
  'StandardDomestic': 10,
  'StandardInternational': 25,
};

export class CartItem {
  product: string = '';
  quantity: number = 0;
  price: number = 0;
}

export class ShoppingCart {
  country: string = '';
  items: CartItem[] = [];
  gst: number = 0;
  shippingCost: number = 0;

  calculateInvoice(): void {
    const total = this.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );

    // GST rules
    if (this.country === 'Australia') {
      this.gst = total * 0.1; // 10% GST
    } else {
      this.gst = 0;
    }

    // Shipping rules
    if (this.country === 'Australia' && total >= 100) {
      this.shippingCost = ShippingRates['Free'];
    } else if (this.country === 'Australia') {
      this.shippingCost = ShippingRates['StandardDomestic'];
    } else {
      this.shippingCost = ShippingRates['StandardInternational'];
    }
  }
}
```

---

## Key Takeaways

### 1. Think Business, Not Technical
Write features and scenarios in business language. Anyone should be able to read and understand them.

### 2. Be Declarative, Not Imperative
Focus on **what** should happen, not **how** it happens. Avoid UI-specific steps.

### 3. Use Examples Liberally
Scenario Outlines with examples are powerful. They document edge cases and make adding new test cases trivial.

### 4. Let the Spec Drive the Code
Write your specification first, then implement the code to make it pass. This is true BDD.

### 5. Maintain Living Documentation
Your specs should always reflect the current behavior. When requirements change, update the spec first.

---

## Next Steps

- [BDD Authoring Guide](./authoring-bdd.md) — Deep dive into features, scenarios, and steps
- [Data Extraction](./data-extraction.md) — More on tables, doc strings, and quoted values  
- [Tags and Filtering](./tags-and-filtering.md) — Organize and run specific tests

---

<div align="center">

**Congratulations!** 🎉

You've written your first living specification with LiveDoc.

</div>
