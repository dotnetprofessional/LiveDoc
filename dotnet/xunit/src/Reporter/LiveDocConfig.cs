namespace LiveDoc.xUnit.Reporter;

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
    /// Default server URL for auto-discovery.
    /// </summary>
    public const string DefaultServerUrl = "http://localhost:3100";

    /// <summary>
    /// The LiveDoc server URL. Null if reporting is disabled.
    /// </summary>
    public string? ServerUrl { get; }

    /// <summary>
    /// The project name. Defaults to the assembly name.
    /// Resolved lazily to allow the test assembly to load first.
    /// </summary>
    public string Project => _project ??= _defaultProject ?? ResolveProjectName();
    private string? _project;
    private readonly string? _defaultProject;

    /// <summary>
    /// The environment name. Defaults to "local".
    /// </summary>
    public string Environment { get; }

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
        var envUrl = System.Environment.GetEnvironmentVariable(ServerUrlEnvVar);
        ServerUrl = !string.IsNullOrEmpty(envUrl) ? envUrl : TryDiscoverServer();
        var envProject = System.Environment.GetEnvironmentVariable(ProjectEnvVar);
        if (!string.IsNullOrEmpty(envProject))
            _project = envProject;
        else
            _defaultProject = defaultProject;
        Environment = System.Environment.GetEnvironmentVariable(EnvironmentEnvVar) ?? "local";
    }

    /// <summary>
    /// Creates a configuration with explicit values (for testing).
    /// </summary>
    public LiveDocConfig(string serverUrl, string project, string environment)
    {
        ServerUrl = serverUrl;
        _project = project;
        Environment = environment;
    }

    /// <summary>
    /// Resolves the project name from the test assembly.
    /// Falls back through: entry assembly → test assemblies in AppDomain → "Unknown".
    /// </summary>
    private static string ResolveProjectName()
    {
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
        try
        {
            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
            var response = client.GetAsync($"{DefaultServerUrl}/api/health").GetAwaiter().GetResult();
            if (response.IsSuccessStatusCode)
                return DefaultServerUrl;
        }
        catch
        {
            // Server not running — auto-discovery failed silently
        }
        return null;
    }

    /// <summary>
    /// Gets the default shared configuration.
    /// </summary>
    public static LiveDocConfig Default { get; } = new();
}
