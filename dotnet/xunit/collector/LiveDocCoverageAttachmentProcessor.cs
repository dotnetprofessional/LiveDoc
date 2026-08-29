using System.Collections.ObjectModel;
using System.Text.Json;
using System.Xml;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.DataCollection;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using SweDevTools.LiveDoc.xUnit.Logger;

namespace SweDevTools.LiveDoc.xUnit.VSTestCoverage;

public sealed class LiveDocCoverageAttachmentProcessor : IDataCollectorAttachmentProcessor
{
    public const string MicrosoftCodeCoverageTypeUri = "datacollector://microsoft/CodeCoverage/2.0";
    public const string CoverletCodeCoverageTypeUri = "datacollector://Microsoft/CoverletCodeCoverage/1.0";
    public static readonly Uri MicrosoftCodeCoverageUri = new(MicrosoftCodeCoverageTypeUri);
    public static readonly Uri CoverletCodeCoverageUri = new(CoverletCodeCoverageTypeUri);

    private static readonly TimeSpan DiskMarkerWindowSkew = TimeSpan.FromSeconds(10);
    private readonly DateTime _processingWindowStartedUtc;
    private readonly LiveDocPostRunCoverage.CoverageUploader? _uploader;

    public LiveDocCoverageAttachmentProcessor()
        : this(uploader: null)
    {
    }

    public LiveDocCoverageAttachmentProcessor(LiveDocPostRunCoverage.CoverageUploader? uploader)
    {
        _uploader = uploader;
        _processingWindowStartedUtc = DateTime.UtcNow;
    }

    public bool SupportsIncrementalProcessing => true;

    public IEnumerable<Uri> GetExtensionUris()
    {
        yield return MicrosoftCodeCoverageUri;
        yield return CoverletCodeCoverageUri;
        yield return LiveDocCoverageDataCollector.CollectorUri;
    }

    public Task<ICollection<AttachmentSet>> ProcessAttachmentSetsAsync(
        XmlElement configurationElement,
        ICollection<AttachmentSet> attachments,
        IProgress<int> progressReporter,
        IMessageLogger logger,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            var metadataRoot = LiveDocPostRunCoverage.ResolveMetadataRoot(configurationElement);
            var markers = ReadInvocationMarkers(attachments, metadataRoot, logger);
            var coverageAttachments = attachments
                .Where(IsCoverageAttachmentSet)
                .ToList();
            var attachmentCount = coverageAttachments.Sum(set => set.Attachments.Count);

            Emit(
                logger,
                TestMessageLevel.Informational,
                $"[LiveDoc] LD-COV-040 attachment-processor-invoked: " +
                $"processor={GetType().AssemblyQualifiedName}; assembly={GetType().Assembly.Location}; " +
                $"sets={coverageAttachments.Count}; attachments={attachmentCount}; markers={markers.Count}; " +
                $"metadataRoot={metadataRoot}; incremental={SupportsIncrementalProcessing}",
                metadataRoot);

            foreach (var set in coverageAttachments)
            {
                Emit(
                    logger,
                    TestMessageLevel.Informational,
                    $"[LiveDoc] LD-COV-050 attachment-set-received: uri={set.Uri}; count={set.Attachments.Count}",
                    metadataRoot);

                foreach (var attachment in set.Attachments)
                {
                    var path = AttachmentPath(attachment);
                    Emit(
                        logger,
                        TestMessageLevel.Informational,
                        $"[LiveDoc] LD-COV-050 coverage-attachment-received: uri={set.Uri}; " +
                        $"path={path}; exists={File.Exists(path)}",
                        metadataRoot);
                }
            }

            if (coverageAttachments.Count == 0)
            {
                Emit(
                    logger,
                    TestMessageLevel.Informational,
                    "[LiveDoc] LD-COV-051 coverage-not-requested: " +
                    "No Microsoft or Coverlet coverage attachment was produced; ordinary test execution is unaffected.",
                    metadataRoot);
            }
            else if (markers.Count == 0)
            {
                Emit(
                    logger,
                    TestMessageLevel.Warning,
                    "[LiveDoc] LD-COV-044 upload-not-performed: " +
                    "No current LiveDoc invocation marker was available, so coverage was not correlated with prior runs.",
                    metadataRoot);
            }
            else
            {
                var scopes = markers
                    .Select(marker => new LiveDocPostRunCoverage.CoverageMetadataScope(
                        marker.Marker.MetadataDir,
                        marker.Marker.InitializedAtUtc,
                        IncludeFallbackMetadataRoot: IsLiveDocInvocationDirectory(marker.Marker.MetadataDir)))
                    .ToList();
                var messages = LiveDocPostRunCoverage.Publish(
                    coverageAttachments,
                    scopes,
                    reportMissingMetadata: true,
                    _uploader);

                foreach (var message in messages)
                {
                    var markerDir = markers.FirstOrDefault(marker =>
                        message.Contains(marker.Marker.MetadataDir, StringComparison.OrdinalIgnoreCase))
                        ?.Marker.MetadataDir;
                    Emit(logger, LevelFor(message), message, markerDir ?? metadataRoot);
                }
            }

            progressReporter.Report(100);
            return Task.FromResult<ICollection<AttachmentSet>>(
                new Collection<AttachmentSet>(attachments.ToList()));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex) when (
            ex is IOException or
            UnauthorizedAccessException or
            JsonException or
            InvalidOperationException or
            NotSupportedException)
        {
            Emit(
                logger,
                TestMessageLevel.Error,
                $"[LiveDoc] LD-COV-099 attachment-processor-failed: " +
                $"exception={ex.GetType().Name}; message={ex.Message}; assembly={GetType().Assembly.Location}",
                metadataDir: null);
            throw;
        }
    }

    private static bool IsLiveDocInvocationDirectory(string metadataDir)
    {
        var defaultRoot = Path.GetFullPath(
            Path.Combine(Path.GetTempPath(), "livedoc-xunit", "run-metadata"));
        var candidate = Path.GetFullPath(metadataDir);
        return candidate.StartsWith(
            defaultRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar,
            StringComparison.OrdinalIgnoreCase);
    }

    private List<MarkerFile> ReadInvocationMarkers(
        IEnumerable<AttachmentSet> attachments,
        string metadataRoot,
        IMessageLogger logger)
    {
        var authoritativePaths = attachments
            .Where(set => set.Uri.Equals(LiveDocCoverageDataCollector.CollectorUri))
            .SelectMany(set => set.Attachments)
            .Select(AttachmentPath)
            .Where(IsMarkerPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var paths = new List<(string Path, bool Authoritative)>();
        paths.AddRange(authoritativePaths.Select(path => (path, true)));

        if (authoritativePaths.Count == 0 && Directory.Exists(metadataRoot))
        {
            try
            {
                paths.AddRange(
                    Directory
                        .EnumerateFiles(
                            metadataRoot,
                            $"*{LiveDocCoverageDataCollector.MarkerFileSuffix}",
                            SearchOption.AllDirectories)
                        .Where(path =>
                            File.GetLastWriteTimeUtc(path) >=
                            _processingWindowStartedUtc.Subtract(DiskMarkerWindowSkew))
                        .Select(path => (path, false)));
            }
            catch (Exception ex) when (
                ex is IOException or
                UnauthorizedAccessException or
                DirectoryNotFoundException)
            {
                Emit(
                    logger,
                    TestMessageLevel.Warning,
                    $"[LiveDoc] LD-COV-042 invocation-marker-scan-failed: root={metadataRoot}; " +
                    $"exception={ex.GetType().Name}; message={ex.Message}",
                    metadataRoot);
            }
        }

        var markers = new List<MarkerFile>();
        foreach (var candidate in paths
                     .GroupBy(item => Path.GetFullPath(item.Path), StringComparer.OrdinalIgnoreCase)
                     .Select(group => group.OrderByDescending(item => item.Authoritative).First()))
        {
            var marker = ReadMarker(candidate.Path, candidate.Authoritative, metadataRoot, logger);
            if (marker != null)
                markers.Add(marker);
        }

        return markers
            .GroupBy(
                marker => $"{Path.GetFullPath(marker.Marker.MetadataDir)}|{marker.Marker.InitializedAtUtc:O}",
                StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(marker => marker.Authoritative).First())
            .ToList();
    }

    private MarkerFile? ReadMarker(
        string markerPath,
        bool authoritative,
        string metadataRoot,
        IMessageLogger logger)
    {
        if (!File.Exists(markerPath))
        {
            Emit(
                logger,
                TestMessageLevel.Warning,
                $"[LiveDoc] LD-COV-041 invocation-marker-missing: path={markerPath}",
                metadataRoot);
            return null;
        }

        try
        {
            var marker = JsonSerializer.Deserialize<LiveDocCoverageInvocationMarker>(
                File.ReadAllText(markerPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (marker == null ||
                string.IsNullOrWhiteSpace(marker.MetadataDir) ||
                marker.InitializedAtUtc == default)
            {
                Emit(
                    logger,
                    TestMessageLevel.Error,
                    $"[LiveDoc] LD-COV-042 invocation-marker-invalid: path={markerPath}; reason=missing-required-value",
                    metadataRoot);
                return null;
            }

            Emit(
                logger,
                TestMessageLevel.Informational,
                $"[LiveDoc] LD-COV-041 invocation-marker-matched: path={markerPath}; " +
                $"metadataDir={marker.MetadataDir}; initializedAt={marker.InitializedAtUtc:O}; " +
                $"source={(authoritative ? "attachment" : "disk-current-window")}",
                marker.MetadataDir);
            return new MarkerFile(markerPath, marker, authoritative);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Emit(
                logger,
                TestMessageLevel.Error,
                $"[LiveDoc] LD-COV-042 invocation-marker-invalid: path={markerPath}; " +
                $"exception={ex.GetType().Name}; message={ex.Message}",
                metadataRoot);
            return null;
        }
    }

    private static bool IsCoverageAttachmentSet(AttachmentSet set)
    {
        return set.Uri.Equals(MicrosoftCodeCoverageUri) ||
               set.Uri.Equals(CoverletCodeCoverageUri);
    }

    private static bool IsMarkerPath(string path)
    {
        return path.EndsWith(
            LiveDocCoverageDataCollector.MarkerFileSuffix,
            StringComparison.OrdinalIgnoreCase);
    }

    private static string AttachmentPath(UriDataAttachment attachment)
    {
        return attachment.Uri.IsFile ? attachment.Uri.LocalPath : attachment.Uri.ToString();
    }

    private static void Emit(
        IMessageLogger logger,
        TestMessageLevel level,
        string message,
        string? metadataDir)
    {
        logger.SendMessage(level, message);
        Console.Error.WriteLine(message);

        if (string.IsNullOrWhiteSpace(metadataDir))
            return;

        try
        {
            Directory.CreateDirectory(metadataDir);
            File.AppendAllText(
                Path.Combine(metadataDir, "livedoc-coverage-processor.log"),
                $"{DateTime.UtcNow:O} [{level}] {message}{Environment.NewLine}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            Console.Error.WriteLine(
                $"[LiveDoc] LD-COV-098 diagnostics-log-write-failed: metadataDir={metadataDir}; " +
                $"exception={ex.GetType().Name}; message={ex.Message}");
        }
    }

    private static TestMessageLevel LevelFor(string message)
    {
        if (message.Contains("LD-COV-071", StringComparison.Ordinal) ||
            message.Contains("LD-COV-062", StringComparison.Ordinal) ||
            message.Contains("LD-COV-063", StringComparison.Ordinal) ||
            message.Contains("LD-COV-065", StringComparison.Ordinal))
        {
            return TestMessageLevel.Error;
        }

        if (message.Contains("LD-COV-053", StringComparison.Ordinal) ||
            message.Contains("LD-COV-054", StringComparison.Ordinal) ||
            message.Contains("LD-COV-055", StringComparison.Ordinal))
        {
            return TestMessageLevel.Warning;
        }

        return TestMessageLevel.Informational;
    }

    private sealed record MarkerFile(
        string Path,
        LiveDocCoverageInvocationMarker Marker,
        bool Authoritative);
}
