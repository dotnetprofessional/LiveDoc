using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Tag("reporting")]
[Specification("Authoritative Result Output", Description = @"
    The LiveDoc export must use xUnit's final result for every discovered test,
    including failures outside LiveDoc steps, outline rows, and helper fixtures.")]
[Collection(Environment_Sensitive_Collection.Name)]
public class Authoritative_Result_Output_Spec : SpecificationTest
{
    public Authoritative_Result_Output_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("The viewer export reports '18' tests with '13' passed and '5' failed, including distinct result rows")]
    public async Task Authoritative_results_reach_viewer_export()
    {
        var (expectedTotal, expectedPassed, expectedFailed) = Rule.Values.As<int, int, int>();
        var result = await RunResultProbe();

        Assert.NotEqual(0, result.ExitCode);
        var root = result.Export;
        var summary = root["summary"]!.AsObject();
        Assert.Equal(expectedTotal, summary["total"]!.GetValue<int>());
        Assert.Equal(expectedPassed, summary["passed"]!.GetValue<int>());
        Assert.Equal(expectedFailed, summary["failed"]!.GetValue<int>());
        Assert.Equal("failed", root["status"]!.GetValue<string>());

        var documents = root["documents"]!.AsArray()
            .Select(node => node!.AsObject())
            .ToArray();
        Assert.Contains(documents, document => document["title"]!.GetValue<string>() == "Included Helper Fixture");
        Assert.All(documents, document =>
        {
            Assert.Empty(document["ruleViolations"]?.AsArray() ?? new JsonArray());
            Assert.All(document["tests"]!.AsArray(), test =>
            {
                Assert.Empty(test!["ruleViolations"]?.AsArray() ?? new JsonArray());
                Assert.All(test["steps"]?.AsArray() ?? new JsonArray(),
                    step => Assert.Empty(step!["ruleViolations"]?.AsArray() ?? new JsonArray()));
            });
        });

        var directFailure = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A direct assertion expecting '1' receives '2'");
        Assert.Equal("failed", directFailure["execution"]!["status"]!.GetValue<string>());
        Assert.Contains("Expected: 1", directFailure["execution"]!["error"]!["message"]!.GetValue<string>());
        AssertRuleAttachments(directFailure["execution"]!["attachments"]!.AsArray(),
            ("Failed rule JSON", "file", "application/json", """{"value":2}"""),
            ("Failed rule screenshot", "screenshot", "image/png", null));

        var directSuccess = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A direct assertion expecting '1' receives '1'");
        Assert.Equal("passed", directSuccess["execution"]!["status"]!.GetValue<string>());
        AssertRuleAttachments(directSuccess["execution"]!["attachments"]!.AsArray(),
            ("Rule text", "file", "text/plain", "raw-rule-pass"),
            ("Rule screenshot", "screenshot", "image/png", null),
            ("Rule JSON", "file", "application/json", """{"value":1}"""),
            ("Rule file", "file", "application/octet-stream", "file-rule-pass"),
            ("Workflow", "file", "text/vnd.mermaid", File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "large-sequence.mmd"))));
        var unrelatedRule = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "An unrelated rule has no evidence");
        Assert.Equal("passed", unrelatedRule["execution"]!["status"]!.GetValue<string>());
        Assert.Null(unrelatedRule["execution"]!["attachments"]);

        var helper = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A helper fixture test is included");
        Assert.Null(helper["execution"]!["attachments"]);

        var outline = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["kind"]!.GetValue<string>() == "RuleOutline");
        Assert.Equal("failed", outline["execution"]!["status"]!.GetValue<string>());
        Assert.Equal(1, outline["statistics"]!["failed"]!.GetValue<int>());
        Assert.Null(outline["execution"]!["attachments"]);
        var rows = outline["exampleResults"]!.AsArray().Select(node => node!.AsObject()).ToArray();
        Assert.Equal(2, rows.Length);
        Assert.All(rows, row => Assert.Equal(
            outline["id"]!.GetValue<string>(), row["testId"]!.GetValue<string>()));
        Assert.Equal(new[] { 0, 1 }, rows.Select(row => row["result"]!["rowId"]!.GetValue<int>()).Order());

        var passingRow = rows.Single(row => row["result"]!["status"]!.GetValue<string>() == "passed");
        AssertRuleAttachments(passingRow["result"]!["attachments"]!.AsArray(),
            ("Row 1 JSON", "file", "application/json", """{"expected":1,"actual":1}"""),
            ("Row 1 text", "file", "text/plain", "row-1"));
        var failingRow = rows.Single(row => row["result"]!["status"]!.GetValue<string>() == "failed");
        Assert.Contains("Expected: 1", failingRow["result"]!["error"]!["message"]!.GetValue<string>());
        AssertRuleAttachments(failingRow["result"]!["attachments"]!.AsArray(),
            ("Row 2 JSON", "file", "application/json", """{"expected":1,"actual":2}"""),
            ("Row 2 text", "file", "text/plain", "row-2"));

        var stepFailure = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A failed LiveDoc step exports its error");
        Assert.Contains("Expected: \"Free\"", stepFailure["execution"]!["error"]!["message"]!.GetValue<string>());

        var failedStep = stepFailure["steps"]!.AsArray()
            .Select(node => node!.AsObject())
            .Single(step => step["execution"]!["status"]!.GetValue<string>() == "failed");
        Assert.Contains("Actual:   \"Standard\"", failedStep["execution"]!["error"]!["message"]!.GetValue<string>());
        Assert.Equal(
            """
            ### Expected response

            ```json
            {"shippingRate":"Free"}
            ```
            """,
            failedStep["description"]!.GetValue<string>());
        var attachment = Assert.Single(failedStep["execution"]!["attachments"]!.AsArray())!.AsObject();
        Assert.Equal("Shipping rate response", attachment["title"]!.GetValue<string>());
        Assert.Equal("application/json", attachment["mimeType"]!.GetValue<string>());
        Assert.Equal("file", attachment["kind"]!.GetValue<string>());
        Assert.Equal(
            """{"expected":"Free","actual":"Standard"}""",
            JsonNode.Parse(System.Text.Encoding.UTF8.GetString(
                Convert.FromBase64String(attachment["base64"]!.GetValue<string>())))!.ToJsonString());

        const string deferredTheoryClassName = "Deferred_Theory_Result_Probe";
        var deferredTheoryRows = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Where(test => test["title"]!.GetValue<string>().Contains(
                deferredTheoryClassName,
                StringComparison.Ordinal))
            .ToArray();
        Assert.Equal(6, deferredTheoryRows.Length);
        Assert.Equal(6, deferredTheoryRows.Select(test => test["id"]!.GetValue<string>()).Distinct().Count());

        AssertDeferredTheoryResults(
            deferredTheoryRows,
            "Distinct_display_names",
            "passed",
            "passed");
        AssertDeferredTheoryResults(
            deferredTheoryRows,
            "Same_display_name_failing_then_passing",
            "failed",
            "passed");
        AssertDeferredTheoryResults(
            deferredTheoryRows,
            "Same_display_name_passing_then_failing",
            "passed",
            "failed");
    }

    [Tag("scenario-outlines, attachments")]
    [Rule("Viewer export keeps Scenario Outline step attachments with their own example rows")]
    public async Task Scenario_outline_step_attachments_belong_to_their_example()
    {
        var result = await RunResultProbe();
        Assert.NotEqual(0, result.ExitCode);
        var stepOutline = result.Export["documents"]!.AsArray()
            .SelectMany(document => document!["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "Example '<number>' has its own step evidence");
        var exampleSteps = stepOutline["steps"]!.AsArray().Select(node => node!.AsObject()).ToArray();
        var givenId = exampleSteps.Single(step => step["keyword"]!.GetValue<string>() == "given")["id"]!.GetValue<string>();
        var stepResults = stepOutline["exampleResults"]!.AsArray()
            .Select(node => node!.AsObject())
            .Where(row => row["testId"]!.GetValue<string>() == givenId)
            .OrderBy(row => row["result"]!["rowId"]!.GetValue<int>())
            .ToArray();
        Assert.Equal(3, stepResults.Length);
        Assert.Equal(new[] { 0, 1, 2 }, stepResults.Select(row => row["result"]!["rowId"]!.GetValue<int>()));
        AssertRuleAttachments(stepResults[0]["result"]!["attachments"]!.AsArray(),
            ("Example 1 JSON", "file", "application/json", """{"number":1}"""));
        AssertRuleAttachments(stepResults[1]["result"]!["attachments"]!.AsArray(),
            ("Example 2 JSON", "file", "application/json", """{"number":2}"""));
        Assert.Null(stepResults[2]["result"]!["attachments"]);
    }

    [Tag("mermaid, attachments")]
    [Rule("Viewer export preserves a large 'sequenceDiagram' with MIME 'text/vnd.mermaid', kind 'file', and title 'Workflow'")]
    public async Task Mermaid_source_reaches_viewer_export()
    {
        var (diagramType, expectedMimeType, expectedKind, expectedTitle) =
            Rule.Values.As<string, string, string, string>();
        var expectedSource = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "large-sequence.mmd"));
        Assert.StartsWith(diagramType, expectedSource);
        var result = await RunResultProbe();
        Assert.NotEqual(0, result.ExitCode);

        var directSuccess = result.Export["documents"]!.AsArray()
            .SelectMany(document => document!["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A direct assertion expecting '1' receives '1'");
        Assert.Equal("passed", directSuccess["execution"]!["status"]!.GetValue<string>());

        var attachment = directSuccess["execution"]!["attachments"]!.AsArray()
            .Select(node => node!.AsObject())
            .Single(item => item["title"]!.GetValue<string>() == expectedTitle);
        Assert.Equal(expectedMimeType, attachment["mimeType"]!.GetValue<string>());
        Assert.Equal(expectedKind, attachment["kind"]!.GetValue<string>());
        Assert.Equal(
            System.Text.Encoding.UTF8.GetBytes(expectedSource),
            Convert.FromBase64String(attachment["base64"]!.GetValue<string>()));
    }

    private static void AssertRuleAttachments(
        JsonArray attachments,
        params (string Title, string Kind, string MimeType, string? Content)[] expected)
    {
        Assert.Equal(expected.Length, attachments.Count);
        Assert.Equal(expected.Length, attachments.Select(node => node!["id"]!.GetValue<string>()).Distinct().Count());
        for (var index = 0; index < expected.Length; index++)
        {
            var attachment = attachments[index]!.AsObject();
            var (title, kind, mimeType, content) = expected[index];
            Assert.NotEqual("", attachment["id"]!.GetValue<string>());
            Assert.Equal(title, attachment["title"]!.GetValue<string>());
            Assert.Equal(kind, attachment["kind"]!.GetValue<string>());
            Assert.Equal(mimeType, attachment["mimeType"]!.GetValue<string>());
            var bytes = Convert.FromBase64String(attachment["base64"]!.GetValue<string>());
            if (content == null)
                Assert.Equal("89504E470D0A1A0A", Convert.ToHexString(bytes[..8]));
            else if (mimeType == "application/json")
                Assert.Equal(content, JsonNode.Parse(System.Text.Encoding.UTF8.GetString(bytes))!.ToJsonString());
            else
                Assert.Equal(content, System.Text.Encoding.UTF8.GetString(bytes));
        }
    }

    private static void AssertDeferredTheoryResults(
        JsonObject[] rows,
        string methodName,
        params string[] expectedStatuses)
    {
        var matchingRows = rows
            .Where(test => test["title"]!.GetValue<string>().Contains(methodName, StringComparison.Ordinal))
            .ToArray();
        Assert.Equal(expectedStatuses.Length, matchingRows.Length);
        Assert.Equal(
            expectedStatuses.OrderBy(status => status),
            matchingRows
                .Select(test => test["execution"]!["status"]!.GetValue<string>())
                .OrderBy(status => status));
    }

    private static async Task<ProbeResult> RunResultProbe([CallerFilePath] string filePath = "")
    {
        var specDirectory = Path.GetDirectoryName(filePath)!;
        var projectPath = Path.Combine(specDirectory, "Fixtures", "ResultProbe", "ResultProbe.csproj");
        var outputDirectory = Path.GetFullPath(Path.Combine(
            specDirectory, "..", "..", "artifacts", "result-probe", Guid.NewGuid().ToString("N")));
        Directory.CreateDirectory(outputDirectory);
        var exportPath = Path.Combine(outputDirectory, "livedoc-report.json");

        var startInfo = IsolatedTestProcess.Create(projectPath, exportPath);

        try
        {
            using var process = Process.Start(startInfo)!;
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));

            try
            {
                await process.WaitForExitAsync(timeout.Token);
            }
            catch (OperationCanceledException)
            {
                if (!process.HasExited)
                    process.Kill(entireProcessTree: true);

                await process.WaitForExitAsync();
                throw new TimeoutException(
                    $"Result probe timed out after 60 seconds.{Environment.NewLine}{await stdoutTask}{await stderrTask}");
            }

            var output = await stdoutTask + await stderrTask;
            Assert.True(File.Exists(exportPath), $"Expected LiveDoc export at {exportPath}.{Environment.NewLine}{output}");
            return new ProbeResult(process.ExitCode, JsonNode.Parse(File.ReadAllText(exportPath))!.AsObject());
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    private sealed record ProbeResult(int ExitCode, JsonObject Export);
}
