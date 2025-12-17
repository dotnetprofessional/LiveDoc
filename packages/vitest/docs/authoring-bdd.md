<div align="center">

# ✍️ BDD Authoring

### Features, Scenarios, and the Given-When-Then pattern

</div>

---

## The BDD pattern

Behavior-Driven Development structures tests as **user stories** with a clear three-act structure:

|  Keyword  |       Purpose        |            Example             |
| --------- | ---------            | ---------                      |
| **Given** | Set up preconditions | "Given a logged-in user"       |
| **When**  | Perform an action    | "When they click logout"       |
| **Then**  | Assert the outcome   | "Then they see the login page" |

LiveDoc brings this pattern to Vitest with full Gherkin support.

---

## Keywords reference

### `feature`

A feature groups related scenarios. It's the top-level container.

```ts
feature("Shopping Cart", () => {
  // scenarios go here
});
```

Features can include:
- A description (multi-line)
- Tags for filtering
- Backgrounds for shared setup
- Multiple scenarios

```ts
feature(`Shopping Cart @ecommerce
  As a customer
  I want to manage my shopping cart
  So that I can purchase items
`, () => {
  // ...
});
```

### `scenario`

A scenario is a single test case with Given/When/Then steps.

```ts
scenario("Adding an item to the cart", () => {
  given("an empty cart", () => { /* ... */ });
  when("the user adds a product", () => { /* ... */ });
  then("the cart contains 1 item", () => { /* ... */ });
});
```

### `background`

Background steps run before **every** scenario in a feature. Use them for common setup.

```ts
feature("User Profile", () => {
  background("User is logged in", () => {
    given("a registered user", () => {
      // This runs before every scenario
    });
  });

  scenario("View profile", () => {
    when("they visit /profile", () => { /* ... */ });
    then("they see their details", () => { /* ... */ });
  });

  scenario("Edit profile", () => {
    when("they update their name", () => { /* ... */ });
    then("the name is saved", () => { /* ... */ });
  });
});
```

> 💡 **Tip:** Keep backgrounds short. If setup is complex, consider helper functions.

### `afterBackground`

Need to clean up after each scenario? Use `ctx.afterBackground()` inside a background:

```ts
feature("Database tests", () => {
  let connection: DatabaseConnection;

  background("Database setup", (ctx) => {
    given("a database connection", () => {
      connection = openDatabase();
    });

    // This runs AFTER each scenario completes
    ctx.afterBackground(() => {
      connection.rollback();
      connection.close();
    });
  });

  scenario("Insert a record", () => {
    when("inserting data", () => { /* ... */ });
    then("the record exists", () => { /* ... */ });
    // afterBackground runs here, rolling back the insert
  });

  scenario("Update a record", () => {
    when("updating data", () => { /* ... */ });
    then("the record is updated", () => { /* ... */ });
    // afterBackground runs here too
  });
});
```

> 💡 Each feature gets its own isolated `afterBackground` handler—they don't leak between features.

### `scenarioOutline`

Run the same scenario with multiple data sets:

```ts
scenarioOutline(`Login validation
  Examples:
  | username | password | result  |
  | valid    | valid    | success |
  | valid    | wrong    | failure |
  | empty    | valid    | failure |
`, (ctx) => {
  given("a user enters '<username>' and '<password>'", () => {
    // ctx.example.username, ctx.example.password
  });

  when("they submit the form", () => { /* ... */ });

  then("the result is '<result>'", () => {
    // ctx.example.result
  });
});
```

See [Data Extraction](./data-extraction.md) for more on working with example data.

### Multiple example tables

You can group related examples with labeled tables:

```ts
scenarioOutline(`Feeding requirements by region

  Examples: Australian Cows
    | weight | energy | protein |
    |    450 |  26500 |     215 |
    |    500 |  29500 |     245 |

  Examples: New Zealand Cows  
    | weight | energy | protein |
    |   1450 |  46500 |    1215 |
    |   1500 |  49500 |    1245 |
`, (ctx) => {
  given("the cow weighs '<weight>' kg", () => { /* ... */ });
  // All rows from both tables are executed
});
```

The tables are merged at runtime, but the labels help document the intent.

---

## Step keywords

### `given`, `when`, `then`

The core triad:

```ts
given("a precondition", () => { /* setup */ });
when("an action happens", () => { /* do something */ });
then("an outcome occurs", () => { /* assert */ });
```

### `and`, `but`

Continue the previous step type:

```ts
given("a logged-in user", () => { /* ... */ });
and("they have items in their cart", () => { /* ... */ });
and("they have a valid payment method", () => { /* ... */ });

when("they click checkout", () => { /* ... */ });

then("the order is placed", () => { /* ... */ });
but("they are not charged until shipping", () => { /* ... */ });
```

---

## The `ctx` parameter

Every callback receives a context object with metadata:

```ts
scenario("Example", (ctx) => {
  console.log(ctx.scenario?.title);  // "Example"
  console.log(ctx.feature?.title);   // Parent feature title

  given("a step with 'quoted' values", (ctx) => {
    console.log(ctx.step?.values);   // ["quoted"]
    console.log(ctx.step?.title);    // "a step with 'quoted' values"
  });
});
```

### Context properties

|     Property     |   Available in   |                  Contains                  |
| ----------       | --------------   | ----------                                 |
| `ctx.feature`    | All callbacks    | Feature title, description, tags, filename |
| `ctx.scenario`   | Scenario + steps | Scenario title, description, tags          |
| `ctx.step`       | Step callbacks   | Step title, values, table, docString       |
| `ctx.example`    | Scenario outline | Current example row data                   |
| `ctx.background` | Background steps | Background title                           |

---

## Skip and only

Focus or skip tests using modifiers:

```ts
// Skip this scenario
scenario.skip("Not ready yet", () => { /* ... */ });

// Run only this scenario
scenario.only("Debugging this one", () => { /* ... */ });

// Works on features too
feature.skip("Disabled feature", () => { /* ... */ });
feature.only("Focus on this", () => { /* ... */ });
```

---

## Best practices

### 1. Keep steps declarative

```ts
// ✅ Good - describes intent
given("a user with admin privileges", () => { /* ... */ });

// ❌ Avoid - implementation details in the title
given("INSERT INTO users VALUES ('admin', 'password')", () => { /* ... */ });
```

### 2. One action per When

```ts
// ✅ Good
when("the user clicks submit", () => { /* ... */ });

// ❌ Avoid - multiple actions
when("the user fills the form and clicks submit and waits", () => { /* ... */ });
```

### 3. Make assertions explicit

```ts
// ✅ Good - clear expectation
then("the error message says 'Invalid email'", () => { /* ... */ });

// ❌ Avoid - vague
then("an error appears", () => { /* ... */ });
```

### 4. Use data in step titles

Put test values in the step title so documentation is self-explanatory:

```ts
// ✅ Good - data visible in output
given("the user has '$50' in their account", (ctx) => {
  const amount = ctx.step?.values?.[0];  // 50
});

// ❌ Avoid - hidden data
given("the user has money", () => {
  const amount = 50;  // Hidden from documentation
});
```

---

<div align="center">

[← Back to Docs](./index.md) · [Data Extraction →](./data-extraction.md)

</div>
