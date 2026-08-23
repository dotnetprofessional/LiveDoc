# @swedevtools/livedoc-server Changelog

All notable changes to the LiveDoc Server are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

- Added full/partial run lifecycles, raw physical history, server-composed historical views, active-run fencing, and completed-only latest snapshots.
- Added durable post-run coverage attachment with WebSocket notification and REST hydration support.
- Added logical run composition that preserves physical source-project provenance while presenting related runs as one product-level view.
- Added actionable diagnostics for invalid persisted runs and invalid coverage blocks instead of failing server startup.
- Preserved scenario-level failure errors while recomputing aggregate status and duration from streamed step results.
- Fixed shutdown so active WebSocket clients are closed before HTTP shutdown, preventing Ctrl-C from hanging while a viewer tab is connected.
