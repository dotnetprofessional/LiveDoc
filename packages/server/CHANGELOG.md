# @swedevtools/livedoc-server Changelog

All notable changes to the LiveDoc Server are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

### Changed

- Marked the server as a private workspace package embedded in the Viewer distribution instead of publishing it independently.
- Updated `@hono/node-server` to 1.19.17 to address GHSA-92pp-h63x-v22m and GHSA-frvp-7c67-39w9.

## [0.3.0] - 2026-08-29

- Added full/partial run lifecycles, raw physical history, server-composed historical views, active-run fencing, and completed-only latest snapshots.
- Added durable post-run coverage attachment with WebSocket notification and REST hydration support.
- Added logical run composition that preserves physical source-project provenance while presenting related runs as one product-level view.
- Added actionable diagnostics for invalid persisted runs and invalid coverage blocks instead of failing server startup.
- Preserved scenario-level failure errors while recomputing aggregate status and duration from streamed step results.
- Updated Hono and `ws` to releases that fix GHSA-88fw-hqm2-52qc and GHSA-96hv-2xvq-fx4p before packaging the public server runtime.
- Restored unversioned streaming and batch API compatibility on top of the v1 run lifecycle and persisted schema.
- Fixed `livedoc-server --version` so it reports the installed package version instead of a hardcoded value.
- Fixed run lifecycle status handling so early test failures do not end active invocations and late test updates cannot replace a runner-provided terminal status.
- Fixed shutdown so active WebSocket clients are closed before HTTP shutdown, preventing Ctrl-C from hanging while a viewer tab is connected.
