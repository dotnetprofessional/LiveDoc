# Validation Report - livedoc-xunit

## Result: PASS

## Checks

| Check | Status |
| --- | --- |
| Frontmatter `name` present | PASS |
| Frontmatter `description` present | PASS |
| Description <= 100 words | PASS (40 words) |
| Body <= 500 lines | PASS (392 lines) |
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
| Shared Journey collection lifecycle guidance | PASS |
| Repeated server-start diagnostic and validation command | PASS |
| Canonical and package-shipped Journey guidance aligned | PASS |
| Inline Markdown/JSON step description guidance | PASS |
| Per-invocation Background/After hooks and Background-aware Given rule | PASS |
| Rule and per-example attachments; Mermaid/PDF MIME detection | PASS |
| Newly generated Journey tests compile on the first build | PASS |
| `nameof` titles and Rule/RuleOutline descriptions remain distinct | PASS |
| Unreleased API availability distinguished from package version | PASS |
| Source and package-shipped copies aligned | PASS |

The next-release changelog was checked against the author-facing Feature,
Specification, Journey, and evidence guidance. Standard xUnit theory export,
localhost discovery, and internal regression-suite changes do not require
new test-authoring instructions.

Both copies pass the skill-factory manifest checks (40-word description,
392-line body). On Windows the validator sees `SKILL.md` and `skill.md`
as the same path and reports a false duplicate; validation used an in-memory
manifest-path override without modifying the validator or relaxing its checks.

## Assumptions

- Tests use `SweDevTools.LiveDoc.xUnit` with a supported .NET target.
- Feature, Specification, and Journey patterns remain separate reporting choices.
- Native .NET tools own load, fuzz, benchmark, and mutation execution.
- Attachments are supporting evidence and are redacted before publication.
- APIs in `[next release]` require a build containing them; the `0.3.0.3`
  version alone does not prove they are available in an installed package.
