using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Reporter;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using System.Net;
using System.Text;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

/// <summary>
/// Specification: Reporter Config
///
/// Tests for the LiveDocConfig class that reads configuration
/// from environment variables.
/// </summary>
[Specification("Reporter Config", Description = @"
    LiveDocConfig reads server URL, project, and environment settings.
    Reporting is enabled only when a valid server URL is configured.")]
[Collection(Environment_Sensitive_Collection.Name)]
public class Reporter_Config_Spec : SpecificationTest
{
    public Reporter_Config_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region IsEnabled

    [Rule("IsEnabled is false when server URL is not set")]
    public void IsEnabled_false_when_no_url()
    {
        // Create config with no URL
        var config = new LiveDocConfig(null!, "TestProject", "local");

        // Actually for this test we need to use the explicit constructor
        // that sets ServerUrl to the first parameter
        var config2 = new LiveDocConfig("", "TestProject", "local");

        Assert.False(config2.IsEnabled);
    }

    [Rule("IsEnabled is true when server URL is set")]
    public void IsEnabled_true_when_url_set()
    {
        var config = new LiveDocConfig("http://localhost:19275", "TestProject", "local");

        Assert.True(config.IsEnabled);
    }

    #endregion

    #region Explicit Constructor

    [Rule("Explicit constructor sets all values")]
    public void Explicit_constructor_sets_all_values()
    {
        var config = new LiveDocConfig(
            "http://example.com:8080",
            "MyProject",
            "production");

        Assert.Equal("http://example.com:8080", config.ServerUrl);
        Assert.Equal("MyProject", config.Project);
        Assert.Equal("production", config.Environment);
    }

    [Rule("Explicit constructor ignores environment variables")]
    public void Explicit_constructor_ignores_environment_variables()
    {
        WithEnvironmentVariable(LiveDocConfig.ServerUrlEnvVar, "http://env.example", () =>
        WithEnvironmentVariable(LiveDocConfig.ProjectEnvVar, "EnvProject", () =>
        WithEnvironmentVariable(LiveDocConfig.EnvironmentEnvVar, "env", () =>
        {
            var config = new LiveDocConfig(
                "http://explicit.example",
                "ExplicitProject",
                "explicit");

            Assert.Equal("http://explicit.example", config.ServerUrl);
            Assert.Equal("ExplicitProject", config.Project);
            Assert.Equal("explicit", config.Environment);
        })));
    }

    #endregion

    #region Environment-backed Constructor

    [Rule("Project reads LIVEDOC_PROJECT set after config construction")]
    public void Project_reads_late_environment_variable()
    {
        WithEnvironmentVariable(LiveDocConfig.ProjectEnvVar, null, () =>
        {
            var config = new LiveDocConfig("FallbackProject");

            WithEnvironmentVariable(LiveDocConfig.ProjectEnvVar, "EnvProject", () =>
            {
                Assert.Equal("EnvProject", config.Project);
            });
        });
    }

    [Rule("ServerUrl reads LIVEDOC_SERVER_URL set after config construction")]
    public void ServerUrl_reads_late_environment_variable()
    {
        WithEnvironmentVariable(LiveDocConfig.ServerUrlEnvVar, null, () =>
        {
            var config = new LiveDocConfig("FallbackProject");

            WithEnvironmentVariable(LiveDocConfig.ServerUrlEnvVar, "http://env.example", () =>
            {
                Assert.Equal("http://env.example", config.ServerUrl);
                Assert.True(config.IsEnabled);
            });
        });
    }

    [Rule("ServerUrl does not retain temporary LIVEDOC_SERVER_URL 'http://env.example' after it is cleared")]
    public void ServerUrl_does_not_retain_temporary_environment_variable_after_it_is_cleared()
    {
        var temporaryUrl = Rule.Values[0].AsString();

        WithEnvironmentVariable(LiveDocConfig.ServerUrlEnvVar, null, () =>
        {
            var config = new LiveDocConfig("FallbackProject");

            WithEnvironmentVariable(LiveDocConfig.ServerUrlEnvVar, temporaryUrl, () =>
            {
                Assert.Equal(temporaryUrl, config.ServerUrl);
            });

            Assert.NotEqual(temporaryUrl, config.ServerUrl);
        });
    }

    [Rule("StartRun logs '1' warning when retried '2' times against the same unreachable endpoint")]
    public async Task StartRun_logs_one_warning_for_repeated_attempts_against_same_unreachable_endpoint()
    {
        var (expectedWarnings, attempts) = Rule.Values.As<int, int>();
        var reporter = new RecordingReporter(
            new HttpClient(new ThrowingHandler("No such host is known. (env.example:80)")),
            new LiveDocConfig("http://env.example", "ConfigProject", "local"));

        for (var i = 0; i < attempts; i++)
            await reporter.StartRunAsync();

        Assert.Equal(expectedWarnings, reporter.Warnings.Count);
        Assert.Contains("env.example", reporter.Warnings[0]);
    }

    #endregion

    #region Run Type

    [Rule("RunType defaults to 'Full' when LIVEDOC_RUN_TYPE is not set")]
    public void RunType_defaults_to_full()
    {
        var expected = Enum.Parse<RunType>(Rule.Values[0].AsString());

        WithEnvironmentVariable(LiveDocConfig.RunTypeEnvVar, null, () =>
        {
            var config = new LiveDocConfig("RunTypeProject");

            Assert.Equal(expected, config.RunType);
        });
    }

    [Rule("RunType reads 'Partial' from LIVEDOC_RUN_TYPE value 'partial'")]
    public void RunType_reads_partial_environment_value()
    {
        var (expectedValue, environmentValue) = Rule.Values.As<string, string>();
        var expected = Enum.Parse<RunType>(expectedValue);

        WithEnvironmentVariable(LiveDocConfig.RunTypeEnvVar, environmentValue, () =>
        {
            var config = new LiveDocConfig("RunTypeProject");

            Assert.Equal(expected, config.RunType);
        });
    }

    [Rule("StartRun sends run type 'partial' when explicit config uses 'Partial'")]
    public async Task StartRun_sends_partial_run_type()
    {
        var (expectedJsonValue, configuredValue) = Rule.Values.As<string, string>();
        var handler = new CapturingHandler();
        var reporter = new LiveDocReporter(
            new HttpClient(handler),
            new LiveDocConfig(
                "http://example.test",
                "RunTypeProject",
                "local",
                runType: Enum.Parse<RunType>(configuredValue)));

        await reporter.StartRunAsync();

        Assert.Contains($"\"runType\":\"{expectedJsonValue}\"", handler.RequestBody);
    }

    #endregion

    #region Environment Variable Names

    [Rule("ServerUrlEnvVar constant is correct")]
    public void ServerUrlEnvVar_constant_is_correct()
    {
        Assert.Equal("LIVEDOC_SERVER_URL", LiveDocConfig.ServerUrlEnvVar);
    }

    [Rule("ProjectEnvVar constant is correct")]
    public void ProjectEnvVar_constant_is_correct()
    {
        Assert.Equal("LIVEDOC_PROJECT", LiveDocConfig.ProjectEnvVar);
    }

    [Rule("EnvironmentEnvVar constant is correct")]
    public void EnvironmentEnvVar_constant_is_correct()
    {
        Assert.Equal("LIVEDOC_ENVIRONMENT", LiveDocConfig.EnvironmentEnvVar);
    }

    [Rule("RunTypeEnvVar constant is 'LIVEDOC_RUN_TYPE'")]
    public void RunTypeEnvVar_constant_is_correct()
    {
        Assert.True(string.Equals(
            Rule.Values[0].AsString(),
            LiveDocConfig.RunTypeEnvVar,
            StringComparison.Ordinal));
    }

    [Rule("ProjectMetadataKey constant is correct")]
    public void ProjectMetadataKey_constant_is_correct()
    {
        Assert.Equal("LiveDocProject", LiveDocConfig.ProjectMetadataKey);
    }

    #endregion

    private static void WithEnvironmentVariable(string name, string? value, Action action)
    {
        var previous = Environment.GetEnvironmentVariable(name);
        var previousSuppression = Environment.GetEnvironmentVariable(LiveDocReporter.ReportingSuppressedEnvVar);
        try
        {
            if (string.Equals(name, LiveDocConfig.ServerUrlEnvVar, StringComparison.Ordinal))
                Environment.SetEnvironmentVariable(LiveDocReporter.ReportingSuppressedEnvVar, "true");

            Environment.SetEnvironmentVariable(name, value);
            action();
        }
        finally
        {
            Environment.SetEnvironmentVariable(name, previous);
            Environment.SetEnvironmentVariable(LiveDocReporter.ReportingSuppressedEnvVar, previousSuppression);
        }
    }

    private sealed class RecordingReporter : LiveDocReporter
    {
        public RecordingReporter(HttpClient client, LiveDocConfig config) : base(client, config)
        {
        }

        public List<string> Warnings { get; } = [];

        protected override void LogWarning(string message)
        {
            Warnings.Add(message);
        }
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        private readonly string _message;

        public ThrowingHandler(string message)
        {
            _message = message;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            throw new HttpRequestException(_message);
        }
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string RequestBody { get; private set; } = string.Empty;

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestBody = request.Content == null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent(
                    """{"protocolVersion":"1.0","runId":"run-1","websocketUrl":"/ws"}""",
                    Encoding.UTF8,
                    "application/json")
            };
        }
    }
}
