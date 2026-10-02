### 2026-09-23: Vitest rule attachment ownership and v1 export contract
**By:** Wash
**What:** RuleContext and StepContext share the attachment API; each plain Rule or RuleExample owns an isolated attachment array, never the RuleOutline declaration.
**Why:** Failed test evidence must survive the Vitest worker boundary and reach the viewer on the matching execution. Rule handlers sync arrays into their respective task metadata in `finally`; LiveDocSpecReporter reconstructs the arrays; LiveDocViewerReporterV1 exports plain rule evidence in `Rule.execution.attachments` and each example's evidence in `RuleOutline.exampleResults[]` as `{testId:outlineId,result:{rowId,...,attachments}}`. V1 schema and server storage already support ExecutionResult attachments; neither needs modification.
**References:** `packages/vitest/_src/app/model/AttachmentContext.ts`, `packages/vitest/_src/app/reporter/LiveDocViewerReporterV1.ts`, `packages/schema/src/reporter-v1-wire.ts`
