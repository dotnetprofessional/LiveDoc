namespace LiveDoc.xUnit.Reporter;

/// <summary>
/// Configuration for LiveDoc reporter.
/// Reads from environment variables to enable opt-in reporting.
/// </summary>
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
    /// The LiveDoc server URL. Null if reporting is disabled.
    /// </summary>
    public string? ServerUrl { get; }

    /// <summary>
    /// The project name. Defaults to the assembly name.
    /// </summary>
    public string Project { get; }

    /// <summary>
    /// The environment name. Defaults to "local".
    /// </summary>
    public string Environment { get; }

    /// <summary>
    /// Whether reporting is enabled (ServerUrl is set).
    /// </summary>
    public bool IsEnabled => !string.IsNullOrEmpty(ServerUrl);

    /// <summary>
    /// Creates a new configuration from environment variables.
    /// </summary>
    /// <param name="defaultProject">Default project name if not set in environment.</param>
    public LiveDocConfig(string? defaultProject = null)
    {
        ServerUrl = System.Environment.GetEnvironmentVariable(ServerUrlEnvVar);
        Project = System.Environment.GetEnvironmentVariable(ProjectEnvVar)
            ?? defaultProject
            ?? System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name
            ?? "Unknown";
        Environment = System.Environment.GetEnvironmentVariable(EnvironmentEnvVar) ?? "local";
    }

    /// <summary>
    /// Creates a configuration with explicit values (for testing).
    /// </summary>
    public LiveDocConfig(string serverUrl, string project, string environment)
    {
        ServerUrl = serverUrl;
        Project = project;
        Environment = environment;
    }

    /// <summary>
    /// Gets the default shared configuration.
    /// </summary>
    public static LiveDocConfig Default { get; } = new();
}
