# @swedevtools/livedoc-vitest Changelog

All notable changes to the LiveDoc Vitest SDK are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

### Changed

- Reorganized SDK tests into capability-focused sections so the suite doubles as clearer living documentation.
- Set the default published project name to `livedoc` so multiple projects are easier to distinguish in the viewer.
- Improved viewer autodiscovery by probing the local viewer when the temporary server metadata file is unavailable.

### Fixed

- Fixed specification tag rendering and serialization, including slash-style tags such as `@name/name`.
- Fixed LiveDoc filtering output so filtered tests are omitted from viewer/export results instead of appearing as pending or skipped.
