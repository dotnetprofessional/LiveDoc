using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Xunit;

namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>
/// Configuration for <see cref="JourneyFixtureBase"/>. All properties have sensible defaults
/// except <see cref="ServerProject"/> and <see cref="JourneysPath"/> which must be set.
/// </summary>
public record JourneyConfig
{
    /// <summary>
    /// Relative path from the test project to the server project directory.
    /// <b>Required</b> — no default.
    /// </summary>
    /// <example><c>ServerProject = "../../src/MyApi"</c></example>
    public required string ServerProject { get; init; }

    /// <summary>
    /// Relative path from the test project to the journeys directory.
    /// <b>Required</b> — no default.
    /// </summary>
    /// <example><c>JourneysPath = "../../journeys"</c></example>
    public required string JourneysPath { get; init; }

    /// <summary>Sets <c>ASPNETCORE_ENVIRONMENT</c> and <c>DOTNET_ENVIRONMENT</c>. Default: <c>"Test"</c></summary>
    public string ServerEnvironment { get; init; } = "Test";

    /// <summary>httpYac environment name (maps to .env files). Default: <c>"local"</c></summary>
    public string HttpYacEnvironment { get; init; } = "local";

    /// <summary>How long to wait for the server to start. Default: 30 seconds.</summary>
    public TimeSpan StartupTimeout { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>Additional args appended to <c>dotnet run --project {path}</c>. Default: <c>"--no-launch-profile"</c></summary>
    public string ServerArguments { get; init; } = "--no-launch-profile";

    /// <summary>
    /// When true, writes startup diagnostic messages to stderr so they appear in test runner output.
    /// Useful for troubleshooting server startup issues. Default: <c>false</c>.
    /// </summary>
    public bool Verbose { get; init; } = false;
}

/// <summary>
/// Base class for journey test fixtures. Manages the server lifecycle, httpYac execution,
/// response file loading, and capture mode.
/// <para>
/// Override <see cref="Configure"/> to provide your project settings. All other behavior
/// has sensible defaults — override virtual methods only for advanced scenarios.
/// </para>
/// </summary>
/// <remarks>
/// <b>Minimal usage</b>:
/// <code>
/// public class JourneyServerFixture : JourneyFixtureBase
/// {
///     protected override JourneyConfig Configure() =&gt; new()
///     {
///         ServerProject = "../../src/MyApi",
///         JourneysPath  = "../../journeys",
///     };
/// }
/// </code>
///
/// <b>Custom environment</b>:
/// <code>
/// public class JourneyServerFixture : JourneyFixtureBase
/// {
///     protected override JourneyConfig Configure() =&gt; new()
///     {
///         ServerProject     = "../../src/MyApi",
///         JourneysPath      = "../../journeys",
///         ServerEnvironment = "Development",
///         StartupTimeout    = TimeSpan.FromSeconds(60),
///     };
/// }
/// </code>
/// </remarks>
public class JourneyFixtureBase : IAsyncLifetime
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*m", RegexOptions.Compiled);

    private Process? _serverProcess;
    private string? _tempDataDir;
    private JourneyConfig? _config;

    /// <summary>The resolved configuration for this fixture.</summary>
    protected JourneyConfig Config => _config ??= Configure();

    /// <summary>Base URL of the running server (e.g., http://localhost:5123).</summary>
    public string BaseUrl => $"http://localhost:{Port}";

    /// <summary>Port the server is listening on.</summary>
    public int Port { get; private set; }

    /// <summary>Absolute path to the journeys directory (resolved during initialization).</summary>
    public string JourneysDir { get; private set; } = "";

    /// <summary>True when <c>JOURNEY_CAPTURE=true</c> — saves response bodies as contract files.</summary>
    public static bool IsCaptureMode =>
        string.Equals(Environment.GetEnvironmentVariable("JOURNEY_CAPTURE"), "true", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Path to the temporary data directory created for this test run.
    /// Useful in <see cref="ConfigureServerProcess"/> to isolate server data between runs.
    /// </summary>
    protected string TempDataDir => _tempDataDir ?? throw new InvalidOperationException("Fixture not initialized");

    // ── Configuration ──────────────────────────────────────────────

    /// <summary>
    /// Returns the configuration for this fixture. Override to set your project paths
    /// and any non-default settings.
    /// </summary>
    protected virtual JourneyConfig Configure() =>
        throw new InvalidOperationException(
            $"{GetType().Name} must override Configure() to provide ServerProject and JourneysPath.");

    // ── xUnit Lifecycle ────────────────────────────────────────────

    public virtual async Task InitializeAsync()
    {
        _tempDataDir = Path.Combine(Path.GetTempPath(), $"livedoc-journey-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDataDir);

        Port = FindAvailablePort();

        var testProjectDir = FindProjectRoot();
        var serverProjectDir = Path.GetFullPath(Path.Combine(testProjectDir, Config.ServerProject));
        JourneysDir = Path.GetFullPath(Path.Combine(testProjectDir, Config.JourneysPath));

        var psi = new ProcessStartInfo
        {
            FileName = "dotnet",
            Arguments = $"run --no-build --project \"{serverProjectDir}\" {Config.ServerArguments}",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding = System.Text.Encoding.UTF8,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        psi.Environment["ASPNETCORE_URLS"] = $"http://localhost:{Port}";
        psi.Environment["ASPNETCORE_ENVIRONMENT"] = Config.ServerEnvironment;
        psi.Environment["DOTNET_ENVIRONMENT"] = Config.ServerEnvironment;

        ConfigureServerProcess(psi);

        // Always log a startup summary — low noise, high value when debugging
        WriteDiagnostic($"[LiveDoc Journey] Starting server: {Config.ServerProject}");
        WriteDiagnostic($"[LiveDoc Journey]   Port: {Port}");
        WriteDiagnostic($"[LiveDoc Journey]   ASPNETCORE_URLS: {psi.Environment["ASPNETCORE_URLS"]}");
        WriteDiagnostic($"[LiveDoc Journey]   Environment: {Config.ServerEnvironment}");
        if (Config.Verbose)
        {
            WriteDiagnostic($"[LiveDoc Journey]   Command: dotnet {psi.Arguments}");
            WriteDiagnostic($"[LiveDoc Journey]   Server project: {serverProjectDir}");
            WriteDiagnostic($"[LiveDoc Journey]   Journeys dir: {JourneysDir}");
        }

        _serverProcess = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start server process");

        _serverProcess.EnableRaisingEvents = true;
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            try { if (_serverProcess is { HasExited: false }) _serverProcess.Kill(entireProcessTree: true); }
            catch { /* best effort */ }
        };

        await WaitForStartupAsync(_serverProcess, Config.StartupTimeout);
        WriteDiagnostic($"[LiveDoc Journey] Server ready at {BaseUrl}");
    }

    public virtual async Task DisposeAsync()
    {
        if (_serverProcess is { HasExited: false })
        {
            _serverProcess.Kill(entireProcessTree: true);
            await _serverProcess.WaitForExitAsync();
        }
        _serverProcess?.Dispose();

        if (_tempDataDir != null && Directory.Exists(_tempDataDir))
        {
            try { Directory.Delete(_tempDataDir, recursive: true); }
            catch { /* best effort */ }
        }
    }

    // ── Virtual Methods (advanced scenarios only) ──────────────────

    /// <summary>
    /// Hook to add project-specific environment variables or modify the process
    /// before it starts. Called after the base class applies config.
    /// <para>Default: no-op.</para>
    /// </summary>
    protected virtual void ConfigureServerProcess(ProcessStartInfo psi) { }

    /// <summary>
    /// Determines if a server output line indicates the server is ready.
    /// <para>Default: detects Kestrel's "Now listening on" or "Application started".</para>
    /// </summary>
    protected virtual bool IsServerReady(string outputLine)
    {
        return outputLine.Contains("Now listening on", StringComparison.OrdinalIgnoreCase) ||
               outputLine.Contains("Application started", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Returns variables to pass to httpYac via <c>--var</c> CLI args.
    /// <para>Default: <c>{ "baseUrl": BaseUrl }</c></para>
    /// </summary>
    protected virtual Dictionary<string, string> GetHttpYacVariables()
    {
        return new Dictionary<string, string> { ["baseUrl"] = BaseUrl };
    }

    /// <summary>
    /// Called for each line of server output. Override to extract startup values.
    /// <para>Default: no-op.</para>
    /// </summary>
    protected virtual void OnServerOutputLine(string line) { }

    // ── Public Methods (used by generated test code) ───────────────

    /// <summary>
    /// Runs a journey .http file via httpYac CLI and returns per-step results.
    /// </summary>
    public async Task<JourneyResult> RunJourneyAsync(string relativePath)
    {
        var httpFilePath = Path.Combine(JourneysDir, relativePath);
        if (!File.Exists(httpFilePath))
            throw new FileNotFoundException($"Journey file not found: {httpFilePath}");

        var variables = GetHttpYacVariables();
        var varArgs = string.Join(" ", variables.Select(kv => $"--var {kv.Key}={kv.Value}"));

        var psi = new ProcessStartInfo
        {
            FileName = OperatingSystem.IsWindows() ? "cmd.exe" : "npx",
            Arguments = OperatingSystem.IsWindows()
                ? $"/c npx httpyac send \"{httpFilePath}\" --all --no-color -e {Config.HttpYacEnvironment} --bail {varArgs}"
                : $"httpyac send \"{httpFilePath}\" --all --no-color -e {Config.HttpYacEnvironment} --bail {varArgs}",
            WorkingDirectory = JourneysDir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding = System.Text.Encoding.UTF8,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start httpyac");

        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        var fullOutput = stdout + (string.IsNullOrEmpty(stderr) ? "" : $"\n\nSTDERR:\n{stderr}");
        var result = JourneyResult.Parse(process.ExitCode, fullOutput);

        if (IsCaptureMode)
            CaptureResponses(relativePath, result);

        return result;
    }

    /// <summary>
    /// Loads a response contract file (<c>{stepName}.Response.json</c>) from a journey folder.
    /// </summary>
    public string LoadResponseFile(string journeyFolder, string stepName)
    {
        var path = Path.Combine(JourneysDir, journeyFolder, $"{stepName}.Response.json");
        if (!File.Exists(path))
            throw new FileNotFoundException($"Response file not found: {path}");
        return File.ReadAllText(path);
    }

    // ── Private Helpers ────────────────────────────────────────────

    private void CaptureResponses(string relativePath, JourneyResult result)
    {
        var journeyFolder = Path.GetDirectoryName(Path.Combine(JourneysDir, relativePath))!;
        foreach (var (stepName, step) in result.Steps)
        {
            var body = step.ResponseBody;
            if (string.IsNullOrWhiteSpace(body)) continue;
            var trimmed = body.Trim();
            if (trimmed.Length == 0 || (trimmed[0] != '{' && trimmed[0] != '[')) continue;
            var filePath = Path.Combine(journeyFolder, $"{stepName}.Response.json");
            try
            {
                var doc = JsonDocument.Parse(trimmed);
                var formatted = JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(filePath, formatted);
            }
            catch { /* Skip invalid JSON */ }
        }
    }

    private async Task WaitForStartupAsync(Process process, TimeSpan timeout)
    {
        var ready = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var outputLines = new System.Collections.Concurrent.ConcurrentQueue<string>();

        async Task MonitorStream(System.IO.StreamReader stream)
        {
            while (true)
            {
                string? line;
                try { line = await stream.ReadLineAsync(); }
                catch { break; }
                if (line == null) break;

                var clean = StripAnsi(line);
                outputLines.Enqueue(clean);
                OnServerOutputLine(clean);

                if (Config.Verbose)
                    WriteDiagnostic($"[LiveDoc Journey]   > {clean}");

                if (IsServerReady(clean))
                    ready.TrySetResult(true);
            }
        }

        // Monitor both streams — ASP.NET Core logs "Now listening on" to stderr by default
        var stderrTask = MonitorStream(process.StandardError);
        var stdoutTask = MonitorStream(process.StandardOutput);

        // When both streams close the process has exited
        var processExited = Task.WhenAll(stderrTask, stdoutTask);

        var completed = await Task.WhenAny(ready.Task, processExited, Task.Delay(timeout));

        if (completed == ready.Task)
        {
            await Task.Delay(500); // brief settle time
            return;
        }

        // Not ready — build diagnostic message
        await Task.Delay(200); // let any trailing output arrive
        var output = string.Join("\n", outputLines);
        var diagnostics = string.IsNullOrEmpty(output) ? "(no output captured)" : output;

        var portHint =
            $"\n\nTroubleshooting hint: LiveDoc set ASPNETCORE_URLS=http://localhost:{Port} but your " +
            $"server may be ignoring it. If your Program.cs calls UseUrls(), builder.WebHost.UseUrls(), " +
            $"or sets URLs in launchSettings.json, those take precedence over the environment variable. " +
            $"See https://learn.microsoft.com/en-us/aspnet/core/fundamentals/servers/kestrel/endpoints " +
            $"for the full URL binding precedence order.\n" +
            $"Quick fix: remove UseUrls() calls or add '--urls http://localhost:{Port}' to ServerArguments.";

        if (process.HasExited)
            throw new InvalidOperationException(
                $"Server process exited with code {process.ExitCode} before startup completed.\n" +
                $"Expected ASPNETCORE_URLS: http://localhost:{Port}\n" +
                $"Server output:\n{diagnostics}" +
                portHint);

        throw new TimeoutException(
            $"Server did not start within {timeout.TotalSeconds}s.\n" +
            $"Expected ASPNETCORE_URLS: http://localhost:{Port}\n" +
            $"Server output:\n{diagnostics}" +
            portHint);
    }

    private static int FindAvailablePort()
    {
        var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    private static string FindProjectRoot()
    {
        var dir = AppContext.BaseDirectory;
        while (dir != null)
        {
            if (Directory.GetFiles(dir, "*.csproj").Length > 0)
                return dir;
            dir = Path.GetDirectoryName(dir);
        }
        throw new InvalidOperationException("Could not find test project root (.csproj)");
    }

    private static string StripAnsi(string input) => AnsiEscapePattern.Replace(input, string.Empty);

    /// <summary>
    /// Writes a diagnostic message. Override to redirect to your logging framework.
    /// <para>Default: writes to stderr (visible in test runner output).</para>
    /// </summary>
    protected virtual void WriteDiagnostic(string message) => Console.Error.WriteLine(message);
}
