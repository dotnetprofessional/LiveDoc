using System.Diagnostics;
using SweDevTools.LiveDoc.xUnit.Reporter;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

internal static class IsolatedTestProcess
{
    private static readonly string[] CoverageEnvironmentPrefixes =
    [
        "CODE_COVERAGE_",
        "CORECLR_PROFILER",
        "COR_PROFILER",
        "MicrosoftInstrumentationEngine_",
        "VANGUARD_"
    ];

    public static ProcessStartInfo Create(string projectPath, string exportPath)
    {
        var startInfo = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = Path.GetDirectoryName(projectPath)!,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add("test");
        startInfo.ArgumentList.Add(projectPath);

        foreach (var name in startInfo.Environment.Keys.ToArray())
        {
            if (CoverageEnvironmentPrefixes.Any(prefix =>
                    name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
            {
                startInfo.Environment.Remove(name);
            }
        }

        startInfo.Environment.Remove("CORECLR_ENABLE_PROFILING");
        startInfo.Environment.Remove("COR_ENABLE_PROFILING");
        startInfo.Environment.Remove("LIVEDOC_COVERAGE");
        startInfo.Environment.Remove("LIVEDOC_COVERAGE_PATH");
        startInfo.Environment.Remove("LIVEDOC_RUN_METADATA_DIR");
        startInfo.Environment.Remove(LiveDocConfig.ProjectEnvVar);
        startInfo.Environment.Remove(LiveDocConfig.EnvironmentEnvVar);
        startInfo.Environment.Remove(LiveDocConfig.RunTypeEnvVar);
        startInfo.Environment["LIVEDOC_EXPORT_PATH"] = exportPath;
        startInfo.Environment["LIVEDOC_SERVER_URL"] = "";
        startInfo.Environment["LIVEDOC_REPORTING_SUPPRESSED"] = "true";
        return startInfo;
    }
}
