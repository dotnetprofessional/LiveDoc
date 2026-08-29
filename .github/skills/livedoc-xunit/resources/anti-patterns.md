# LiveDoc xUnit Anti-Patterns

| Anti-pattern | Symptom | Correction |
| --- | --- | --- |
| Direct implementation call for an HTTP claim | Test bypasses binding, middleware, or serialization | Use a test host or public HTTP boundary |
| Literal against itself | Expected and actual come from the same value | Use an independent oracle |
| Missing-subject success | Helper returns true when data is absent | Assert required presence first |
| Guard-clause green | Method returns before `Assert` | Fail fast on invalid fixture state |
| Fixed sleep | `Task.Delay` is used for readiness or concurrency | Use readiness probes, `TimeProvider`, gates, or barriers |
| Shared mutable fixture | Test passes only after another test | Isolate or reset state explicitly |
| Leaked process/port | Owned service survives the test | Bound cleanup and terminate owned process trees |
| Field-picking contract | Only known fields are asserted | Compare the complete payload with explicit rules |
| Development-history title | Test names a bug, revision, or team member | State the current requirement |
| Multi-case loop | Many independent cases produce one failure | Use `[RuleOutline]` or `[ScenarioOutline]` |
| Repeated primary Gherkin step | A Scenario uses multiple Given, When, or Then calls | Keep one of each and use And/But for continuations |
| Incomplete Gherkin flow | A Scenario omits Given, When, or Then | State the precondition, action, and expected outcome explicitly |
| Secret in output | Credential value enters title, exception, attachment, or report | Assert absence and report paths only |
| Screenshot-only proof | Evidence exists without a behavioral assertion | Assert first, attach second |
