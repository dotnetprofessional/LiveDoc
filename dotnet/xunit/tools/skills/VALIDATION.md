# Validation Report - livedoc-xunit

## Result: PASS

## Checks

| Check | Status |
| --- | --- |
| Frontmatter `name` present | PASS |
| Frontmatter `description` present | PASS |
| Description <= 100 words | PASS (40 words) |
| Body <= 500 lines | PASS (378 lines) |
| `## Use this skill when` | PASS |
| `## Do not use this skill when` | PASS |
| `## Inputs` | PASS |
| `## Outputs` | PASS |
| `## Workflow` | PASS |
| `## Validation` | PASS |
| `## Examples` | PASS |
| `### Positive routing examples` | PASS |
| `### Negative routing examples` | PASS |
| `## Failure handling` | PASS |
| Routing examples file (`examples/routing.md`) | PASS |
| Boundary and isolation strategy resource | PASS |
| Attachment and evidence guidance | PASS |
| False-green anti-pattern catalogue | PASS |
| Tag-scoped partial-testing workflow | PASS |
| Framework defect verification and duplicate search | PASS |
| Sanitized draft and explicit consent before submission | PASS |
| Rule-violation self-correction gate | PASS |
| Source and package-shipped copies aligned | PASS |

## Assumptions

- Tests use `SweDevTools.LiveDoc.xUnit` with a supported .NET target.
- Feature, Specification, and Journey patterns remain separate reporting choices.
- Native .NET tools own load, fuzz, benchmark, and mutation execution.
- Attachments are supporting evidence and are redacted before publication.
