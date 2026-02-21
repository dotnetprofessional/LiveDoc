# LiveDoc xUnit Skill — Routing Examples

## Positive routing (USE this skill)

### Example 1: Create a new BDD feature test in C#
> "Create a C# test for the shipping cost calculator"

→ This involves writing a class inheriting `FeatureTest` with `[Feature]`, `[Scenario]`, and Given/When/Then steps.

### Example 2: Add a ScenarioOutline with Examples
> "Add data-driven tests for tax calculation across countries"

→ This involves using `[ScenarioOutline]`, `[Example]` attributes, and `<placeholder>` replacement.

### Example 3: Fix value extraction in a step
> "The step says '500' but the assertion checks 200 — fix it"

→ This involves replacing hardcoded values with `ctx.Step!.Values[0].AsInt()` or `ctx.Step!.Params["name"].AsInt()`.

### Example 4: Write a Specification with Rules
> "Create a specification for the email validator"

→ This involves using `[Specification]`, `[Rule]`/`[RuleOutline]`, and inheriting from `SpecificationTest`.

### Example 5: Convert plain xUnit tests to LiveDoc
> "Rewrite these Fact/Theory tests as LiveDoc BDD tests"

→ This involves replacing `[Fact]`/`[Theory]` with `[Scenario]`/`[ScenarioOutline]` and adding Given/When/Then structure.

### Example 6: Add method name placeholders
> "Create a RuleOutline that uses method name parameters instead of a display string"

→ This involves using `_ALLCAPS` syntax in method names matched to parameters.

## Negative routing (DO NOT use this skill)

### Example 1: Writing a TypeScript Vitest test
> "Create a spec for the parser in TypeScript"

→ Use the `livedoc-vitest` skill instead. This skill is C#/.NET only.

### Example 2: Building UI components
> "Create a React component for displaying test results"

→ This is UI work, not test authoring. Use the `frontend-design` skill instead.

### Example 3: Plain xUnit without LiveDoc
> "Write a simple Fact test for this utility class"

→ This skill is for LiveDoc BDD/Specification patterns. Plain xUnit tests don't need it.

### Example 4: Fixing build or project configuration
> "The .csproj file has a wrong package reference, fix it"

→ This is build infrastructure, not test authoring. Handle directly without this skill.

### Example 5: Working on the LiveDoc framework itself
> "Fix a bug in the LiveDocContext class"

→ This is framework development, not test authoring. Work on it directly.
