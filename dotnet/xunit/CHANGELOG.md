# SweDevTools.LiveDoc.xUnit Changelog

All notable changes to the LiveDoc xUnit package are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

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
