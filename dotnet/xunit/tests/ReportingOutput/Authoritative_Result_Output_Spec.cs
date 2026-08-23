using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Authoritative Result Output", Description = @"
    The LiveDoc export must use xUnit's final result for every discovered test,
    including failures outside LiveDoc steps, outline rows, and helper fixtures.")]
public class Authoritative_Result_Output_Spec : SpecificationTest
{
    public Authoritative_Result_Output_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("The viewer export reports '8' tests with '5' passed and '3' failed, including failure errors")]
    public async Task Authoritative_results_reach_viewer_export()
    {
        var (expectedTotal, expectedPassed, expectedFailed) = Rule.Values.As<int, int, int>();
        var result = await RunResultProbe();

        Assert.NotEqual(0, result.ExitCode);
        var root = JsonNode.Parse(File.ReadAllText(result.ExportPath))!.AsObject();
        var summary = root["summary"]!.AsObject();
        Assert.Equal(expectedTotal, summary["total"]!.GetValue<int>());
        Assert.Equal(expectedPassed, summary["passed"]!.GetValue<int>());
        Assert.Equal(expectedFailed, summary["failed"]!.GetValue<int>());
        Assert.Equal("failed", root["status"]!.GetValue<string>());

        var documents = root["documents"]!.AsArray()
            .Select(node => node!.AsObject())
            .ToArray();
        Assert.Contains(documents, document => document["title"]!.GetValue<string>() == "Included Helper Fixture");

        var directFailure = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A direct assertion expecting '1' receives '2'");
        Assert.Equal("failed", directFailure["execution"]!["status"]!.GetValue<string>());
        Assert.Contains("Expected: 1", directFailure["execution"]!["error"]!["message"]!.GetValue<string>());

        var outline = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["kind"]!.GetValue<string>() == "RuleOutline");
        Assert.Equal("failed", outline["execution"]!["status"]!.GetValue<string>());
        Assert.Equal(1, outline["statistics"]!["failed"]!.GetValue<int>());

        var stepFailure = documents
            .SelectMany(document => document["tests"]!.AsArray())
            .Select(node => node!.AsObject())
            .Single(test => test["title"]!.GetValue<string>() == "A failed LiveDoc step exports its error");
        Assert.Contains("Expected: \"Free\"", stepFailure["execution"]!["error"]!["message"]!.GetValue<string>());

        var failedStep = stepFailure["steps"]!.AsArray()
            .Select(node => node!.AsObject())
            .Single(step => step["execution"]!["status"]!.GetValue<string>() == "failed");
        Assert.Contains("Actual:   \"Standard\"", failedStep["execution"]!["error"]!["message"]!.GetValue<string>());
    }

    private static async Task<ProbeResult> RunResultProbe([CallerFilePath] string filePath = "")
    {
        var specDirectory = Path.GetDirectoryName(filePath)!;
        var projectPath = Path.Combine(specDirectory, "Fixtures", "ResultProbe", "ResultProbe.csproj");
        var outputDirectory = Path.Combine(Path.GetTempPath(), "livedoc-xunit-result-probe", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(outputDirectory);
        var exportPath = Path.Combine(outputDirectory, "livedoc-report.json");

        var startInfo = IsolatedTestProcess.Create(projectPath, exportPath);

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
        return new ProbeResult(process.ExitCode, exportPath);
    }

    private sealed record ProbeResult(int ExitCode, string ExportPath);
}
