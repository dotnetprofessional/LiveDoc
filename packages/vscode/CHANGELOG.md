# livedoc-vscode Changelog

All notable changes to the LiveDoc VS Code extension are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named extension release, including temporary `0.0.0.x` builds.

## [next release]

- Updated esbuild build tooling to address GHSA-g7r4-m6w7-qqqr.

## [0.3.0] - 2026-08-29

- Updated the embedded Viewer with the redesigned dashboard, grouped Full/Partial run history, failure diagnostics, rule-violation cards, contextual deep links, responsive navigation, and module-based code coverage.
- Bundled extension-host runtime dependencies into the compiled entrypoint so the published VSIX runs without a workspace `node_modules` tree.
- Updated the bundled `ws` runtime to a release that fixes GHSA-96hv-2xvq-fx4p.
- Fixed two-column `ScenarioOutline` and `RuleOutline` Examples tables so the formatter always treats their first row as column headers while preserving row-header detection for ordinary data tables.
- Fixed ordinary table header detection for quoted JSON string headings.
