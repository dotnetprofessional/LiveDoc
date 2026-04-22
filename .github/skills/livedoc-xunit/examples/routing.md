# LiveDoc xUnit Skill — Routing Examples

## Positive routing (USE this skill)

### Example 1: Create a new BDD feature
> "Create a test for the shipping costs business rules"

→ Read `resources/features.md`. Write a class inheriting `FeatureTest` with `[Feature]`/`[Scenario]`, embedding all values in step titles.

### Example 2: Add a ScenarioOutline with Examples
> "Add data-driven tests for tax calculation across countries"

→ Read `resources/features.md`. Use `[ScenarioOutline]`, `[Example]` attributes with typed method parameters and `<placeholder>` titles.

### Example 3: Fix value extraction
> "The step says '500' but the code checks 200 — fix the value drift"

→ Replace hardcoded values with `ctx.Step!.Values[0].AsInt()` (Features) or `Rule.Values[0].AsInt()` (Specifications) extracted from the title.

### Example 4: Write a Specification with Rules
> "Write unit tests for the email validator as a specification"

→ Read `resources/specifications.md`. Use `[Specification]`/`[Rule]`/`[RuleOutline]` with `SpecificationTest` base class and `Rule.Values`.

### Example 5: Create an HTTP journey for an API
> "Create end-to-end journey tests for the Users API"

→ Read `resources/journey-testing.md`. Write `.http` file with BDD annotations, add `.Response.json` contracts.

### Example 6: Set up journey testing
> "Enable journey scaffolding in my test project"

→ Read `resources/journey-testing.md`. Add MSBuild properties, create journeys folder, configure `http-client.env.json`.

## Negative routing (DO NOT use this skill)

### Example 1: Writing a TypeScript spec
> "Create a test for the parser in TypeScript"

→ Use the `livedoc-vitest` skill instead. This skill is C#/.NET only.

### Example 2: Building UI components
> "Create a React component for the test results viewer"

→ This is UI work, not test authoring. Use the `frontend-design` skill instead.

### Example 3: Plain xUnit without LiveDoc
> "Write a simple xUnit Fact test for this utility"

→ This skill is for LiveDoc BDD/Specification patterns. Plain xUnit tests don't need it.

### Example 4: Fixing framework internals
> "Fix a bug in the LiveDocContext class"

→ This is framework development, not test authoring. Handle directly without this skill.
