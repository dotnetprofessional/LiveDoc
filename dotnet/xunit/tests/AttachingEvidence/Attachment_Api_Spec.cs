using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Newtonsoft.Json.Linq;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.AttachingEvidence;

/// <summary>
/// Feature: Attachment API
///
/// The attachment API allows test authors to attach artifacts (screenshots,
/// JSON responses, files) to individual test steps for living documentation.
/// </summary>
[Feature("Attachment API", Description = @"
    The attachment API on LiveDocTestBase provides Attach(), AttachScreenshot(),
    AttachFile(), and AttachJson() methods. Attachments are collected per-step
    and included in the reporter output as base64-encoded data with metadata.")]
[Tag("attachments")]
public class Attachment_Api_Spec : FeatureTest
{
    public Attachment_Api_Spec(ITestOutputHelper output) : base(output) { }

    #region Helpers

    /// <summary>
    /// Retrieves collected attachments via reflection. In the BDD (Feature) pattern,
    /// attachments are flushed from _currentStepAttachments into each StepExecution
    /// at step completion, so we collect from the completed _steps list.
    /// </summary>
    private List<Attachment> GetAttachments()
    {
        var contextField = typeof(LiveDocTestBase)
            .GetField("_context", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var context = contextField.GetValue(this);
        if (context == null)
            return new List<Attachment>();

        var stepsField = typeof(LiveDocContext)
            .GetField("_steps", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var steps = stepsField.GetValue(context) as List<StepExecution>;
        if (steps == null)
            return new List<Attachment>();

        var allAttachments = new List<Attachment>();
        foreach (var step in steps)
        {
            if (step.Attachments != null)
                allAttachments.AddRange(step.Attachments);
        }
        return allAttachments;
    }

    private static string ToBase64(string text) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(text));

    private static object CreateCollectionEvidence(
        int serviceCount,
        int recordCount,
        int dependencyCount,
        int checksPerDependency,
        int itemsPerRecord,
        int descriptionRepeats,
        string descriptionToken,
        string city,
        int httpStatusCode,
        bool active,
        bool maintenance) => new
        {
            documentType = "collection-validation",
            services = Enumerable.Range(1, serviceCount).Select(index => new
            {
                id = index,
                name = $"sample-service-{index:D2}",
                endpoint = $"https://sample-service-{index:D2}.example.invalid/health",
                enabled = active
            }).ToArray(),
            summary = new { city, recordCount, serviceCount },
            records = Enumerable.Range(1, recordCount).Select(index => new
            {
                id = index,
                name = $"sample-record-{index:D2}",
                location = new { city, zone = $"sample-zone-{index:D2}" },
                items = Enumerable.Range(1, itemsPerRecord).Select(item => new
                {
                    sku = $"sample-item-{item:D2}",
                    quantity = item,
                    available = active
                }).ToArray(),
                notes = descriptionToken
            }).ToArray(),
            Error = new
            {
                httpStatusCode,
                dependencies = Enumerable.Range(1, dependencyCount).Select(index => new
                {
                    service = $"sample-dependency-{index:D2}",
                    httpStatusCode,
                    checks = Enumerable.Range(1, checksPerDependency).Select(check => new
                    {
                        name = $"sample-check-{check:D2}",
                        healthy = maintenance,
                        detail = new { message = descriptionToken, retryAfter = (int?)null }
                    }).ToArray()
                }).ToArray()
            },
            emptyArray = Array.Empty<object>(),
            emptyObject = new { },
            optional = (string?)null,
            active,
            maintenance,
            description = string.Concat(Enumerable.Repeat(descriptionToken, descriptionRepeats))
        };

    #endregion

    #region 1. Basic Attach() Method

    [Scenario("Attach with base64 data and mimeType 'text/plain' stores kind 'file'")]
    public void Attach_stores_kind_file()
    {
        string? data = null;
        string? mimeType = null;

        Given("base64 data 'dGVzdA==' with mimeType 'text/plain'", ctx =>
        {
            (data, mimeType) = ctx.Step!.Values.As<string, string>();
        });

        When("the data is attached", () => Attach(data!, mimeType!));

        Then("the attachment kind should be 'file'", ctx =>
        {
            var expectedKind = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedKind, attachments[0].Kind);
        });

        And("the mimeType should be 'text/plain'", ctx =>
        {
            var expectedMimeType = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(expectedMimeType, attachments[0].MimeType);
        });

        And("the base64 data should be 'dGVzdA=='", ctx =>
        {
            var expectedData = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(expectedData, attachments[0].Base64);
        });
    }

    [Scenario("Attach with custom kind 'screenshot' stores that kind value")]
    public void Attach_with_custom_kind()
    {
        string? data = null;
        string? mimeType = null;
        string? kind = null;

        Given("base64 data 'dGVzdA==' with mimeType 'image/png' and custom kind 'screenshot'", ctx =>
        {
            (data, mimeType, kind) = ctx.Step!.Values.As<string, string, string>();
        });

        When("the data is attached with the custom kind", () =>
            Attach(data!, mimeType!, kind: kind!));

        Then("the attachment kind should be 'screenshot'", ctx =>
        {
            var expectedKind = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedKind, attachments[0].Kind);
        });
    }

    [Scenario("Attach with title 'Login page capture' stores the title")]
    public void Attach_with_title()
    {
        string? title = null;

        Given("an attachment with title 'Login page capture'", ctx =>
        {
            title = ctx.Step!.Values[0].AsString();
        });

        When("the attachment is created with that title", () =>
            Attach("dGVzdA==", "text/plain", title: title));

        Then("the attachment title should be 'Login page capture'", ctx =>
        {
            var expectedTitle = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedTitle, attachments[0].Title);
        });
    }

    [Scenario("Each attachment gets a unique non-empty ID")]
    public void Each_attachment_gets_unique_id()
    {
        string? firstData = null;
        string? secondData = null;

        Given("attachment data 'AAAA' and 'BBBB'", ctx =>
        {
            (firstData, secondData) = ctx.Step!.Values.As<string, string>();
        });

        When("two attachments are created", () =>
        {
            Attach(firstData!, "text/plain");
            Attach(secondData!, "text/plain");
        });

        Then("each should have a distinct non-empty ID", () =>
        {
            var attachments = GetAttachments();
            Assert.Equal(2, attachments.Count);
            Assert.NotEqual(attachments[0].Id, attachments[1].Id);
            Assert.All(attachments, a => Assert.False(string.IsNullOrEmpty(a.Id)));
        });
    }

    #endregion

    [Scenario("Receipt JSON evidence preserves action 'Finish', ID 'fixture-id', and type 'Example' across object and array representations")]
    [Tag("json, json-tokens, receipt-evidence")]
    public void Receipt_JSON_evidence_preserves_object_and_array_values()
    {
        JObject? payload = null;
        object? clr = null;
        Given("a receipt with action 'Finish', ID 'fixture-id', and type 'Example'", ctx =>
        {
            var (action, id, type) = ctx.Step!.Values.As<string, string, string>();
            payload = new JObject
            {
                ["action"] = action,
                ["receipt"] = new JObject { ["id"] = id, ["type"] = type }
            };
            clr = new { action, receipt = new { id, type } };
        });
        When("the object, token array, pre-serialized array, and CLR array are attached", () =>
        {
            AttachJson(payload!, "Receipt object");
            AttachJson(new[] { payload! }, "Receipt token array");
            AttachJson(Newtonsoft.Json.JsonConvert.SerializeObject(new[] { payload! }), "Receipt raw array control");
            AttachJson(new[] { clr! }, "Receipt CLR array control");
        });
        Then("decoded object JSON is '{\"action\":\"Finish\",\"receipt\":{\"id\":\"fixture-id\",\"type\":\"Example\"}}' and each decoded array contains that object", ctx =>
        {
            var expected = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(4, attachments.Count);
            foreach (var attachment in attachments)
            {
                Assert.Equal("application/json", attachment.MimeType);
                Assert.Equal("file", attachment.Kind);
                var decoded = new UTF8Encoding(false, true).GetString(Convert.FromBase64String(attachment.Base64!));
                var expectedJson = attachment.Title == "Receipt object" ? expected : $"[{expected}]";
                Assert.True(JsonNode.DeepEquals(JsonNode.Parse(expectedJson), JsonNode.Parse(decoded)),
                    $"{attachment.Title}: expected JSON {expectedJson}; recorded JSON {decoded}");
            }
        });
    }

    #region 2. AttachScreenshot() Convenience

    [Scenario("AttachScreenshot produces kind 'screenshot' and mimeType 'image/png'")]
    public void AttachScreenshot_defaults()
    {
        string? data = null;

        Given("screenshot data 'iVBORw0KGgo='", ctx =>
            data = ctx.Step!.Values[0].AsString());

        When("the screenshot is attached", () => AttachScreenshot(data!));

        Then("the attachment kind should be 'screenshot'", ctx =>
        {
            var expectedKind = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedKind, attachments[0].Kind);
        });

        And("the mimeType should be 'image/png'", ctx =>
        {
            var expectedMimeType = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(expectedMimeType, attachments[0].MimeType);
        });

        And("the base64 data should be 'iVBORw0KGgo='", ctx =>
        {
            var expectedData = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(expectedData, attachments[0].Base64);
        });
    }

    [Scenario("AttachScreenshot with title 'Error dialog' stores the title")]
    public void AttachScreenshot_with_title()
    {
        string? title = null;

        Given("a screenshot title 'Error dialog'", ctx =>
            title = ctx.Step!.Values[0].AsString());

        When("the screenshot is attached with that title", () =>
            AttachScreenshot("iVBORw0KGgo=", title));

        Then("the attachment title should be 'Error dialog'", ctx =>
        {
            var expectedTitle = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedTitle, attachments[0].Title);
        });

        And("the kind should be 'screenshot'", ctx =>
        {
            var expectedKind = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(expectedKind, attachments[0].Kind);
        });
    }

    #endregion

    #region 3. AttachJson() Convenience

    [Scenario("AttachJson with an anonymous object serializes as indented JSON")]
    public void AttachJson_anonymous_object()
    {
        object? payload = null;

        Given("an object containing name 'Alice' and age '30'", ctx =>
        {
            var (name, age) = ctx.Step!.Values.As<string, int>();
            payload = new { name, age };
        });

        When("AttachJson is called with the object", () => AttachJson(payload!));

        Then("the decoded JSON should contain the serialized name and age", () =>
        {
            var attachments = GetAttachments();
            Assert.Single(attachments);
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
            Assert.Contains("\"name\": \"Alice\"", json);
            Assert.Contains("\"age\": 30", json);
            Assert.Contains("\n", json);
        });
    }

    [Scenario("AttachJson with a raw JSON string passes it through without double-serialization")]
    public void AttachJson_string_passthrough()
    {
        string? rawJson = null;

        Given("a raw JSON string", () => rawJson = "{\"key\":\"value\"}");

        When("AttachJson is called with a raw JSON string", () =>
        {
            AttachJson(rawJson!);
        });

        Then("the decoded output should match the original string exactly", () =>
        {
            var attachments = GetAttachments();
            Assert.Single(attachments);
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
            Assert.Equal(rawJson, decoded);
        });
    }

    [Scenario("AttachJson produces kind 'file' and mimeType 'application/json'")]
    public void AttachJson_metadata()
    {
        object? payload = null;

        Given("an object payload", () => payload = new { test = true });

        When("AttachJson is called with the object", () => AttachJson(payload!));

        Then("the attachment kind should be 'file'", ctx =>
        {
            var expectedKind = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedKind, attachments[0].Kind);
        });

        And("the mimeType should be 'application/json'", ctx =>
        {
            var expectedMimeType = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Equal(expectedMimeType, attachments[0].MimeType);
        });
    }

    [Scenario("AttachJson with nested objects containing city 'Sydney' serializes correctly")]
    public void AttachJson_nested_objects()
    {
        object? payload = null;

        Given("a nested object containing city 'Sydney'", ctx =>
        {
            var city = ctx.Step!.Values[0].AsString();
            payload = new
            {
                user = new { name = "Bob", address = new { city } },
                active = true
            };
        });

        When("AttachJson is called with the nested object", () => AttachJson(payload!));

        Then("the decoded JSON should contain the nested city and active flag", () =>
        {
            var attachments = GetAttachments();
            Assert.Single(attachments);
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
            Assert.Contains("\"city\": \"Sydney\"", json);
            Assert.Contains("\"active\": true", json);
        });
    }

    [Tag("json, attachments")]
    [Scenario("A large JSON document with root collections and nested dependencies is attached as evidence",
        Description = "Retains collection structure, metadata, and Unicode in serialized attachment evidence; does not assert Viewer rendering.")]
    public void AttachJson_large_root_collections_and_nested_dependencies()
    {
        object? payload = null;
        byte[]? attachmentBytes = null;
        int serviceCount = 0, recordCount = 0, dependencyCount = 0, checksPerDependency = 0, itemsPerRecord = 0;

        JsonDocument ReadEvidence() => JsonDocument.Parse(attachmentBytes!);

        Given("a document with '3' services, '24' records, '3' dependencies, '2' checks per dependency, and '3' items per record", ctx =>
        {
            (serviceCount, recordCount, dependencyCount, checksPerDependency, itemsPerRecord) =
                ctx.Step!.Values.As<int, int, int, int, int>();
        });

        And("its description repeats 'Collection validation — café 東京 🌿. ' '64' times, city is '東京', HTTP status is '503', active is 'true', and maintenance is 'false'", ctx =>
        {
            var (token, repeats, city, status, active, maintenance) =
                ctx.Step!.Values.As<string, int, string, int, bool, bool>();
            payload = CreateCollectionEvidence(
                serviceCount, recordCount, dependencyCount, checksPerDependency, itemsPerRecord,
                repeats, token, city, status, active, maintenance);
        });

        When("AttachJson attaches the document as 'Large JSON collection validation'", ctx =>
            AttachJson(payload!, ctx.Step!.Values[0].AsString()));

        Then("there is '1' attachment titled 'Large JSON collection validation' with MIME 'application/json' and kind 'file'", ctx =>
        {
            var (count, title, mimeType, kind) = ctx.Step!.Values.As<int, string, string, string>();
            var attachments = GetAttachments();
            Assert.Equal(count, attachments.Count);
            var attachment = Assert.Single(attachments);
            Assert.Equal(title, attachment.Title);
            Assert.Equal(mimeType, attachment.MimeType);
            Assert.Equal(kind, attachment.Kind);
            attachmentBytes = Convert.FromBase64String(attachment.Base64!);
        });

        And("the payload is valid UTF-8 JSON between '10240' and '30720' bytes with ordered root fields '[\"documentType\",\"services\",\"summary\",\"records\",\"Error\",\"emptyArray\",\"emptyObject\",\"optional\",\"active\",\"maintenance\",\"description\"]'", ctx =>
        {
            var (minimumBytes, maximumBytes, fields) = ctx.Step!.Values.As<int, int, string[]>();
            Assert.InRange(attachmentBytes!.Length, minimumBytes, maximumBytes);
            var text = new UTF8Encoding(false, true).GetString(attachmentBytes);
            using var document = JsonDocument.Parse(text);
            Assert.Equal(fields, document.RootElement.EnumerateObject().Select(property => property.Name).ToArray());
        });

        And("the root type is 'collection-validation', services has '3' objects starting with 'sample-service-01', and records has '24' objects", ctx =>
        {
            var (documentType, expectedServices, firstService, expectedRecords) = ctx.Step!.Values.As<string, int, string, int>();
            using var document = ReadEvidence();
            var root = document.RootElement;
            Assert.Equal(documentType, root.GetProperty("documentType").GetString());
            var services = root.GetProperty("services");
            Assert.Equal(expectedServices, services.GetArrayLength());
            Assert.All(services.EnumerateArray(), service => Assert.Equal(JsonValueKind.Object, service.ValueKind));
            Assert.Equal(firstService, services[0].GetProperty("name").GetString());
            var records = root.GetProperty("records");
            Assert.Equal(expectedRecords, records.GetArrayLength());
            Assert.All(records.EnumerateArray(), record => Assert.Equal(JsonValueKind.Object, record.ValueKind));
            Assert.Equal(expectedServices, root.GetProperty("summary").GetProperty("serviceCount").GetInt32());
            Assert.Equal(expectedRecords, root.GetProperty("summary").GetProperty("recordCount").GetInt32());
        });

        And("records span IDs '1' to '24' named 'sample-record-01' to 'sample-record-24', each with '3' items and city '東京'", ctx =>
        {
            var (firstId, lastId, firstName, lastName, itemCount, city) =
                ctx.Step!.Values.As<int, int, string, string, int, string>();
            using var document = ReadEvidence();
            var root = document.RootElement;
            var records = root.GetProperty("records");
            Assert.Equal(firstId, records[0].GetProperty("id").GetInt32());
            Assert.Equal(lastId, records[records.GetArrayLength() - 1].GetProperty("id").GetInt32());
            Assert.Equal(firstName, records[0].GetProperty("name").GetString());
            Assert.Equal(lastName, records[records.GetArrayLength() - 1].GetProperty("name").GetString());
            Assert.Equal(city, root.GetProperty("summary").GetProperty("city").GetString());
            Assert.All(records.EnumerateArray(), record =>
            {
                Assert.Equal(city, record.GetProperty("location").GetProperty("city").GetString());
                var items = record.GetProperty("items");
                Assert.Equal(itemCount, items.GetArrayLength());
                Assert.All(items.EnumerateArray(), item => Assert.Equal(JsonValueKind.Object, item.ValueKind));
            });
        });

        And("Error fields are ordered '[\"httpStatusCode\",\"dependencies\"]' with status '503' and '3' dependencies starting with 'sample-dependency-01', each with '2' checks whose healthy flag is 'false'", ctx =>
        {
            var (fields, status, expectedDependencies, firstDependency, checkCount, healthy) =
                ctx.Step!.Values.As<string[], int, int, string, int, bool>();
            using var document = ReadEvidence();
            var error = document.RootElement.GetProperty("Error");
            Assert.Equal(fields, error.EnumerateObject().Select(property => property.Name).ToArray());
            Assert.Equal(status, error.GetProperty("httpStatusCode").GetInt32());
            var dependencies = error.GetProperty("dependencies");
            Assert.Equal(expectedDependencies, dependencies.GetArrayLength());
            Assert.Equal(firstDependency, dependencies[0].GetProperty("service").GetString());
            Assert.All(dependencies.EnumerateArray(), dependency =>
            {
                Assert.Equal(status, dependency.GetProperty("httpStatusCode").GetInt32());
                var checks = dependency.GetProperty("checks");
                Assert.Equal(checkCount, checks.GetArrayLength());
                Assert.All(checks.EnumerateArray(), check =>
                    Assert.Equal(healthy, check.GetProperty("healthy").GetBoolean()));
            });
        });

        And("emptyArray and emptyObject have '0' entries, optional is 'Null', active is 'true', and maintenance is 'false'", ctx =>
        {
            var (emptyCount, optionalKind, active, maintenance) =
                ctx.Step!.Values.As<int, JsonValueKind, bool, bool>();
            using var document = ReadEvidence();
            var root = document.RootElement;
            Assert.Equal(emptyCount, root.GetProperty("emptyArray").GetArrayLength());
            Assert.Equal(emptyCount, root.GetProperty("emptyObject").EnumerateObject().Count());
            Assert.Equal(optionalKind, root.GetProperty("optional").ValueKind);
            Assert.Equal(active, root.GetProperty("active").GetBoolean());
            Assert.Equal(maintenance, root.GetProperty("maintenance").GetBoolean());
        });

        And("the long description preserves 'Collection validation — café 東京 🌿. ' repeated '64' times and every record note preserves that Unicode text", ctx =>
        {
            var (token, repeats) = ctx.Step!.Values.As<string, int>();
            using var document = ReadEvidence();
            var root = document.RootElement;
            var description = root.GetProperty("description").GetString()!;
            Assert.Equal(token.Length * repeats, description.Length);
            for (var offset = 0; offset < description.Length; offset += token.Length)
                Assert.Equal(token, description.Substring(offset, token.Length));
            Assert.All(root.GetProperty("records").EnumerateArray(), record =>
                Assert.Equal(token, record.GetProperty("notes").GetString()));
        });
    }

    [Scenario("AttachJson with title 'API Response' stores the title")]
    public void AttachJson_with_title()
    {
        string? title = null;

        Given("an attachment title 'API Response'", ctx =>
            title = ctx.Step!.Values[0].AsString());

        When("AttachJson is called with the title", () =>
            AttachJson(new { status = "ok" }, title));

        Then("the attachment title should be 'API Response'", ctx =>
        {
            var expectedTitle = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal(expectedTitle, attachments[0].Title);
        });
    }

    #endregion

    #region 4. AttachFile() Convenience

    [Scenario("AttachFile reads a file from disk and creates a base64 attachment")]
    public void AttachFile_reads_disk()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), "livedoc-test-attach.txt");
        try
        {
            Given("a temp file containing 'hello from disk'", ctx =>
            {
                var content = ctx.Step!.Values[0].AsString();
                File.WriteAllText(tempFile, content);
            });

            When("AttachFile is called with that file", () =>
            {
                AttachFile(tempFile);
            });

            Then("the decoded base64 should equal 'hello from disk'", ctx =>
            {
                var expected = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Single(attachments);
                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
                Assert.Equal(expected, decoded);
            });

            And("the title should default to the filename 'livedoc-test-attach.txt'", ctx =>
            {
                var expectedTitle = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Equal(expectedTitle, attachments[0].Title);
            });

            And("the kind should be 'file'", ctx =>
            {
                var expectedKind = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Equal(expectedKind, attachments[0].Kind);
            });
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Scenario("AttachFile with a .png extension uses kind 'image' and mimeType 'image/png'")]
    public void AttachFile_detects_image_type()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), "livedoc-test-image.png");
        try
        {
            Given("a temp file with a .png extension", () =>
            {
                File.WriteAllBytes(tempFile, new byte[] { 0x89, 0x50, 0x4E, 0x47 });
            });

            When("AttachFile is called with that PNG file", () =>
            {
                AttachFile(tempFile);
            });

            Then("the attachment kind should be 'image'", ctx =>
            {
                var expectedKind = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Single(attachments);
                Assert.Equal(expectedKind, attachments[0].Kind);
            });

            And("the mimeType should be 'image/png'", ctx =>
            {
                var expectedMimeType = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Equal(expectedMimeType, attachments[0].MimeType);
            });
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Scenario("AttachFile with custom title 'My Document' overrides the filename")]
    public void AttachFile_custom_title()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), "livedoc-test-doc.pdf");
        try
        {
            Given("a temp PDF file on disk", () =>
            {
                File.WriteAllBytes(tempFile, new byte[] { 0x25, 0x50, 0x44, 0x46 });
            });

            When("AttachFile is called with custom title 'My Document'", ctx =>
            {
                var title = ctx.Step!.Values[0].AsString();
                AttachFile(tempFile, title);
            });

            Then("the attachment title should be 'My Document'", ctx =>
            {
                var expectedTitle = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Single(attachments);
                Assert.Equal(expectedTitle, attachments[0].Title);
            });

            And("the mimeType should be 'application/pdf'", ctx =>
            {
                var expectedMimeType = ctx.Step!.Values[0].AsString();
                var attachments = GetAttachments();
                Assert.Equal(expectedMimeType, attachments[0].MimeType);
            });
        }
        finally
        {
            File.Delete(tempFile);
        }
    }

    [Tag("mermaid")]
    [ScenarioOutline("AttachFile previews Mermaid from '<fileName>' with title '<requestedTitle>'")]
    [Example("workflow.mmd", "(default)", "workflow.mmd")]
    [Example("workflow.mermaid", "Workflow", "Workflow")]
    public void AttachFile_mermaid_source(string fileName, string requestedTitle, string expectedTitle)
    {
        var directory = Path.Combine(AppContext.BaseDirectory, $"mermaid-evidence-{Guid.NewGuid():N}");
        var filePath = Path.Combine(directory, fileName);
        string? source = null;
        try
        {
            Given("a Mermaid file containing a large 'sequenceDiagram' with 'alt', 'loop', and 'opt' paths", ctx =>
            {
                source = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "large-sequence.mmd"));
                Assert.StartsWith(ctx.Step!.Values[0].AsString(), source);
                foreach (var keyword in ctx.Step.ValuesRaw.Skip(1))
                    Assert.Contains($"\n    {keyword} ", source);
                Directory.CreateDirectory(directory);
                File.WriteAllBytes(filePath, Encoding.UTF8.GetBytes(source));
            });

            When("AttachFile uses <requestedTitle> for <fileName>", () =>
                AttachFile(filePath, requestedTitle == "(default)" ? null : requestedTitle));

            Then("the title is <expectedTitle> with MIME 'text/vnd.mermaid' and kind 'file'", ctx =>
            {
                var (mimeType, kind) = ctx.Step!.Values.As<string, string>();
                var attachment = Assert.Single(GetAttachments());
                Assert.Equal(expectedTitle, attachment.Title);
                Assert.Equal(mimeType, attachment.MimeType);
                Assert.Equal(kind, attachment.Kind);
                Assert.Equal(Encoding.UTF8.GetBytes(source!), Convert.FromBase64String(attachment.Base64!));
            });
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }

    [Tag("mermaid, attachments")]
    [Scenario("A large document-sync sequence diagram is attached as evidence")]
    public void Large_sequence_diagram_is_visible_in_the_viewer()
    {
        string? source = null;
        string? filePath = null;

        Given("a large 'sequenceDiagram' for document history and offline synchronization", ctx =>
        {
            filePath = Path.Combine(AppContext.BaseDirectory, "large-sequence.mmd");
            source = File.ReadAllText(filePath);
            Assert.StartsWith(ctx.Step!.Values[0].AsString(), source);
        });

        When("the diagram is attached with title 'Document sync sequence'", ctx =>
            AttachFile(filePath!, ctx.Step!.Values[0].AsString()));

        Then("the evidence has title 'Document sync sequence', MIME 'text/vnd.mermaid', and kind 'file'", ctx =>
        {
            var (title, mimeType, kind) = ctx.Step!.Values.As<string, string, string>();
            var attachment = Assert.Single(GetAttachments());
            Assert.Equal(title, attachment.Title);
            Assert.Equal(mimeType, attachment.MimeType);
            Assert.Equal(kind, attachment.Kind);
            Assert.Equal(Encoding.UTF8.GetBytes(source!), Convert.FromBase64String(attachment.Base64!));
        });
    }

    #endregion

    #region 5. Multiple Attachments

    [Scenario("Multiple Attach calls accumulate '3' attachments in order")]
    public void Multiple_attach_accumulates()
    {
        string[]? titles = null;

        Given("attachment titles 'First', 'Second', and 'Third'", ctx =>
            titles = ctx.Step!.ValuesRaw.ToArray());

        When("'3' attachments are added in title order", () =>
        {
            Attach(ToBase64("first"), "text/plain", title: titles![0]);
            Attach(ToBase64("second"), "text/plain", title: titles[1]);
            Attach(ToBase64("third"), "text/plain", title: titles[2]);
        });

        Then("there should be '3' attachments in declaration order", ctx =>
        {
            var expectedCount = ctx.Step!.Values[0].AsInt();
            var attachments = GetAttachments();
            Assert.Equal(expectedCount, attachments.Count);
            Assert.Equal("First", attachments[0].Title);
            Assert.Equal("Second", attachments[1].Title);
            Assert.Equal("Third", attachments[2].Title);
        });
    }

    [Scenario("Mixing Attach, AttachScreenshot, and AttachJson on the same step works")]
    public void Mixed_attachment_types()
    {
        object? jsonPayload = null;

        Given("plain text, screenshot, and JSON attachment data", () =>
            jsonPayload = new { mixed = true });

        When("Attach, AttachScreenshot, and AttachJson are all called", () =>
        {
            Attach("dGVzdA==", "text/plain", title: "Plain text");
            AttachScreenshot("iVBORw0KGgo=", "Screenshot");
            AttachJson(jsonPayload!, "JSON data");
        });

        Then("there should be '3' attachments with distinct kinds and mimeTypes", ctx =>
        {
            var expectedCount = ctx.Step!.Values[0].AsInt();
            var attachments = GetAttachments();
            Assert.Equal(expectedCount, attachments.Count);

            Assert.Equal("file", attachments[0].Kind);
            Assert.Equal("text/plain", attachments[0].MimeType);

            Assert.Equal("screenshot", attachments[1].Kind);
            Assert.Equal("image/png", attachments[1].MimeType);

            Assert.Equal("file", attachments[2].Kind);
            Assert.Equal("application/json", attachments[2].MimeType);
        });
    }

    #endregion

    #region 6. Edge Cases

    [Scenario("Attach with empty string data creates a valid attachment")]
    public void Attach_empty_data()
    {
        string? data = null;

        Given("empty base64 data", () => data = "");

        When("Attach is called with the empty data", () => Attach(data!, "text/plain"));

        Then("the attachment should exist with empty base64 and a valid ID", () =>
        {
            var attachments = GetAttachments();
            Assert.Single(attachments);
            Assert.Equal("", attachments[0].Base64);
            Assert.False(string.IsNullOrEmpty(attachments[0].Id));
        });
    }

    [Scenario("AttachJson with null value serializes to 'null'")]
    public void AttachJson_null_value()
    {
        object? payload = new object();

        Given("a null JSON value", () => payload = null);

        When("AttachJson is called with the null value", () => AttachJson(payload!));

        Then("the decoded output should be 'null'", ctx =>
        {
            var expected = ctx.Step!.Values[0].AsString();
            var attachments = GetAttachments();
            Assert.Single(attachments);
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
            Assert.Equal(expected, decoded);
        });
    }

    [Scenario("AttachJson with array data serializes all elements")]
    public void AttachJson_array_data()
    {
        int[]? payload = null;

        Given("array data '[1, 2, 3]'", ctx =>
            payload = ctx.Step!.Values[0].As<int[]>());

        When("AttachJson is called with the array", () => AttachJson(payload!));

        Then("the decoded JSON should contain all array elements", () =>
        {
            var attachments = GetAttachments();
            Assert.Single(attachments);
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
            Assert.Contains("1", decoded);
            Assert.Contains("2", decoded);
            Assert.Contains("3", decoded);
        });
    }

    #endregion
}
