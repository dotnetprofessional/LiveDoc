// Generated from health-check/_health-check.http
// This file is developer-owned. The generator will not overwrite it.
// Re-scaffold with: dotnet msbuild -t:Build

using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit;
using Xunit.Abstractions;
using SweDevTools.LiveDoc.xUnit.Tests.Journeys;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys.Generated;

[Feature("Health Check", Description = "Verify the sample API is running")]
public class HealthCheck_Journey : FeatureTest, IClassFixture<SampleApiFixture>
{
    private readonly SampleApiFixture _server;
    private readonly PropertyRules _propertyRules;

    public HealthCheck_Journey(ITestOutputHelper output, SampleApiFixture server) : base(output)
    {
        _server = server;
        _propertyRules = JsonAssertions.LoadPropertyRules(
            Path.Combine(server.JourneysDir, "property-rules.txt"));
    }

    [Scenario("Server reports healthy status")]
    public async Task ServerReportsHealthyStatus()
    {
        var run = await _server.RunJourneyAsync("health-check/_health-check.http");

        When("checking the health endpoint", ctx =>
        {
            run.AssertStep("healthCheck", step =>
            {
                var expected = _server.LoadResponseFile("health-check", "healthCheck");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'healthCheck' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody, expected, _propertyRules, "healthCheck");
            });
        });
        Then("the server reports a healthy status", ctx => { });
    }
}
