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

### JSON token values (0.4.0)

`AttachJson` preserves Newtonsoft.Json `JObject`, `JArray`,
and JSON-compatible `JValue` values, including tokens nested in CLR objects,
arrays, lists, or dictionaries. Newtonsoft.Json 13.0.3 is a runtime dependency.
Ordinary CLR objects still use System.Text.Json, including its property
attributes and defaults; raw JSON strings still pass through byte-for-byte.
String tokens are encoded as JSON strings, not as unquoted `JValue.ToString()`
text. Titles, `application/json` MIME, and UTF-8/base64 evidence are unchanged.

Standalone `JProperty`, `JConstructor`, `JRaw`, undefined, and comment tokens
throw an actionable `JsonException` instead of recording misleading evidence.
Place properties inside a `JObject` and parse raw JSON into a standard token
before attaching it. Serialization errors remain visible; no empty fallback
attachment is recorded.

This support is included in `0.4.0` and was first verified in the rebuilt
local `0.3.0.7` package.
Implementation: `dotnet\xunit\src\LiveDocTestBase.cs`, `AttachJson`, and
`dotnet\xunit\src\Core\NewtonsoftJsonTokenConverterFactory.cs`.
Regression coverage: `dotnet\xunit\tests\AttachingEvidence\Json_Token_Evidence_Spec.cs`;
the receipt Scenario in `Attachment_Api_Spec.cs` exercises Feature-step evidence.
Verify the decoded exported attachment JSON, not merely the input object's properties.

Use evidence when it helps a reader understand a meaningful state or failure.
Feature journeys commonly benefit from screenshots and response attachments;
technical Specifications may also attach evidence when the contract requires it.

Evidence is not an assertion. Always assert the behavior; attach the artifact
before the assertion if a failure needs it, or after a successful assertion.

When request JSON or an independently authored expected response defines the
behavior, place it in the step's optional Markdown `description` so readers see
it inline. Use attachments for supplementary evidence, downloads, screenshots,
or large diagnostics. For API tests, record only safe request fields and the
expected contract in authored prose; select and attach non-sensitive fields
from the **actual** response using `AttachJson`. Capture them before a
potentially failing `AssertStep` or payload assertion, so failure evidence
survives. See `resources/journey-testing.md` for a concrete Journey recipe.

For Journeys, the `.http` file contains the authored request and
`.Response.json` is an expected contract, **not** an actual-response attachment.
The generated Journey test does not attach exchanges automatically. Access
`run.Steps[name].ResponseBody` after reaching a named request; there is no
structured request-body property on `StepResult`. Avoid raw `run.Output`,
`step.Output`, headers, and unreviewed full bodies: assertions and exports may
otherwise disclose tokens or personal data. On failure, `AssertStep` may also
include raw httpYac output in its exception; use non-sensitive test fixtures
and restrict access to logs and exported reports even when attachments are
filtered.

Never attach credentials, tokens, cookies, authorization headers, unredacted
personal data, or arbitrary process output that may contain secrets.
