# LiveDoc-Vitest Backlog

This file tracks features, improvements, and issues for the livedoc-vitest package.

## High Priority

### Scenario Outline Header Shows Bound Values Instead of Template
- **Status**: Bug
- **Description**: When outputting a Scenario Outline, the header section should show the template with `<placeholders>` (e.g., `given the customer is from <country>`), but currently it shows the bound values from the first example (e.g., `given the customer is from Australia`).
- **Expected Output**:
  ```
  Scenario Outline: Calculate GST status and shipping rate
     given the customer is from <country>
     when the customer's order totals <order total>
     then the customer pays <GST amount> GST
       and they are charged the <shipping rate> shipping rate
  ```
- **Actual Output**:
  ```
  Scenario Outline: Calculate GST status and shipping rate
     given the customer is from Australia
     when the customer's order totals 99.99
     then the customer pays 9.999 GST
       and they are charged the Standard Domestic shipping rate
  ```
- **Related Files**: Reporter code that outputs Scenario Outline template steps

### Tag-Based Test Filtering
- **Status**: Not Implemented
- **Description**: Support filtering tests by their tags (e.g., `@dynamic`, `@slow`, `@integration`)
- **Use Case**: Tests tagged with `@dynamic` use `executeDynamicTestAsync` which spawns a subprocess. When running in non-dynamic context (e.g., via `vitest.config.nodynamic.ts`), these tests should be automatically skipped rather than requiring separate config files.
- **Implementation Ideas**:
  1. Check for a global flag or environment variable that indicates dynamic execution is not available
  2. Tests with `@dynamic` tag could check this flag and skip themselves
  3. Could leverage Vitest's native tag filtering if available
- **Related Files**:
  - `vitest.config.nodynamic.ts` - Current workaround using file exclusions
  - `livedoc.ts` - `executeDynamicTestAsync` method

## Medium Priority

### Exit Code 1 Investigation
- **Status**: Resolved (was temp file left over)
- **Description**: Tests were passing but exit code was 1 due to leftover `temp-test.Spec.ts` file in test directory.
- **Resolution**: Removed the temp file. Consider adding `.gitignore` pattern or cleanup mechanism.

## Low Priority

### Dynamic Test Cleanup
- **Status**: Partially Implemented
- **Description**: `executeDynamicTestAsync` creates temp files (`livedoc*.Spec.ts`, `vitest-results-*.json`, `vitest-error-*.json`) that should be cleaned up after tests complete.
- **Current State**: Files are created with unique random suffixes to avoid collision, but cleanup happens in finally block. Could add more robust cleanup.

## Completed

### Test Isolation Issue
- **Date Completed**: 2025-01-XX
- **Description**: Dynamic tests were sharing temp file names causing race conditions when run in parallel.
- **Solution**: Added random suffix to all temp file names (`livedoc${randomValue}.Spec.ts`).

### Step Status Not Serialized
- **Date Completed**: 2025-01-XX  
- **Description**: `StepDefinition.toJSON()` was not including `status` from parent class.
- **Solution**: Added `...super.toJSON()` to `StepDefinition.toJSON()`.

### ScenarioOutline Reconstruction
- **Date Completed**: 2025-01-XX
- **Description**: When reconstructing from subprocess results, ScenarioOutline `tables` and `examples` were not being restored.
- **Solution**: Added proper reconstruction logic in `reconstructScenario` method.

### Named Step Values (keyed value extraction)
- **Date Completed**: 2025-12-21
- **Description**: Support named values in step titles using `<name:value>` syntax, accessible via `ctx.step.params.<name>`.
- **Solution**: Updated `DescriptionParser` to extract named values and `StepDefinition`/`StepContext` to expose them via `params`.

---

## Test Migration Progress

Tracking progress migrating from livedoc-mocha to livedoc-vitest:

|  Config   |  Pass  |  Fail  |  Skip  |              Notes               |
| --------  | ------ | ------ | ------ | -------                          |
| nodynamic |    241 |      0 |      6 | Non-dynamic tests only           |
| full      | TBD    | TBD    | TBD    | Includes dynamic execution tests |

### Dynamic Test Files Status
- [ ] DynamicExecution tests
- [ ] Rule Violations tests  
- [ ] Reporter tests
- [ ] Filtering tests
- [ ] Vitest Features tests
- [ ] Background Keyword tests (async variants)
