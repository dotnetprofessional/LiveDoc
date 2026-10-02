using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Namespace Export Stability", Description = "Renaming the compiled test assembly preserves the namespace folders exported for context-backed and fallback documents.")]
[Tag("reporting, namespace-paths")]
public sealed class Namespace_Export_Spec : SpecificationTest
{
    public Namespace_Export_Spec(ITestOutputHelper output) : base(output) { }

    [RuleOutline("On '<framework>', assemblies 'Acme.Orders' and 'Unrelated.Library' export the same '7' paths <paths:Acme/Orders/NamespaceContext.cs|Acme/Orders/NamespaceFallback.cs|Acme/Orders/Payments/Outer+NestedContext.cs|Acme/Orders/Payments/Outer+NestedFallback.cs|Elsewhere/Inventory/InventoryContext.cs|NamespaceFreeContext.cs|NamespaceFreeFallback.cs> for project 'xunit-metadata-probe'")]
    [Example("net8.0")]
    [Example("net10.0")]
    public async Task Compiled_assembly_names_do_not_change_exported_paths(string framework)
    {
        var firstAssembly = Rule.Values[1].AsString();
        var secondAssembly = Rule.Values[2].AsString();
        var expectedCount = Rule.Values[3].AsInt();
        var expectedProject = Rule.Values[4].AsString();
        var directory = Path.Combine(Path.GetDirectoryName(SourcePath())!, "..", "..", "..", "..",
            ".livedoc", "namespace-export", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            var first = await RunProbe(directory, framework, firstAssembly);
            var second = await RunProbe(directory, framework, secondAssembly);
            AttachExportEvidence(first, framework, firstAssembly);
            AttachExportEvidence(second, framework, secondAssembly);
            var expectedPaths = Rule.Params["paths"].AsString().Split('|')
                .OrderBy(path => path, StringComparer.Ordinal).ToArray();
            Assert.Equal(expectedCount, expectedPaths.Length);
            Assert.Equal(expectedProject, first["project"]!.GetValue<string>());
            Assert.Equal(expectedProject, second["project"]!.GetValue<string>());
            Assert.Equal(expectedPaths, ExportPaths(first));
            Assert.Equal(expectedPaths, ExportPaths(second));
            Assert.Equal(DocumentIds(first), DocumentIds(second));
            AssertNoViolations(first);
            AssertNoViolations(second);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static string[] ExportPaths(JsonObject export)
        => export["documents"]!.AsArray()
            .Select(document => document!["path"]!.GetValue<string>())
            .OrderBy(path => path, StringComparer.Ordinal).ToArray();

    private static string[] DocumentIds(JsonObject export)
        => export["documents"]!.AsArray()
            .Select(document => document!["id"]!.GetValue<string>())
            .OrderBy(id => id, StringComparer.Ordinal).ToArray();

    private void AttachExportEvidence(JsonObject export, string framework, string assemblyName)
    {
        AttachJson(new
        {
            framework,
            assembly = assemblyName,
            project = export["project"]!.GetValue<string>(),
            documents = export["documents"]!.AsArray().Select(document => new
            {
                id = document!["id"]!.GetValue<string>(),
                kind = document["kind"]!.GetValue<string>(),
                title = document["title"]!.GetValue<string>(),
                path = document["path"]!.GetValue<string>()
            }).ToArray()
        }, $"{framework}: {assemblyName} namespace paths");
    }

    private static void AssertNoViolations(JsonNode node)
    {
        if (node is JsonObject obj)
        {
            Assert.Empty(obj["ruleViolations"]?.AsArray() ?? new JsonArray());
            foreach (var child in obj.Where(property => property.Value != null))
                AssertNoViolations(child.Value!);
        }
        else if (node is JsonArray array)
        {
            foreach (var child in array.Where(child => child != null))
                AssertNoViolations(child!);
        }
    }

    private static async Task<JsonObject> RunProbe(string directory, string framework, string assemblyName)
    {
        var projectPath = Path.Combine(Path.GetDirectoryName(SourcePath())!, "Fixtures", "MetadataProbe", "MetadataProbe.csproj");
        var outputDirectory = Path.Combine(directory, assemblyName);
        var exportPath = Path.Combine(outputDirectory, "report.json");
        var startInfo = IsolatedTestProcess.Create(projectPath, exportPath);
        startInfo.ArgumentList.Add($"-p:NamespaceProbeAssemblyName={assemblyName}");
        startInfo.ArgumentList.Add($"-p:NamespaceProbeTargetFramework={framework}");
        startInfo.ArgumentList.Add("--artifacts-path");
        startInfo.ArgumentList.Add(Path.Combine(outputDirectory, "build"));
        startInfo.ArgumentList.Add("--filter");
        startInfo.ArgumentList.Add("Category=namespace-paths");
        using var process = Process.Start(startInfo)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(120));
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync();
            throw new TimeoutException($"Namespace export testhost timed out.{Environment.NewLine}{await stdout}{await stderr}");
        }
        var output = await stdout + await stderr;
        Assert.True(process.ExitCode == 0, $"Namespace export testhost failed.{Environment.NewLine}{output}");
        Assert.Contains(assemblyName + ".dll", output);
        Assert.True(File.Exists(exportPath), $"Namespace export was not written.{Environment.NewLine}{output}");
        var export = JsonNode.Parse(await File.ReadAllTextAsync(exportPath))!.AsObject();
        Assert.Equal(export["documents"]!.AsArray().Count, export["summary"]!["passed"]!.GetValue<int>());
        return export;
    }

    private static string SourcePath([CallerFilePath] string path = "") => path;
}
