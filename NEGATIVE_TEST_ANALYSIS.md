# Negative Test Case Patterns in LiveDoc: Vitest, xUnit, and Mocha

This analysis documents how three test frameworks handle "negative test cases" — tests that validate violations by running tests in isolation and asserting they fail.

## 1. VITEST APPROACH: Dynamic Test Execution

### Key Pattern: `executeDynamicTestAsync()`
**Location:** `D:\private\LiveDoc\packages\vitest\_src\app\livedoc.ts` (lines ~1460-1800)

Vitest uses a subprocess-based dynamic executor that:
1. Takes feature code as a string
2. Writes it to a temporary file with unique random filename
3. Spawns an isolated Vitest subprocess with `startVitest()`
4. Captures results via custom **SilentReporter** and JSON file serialization
5. Reconstructs model objects from JSON data
6. Re-throws any captured violations to parent context

### SilentReporter (Silent Execution Capture)
**Location:** `D:\private\LiveDoc\packages\vitest\_src\app\reporter\SilentReporter.ts`

The SilentReporter implements the Vitest Reporter interface:
- Captures errors from `onCollected()` hook
- Captures additional errors from `onFinished()` hook
- Stores all errors in `collectedErrors` array
- Provides no console output (silent mode)

### Rule Violations
**Location:** `D:\private\LiveDoc\packages\vitest\_src\app\model\LiveDocRuleViolation.ts`

LiveDocRuleViolation class:
- Extends Error
- Includes: rule (enum), message, title, errorId (auto-incrementing)
- Serializable to JSON

**Violation Types** (from RuleViolations.ts enum):
- error, missingFeature, givenWhenThenMustBeWithinScenario
- singleGivenWhenThen, mustIncludeGiven/When/Then
- andButMustHaveGivenWhenThen, mustNotMixLanguages
- backgroundMustOnlyIncludeGiven, enforceUsingGivenOverBefore, enforceTitle

### Usage Pattern
```typescript
when(`executing feature`, async () => {
    try {
        await LiveDoc.executeDynamicTestAsync(featureCode, options);
    }
    catch (e) {
        violation = e;  // Captured violation for assertion
    }
});

then(`a rule violation is thrown`, () => {
    violation.message.should.eql(expectedMessage);
});
```

---

## 2. XUNIT APPROACH: Test Case Discovery with ExecutionErrorTestCase

### Overview
xUnit uses a **test discovery pattern** that validates violations at compile-time and creates special failing test cases.

### Key Pattern: Paradigm Validation
**Location:** `D:\private\LiveDoc\dotnet\xunit\src\Attributes\LiveDocParadigmValidator.cs`

The ValidateGherkinMethod() function checks:
- [Scenario]/[ScenarioOutline] has [Feature] on class
- [Feature] has explicit (non-empty) title
- [Feature] and [Specification] aren't both present
- Returns `LiveDocViolationException` if invalid, null if valid

Similar `ValidateSpecificationMethod()` validates [Rule]/[RuleOutline] with [Specification].

### Violation Test Case Creation
```csharp
public static IXunitTestCase CreateViolationTestCase(
    IMessageSink diagnosticMessageSink,
    ITestMethod testMethod,
    LiveDocViolationException violation)
{
    return new ExecutionErrorTestCase(
        diagnosticMessageSink,
        TestMethodDisplay.Method,
        TestMethodDisplayOptions.None,
        testMethod,
        violation.Message);
}
```

**Key Point:** ExecutionErrorTestCase is a built-in xUnit v2 type that represents a test case that fails immediately with a given error message.

### Test Case Discoverers
**Locations:**
- ScenarioTestCaseDiscoverer - validates [Scenario] with [Feature]
- RuleTestCaseDiscoverer - validates [Rule] with [Specification]
- ScenarioOutlineTestCaseDiscoverer - creates XunitTheoryTestCase
- RuleOutlineTestCaseDiscoverer - creates XunitTheoryTestCase

If validation fails, discoverer yields `ExecutionErrorTestCase` instead of normal test case.

### How It Works at Test Time
1. **Discovery Phase:** Each discoverer calls ValidateGherkinMethod() or ValidateSpecificationMethod()
2. **If Violation:** Creates ExecutionErrorTestCase that will fail when run
3. **If Valid:** Creates normal XunitTestCase or theory test case
4. **Execution:** Test runner executes all discovered test cases; violations fail with message in Test Explorer

### Violation Exception Types
**Location:** `D:\private\LiveDoc\dotnet\xunit\src\Core\LiveDocViolationException.cs`

ViolationType enum:
- ScenarioWithoutFeature - [Scenario] without [Feature]
- RuleWithoutSpecification - [Rule] without [Specification]
- ScenarioInSpecification - [Scenario] in [Specification] class
- RuleInFeature - [Rule] in [Feature] class
- MixedClassAttributes - Both [Feature] and [Specification]
- FeatureMissingTitle - [Feature] missing explicit title

### Advantages
- Native xUnit mechanism
- Discovered tests appear in Test Explorer immediately
- No subprocess needed (easier debugging)
- Compile-time validation
- Violations are part of normal test tree

---

## 3. MOCHA REFERENCE: Dynamic Test Execution (Archived)

**Location:** `D:\private\LiveDoc\_archive\livedoc-mocha/_src/test/Rule Violations/`

The Mocha version used similar dynamic execution pattern:

### Testing Pattern
```typescript
when(`executing feature`, async () => {
    try {
        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString, ruleOptions);
    }
    catch (e) {
        violation = e;
    }
});

then(`a rule violation with description is thrown`, () => {
    stepContext.docString.should.eql(violation.message);
});
```

### Test Files
- Enforce_mocha_limitations.Spec.ts - Tests async keyword restrictions
- Validate_step_rules.Spec.ts - Tests step composition rules  
- Ensure_correctly_structured_Specs.Spec.ts - Tests BDD structure rules

---

## 4. COMPARISON

| Aspect | Vitest | xUnit | Mocha |
|--------|--------|-------|-------|
| **Mechanism** | Subprocess + SilentReporter | Test Discovery + ExecutionErrorTestCase | Subprocess (archived) |
| **When Checked** | Runtime (each execution) | Compile-time (discovery) | Runtime (each execution) |
| **Violation Reporting** | Throws from subprocess | Fails test in explorer | Throws from subprocess |
| **Debuggability** | Harder (separate process) | Easier (single process) | Harder (separate process) |
| **Test Case Type** | ExecutionResults object | ExecutionErrorTestCase | ExecutionResults object |
| **Isolation** | Complete (separate process) | Partial (same process) | Complete (separate process) |

---

## 5. KEY ARCHITECTURAL INSIGHTS FOR XUNIT

### Why xUnit Uses ExecutionErrorTestCase

1. **Test Discovery Separation:** xUnit separates discovery from execution
   - Discoverers (IXunitTestCaseDiscoverer) run at startup
   - They can create any IXunitTestCase implementation

2. **ExecutionErrorTestCase Benefits:**
   - Discovered tests appear in Test Explorer immediately
   - Failures shown in standard xUnit output
   - No special reporting needed
   - IDE integrations work automatically
   - Can run tests programmatically and inspect results

3. **Custom Test Runners:** LiveDoc extends runner hierarchy:
   - LiveDocTestInvoker - Injects example data
   - LiveDocTestRunner - Custom invocation
   - LiveDocTestCaseRunner - Custom test case execution
   - LiveDocTheoryTestCaseRunner - Custom theory execution

### Recommended: Use ExecutionErrorTestCase Pattern

**Pros:**
- Native xUnit mechanism
- Appears in Test Explorer
- No special infrastructure needed
- Compile-time validation
- Already implemented and working

**Status:** Already in place via LiveDocParadigmValidator in all discoverers

---

## 6. FILES REFERENCED

### Vitest
- D:\private\LiveDoc\packages\vitest\_src\app\livedoc.ts (lines 1460-1800)
- D:\private\LiveDoc\packages\vitest\_src\app\model\LiveDocRuleViolation.ts
- D:\private\LiveDoc\packages\vitest\_src\app\model\RuleViolations.ts
- D:\private\LiveDoc\packages\vitest\_src\app\reporter\SilentReporter.ts

### xUnit  
- D:\private\LiveDoc\dotnet\xunit\src\Attributes\LiveDocParadigmValidator.cs
- D:\private\LiveDoc\dotnet\xunit\src\Attributes\ScenarioTestCaseDiscoverer.cs
- D:\private\LiveDoc\dotnet\xunit\src\Attributes\RuleTestCaseDiscoverer.cs
- D:\private\LiveDoc\dotnet\xunit\src\Attributes\ScenarioOutlineTestCaseDiscoverer.cs
- D:\private\LiveDoc\dotnet\xunit\src\Attributes\RuleOutlineTestCaseDiscoverer.cs
- D:\private\LiveDoc\dotnet\xunit\src\Core\LiveDocViolationException.cs
- D:\private\LiveDoc\dotnet\xunit\src\Attributes\LiveDocTestCases.cs

### Mocha (Archived)
- D:\private\LiveDoc\_archive\livedoc-mocha/_src/test/Rule Violations/*
