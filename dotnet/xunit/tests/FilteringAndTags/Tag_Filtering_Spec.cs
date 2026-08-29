using System.Diagnostics;
using System.Runtime.CompilerServices;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.FilteringAndTags;

[Specification("Tag Filtering", Description = @"
    LiveDoc tags are exposed as xUnit Category traits so focused test runs can
    select stable behavior tags and publish them as partial Viewer updates.")]
[Collection(Environment_Sensitive_Collection.Name)]
public class Tag_Filtering_Spec : SpecificationTest
{
    public Tag_Filtering_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("The xUnit filter 'Category=feature-scope|Category=scenario-scope|Category=scenario-outline-scope|Category=specification-scope|Category=rule-scope|Category=rule-outline-scope' lists '8' tagged tests and omits 'Unselected rule remains hidden'")]
    public async Task Tags_are_filterable()
    {
        var (filter, expectedCount, excludedTitle) = Rule.Values.As<string, int, string>();
        var output = await ListFilteredTests(filter);
        var selectedCount = output
            .Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries)
            .Count(line => line.Contains("is discoverable", StringComparison.Ordinal));

        Assert.Equal(expectedCount, selectedCount);
        Assert.DoesNotContain(excludedTitle, output, StringComparison.Ordinal);
    }

    private static async Task<string> ListFilteredTests(
        string filter,
        [CallerFilePath] string filePath = "")
    {
        var specDirectory = Path.GetDirectoryName(filePath)!;
        var projectPath = Path.Combine(
            specDirectory,
            "Fixtures",
            "TagFilterProbe",
            "TagFilterProbe.csproj");
        var startInfo = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = Path.GetDirectoryName(projectPath)!,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add("test");
        startInfo.ArgumentList.Add(projectPath);
        startInfo.ArgumentList.Add("--list-tests");
        startInfo.ArgumentList.Add("--filter");
        startInfo.ArgumentList.Add(filter);
        startInfo.ArgumentList.Add("--nologo");
        startInfo.ArgumentList.Add("--verbosity");
        startInfo.ArgumentList.Add("quiet");
        startInfo.Environment["LIVEDOC_REPORTING_SUPPRESSED"] = "true";
        startInfo.Environment["LIVEDOC_SERVER_URL"] = "";
        startInfo.Environment.Remove("LIVEDOC_RUN_TYPE");
        startInfo.Environment.Remove("LIVEDOC_EXPORT_PATH");
        startInfo.Environment.Remove("LIVEDOC_COVERAGE");

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
                $"Tag filter probe timed out after 60 seconds.{Environment.NewLine}{await stdoutTask}{await stderrTask}");
        }

        var output = await stdoutTask + await stderrTask;
        Assert.True(
            process.ExitCode == 0,
            $"Tag filter probe exited with code {process.ExitCode}.{Environment.NewLine}{output}");
        return output;
    }
}
