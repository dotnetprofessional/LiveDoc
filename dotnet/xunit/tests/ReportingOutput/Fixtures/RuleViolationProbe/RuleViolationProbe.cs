using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

[assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput.Fixtures.RuleViolationProbe;

[Feature("Rule Violation Probe")]
public class Rule_Violation_Probe_Feature : FeatureTest
{
    public Rule_Violation_Probe_Feature(ITestOutputHelper output) : base(output) { }

    [Scenario("A scenario with two Given steps")]
    public void Repeated_given()
    {
        Given("the first precondition exists", () => { });
        Given("the second precondition exists", () => { });
        When("the action runs", () => { });
        Then("the outcome is observed", () => { });
    }

    [Scenario("A scenario without a When step")]
    public void Missing_when()
    {
        Given("a precondition exists", () => { });
        Then("the outcome is observed", () => { });
    }

    [Scenario("A scenario without Gherkin steps")]
    public void Missing_all_steps()
    {
        Assert.True(true);
    }

    [ScenarioOutline("An outline row '<value>' with two Given steps")]
    [Example("first")]
    [Example("second")]
    public void Repeated_given_outline(string value)
    {
        Given($"the '{value}' first precondition exists", () => { });
        Given($"the '{value}' second precondition exists", () => { });
        When("the outline action runs", () => { });
        Then("the outline outcome is observed", () => { });
    }
}
