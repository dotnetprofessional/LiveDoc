<div align="center">

# 📊 Data Extraction

### Tables, doc strings, and quoted values

</div>

---

LiveDoc automatically extracts data from your step titles and embedded content, making your tests both readable and data-driven.

> 💡 **Tip:** Install the [LiveDoc VS Code extension](https://marketplace.visualstudio.com/items?itemName=dotNetProfessional.livedoc-vscode) for automatic table formatting and alignment.

---

## Quoted values

Any value in `'single quotes'` is automatically extracted:

```ts
given("the user has '$100' in their account", (ctx) => {
  const balance = ctx.step?.values?.[0];  // 100 (as number)
});
```

Multiple values are extracted in order:

```ts
then("the result of '10' + '20' should be '30'", (ctx) => {
  const [a, b, expected] = ctx.step?.values ?? [];
  // a = 10, b = 20, expected = 30
});
```

### Type coercion

LiveDoc automatically converts quoted values:

| Input     | Extracted as       |
| -------   | --------------     |
| `'42'`    | `42` (number)      |
| `'3.14'`  | `3.14` (number)    |
| `'true'`  | `true` (boolean)   |
| `'false'` | `false` (boolean)  |
| `'hello'` | `"hello"` (string) |

---

## Named values

Extract values by name using the `<name:value>` syntax. This is more robust than positional extraction and makes the test code more readable.

```ts
given("a user with <name:John> and <age:30> years old", (ctx) => {
  const { name, age } = ctx.step.params;
  // name = "John", age = 30
});
```

### Key features:
- **Automatic Sanitization**: Spaces in names are removed (e.g., `<user name:John>` becomes `ctx.step.params.username`).
- **Type Coercion**: Values are automatically converted to numbers, booleans, or objects just like quoted values.
- **Raw Values**: Access the original string values via `ctx.step.paramsRaw`.
- **Reporter Support**: LiveDoc reporters automatically highlight the value part and hide the name/colon for a cleaner look.

---

## Data tables

Embed structured data directly in step titles:

### Row-based tables (array of objects)

```ts
given(`the following users exist
  | name  |       email       | role  |
  | Alice | alice@example.com | admin |
  | Bob   | bob@example.com   | user  |
`, (ctx) => {
  const users = ctx.step?.table;
  // [
  //   { name: "Alice", email: "alice@example.com", role: "admin" },
  //   { name: "Bob", email: "bob@example.com", role: "user" }
  // ]

  expect(users).toHaveLength(2);
  expect(users[0].name).toBe("Alice");
});
```

### Entity tables (two-column key-value)

When a table has exactly two columns, use `tableAsEntity`:

```ts
given(`a product with details
  | name  | Widget Pro |
  | price |      29.99 |
  | stock |        150 |
`, (ctx) => {
  const product = ctx.step?.tableAsEntity;
  // { name: "Widget Pro", price: "29.99", stock: "150" }

  expect(product.name).toBe("Widget Pro");
});
```

### Single-column lists

```ts
given(`the following tags
  | featured |
  | sale     |
  | new      |
`, (ctx) => {
  const tags = ctx.step?.tableAsSingleList;
  // ["featured", "sale", "new"]
});
```

---

## Doc strings

For multi-line content like JSON, XML, or text blocks:

```ts
given(`the API returns
  """
  {
    "id": 123,
    "name": "Test User",
    "active": true
  }
  """
`, (ctx) => {
  // Raw string
  const raw = ctx.step?.docString;
  
  // Parsed as JSON
  const data = ctx.step?.docStringAsEntity;
  // { id: 123, name: "Test User", active: true }

  expect(data.id).toBe(123);
});
```

### Non-JSON doc strings

For plain text, use `docString`:

```ts
when(`the user submits the following markdown
  """
  # Hello World

  This is a **test** document.
  """
`, (ctx) => {
  const markdown = ctx.step?.docString;
  expect(markdown).toContain("# Hello World");
});
```

---

## Scenario Outline examples

In `scenarioOutline`, access example data via `ctx.example`:

```ts
scenarioOutline(`Price calculation
  Examples:
  | quantity | unit_price | total |
  |        1 |      10.00 | 10.00 |
  |        5 |      10.00 | 50.00 |
  |        3 |       7.50 | 22.50 |
`, (ctx) => {
  given("a product priced at '<unit_price>'", () => {
    // Access via ctx.example
  });

  when("the user orders '<quantity>' units", () => {
    const qty = ctx.example?.quantity;
    const price = ctx.example?.unit_price;
  });

  then("the total is '<total>'", () => {
    const expected = ctx.example?.total;
    expect(calculateTotal()).toBe(Number(expected));
  });
});
```

### Multiple example tables

You can have multiple example tables with titles:

```ts
scenarioOutline(`Shipping rates
  Examples: Domestic
  | weight | rate  |
  |      1 |  5.00 |
  |      5 | 12.00 |

  Examples: International
  | weight | rate  |
  |      1 | 15.00 |
  |      5 | 35.00 |
`, (ctx) => {
  // Each row runs as a separate test
});
```

---

## Rule Outline examples

Same pattern works with `ruleOutline`:

```ts
ruleOutline(`Discount tiers
  Examples:
  | spend | discount |
  |    50 |        0 |
  |   100 |        5 |
  |   200 |       10 |
`, (ctx) => {
  const { spend, discount } = ctx.example;
  expect(getDiscount(Number(spend))).toBe(Number(discount));
});
```

---

## Tips and tricks

### Secondary binding with `{{...}}`

When you need to include **runtime values** in your step titles (for better test output), use double-brace binding:

```ts
scenario("Display user info in step title", () => {
  let user = { name: "" };

  given("we fetch the user from the API", () => {
    user = api.getCurrentUser();  // { name: "Alice" }
  });

  // The {{name}} placeholder is resolved when the step runs
  when("the user {{name}} performs an action", () => {
    // Step title will display: "the user Alice performs an action"
  }, () => ({ name: user.name }));  // Binding function
});
```

The third argument can be:
- **A function** that returns an object: `() => ({ name: user.name })`
- **An object** (if value is known at test-define time): `{ name: "Alice" }`

This is useful when you want to include dynamic data (fetched at runtime) in your step narration.

> ⚠️ The binding object/function must have a value when the step executes, or an error will be thrown.

### Combine tables with quoted values

```ts
given(`a user named 'Alice' with permissions
  | read  |
  | write |
`, (ctx) => {
  const name = ctx.step?.values?.[0];        // "Alice"
  const perms = ctx.step?.tableAsSingleList; // ["read", "write"]
});
```

### Access raw vs parsed

|           Property            |    Type    |          Use case          |
| ----------                    | ------     | ----------                 |
| `ctx.step?.values`            | `any[]`    | Quoted values (auto-typed) |
| `ctx.step?.table`             | `object[]` | Row-based data             |
| `ctx.step?.tableAsEntity`     | `object`   | Key-value pairs            |
| `ctx.step?.tableAsSingleList` | `string[]` | Simple lists               |
| `ctx.step?.docString`         | `string`   | Raw multi-line text        |
| `ctx.step?.docStringAsEntity` | `object`   | Parsed JSON                |

---

<div align="center">

[← BDD Authoring](./authoring-bdd.md) · [Tags & Filtering →](./tags-and-filtering.md)

</div>
