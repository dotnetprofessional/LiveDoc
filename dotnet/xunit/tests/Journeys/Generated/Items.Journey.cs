// Generated from items/_items.http
// This file is developer-owned. The generator will not overwrite it.
// Re-scaffold with: dotnet msbuild -t:Build

using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit;
using Xunit.Abstractions;
using SweDevTools.LiveDoc.xUnit.Tests.Journeys;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys.Generated;

[Feature("Items CRUD", Description = "Create, read, and delete items via the API")]
public class Items_Journey : FeatureTest, IClassFixture<SampleApiFixture>
{
    private readonly SampleApiFixture _server;
    private readonly PropertyRules _propertyRules;

    public Items_Journey(ITestOutputHelper output, SampleApiFixture server) : base(output)
    {
        _server = server;
        _propertyRules = JsonAssertions.LoadPropertyRules(
            Path.Combine(server.JourneysDir, "property-rules.txt"));
    }

    [Scenario("Full item lifecycle")]
    public async Task FullItemLifecycle()
    {
        var run = await _server.RunJourneyAsync("items/_items.http");

        Given("a new item is created", ctx =>
        {
            run.AssertStep("createItem", step =>
            {
                var expected = _server.LoadResponseFile("items", "createItem");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'createItem' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody, expected, _propertyRules, "createItem");
            });
        });
        When("retrieving the created item", ctx =>
        {
            run.AssertStep("getItem", step =>
            {
                var expected = _server.LoadResponseFile("items", "getItem");
                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),
                    "Step 'getItem' has a response contract but returned no body");
                JsonAssertions.IsComparable(step.ResponseBody, expected, _propertyRules, "getItem");
            });
        });
        And("deleting the item", ctx =>
        {
            run.AssertStep("deleteItem");
        });
        Then("the item is no longer found", ctx =>
        {
            run.AssertStep("verifyDeleted");
        });
    }
}
