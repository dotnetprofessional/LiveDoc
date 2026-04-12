# Session: Playwright Bug Fix Implementation & Review

**Timestamp:** 2026-04-12T07:34:59Z  
**Topic:** Playwright bug fix session  
**Agents:** Mal (Lead), Wash (Framework Dev), Zoe (Tester)

## Summary

Squad completed implementation and testing of Playwright bug fixes:
- Bug 1: `freshContextPerScenario` — browser context isolation per scenario
- Bug 2: "close timed out" — Node.js fetch keep-alive preventing event loop drain

## Decisions

1. **Bug Fix 1 (Mal):** APPROVE freshContextPerScenario implementation with one medium finding (scenarioEndHooks error isolation).
2. **Bug Fix 2 (Wash):** Implement Connection: close header in reporter and server auto-discovery.
3. **Test Strategy (Zoe):** Split into unit tests (scenario-hooks.Spec.ts, 19 passing) and integration tests (fresh-context-per-scenario.Spec.ts).

## Build Status

- Build: Clean ✅
- Tests: 42 files pass, 709 tests pass ✅
- Pre-existing Playwright E2E failures: 2 files (need viewer on port 3100)

## Key Findings

- **Medium (Mal):** scenarioEndHooks has no error isolation — one failing hook blocks subsequent hooks and cleanup.
- **Low (Mal):** Module-level hook arrays never cleared, but safe under vitest's default threading model.
- **Resolved (Wash):** Node.js undici fetch() keep-alive was causing Vitest to hang; fixed with Connection: close header.

## Files Modified

- `packages/vitest/_src/app/livedoc.ts` — scenario lifecycle hooks
- `packages/vitest/_src/app/playwright/index.ts` — useBrowser() with freshContextPerScenario
- `packages/vitest/_src/app/reporter/LiveDocViewerReporterV1.ts` — Connection: close header
- `packages/livedoc-server/src/index.ts` — Connection: close in discoverServer()
- `packages/vitest/_src/test/Playwright/scenario-hooks.Spec.ts` — new, 19 tests, all passing
- `packages/vitest/_src/test/Playwright/fresh-context-per-scenario.Spec.ts` — new, integration test

## Next Steps

1. Address medium finding before or shortly after merge.
2. Run integration tests with Playwright infrastructure available.
3. Merge all decisions into squad decision log.
