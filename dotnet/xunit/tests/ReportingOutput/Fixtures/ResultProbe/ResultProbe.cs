using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

[assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput.Fixtures.ResultProbe;

[Specification("Authoritative Result Probe")]
public class Authoritative_Result_Probe_Spec : SpecificationTest
{
    public Authoritative_Result_Probe_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("A direct assertion expecting '1' receives '1'")]
    public void Passing_direct_assertion()
    {
        Assert.Equal(Rule.Values[0].AsInt(), 1);
    }

    [Rule("A direct assertion expecting '1' receives '2'")]
    public void Failing_direct_assertion()
    {
        Assert.Equal(Rule.Values[0].AsInt(), 2);
    }
}

[Specification("Authoritative Outline Result Probe")]
public class Authoritative_Outline_Result_Probe_Spec : SpecificationTest
{
    public Authoritative_Outline_Result_Probe_Spec(ITestOutputHelper output) : base(output) { }

    [RuleOutline("A direct outline assertion expecting '<expected>' receives '<actual>'")]
    [Example(1, 1)]
    [Example(1, 2)]
    public void Direct_outline_assertion(int expected, int actual)
    {
        Assert.Equal(expected, actual);
    }
}

[Specification("Included Helper Fixture")]
public class IncludedHelperFixture : SpecificationTest
{
    public IncludedHelperFixture(ITestOutputHelper output) : base(output) { }

    [Rule("A helper fixture test is included")]
    public void Included_helper_test()
    {
        Assert.True(true);
    }
}

[Feature("Step Failure Probe")]
public class Step_Failure_Probe_Feature : FeatureTest
{
    public Step_Failure_Probe_Feature(ITestOutputHelper output) : base(output) { }

    [Scenario("A failed LiveDoc step exports its error")]
    public void Failed_step_exports_error()
    {
        Then("shipping rate expected 'Free' but is 'Standard'", ctx =>
        {
            var (expected, actual) = ctx.Step!.Values.As<string, string>();
            Assert.Equal(expected, actual);
        });
    }
}

[Feature("Duplicate Outline Result Probe")]
public class Duplicate_Outline_Result_Probe_Spec : FeatureTest
{
    public Duplicate_Outline_Result_Probe_Spec(ITestOutputHelper output) : base(output) { }

    [ScenarioOutline("Duplicate example '<value>' remains distinct")]
    [Example("same")]
    [Example("same")]
    public void Duplicate_examples_remain_distinct(string value)
    {
        Assert.Equal("same", value);
    }
}
