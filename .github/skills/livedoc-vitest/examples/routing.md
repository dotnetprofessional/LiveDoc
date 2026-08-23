# LiveDoc Vitest Skill — Routing Examples

## Positive routing (USE this skill)

### Example 1: Create a new BDD feature spec
> "Create a test for the shopping cart checkout flow"

→ This involves writing a `.Spec.ts` file using `feature`, `scenario`, `given`/`when`/`then` from `@swedevtools/livedoc-vitest`.

### Example 2: Add a scenario outline with examples
> "Add data-driven tests for email validation"

→ This involves using `scenarioOutline` or `ruleOutline` with an Examples table and `ctx.example`.

### Example 3: Fix value extraction in a step
> "The step says '500' but the test uses 200 — fix the value drift"

→ This involves replacing hardcoded values with `ctx.step.values[0]` or `ctx.step.params`.

### Example 4: Convert a plain vitest test to LiveDoc specification pattern
> "Rewrite these unit tests as a LiveDoc specification with rules"

→ This involves using `specification` and `rule`/`ruleOutline` from `@swedevtools/livedoc-vitest`.

### Example 5: Modify an existing spec file
> "Add a new scenario to UserAuth.Spec.ts for password reset"

→ This involves editing an existing `.Spec.ts` file using the correct LiveDoc patterns.

### Example 6: Write a browser test with Playwright
> "Write a Playwright test that checks the viewer homepage loads correctly"

→ Read `resources/web-testing.md` to confirm a real browser is required, then use `useBrowser` and `screenshot` from `@swedevtools/livedoc-vitest/playwright`. Assert behavior before attaching evidence.

### Example 7: Verify responsive browser geometry
> "Verify that the mobile action exposes at least a 44px touch target"

→ Use a real browser and measure rendered geometry. A jsdom assertion or CSS class check cannot observe this claim.

### Example 8: Validate an incremental change by tag
> "Run only the checkout and pricing behavior and patch the Viewer"

→ Read `resources/partial-testing.md`. Select `@checkout` and `@pricing`, publish the invocation as `partial`, and preserve the latest full baseline.

## Negative routing (DO NOT use this skill)

### Example 1: Writing a C# xUnit test
> "Create a test for the shipping calculator in C#"

→ Use the `livedoc-xunit` skill instead. This skill is TypeScript-only.

### Example 2: Building UI components
> "Create a React component for the test results viewer"

→ This is UI work, not test authoring. Use the `frontend-design` skill instead.

### Example 3: Plain vitest without LiveDoc
> "Write a vitest test for this utility function using describe/it"

→ This skill is for LiveDoc BDD/Specification patterns. Plain vitest tests don't need it.

### Example 4: Fixing build or config issues
> "The vitest config won't load, fix it"

→ This is build infrastructure, not test authoring. Handle directly without this skill.

### Example 5: Installing AI skills or generating static reports
> "Install the LiveDoc AI skill for my team" or "Generate a static HTML report"

→ These are setup/ops tasks. Run `npx livedoc-vitest-setup` for skills or `npx livedoc-viewer export -i results.json` for reports. Not test authoring.

### Example 6: Converting every low-level test
> "Convert the entire Vitest suite to LiveDoc"

→ Do not convert tests mechanically. Apply the two-question litmus in `resources/test-strategy.md` and keep tests without lasting documentation value in native Vitest.
