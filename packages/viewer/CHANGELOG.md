# @swedevtools/livedoc-viewer Changelog

All notable changes to the LiveDoc Viewer are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

### Changed

- Updated the bundled `@hono/node-server` runtime to 1.19.17 to address GHSA-92pp-h63x-v22m and GHSA-frvp-7c67-39w9.
- Updated Vite to 6.4.3 to address development-server path traversal and file access advisories.

## [0.4.0] - 2026-10-02

This release brings together the local testing updates documented in `0.3.3` through `0.3.9`.

### Added

- Remember which Features, Specifications, and standard Tests to include. Excluded tests disappear from navigation, search, failures, and test metrics without changing stored reports; duration and coverage remain invocation-wide.
- Add a keyboard-accessible, remembered desktop sidebar width and framework-neutral common-root shortening while preserving full paths, meaningful branches, and existing links.
- Support native Test results in Standard and Container documents, including Fact/Theory arguments, statuses, skip reasons, failures, and evidence. Keep tests without additional details inline.
- Show Rule and individual outline-example attachments, with titled galleries, JSON search, Mermaid previews, and pointer-anchored Ctrl-wheel zoom.
- Add confirmed project/run deletion, including grouped-source disclosure and retryable partial failures.

### Fixed

- Preserve canonical standard-test identities and saved links while displaying shorter, framework-neutral method names.
- Execute standalone HTML bundles as ES modules so exported reports render correctly.
- Keep JSON keys aligned across sibling value types, preserve inline and fenced Markdown, and bind outline descriptions only to the selected example.

### Changed

- Package only the CLI and required Server/Schema runtime closure alongside compiled browser assets, reducing the distribution footprint.

## [0.3.9] - 2026-10-02 (local testing)

- Add remembered inclusion checkboxes for Features, Specifications, and standard tests. Apply the selection to navigation, search, failure lists, and test metrics without changing stored reports; run duration and coverage remain invocation-wide.
- Keep standard tests without additional details inline, while retaining drill-down for arguments, descriptions, evidence, skip reasons, violations, and failures.
- Shorten qualified standard-test names to their method name in every Viewer framework, preserving argument text, authored titles, canonical IDs, and saved links.

## [0.3.8] - 2026-10-02 (local testing)

- Hide shared, unbranched folder prefixes in navigation, folder listings, and breadcrumbs for all report frameworks, including xUnit and Vitest. Keep meaningful branches, direct documents, canonical paths, saved links, filters, and test totals intact; full paths remain available in navigation and heading tooltips. This is a Viewer display change only; SDK exporters and stored report paths are unchanged.
- Add a keyboard-accessible draggable divider to desktop navigation. Remember the preferred sidebar width locally, constrain it to 240–600 pixels while leaving at least 480 pixels for results, and retain the mobile navigation drawer.

## [0.3.7] - 2026-10-02 (local testing)

- Rebuild the local testing package with the current Standard/Container and native Fact/Theory support, standalone HTML export fix, pointer-anchored image and Mermaid zoom, and JSON attachment alignment and floating search. Retain the `0.3.6` release history below.

## [0.3.6] - 2026-10-01 (local testing)

- Corrected standalone HTML exports to execute the Viewer bundle as an ES module, so native-test navigation and results render in exported reports.

- Show persisted xUnit `Standard` documents alongside `Container`, Feature, and Specification documents in navigation, folder listings, search, and contextual deep links without rewriting reports or totals. Native Fact and individual Theory results now open at every status, with Test labels, durations, skip reasons, failure details, typed data tables, and attachment galleries.
- Zoom image and Mermaid previews with Ctrl + mouse wheel without changing browser page zoom. Keep the point under the pointer stable while panning, retain Fit and toolbar controls, and leave ordinary scrolling and non-zoomable previews native.
- Search JSON attachment keys and values from a compact floating panel, including collapsed branches. Matching fields are highlighted with wrapping previous/next navigation, keyboard shortcuts, and automatic reveal of the active result; copy and download still include the complete attachment. Keep the panel responsive on narrow screens, and retain match navigation in older browsers without text-highlight support.
- Align JSON attachment key text across scalar, collection, empty, and null siblings using a shared disclosure gutter. Keep nested indentation consistent at desktop and mobile widths, with browser regressions measuring the text itself in collapsed and expanded states.

## [0.3.5] - 2026-09-30 (local testing)

- Include the local date alongside the time in the dashboard Environment card's Last verified value, matching the dashboard header and allowing the longer value to wrap on narrow screens.
- Add confirmed permanent deletion to the project and run selectors. A grouped project deletes each source project across environments, while a grouped run deletes its disclosed physical runs; partial failures remain visible and retryable, and selections refresh after success.
- Replace the custom JSON attachment tree with a React 19-compatible, keyboard-accessible JSON viewer; root properties and nested arrays now have consistent indentation while raw invalid JSON and attachment actions remain available.
- Show Scenario Outline example attachments in the Viewer list indicator and selected-example gallery, keeping step and row evidence scoped to the correct example.
- Restore visible attachment titles, MIME types, sizes, and gallery positions in the shared preview header, alongside step descriptions even on narrow screens.

## [0.3.3] - 2026-09-28 (local testing)

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
