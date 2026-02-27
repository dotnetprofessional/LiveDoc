# Screenshot Capture Guide

This guide lists all screenshots needed for the LiveDoc Docusaurus documentation site. Once captured, place the files in this directory (`docs/static/img/screenshots/`) and they will automatically appear in the documentation pages.

## ✅ Terminal Screenshots (AUTO-GENERATED)

The following SVG screenshots were auto-generated from real vitest output using `scripts/generate-terminal-svgs.mjs`:

| Filename | Content | Referenced In |
|----------|---------|---------------|
| `vitest-first-run.svg` | BDD feature output (ATM + Calculator) | `vitest/learn/getting-started.mdx` |
| `terminal-output-hero.svg` | Full BDD output with summary table | `index.mdx` |
| `reporter-spec-output.svg` | Specification pattern output | `vitest/reference/reporters.mdx` |
| `reporter-detail-summary.svg` | Summary detail level | `vitest/reference/reporters.mdx` |
| `reporter-detail-list.svg` | List detail level | `vitest/reference/reporters.mdx` |
| `vitest-spec-output.svg` | Full specification output | Available for future use |
| `vitest-feature-output.svg` | ATM feature output only | Available for future use |
| `vitest-tutorial-output.svg` | Beautiful Tea Shipping tutorial | Available for future use |
| `vitest-scenario-outline.svg` | Scenario Outline with Examples | Available for future use |

To regenerate: `node scripts/generate-terminal-svgs.mjs`

## Naming Convention

All files use kebab-case with descriptive names: `{area}-{description}.png`

## How to Capture

- **Terminal output**: Use your terminal at a reasonable width (~100 chars). Ensure colors are visible. Crop to show only the relevant output.
- **Viewer UI**: Start the viewer (`livedoc-viewer`), run some specs, then capture the browser window. Crop browser chrome if desired.
- **VS Code**: Open VS Code with the LiveDoc extension loaded. Use the Extension Development Host if needed.
- **Recommended format**: PNG, reasonable resolution (1x or 2x), cropped to content.

---

## 🔴 HIGH PRIORITY

### Landing Page (`docs/index.mdx`)

| # | Filename | What to Capture | Instructions |
|---|----------|----------------|--------------|
| 1 | `viewer-dashboard-hero.png` | Viewer dashboard with a populated feature tree showing pass/fail results | Start viewer, run a set of specs (mix of pass/fail), capture the full dashboard |
| 2 | `terminal-output-hero.png` | Terminal showing colored Gherkin output with ✓ checkmarks | Run `npx vitest run` on a spec file, capture the colored output section |

### Viewer: Understanding the UI (`docs/viewer/learn/understanding-the-ui.mdx`)

| # | Filename | What to Capture | Instructions |
|---|----------|----------------|--------------|
| 3 | `viewer-dashboard-full.png` | Full dashboard overview showing all panels | Capture the entire viewer with sidebar, detail panel, and stats visible |
| 4 | `viewer-sidebar-tree.png` | Feature tree sidebar with expanded features and status icons | Expand a few features in the sidebar to show the tree hierarchy |
| 5 | `viewer-scenario-detail.png` | Scenario detail panel showing step-by-step results with durations | Click a scenario to show its steps with timing info |
| 6 | `viewer-failed-step.png` | Failed step showing error message and/or expected vs actual diff | Run a spec with a deliberate failure, capture the error display |
| 7 | `viewer-statistics.png` | Statistics/summary area showing feature/scenario/step counts | Capture the stats section (pass rates, counts) |
| 8 | `viewer-run-history.png` | Run history panel showing multiple runs | Run specs a few times, capture the run history list |

### Viewer: Getting Started (`docs/viewer/learn/getting-started.mdx`)

| # | Filename | What to Capture | Instructions |
|---|----------|----------------|--------------|
| 9 | `viewer-empty-state.png` | Viewer initial empty state at localhost:3100 | Start fresh viewer with no data, capture the empty dashboard |
| 10 | `viewer-populated.png` | Viewer after running tests, showing populated results | Run specs then capture the viewer with results |

### Vitest: Getting Started (`docs/vitest/learn/getting-started.mdx`)

| # | Filename | What to Capture | Instructions |
|---|----------|----------------|--------------|
| 11 | `vitest-first-run.png` | Terminal output of `npx vitest run` with LiveDocSpecReporter | Run the Calculator.Spec.ts example, capture the terminal output |

### VS Code Extension (`docs/vscode/overview.mdx`)

| # | Filename | What to Capture | Instructions |
|---|----------|----------------|--------------|
| 12 | `vscode-snippet-expansion.png` | VS Code editor showing `ld-feature` autocomplete dropdown | Type `ld-` in a .Spec.ts file, capture the autocomplete popup |
| 13 | `vscode-table-formatting.png` | Before/after of the "Format Data Tables" command | Show a messy data table, then the formatted result (side-by-side or sequential) |
| 14 | `vscode-viewer-panel.png` | LiveDoc Viewer panel inside VS Code | Open the viewer webview in VS Code, capture the panel |

### Reporters Reference (`docs/vitest/reference/reporters.mdx`)

| # | Filename | What to Capture | Instructions |
|---|----------|----------------|--------------|
| 15 | `reporter-spec-output.png` | Full LiveDocSpecReporter output with features, scenarios, steps | Run a full spec suite, capture the complete reporter output |
| 16 | `reporter-detail-levels.png` | Comparison of different `detailLevel` settings | Run with different detail levels and combine into one image, or capture separately |

---

## 🟡 MEDIUM PRIORITY

| # | Filename | Target Page | What to Capture |
|---|----------|------------|----------------|
| 17 | `vitest-feature-output.png` | `vitest/learn/your-first-feature.mdx` | Terminal showing UserAuth feature output |
| 18 | `vitest-spec-output.png` | `vitest/learn/your-first-spec.mdx` | Terminal showing Specification output |
| 19 | `vitest-tutorial-output.png` | `vitest/learn/tutorial.mdx` | Terminal output of ShippingCosts.Spec.ts |
| 20 | `concepts-beautiful-tea.png` | `concepts/tutorial-beautiful-tea.mdx` | Terminal output of Beautiful Tea feature |
| 21 | `viewer-vitest-integration.png` | `vitest/guides/viewer-integration.mdx` | Viewer showing results received from Vitest |
| 22 | `vscode-data-table-aligned.png` | `vitest/learn/data-extraction.mdx` | VS Code showing formatted data table |
| 23 | `vitest-scenario-outline.png` | `vitest/learn/scenario-outlines.mdx` | Terminal showing labeled example groups |
| 24 | `reporter-emoji-output.png` | `vitest/guides/custom-reporters.mdx` | Terminal output of custom emoji reporter |
| 25 | `ci-github-actions.png` | `vitest/guides/ci-cd.mdx` | GitHub Actions log showing LiveDoc output |
| 26 | `ci-viewer-health.png` | `viewer/guides/ci-cd-dashboards.mdx` | GitHub Actions log with viewer health check |
| 27 | `viewer-multi-project.png` | `viewer/guides/multi-project-setup.mdx` | Viewer project selector with multiple projects |
| 28 | `vitest-tag-filtering.png` | `vitest/guides/tags-and-filtering.mdx` | Terminal showing filtered test run |
| 29 | `vscode-dev-host.png` | `vscode/development.mdx` | VS Code Extension Development Host window |
| 30 | `concepts-living-docs.png` | `concepts/living-documentation.mdx` | Viewer showing specs as browsable docs |
| 31 | `concepts-reporting-model.png` | `concepts/reporting-model.mdx` | Viewer showing TestCase hierarchy |
| 32 | `concepts-test-organization.png` | `concepts/test-organization.mdx` | Viewer showing domain-organized tree |
| 33 | `xunit-viewer-integration.png` | `xunit/guides/viewer-integration.mdx` | Viewer showing xUnit results |
| 34 | `xunit-debugger.png` | `xunit/guides/debugging.mdx` | Visual Studio debugger inside a LiveDoc step |

---

## 🟢 LOW PRIORITY

| # | Filename | Target Page | What to Capture |
|---|----------|------------|----------------|
| 35 | `vitest-setup-success.png` | `vitest/guides/setup-imports.mdx` | Terminal showing successful test run |
| 36 | `vscode-clean-spec.png` | `vitest/guides/setup-globals.mdx` | Clean .Spec.ts file with no imports |
| 37 | `viewer-best-practices.png` | `vitest/guides/best-practices.mdx` | Viewer showing well-organized hierarchy |
| 38 | `vscode-env-detection.png` | `vitest/guides/troubleshooting.mdx` | VS Code environment detection working |
| 39 | `vscode-intellisense.png` | `vitest/reference/configuration.mdx` | VS Code IntelliSense for vitest.config.ts |
| 40 | `migration-comparison.png` | `vitest/guides/migration-from-mocha.mdx` | Before/after: Mocha vs Vitest output |
| 41 | `concepts-bdd-viewer.png` | `concepts/bdd-pattern.mdx` | Viewer showing BDD feature |
| 42 | `concepts-spec-viewer.png` | `concepts/specification-pattern.mdx` | Viewer showing Specification with rules |
| 43 | `concepts-data-driven.png` | `concepts/data-driven-tests.mdx` | Viewer showing ScenarioOutline examples |
| 44 | `concepts-self-doc.png` | `concepts/self-documenting-tests.mdx` | Viewer showing highlighted values |
| 45 | `viewer-rest-api.png` | `viewer/reference/rest-api.mdx` | Terminal showing curl + JSON response |
| 46 | `viewer-websocket.png` | `viewer/reference/websocket-api.mdx` | Browser DevTools showing WS messages |
