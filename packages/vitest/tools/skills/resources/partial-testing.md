# Tag-Scoped Partial Testing

Use tags as the primary selector for incremental validation. File paths and test
titles are fallback selectors when no stable capability tag exists.

## Viewer Contract

1. Publish at least one successful full run for the project and environment.
2. Run the affected tags with `LIVEDOC_RUN_TYPE=partial`.
3. The server stores the focused invocation and composes it over the latest full
   baseline.
4. The Viewer can show the Combined result or only that partial invocation.

Tests omitted from a partial invocation keep their baseline result. Partial runs
require server history and cannot be written directly as static JSON.

## Configure a Tag Selector

LiveDoc Vitest exposes tag filters through `livedoc.options.filters`. Use this
setup convention so agents and scripts can select tags without editing source:

```typescript
// test/livedoc.setup.ts
import { livedoc } from "@swedevtools/livedoc-vitest";

const requestedTags = process.env.LIVEDOC_TAGS
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith("@") ? tag : `@${tag}`);

if (requestedTags?.length) {
    livedoc.options.filters.include = requestedTags;
}
```

Register the file through Vitest `setupFiles`. `LIVEDOC_TAGS` is a project setup
convention implemented by this file; the framework reads the resulting
`filters.include` values.

## Agent Workflow

1. Identify the smallest stable capability tags affected by the code change.
2. Prefer domain tags such as `@checkout`, `@pricing`, or `@authentication`.
3. Do not add temporary `@changed` tags or rewrite tests solely for selection.
4. Run the affected tags as a partial:

```powershell
$env:LIVEDOC_TAGS = "checkout,pricing"
$env:LIVEDOC_RUN_TYPE = "partial"
try {
    pnpm exec vitest run
}
finally {
    Remove-Item Env:\LIVEDOC_TAGS -ErrorAction SilentlyContinue
    Remove-Item Env:\LIVEDOC_RUN_TYPE -ErrorAction SilentlyContinue
}
```

```bash
LIVEDOC_TAGS=checkout,pricing LIVEDOC_RUN_TYPE=partial pnpm exec vitest run
```

5. Use file or `-t` filtering only when the affected behavior has no suitable
   tag.
6. Run and publish a full suite before release, merge, or whenever the baseline
   may be stale.

## Failure Handling

- No tests execute: verify the setup file is registered and tags include the
  `@` prefix after normalization.
- The Viewer loses unaffected results: the run was published as `full`; repeat
  with `LIVEDOC_RUN_TYPE=partial`.
- Combined view is unavailable: publish a full baseline with the same project
  and environment first.
- Static export fails: partial runs are server-only; use a full run for exports.
