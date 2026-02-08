using LiveDoc.xUnit;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Gherkin.Scenario;

/// <summary>
/// Feature: Scenario Context
/// 
/// Tests for accessing scenario context within steps.
/// </summary>
[Feature("Scenario Context Access", Description = @"
    Scenario context (name, metadata) is accessible within steps via
    this.Scenario. Steps execute in declaration order and can inspect
    the running scenario's properties.")]
public class Scenario_Context_Spec : FeatureTest
{
    public Scenario_Context_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Scenario("Scenario context is accessible in steps")]
    public void Scenario_context_is_accessible()
    {
        string? scenarioName = null;
        
        Given("a scenario is running", () =>
        {
            scenarioName = this.Scenario.Name;
        });
        
        Then("the scenario name should be set", () =>
        {
            Assert.NotNull(scenarioName);
        });
    }

    [Scenario("Steps execute and complete successfully")]
    public void Steps_execute_successfully()
    {
        var executionLog = new List<string>();
        
        Given("first step executes", () => executionLog.Add("given"));
        When("second step executes", () => executionLog.Add("when"));
        Then("all steps executed in order", () =>
        {
            Assert.Equal(new[] { "given", "when" }, executionLog);
        });
    }
}
