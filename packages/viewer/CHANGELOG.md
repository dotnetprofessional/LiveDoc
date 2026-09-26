# @swedevtools/livedoc-viewer Changelog

All notable changes to the LiveDoc Viewer are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

- Show attachments recorded directly on Rules and on the selected Rule Outline example, including image, JSON, text, and file previews without mixing evidence from other rows.
- Added attachment indicators to test listings, with direct access to Rule evidence and counts for Scenarios and Rule Outlines.
- Added collapsible, syntax-highlighted JSON attachment previews and Mermaid diagram previews with source, download, fit, zoom, and scroll controls for large sequence diagrams.
- Reduced the npm package footprint by keeping Vite-bundled browser libraries out of the embedded production `node_modules`; only the Viewer CLI and private Server/Schema runtime closure is packaged.
- Fixed JSON and text attachment headers so the supplied attachment title appears beside its MIME type.
- Fixed RuleOutline and ScenarioOutline descriptions so placeholders bind only to actual selected example-row values for both Vitest and xUnit reports, without rewriting Markdown autolinks.
- Added regression coverage for inline step Markdown, formatted JSON code blocks, and escaped script-like response text.
- Fixed Markdown preprocessing so fenced JSON, HTML, and other code blocks preserve their exact source text.
- Fixed inline Markdown code so short values remain inline instead of rendering as full-width fenced blocks.

## [0.3.0] - 2026-08-29

### Added

- Added a version badge so installed and release viewer builds are easier to identify.
- Added Full/Partial run history badges and a contextual Combined/This partial view for focused development runs.
- Added optional code-coverage summaries and a dedicated explorer with weighted totals, module/project hierarchy, line and branch metrics, health colors, and common-path collapsing.
- Added logical project grouping with source-project provenance, onboarding, and settings for grouping and hiding represented source projects.
- Added an **Always show latest run** preference for automatically following live executions.
- Added contextual deep links that preserve project, environment, exact run or run group, projection, and the current dashboard, coverage, folder, or test view.
- Added responsive mobile navigation and layouts for the dashboard and coverage explorer.

### Fixed

- Fixed rendering for named placeholders such as `<operation:multiply>` and `<factor:3>`.
- Fixed duplicate logical project entries appearing after repeated live runs.
- Fixed the live-update banner so it appears for grouped runs, partial runs, and unselected live activity instead of only the selected raw run.
- Fixed the live-update banner disappearing after the first failed test while the invocation was still running.
- Fixed the sidebar running status so it renders one spinner instead of duplicating the loader already provided by the status badge.
- Fixed xUnit failure diagnostics so the failed step shows its error and stack trace without a duplicate failure summary.
- Fixed coverage visibility so runs without coverage do not show coverage navigation, dashboard content, or empty detail pages.
- Fixed grouped and module totals so shared coverage files are not double-counted.
- Fixed Ctrl-C shutdown so the viewer exits cleanly instead of repeatedly printing the graceful shutdown message while a browser tab is connected.

### Changed

- Redesigned the dashboard around Quality Signals, Environment, Failures, Code Coverage, and Rule Violations using consistent full-width sections.
- Changed coverage detail navigation from file-system-first to project/module-first and collapsed module rows by default.
- Changed the project selector to show only the newest logical group per project/environment while retaining older grouped executions in Run history.
- Changed durations of one minute or longer to compact minute/hour formatting instead of large second values.
- Updated the bundled Hono and `ws` runtimes to releases that fix GHSA-88fw-hqm2-52qc and GHSA-96hv-2xvq-fx4p.
- Updated `lucide-react` to a React 19-compatible release.
