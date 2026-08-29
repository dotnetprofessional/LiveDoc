# Attachments and Evidence

LiveDoc xUnit already supports evidence from `FeatureTest` and
`SpecificationTest` subclasses:

- `Attach(base64Data, mimeType, title, kind)`
- `AttachScreenshot(base64Data, title)`
- `AttachFile(filePath, title)`
- `AttachJson(data, title)`

Use evidence when it helps a reader understand a meaningful state or failure.
Feature journeys commonly benefit from screenshots and response attachments;
technical Specifications may also attach evidence when the contract requires it.

Evidence is not an assertion. Assert the behavior first, then attach the artifact.

Never attach credentials, tokens, cookies, authorization headers, unredacted
personal data, or arbitrary process output that may contain secrets.
