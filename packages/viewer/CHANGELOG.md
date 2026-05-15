# @swedevtools/livedoc-viewer Changelog

All notable changes to the LiveDoc Viewer are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

### Added

- Added a version badge so installed and release viewer builds are easier to identify.

### Fixed

- Fixed rendering for named placeholders such as `<operation:multiply>` and `<factor:3>`.
- Fixed Ctrl-C shutdown so the viewer exits cleanly instead of repeatedly printing the graceful shutdown message while a browser tab is connected.
