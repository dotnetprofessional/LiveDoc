using System.Text.Json;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Reporter;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

[Specification("Coverage Output", Description = @"
    Coverage is optional run evidence that complements executable specifications.
    The reporter normalizes standard coverage artifacts without changing test pass/fail status.")]
[Collection(Environment_Sensitive_Collection.Name)]
public class Coverage_Output_Spec : SpecificationTest
{
    private static readonly string[] ProfilerEnvironmentVariables =
    [
        "COR_ENABLE_PROFILING",
        "CORECLR_ENABLE_PROFILING",
        "COR_PROFILER",
        "CORECLR_PROFILER",
        "COR_PROFILER_PATH",
        "CORECLR_PROFILER_PATH"
    ];

    public Coverage_Output_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule("Cobertura module 'Sample' with covered line hits '1' and uncovered line hits '0' reports line coverage '50' percent")]
    public void Cobertura_file_reports_line_coverage()
    {
        var (expectedModule, covered, uncovered, expectedPct) = Rule.Values.As<string, int, int, int>();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-coverage-");
        try
        {
            var coveragePath = Path.Combine(tempDir.FullName, "coverage.cobertura.xml");
            File.WriteAllText(coveragePath, $"""
                <?xml version="1.0" encoding="utf-8"?>
                <coverage>
                  <packages>
                    <package name="Sample">
                      <classes>
                        <class name="Calculator" filename="src/Calculator.cs">
                          <methods>
                            <method name="Add">
                              <lines>
                                <line number="1" hits="{covered}" />
                                <line number="2" hits="{uncovered}" />
                              </lines>
                            </method>
                          </methods>
                          <lines>
                            <line number="1" hits="{covered}" />
                            <line number="2" hits="{uncovered}" />
                          </lines>
                        </class>
                      </classes>
                    </package>
                  </packages>
                </coverage>
                """);

            var report = CoverageCollector.ParseCobertura(coveragePath, tempDir.FullName);

            Assert.Equal(expectedPct, report.Summary!.Lines!.Pct);
            Assert.Single(report.Files!);
            Assert.Equal(expectedModule, report.Files![0].Module);
            Assert.Equal("src/Calculator.cs", report.Files![0].Path);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("Cobertura keeps solution module 'Application', excludes external module 'Dependency', and reports '100' percent across '1' file")]
    public void Cobertura_excludes_external_source_modules()
    {
        var (expectedModule, excludedModule, expectedPct, expectedFiles) =
            Rule.Values.As<string, string, int, int>();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-coverage-modules-");
        try
        {
            var applicationPath = Path.Combine(tempDir.FullName, "Application.cs");
            var externalPath = Path.Combine(tempDir.FullName, "missing", "Dependency.cs");
            File.WriteAllText(applicationPath, "public class Application {}");
            var coveragePath = Path.Combine(tempDir.FullName, "coverage.cobertura.xml");
            File.WriteAllText(coveragePath, $"""
                <?xml version="1.0" encoding="utf-8"?>
                <coverage>
                  <packages>
                    <package name="{expectedModule}">
                      <classes>
                        <class name="Application" filename="{applicationPath}">
                          <lines><line number="1" hits="1" /></lines>
                        </class>
                      </classes>
                    </package>
                    <package name="{excludedModule}">
                      <classes>
                        <class name="Dependency" filename="{externalPath}">
                          <lines><line number="1" hits="0" /></lines>
                        </class>
                      </classes>
                    </package>
                  </packages>
                </coverage>
                """);

            var report = CoverageCollector.ParseCobertura(coveragePath, tempDir.FullName);

            Assert.Equal(expectedPct, report.Summary!.Lines!.Pct);
            Assert.Equal(expectedFiles, report.Files!.Count);
            Assert.Equal(expectedModule, report.Files[0].Module);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("Visual Studio '.coverage' artifact reports diagnostic code 'dotnet-coverage-missing' when the converter is unavailable")]
    public void Visual_Studio_coverage_artifact_reports_missing_converter_diagnostic()
    {
        var (expectedExtension, expectedCode) = Rule.Values.As<string, string>();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-vs-coverage-");
        var originalDirectory = Directory.GetCurrentDirectory();
        var originalToolPath = Environment.GetEnvironmentVariable("LIVEDOC_DOTNET_COVERAGE_TOOL");

        try
        {
            var resultDir = Path.Combine(tempDir.FullName, "TestResults", Guid.NewGuid().ToString("D"));
            Directory.CreateDirectory(resultDir);
            var coveragePath = Path.Combine(resultDir, $"machine_2026-05-15.01_26_41{expectedExtension}");
            File.WriteAllBytes(coveragePath, new byte[] { 0x43, 0x4F, 0x56 });

            Directory.SetCurrentDirectory(tempDir.FullName);
            Environment.SetEnvironmentVariable("LIVEDOC_DOTNET_COVERAGE_TOOL", Path.Combine(tempDir.FullName, "missing-dotnet-coverage.exe"));
            var config = new LiveDocConfig(
                serverUrl: string.Empty,
                project: "CoverageProject",
                environment: "local",
                coverageEnabled: true);

            var report = CoverageCollector.Collect(config, DateTimeOffset.UtcNow.AddSeconds(-1));

            Assert.NotNull(report);
            Assert.Equal("invalid", report!.Status);
            Assert.Contains(report.Diagnostics!, diagnostic => diagnostic.Code == expectedCode);
        }
        finally
        {
            Directory.SetCurrentDirectory(originalDirectory);
            Environment.SetEnvironmentVariable("LIVEDOC_DOTNET_COVERAGE_TOOL", originalToolPath);
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("Coverage enabled without artifacts reports diagnostic code 'artifact-missing'")]
    public void Coverage_enabled_without_artifacts_reports_missing_artifact_diagnostic()
    {
        var expectedCode = Rule.Values[0].AsString();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-no-coverage-");
        var originalDirectory = Directory.GetCurrentDirectory();
        var originalRunMetadataDir = Environment.GetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar);
        var originalProfilerEnvironment = CaptureProfilerEnvironment();

        try
        {
            Directory.SetCurrentDirectory(tempDir.FullName);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, null);
            ClearProfilerEnvironment();
            var config = new LiveDocConfig(
                serverUrl: string.Empty,
                project: "CoverageProject",
                environment: "local",
                coverageEnabled: true);

            var report = CoverageCollector.Collect(config, DateTimeOffset.UtcNow);

            Assert.NotNull(report);
            Assert.Equal("invalid", report!.Status);
            var diagnostic = Assert.Single(report.Diagnostics!);
            Assert.Equal(expectedCode, diagnostic.Code);
            Assert.Contains("Visual Studio Code Coverage", diagnostic.Message);
        }
        finally
        {
            Directory.SetCurrentDirectory(originalDirectory);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, originalRunMetadataDir);
            RestoreEnvironment(originalProfilerEnvironment);
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("Coverage enabled with post-run metadata directory reports diagnostic code 'coverage-pending-post-run' and status 'not-collected'")]
    public void Coverage_enabled_with_post_run_metadata_reports_pending_diagnostic()
    {
        var (expectedCode, expectedStatus) = Rule.Values.As<string, string>();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-post-run-coverage-");
        var originalDirectory = Directory.GetCurrentDirectory();
        var originalRunMetadataDir = Environment.GetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar);

        try
        {
            Directory.SetCurrentDirectory(tempDir.FullName);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, Path.Combine(tempDir.FullName, "metadata"));
            var config = new LiveDocConfig(
                serverUrl: string.Empty,
                project: "CoverageProject",
                environment: "local",
                coverageEnabled: true);

            var report = CoverageCollector.Collect(config, DateTimeOffset.UtcNow);

            Assert.NotNull(report);
            Assert.Equal(expectedStatus, report!.Status);
            var diagnostic = Assert.Single(report.Diagnostics!);
            Assert.Equal(expectedCode, diagnostic.Code);
            Assert.Contains("LiveDocCoverage", diagnostic.Message);
        }
        finally
        {
            Directory.SetCurrentDirectory(originalDirectory);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, originalRunMetadataDir);
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("Visual Studio coverage profiler '{324F817A-7420-4E6D-B3C1-143FBED6D855}' without artifacts reports diagnostic code 'coverage-pending-post-run' and status 'not-collected'")]
    public void Visual_Studio_coverage_profiler_without_artifacts_reports_missing_artifact_diagnostic()
    {
        var (profilerId, expectedCode, expectedStatus) = Rule.Values.As<string, string, string>();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-vs-profiler-");
        var originalDirectory = Directory.GetCurrentDirectory();
        var originalRunMetadataDir = Environment.GetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar);
        var originalProfilerEnabled = Environment.GetEnvironmentVariable("CORECLR_ENABLE_PROFILING");
        var originalProfiler = Environment.GetEnvironmentVariable("CORECLR_PROFILER");
        var originalProfilerPath = Environment.GetEnvironmentVariable("CORECLR_PROFILER_PATH");

        try
        {
            Directory.SetCurrentDirectory(tempDir.FullName);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, null);
            Environment.SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", "1");
            Environment.SetEnvironmentVariable("CORECLR_PROFILER", profilerId);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER_PATH", null);
            var config = new LiveDocConfig(
                serverUrl: string.Empty,
                project: "CoverageProject",
                environment: "local",
                coverageEnabled: false);

            var report = CoverageCollector.Collect(config, DateTimeOffset.UtcNow);

            Assert.NotNull(report);
            Assert.Equal(expectedStatus, report!.Status);
            var diagnostic = Assert.Single(report.Diagnostics!);
            Assert.Equal(expectedCode, diagnostic.Code);
            Assert.Contains("LiveDocCoverage", diagnostic.Message);
        }
        finally
        {
            Directory.SetCurrentDirectory(originalDirectory);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, originalRunMetadataDir);
            Environment.SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", originalProfilerEnabled);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER", originalProfiler);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER_PATH", originalProfilerPath);
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("Profiler flag 'CORECLR_ENABLE_PROFILING=1' without coverage details reports diagnostic code 'coverage-pending-post-run' and status 'not-collected'")]
    public void Profiler_flag_without_coverage_details_reports_missing_artifact_diagnostic()
    {
        var (profilerFlag, expectedCode, expectedStatus) = Rule.Values.As<string, string, string>();
        var tempDir = Directory.CreateTempSubdirectory("livedoc-xunit-profiler-flag-");
        var originalDirectory = Directory.GetCurrentDirectory();
        var originalRunMetadataDir = Environment.GetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar);
        var originalProfilerEnabled = Environment.GetEnvironmentVariable("CORECLR_ENABLE_PROFILING");
        var originalProfiler = Environment.GetEnvironmentVariable("CORECLR_PROFILER");
        var originalProfilerPath = Environment.GetEnvironmentVariable("CORECLR_PROFILER_PATH");

        try
        {
            Directory.SetCurrentDirectory(tempDir.FullName);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, null);
            Environment.SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", profilerFlag.Split('=')[1]);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER", null);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER_PATH", null);
            var config = new LiveDocConfig(
                serverUrl: string.Empty,
                project: "CoverageProject",
                environment: "local",
                coverageEnabled: false);

            var report = CoverageCollector.Collect(config, DateTimeOffset.UtcNow);

            Assert.NotNull(report);
            Assert.Equal(expectedStatus, report!.Status);
            var diagnostic = Assert.Single(report.Diagnostics!);
            Assert.Equal(expectedCode, diagnostic.Code);
        }
        finally
        {
            Directory.SetCurrentDirectory(originalDirectory);
            Environment.SetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar, originalRunMetadataDir);
            Environment.SetEnvironmentVariable("CORECLR_ENABLE_PROFILING", originalProfilerEnabled);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER", originalProfiler);
            Environment.SetEnvironmentVariable("CORECLR_PROFILER_PATH", originalProfilerPath);
            tempDir.Delete(recursive: true);
        }
    }

    [Rule("TestRunV1 serializes coverage without changing status 'passed'")]
    public void TestRunV1_serializes_coverage_without_changing_status()
    {
        var expectedStatus = Rule.Values[0].AsString();
        var run = new Reporter.Models.TestRunV1
        {
            RunId = "run-coverage",
            Project = "CoverageProject",
            Environment = "local",
            Framework = "xunit",
            Status = Reporter.Models.Status.Passed,
            Coverage = new Reporter.Models.CoverageReport
            {
                Status = "available",
                Summary = new Reporter.Models.CoverageSummary
                {
                    Lines = new Reporter.Models.CoverageMetric { Covered = 1, Total = 2, Pct = 50 }
                },
                Diagnostics =
                [
                    new Reporter.Models.CoverageDiagnostic
                    {
                        Severity = "warning",
                        Code = "threshold-warning",
                        Message = "lines coverage is 50.0%, below the configured 80.0% threshold."
                    }
                ]
            }
        };

        var json = JsonSerializer.Serialize(run, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Assert.Contains("\"status\":\"passed\"", json);
        Assert.Contains("\"coverage\"", json);
        Assert.Contains("\"threshold-warning\"", json);
        Assert.Equal(expectedStatus, run.Status.ToString().ToLowerInvariant());
    }

    private static Dictionary<string, string?> CaptureProfilerEnvironment()
    {
        return ProfilerEnvironmentVariables.ToDictionary(
            name => name,
            Environment.GetEnvironmentVariable);
    }

    private static void ClearProfilerEnvironment()
    {
        foreach (var name in ProfilerEnvironmentVariables)
            Environment.SetEnvironmentVariable(name, null);
    }

    private static void RestoreEnvironment(IReadOnlyDictionary<string, string?> values)
    {
        foreach (var (name, value) in values)
            Environment.SetEnvironmentVariable(name, value);
    }
}
