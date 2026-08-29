# @swedevtools/livedoc-schema Changelog

All notable changes to the LiveDoc Schema package are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

## [0.3.0] - 2026-08-29

- Added optional `runType` and `baselineRunId` metadata for full and partial test-run history.
- Added optional coverage evidence to `TestRunV1`, including line, branch, function, and statement metrics; per-file module metadata; provenance; diagnostics; and non-fatal thresholds.
- Added REST and WebSocket wire validation for coverage attachment and live coverage events.
