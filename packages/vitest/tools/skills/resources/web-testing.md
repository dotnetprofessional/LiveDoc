# Web Testing: jsdom or Real Browser

Where a test runs is decided by what it claims, not convenience.

## Use jsdom for Observable DOM Contracts

jsdom is appropriate for:

- component state transitions;
- roles, accessible names, labels, and descriptions;
- deterministic event handling;
- form validation and submission;
- loading, empty, error, and recovery states;
- adapter/repository calls;
- basic keyboard-event contracts that do not require real focus behavior.

## Use a Real Browser for Platform Behavior

Use Playwright or another real browser for:

- measured geometry and responsive breakpoints;
- overflow, clipping, sticky positioning, and scrolling;
- focus trapping and restoration;
- `inert`, modal isolation, and the accessibility tree;
- computed styles, contrast, media queries, and theme geometry;
- pointer hit testing and real keyboard navigation;
- screenshots and visual comparison.

Do not assert CSS class names as proxies for appearance. A class rename can fail
while the product remains correct, and a broken stylesheet can leave the proxy
green.

## Browser Workflow

1. Prove readiness without a fixed sleep.
2. Interact through user-visible controls.
3. Assert the semantic or geometric behavior.
4. Attach a screenshot when it helps a reader or reviewer understand the state.
5. Verify the browser, worker, server, ports, and temporary files are released.

Read `resources/playwright.md` for the LiveDoc browser and screenshot APIs.

## Screenshots Are Evidence

A screenshot supports a claim; it does not replace the assertion.

Capture states a reader needs to understand:

- meaningful starting state;
- important user-triggered transitions;
- final outcome;
- failure state when diagnostic evidence is useful.

Feature journeys commonly benefit from screenshots. A browser-based
Specification may also attach evidence when the technical contract is visual.

Never attach:

- credentials, tokens, cookies, or authorization headers;
- unredacted personal data;
- traces or screenshots captured before readiness;
- large artifacts without a clear documentation purpose.
