using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Output;

/// <summary>
/// Tests that verify the description is displayed in test output.
/// </summary>
[Feature(Description = @"
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
        Given("a test with a feature description", () =>
        {
            // The description should be visible in test output
        });
        
        Then("the description appears in the output", () =>
        {
            // Check the Feature.Description is set
            Assert.NotNull(Feature.Description);
            Assert.Contains("description", Feature.Description, StringComparison.OrdinalIgnoreCase);
        });
    }
}
