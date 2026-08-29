using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Rule Violation Output", Description = @"
    Gherkin structure violations remain non-fatal but are exported on the exact
    scenario or step that needs attention.")]
[Collection(Environment_Sensitive_Collection.Name)]
public class Rule_Violation_Output_Spec : SpecificationTest
{
    public Rule_Violation_Output_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("The xUnit export keeps status 'passed' and reports repeated, missing, and absent Gherkin steps")]
    public async Task Rule_violations_reach_export()
    {
        var expectedStatus = Rule.Values[0].AsString();
        var result = await RunViolationProbe();

        Assert.Equal(0, result.ExitCode);
        var root = JsonNode.Parse(File.ReadAllText(result.ExportPath))!.AsObject();
        Assert.Equal(expectedStatus, root["status"]!.GetValue<string>());

        var tests = root["documents"]!.AsArray()
            .SelectMany(document => document!["tests"]!.AsArray())
            .Select(test => test!.AsObject())
            .ToDictionary(test => test["title"]!.GetValue<string>());

        var repeatedGiven = tests["A scenario with two Given steps"];
        var repeatedStep = repeatedGiven["steps"]!.AsArray()[1]!.AsObject();
        Assert.Contains(
            repeatedStep["ruleViolations"]!.AsArray(),
            violation => violation!["rule"]!.GetValue<string>() == "singleGivenWhenThen");

        var missingWhen = tests["A scenario without a When step"];
        var thenStep = missingWhen["steps"]!.AsArray()[1]!.AsObject();
        Assert.Contains(
            thenStep["ruleViolations"]!.AsArray(),
            violation => violation!["rule"]!.GetValue<string>() == "mustIncludeWhen");

        var noSteps = tests["A scenario without Gherkin steps"];
        var missingRules = noSteps["ruleViolations"]!.AsArray()
            .Select(violation => violation!["rule"]!.GetValue<string>())
            .ToArray();
        Assert.Contains("mustIncludeGiven", missingRules);
        Assert.Contains("mustIncludeWhen", missingRules);
        Assert.Contains("mustIncludeThen", missingRules);

        var outline = tests["An outline row '<value>' with two Given steps"];
        var repeatedOutlineStep = outline["steps"]!.AsArray()[1]!.AsObject();
        Assert.Contains(
            repeatedOutlineStep["ruleViolations"]!.AsArray(),
            violation => violation!["rule"]!.GetValue<string>() == "singleGivenWhenThen");
    }

    private static async Task<ProbeResult> RunViolationProbe([CallerFilePath] string filePath = "")
    {
        var specDirectory = Path.GetDirectoryName(filePath)!;
        var projectPath = Path.Combine(specDirectory, "Fixtures", "RuleViolationProbe", "RuleViolationProbe.csproj");
        var outputDirectory = Path.Combine(Path.GetTempPath(), "livedoc-xunit-rule-violation-probe", Guid.NewGuid().ToString("N"));
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
                $"Rule violation probe timed out after 60 seconds.{Environment.NewLine}{await stdoutTask}{await stderrTask}");
        }

        var output = await stdoutTask + await stderrTask;
        Assert.True(File.Exists(exportPath), $"Expected LiveDoc export at {exportPath}.{Environment.NewLine}{output}");
        return new ProbeResult(process.ExitCode, exportPath);
    }

    private sealed record ProbeResult(int ExitCode, string ExportPath);
}
