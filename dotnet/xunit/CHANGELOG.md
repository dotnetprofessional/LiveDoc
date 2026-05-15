# SweDevTools.LiveDoc.xUnit Changelog

All notable changes to the LiveDoc xUnit package are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

- Fixed xUnit viewer/export metadata so Feature, Scenario, ScenarioOutline, Given/When/Then/And/But steps, Specification, Rule, and RuleOutline attributes consistently publish titles, descriptions, tags, and example data.
- Fixed LiveDoc console logger fallback headings so tests that do not create a LiveDoc context still print Feature and Specification titles from their attributes.
