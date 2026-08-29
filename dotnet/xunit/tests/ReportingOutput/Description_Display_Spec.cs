using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput;

/// <summary>
/// Tests that verify the description is displayed in test output.
/// </summary>
[Feature("Description Display", Description = @"
    This feature tests that descriptions are displayed correctly.
    The description should appear below the Feature header.
")]
public class Description_Display_Spec : FeatureTest
{
    public Description_Display_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Scenario]
    public void Simple_scenario_shows_feature_description()
    {
        string? description = null;

        Given("a test with a feature description", () => { });

        When("the feature description is read", () => description = Feature.Description);
        
        Then("the description appears in the output", () =>
        {
            Assert.NotNull(description);
            Assert.Contains("description", description, StringComparison.OrdinalIgnoreCase);
        });
    }
}
