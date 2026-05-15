using System.Reflection;

namespace SweDevTools.LiveDoc.xUnit.Reporter;

/// <summary>
/// Configuration for LiveDoc reporter.
/// Reads from environment variables, with auto-discovery fallback.
/// </summary>
/// <remarks>
/// Resolution order for server URL:
/// 1. LIVEDOC_SERVER_URL environment variable (explicit)
/// 2. Auto-discover on default port (http://localhost:3100)
/// 3. Disabled (no server found)
/// </remarks>
public class LiveDocConfig
{
    /// <summary>
    /// Environment variable name for the LiveDoc server URL.
    /// If set, the reporter will send test results to this server.
    /// </summary>
    public const string ServerUrlEnvVar = "LIVEDOC_SERVER_URL";

    /// <summary>
    /// Environment variable name for the project name.
    /// </summary>
    public const string ProjectEnvVar = "LIVEDOC_PROJECT";

    /// <summary>
    /// Environment variable name for the environment (e.g., "local", "ci").
    /// </summary>
    public const string EnvironmentEnvVar = "LIVEDOC_ENVIRONMENT";

    /// <summary>
    /// Environment variable name for the JSON export file path.
    /// When set, the reporter writes a TestRunV1 JSON file after the test run completes.
    /// </summary>
    public const string ExportPathEnvVar = "LIVEDOC_EXPORT_PATH";

    /// <summary>
    /// Assembly metadata key used to configure a stable LiveDoc project name.
    /// </summary>
    public const string ProjectMetadataKey = "LiveDocProject";

    /// <summary>
    /// Default server URL for auto-discovery.
    /// </summary>
    public const string DefaultServerUrl = "http://localhost:3100";

    private static readonly TimeSpan DiscoveryTimeout = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan DiscoveryRetryInterval = TimeSpan.FromSeconds(2);
    private static readonly string[] DiscoveryServerUrls =
    [
        "http://127.0.0.1:3100",
        DefaultServerUrl,
        "http://[::1]:3100"
    ];

    /// <summary>
    /// The LiveDoc server URL. Null if reporting is disabled.
    /// </summary>
    public string? ServerUrl => ResolveServerUrl();
    private string? _serverUrl;
    private readonly bool _readEnvironment;
    private readonly object _discoveryLock = new();
    private DateTimeOffset _nextDiscoveryAttemptUtc = DateTimeOffset.MinValue;

    /// <summary>
    /// The project name. Defaults to the assembly name.
    /// Resolved lazily to allow the test assembly to load first.
    /// </summary>
    public string Project
    {
        get
        {
            if (_readEnvironment)
            {
                var envProject = GetEnvironmentValue(ProjectEnvVar);
                if (envProject != null)
                    return envProject;
            }

            return _project ??= _defaultProject ?? ResolveProjectName();
        }
    }
    private string? _project;
    private string? _defaultProject;

    /// <summary>
    /// The environment name. Defaults to "local".
    /// </summary>
    public string Environment => _readEnvironment
        ? GetEnvironmentValue(EnvironmentEnvVar) ?? _environment
        : _environment;
    private readonly string _environment;

    /// <summary>
    /// The file path for JSON export. Null if export is disabled.
    /// </summary>
    public string? ExportPath => _readEnvironment
        ? GetEnvironmentValue(ExportPathEnvVar) ?? _exportPath
        : _exportPath;
    private readonly string? _exportPath;

    /// <summary>
    /// Whether reporting is enabled (ServerUrl is set).
    /// </summary>
    public bool IsEnabled => !string.IsNullOrEmpty(ServerUrl);

    /// <summary>
    /// Creates a new configuration from environment variables with auto-discovery fallback.
    /// </summary>
    /// <param name="defaultProject">Default project name if not set in environment.</param>
    public LiveDocConfig(string? defaultProject = null)
    {
        _readEnvironment = true;
        _defaultProject = defaultProject;
        _environment = "local";
    }

    /// <summary>
    /// Creates a configuration with explicit values (for testing).
    /// </summary>
    public LiveDocConfig(string serverUrl, string project, string environment, string? exportPath = null)
    {
        _readEnvironment = false;
        _serverUrl = serverUrl;
        _project = project;
        _environment = environment;
        _exportPath = exportPath;
    }

    /// <summary>
    /// Sets the fallback project name from the current test assembly.
    /// Environment variables still take precedence.
    /// </summary>
    internal void SetDefaultProject(AssemblyName assemblyName)
    {
        if (!_readEnvironment || GetEnvironmentValue(ProjectEnvVar) != null)
            return;

        var project = ResolveProjectNameFromMetadata(assemblyName) ?? assemblyName.Name;
        if (string.IsNullOrWhiteSpace(project) ||
            string.Equals(project, _defaultProject, StringComparison.Ordinal))
            return;

        _defaultProject = project;
        ReResolveProject();
    }

    internal string? ResolveServerUrl(bool forceDiscovery = false)
    {
        if (!_readEnvironment)
            return _serverUrl;

        var envUrl = GetEnvironmentValue(ServerUrlEnvVar);
        if (envUrl != null)
        {
            _serverUrl = envUrl;
            return _serverUrl;
        }

        if (!string.IsNullOrEmpty(_serverUrl))
            return _serverUrl;

        var now = DateTimeOffset.UtcNow;
        lock (_discoveryLock)
        {
            if (!forceDiscovery && now < _nextDiscoveryAttemptUtc)
                return null;

            _nextDiscoveryAttemptUtc = now.Add(DiscoveryRetryInterval);
            _serverUrl = TryDiscoverServer();
            return _serverUrl;
        }
    }

    /// <summary>
    /// Resolves the project name from the test assembly.
    /// Falls back through: entry assembly → test assemblies in AppDomain → "Unknown".
    /// </summary>
    private static string ResolveProjectName()
    {
        var metadataProject = ResolveProjectNameFromLoadedAssemblyMetadata();
        if (metadataProject != null)
            return metadataProject;

        // Entry assembly is often "testhost" when running via xUnit/dotnet test
        var entryName = System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name;
        if (!string.IsNullOrEmpty(entryName) && !entryName.Equals("testhost", StringComparison.OrdinalIgnoreCase))
            return entryName;

        // Find the actual test assembly — look for assemblies ending in .Tests or containing test attributes
        var testAssembly = AppDomain.CurrentDomain.GetAssemblies()
            .Where(a => !a.IsDynamic && !string.IsNullOrEmpty(a.GetName().Name))
            .Select(a => a.GetName().Name!)
            .FirstOrDefault(name =>
                name.EndsWith(".Tests", StringComparison.OrdinalIgnoreCase) ||
                name.EndsWith(".Test", StringComparison.OrdinalIgnoreCase) ||
                name.EndsWith(".Specs", StringComparison.OrdinalIgnoreCase));

        if (testAssembly != null)
            return testAssembly;

        return entryName ?? "Unknown";
    }

    /// <summary>
    /// Attempts to discover a LiveDoc server on the default port.
    /// Returns the URL if the server responds to a health check, null otherwise.
    /// </summary>
    private static string? TryDiscoverServer()
    {
        foreach (var serverUrl in DiscoveryServerUrls)
        {
            try
            {
                using var handler = new SocketsHttpHandler
                {
                    ConnectTimeout = DiscoveryTimeout
                };
                using var client = new HttpClient(handler)
                {
                    Timeout = DiscoveryTimeout
                };
                using var request = new HttpRequestMessage(HttpMethod.Get, $"{serverUrl}/api/health");
                using var response = client.Send(request);
                if (response.IsSuccessStatusCode)
                    return serverUrl;
            }
            catch
            {
                // Server not running on this endpoint; try the next candidate.
            }
        }

        return null;
    }

    /// <summary>
    /// Clears the cached project name so the next access re-resolves it.
    /// Used when the reporter resets between assemblies in a shared process.
    /// </summary>
    internal void ReResolveProject()
    {
        _project = null;
    }

    private static string? GetEnvironmentValue(string name)
    {
        var value = System.Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string? ResolveProjectNameFromMetadata(AssemblyName assemblyName)
    {
        var assembly = AppDomain.CurrentDomain.GetAssemblies()
            .FirstOrDefault(a =>
                !a.IsDynamic &&
                AssemblyName.ReferenceMatchesDefinition(a.GetName(), assemblyName));

        if (assembly == null)
        {
            try
            {
                assembly = Assembly.Load(assemblyName);
            }
            catch
            {
                return null;
            }
        }

        return ResolveProjectNameFromMetadata(assembly);
    }

    private static string? ResolveProjectNameFromLoadedAssemblyMetadata()
    {
        foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies().Where(a => !a.IsDynamic))
        {
            var project = ResolveProjectNameFromMetadata(assembly);
            if (project != null)
                return project;
        }

        return null;
    }

    private static string? ResolveProjectNameFromMetadata(Assembly assembly)
    {
        var value = assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(a => string.Equals(a.Key, ProjectMetadataKey, StringComparison.OrdinalIgnoreCase))
            ?.Value;

        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>
    /// Gets the default shared configuration.
    /// </summary>
    public static LiveDocConfig Default { get; } = new();
}
