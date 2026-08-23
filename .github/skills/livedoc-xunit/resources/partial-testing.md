# Tag-Scoped Partial Testing

Use tags as the primary selector for incremental validation. Fully qualified
names are a fallback when no stable capability tag exists.

## Viewer Contract

1. Publish at least one full run for the project and environment.
2. Select only the affected categories and set `LIVEDOC_RUN_TYPE=partial`.
3. The server composes the focused results over the latest full baseline.
4. The Viewer can show the Combined result or only that partial invocation.

Tests omitted from a partial invocation keep their baseline result. Partial runs
require a running server and cannot be exported directly as static JSON.

## v0.2.0-beta.2 Filtering Limitation

LiveDoc `[Tag]` values are currently published as report metadata but are not
exposed as xUnit runner traits. Until runner-filterable `[Tag]` support lands,
pair the LiveDoc tag with an xUnit category:

```csharp
[Tag("checkout")]
[Trait("Category", "checkout")]
[Feature("Checkout")]
public class CheckoutTests : FeatureTest
{
    [Tag("pricing")]
    [Trait("Category", "pricing")]
    [Scenario("A discount is applied")]
    public void Discount_is_applied() { }
}
```

The duplicate attributes are a temporary compatibility measure. Do not claim
that `dotnet test --filter` can select `[Tag]` directly in this version.

## Agent Workflow

1. Identify the smallest stable capability categories affected by the change.
2. Prefer domain categories such as `checkout`, `pricing`, or `authentication`.
3. Do not add temporary `changed` categories or select by class name when a
   capability category exists.
4. Run the affected categories as a partial:

```powershell
$env:LIVEDOC_RUN_TYPE = "partial"
try {
    dotnet test --filter "Category=checkout|Category=pricing"
}
finally {
    Remove-Item Env:\LIVEDOC_RUN_TYPE -ErrorAction SilentlyContinue
}
```

```bash
LIVEDOC_RUN_TYPE=partial dotnet test --filter "Category=checkout|Category=pricing"
```

5. Use `FullyQualifiedName` filtering only when the affected behavior has no
   category.
6. Run and publish a full suite before release, merge, or whenever the baseline
   may be stale.

## Failure Handling

- `[Tag]` selects no tests: add the temporary matching `[Trait("Category",
  "...")]` until runner-filterable tags are available.
- The Viewer loses unaffected results: the run was published as `full`; repeat
  with `LIVEDOC_RUN_TYPE=partial`.
- Combined view is unavailable: publish a full baseline with the same project
  and environment first.
- Static export fails: partial runs are server-only; use a full run for exports.
