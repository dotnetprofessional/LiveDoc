using System.Diagnostics;
using System.Globalization;
using System.Net.Http.Headers;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;

namespace SweDevTools.LiveDoc.xUnit.Logger;

[FriendlyName("LiveDocCoverage")]
[ExtensionUri("logger://swedevtools/livedoc/coverage")]
public sealed class LiveDocCoverageLogger : ITestLoggerWithParameters
{
    private string? _metadataDir;
    private DateTime _initializedAtUtc;

    public void Initialize(TestLoggerEvents events, string testRunDirectory)
    {
        _initializedAtUtc = DateTime.UtcNow;
        _metadataDir = LiveDocPostRunCoverage.ConfigureEnvironment();
        if (LiveDocPostRunCoverage.VerboseDiagnosticsEnabled())
            Console.Error.WriteLine(LiveDocPostRunCoverage.FormatInitializationDiagnostic(_metadataDir, _initializedAtUtc, "Initialize(testRunDirectory)"));
        events.TestRunComplete += OnTestRunComplete;
    }

    public void Initialize(TestLoggerEvents events, Dictionary<string, string?> parameters)
    {
        _initializedAtUtc = DateTime.UtcNow;
        _metadataDir = LiveDocPostRunCoverage.ConfigureEnvironment(parameters);
        if (LiveDocPostRunCoverage.VerboseDiagnosticsEnabled())
            Console.Error.WriteLine(LiveDocPostRunCoverage.FormatInitializationDiagnostic(_metadataDir, _initializedAtUtc, "Initialize(parameters)"));
        events.TestRunComplete += OnTestRunComplete;
    }

    private void OnTestRunComplete(object? sender, TestRunCompleteEventArgs e)
    {
        var messages = LiveDocPostRunCoverage.Publish(e.AttachmentSets, _metadataDir, reportMissingMetadata: false, _initializedAtUtc);
        foreach (var message in messages)
            Console.Error.WriteLine(message);
    }
}

public static class LiveDocPostRunCoverage
{
    private const string DotnetCoverageToolEnvVar = "LIVEDOC_DOTNET_COVERAGE_TOOL";
    public const string RunMetadataDirEnvironmentVariable = "LIVEDOC_RUN_METADATA_DIR";
    private const string DiagnosticsEnvVar = "LIVEDOC_COVERAGE_DIAGNOSTICS";
    private static readonly TimeSpan DotnetCoverageTimeout = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan UploadTimeout = TimeSpan.FromSeconds(15);
    private static readonly string[] MetricNames = ["lines", "branches", "functions", "statements"];
    private static readonly Lazy<string> Version = new(ResolveDiagnosticVersion);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    public sealed record CoverageMetadataScope(
        string MetadataDir,
        DateTime? NotBeforeUtc,
        bool IncludeFallbackMetadataRoot = false);

    public sealed record CoverageUploadResult(
        bool Success,
        string Status,
        string BodySummary);

    public delegate CoverageUploadResult CoverageUploader(string endpoint, byte[] payload);

    public static string ConfigureEnvironment(Dictionary<string, string?>? parameters = null)
    {
        if (parameters != null)
        {
            BridgeParameter(parameters, "ServerUrl", "LIVEDOC_SERVER_URL");
            BridgeParameter(parameters, "Project", "LIVEDOC_PROJECT");
            BridgeParameter(parameters, "Environment", "LIVEDOC_ENVIRONMENT");
            BridgeParameter(parameters, "ExportPath", "LIVEDOC_EXPORT_PATH");
            BridgeParameter(parameters, "Coverage", "LIVEDOC_COVERAGE");
            BridgeParameter(parameters, "CoveragePath", "LIVEDOC_COVERAGE_PATH");
            BridgeParameter(parameters, "DotnetCoverageTool", DotnetCoverageToolEnvVar);
            BridgeParameter(parameters, "RunMetadataDir", RunMetadataDirEnvironmentVariable);
            BridgeParameter(parameters, "Diagnostics", DiagnosticsEnvVar);
        }

        var existing = Environment.GetEnvironmentVariable(RunMetadataDirEnvironmentVariable);
        if (!string.IsNullOrWhiteSpace(existing))
        {
            existing = Environment.ExpandEnvironmentVariables(existing);
            Environment.SetEnvironmentVariable(RunMetadataDirEnvironmentVariable, existing);
            Directory.CreateDirectory(existing);
            return existing;
        }

        var metadataDir = Path.Combine(
            Path.GetTempPath(),
            "livedoc-xunit",
            "run-metadata",
            Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(metadataDir);
        Environment.SetEnvironmentVariable(RunMetadataDirEnvironmentVariable, metadataDir);
        return metadataDir;
    }

    public static string ResolveMetadataRoot(XmlElement? configurationElement)
    {
        var configured = configurationElement?["RunMetadataRoot"]?.InnerText
                         ?? configurationElement?["RunMetadataDir"]?.InnerText
                         ?? Environment.GetEnvironmentVariable(RunMetadataDirEnvironmentVariable);
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(Environment.ExpandEnvironmentVariables(configured));

        return Path.Combine(DefaultMetadataRoot(), "automatic");
    }

    public static string CreateInvocationMetadataDirectory(XmlElement? configurationElement)
    {
        var root = ResolveMetadataRoot(configurationElement);
        var metadataDir = Path.Combine(
            root,
            $"vstest-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(metadataDir);
        Environment.SetEnvironmentVariable(RunMetadataDirEnvironmentVariable, metadataDir);
        return metadataDir;
    }

    public static IReadOnlyList<string> Publish(
        IEnumerable<AttachmentSet>? attachmentSets,
        string? metadataDir,
        bool reportMissingMetadata,
        DateTime? metadataNotBeforeUtc = null,
        bool includeFallbackMetadataRoot = true)
    {
        return Publish(
            attachmentSets,
            [
                new CoverageMetadataScope(
                    metadataDir ?? string.Empty,
                    metadataNotBeforeUtc,
                    includeFallbackMetadataRoot)
            ],
            reportMissingMetadata);
    }

    public static IReadOnlyList<string> Publish(
        IEnumerable<AttachmentSet>? attachmentSets,
        IEnumerable<CoverageMetadataScope> metadataScopes,
        bool reportMissingMetadata,
        CoverageUploader? uploader = null)
    {
        var scopes = metadataScopes
            .Where(scope => !string.IsNullOrWhiteSpace(scope.MetadataDir))
            .GroupBy(scope => NormalizeDirectory(scope.MetadataDir), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderBy(scope => scope.NotBeforeUtc).First())
            .ToList();
        var coverageAttachments = FindCoverageAttachments(attachmentSets)
            .GroupBy(attachment => attachment.Path, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .Where(attachment => File.Exists(attachment.Path))
            .ToList();
        if (coverageAttachments.Count == 0)
        {
            if (!VerboseDiagnosticsEnabled())
                return Array.Empty<string>();

            var noAttachmentMessages = scopes
                .SelectMany(scope => BuildInvocationDiagnostics(attachmentSets, scope.MetadataDir, scope.NotBeforeUtc))
                .ToList();
            noAttachmentMessages.Add(
                "[LiveDoc] LD-COV-051 coverage-attachment-missing: " +
                "LiveDoc post-run coverage executed, but VSTest provided no existing .coverage or .cobertura.xml attachments.");
            return noAttachmentMessages;
        }

        var messages = new List<string>();
        foreach (var scope in scopes)
            messages.AddRange(BuildInvocationDiagnostics(attachmentSets, scope.MetadataDir, scope.NotBeforeUtc));

        foreach (var attachment in coverageAttachments)
        {
            messages.Add(
                $"[LiveDoc] LD-COV-050 coverage-attachment-matched: path={attachment.Path}; " +
                $"format={attachment.Format}; exists={File.Exists(attachment.Path)}; " +
                $"lastWriteUtc={File.GetLastWriteTimeUtc(attachment.Path):O}");
        }

        var matchedRuns = new List<RunMetadataTarget>();
        foreach (var scope in scopes)
        {
            var metadataResult = LoadRunMetadata(
                scope.MetadataDir,
                scope.NotBeforeUtc,
                scope.IncludeFallbackMetadataRoot);
            matchedRuns.AddRange(metadataResult.Matched);

            if (metadataResult.Matched.Count > 0)
            {
                messages.Add(
                    $"[LiveDoc] LD-COV-052 metadata-matched: metadataDir={scope.MetadataDir}; " +
                    $"runCount={metadataResult.Matched.Count}; " +
                    $"runIds={string.Join(",", metadataResult.Matched.Select(item => item.Metadata.RunId))}");
            }

            if (metadataResult.StaleFiles.Count > 0)
            {
                messages.Add(
                    $"[LiveDoc] LD-COV-054 metadata-stale-ignored: metadataDir={scope.MetadataDir}; " +
                    $"count={metadataResult.StaleFiles.Count}; notBeforeUtc={scope.NotBeforeUtc:O}; " +
                    $"sample={metadataResult.StaleFiles[0]}");
            }

            if (metadataResult.InvalidFiles.Count > 0)
            {
                messages.Add(
                    $"[LiveDoc] LD-COV-055 metadata-invalid-ignored: metadataDir={scope.MetadataDir}; " +
                    $"count={metadataResult.InvalidFiles.Count}; sample={metadataResult.InvalidFiles[0]}");
            }
        }

        var distinctRuns = matchedRuns
            .GroupBy(target => target.Metadata.RunId, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .ToList();
        if (distinctRuns.Count == 0)
        {
            var source = reportMissingMetadata ? "attachment-processor" : "coverage-logger";
            messages.Add(
                $"[LiveDoc] LD-COV-053 metadata-missing: source={source}; " +
                $"metadataDirs={string.Join(",", scopes.Select(scope => scope.MetadataDir))}; " +
                $"searchRoot={DefaultMetadataRoot()}");
            return messages;
        }

        var datasetId = ComputeCoverageDatasetId(coverageAttachments);
        var pendingRuns = new List<RunMetadataTarget>();
        foreach (var target in distinctRuns)
        {
            var sentinelPath = GetAcceptedSentinelPath(target.MetadataDir, target.Metadata.RunId!);
            if (IsAcceptedDataset(sentinelPath, datasetId))
            {
                messages.Add(
                    $"[LiveDoc] LD-COV-081 upload-skipped-accepted: runId={target.Metadata.RunId}; " +
                    $"datasetId={datasetId}; sentinel={sentinelPath}");
            }
            else
            {
                pendingRuns.Add(target);
            }
        }

        if (pendingRuns.Count == 0)
            return messages;

        distinctRuns = pendingRuns;

        var directCoberturaPaths = coverageAttachments
            .Where(attachment => attachment.Format == CoverageAttachmentFormat.Cobertura)
            .Select(attachment => attachment.Path)
            .ToList();
        var visualStudioPaths = coverageAttachments
            .Where(attachment => attachment.Format == CoverageAttachmentFormat.VisualStudioCoverage)
            .Select(attachment => attachment.Path)
            .ToList();
        var temporaryCoberturaPath = string.Empty;

        if (directCoberturaPaths.Count == 0)
        {
            var conversionRoot = scopes.FirstOrDefault()?.MetadataDir ?? Path.GetTempPath();
            var tool = ResolveDotnetCoverageTool(conversionRoot);
            messages.Add(
                $"[LiveDoc] LD-COV-060 conversion-started: tool={tool}; " +
                $"inputCount={visualStudioPaths.Count}; inputs={DescribeArtifacts(visualStudioPaths, "Visual Studio .coverage artifacts")}");
            var converted = ConvertVisualStudioCoverage(visualStudioPaths, conversionRoot);
            if (converted.CoberturaPath == null)
            {
                var code = converted.Code == "dotnet-coverage-missing" ? "LD-COV-062" : "LD-COV-063";
                messages.Add(
                    $"[LiveDoc] {code} {converted.Code}: tool={tool}; inputCount={visualStudioPaths.Count}; " +
                    $"message={converted.Message}");
                return messages;
            }

            temporaryCoberturaPath = converted.CoberturaPath;
            directCoberturaPaths.Add(converted.CoberturaPath);
            messages.Add(
                $"[LiveDoc] LD-COV-061 conversion-succeeded: tool={tool}; " +
                $"output={converted.CoberturaPath}; exists={File.Exists(converted.CoberturaPath)}");
        }

        try
        {
            var rootDir = Directory.GetCurrentDirectory();
            var report = ParseCoberturaFiles(directCoberturaPaths, rootDir);
            var convertedVisualStudioCoverage = temporaryCoberturaPath.Length > 0;
            var sourcePaths = visualStudioPaths.Count > 0 && temporaryCoberturaPath.Length > 0
                ? visualStudioPaths
                : directCoberturaPaths;
            report.Provenance = new CoverageProvenance
            {
                Tool = convertedVisualStudioCoverage ? "dotnet-coverage" : "vstest-coverage-collector",
                Format = convertedVisualStudioCoverage ? "visualstudio-coverage" : "cobertura",
                Path = DescribeArtifacts(
                    sourcePaths,
                    convertedVisualStudioCoverage ? "Visual Studio .coverage artifacts" : "Cobertura coverage artifacts"),
                Detected = "auto",
                GeneratedAt = sourcePaths
                    .Select(File.GetLastWriteTimeUtc)
                    .DefaultIfEmpty(DateTime.UtcNow)
                    .Max()
                    .ToString("O", CultureInfo.InvariantCulture)
            };
            if (distinctRuns.Count > 1)
            {
                report.Diagnostics ??= new List<CoverageDiagnostic>();
                report.Diagnostics.Add(new CoverageDiagnostic
                {
                    Severity = "info",
                    Code = "coverage-invocation-scope",
                    Message = "VSTest coverage attachments are produced for the whole test invocation, so LiveDoc attached the coverage report to each LiveDoc run recorded during this invocation."
                });
            }
            ApplyThresholds(report);
            messages.Add(
                $"[LiveDoc] LD-COV-064 cobertura-parse-succeeded: inputs={directCoberturaPaths.Count}; " +
                $"files={report.Files?.Count ?? 0}; linesPct={report.Summary?.Lines?.Pct?.ToString("0.0", CultureInfo.InvariantCulture) ?? "<not set>"}");

            if (distinctRuns.Count > 1)
            {
                messages.Add("[LiveDoc] Coverage note coverage-invocation-scope: VSTest coverage is invocation-scoped; the report will be attached to each LiveDoc run from this VSTest invocation.");
            }

            foreach (var target in distinctRuns)
            {
                var run = target.Metadata;
                var sentinelPath = GetAcceptedSentinelPath(target.MetadataDir, run.RunId!);
                if (IsAcceptedDataset(sentinelPath, datasetId))
                {
                    messages.Add(
                        $"[LiveDoc] LD-COV-081 upload-skipped-accepted: runId={run.RunId}; " +
                        $"datasetId={datasetId}; sentinel={sentinelPath}");
                    continue;
                }

                var endpoint = $"{run.ServerUrl!.TrimEnd('/')}/api/v1/runs/{Uri.EscapeDataString(run.RunId!)}/coverage";
                var payload = JsonSerializer.SerializeToUtf8Bytes(new { Coverage = report }, JsonOptions);
                var posted = PostCoverage(endpoint, payload, uploader);
                messages.Add(
                    $"[LiveDoc] LD-COV-070 server-request-complete: runId={run.RunId}; url={posted.Endpoint}; " +
                    $"status={posted.Status}; body={posted.BodySummary}");
                if (!posted.Success)
                {
                    messages.Add(
                        $"[LiveDoc] LD-COV-071 server-request-failed: runId={run.RunId}; url={posted.Endpoint}; " +
                        $"status={posted.Status}; body={posted.BodySummary}; retryable=true");
                    continue;
                }

                WriteAcceptedSentinel(sentinelPath, run.RunId!, posted.Status, datasetId);
                messages.Add(
                    $"[LiveDoc] LD-COV-080 server-accepted: runId={run.RunId}; url={posted.Endpoint}; " +
                    $"status={posted.Status}; persistenceCompleted={posted.Evidence?.PersistenceCompleted?.ToString() ?? "<unknown>"}; " +
                    $"broadcastMatched={posted.Evidence?.BroadcastMatched?.ToString() ?? "<unknown>"}; " +
                    $"broadcastSent={posted.Evidence?.BroadcastSent?.ToString() ?? "<unknown>"}; " +
                    $"broadcastFailed={posted.Evidence?.BroadcastFailed?.ToString() ?? "<unknown>"}; " +
                    $"restHydrationAvailable={posted.Evidence?.RestHydrationAvailable?.ToString() ?? "<unknown>"}; " +
                    $"sentinel={sentinelPath}");
            }

            return messages;
        }
        catch (Exception ex) when (
            ex is IOException or
            UnauthorizedAccessException or
            JsonException or
            XmlException or
            InvalidOperationException)
        {
            messages.Add(
                $"[LiveDoc] LD-COV-065 cobertura-parse-failed: exception={ex.GetType().Name}; " +
                $"message={ex.Message}; inputs={string.Join(",", directCoberturaPaths)}");
            return messages;
        }
        finally
        {
            DeleteTemporaryFile(temporaryCoberturaPath);
        }
    }

    public static string FormatInitializationDiagnostic(string? metadataDir, DateTime initializedAtUtc, string source)
    {
        return $"[LiveDoc] LD-COV-011 coverage-logger-initialized: version={Version.Value}; source={source}; pid={Environment.ProcessId}; initializedAt={initializedAtUtc:O}; metadataDir={ValueOrMissing(metadataDir)}; envMetadataDir={ValueOrMissing(Environment.GetEnvironmentVariable(RunMetadataDirEnvironmentVariable))}; metadataSearchRoot={DefaultMetadataRoot()}; assembly={typeof(LiveDocPostRunCoverage).Assembly.Location}";
    }

    public static bool VerboseDiagnosticsEnabled()
    {
        var value = Environment.GetEnvironmentVariable(DiagnosticsEnvVar);
        return string.Equals(value, "1", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(value, "true", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(value, "yes", StringComparison.OrdinalIgnoreCase);
    }

    private static List<string> BuildInvocationDiagnostics(
        IEnumerable<AttachmentSet>? attachmentSets,
        string? metadataDir,
        DateTime? metadataNotBeforeUtc)
    {
        var attachmentSetList = attachmentSets?.ToList() ?? [];
        var attachments = attachmentSetList
            .SelectMany(set => set.Attachments ?? Array.Empty<UriDataAttachment>())
            .Select(attachment => AttachmentPath(attachment.Uri))
            .ToList();
        var coverageAttachments = attachments
            .Where(path => path.EndsWith(".coverage", StringComparison.OrdinalIgnoreCase) ||
                           path.EndsWith(".cobertura.xml", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var metadataExists = !string.IsNullOrWhiteSpace(metadataDir) && Directory.Exists(metadataDir);
        var metadataFiles = EnumerateMetadataFiles(metadataDir, includeFallbackRoot: false);
        var searchableMetadataFiles = EnumerateMetadataFiles(metadataDir, includeFallbackRoot: true);
        var currentMetadataFiles = metadataNotBeforeUtc.HasValue
            ? searchableMetadataFiles.Where(file => File.GetLastWriteTimeUtc(file) >= metadataNotBeforeUtc.Value.AddSeconds(-5)).ToList()
            : searchableMetadataFiles;

        var messages = new List<string>
        {
            $"[LiveDoc] LD-COV-012 post-run-pipeline-active: version={Version.Value}; pid={Environment.ProcessId}; metadataDir={ValueOrMissing(metadataDir)}; envMetadataDir={ValueOrMissing(Environment.GetEnvironmentVariable(RunMetadataDirEnvironmentVariable))}; metadataDirExists={metadataExists}; metadataFiles={metadataFiles.Count}; metadataSearchRoot={DefaultMetadataRoot()}; metadataSearchFiles={searchableMetadataFiles.Count}; currentMetadataFiles={currentMetadataFiles.Count}; attachmentSets={attachmentSetList.Count}; attachments={attachments.Count}; coverageAttachments={coverageAttachments.Count}; initializedAt={metadataNotBeforeUtc:O}; currentDirectory={Environment.CurrentDirectory}; assembly={typeof(LiveDocPostRunCoverage).Assembly.Location}"
        };

        foreach (var path in coverageAttachments.Take(5))
            messages.Add($"[LiveDoc] LD-COV-050 coverage-attachment-observed: path={path}; exists={File.Exists(path)}");

        foreach (var file in currentMetadataFiles.Take(5))
            messages.Add($"[LiveDoc] LD-COV-052 metadata-observed: path={file}; lastWriteUtc={File.GetLastWriteTimeUtc(file):O}");

        return messages;
    }

    private static void BridgeParameter(Dictionary<string, string?> parameters, string paramName, string envVarName)
    {
        if (parameters.TryGetValue(paramName, out var value) && !string.IsNullOrEmpty(value))
            Environment.SetEnvironmentVariable(envVarName, value);
    }

    private static MetadataLoadResult LoadRunMetadata(
        string? metadataDir,
        DateTime? notBeforeUtc,
        bool includeFallbackMetadataRoot)
    {
        var runs = new List<RunMetadataTarget>();
        var staleFiles = new List<string>();
        var invalidFiles = new List<string>();
        foreach (var file in EnumerateMetadataFiles(metadataDir, includeFallbackMetadataRoot))
        {
            try
            {
                if (notBeforeUtc.HasValue && File.GetLastWriteTimeUtc(file) < notBeforeUtc.Value.AddSeconds(-5))
                {
                    staleFiles.Add(file);
                    continue;
                }

                var metadata = JsonSerializer.Deserialize<RunMetadata>(File.ReadAllText(file), JsonOptions);
                if (!string.IsNullOrWhiteSpace(metadata?.RunId) &&
                    !string.IsNullOrWhiteSpace(metadata.ServerUrl))
                {
                    runs.Add(new RunMetadataTarget(metadata, Path.GetDirectoryName(file) ?? metadataDir ?? string.Empty));
                }
                else
                {
                    invalidFiles.Add(file);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
            {
                invalidFiles.Add(file);
            }
        }

        return new MetadataLoadResult(runs, staleFiles, invalidFiles);
    }

    private static List<string> EnumerateMetadataFiles(string? metadataDir, bool includeFallbackRoot)
    {
        var files = new List<string>();
        AddMetadataFiles(metadataDir, SearchOption.TopDirectoryOnly, files);

        if (includeFallbackRoot)
        {
            var fallbackRoot = DefaultMetadataRoot();
            if (!string.Equals(
                    NormalizeDirectory(metadataDir),
                    NormalizeDirectory(fallbackRoot),
                    StringComparison.OrdinalIgnoreCase))
            {
                AddMetadataFiles(fallbackRoot, SearchOption.AllDirectories, files);
            }
        }

        return files.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static void AddMetadataFiles(string? metadataDir, SearchOption searchOption, List<string> files)
    {
        if (string.IsNullOrWhiteSpace(metadataDir) || !Directory.Exists(metadataDir))
            return;

        try
        {
            files.AddRange(Directory.EnumerateFiles(metadataDir, "*.json", searchOption));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or DirectoryNotFoundException)
        {
            // One inaccessible metadata folder should not prevent post-run diagnostics for the rest.
        }
    }

    private static string DefaultMetadataRoot()
    {
        return Path.Combine(Path.GetTempPath(), "livedoc-xunit", "run-metadata");
    }

    private static string? NormalizeDirectory(string? path)
    {
        return string.IsNullOrWhiteSpace(path) ? null : Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }

    private static PostCoverageResult PostCoverage(
        string endpoint,
        byte[] payload,
        CoverageUploader? uploader)
    {
        try
        {
            if (uploader != null)
            {
                var result = uploader(endpoint, payload);
                return new PostCoverageResult(
                    result.Success,
                    endpoint,
                    result.Status,
                    result.BodySummary,
                    ParseServerEvidence(result.BodySummary));
            }

            using var client = new HttpClient { Timeout = UploadTimeout };
            using var content = new ByteArrayContent(payload);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            using var response = client.PostAsync(endpoint, content).GetAwaiter().GetResult();
            var body = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            return new PostCoverageResult(
                response.IsSuccessStatusCode,
                endpoint,
                $"{(int)response.StatusCode} {response.ReasonPhrase}",
                SummarizeBody(body),
                ParseServerEvidence(body));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException or UriFormatException)
        {
            return new PostCoverageResult(
                false,
                endpoint,
                "<no-response>",
                $"{ex.GetType().Name}: {ex.Message}",
                null);
        }
    }

    private static ServerEvidence? ParseServerEvidence(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;

        try
        {
            var response = JsonSerializer.Deserialize<CoverageServerResponse>(body, JsonOptions);
            return response == null
                ? null
                : new ServerEvidence(
                    response.Persistence?.Completed,
                    response.Broadcast?.Matched,
                    response.Broadcast?.Sent,
                    response.Broadcast?.Failed,
                    response.RestHydration?.Available);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string GetAcceptedSentinelPath(string metadataDir, string runId)
    {
        var safeRunId = Regex.Replace(runId, @"[^A-Za-z0-9._-]", "_");
        if (string.IsNullOrWhiteSpace(safeRunId))
            safeRunId = "run";
        return Path.Combine(metadataDir, $"{safeRunId}.coverage-accepted");
    }

    private static string ComputeCoverageDatasetId(IEnumerable<CoverageAttachment> attachments)
    {
        var identity = string.Join(
            "\n",
            attachments
                .OrderBy(attachment => attachment.Path, StringComparer.OrdinalIgnoreCase)
                .Select(attachment =>
                {
                    var file = new FileInfo(attachment.Path);
                    return $"{attachment.Format}|{file.FullName}|{file.Length}|{file.LastWriteTimeUtc.Ticks}";
                }));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity))).ToLowerInvariant();
    }

    private static bool IsAcceptedDataset(string sentinelPath, string datasetId)
    {
        if (!File.Exists(sentinelPath))
            return false;

        try
        {
            var sentinel = JsonSerializer.Deserialize<CoverageAcceptedSentinel>(
                File.ReadAllText(sentinelPath),
                JsonOptions);
            return string.Equals(sentinel?.DatasetId, datasetId, StringComparison.Ordinal);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return false;
        }
    }

    private static void WriteAcceptedSentinel(
        string sentinelPath,
        string runId,
        string status,
        string datasetId)
    {
        var directory = Path.GetDirectoryName(sentinelPath)
                        ?? throw new InvalidOperationException("Coverage sentinel directory is unavailable.");
        Directory.CreateDirectory(directory);
        var temporaryPath = Path.Combine(directory, $".{Path.GetFileName(sentinelPath)}.{Guid.NewGuid():N}.tmp");
        try
        {
            File.WriteAllText(
                temporaryPath,
                JsonSerializer.Serialize(new
                {
                    runId,
                    acceptedAtUtc = DateTime.UtcNow,
                    status,
                    datasetId
                }, JsonOptions));
            File.Move(temporaryPath, sentinelPath, overwrite: true);
        }
        finally
        {
            DeleteTemporaryFile(temporaryPath);
        }
    }

    private sealed class CoverageAcceptedSentinel
    {
        public string? DatasetId { get; set; }
    }

    private static string SummarizeBody(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return "<empty>";

        var summary = Regex.Replace(body, @"\s+", " ").Trim();
        return summary.Length <= 240 ? summary : $"{summary[..237]}...";
    }

    private static IEnumerable<CoverageAttachment> FindCoverageAttachments(IEnumerable<AttachmentSet>? attachmentSets)
    {
        if (attachmentSets == null)
            yield break;

        foreach (var attachmentSet in attachmentSets)
        {
            foreach (var attachment in attachmentSet.Attachments ?? Array.Empty<UriDataAttachment>())
            {
                var path = AttachmentPath(attachment.Uri);
                if (path.EndsWith(".coverage", StringComparison.OrdinalIgnoreCase))
                    yield return new CoverageAttachment(path, CoverageAttachmentFormat.VisualStudioCoverage);
                else if (path.EndsWith(".cobertura.xml", StringComparison.OrdinalIgnoreCase))
                    yield return new CoverageAttachment(path, CoverageAttachmentFormat.Cobertura);
            }
        }
    }

    private static string AttachmentPath(Uri uri)
    {
        return uri.IsFile ? uri.LocalPath : uri.ToString();
    }

    private sealed record ConversionResult(string? CoberturaPath, string Code, string Message);

    private sealed record CoverageAttachment(string Path, CoverageAttachmentFormat Format);

    private sealed record MetadataLoadResult(
        IReadOnlyList<RunMetadataTarget> Matched,
        IReadOnlyList<string> StaleFiles,
        IReadOnlyList<string> InvalidFiles);

    private sealed record RunMetadataTarget(RunMetadata Metadata, string MetadataDir);

    private sealed record PostCoverageResult(
        bool Success,
        string Endpoint,
        string Status,
        string BodySummary,
        ServerEvidence? Evidence);

    private sealed record ServerEvidence(
        bool? PersistenceCompleted,
        int? BroadcastMatched,
        int? BroadcastSent,
        int? BroadcastFailed,
        bool? RestHydrationAvailable);

    private sealed class CoverageServerResponse
    {
        public CoveragePersistenceEvidence? Persistence { get; set; }
        public CoverageBroadcastEvidence? Broadcast { get; set; }
        public CoverageHydrationEvidence? RestHydration { get; set; }
    }

    private sealed class CoveragePersistenceEvidence
    {
        public bool Completed { get; set; }
    }

    private sealed class CoverageBroadcastEvidence
    {
        public int Matched { get; set; }
        public int Sent { get; set; }
        public int Failed { get; set; }
    }

    private sealed class CoverageHydrationEvidence
    {
        public bool Available { get; set; }
    }

    private enum CoverageAttachmentFormat
    {
        Cobertura,
        VisualStudioCoverage
    }

    private static ConversionResult ConvertVisualStudioCoverage(IReadOnlyList<string> coveragePaths, string rootDir)
    {
        var outputPath = Path.Combine(rootDir, $"livedoc-{Guid.NewGuid():N}.cobertura.xml");
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
            foreach (var coveragePath in coveragePaths)
                process.StartInfo.ArgumentList.Add(coveragePath);
            process.StartInfo.ArgumentList.Add("-f");
            process.StartInfo.ArgumentList.Add("cobertura");
            process.StartInfo.ArgumentList.Add("-o");
            process.StartInfo.ArgumentList.Add(outputPath);
            process.StartInfo.ArgumentList.Add("--nologo");

            if (!process.Start())
                return new ConversionResult(null, "dotnet-coverage-conversion-failed", "dotnet-coverage did not start.");

            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            if (!process.WaitForExit((int)DotnetCoverageTimeout.TotalMilliseconds))
            {
                process.Kill(entireProcessTree: true);
                return new ConversionResult(null, "dotnet-coverage-conversion-failed", "dotnet-coverage timed out while converting the .coverage file.");
            }

            var stdout = stdoutTask.GetAwaiter().GetResult();
            var stderr = stderrTask.GetAwaiter().GetResult();
            if (process.ExitCode != 0 || !File.Exists(outputPath))
            {
                DeleteTemporaryFile(outputPath);
                var details = FirstNonEmptyLine(stderr) ?? FirstNonEmptyLine(stdout) ?? $"dotnet-coverage exited with code {process.ExitCode}.";
                return new ConversionResult(null, "dotnet-coverage-conversion-failed", details);
            }

            return new ConversionResult(outputPath, string.Empty, string.Empty);
        }
        catch (System.ComponentModel.Win32Exception)
        {
            DeleteTemporaryFile(outputPath);
            return new ConversionResult(
                null,
                "dotnet-coverage-missing",
                "LiveDoc found a Visual Studio .coverage file, but dotnet-coverage is not installed or is not on PATH. Install it with: dotnet tool install --global dotnet-coverage");
        }
        catch (Exception ex)
        {
            DeleteTemporaryFile(outputPath);
            return new ConversionResult(null, "dotnet-coverage-conversion-failed", ex.Message);
        }
    }

    private static string ResolveDotnetCoverageTool(string rootDir)
    {
        var configured = Environment.GetEnvironmentVariable(DotnetCoverageToolEnvVar);
        if (string.IsNullOrWhiteSpace(configured))
            return "dotnet-coverage";

        return configured.Contains(Path.DirectorySeparatorChar) ||
               configured.Contains(Path.AltDirectorySeparatorChar) ||
               Path.IsPathRooted(configured)
            ? ResolvePath(rootDir, configured)
            : configured;
    }

    private static string? FirstNonEmptyLine(string text)
    {
        return text
            .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .FirstOrDefault(line => !string.IsNullOrWhiteSpace(line));
    }

    private static CoverageReport ParseCobertura(string filePath, string rootDir)
    {
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

    private static CoverageReport ParseCoberturaFiles(IReadOnlyList<string> filePaths, string rootDir)
    {
        var reports = filePaths.Select(path => ParseCobertura(path, rootDir)).ToList();
        if (reports.Count == 1)
            return reports[0];

        var files = reports
            .SelectMany(report => report.Files ?? [])
            .GroupBy(
                file => $"{file.Module ?? string.Empty}\u001f{file.Path}",
                StringComparer.OrdinalIgnoreCase)
            .Select(group => new CoverageFile
            {
                Path = group.First().Path,
                Module = group.First().Module,
                Summary = MergeOverlappingSummaries(group.Select(file => file.Summary))
            })
            .OrderBy(file => file.Module, StringComparer.OrdinalIgnoreCase)
            .ThenBy(file => file.Path, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new CoverageReport
        {
            Status = "available",
            Summary = Aggregate(files.Select(file => file.Summary)),
            Files = files
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

    private static CoverageSummary MergeOverlappingSummaries(IEnumerable<CoverageSummary> summaries)
    {
        var list = summaries.ToList();
        return new CoverageSummary
        {
            Lines = MergeOverlappingMetric(list.Select(summary => summary.Lines)),
            Branches = MergeOverlappingMetric(list.Select(summary => summary.Branches)),
            Functions = MergeOverlappingMetric(list.Select(summary => summary.Functions)),
            Statements = MergeOverlappingMetric(list.Select(summary => summary.Statements))
        };
    }

    private static CoverageMetric? MergeOverlappingMetric(IEnumerable<CoverageMetric?> metrics)
    {
        var available = metrics.Where(metric => metric != null).Select(metric => metric!).ToList();
        if (available.Count == 0)
            return null;

        var covered = available.Max(metric => metric.Covered);
        var total = available.Max(metric => metric.Total);
        var skipped = available.Max(metric => metric.Skipped ?? 0);
        return MakeMetric(covered, total, skipped);
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

    private static string DescribeArtifacts(IReadOnlyList<string> paths, string pluralLabel)
    {
        return paths.Count == 1 ? paths[0] : $"{paths.Count} {pluralLabel}";
    }

    private static string ValueOrMissing(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? "<not set>" : value;
    }

    private static string ResolveDiagnosticVersion()
    {
        var assembly = typeof(LiveDocPostRunCoverage).Assembly;
        var informational = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrWhiteSpace(informational))
            return informational;

        return assembly.GetName().Version?.ToString() ?? "unknown";
    }

    private static void DeleteTemporaryFile(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return;

        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch (IOException)
        {
            // Best-effort cleanup only.
        }
        catch (UnauthorizedAccessException)
        {
            // Best-effort cleanup only.
        }
    }

    private sealed class RunMetadata
    {
        public string? RunId { get; set; }
        public string? ServerUrl { get; set; }
    }

    private sealed class CoverageMetric
    {
        public double Covered { get; set; }
        public double Total { get; set; }
        public double? Skipped { get; set; }
        public double? Pct { get; set; }
    }

    private sealed class CoverageSummary
    {
        public CoverageMetric? Lines { get; set; }
        public CoverageMetric? Branches { get; set; }
        public CoverageMetric? Functions { get; set; }
        public CoverageMetric? Statements { get; set; }
    }

    private sealed class CoverageFile
    {
        public string Path { get; set; } = string.Empty;
        public string? Module { get; set; }
        public CoverageSummary Summary { get; set; } = new();
    }

    private sealed class CoverageDiagnostic
    {
        public string Severity { get; set; } = "warning";
        public string Code { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    private sealed class CoverageThreshold
    {
        public string Metric { get; set; } = string.Empty;
        public double Minimum { get; set; }
        public double? Actual { get; set; }
        public string Status { get; set; } = "passed";
    }

    private sealed class CoverageProvenance
    {
        public string? Tool { get; set; }
        public string Format { get; set; } = string.Empty;
        public string? Path { get; set; }
        public string Detected { get; set; } = "auto";
        public string? GeneratedAt { get; set; }
    }

    private sealed class CoverageReport
    {
        public string Status { get; set; } = "available";
        public CoverageSummary? Summary { get; set; }
        public List<CoverageFile>? Files { get; set; }
        public List<CoverageDiagnostic>? Diagnostics { get; set; }
        public CoverageProvenance? Provenance { get; set; }
        public List<CoverageThreshold>? Thresholds { get; set; }
    }
}
