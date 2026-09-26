# Attachments and Evidence

LiveDoc xUnit already supports evidence from `FeatureTest` and
`SpecificationTest` subclasses:

- `Attach(base64Data, mimeType, title, kind)`
- `AttachScreenshot(base64Data, title)`
- `AttachFile(filePath, title)`
- `AttachJson(data, title)`

Call these methods inside a Feature step or a Specification Rule/RuleOutline.
Calls within a step export under that step's `execution.attachments`; calls
inside a Rule export under the Rule's `execution.attachments`. Each RuleOutline
row exports its *own* attachments under `exampleResults[].result.attachments`,
keyed by the outline's `testId` and that example's `rowId`. The outline's
aggregate execution does not collect attachments across rows.

Multiple calls add multiple attachments. Attach before an assertion when
capturing evidence of a possible failure: code after a failing assertion will
not run. `AttachJson` accepts an object or a raw JSON string. `AttachFile`
detects image MIME types, `.mmd`/`.mermaid` as `text/vnd.mermaid`, and `.pdf`
as `application/pdf`; other unrecognized extensions use
`application/octet-stream`. A custom title does not prevent Mermaid preview.

Use evidence when it helps a reader understand a meaningful state or failure.
Feature journeys commonly benefit from screenshots and response attachments;
technical Specifications may also attach evidence when the contract requires it.

Evidence is not an assertion. Always assert the behavior; attach the artifact
before the assertion if a failure needs it, or after a successful assertion.

When request JSON or an independently authored expected response defines the
behavior, place it in the step's optional Markdown `description` so readers see
it inline. Use attachments for supplementary evidence, downloads, screenshots,
or large diagnostics.

Never attach credentials, tokens, cookies, authorization headers, unredacted
personal data, or arbitrary process output that may contain secrets.
