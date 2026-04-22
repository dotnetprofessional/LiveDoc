using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;

namespace SweDevTools.LiveDoc.xUnit.Reporter;

/// <summary>
/// HTTP client for reporting test results to the LiveDoc server.
/// Implements the v1 reporting protocol.
/// </summary>
public class LiveDocReporter : IDisposable
{
    private readonly HttpClient _client;
    private readonly LiveDocConfig _config;
    private readonly JsonSerializerOptions _jsonOptions;
    private string? _runId;
    private bool _disposed;

    /// <summary>
    /// Gets the current run ID, or null if no run has been started.
    /// </summary>
    public string? RunId => _runId;

    /// <summary>
    /// Gets whether the reporter is enabled (server URL is configured).
    /// </summary>
    public bool IsEnabled => _config.IsEnabled;

    /// <summary>
    /// Creates a new reporter with the default configuration.
    /// </summary>
    public LiveDocReporter() : this(LiveDocConfig.Default)
    {
    }

    /// <summary>
    /// Creates a new reporter with the specified configuration.
    /// </summary>
    public LiveDocReporter(LiveDocConfig config)
    {
        _config = config;
        _client = new HttpClient(new SocketsHttpHandler
        {
            MaxConnectionsPerServer = 50,
            ConnectTimeout = TimeSpan.FromSeconds(5)
        });
        _client.Timeout = TimeSpan.FromMinutes(5);
        
        if (_config.IsEnabled)
        {
            _client.BaseAddress = new Uri(_config.ServerUrl!);
        }

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        };
    }

    /// <summary>
    /// Creates a reporter with a custom HttpClient (for testing).
    /// </summary>
    public LiveDocReporter(HttpClient client, LiveDocConfig config)
    {
        _client = client;
        _config = config;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        };
    }

    /// <summary>
    /// Starts a new test run.
    /// </summary>
    /// <returns>The run ID, or null if reporting is disabled or failed.</returns>
    public async Task<string?> StartRunAsync(CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled)
            return null;

        if (_runId != null)
            return _runId;

        try
        {
            var request = new StartRunRequest
            {
                Project = _config.Project,
                Environment = _config.Environment,
                Framework = "xunit",
                Timestamp = DateTime.UtcNow.ToString("O")
            };

            var response = await _client.PostAsJsonAsync(
                "/api/v1/runs/start",
                request,
                _jsonOptions,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                LogWarning($"Failed to start run: {response.StatusCode}");
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<StartRunResponse>(_jsonOptions, cancellationToken);
            _runId = result?.RunId;
            return _runId;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to start run: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Upserts a test case (document) to the current run.
    /// </summary>
    public async Task<bool> UpsertTestCaseAsync(TestCase testCase, CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled || _runId == null)
            return false;

        try
        {
            var request = new UpsertTestCaseRequest { TestCase = testCase };
            var response = await _client.PostAsJsonAsync(
                $"/api/v1/runs/{_runId}/testcases",
                request,
                _jsonOptions,
                cancellationToken);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to upsert test case: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Upserts multiple test cases in a single batch request, optionally completing the run.
    /// Combines batch + complete into one HTTP call to fit within ProcessExit timeout.
    /// </summary>
    public async Task<bool> UpsertTestCasesBatchAsync(
        IEnumerable<TestCase> testCases, 
        CompleteRunRequest? complete = null,
        CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled || _runId == null)
            return false;

        try
        {
            var payload = testCases.ToList();
            var request = complete != null
                ? (object)new { testCases = payload, complete }
                : new { testCases = payload };
            var json = JsonSerializer.SerializeToUtf8Bytes(request, _jsonOptions);
            var content = new ByteArrayContent(json);
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/runs/{_runId}/testcases/batch") { Content = content };
            var response = await _client.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                LogWarning($"Failed to batch upsert test cases: {response.StatusCode}");
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to batch upsert test cases: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Upserts a test under a test case.
    /// </summary>
    public async Task<bool> UpsertTestAsync(string testCaseId, BaseTest test, CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled || _runId == null)
            return false;

        try
        {
            var request = new UpsertTestRequest { TestCaseId = testCaseId, Test = test };
            var response = await _client.PostAsJsonAsync(
                $"/api/v1/runs/{_runId}/tests",
                request,
                _jsonOptions,
                cancellationToken);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to upsert test: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Patches execution result for a test.
    /// </summary>
    public async Task<bool> PatchExecutionAsync(string testId, ExecutionResult execution, CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled || _runId == null)
            return false;

        try
        {
            var request = new PatchExecutionRequest
            {
                Status = execution.Status,
                Duration = execution.Duration,
                Error = execution.Error
            };

            var response = await _client.PatchAsJsonAsync(
                $"/api/v1/runs/{_runId}/tests/{testId}/execution",
                request,
                _jsonOptions,
                cancellationToken);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to patch execution: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Upserts example results for an outline.
    /// </summary>
    public async Task<bool> UpsertExampleResultsAsync(
        string outlineId, 
        IEnumerable<ExampleResult> results, 
        CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled || _runId == null)
            return false;

        try
        {
            var request = new UpsertExampleResultsRequest { Results = results.ToList() };
            var response = await _client.PostAsJsonAsync(
                $"/api/v1/runs/{_runId}/outlines/{outlineId}/example-results",
                request,
                _jsonOptions,
                cancellationToken);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to upsert example results: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Completes the current test run.
    /// </summary>
    public async Task<bool> CompleteRunAsync(
        Status status, 
        long duration, 
        Statistics summary, 
        CancellationToken cancellationToken = default)
    {
        if (!_config.IsEnabled || _runId == null)
            return false;

        try
        {
            var request = new CompleteRunRequest
            {
                Status = status,
                Duration = duration,
                Summary = summary
            };

            var json = JsonSerializer.SerializeToUtf8Bytes(request, _jsonOptions);
            var content = new ByteArrayContent(json);
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/runs/{_runId}/complete") { Content = content };
            var response = await _client.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            LogWarning($"Failed to complete run: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Logs a warning message. Override in derived classes for custom logging.
    /// </summary>
    protected virtual void LogWarning(string message)
    {
        var line = $"[LiveDoc] Warning: {message}";
        System.Diagnostics.Debug.WriteLine(line);
        try
        {
            Console.Error.WriteLine(line);
        }
        catch
        {
            // Ignore console logging failures.
        }
    }

    /// <summary>
    /// Resets the run state so a new run can be started.
    /// Call after CompleteRunAsync() when reusing the reporter instance.
    /// </summary>
    public void ResetRun()
    {
        _runId = null;
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _client.Dispose();
            _disposed = true;
        }
    }
}

/// <summary>
/// Extension methods for HttpClient to support PATCH with JSON.
/// </summary>
internal static class HttpClientExtensions
{
    public static async Task<HttpResponseMessage> PatchAsJsonAsync<T>(
        this HttpClient client,
        string requestUri,
        T value,
        JsonSerializerOptions options,
        CancellationToken cancellationToken = default)
    {
        var content = JsonContent.Create(value, mediaType: null, options);
        var request = new HttpRequestMessage(HttpMethod.Patch, requestUri) { Content = content };
        return await client.SendAsync(request, cancellationToken);
    }
}
