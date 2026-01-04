# LiveDoc Vitest BRD

> **Deprecation Notice**: This document supersedes all previous implementation status and backlog documents for `@livedoc/vitest`.

## Overview
LiveDoc Vitest is the core testing framework that allows developers to write executable specifications using BDD (Behavior Driven Development) patterns. It turns technical tests into a "Living Documentation" source that can be understood by both developers and business stakeholders.

## Features

|           Feature            |   Status   |              Reference              |
| :---                         | :---       | :---                                |
| **BDD Language Support**     | ✅ Done     | [Details](#bdd-language-support)    |
| **Scenario Outlines**        | ✅ Done     | [Details](#scenario-outlines)       |
| **Background Setup**         | ✅ Done     | [Details](#background-setup)        |
| **Data Tables & DocStrings** | ✅ Done     | [Details](#data-tables--docstrings) |
| **Tag-Based Filtering**      | ⚠️ Partial | [Details](#tag-based-filtering)     |
| **Named Step Values**        | ✅ Done     | [Details](#named-step-values)       |
| **Streaming Reporting**      | ⚠️ Partial | [Details](#streaming-reporting)     |
| **Gherkin-Style Output**     | ✅ Done     | [Details](#gherkin-style-output)    |
| **UI Polish & Prefixes**     | ✅ Done     | [Details](#ui-polish--prefixes)     |

## Feature Details

### BDD Language Support
Developers can write tests using the standard Gherkin language keywords: `Feature`, `Scenario`, `Given`, `When`, `Then`, `And`, and `But`. This ensures that tests are written in a way that describes business behavior rather than technical implementation details.

**Sample:**
```typescript
feature("User Authentication", () => {
  scenario("Successful login with valid credentials", () => {
    Given("the user is on the login page");
    When("the user enters valid credentials");
    Then("the user should be redirected to the dashboard");
  });
});
```

### Scenario Outlines
Allows a single scenario template to be run multiple times with different sets of data provided in an "Examples" table. This is ideal for testing complex business rules with many variations without duplicating test code.

> **Current Status**: ✅ Done.

**Sample:**
```typescript
scenarioOutline("Calculate shipping costs", () => {
  Given("the customer is from <country>");
  When("the order total is <total>");
  Then("the shipping cost should be <cost>");

  examples(`
    |  country  | total | cost |
    | Australia |   100 |   10 |
    | USA       |   100 |   20 |
  `);
});
```

#### BUG: Background not showing for Features - Fixed
Example: Background.Spec.ts

1. Remove the background from the top level list of scenarios screen
2. Move the background from the scenario list screen to the scenario detail screen.

Expected:
```
  Feature: Background statement
    Background statements are used to define a common given that is
    applied to each scenario. The background is executed before each scenario
 
    Background: This will be executed before each test
      √ given somevalue = '30'
      √   and we add '70' to somevalue
      √   and the stepContext is available so should get '10' from this step
      √   and afterBackgroundCheck has '10' added to it
```

Actual:
```
  Feature: Background statement
    Background: This will be executed before each test
    Background statements are used to define a common given that is
    applied to each scenario. The background is executed before each scenario

     √ given somevalue = '30'
      √   and we add '70' to somevalue
      √   and the stepContext is available so should get '10' from this step
      √   and afterBackgroundCheck has '10' added to it
```

#### BUG: Background extended descriptions not rendered - Not Fixed
Example: Background_Keyword/Background_suports_Scenario_Outline.Spec.ts

The table is missing from the Scenario Outline. The template is updated correctly when a row is selected.

Expected
```
  Feature: Background works with Scenario Outlines
 
    Background: Validate afterBackground
      √ given afterBackgroundCheck has 10 added to it

    Scenario Outline: given the following items
      @filter:background-test
       given this is <col1>
       when the background executes
       then afterBackgroundCheck should be '10'

        Examples:
        ┌───┬──────┐
        │   │ col1 │
        ├───┼──────┤
        │ 1 │ row1 │
        ├───┼──────┤
        │ 2 │ row2 │
        ├───┼──────┤
        │ 3 │ row3 │
        ├───┼──────┤
        │ 4 │ row4 │
        └───┴──────┘
```

Actual
```
  Feature: Background works with Scenario Outlines
 
    Background: Validate afterBackground
      √ given afterBackgroundCheck has 10 added to it

    Scenario Outline: given the following items
      @filter:background-test
       given this is <col1>
       when the background executes
       then afterBackgroundCheck should be '10'

        Examples:
        ┌───┬──────┐
        │   │ col1 │
        ├───┼──────┤
        │ 1 │ row1 │
        ├───┼──────┤
        │ 2 │ row2 │
        ├───┼──────┤
        │ 3 │ row3 │
        ├───┼──────┤
        │ 4 │ row4 │
        └───┴──────┘
```


#### BUG: Value placeholders not highlighted for Features - Fixed
Example: Background.Spec.ts
```
    Scenario: Add 10 to someValue
      √ when someValue is increased by '10'
      √ then someValue should be '110'
      √   and afterBackgroundCheck should be '10'
```

The values 10, 110, 10 from when, then and should be highlighted but they are not. Note this is from an example using a background so no then. Then should also be highlighted.

#### BUG: Inconsistent formatting between Scenario and Scenario Outline - Fixed
Example: Sample/Tutorial/Tutorial.Spec.ts

The rendering of a Scenario Outline good, the only thing wrong is that the indentation differs from the Scenario. This suggests different formatters for each. The only thing that needs fixing is the indentation of and/but steps after a Given/When/Then. Otherwise for a passing test it looks good. Ensure the Scenario matches the look of the Outline so we dont have two visuals.

#### BUG: Difficulty knowing if you're looking at a Feature/Scenario/Specification etc. - Not Fixed
Unlike the text reporter, there is no indicator that a title is a Feature/Scenario/Specification etc. The reporter should follow the same naming as the text reporter. This provides clear indiction of what the user is reading.

#### BUG: Step descriptions are not rendered - Not Fixed
Example: Vitest_Features/Describe_still_is_supported.Spec.ts

The descriptions of all keywords, Feature/Scenario/Specification/Given/When/Then etc. Should be rendered correctly.

Expected:
```
    Scenario: Various suite features work as expected
      √ given the following vitest file
          """
          import { describe, it, test } from 'vitest';
          // Vitest uses the describe block as the top-level suite (no separate root suite like Mocha)
          describe("Describe still functions the same as native vitest", () => {
              it("throwing exception in it will result in fail", () => {
                  throw new TypeError("Bail...");
              });
              describe("a nested describe", () => {
                  it("will execute and pass", () => {
                  });
                  it.skip("will be skipped and marked as pending", () => {
                      throw new Error("I shouldn't have been executed!!");
                  });
                  describe("another nested describe", () => {
                      test("test works like it", () => {
                      });
                  })
              })
          });
          """
      √ when the test is executed
      √ then '1' top level suites are processed
      √   and the it for the first describe is marked as fail
      √   and the first it for the second level describe is marked as pass
      √   and the second it for the second level describe is marked as pending
      √   and the first test for the third level describe is marked as pass
```

Actual:
```
    Scenario: Various suite features work as expected
      √ given the following vitest file
          """
          import { describe, it, test } from 'vitest';
          // Vitest uses the describe block as the top-level suite (no separate root suite like Mocha)
          describe("Describe still functions the same as native vitest", () => {
              it("throwing exception in it will result in fail", () => {
                  throw new TypeError("Bail...");
              });
              describe("a nested describe", () => {
                  it("will execute and pass", () => {
                  });
                  it.skip("will be skipped and marked as pending", () => {
                      throw new Error("I shouldn't have been executed!!");
                  });
                  describe("another nested describe", () => {
                      test("test works like it", () => {
                      });
                  })
              })
          });
          """
      √ when the test is executed
      √ then '1' top level suites are processed
      √   and the it for the first describe is marked as fail
      √   and the first it for the second level describe is marked as pass
      √   and the second it for the second level describe is marked as pending
      √   and the first test for the third level describe is marked as pass
```

### Background Setup
Provides a way to define common setup steps that run before every scenario in a feature. This keeps individual scenarios focused on their specific behavior while ensuring the system is in the correct state.

**Sample:**
```typescript
feature("Shopping Cart", () => {
  background(() => {
    Given("the user is logged in");
    And("the user has a clean shopping cart");
  });

  scenario("Adding an item", () => { ... });
});
```

### Data Tables & DocStrings
LiveDoc supports Gherkin data tables and docstrings, allowing you to pass complex data structures or large blocks of text directly to your steps.

**Sample:**
```typescript
Given("the following users exist:", (ctx) => {
  const users = ctx.step.table; // Access as array of objects
});

And("the user receives the following email:", (ctx) => {
  const emailBody = ctx.step.docString; // Access as string
});
```

### Tag-Based Filtering
Allows features and scenarios to be categorized with tags (e.g., `@smoke`, `@regression`, `@slow`). Teams can then choose to run only specific subsets of tests based on these tags, which is useful for fast feedback loops or CI/CD pipelines.

> **Current Status**: Partial. Basic support for `@skip` and `@only` tags exists in the DSL. Full integration with Vitest's native tag filtering and CLI is currently in the backlog.

**Sample:**
```typescript
feature("@smoke @auth User Authentication", () => {
  scenario("@critical Successful login", () => { ... });
});
```

### Named Step Values
Enables extracting specific values directly from step titles using a `<name:value>` syntax. This makes test data visible in the documentation while allowing the test code to access it easily via parameters.

**Sample:**
```typescript
Given("the user has <count:5> items in their cart", (ctx) => {
  const count = ctx.step.params.count; // returns 5
});
```

### Streaming Reporting
Sends test results to the LiveDoc server as they are executed. This enables real-time visualization of test progress in the Viewer.

> **Current Status**: Partial. The `LiveDocServerReporter` currently uses a "batch mitigation" strategy, sending the complete test run at the end of execution to ensure data consistency (especially for Scenario Outlines). True incremental streaming is planned.

### Gherkin-Style Output
Provides a clean, readable console output that follows the Gherkin structure, making it easy to see exactly which business rules are being tested and their current status.

> **Current Status**: Done. Implemented via `LiveDocVitestReporter` and `LiveDocSpecReporter`.
