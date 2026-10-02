### 2026-09-25T19-47-34: Outline step evidence is selected-row-only
**By:** Mal
**What:** Outline step evidence is selected-row-only
**References:** dotnet/xunit/src/Core/LiveDocContext.cs, packages/viewer/src/client/components/nodeviews/OutlineNodeView.tsx
**Why:** ScenarioOutline and RuleOutline template steps provide titles/structure, not authoritative execution evidence. The Viewer clears template step execution when no example is selected and uses only matching rowId + step testId results for selected steps; missing per-row step results must not fall back to template evidence. xUnit exports attachments (and errors) on each per-row step result so changing rows cannot leak first-example evidence. Covered by xUnit export assertions and Viewer browser regressions.