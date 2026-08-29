# Validation Report — livedoc-vitest

## Result: PASS

## Checks

| Check | Status |
| --- | --- |
| Frontmatter `name` present | ✅ |
| Frontmatter `description` present | ✅ |
| Description ≤ 100 words | ✅ (28 words) |
| Body ≤ 500 lines | ✅ (334 lines) |
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
| Boundary-first strategy resource | ✅ |
| jsdom/real-browser guidance | ✅ |
| False-green anti-pattern catalogue | ✅ |
| Tag-scoped partial-testing workflow | ✅ |
| Framework defect verification and duplicate search | ✅ |
| Sanitized draft and explicit consent before submission | ✅ |
| Rule-violation self-correction gate | ✅ |
| Source and package-shipped copies aligned | ✅ |

## Assumptions
- Tests are written in TypeScript and use Vitest as the test runner
- The `@swedevtools/livedoc-vitest` package is available in the monorepo via `workspace:*`
- Globals mode may or may not be enabled; skill covers both import and globals patterns
- The existing `.github/instructions/livedoc-vitest.instructions.md` remains the file-pattern instruction; this skill provides broader AI-agent guidance
