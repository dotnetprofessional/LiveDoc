# Validation Report - livedoc-xunit

## Result: PASS

## Checks

| Check | Status |
| --- | --- |
| Frontmatter `name` present | PASS |
| Frontmatter `description` present | PASS |
| Description <= 100 words | PASS (40 words) |
| Body <= 500 lines | PASS (416 lines) |
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
| Local release APIs distinguished from future changes | PASS |
| Purpose-first descriptions stay within tested boundaries | PASS |
| Features and Specifications share capability namespaces; product readers can inspect Rules | PASS |
| Complete declared namespaces govern Viewer folders independently of assembly names; class names remain document leaves | PASS |
| Generated Journey base namespace option preserves capability grouping | PASS |
| Safe API request/response evidence and pre-assertion capture | PASS |
| Source and package-shipped copies aligned | PASS |

The `0.3.0.4` changelog was checked against the author-facing Feature,
Specification, Journey, and evidence guidance. Standard xUnit theory export,
localhost discovery, and internal regression-suite changes do not require
new test-authoring instructions.

Both copies pass the skill-factory manifest checks (40-word description,
416-line body). On Windows the validator sees `SKILL.md` and `skill.md`
as the same path and reports a false duplicate; validation called its
`validate_manifest` on the actual `SKILL.md` for each copy without modifying
the validator or relaxing its checks.

## Assumptions

- Tests use `SweDevTools.LiveDoc.xUnit` with a supported .NET target.
- Feature, Specification, and Journey patterns remain separate reporting choices.
- Native .NET tools own load, fuzz, benchmark, and mutation execution.
- Attachments are supporting evidence and are redacted before publication.
- Future APIs in `[next release]` require a build containing them; the
  `0.3.0.4` local testing build includes the features listed in its section.
