# @swedevtools/livedoc-vitest Changelog

All notable changes to the LiveDoc Vitest SDK are documented in this file.

Use the `[next release]` section for changes that have not yet been promoted into a named package release, including temporary `0.0.0.x` builds.

## [next release]

## [0.3.0] - 2026-08-29

### Added

- Added explicit full and partial Viewer publishing so focused development runs preserve the latest full test picture.
- Added optional Vitest coverage evidence from the in-memory coverage map, with JSON summary and LCOV artifact fallbacks.
- Added configurable coverage thresholds for lines, branches, functions, and statements; threshold misses are Viewer warnings and do not change test status.

### Changed

- Changed package exports to ESM-only because Vitest 4 cannot be loaded through CommonJS `require()`.
- Reorganized SDK tests into capability-focused sections so the suite doubles as clearer living documentation.
- Expanded the packaged AI skill with boundary-first test selection, false-green checks, rule-violation self-correction, web-runtime guidance, tag-scoped partial runs, LiveDoc-specific anti-patterns, and a consent-gated workflow for reporting verified LiveDoc framework defects upstream.
- Added OpenAI Codex and comma-separated multi-tool selection to the repository-local AI skill installer.
- Set the default published project name to `livedoc` so multiple projects are easier to distinguish in the viewer.
- Improved viewer autodiscovery by probing the local viewer when the temporary server metadata file is unavailable.

### Fixed

- Fixed invalid nested LiveDoc declarations so feature, scenario, outline, background, specification, and rule nesting fails explicitly instead of silently dropping executable coverage.
- Fixed dynamic execution resets so each run retains LiveDoc's recommended default rule configuration without leaking caller overrides.
- Removed the optional `@swedevtools/livedoc-server` peer contract because Server is embedded in Viewer rather than installed independently, while keeping discovery as an external dynamic import.
- Bundled private Schema types into published declarations so strict TypeScript consumers do not need unpublished workspace packages.
- Corrected the Vitest peer range to the tested `>=4.0.16 <5` contract instead of claiming unsupported Vitest 1-3 compatibility.
- Fixed specification tag rendering and serialization, including slash-style tags such as `@name/name`.
- Fixed LiveDoc filtering output so filtered tests are omitted from viewer/export results instead of appearing as pending or skipped.
- Fixed Viewer publication so coverage context, artifact paths, and run type flow through auto-discovered and explicitly configured reporters.
