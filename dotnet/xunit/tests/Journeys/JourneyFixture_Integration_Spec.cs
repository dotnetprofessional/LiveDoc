using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "Validates JourneyFixtureBase infrastructure: port assignment, URL construction, and response file loading.")]
[Trait("Category", "Integration")]
public class JourneyFixture_Integration_Spec : SpecificationTest, IClassFixture<SampleApiFixture>
{
    private readonly SampleApiFixture _server;

    public JourneyFixture_Integration_Spec(ITestOutputHelper output, SampleApiFixture server)
        : base(output)
    {
        _server = server;
    }

    [Rule("Fixture assigns a positive ephemeral port")]
    public void Assigns_positive_port()
    {
        Assert.True(_server.Port > 0, "Port should be a positive number");
    }

    [Rule("Base URL uses the assigned port")]
    public void Base_url_uses_port()
    {
        Assert.Equal($"http://localhost:{_server.Port}", _server.BaseUrl);
    }

    [Rule("LoadResponseFile returns contract JSON from journey folder")]
    public void Load_response_file_returns_json()
    {
        var json = _server.LoadResponseFile("health-check", "healthCheck");
        Assert.False(string.IsNullOrWhiteSpace(json));
        Assert.Contains("healthy", json);
    }

    [Rule("LoadResponseFile throws FileNotFoundException for missing contract")]
    public void Load_response_file_throws_for_missing()
    {
        Assert.Throws<FileNotFoundException>(() =>
            _server.LoadResponseFile("health-check", "nonExistentStep"));
    }

    [Rule("JourneysDir resolves to an absolute path containing the sample journeys")]
    public void Journeys_dir_resolves()
    {
        Assert.True(Path.IsPathRooted(_server.JourneysDir));
        Assert.True(Directory.Exists(_server.JourneysDir));
        Assert.True(File.Exists(Path.Combine(_server.JourneysDir, "property-rules.txt")));
    }

    [Rule("IsCaptureMode reflects the JOURNEY_CAPTURE environment variable")]
    public void Capture_mode_reflects_env_var()
    {
        // In normal test runs, capture mode should be off
        Assert.False(SampleApiFixture.IsCaptureMode);
    }
}
