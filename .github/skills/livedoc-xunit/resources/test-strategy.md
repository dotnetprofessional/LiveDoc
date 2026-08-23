# Test Strategy and False-Green Prevention

Choose the observable boundary before selecting `[Feature]` or `[Specification]`.
LiveDoc should publish meaningful behavior, not every low-level xUnit test.

## The Two-Question Litmus

1. **Would the test survive a rewrite that preserved the same promise?**
2. **Would the test fail if that promise broke?**

No to the first means brittle implementation coupling. No to the second means a
false-green or irrelevant assertion.

## Compact Test Brief

Identify the behavior claim, risk, observable boundary, independent oracle,
determinism seam, intended falsification, and existing coverage owner.

## Select the Boundary

| Claim | Recommended boundary | LiveDoc pattern |
| --- | --- | --- |
| Algorithm, parser, lifecycle rule, or controlled concurrency | In-process | `[Specification]` / `[Rule]` |
| Stakeholder-readable business workflow | Smallest realistic workflow | `[Feature]` / `[Scenario]` |
| ASP.NET binding, routing, middleware, authentication, or error envelope | `WebApplicationFactory` or equivalent test host | Feature or Specification based on audience |
| Process startup, TCP, streaming, cancellation, or deployment wiring | Owned real process | Feature or Journey |
| HTTP protocol workflow | Annotated `.http` Journey | Feature/Scenario report |
| Source/repository architecture policy | Roslyn or filesystem check | Rule when useful documentation |
| Load, fuzz, property, benchmark, or mutation testing | Native specialist tool | Optional summarized acceptance rule |

Use a real process only when the process boundary is load-bearing. Otherwise
prefer an in-process host for speed, isolation, and diagnostics.

## Feature or Specification?

1. A stakeholder-readable multi-step workflow → Feature.
2. A single technical rule or contract → Specification.
3. The instrument does not decide the pattern; audience and claim do.

## Isolation and Lifecycle

- Every Rule and Scenario must run alone.
- Initialize fixtures before reading counters or mutable state.
- Give parallel tests isolated ports, files, and process ownership.
- Use `TimeProvider`, `TaskCompletionSource`, barriers, or injectable schedulers
  instead of fixed delays.
- Bound cancellation and cleanup.
- Kill only processes owned by the test.
- Separate baseline failures from the change under test.

## Present-Day Living Documentation

- Put values in titles; keep method names, class names, and implementation flags out.
- Test the goal rather than memorializing an old defect.
- Avoid revision rounds, team names, and construction history.
- Use one outline row per independent claim.
- Keep namespaces organized by product/domain surface because they form the
  Viewer table of contents.

## False-Green Completion Gate

- [ ] The intended test was discovered and executed.
- [ ] It passes alone and in the normal suite.
- [ ] Expected data is independent of production logic.
- [ ] Required subjects cannot be absent while the test stays green.
- [ ] Complete contracts fail on unexpected fields unless a rule explicitly handles them.
- [ ] No fixed wait replaces a controllable seam.
- [ ] Processes, streams, ports, files, and fixtures are released.
- [ ] Critical behavior has been observed failing for the intended defect.
- [ ] Failure output identifies the broken claim and does not expose secrets.

Use Stryker.NET for automated mutation testing. LiveDoc may document its outcome
but does not replace the mutation engine.
