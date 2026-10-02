# SweDevTools.LiveDoc.xUnit Changelog

All notable changes to the LiveDoc xUnit package are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

## [0.4.0] - 2026-10-02

This release brings together the local testing updates documented in `0.3.0.4` through `0.3.0.7`.

### Added

- Add per-invocation asynchronous Background and cleanup hooks, including Scenario Outline examples, while preserving parallel execution between test instances.
- Attach evidence directly to Rules and individual Rule Outline examples; recognize Mermaid and PDF file MIME types.
- Add optional Markdown descriptions to all synchronous and asynchronous step overloads.

### Fixed

- Preserve Newtonsoft.Json token values in `AttachJson`, including tokens nested in CLR objects and collections. Keep ordinary System.Text.Json behavior and raw-string pass-through; unsupported tokens fail explicitly.
- Preserve full declared namespaces independently of assembly names, including nested and namespace-free classes.
- Retain distinct native Theory rows, counts, failures, and statuses when runtime-enumerated arguments or unique display names are unavailable.
- Compile newly generated Journey tests in the same build and share one sequential server fixture per test assembly.
- Separate Rule titles from descriptions and render `nameof(...)` identifiers with spaces while preserving literal underscores.

### Changed

- Align bundled logger, coverage collector, journey generator, and AI skill versions with `0.4.0`.
- Cache failed Viewer autodiscovery to reduce offline test overhead and share metadata probe processes to reduce regression-suite overhead.
- Update packaged AI guidance for project naming, scoped cleanup, purpose-first specifications, evidence, outlines, and Journeys.

## [0.3.0.7] - 2026-10-01 (local testing)

- Rebuilt the uninstalled local `0.3.0.7` package in place to fix `AttachJson`: Newtonsoft.Json token values now survive at the root and within CLR object/collection graphs, using a targeted System.Text.Json converter and a Newtonsoft.Json 13.0.3 runtime dependency. Ordinary CLR serialization options and raw string pass-through are unchanged; nonstandard tokens fail explicitly instead of producing misleading attachments.
- Fixed xUnit navigation paths to preserve the full declared namespace regardless of assembly name, including nested and namespace-free test classes. Assembly/project identities remain separate from namespace folders.
- Aligned the bundled logger, coverage collector, and journey generator assembly versions with the package version.

## [0.3.0.6] - 2026-09-30 (local testing)

- Updated the packaged AI skill with canonical project naming, exact temporary project/run cleanup, purpose-first descriptions, and clearer Specification, Rule Outline, and Journey guidance. Framework source behavior is unchanged from the previous local build.

## [0.3.0.4] - 2026-09-28 (local testing)

- Added per-invocation async `BackgroundAsync` and `AfterBackgroundAsync` hooks for Scenarios and Scenario Outline examples; the Viewer shows shared Given/And steps in a separate Feature-level Background section, cleanup runs even after failures, and separate xUnit test instances retain their normal parallelism.
- Added attachments directly to Rules and individual Rule Outline examples, preserving each example's evidence in exported results.
- Added Mermaid file previews by recognizing `.mmd` and `.mermaid` as `text/vnd.mermaid` in `AttachFile`; PDF files now receive the `application/pdf` MIME type.
- Fixed generated Journey source inclusion so newly generated tests compile during the same build instead of requiring a second build.
- Fixed standard xUnit theories with runtime-enumerated data so every row retains a distinct exported result, summary count, failure, and run status even when arguments are unavailable or display names are identical ([#140](https://github.com/dotnetprofessional/LiveDoc/issues/140)).
- Changed generated Journey tests to share one sequential xUnit collection fixture, starting the application server once per test assembly instead of once per generated test class. Scaffold mode migrates the exact legacy fixture declaration without overwriting developer-owned test bodies.
- Reduced test-run overhead when the Viewer is offline by probing localhost address families concurrently and caching failed auto-discovery for 30 seconds.
- Reduced the metadata reporting regression suite to two shared testhost probes instead of launching the same fixture process once per assertion group.
- Added process-level regression coverage confirming attachment titles and MIME types survive xUnit export.
- Fixed Rule and RuleOutline metadata so the positional argument is the title and the optional named `Description` is separate prose, preventing titles from being duplicated in Viewer descriptions.
- Added optional inline Markdown descriptions to every synchronous and asynchronous Given/When/Then/And/But overload, including fenced JSON rendered beneath the step title ([#143](https://github.com/dotnetprofessional/LiveDoc/issues/143)).
- Fixed Feature, Specification, Scenario, ScenarioOutline, Rule, and RuleOutline titles supplied through `nameof(...)` so identifier underscores render as spaces while literal underscores remain unchanged.

## [0.3.0] - 2026-08-29

- Added .NET 8 and .NET 10 targets for the framework, logger, coverage collector, and journey generator.
- Added xUnit `Category` trait discovery for LiveDoc `[Tag]` attributes, enabling tag-filtered partial runs through `dotnet test --filter`.
- Added `LIVEDOC_RUN_TYPE=full|partial` so focused server-backed runs preserve the latest full test picture.
- Added automatic Microsoft and XPlat coverage attachment processing, Cobertura normalization, module metadata, invocation scoping, retry-safe uploads, and duplicate/stale attachment protection.
- Added Visual Studio Code Coverage support through the packaged `LiveDocCoverage` collector; binary `.coverage` files can be converted with `dotnet-coverage`.
- Expanded the packaged AI skill with boundary-first test selection, deterministic fixture guidance, false-green checks, rule-violation self-correction, tag-scoped partial-run guidance, anti-patterns, attachment evidence APIs, and a consent-gated workflow for reporting verified LiveDoc framework defects upstream.
- Added OpenAI Codex and comma-separated multi-tool selection to the repository-local AI skill installer.
- Added non-fatal Gherkin structure reporting for repeated or missing Given/When/Then steps, untitled steps, and invalid And/But placement.
- Fixed xUnit viewer/export metadata so Feature, Scenario, ScenarioOutline, Given/When/Then/And/But steps, Specification, Rule, and RuleOutline attributes consistently publish titles, descriptions, tags, and example data.
- Fixed authoritative result reconciliation so Viewer totals and failures match VSTest, including helper fixtures and outline rows.
- Fixed failed LiveDoc steps so the scenario and exact failed step retain the assertion message and stack trace.
- Fixed explicit `[Rule("...")]` titles so underscores and environment-variable names such as `LIVEDOC_RUN_TYPE` are preserved.
- Fixed outline correctness so positional `[RuleOutline("...")]` narratives bind as descriptions, Rule context values come from the concrete authored narrative, quoted step-template reconstruction remains deterministic across cultures, row order, constants, and equal-valued parameters, and serializable examples receive concrete discovery names.
- Fixed ScenarioOutline reconciliation so step-level Gherkin rule violations remain attached to exported template steps.
- Fixed LiveDoc console logger fallback headings so tests that do not create a LiveDoc context still print Feature and Specification titles from their attributes.
- Fixed NuGet source inheritance and package assets so framework reference packs restore correctly for both supported target frameworks.
