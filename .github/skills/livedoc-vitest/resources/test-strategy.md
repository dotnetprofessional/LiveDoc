# Test Strategy and False-Green Prevention

Use this resource before choosing LiveDoc syntax. The goal is not to convert
every test. The goal is to publish the smallest trustworthy test whose result
has lasting documentation value.

## The Two-Question Litmus

A test earns its place only when both answers are yes:

1. **Would it survive a from-scratch rewrite that kept the same promise?**
2. **Would it fail if that promise broke?**

If the first answer is no, the test probably asserts implementation mechanism.
If the second answer is no, the test is vacuous or measures the wrong thing.

## Write a Compact Test Brief

Before generating code, identify:

| Field | Question |
| --- | --- |
| Claim | What externally meaningful fact must remain true? |
| Boundary | What must observe that fact: pure code, component, HTTP service, browser, process, filesystem, or source tree? |
| Oracle | Where does the expected result come from independently of production code? |
| Determinism | What clock, promise, scheduler, process, port, or fixture must be controlled? |
| Falsification | What realistic defect must make this test fail? |
| Owner | Does an existing test already own this behavior? |

Do not generate a LiveDoc test when the claim or observable boundary is unclear.

## Select the Lowest Trustworthy Level

| Claim | Recommended boundary | LiveDoc pattern |
| --- | --- | --- |
| Pure calculation, parser, formatter, or domain rule | In-process | `specification` / `rule` |
| Stateful component behavior | Component integration | Specification or focused Feature |
| Stakeholder-readable workflow | Smallest realistic workflow | `feature` / `scenario` |
| Serialization or public payload shape | Complete contract comparison | Rule or outline |
| Public HTTP behavior | Test server or real HTTP service | Feature or HTTP contract test |
| Browser layout, focus, scrolling, accessibility tree, or pixels | Real browser | Feature with behavioral assertion and optional evidence |
| Source/repository policy | AST or filesystem governance test | Rule when the result is useful documentation |
| Fuzz, property, load, benchmark, or soak testing | Native specialist tool | Optional summary rule, not thousands of published cases |

## Feature or Specification?

Choose by the claim's shape:

1. **Do preconditions, action, and outcome tell a meaningful user or operator journey?** Use a Feature.
2. **Is this an independently verifiable policy or contract best shown through exact rules and examples?** Use a Specification, even if a product stakeholder owns or reads it.

The reader influences the wording, not a business-versus-technical split.
The runtime instrument is separate from the report pattern: a browser Feature
and an in-process Feature can both be valid; an HTTP contract can be a
Specification. The claim determines the observable boundary.

## Phrase the Present-Day Promise

- Put values in titles, but keep implementation mechanisms out.
- Test the goal, not the remembered defect.
- Avoid team names, revision rounds, "previously", "retired", or development history.
- A negative assertion is valid when absence is the current promise.
- Ask whether the title would make sense to a reader who never saw the bug.

| Too specific | Too vague | Trustworthy claim |
| --- | --- | --- |
| The shell uses class `h-7` | The chip is accessible | Under a coarse pointer, the chip exposes at least a `44`px target |
| Function calls helper `normalizeV2` | Formatting works | Input `'abc'` produces canonical output `'ABC'` |

## Purpose Before Proof

Name the behavior in a Feature or Specification title. Use the optional
description (lines after the title and tags) to explain *why* it matters;
Scenario steps, Rule titles, example rows, and assertions show *what* was
checked. This is an authoring convention, not runtime validation.

| Container | Inventory (avoid) | Purpose within the tested boundary |
| --- | --- | --- |
| Shipping Feature | "Tests country and total branches" | "Avoids assigning the wrong delivery tier for the tested destinations and totals." |
| Email Specification | "Valid and invalid address formats" | "Helps callers reject the malformed address shapes covered by these rules before using an address." |
| Widget API Feature | "POST and GET tests" | "Clients can create and retrieve a widget through the documented HTTP flow." |

Technical Specifications still need an understandable contract purpose;
business-owned policies should explain why their exact rules matter. Do not
invent a workflow. An in-process validator does not
prove that messages were delivered. An HTTP contract does not prove that a
customer saw the result. State only outcomes observed by the test. Optional
Scenario/Rule descriptions may clarify scope, not replace specific titles.

Before publishing, ask: Can a reader understand *why* the behavior matters?
Can they find the proof in titles and assertions? Does every outcome claim
match the observed boundary?

## Make Failures Diagnosable

- One independent claim should produce one reported row.
- Use `scenarioOutline` or `ruleOutline` when combinations must fail independently.
- Avoid loops that collapse many meaningful cases into one step.
- A step should not hide unrelated assertions.
- Failure messages must name the claim and case that broke.

## False-Green Completion Gate

Before completion:

- [ ] The intended test was collected and executed.
- [ ] The test passes alone and in its normal suite.
- [ ] Expected values are independent of the production algorithm.
- [ ] Complete shapes are compared when shape is the contract.
- [ ] Missing subjects fail; helpers do not treat absence as success.
- [ ] No guard clause returns before the assertion.
- [ ] No fixed sleep is used where a deterministic seam is available.
- [ ] Shared state has explicit reset and ownership semantics.
- [ ] For critical behavior, the test has been observed failing for the intended defect.
- [ ] The failure was behavioral, not a syntax/import/setup failure.
- [ ] Existing failures are separated from failures introduced by the change.
- [ ] Container descriptions explain purpose without claiming untested outcomes.

Use Stryker or another specialist tool for automated mutation testing. LiveDoc
does not implement its own mutation engine.

## Curate the Living Document

Not every native Vitest test should become a LiveDoc test. Keep low-level harness
checks, exhaustive generated cases, performance tests, and infrastructure probes
in the native runner unless their result has durable reader value.

Organize LiveDoc files by product capability. The directory structure is the
Viewer's table of contents in a full run: put both
`Orders\Checkout.Spec.ts` (Feature) and
`Orders\Pricing\ShippingRates.Spec.ts` (Specification) under Orders, not
separate Features and Specs roots. Readers can move from the workflow to
its detailed calculations without switching sections.
