using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Background Lifecycle Output", Description = "Shared Background steps appear separately while failures remain visible on the owning scenario.")]
[Collection(Environment_Sensitive_Collection.Name)]
[Tag("backgrounds, reporting")]
public class Background_Lifecycle_Output_Spec : SpecificationTest
{
    public Background_Lifecycle_Output_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("'11' exported tests contain separate Background steps and '6' distinct failures")]
    public async Task Failed_hooks_reach_export()
    {
        var (expectedTests, expectedFailures) = Rule.Values.As<int, int>();
        var projectPath = Path.Combine(Path.GetDirectoryName(SourcePath())!,
            "Fixtures", "BackgroundLifecycleProbe", "BackgroundLifecycleProbe.csproj");
        var directory = Path.Combine(Path.GetTempPath(), "livedoc-xunit-background-probe", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var exportPath = Path.Combine(directory, "report.json");
            var startInfo = IsolatedTestProcess.Create(projectPath, exportPath);
            using var process = Process.Start(startInfo)!;
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
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
                throw new TimeoutException($"Background probe timed out.{Environment.NewLine}{await stdout}{await stderr}");
            }

            var output = await stdout + await stderr;
            Assert.NotEqual(0, process.ExitCode);
            Assert.True(File.Exists(exportPath), $"Expected LiveDoc export.{Environment.NewLine}{output}");
            var root = JsonNode.Parse(File.ReadAllText(exportPath))!.AsObject();
            var documents = root["documents"]!.AsArray();
            var tests = documents
                .SelectMany(document => document!["tests"]!.AsArray())
                .Select(test => test!.AsObject())
                .ToDictionary(test => test["title"]!.GetValue<string>());
            Assert.Equal(expectedTests, tests.Count);
            Assert.Equal(expectedFailures, tests.Values.Count(test =>
                test["execution"]!["status"]!.GetValue<string>() == "failed"));

            var shared = documents.Single(document =>
                document!["title"]!.GetValue<string>() == "Shared Background Reporting Probe")!;
            var background = shared["background"]!;
            Assert.Equal("Background", background["kind"]!.GetValue<string>());
            Assert.Equal("Shared setup", background["title"]!.GetValue<string>());
            Assert.Equal("passed", background["execution"]!["status"]!.GetValue<string>());
            Assert.Equal(new[] { "given", "and" },
                background["steps"]!.AsArray().Select(step => step!["keyword"]!.GetValue<string>()));
            Assert.Equal(2, background["steps"]!.AsArray().Count);
            Assert.All(shared["tests"]!.AsArray(), test =>
                Assert.DoesNotContain(test!["steps"]!.AsArray(), step =>
                    step!["title"]!.GetValue<string>().Contains("account starts", StringComparison.Ordinal)));
            Assert.Equal(new[] { "given", "when", "then" },
                tests["A scenario adds its own Given"]["steps"]!.AsArray()
                    .Select(step => step!["keyword"]!.GetValue<string>()));
            Assert.Equal(new[] { "when", "then" },
                tests["Background supplies the shared Given"]["steps"]!.AsArray()
                    .Select(step => step!["keyword"]!.GetValue<string>()));
            Assert.Equal(new[] { "and", "when", "then" },
                tests["A scenario continues its Background Given"]["steps"]!.AsArray()
                    .Select(step => step!["keyword"]!.GetValue<string>()));
            Assert.All(shared["tests"]!.AsArray(), test =>
                Assert.Empty(test!["ruleViolations"]?.AsArray() ?? new JsonArray()));
            var withoutBackground = documents.Single(document =>
                document!["title"]!.GetValue<string>() == "Without Background Probe")!;
            Assert.Null(withoutBackground["background"]);
            var mixed = documents.Single(document =>
                document!["title"]!.GetValue<string>() == "Mixed Background Reporting Probe")!;
            Assert.Equal("failed", mixed["background"]!["execution"]!["status"]!.GetValue<string>());
            Assert.Equal("failed", mixed["background"]!["steps"]![0]!["execution"]!["status"]!.GetValue<string>());
            Assert.Equal("passed", tests["A passing setup permits its scenario"]["execution"]!["status"]!.GetValue<string>());
            Assert.Equal("failed", tests["A failing setup prevents its scenario"]["execution"]!["status"]!.GetValue<string>());

            var setupError = tests["A failed Background still runs cleanup"]["execution"]!["error"]!["message"]!.GetValue<string>();
            Assert.Contains("Background setup failed", setupError);
            Assert.Contains("Cleanup ran after background failure", setupError);
            Assert.DoesNotContain("Scenario should not run", setupError);
            var failedBackground = documents.Single(document =>
                document!["title"]!.GetValue<string>() == "Failed Background Lifecycle Probe")!["background"]!;
            Assert.Equal("failed", failedBackground["execution"]!["status"]!.GetValue<string>());
            Assert.Equal("failed", failedBackground["steps"]![0]!["execution"]!["status"]!.GetValue<string>());

            var actionError = tests["A failed Scenario still runs cleanup"]["execution"]!["error"]!["message"]!.GetValue<string>();
            Assert.Contains("Scenario action failed", actionError);
            Assert.Contains("Cleanup ran after scenario failure", actionError);

            var cleanupError = tests["A cleanup failure fails the Scenario"]["execution"]!["error"]!["message"]!.GetValue<string>();
            Assert.Contains("Cleanup failed on its own", cleanupError);

            var invalidError = tests["Invalid Background steps fail before the Scenario"]["execution"]!["error"]!["message"]!.GetValue<string>();
            Assert.Contains("Backgrounds only support Given and And steps, not When", invalidError);
            Assert.Contains("Cleanup ran after invalid Background", invalidError);
            Assert.DoesNotContain("Invalid Scenario should not run", invalidError);
            var invalidBackground = documents.Single(document =>
                document!["title"]!.GetValue<string>() == "Invalid Background Lifecycle Probe")!["background"]!;
            Assert.Equal("failed", invalidBackground["execution"]!["status"]!.GetValue<string>());
            Assert.Empty(invalidBackground["steps"]!.AsArray());
            Assert.Contains("Backgrounds only support Given and And steps, not When",
                invalidBackground["execution"]!["error"]!["message"]!.GetValue<string>());

            var outline = tests["Cleanup for example '<amount>' is isolated"];
            var rowResults = outline["exampleResults"]!.AsArray();
            var failedRow = rowResults
                .Where(result => result!["result"]!["rowId"]!.GetValue<int>() == 1)
                .ToArray();
            Assert.Equal(3, failedRow.Length);
            Assert.Single(failedRow, result =>
                result!["testId"]!.GetValue<string>() == outline["id"]!.GetValue<string>() &&
                result["result"]!["status"]!.GetValue<string>() == "failed");
            Assert.All(failedRow.Where(result => result!["testId"]!.GetValue<string>() != outline["id"]!.GetValue<string>()),
                result => Assert.Equal("passed", result!["result"]!["status"]!.GetValue<string>()));
            Assert.All(rowResults.Where(result => result!["result"]!["rowId"]!.GetValue<int>() == 0),
                result => Assert.Equal("passed", result!["result"]!["status"]!.GetValue<string>()));
            var outlineDocument = documents.Single(document =>
                document!["title"]!.GetValue<string>() == "Outline Cleanup Lifecycle Probe")!;
            Assert.Single(outlineDocument["background"]!["steps"]!.AsArray());
            Assert.Equal(new[] { "when", "then" },
                outline["steps"]!.AsArray().Select(step => step!["keyword"]!.GetValue<string>()));
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static string SourcePath([CallerFilePath] string path = "") => path;
}
