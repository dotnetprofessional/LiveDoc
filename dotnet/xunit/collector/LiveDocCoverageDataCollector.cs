using System.Reflection;
using System.Text.Json;
using System.Xml;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.DataCollection;
using SweDevTools.LiveDoc.xUnit.Logger;

namespace SweDevTools.LiveDoc.xUnit.VSTestCoverage;

[DataCollectorFriendlyName(FriendlyName)]
[DataCollectorTypeUri(TypeUri)]
[DataCollectorAttachmentProcessor(typeof(LiveDocCoverageAttachmentProcessor))]
public sealed class LiveDocCoverageDataCollector : DataCollector, ITestExecutionEnvironmentSpecifier
{
    public const string FriendlyName = "LiveDocCoverage";
    public const string TypeUri = "datacollector://swedevtools/livedoc/coverage";
    public const string MarkerFileSuffix = ".livedoc-coverage-invocation";
    public static readonly Uri CollectorUri = new(TypeUri);

    private DataCollectionEnvironmentContext? _environmentContext;
    private DataCollectionLogger? _logger;
    private readonly object _invocationLock = new();
    private string _metadataDir = string.Empty;
    private string _markerPath = string.Empty;
    private DateTime _initializedAtUtc;

    public override void Initialize(
        XmlElement? configurationElement,
        DataCollectionEvents events,
        DataCollectionSink dataSink,
        DataCollectionLogger logger,
        DataCollectionEnvironmentContext? environmentContext)
    {
        GetOrCreateInvocationMetadataDirectory(configurationElement);
        _environmentContext = environmentContext;
        _logger = logger;

        events.SessionEnd += (_, args) => WriteInvocationMarker(dataSink, args.Context);

        EmitWarning(
            "LD-COV-010 collector-discovered",
            $"friendlyName={FriendlyName}; uri={TypeUri}; version={Version}; pid={Environment.ProcessId}; " +
            $"tfm={AppContext.TargetFrameworkName}; assembly={typeof(LiveDocCoverageDataCollector).Assembly.Location}; " +
            $"metadataDir={_metadataDir}");
    }

    public IEnumerable<KeyValuePair<string, string>> GetTestExecutionEnvironmentVariables()
    {
        var metadataDir = GetOrCreateInvocationMetadataDirectory(configurationElement: null);

        EmitWarning(
            "LD-COV-020 metadata-directory-injected",
            $"variable={LiveDocPostRunCoverage.RunMetadataDirEnvironmentVariable}; value={metadataDir}; " +
            $"pid={Environment.ProcessId}; assembly={typeof(LiveDocCoverageDataCollector).Assembly.Location}");

        return
        [
            new KeyValuePair<string, string>(
                LiveDocPostRunCoverage.RunMetadataDirEnvironmentVariable,
                metadataDir)
        ];
    }

    internal string GetOrCreateInvocationMetadataDirectory(XmlElement? configurationElement)
    {
        lock (_invocationLock)
        {
            if (!string.IsNullOrWhiteSpace(_metadataDir))
                return _metadataDir;

            _initializedAtUtc = DateTime.UtcNow;
            _metadataDir = LiveDocPostRunCoverage.CreateInvocationMetadataDirectory(configurationElement);
            _markerPath = Path.Combine(_metadataDir, $"{Guid.NewGuid():N}{MarkerFileSuffix}");
            return _metadataDir;
        }
    }

    internal string InvocationMarkerPath
    {
        get
        {
            GetOrCreateInvocationMetadataDirectory(configurationElement: null);
            return _markerPath;
        }
    }

    private void WriteInvocationMarker(
        DataCollectionSink dataSink,
        DataCollectionContext context)
    {
        try
        {
            var marker = new LiveDocCoverageInvocationMarker
            {
                ProtocolVersion = "1.0",
                MetadataDir = _metadataDir,
                InitializedAtUtc = _initializedAtUtc,
                CollectorAssembly = typeof(LiveDocCoverageDataCollector).Assembly.Location
            };
            File.WriteAllText(_markerPath, JsonSerializer.Serialize(marker));
            dataSink.SendFileAsync(
                context,
                _markerPath,
                deleteFile: false);

            EmitWarning(
                "LD-COV-025 invocation-marker-written",
                $"path={_markerPath}; metadataDir={_metadataDir}; initializedAt={_initializedAtUtc:O}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            EmitError(
                "LD-COV-026 invocation-marker-failed",
                $"path={_markerPath}; exception={ex.GetType().Name}; message={ex.Message}");
            throw;
        }
    }

    private void EmitWarning(string code, string context)
    {
        var message = $"[LiveDoc] {code}: {context}";
        Console.Error.WriteLine(message);
        if (_logger != null && _environmentContext != null)
            _logger.LogWarning(_environmentContext.SessionDataCollectionContext, message);
    }

    private void EmitError(string code, string context)
    {
        var message = $"[LiveDoc] {code}: {context}";
        Console.Error.WriteLine(message);
        if (_logger != null && _environmentContext != null)
            _logger.LogError(_environmentContext.SessionDataCollectionContext, message);
    }

    private static string Version
    {
        get
        {
            var assembly = typeof(LiveDocCoverageDataCollector).Assembly;
            return assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                   ?? assembly.GetName().Version?.ToString()
                   ?? "unknown";
        }
    }
}

public sealed class LiveDocCoverageInvocationMarker
{
    public string ProtocolVersion { get; set; } = "1.0";
    public string MetadataDir { get; set; } = string.Empty;
    public DateTime InitializedAtUtc { get; set; }
    public string CollectorAssembly { get; set; } = string.Empty;
}
