# @swedevtools/livedoc-server Changelog

All notable changes to the LiveDoc Server are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

- Fixed shutdown so active WebSocket clients are closed before HTTP shutdown, preventing Ctrl-C from hanging while a viewer tab is connected.
