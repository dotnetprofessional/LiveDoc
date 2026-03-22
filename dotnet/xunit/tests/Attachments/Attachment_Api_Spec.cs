using System.Reflection;
using System.Text;
using System.Text.Json;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Attachments;

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

    #endregion

    #region 1. Basic Attach() Method

    [Scenario("Attach with base64 data and mimeType 'text/plain' stores kind 'file'")]
    public void Attach_stores_kind_file()
    {
        Given("base64 data 'dGVzdA==' with mimeType 'text/plain'", ctx =>
        {
            var (data, mimeType) = ctx.Step!.Values.As<string, string>();
            Attach(data, mimeType);
        });

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
        Given("base64 data with custom kind 'screenshot'", ctx =>
        {
            var kind = ctx.Step!.Values[0].AsString();
            Attach("dGVzdA==", "image/png", kind: kind);
        });

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
        Given("an attachment with title 'Login page capture'", ctx =>
        {
            var title = ctx.Step!.Values[0].AsString();
            Attach("dGVzdA==", "text/plain", title: title);
        });

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
        Given("two attachments are created", () =>
        {
            Attach("AAAA", "text/plain");
            Attach("BBBB", "text/plain");
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

    #region 2. AttachScreenshot() Convenience

    [Scenario("AttachScreenshot produces kind 'screenshot' and mimeType 'image/png'")]
    public void AttachScreenshot_defaults()
    {
        When("a screenshot is attached with data 'iVBORw0KGgo='", ctx =>
        {
            var data = ctx.Step!.Values[0].AsString();
            AttachScreenshot(data);
        });

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
        When("a screenshot is attached with title 'Error dialog'", ctx =>
        {
            var title = ctx.Step!.Values[0].AsString();
            AttachScreenshot("iVBORw0KGgo=", title);
        });

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
        When("AttachJson is called with an object containing name 'Alice' and age '30'", ctx =>
        {
            var (name, age) = ctx.Step!.Values.As<string, int>();
            AttachJson(new { name, age });
        });

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
        var rawJson = "{\"key\":\"value\"}";

        When("AttachJson is called with a raw JSON string", () =>
        {
            AttachJson(rawJson);
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
        When("AttachJson is called with an object", () =>
        {
            AttachJson(new { test = true });
        });

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
        When("AttachJson is called with a nested object containing city 'Sydney'", ctx =>
        {
            var city = ctx.Step!.Values[0].AsString();
            AttachJson(new
            {
                user = new { name = "Bob", address = new { city } },
                active = true
            });
        });

        Then("the decoded JSON should contain the nested city and active flag", () =>
        {
            var attachments = GetAttachments();
            Assert.Single(attachments);
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(attachments[0].Base64!));
            Assert.Contains("\"city\": \"Sydney\"", json);
            Assert.Contains("\"active\": true", json);
        });
    }

    [Scenario("AttachJson with title 'API Response' stores the title")]
    public void AttachJson_with_title()
    {
        When("AttachJson is called with title 'API Response'", ctx =>
        {
            var title = ctx.Step!.Values[0].AsString();
            AttachJson(new { status = "ok" }, title);
        });

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

    #endregion

    #region 5. Multiple Attachments

    [Scenario("Multiple Attach calls accumulate '3' attachments in order")]
    public void Multiple_attach_accumulates()
    {
        When("'3' attachments are added with titles 'First', 'Second', and 'Third'", () =>
        {
            Attach(ToBase64("first"), "text/plain", title: "First");
            Attach(ToBase64("second"), "text/plain", title: "Second");
            Attach(ToBase64("third"), "text/plain", title: "Third");
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
        When("Attach, AttachScreenshot, and AttachJson are all called", () =>
        {
            Attach("dGVzdA==", "text/plain", title: "Plain text");
            AttachScreenshot("iVBORw0KGgo=", "Screenshot");
            AttachJson(new { mixed = true }, "JSON data");
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
        When("Attach is called with empty base64 data", () =>
        {
            Attach("", "text/plain");
        });

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
        When("AttachJson is called with a null value", () =>
        {
            AttachJson(null!);
        });

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
        When("AttachJson is called with array '[1, 2, 3]'", () =>
        {
            AttachJson(new[] { 1, 2, 3 });
        });

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
