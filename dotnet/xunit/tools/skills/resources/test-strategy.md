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

1. A user or operator workflow that benefits from Given/When/Then → Feature.
2. An independently verifiable business policy or technical contract best
   shown through precise rules and examples → Specification.
3. Product stakeholders may read both. The claim's shape, not a
   business-versus-technical audience split or the test instrument, decides
   the pattern.

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
- Keep both Features and Specifications under the same product capability
  namespace: `MyApp.Tests.Orders` for Checkout and
  `MyApp.Tests.Orders.Pricing` for Shipping rates. The complete declared
  namespace forms the Viewer table of contents, regardless of assembly name; do not
  default to separate `Features.Orders` and `Specs.Orders` roots.

## Purpose Before Proof

Name the behavior in the Feature or Specification title. Use its optional
`Description` to explain *why* the behavior matters to a reader; use Scenario
steps, Rule titles, example rows, and assertions to show *what* was checked.
Journey `# Description:` supplies the Feature description, not a list of HTTP
methods. Descriptions are an authoring convention, not a runtime requirement.

| Container | Inventory (avoid) | Purpose within the tested boundary |
| --- | --- | --- |
| Shipping Feature | "Covers country and total branches" | "Avoids assigning the wrong delivery tier for the tested destinations and totals." |
| Email Specification | "Valid and invalid format cases" | "Helps callers reject the malformed address shapes covered by these rules before using an address." |
| Widget Journey | "Full CRUD validation" | "Clients can create, retrieve, update, and delete a widget through the documented HTTP flow." |

A technical Specification still needs an understandable contract purpose;
a business-owned Specification should say why its precise rule matters to
readers. Neither needs to invent a workflow. A shipping calculation does not
prove that the price was shown in a UI. A response contract does not prove that
a payment settled or that a downstream service received an event. State those
outcomes only when tests observe them. Scenario/Rule descriptions can add
scope or context but should not repeat or inflate their titles.

Before publishing, ask: Can a reader tell *why* this matters without opening
the code? Can they find the actual proof in the titles and assertions? Does
every stated outcome match the observed boundary?

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
- [ ] Container descriptions explain purpose without claiming outcomes the tests do not establish.

Use Stryker.NET for automated mutation testing. LiveDoc may document its outcome
but does not replace the mutation engine.
