using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Feature("Journey Fixture Integration",
    Description = "End-to-end validation that JourneyFixtureBase starts a real server, runs httpYac journeys, and validates response contracts.")]
[Trait("Category", "Integration")]
public class JourneyFixture_Integration_Spec : FeatureTest, IClassFixture<SampleApiFixture>
{
    private readonly SampleApiFixture _server;
    private readonly PropertyRules _propertyRules;

    public JourneyFixture_Integration_Spec(ITestOutputHelper output, SampleApiFixture server)
        : base(output)
    {
        _server = server;
        _propertyRules = JsonAssertions.LoadPropertyRules(
            Path.Combine(server.JourneysDir, "property-rules.txt"));
    }

    [Scenario("Health check journey validates server is running")]
    public async Task Health_check_journey()
    {
        var run = await _server.RunJourneyAsync("health-check/_health-check.http");

        When("checking the health endpoint", ctx =>
        {
            run.AssertStep("healthCheck", step =>
            {
                Assert.Equal(200, step.StatusCode);

                var expected = _server.LoadResponseFile("health-check", "healthCheck");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'healthCheck' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody!, expected, _propertyRules, "healthCheck");
            });
        });
    }

    [Scenario("Items CRUD journey creates, reads, and deletes")]
    public async Task Items_crud_journey()
    {
        var run = await _server.RunJourneyAsync("items/_items.http");

        Given("a new item is created", ctx =>
        {
            run.AssertStep("createItem", step =>
            {
                Assert.Equal(201, step.StatusCode);

                var expected = _server.LoadResponseFile("items", "createItem");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'createItem' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody!, expected, _propertyRules, "createItem");
            });
        });

        When("retrieving the created item", ctx =>
        {
            run.AssertStep("getItem", step =>
            {
                Assert.Equal(200, step.StatusCode);

                var expected = _server.LoadResponseFile("items", "getItem");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'getItem' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody!, expected, _propertyRules, "getItem");
            });
        });

        And("deleting the item", ctx =>
        {
            run.AssertStep("deleteItem");
        });

        Then("the item is no longer found", ctx =>
        {
            run.AssertStep("verifyDeleted", step =>
            {
                Assert.Equal(404, step.StatusCode);
            });
        });
    }

    [Scenario("Fixture provides correct base URL and port")]
    public void Fixture_provides_base_url()
    {
        Given("the fixture has started", ctx =>
        {
            Assert.True(_server.Port > 0, "Port should be a positive number");
        });

        Then("the base URL uses the assigned port", ctx =>
        {
            Assert.Equal($"http://localhost:{_server.Port}", _server.BaseUrl);
        });
    }

    [Scenario("LoadResponseFile loads contract JSON from journey folder")]
    public void Load_response_file()
    {
        When("loading a known response contract", ctx =>
        {
            var json = _server.LoadResponseFile("health-check", "healthCheck");
            Assert.False(string.IsNullOrWhiteSpace(json));
            Assert.Contains("healthy", json);
        });

        Then("loading a non-existent contract throws FileNotFoundException", ctx =>
        {
            Assert.Throws<FileNotFoundException>(() =>
                _server.LoadResponseFile("health-check", "nonExistentStep"));
        });
    }
}
