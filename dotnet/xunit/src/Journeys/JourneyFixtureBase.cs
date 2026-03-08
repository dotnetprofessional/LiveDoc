using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Xunit;

namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>
/// Base class for journey test fixtures. Manages the server lifecycle, httpYac execution,
/// response file loading, and capture mode.
/// <para>
/// <b>Convention over configuration</b>: provides fully working defaults for the common
/// ASP.NET Core scenario. Override virtual members only when your project differs from
/// the standard pattern.
/// </para>
/// </summary>
/// <remarks>
/// <b>Minimal usage</b> — just specify paths:
/// <code>
/// public class JourneyServerFixture : JourneyFixtureBase
/// {
///     public JourneyServerFixture()
///         : base(serverProject: "../src/MyApi", journeysDir: "../../journeys") { }
/// }
/// </code>
///
/// <b>Defaults provided</b>:
/// <list type="table">
///   <listheader><term>Concern</term><description>Default</description></listheader>
///   <item><term>Port</term><description>Random ephemeral port via TcpListener</description></item>
///   <item><term>Server start</term><description><c>dotnet run --project {path} --no-launch-profile</c></description></item>
///   <item><term>Env vars</term><description><c>ASPNETCORE_URLS</c> and <c>ASPNETCORE_ENVIRONMENT=Test</c></description></item>
///   <item><term>Startup detection</term><description>Monitors stdout for Kestrel's "Now listening on"</description></item>
///   <item><term>httpYac variables</term><description><c>baseUrl</c> auto-set to <c>http://localhost:{port}</c></description></item>
///   <item><term>Cleanup</term><description>Kills process tree on dispose</description></item>
/// </list>
/// </remarks>
public class JourneyFixtureBase : IAsyncLifetime
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*m", RegexOptions.Compiled);

    private readonly string _serverProjectRelativePath;
    private readonly string _journeysDirRelativePath;
    private Process? _serverProcess;
    private string? _tempDataDir;

    /// <summary>Base URL of the running server (e.g., http://localhost:5123).</summary>
    public string BaseUrl => $"http://localhost:{Port}";

    /// <summary>Port the server is listening on.</summary>
    public int Port { get; private set; }

    /// <summary>Absolute path to the journeys directory.</summary>
    public string JourneysDir { get; private set; } = "";

    /// <summary>True when <c>JOURNEY_CAPTURE=true</c> — saves response bodies as contract files.</summary>
    public static bool IsCaptureMode =>
        string.Equals(Environment.GetEnvironmentVariable("JOURNEY_CAPTURE"), "true", StringComparison.OrdinalIgnoreCase);

    // ── Constructor ────────────────────────────────────────────────

    /// <summary>
    /// Creates a journey fixture with paths to the server project and journeys directory.
    /// Both paths are relative to the test project root (the directory containing the .csproj).
    /// </summary>
    /// <param name="serverProject">Relative path from test project to the server .csproj directory (e.g., "../src/MyApi").</param>
    /// <param name="journeysDir">Relative path from test project to the journeys directory (e.g., "../../journeys").</param>
    protected JourneyFixtureBase(string serverProject, string journeysDir)
    {
        _serverProjectRelativePath = serverProject;
        _journeysDirRelativePath = journeysDir;
    }

    // ── xUnit Lifecycle ────────────────────────────────────────────

    public virtual async Task InitializeAsync()
    {
        _tempDataDir = Path.Combine(Path.GetTempPath(), $"livedoc-journey-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_tempDataDir);

        Port = FindAvailablePort();

        var testProjectDir = FindProjectRoot();
        var serverProjectDir = Path.GetFullPath(Path.Combine(testProjectDir, _serverProjectRelativePath));
        JourneysDir = Path.GetFullPath(Path.Combine(testProjectDir, _journeysDirRelativePath));

        var psi = new ProcessStartInfo
        {
            FileName = "dotnet",
            Arguments = $"run --project \"{serverProjectDir}\" --no-launch-profile",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        ConfigureServerProcess(psi);

        _serverProcess = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start server process");

        _serverProcess.EnableRaisingEvents = true;
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            try { if (_serverProcess is { HasExited: false }) _serverProcess.Kill(entireProcessTree: true); }
            catch { /* best effort */ }
        };

        await WaitForStartupAsync(_serverProcess, StartupTimeout);
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

    // ── Virtual Configuration Points ───────────────────────────────

    /// <summary>
    /// Configures the server process before it starts. Override to add custom environment
    /// variables or change command-line arguments.
    /// <para>Default: sets <c>ASPNETCORE_URLS</c> to <c>http://localhost:{Port}</c>
    /// and <c>ASPNETCORE_ENVIRONMENT</c> to <c>Test</c>.</para>
    /// </summary>
    protected virtual void ConfigureServerProcess(ProcessStartInfo psi)
    {
        psi.Environment["ASPNETCORE_URLS"] = $"http://localhost:{Port}";
        psi.Environment["ASPNETCORE_ENVIRONMENT"] = "Test";
        psi.Environment["DOTNET_ENVIRONMENT"] = "Test";
    }

    /// <summary>
    /// Determines if a line from server stdout/stderr indicates the server is ready.
    /// Override for non-Kestrel servers that emit different startup messages.
    /// <para>Default: detects Kestrel's "Now listening on" or "Application started".</para>
    /// </summary>
    protected virtual bool IsServerReady(string outputLine)
    {
        return outputLine.Contains("Now listening on", StringComparison.OrdinalIgnoreCase) ||
               outputLine.Contains("Application started", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Returns variables to pass to httpYac via --var CLI args.
    /// Override to add project-specific variables (tokens, API keys, etc.).
    /// <para>Default: <c>{ "baseUrl": "http://localhost:{Port}" }</c></para>
    /// </summary>
    protected virtual Dictionary<string, string> GetHttpYacVariables()
    {
        return new Dictionary<string, string>
        {
            ["baseUrl"] = BaseUrl
        };
    }

    /// <summary>
    /// How long to wait for the server to start before timing out.
    /// <para>Default: 30 seconds.</para>
    /// </summary>
    protected virtual TimeSpan StartupTimeout => TimeSpan.FromSeconds(30);

    /// <summary>
    /// The httpYac environment name to use (maps to .env files in the journeys directory).
    /// <para>Default: "local"</para>
    /// </summary>
    protected virtual string HttpYacEnvironment => "local";

    /// <summary>
    /// Path to the temporary data directory created for this test run.
    /// Available for use in <see cref="ConfigureServerProcess"/> to isolate server data.
    /// </summary>
    protected string TempDataDir => _tempDataDir ?? throw new InvalidOperationException("Fixture not initialized");

    /// <summary>
    /// Called after each line of server output is read. Override to extract values
    /// from startup logs (e.g., tokens, connection strings).
    /// <para>Default: no-op.</para>
    /// </summary>
    protected virtual void OnServerOutputLine(string line) { }

    // ── Public Methods (used by generated test code) ───────────────

    /// <summary>
    /// Runs a journey .http file via httpYac CLI and returns per-step results.
    /// When <see cref="IsCaptureMode"/> is true, saves response bodies as .Response.json files.
    /// </summary>
    /// <param name="relativePath">Path to the .http file relative to the journeys directory.</param>
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
                ? $"/c npx httpyac send \"{httpFilePath}\" --all -e {HttpYacEnvironment} --bail {varArgs}"
                : $"httpyac send \"{httpFilePath}\" --all -e {HttpYacEnvironment} --bail {varArgs}",
            WorkingDirectory = JourneysDir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
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
    /// <param name="journeyFolder">Journey subfolder relative to the journeys directory.</param>
    /// <param name="stepName">The @name of the step whose response to load.</param>
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
            catch
            {
                // Skip invalid JSON
            }
        }
    }

    private async Task WaitForStartupAsync(Process process, TimeSpan timeout)
    {
        var cts = new CancellationTokenSource(timeout);

        var stderrLines = new List<string>();
        var stderrTask = Task.Run(async () =>
        {
            while (!cts.Token.IsCancellationRequested)
            {
                var line = await process.StandardError.ReadLineAsync(cts.Token);
                if (line == null) break;
                stderrLines.Add(line);
                var clean = StripAnsi(line);
                OnServerOutputLine(clean);
            }
        }, cts.Token);

        try
        {
            while (!cts.Token.IsCancellationRequested)
            {
                var line = await process.StandardOutput.ReadLineAsync(cts.Token);
                if (line == null) break;

                var clean = StripAnsi(line);
                OnServerOutputLine(clean);

                if (IsServerReady(clean))
                {
                    // Give stderr a moment to catch up
                    await Task.Delay(500, cts.Token);
                    foreach (var errLine in stderrLines)
                        OnServerOutputLine(StripAnsi(errLine));
                    return;
                }
            }

            // Stdout ended — check stderr
            await Task.Delay(2000, cts.Token);
            foreach (var errLine in stderrLines)
            {
                var clean = StripAnsi(errLine);
                if (IsServerReady(clean))
                    return;
            }
        }
        catch (OperationCanceledException)
        {
            var combined = string.Join("\n", stderrLines.Take(20));
            throw new TimeoutException(
                $"Server did not start within {timeout.TotalSeconds}s.\nStderr (first 20 lines):\n{combined}");
        }

        throw new InvalidOperationException("Server process exited before startup completed");
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
}
