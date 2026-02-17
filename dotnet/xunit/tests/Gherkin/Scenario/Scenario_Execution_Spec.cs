using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Scenario;

/// <summary>
/// Feature: Scenario Execution
/// 
/// BDD tests for scenario execution behavior.
/// </summary>
[Feature("Scenario Execution", Description = @"
    Scenarios are isolated from each other and do not share state.
    All step types (Given, When, Then, And, But) execute in
    declaration order within a scenario.")]
public class Scenario_Execution_Spec : FeatureTest
{
    public Scenario_Execution_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Scenario Isolation

    [Scenario]
    public void First_scenario()
    {
        // Each scenario should be isolated
        var stepCount = 0;
        
        Given("an initial state", () => stepCount++);
        When("an action occurs", () => stepCount++);
        Then("the count is 2", () => Assert.Equal(2, stepCount));
    }

    [Scenario]
    public void Second_scenario()
    {
        // This should start fresh, not inherit from first scenario
        var stepCount = 0;
        
        Given("a fresh state", () => stepCount++);
        Then("the count is 1", () => Assert.Equal(1, stepCount));
    }

    #endregion

    #region Step Execution

    [Scenario("All step types execute in order")]
    public void All_step_types_execute()
    {
        var executionOrder = new List<string>();
        
        Given("step 1", () => executionOrder.Add("given"));
        And("step 2", () => executionOrder.Add("and1"));
        When("step 3", () => executionOrder.Add("when"));
        And("step 4", () => executionOrder.Add("and2"));
        Then("step 5", () => executionOrder.Add("then"));
        And("step 6", () => executionOrder.Add("and3"));
        But("step 7", () => executionOrder.Add("but"));
        
        Assert.Equal(new[] { "given", "and1", "when", "and2", "then", "and3", "but" }, executionOrder);
    }

    #endregion
}
