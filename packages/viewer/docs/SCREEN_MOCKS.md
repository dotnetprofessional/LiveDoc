# LiveDoc Viewer — Screen Mocks (structure-first)

**Purpose:** These are structure mocks (not final UI) for validating screens and behaviors described in the Viewer BRD.

**Applies to:** Web Viewer + VS Code embedded webview

---

## Global frame (every screen)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: LiveDoc | Environment: [local] | Run: [Latest] | Search [..........] │
│         Filters: [ @tag pills... ]  Status: [All|Failing]   Run: [Running ⟳] │
├─────────────── Left Nav (containers) ────────────────┬────── Content ───────┤
│ - Group / Folder / Describe (rollup)                 │                      │
│   - Feature: Billing (rollup)                        │                      │
│   - Specification: Discounts (rollup)                │                      │
│   - Suite: auth.spec.ts (rollup)                     │                      │
│                                                      │                      │
│ (Nav stops at container level; no steps, no examples)│                      │
└──────────────────────────────────────────────────────┴──────────────────────┘
```

Notes:
- The left nav never shows Given/When/Then and never shows Outline example rows.
- Tag filters are tokenized “pills”. Typing `@` opens tag autocomplete.
- Run-in-progress indicator is always visible when applicable.

---

## Navigation (Left Nav)

### What it contains

```
Left Nav

Environment
  local

Run
  Latest  (or)  [Run #1234 2026-01-05 10:21]
  Status: Running ⟳  (or Passed / Failed)

Containers
  ▸ Group: Core Library            [Failed]
  ▾ Feature: Billing               [Failed]
  ▾ Specification: Discounts       [Passed]
  ▸ Suite: auth.spec.ts            [Passed]
```

### Behavior rules
- Expanding/collapsing is allowed for container nesting only.
- Clicking a container opens the **container page** in the content area.

---

## Dashboard

### Goal
Answer:
- what’s the overall state?
- how is the suite organized?
- where are problems concentrated?

### Mock

```
Dashboard (Run front page)

[Summary]
  Overall: FAILED
  Environment: local
  Last verified: 2026-01-05 10:21
  Duration: 2m 14s
  Counts:  120 passed | 3 failed | 2 pending | 1 skipped

[Organization / grouping health]
  Grouping                         Status    Passed Failed Pending
  Billing / Accounts Payable        Failed    20     1      0
  Billing / Accounts Receivable     Passed    18     0      0
  Ordering / Checkout               Failed    22     1      2
  Ordering / Fulfillment            Passed    30     0      0

[Entry points]
  - View failing tests (across all containers)
  - Jump to most recent failure
  - Open container: Billing / Accounts Payable
  - Open container: Ordering / Checkout
```

Notes:
- “Organization / grouping health” is intentionally prominent.

---

## Container page (Feature / Specification / Suite)

### Goal
A container page lists **leaf tests** inside that container. This list is only accessible in the viewer content area (not represented as expanded leaves in the nav).

### Mock

```
Container: Feature — Billing                      [FAILED]
Tags: [@payments] [@critical]
Evidence: env=local | last verified=2026-01-05 10:21 | duration=18s

Filter: [ text..... ]   Tags: [ @critical ] [ + add tag (@...) ]   Status: [All|Failing]

Contained tests
  Scenario:        Customer can view invoice history          [Passed]
  Scenario:        Customer can pay invoice                   [Failed]
  ScenarioOutline: Payment retries handle error codes         [Failed]
  Scenario:        Refund request creates ticket              [Pending]
```

### Container specifics
- Feature container lists scenarios and outlines; may reference Background context.
- Specification container lists Rules.
- Suite container lists tests (and supports drilling into nested containers), but leaves are still shown only in content.

---

## Test single page (Scenario / Rule / Test)

### Goal
This is the leaf test detail page: what it proves, what ran, and what failed.

### Mock (Scenario)

```
Scenario: Customer can pay invoice                 [FAILED]
Tags: [@payments] [@critical]
Evidence: env=local | last verified=2026-01-05 10:21 | duration=410ms

Bound values
  invoiceId = 123
  gateway   = stripe

Background (context)
  Given customer exists
  And customer has an unpaid invoice

Steps
  Given customer opens invoice page                ✓
  When customer clicks "Pay"                       ✓
  Then payment succeeds                            ✗

Failure (summary)
  Payment gateway returned 502

Failure (details)  [collapsed by default]
  Stack trace...
  Error metadata...

Bindings
  (Shown above as bound values for single tests)
```

Notes:
- Background is shown inline for context when applicable.
- Failure details are collapsed by default.

---

## Test outline page (Scenario Outline)

### Goal
Outline appears once in container list, but has multiple example executions.

### Mock

```
Scenario Outline: Payment retries handle error codes        [FAILED]
Tags: [@payments]
Evidence: env=local | last verified=2026-01-05 10:21

Background (context)
  Given customer exists
  And gateway is reachable

Template (no row selected)
  Given an invoice with amount <amount>
  When gateway returns <errorCode>
  Then system retries <retries> times

Examples
  Row  Status  amount  errorCode  retries  duration
  1    ✓       10      500        3        120ms
  2    ✗       10      502        3        130ms
  3    ✓       25      429        5        140ms
  4    ✓       99      500        3        110ms

(Click row 2)

Template (row 2 selected; values applied)
  Given an invoice with amount 10
  When gateway returns 502
  Then system retries 3 times

Failure (row-scoped; only for selected row)
  Summary: expected retry to succeed after 3 attempts
  Details: [collapsed by default]

(Click row 2 again → returns to template view; hides failures list)
```

Key behaviors:
- Row selection toggles template ↔ bound values.
- Errors shown only for the selected row.

---

## Minimal interaction checklist

- `@` tag autocomplete in filters
- container-only nav depth
- container page lists leaf tests
- background shown on relevant leaf tests and outlines
- outline row selection toggles bound values and row-scoped errors
- run-in-progress indicator visible during execution
