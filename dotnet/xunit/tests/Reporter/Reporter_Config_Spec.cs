using LiveDoc.xUnit;
using LiveDoc.xUnit.Reporter;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Reporter;

/// <summary>
/// Specification: Reporter Config
/// 
/// Tests for the LiveDocConfig class that reads configuration
/// from environment variables.
/// </summary>
[Specification(Description = @"
    LiveDocConfig reads server URL, project, and environment settings.
    Reporting is enabled only when a valid server URL is configured.")]
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

    #endregion
}
