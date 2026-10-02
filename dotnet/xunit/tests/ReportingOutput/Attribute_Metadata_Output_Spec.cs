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
[Collection(Environment_Sensitive_Collection.Name)]
[Tag("reporting")]
public class Attribute_Metadata_Output_Spec :
    SpecificationTest,
    IClassFixture<AttributeMetadataProbeFixture>
{
    private readonly AttributeMetadataProbeFixture _probe;

    public Attribute_Metadata_Output_Spec(
        ITestOutputHelper output,
        AttributeMetadataProbeFixture probe) : base(output)
    {
        _probe = probe;
    }

    [Rule("The viewer export contains Feature, Scenario, ScenarioOutline, and Given/When/Then/And/But metadata")]
    public void Feature_metadata_reaches_viewer_export()
    {
        var result = _probe.ExportResult;
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
        Assert.Equal(2, outline["examples"]![0]!["rows"]!.AsArray().Count);

        var forward = FindTest(feature, "ScenarioOutline", "Forward discount '<discountPercent>' keeps a fixed cart total");
        AssertStep(forward, "given", "a cart totaling '100.00'");
        AssertStep(forward, "and", "a fixed discount ceiling of '100' precedes a discount of '<discountPercent>'");
        AssertStep(forward, "when", "a discount of '<discountPercent>' percent is applied");

        var reverse = FindTest(feature, "ScenarioOutline", "Reverse discount '<discountPercent>' keeps a fixed cart total");
        AssertStep(reverse, "given", "a cart totaling '100.00'");
        AssertStep(reverse, "and", "a fixed discount ceiling of '100' precedes a discount of '<discountPercent>'");
        AssertStep(reverse, "when", "a discount of '<discountPercent>' percent is applied");

        var decimalComma = FindTest(feature, "ScenarioOutline", "Decimal tax rate '<rate>' uses the current culture");
        AssertStep(decimalComma, "when", "a tax rate '<rate>' is applied");

        var equalParameters = FindTest(
            feature,
            "ScenarioOutline",
            "Equal parameter values preserve distinct '<a>' and '<b>' bindings");
        AssertStep(equalParameters, "then", "values '<a>' and '<b>' remain distinct");

        Assert.Contains("Feature: Checkout Feature Attribute", result.Output);
        Assert.Contains("Scenario: Scenario attribute sends <customer:retail> metadata", result.Output);
        Assert.Contains("Scenario: Given When Then steps send metadata", result.Output);
    }

    [Rule("The viewer export contains Specification, Rule, and RuleOutline metadata")]
    public void Rule_metadata_reaches_viewer_export()
    {
        var result = _probe.ExportResult;
        Assert.Equal(0, result.ExitCode);

        var root = ReadExport(result.ExportPath);
        var specification = FindDocument(root, "Rule Specification Attribute");
        Assert.Equal("Specification", specification["kind"]!.GetValue<string>());
        Assert.Equal("Specification description from attribute", specification["description"]!.GetValue<string>());
        AssertTags(specification, "spec-class");

        var rule = FindTest(specification, "Rule", "Rule attribute sends <threshold:42> metadata");
        AssertTags(rule, "spec-class", "rule-method");
        Assert.Equal(
            "Rule threshold <threshold:42> is included once.",
            rule["description"]!.GetValue<string>());

        var contextRule = FindTest(specification, "Rule", "Rule context extracts <limit:7> and sends metadata");
        AssertTags(contextRule, "spec-class", "rule-context-method");
        Assert.Null(contextRule["description"]);

        var outline = FindTest(specification, "RuleOutline", "Rule outline sends '<value>' metadata");
        AssertTags(outline, "spec-class", "rule-outline-method");
        Assert.Equal(
            "Rule outline value <value> is selected.",
            outline["description"]!.GetValue<string>());
        Assert.Equal(2, outline["examples"]![0]!["rows"]!.AsArray().Count);

        var titleOnlyOutline = FindTest(
            specification,
            "RuleOutline",
            "A positional title '<value>' is not repeated as description");
        Assert.Null(titleOnlyOutline["description"]);

        Assert.Contains("Specification: Rule Specification Attribute", result.Output);
        Assert.Contains("Rule: Rule attribute sends <threshold:42> metadata", result.Output);
        Assert.Contains("Rule: Rule outline sends '42' metadata", result.Output);
        Assert.Contains("Rule: Rule outline sends '100' metadata", result.Output);

        var nameofFeature = FindDocument(root, "Nameof feature name is formatted");
        FindTest(nameofFeature, "Scenario", "Nameof scenario name is formatted");
        FindTest(nameofFeature, "ScenarioOutline", "Nameof scenario outline name is formatted");

        var nameofSpecification = FindDocument(root, "Nameof specification name is formatted");
        FindTest(nameofSpecification, "Rule", "Nameof rule name is formatted");
        FindTest(nameofSpecification, "RuleOutline", "Nameof rule outline name is formatted");
        FindTest(nameofSpecification, "RuleOutline", "Dividing <a> by <b> equals <expected>");
    }

    [Rule("The viewer export uses LiveDocProject assembly metadata when LIVEDOC_PROJECT is not set")]
    public void Assembly_metadata_project_reaches_viewer_export()
    {
        var result = _probe.ExportResult;
        Assert.Equal(0, result.ExitCode);

        var root = ReadExport(result.ExportPath);
        Assert.Equal("xunit-metadata-probe", root["project"]!.GetValue<string>());
    }

    [Rule("Discovery lists concrete RuleOutline and ScenarioOutline names for every serializable Example row")]
    public void Outline_discovery_uses_concrete_example_names()
    {
        var result = _probe.DiscoveryResult;
        Assert.Equal(0, result.ExitCode);

        Assert.Contains("Rule: Rule outline sends '42' metadata", result.Output);
        Assert.Contains("Rule: Rule outline sends '100' metadata", result.Output);
        Assert.Contains("Scenario: Scenario outline sends 'retail' metadata", result.Output);
        Assert.Contains("Scenario: Scenario outline sends 'wholesale' metadata", result.Output);
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

}

public sealed class AttributeMetadataProbeFixture : IAsyncLifetime
{
    private readonly List<string> _outputDirectories = [];

    public MetadataProbeResult ExportResult { get; private set; } = null!;

    public MetadataProbeResult DiscoveryResult { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        ExportResult = await RunMetadataProbe(listTests: false);
        DiscoveryResult = await RunMetadataProbe(listTests: true);
    }

    public Task DisposeAsync()
    {
        foreach (var outputDirectory in _outputDirectories)
        {
            try
            {
                if (Directory.Exists(outputDirectory))
                    Directory.Delete(outputDirectory, recursive: true);
            }
            catch
            {
                // Best-effort cleanup must not hide probe assertions.
            }
        }

        return Task.CompletedTask;
    }

    private async Task<MetadataProbeResult> RunMetadataProbe(
        bool listTests,
        [CallerFilePath] string filePath = "")
    {
        var specDirectory = Path.GetDirectoryName(filePath)!;
        var projectPath = Path.Combine(
            specDirectory,
            "Fixtures",
            "MetadataProbe",
            "MetadataProbe.csproj");
        var outputDirectory = Path.Combine(
            Path.GetTempPath(),
            "livedoc-xunit-metadata-probe",
            Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(outputDirectory);
        _outputDirectories.Add(outputDirectory);
        var exportPath = Path.Combine(outputDirectory, "livedoc-report.json");

        var startInfo = IsolatedTestProcess.Create(projectPath, exportPath);
        startInfo.ArgumentList.Add("--logger");
        startInfo.ArgumentList.Add("LiveDoc");
        if (listTests)
            startInfo.ArgumentList.Add("--list-tests");

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
            throw new TimeoutException(
                $"Metadata probe timed out after 60 seconds.{Environment.NewLine}{timedOutOutput}");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        return new MetadataProbeResult(process.ExitCode, exportPath, stdout + stderr);
    }
}

public sealed record MetadataProbeResult(int ExitCode, string ExportPath, string Output);
