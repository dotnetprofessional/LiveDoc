# Validation Report — livedoc-xunit

## Result: PASS

## Checks

| Check | Status |
| --- | --- |
| Frontmatter `name` present | ✅ |
| Frontmatter `description` present | ✅ |
| Description ≤ 100 words | ✅ (31 words) |
| Body ≤ 500 lines | ✅ (383 lines) |
| `## Use this skill when` | ✅ |
| `## Do not use this skill when` | ✅ |
| `## Inputs` | ✅ |
| `## Outputs` | ✅ |
| `## Workflow` | ✅ |
| `## Validation` | ✅ |
| `## Examples` | ✅ |
| `### Positive routing examples` | ✅ |
| `### Negative routing examples` | ✅ |
| `## Failure handling` | ✅ |
| Routing examples file (`examples/routing.md`) | ✅ |

## Assumptions
- Tests target .NET 8.0 using xUnit 2.9.x
- The `SweDevTools.LiveDoc.xUnit` package is available via project reference within the monorepo
- `LiveDocTest` has been removed; use `FeatureTest` or `SpecificationTest`
- `SetExampleData()` is no longer needed — example data is auto-injected
- `ITestOutputHelper` is always injected by xUnit; constructor must pass it to `base(output)`
