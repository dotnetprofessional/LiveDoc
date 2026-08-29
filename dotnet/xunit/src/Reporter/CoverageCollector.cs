using System.Globalization;
using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;

namespace SweDevTools.LiveDoc.xUnit.Reporter;

public static class CoverageCollector
{
    private static readonly string[] MetricNames = ["lines", "branches", "functions", "statements"];
    private const string DotnetCoverageToolEnvVar = "LIVEDOC_DOTNET_COVERAGE_TOOL";
    private const string DotnetCoverageCommand = "dotnet-coverage";
    private static readonly TimeSpan DotnetCoverageTimeout = TimeSpan.FromSeconds(30);
    internal static string DiagnosticVersion => _diagnosticVersion.Value;
    private static readonly Lazy<string> _diagnosticVersion = new(ResolveDiagnosticVersion);

    private enum CoverageArtifactFormat
    {
        Cobertura,
        VisualStudioCoverage,
        Unsupported
    }

    private sealed record Candidate(string Path, bool Configured, CoverageArtifactFormat Format);

    public static CoverageReport? Collect(LiveDocConfig config, DateTimeOffset runStartedAt)
    {
        var rootDir = Directory.GetCurrentDirectory();
        var configuredPath = string.IsNullOrWhiteSpace(config.CoveragePath)
            ? null
            : ResolvePath(rootDir, config.CoveragePath);
        var runMetadataDir = config.RunMetadataDir;
        var explicitCoverage = config.CoverageEnabled || configuredPath != null || LiveDocConfig.IsVisualStudioCoverageCollectorActive();
        var candidates = FindCandidates(rootDir, configuredPath).ToList();

        if (candidates.Count == 0)
        {
            return explicitCoverage
                ? ArtifactMissingReport(rootDir, configuredPath, candidates, runMetadataDir)
                : null;
        }

        var staleDiagnostics = new List<CoverageDiagnostic>();
        var unsupportedDiagnostics = new List<CoverageDiagnostic>();
        foreach (var candidate in candidates)
        {
            if (!File.Exists(candidate.Path))
            {
                if (candidate.Configured)
                    return ArtifactMissingReport(rootDir, configuredPath, candidates, runMetadataDir, candidate.Path);

                continue;
            }

            if (IsStale(candidate.Path, runStartedAt))
            {
                staleDiagnostics.Add(new CoverageDiagnostic
                {
                    Severity = "warning",
                    Code = "stale",
                    Message = "LiveDoc found a coverage artifact, but it appears older than the current test run.",
                    Path = candidate.Path
                });

                if (candidate.Configured)
                    return new CoverageReport { Status = "invalid", Diagnostics = staleDiagnostics };

                continue;
            }

            if (candidate.Format != CoverageArtifactFormat.Cobertura)
            {
                if (candidate.Format == CoverageArtifactFormat.VisualStudioCoverage)
                {
                    var converted = ConvertVisualStudioCoverage(candidate.Path, rootDir);
                    if (converted.CoberturaPath != null)
                    {
                        try
                        {
                            return ReadCoberturaReport(
                                converted.CoberturaPath,
                                rootDir,
                                candidate,
                                tool: DotnetCoverageCommand,
                                format: "visualstudio-coverage",
                                provenancePath: candidate.Path);
                        }
                        catch (Exception ex)
                        {
                            return DiagnosticReport(
                                "parse-failed",
                                "warning",
                                $"LiveDoc converted the Visual Studio .coverage file, but could not parse the Cobertura output: {ex.Message}",
                                candidate.Path);
                        }
                        finally
                        {
                            DeleteTemporaryFile(converted.CoberturaPath);
                        }
                    }

                    if (converted.Diagnostic != null)
                    {
                        if (candidate.Configured)
                            return new CoverageReport { Status = "invalid", Diagnostics = [converted.Diagnostic] };

                        unsupportedDiagnostics.Add(converted.Diagnostic);
                        continue;
                    }
                }

                var diagnostic = UnsupportedCoverageDiagnostic(candidate.Path, candidate.Format);
                if (candidate.Configured)
                    return new CoverageReport { Status = "invalid", Diagnostics = [diagnostic] };

                unsupportedDiagnostics.Add(diagnostic);
                continue;
            }

            try
            {
                return ReadCoberturaReport(candidate.Path, rootDir, candidate, tool: "coverlet", format: "cobertura", provenancePath: candidate.Path);
            }
            catch (Exception ex)
            {
                return DiagnosticReport(
                    "parse-failed",
                    "warning",
                    $"LiveDoc could not parse the coverage artifact: {ex.Message}",
                    candidate.Path);
            }
        }

        if (unsupportedDiagnostics.Count > 0)
            return new CoverageReport { Status = "invalid", Diagnostics = unsupportedDiagnostics };

        if (staleDiagnostics.Count > 0 && explicitCoverage && !string.IsNullOrWhiteSpace(runMetadataDir))
            return ArtifactMissingReport(rootDir, configuredPath, candidates, runMetadataDir);

        return staleDiagnostics.Count > 0 && explicitCoverage
            ? new CoverageReport { Status = "invalid", Diagnostics = staleDiagnostics }
            : null;
    }

    public static CoverageReport ParseCobertura(string filePath, string? rootDir = null)
    {
        rootDir ??= Directory.GetCurrentDirectory();
        var document = XDocument.Load(filePath);
        var classes = document
            .Descendants()
            .Where(e => e.Name.LocalName == "class")
            .Select(element => new
            {
                Element = element,
                Path = (string?)element.Attribute("filename") ?? string.Empty,
                Module = NormalizeCoverageModule(
                    (string?)element.Ancestors().FirstOrDefault(
                        ancestor => ancestor.Name.LocalName == "package")?.Attribute("name"))
            })
            .Where(item => ShouldIncludeCoveragePath(item.Path));
        var files = new List<CoverageFile>();

        foreach (var group in classes.GroupBy(item => new { item.Module, item.Path }))
        {
            var lineElements = group
                .SelectMany(item => item.Element.Elements().Where(e => e.Name.LocalName == "lines"))
                .SelectMany(lines => lines.Elements().Where(e => e.Name.LocalName == "line"))
                .ToList();
            if (lineElements.Count == 0)
            {
                lineElements = group
                    .SelectMany(item => item.Element.Descendants().Where(e => e.Name.LocalName == "line"))
                    .ToList();
            }
            var lineHits = lineElements
                .Select(e => ParseDouble((string?)e.Attribute("hits")))
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();
            var branchCounts = lineElements
                .Select(e => ParseConditionCoverage((string?)e.Attribute("condition-coverage")))
                .Where(v => v.Total > 0)
                .ToList();
            var methodElements = group
                .SelectMany(item => item.Element.Descendants().Where(e => e.Name.LocalName == "method"))
                .ToList();
            var methodHits = methodElements
                .Select(method => method.Descendants().Where(e => e.Name.LocalName == "line"))
                .Select(lines => lines.Any(line => (ParseDouble((string?)line.Attribute("hits")) ?? 0) > 0) ? 1d : 0d)
                .ToList();

            var summary = new CoverageSummary
            {
                Lines = MetricFromHits(lineHits),
                Statements = MetricFromHits(lineHits),
                Branches = branchCounts.Count > 0
                    ? MakeMetric(branchCounts.Sum(v => v.Covered), branchCounts.Sum(v => v.Total))
                    : null,
                Functions = methodHits.Count > 0 ? MetricFromHits(methodHits) : null
            };

            files.Add(new CoverageFile
            {
                Path = NormalizeCoveragePath(group.Key.Path, rootDir),
                Module = group.Key.Module,
                Summary = summary
            });
        }

        return new CoverageReport
        {
            Status = "available",
            Summary = Aggregate(files.Select(file => file.Summary)),
            Files = files.OrderBy(file => file.Path, StringComparer.OrdinalIgnoreCase).ToList()
        };
    }

    private static string? NormalizeCoverageModule(string? module)
    {
        if (string.IsNullOrWhiteSpace(module))
            return null;

        var normalized = module.Trim();
        if (normalized.EndsWith(".dll", StringComparison.OrdinalIgnoreCase) ||
            normalized.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            normalized = Path.GetFileNameWithoutExtension(normalized);
        }

        return normalized;
    }

    private static bool ShouldIncludeCoveragePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;

        return !Path.IsPathRooted(path) || File.Exists(path);
    }

    private static CoverageReport ReadCoberturaReport(
        string coberturaPath,
        string rootDir,
        Candidate candidate,
        string tool,
        string format,
        string provenancePath)
    {
        var report = ParseCobertura(coberturaPath, rootDir);
        report.Provenance = new CoverageProvenance
        {
            Tool = tool,
            Format = format,
            Path = provenancePath,
            Detected = candidate.Configured ? "configured" : "auto",
            GeneratedAt = File.GetLastWriteTimeUtc(provenancePath).ToString("O", CultureInfo.InvariantCulture)
        };
        ApplyThresholds(report);
        return report;
    }

    private static IEnumerable<Candidate> FindCandidates(string rootDir, string? configuredPath)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void Add(string path, bool configured, List<Candidate> output)
        {
            var resolved = ResolvePath(rootDir, path);
            if (seen.Add(resolved))
                output.Add(new Candidate(resolved, configured, DetectFormat(resolved)));
        }

        var candidates = new List<Candidate>();
        if (configuredPath != null)
            Add(configuredPath, true, candidates);

        Add(Path.Combine(rootDir, "coverage.cobertura.xml"), false, candidates);
        Add(Path.Combine(rootDir, "coverage", "coverage.cobertura.xml"), false, candidates);

        foreach (var dir in new[]
        {
            Path.Combine(rootDir, "TestResults"),
            Path.Combine(rootDir, "coverage"),
            Path.Combine(AppContext.BaseDirectory, "TestResults")
        })
        {
            if (!Directory.Exists(dir))
                continue;

            foreach (var path in Directory.EnumerateFiles(dir, "*.cobertura.xml", SearchOption.AllDirectories))
                Add(path, false, candidates);

            foreach (var path in Directory.EnumerateFiles(dir, "*.coverage", SearchOption.AllDirectories))
                Add(path, false, candidates);
        }

        return candidates
            .Where(candidate => candidate.Configured || File.Exists(candidate.Path))
            .OrderByDescending(candidate => candidate.Configured)
            .ThenBy(candidate => candidate.Format == CoverageArtifactFormat.Cobertura ? 0 : 1)
            .ThenByDescending(candidate => File.Exists(candidate.Path) ? File.GetLastWriteTimeUtc(candidate.Path) : DateTime.MinValue);
    }

    private static CoverageReport DiagnosticReport(
        string code,
        string severity,
        string message,
        string? path = null,
        List<string>? details = null)
    {
        return new CoverageReport
        {
            Status = severity == "info" ? "not-collected" : "invalid",
            Diagnostics =
            [
                new CoverageDiagnostic
                {
                    Severity = severity,
                    Code = code,
                    Message = message,
                    Path = path,
                    Details = details
                }
            ]
        };
    }

    private static CoverageReport ArtifactMissingReport(
        string rootDir,
        string? configuredPath,
        IReadOnlyList<Candidate> candidates,
        string? runMetadataDir,
        string? path = null)
    {
        var details = BuildMissingArtifactDetails(rootDir, configuredPath, candidates, runMetadataDir);
        if (!string.IsNullOrWhiteSpace(runMetadataDir))
        {
            return DiagnosticReport(
                "coverage-pending-post-run",
                "info",
                "Coverage was enabled, but the artifact was not available during reporter flush. VSTest can finalize coverage attachments after the in-process xUnit reporter completes. The packaged LiveDocCoverage data collector and attachment processor are proven by LD-COV-010/020 (collector), LD-COV-040/050 (processor), and LD-COV-080 (coverage attached). Visual Studio can suppress informational processor messages, so inspect the livedoc-coverage-processor.log path reported by LD-COV-040 when the Tests output pane is silent.",
                path,
                details);
        }

        return DiagnosticReport(
            "artifact-missing",
            "warning",
            "Coverage was enabled, but LiveDoc could not find a supported Cobertura coverage artifact during reporter flush. If you used Visual Studio Code Coverage, VSTest writes the .coverage attachment after the in-process reporter completes; the packaged LiveDocCoverage data collector and attachment processor convert and attach it after the run when dotnet-coverage is installed. Look for LD-COV-010/020/040/050, or generate Cobertura during the run with XPlat Code Coverage/Coverlet.",
            path,
            details);
    }

    private static List<string> BuildMissingArtifactDetails(
        string rootDir,
        string? configuredPath,
        IReadOnlyList<Candidate> candidates,
        string? runMetadataDir)
    {
        var rawMetadataDir = Environment.GetEnvironmentVariable(LiveDocConfig.RunMetadataDirEnvVar);
        var expandedMetadataDir = string.IsNullOrWhiteSpace(rawMetadataDir)
            ? runMetadataDir
            : Environment.ExpandEnvironmentVariables(rawMetadataDir);
        var metadataExists = !string.IsNullOrWhiteSpace(expandedMetadataDir) && Directory.Exists(expandedMetadataDir);
        var metadataFileCount = metadataExists
            ? Directory.EnumerateFiles(expandedMetadataDir!, "*.json", SearchOption.TopDirectoryOnly).Count()
            : 0;

        var rootTestResults = Path.Combine(rootDir, "TestResults");
        var baseTestResults = Path.Combine(AppContext.BaseDirectory, "TestResults");

        var details = new List<string>
        {
            $"LiveDoc.xUnit.Version={DiagnosticVersion}",
            $"LiveDoc.xUnit.Assembly={typeof(CoverageCollector).Assembly.Location}",
            $"ProcessId={Environment.ProcessId}",
            $"CurrentDirectory={rootDir}",
            $"AppContext.BaseDirectory={AppContext.BaseDirectory}",
            $"LIVEDOC_COVERAGE={ValueOrMissing(Environment.GetEnvironmentVariable(LiveDocConfig.CoverageEnvVar))}",
            $"LIVEDOC_COVERAGE_PATH={ValueOrMissing(Environment.GetEnvironmentVariable(LiveDocConfig.CoveragePathEnvVar))}",
            $"ConfiguredCoveragePath={ValueOrMissing(configuredPath)}",
            $"LIVEDOC_RUN_METADATA_DIR(raw)={ValueOrMissing(rawMetadataDir)}",
            $"LIVEDOC_RUN_METADATA_DIR(expanded)={ValueOrMissing(expandedMetadataDir)}",
            $"RunMetadataDirExists={metadataExists}",
            $"RunMetadataFileCount={metadataFileCount}",
            $"COR_ENABLE_PROFILING={ValueOrMissing(Environment.GetEnvironmentVariable("COR_ENABLE_PROFILING"))}",
            $"CORECLR_ENABLE_PROFILING={ValueOrMissing(Environment.GetEnvironmentVariable("CORECLR_ENABLE_PROFILING"))}",
            $"COR_PROFILER={ValueOrMissing(Environment.GetEnvironmentVariable("COR_PROFILER"))}",
            $"CORECLR_PROFILER={ValueOrMissing(Environment.GetEnvironmentVariable("CORECLR_PROFILER"))}",
            $"COR_PROFILER_PATH={ValueOrMissing(Environment.GetEnvironmentVariable("COR_PROFILER_PATH"))}",
            $"CORECLR_PROFILER_PATH={ValueOrMissing(Environment.GetEnvironmentVariable("CORECLR_PROFILER_PATH"))}",
            $"VisualStudioCoverageCollectorActive={LiveDocConfig.IsVisualStudioCoverageCollectorActive()}",
            DescribeCoverageDirectory("CurrentDirectory/TestResults", rootTestResults),
            DescribeCoverageDirectory("AppContext/TestResults", baseTestResults),
            $"CandidateCount={candidates.Count}"
        };

        foreach (var candidate in candidates.Take(10))
        {
            details.Add($"Candidate={candidate.Path}; exists={File.Exists(candidate.Path)}; configured={candidate.Configured}; format={candidate.Format}");
        }

        return details;
    }

    private static string DescribeCoverageDirectory(string label, string path)
    {
        if (!Directory.Exists(path))
            return $"{label}={path}; exists=False";

        var coberturaCount = Directory.EnumerateFiles(path, "*.cobertura.xml", SearchOption.AllDirectories).Count();
        var coverageCount = Directory.EnumerateFiles(path, "*.coverage", SearchOption.AllDirectories).Count();
        return $"{label}={path}; exists=True; coberturaXml={coberturaCount}; coverage={coverageCount}";
    }

    private static string ValueOrMissing(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? "<not set>" : value;
    }

    private static string ResolveDiagnosticVersion()
    {
        var assembly = typeof(CoverageCollector).Assembly;
        var informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrWhiteSpace(informational))
            return informational;

        return assembly.GetName().Version?.ToString() ?? "unknown";
    }

    private static CoverageArtifactFormat DetectFormat(string path)
    {
        var normalized = path.Replace('\\', '/').ToLowerInvariant();
        if (normalized.EndsWith(".cobertura.xml", StringComparison.Ordinal) ||
            normalized.EndsWith("/coverage.cobertura.xml", StringComparison.Ordinal))
            return CoverageArtifactFormat.Cobertura;

        if (normalized.EndsWith(".coverage", StringComparison.Ordinal))
            return CoverageArtifactFormat.VisualStudioCoverage;

        return CoverageArtifactFormat.Unsupported;
    }

    private static CoverageDiagnostic UnsupportedCoverageDiagnostic(string path, CoverageArtifactFormat format)
    {
        var message = format == CoverageArtifactFormat.VisualStudioCoverage
            ? "LiveDoc found a Visual Studio .coverage file, but dotnet-coverage was not available to convert it. Install the dotnet-coverage tool or generate Cobertura with Coverlet/XPlat Code Coverage."
            : "LiveDoc found a coverage artifact, but the file format is not supported. Generate Cobertura XML and set LIVEDOC_COVERAGE_PATH if it is outside the standard TestResults folder.";

        return new CoverageDiagnostic
        {
            Severity = "warning",
            Code = "unsupported-format",
            Message = message,
            Path = path
        };
    }

    private sealed record ConversionResult(string? CoberturaPath, CoverageDiagnostic? Diagnostic);

    private static ConversionResult ConvertVisualStudioCoverage(string coveragePath, string rootDir)
    {
        var outputPath = Path.Combine(Path.GetTempPath(), $"livedoc-{Guid.NewGuid():N}.cobertura.xml");
        var tool = ResolveDotnetCoverageTool(rootDir);

        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = tool,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };

            process.StartInfo.ArgumentList.Add("merge");
            process.StartInfo.ArgumentList.Add(coveragePath);
            process.StartInfo.ArgumentList.Add("-f");
            process.StartInfo.ArgumentList.Add("cobertura");
            process.StartInfo.ArgumentList.Add("-o");
            process.StartInfo.ArgumentList.Add(outputPath);
            process.StartInfo.ArgumentList.Add("--nologo");

            if (!process.Start())
            {
                return new ConversionResult(null, DotnetCoverageConversionFailedDiagnostic(coveragePath, "dotnet-coverage did not start."));
            }

            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            if (!process.WaitForExit((int)DotnetCoverageTimeout.TotalMilliseconds))
            {
                process.Kill(entireProcessTree: true);
                return new ConversionResult(null, DotnetCoverageConversionFailedDiagnostic(coveragePath, "dotnet-coverage timed out while converting the .coverage file."));
            }

            var stdout = stdoutTask.GetAwaiter().GetResult();
            var stderr = stderrTask.GetAwaiter().GetResult();
            if (process.ExitCode != 0 || !File.Exists(outputPath))
            {
                DeleteTemporaryFile(outputPath);
                var details = FirstNonEmptyLine(stderr) ?? FirstNonEmptyLine(stdout) ?? $"dotnet-coverage exited with code {process.ExitCode}.";
                return new ConversionResult(null, DotnetCoverageConversionFailedDiagnostic(coveragePath, details));
            }

            return new ConversionResult(outputPath, null);
        }
        catch (System.ComponentModel.Win32Exception ex)
        {
            DeleteTemporaryFile(outputPath);
            return new ConversionResult(null, DotnetCoverageMissingDiagnostic(coveragePath, ex.Message));
        }
        catch (Exception ex)
        {
            DeleteTemporaryFile(outputPath);
            return new ConversionResult(null, DotnetCoverageConversionFailedDiagnostic(coveragePath, ex.Message));
        }
    }

    private static string ResolveDotnetCoverageTool(string rootDir)
    {
        var configured = Environment.GetEnvironmentVariable(DotnetCoverageToolEnvVar);
        if (string.IsNullOrWhiteSpace(configured))
            return DotnetCoverageCommand;

        return configured.Contains(Path.DirectorySeparatorChar) ||
               configured.Contains(Path.AltDirectorySeparatorChar) ||
               Path.IsPathRooted(configured)
            ? ResolvePath(rootDir, configured)
            : configured;
    }

    private static CoverageDiagnostic DotnetCoverageMissingDiagnostic(string path, string detail)
    {
        return new CoverageDiagnostic
        {
            Severity = "warning",
            Code = "dotnet-coverage-missing",
            Message = "LiveDoc found a Visual Studio .coverage file, but dotnet-coverage is not installed or is not on PATH. Install it with: dotnet tool install --global dotnet-coverage",
            Path = path,
            Details = [detail]
        };
    }

    private static CoverageDiagnostic DotnetCoverageConversionFailedDiagnostic(string path, string detail)
    {
        return new CoverageDiagnostic
        {
            Severity = "warning",
            Code = "dotnet-coverage-conversion-failed",
            Message = "LiveDoc found a Visual Studio .coverage file, but dotnet-coverage could not convert it to Cobertura.",
            Path = path,
            Details = [detail]
        };
    }

    private static string? FirstNonEmptyLine(string text)
    {
        return text
            .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .FirstOrDefault(line => !string.IsNullOrWhiteSpace(line));
    }

    private static void DeleteTemporaryFile(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch (IOException)
        {
            // Best-effort cleanup only; conversion diagnostics already capture actionable failures.
        }
        catch (UnauthorizedAccessException)
        {
            // Best-effort cleanup only; conversion diagnostics already capture actionable failures.
        }
    }

    private static CoverageSummary Aggregate(IEnumerable<CoverageSummary> summaries)
    {
        var list = summaries.ToList();
        return new CoverageSummary
        {
            Lines = AggregateMetric(list.Select(s => s.Lines)),
            Branches = AggregateMetric(list.Select(s => s.Branches)),
            Functions = AggregateMetric(list.Select(s => s.Functions)),
            Statements = AggregateMetric(list.Select(s => s.Statements))
        };
    }

    private static CoverageMetric? AggregateMetric(IEnumerable<CoverageMetric?> metrics)
    {
        var list = metrics.Where(m => m != null).Select(m => m!).ToList();
        if (list.Count == 0)
            return null;

        return MakeMetric(list.Sum(m => m.Covered), list.Sum(m => m.Total), list.Sum(m => m.Skipped ?? 0));
    }

    private static CoverageMetric MetricFromHits(IReadOnlyCollection<double> values)
    {
        return MakeMetric(values.Count(v => v > 0), values.Count);
    }

    private static CoverageMetric MakeMetric(double covered, double total, double? skipped = null)
    {
        return new CoverageMetric
        {
            Covered = covered,
            Total = total,
            Skipped = skipped is > 0 ? skipped : null,
            Pct = total <= 0 ? null : Math.Round((covered / total) * 100, 1)
        };
    }

    private static void ApplyThresholds(CoverageReport report)
    {
        var thresholds = new List<CoverageThreshold>();
        foreach (var metric in MetricNames)
        {
            var minimum = ParseDouble(Environment.GetEnvironmentVariable($"LIVEDOC_COVERAGE_THRESHOLD_{metric.ToUpperInvariant()}"));
            if (minimum is null or < 0 or > 100)
                continue;

            var actual = MetricByName(report.Summary, metric)?.Pct;
            var status = actual.HasValue && actual.Value < minimum ? "warning" : "passed";
            thresholds.Add(new CoverageThreshold
            {
                Metric = metric,
                Minimum = minimum.Value,
                Actual = actual,
                Status = status
            });

            if (status == "warning")
            {
                report.Diagnostics ??= new List<CoverageDiagnostic>();
                report.Diagnostics.Add(new CoverageDiagnostic
                {
                    Severity = "warning",
                    Code = "threshold-warning",
                    Message = $"{metric} coverage is {actual:0.0}%, below the configured {minimum:0.0}% threshold."
                });
            }
        }

        if (thresholds.Count > 0)
            report.Thresholds = thresholds;
    }

    private static CoverageMetric? MetricByName(CoverageSummary? summary, string metric)
    {
        return metric switch
        {
            "lines" => summary?.Lines,
            "branches" => summary?.Branches,
            "functions" => summary?.Functions,
            "statements" => summary?.Statements,
            _ => null
        };
    }

    private static (double Covered, double Total) ParseConditionCoverage(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return (0, 0);

        var match = Regex.Match(value, @"\((?<covered>\d+)\s*/\s*(?<total>\d+)\)");
        if (!match.Success)
            return (0, 0);

        return (
            double.Parse(match.Groups["covered"].Value, CultureInfo.InvariantCulture),
            double.Parse(match.Groups["total"].Value, CultureInfo.InvariantCulture));
    }

    private static double? ParseDouble(string? value)
    {
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static bool IsStale(string filePath, DateTimeOffset runStartedAt)
    {
        return File.GetLastWriteTimeUtc(filePath).AddSeconds(2) < runStartedAt.UtcDateTime;
    }

    private static string NormalizeCoveragePath(string filePath, string rootDir)
    {
        var normalized = filePath.Replace('\\', Path.DirectorySeparatorChar).Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.IsPathRooted(normalized)
            ? Path.GetFullPath(normalized)
            : Path.GetFullPath(Path.Combine(rootDir, normalized));
        var relative = Path.GetRelativePath(rootDir, fullPath);
        if (relative.StartsWith("..", StringComparison.Ordinal))
            relative = filePath;

        return relative.Replace('\\', '/');
    }

    private static string ResolvePath(string rootDir, string path)
    {
        return Path.IsPathRooted(path) ? Path.GetFullPath(path) : Path.GetFullPath(Path.Combine(rootDir, path));
    }
}
