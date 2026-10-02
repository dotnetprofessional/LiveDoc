# LiveDoc Test Anti-Patterns

Use this catalogue during review. These patterns are warnings, not blind syntax
bans; judge whether the assertion protects an implementation-independent promise.

| Anti-pattern | Symptom | Correction |
| --- | --- | --- |
| Class-name proxy | `toHaveClass('h-7')` stands in for size or layout | Measure the promise in a browser |
| Literal against itself | `expect(value).toBe(value)` | Derive expected and actual independently |
| Provably constant assertion | Algebra reduces to an unconditional truth | Use a defect-sensitive bound or oracle |
| Null-tolerant helper | Missing element returns success | Treat missing required subjects as failure |
| Guard-clause green | `if (!subject) return` skips the assertion | Assert presence before behavior |
| Filtered failure array | Known categories are removed before asserting empty | Classify failures explicitly; fail unknown categories |
| Implementation title | Step names classes, helpers, or internal flags | Name user-visible behavior or technical contract |
| Development-history title | Names rounds, team members, or retired behavior | State the current requirement |
| Multi-case loop | Many meaningful combinations fail as one row | Use an outline with one row per claim |
| Inventory description | Feature/Specification text lists cases instead of explaining purpose | Explain why the tested behavior matters; leave proof in scenarios and Rules |
| Unproven outcome | Description promises delivery, UI display, or compliance from a narrower test | Limit claims to the observable boundary |
| Secret in documentation | Credential-shaped values enter titles, logs, or attachments | Use safe placeholders and absence assertions |
| Unreviewed API exchange | Raw headers or an unfiltered response enter an attachment | Attach only reviewed, non-sensitive request and response fields |
| Screenshot-only proof | Image is attached with no behavioral assertion | Assert behavior; attach sanitized evidence before a possible failure or after success |
| Fixed-wait race | Test sleeps and hopes state is ready | Use fake clocks, deferred promises, or readiness signals |
