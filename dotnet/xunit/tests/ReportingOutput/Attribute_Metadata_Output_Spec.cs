using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Attribute Metadata Output", Description = @"
    LiveDoc's xUnit reporter must preserve Feature, Scenario, Specification,
    Rule, RuleOutline, and Given/When/Then/And/But metadata even when a test does not
    explicitly create a LiveDoc context before the framework fallback reports it.")]
public class Attribute_Metadata_Output_Spec : SpecificationTest
{
    public Attribute_Metadata_Output_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("The viewer export contains Feature, Scenario, ScenarioOutline, and Given/When/Then/And/But metadata")]
    public async Task Feature_metadata_reaches_viewer_export()
    {
        var result = await RunMetadataProbe();
        Assert.Equal(0, result.ExitCode);

        var root = ReadExport(result.ExportPath);
        var feature = FindDocument(root, "Checkout Feature Attribute");
        Assert.Equal("Feature", feature["kind"]!.GetValue<string>());
        Assert.Equal("Feature description from attribute", feature["description"]!.GetValue<string>());
        AssertTags(feature, "feature-class");

        var scenario = FindTest(feature, "Scenario", "Scenario attribute sends <customer:retail> metadata");
        Assert.Equal("Scenario description from attribute", scenario["description"]!.GetValue<string>());
        AssertTags(scenario, "feature-class", "scenario-method");

        var gwtScenario = FindTest(feature, "Scenario", "Given When Then steps send metadata");
        Assert.Equal("Given/When/Then description from attribute", gwtScenario["description"]!.GetValue<string>());
        AssertTags(gwtScenario, "feature-class", "gwt-method");
        AssertStep(gwtScenario, "given", "a cart with 2 items");
        AssertStep(gwtScenario, "when", "shipping method is ground");
        AssertStep(gwtScenario, "then", "the cart has '2' items");
        AssertStep(gwtScenario, "and", "shipping method remains ground");
        AssertStep(gwtScenario, "but", "shipping method is not air");

        var outline = FindTest(feature, "ScenarioOutline", "Scenario outline sends '<value>' metadata");
        Assert.Equal("Scenario outline description from attribute", outline["description"]!.GetValue<string>());
        AssertTags(outline, "feature-class", "scenario-outline-method");
        Assert.Single(outline["examples"]![0]!["rows"]!.AsArray());

        Assert.Contains("Feature: Checkout Feature Attribute", result.Output);
        Assert.Contains("Scenario: Scenario attribute sends <customer:retail> metadata", result.Output);
        Assert.Contains("Scenario: Given When Then steps send metadata", result.Output);
    }

    [Rule("The viewer export contains Specification, Rule, and RuleOutline metadata")]
    public async Task Rule_metadata_reaches_viewer_export()
    {
        var result = await RunMetadataProbe();
        Assert.Equal(0, result.ExitCode);

        var root = ReadExport(result.ExportPath);
        var specification = FindDocument(root, "Rule Specification Attribute");
        Assert.Equal("Specification", specification["kind"]!.GetValue<string>());
        Assert.Equal("Specification description from attribute", specification["description"]!.GetValue<string>());
        AssertTags(specification, "spec-class");

        var rule = FindTest(specification, "Rule", "Rule attribute sends <threshold:42> metadata");
        AssertTags(rule, "spec-class", "rule-method");

        var contextRule = FindTest(specification, "Rule", "Rule context extracts <limit:7> and sends metadata");
        AssertTags(contextRule, "spec-class", "rule-context-method");

        var outline = FindTest(specification, "RuleOutline", "Rule outline sends '<value>' metadata");
        AssertTags(outline, "spec-class", "rule-outline-method");
        Assert.Equal(2, outline["examples"]![0]!["rows"]!.AsArray().Count);

        Assert.Contains("Specification: Rule Specification Attribute", result.Output);
        Assert.Contains("Rule: Rule attribute sends <threshold:42> metadata", result.Output);
        Assert.Contains("Rule Outline: Rule outline sends '<value>' metadata", result.Output);
    }

    [Rule("The viewer export uses LiveDocProject assembly metadata when LIVEDOC_PROJECT is not set")]
    public async Task Assembly_metadata_project_reaches_viewer_export()
    {
        var result = await RunMetadataProbe(setProjectEnvironmentVariable: false);
        Assert.Equal(0, result.ExitCode);

        var root = ReadExport(result.ExportPath);
        Assert.Equal("xunit-metadata-probe", root["project"]!.GetValue<string>());
    }

    private static async Task<ProbeResult> RunMetadataProbe(
        bool setProjectEnvironmentVariable = true,
        [CallerFilePath] string filePath = "")
    {
        var specDirectory = Path.GetDirectoryName(filePath)!;
        var projectPath = Path.Combine(specDirectory, "Fixtures", "MetadataProbe", "MetadataProbe.csproj");
        var outputDirectory = Path.Combine(Path.GetTempPath(), "livedoc-xunit-metadata-probe", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(outputDirectory);
        var exportPath = Path.Combine(outputDirectory, "livedoc-report.json");

        var startInfo = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = Path.GetDirectoryName(projectPath)!,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add("test");
        startInfo.ArgumentList.Add(projectPath);
        startInfo.ArgumentList.Add("--logger");
        startInfo.ArgumentList.Add("LiveDoc");
        startInfo.Environment["LIVEDOC_EXPORT_PATH"] = exportPath;
        if (setProjectEnvironmentVariable)
            startInfo.Environment["LIVEDOC_PROJECT"] = "xunit-metadata-probe";
        startInfo.Environment["LIVEDOC_SERVER_URL"] = "";

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
            {
                try
                {
                    process.Kill(entireProcessTree: true);
                }
                catch (InvalidOperationException) when (process.HasExited)
                {
                }
            }

            await process.WaitForExitAsync();
            var timedOutOutput = await stdoutTask + await stderrTask;
            throw new TimeoutException($"Metadata probe timed out after 60 seconds.{Environment.NewLine}{timedOutOutput}");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        return new ProbeResult(process.ExitCode, exportPath, stdout + stderr);
    }

    private static JsonObject ReadExport(string exportPath)
    {
        Assert.True(File.Exists(exportPath), $"Expected LiveDoc export at {exportPath}");
        return JsonNode.Parse(File.ReadAllText(exportPath))!.AsObject();
    }

    private static JsonObject FindDocument(JsonObject root, string title)
    {
        var documents = root["documents"]!.AsArray();
        var document = documents
            .Select(node => node!.AsObject())
            .FirstOrDefault(node => node["title"]!.GetValue<string>() == title);

        Assert.NotNull(document);
        return document!;
    }

    private static JsonObject FindTest(JsonObject document, string kind, string title)
    {
        var tests = document["tests"]!.AsArray();
        var test = tests
            .Select(node => node!.AsObject())
            .FirstOrDefault(node =>
                node["kind"]!.GetValue<string>() == kind &&
                node["title"]!.GetValue<string>() == title);

        Assert.NotNull(test);
        return test!;
    }

    private static void AssertStep(JsonObject scenario, string keyword, string title)
    {
        var steps = scenario["steps"]!.AsArray();
        Assert.Contains(steps.Select(node => node!.AsObject()), step =>
            step["keyword"]!.GetValue<string>() == keyword &&
            step["title"]!.GetValue<string>() == title);
    }

    private static void AssertTags(JsonObject node, params string[] expectedTags)
    {
        var actual = node["tags"]!.AsArray()
            .Select(tag => tag!.GetValue<string>())
            .ToArray();

        foreach (var expectedTag in expectedTags)
        {
            Assert.Contains(expectedTag, actual);
        }
    }

    private sealed record ProbeResult(int ExitCode, string ExportPath, string Output);
}
