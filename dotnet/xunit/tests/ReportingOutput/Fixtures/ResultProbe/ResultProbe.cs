using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

[assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput.Fixtures.ResultProbe;

[Specification("Authoritative Result Probe")]
public class Authoritative_Result_Probe_Spec : SpecificationTest
{
    public Authoritative_Result_Probe_Spec(ITestOutputHelper output) : base(output) { }

    private const string ScreenshotBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

    [Rule("A direct assertion expecting '1' receives '1'")]
    public void Passing_direct_assertion()
    {
        Assert.Equal(Rule.Values[0].AsInt(), 1);
        Attach(Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("raw-rule-pass")),
            "text/plain", "Rule text");
        AttachScreenshot(ScreenshotBase64, "Rule screenshot");
        AttachJson(new { value = 1 }, "Rule JSON");

        var path = Path.Combine(AppContext.BaseDirectory, $"rule-evidence-{Guid.NewGuid():N}.txt");
        try
        {
            File.WriteAllText(path, "file-rule-pass");
            AttachFile(path, "Rule file");
            AttachFile(Path.Combine(AppContext.BaseDirectory, "large-sequence.mmd"), "Workflow");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Rule("A direct assertion expecting '1' receives '2'")]
    public void Failing_direct_assertion()
    {
        AttachJson("""{"value":2}""", "Failed rule JSON");
        AttachScreenshot(ScreenshotBase64, "Failed rule screenshot");
        Assert.Equal(Rule.Values[0].AsInt(), 2);
    }

    [Rule("An unrelated rule has no evidence")]
    public void Unrelated_rule()
    {
        Assert.True(true);
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
        AttachJson(new { expected, actual }, $"Row {actual} JSON");
        Attach(Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"row-{actual}")),
            "text/plain", $"Row {actual} text");
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
        var reportedRate = "";
        var actualRate = "";
        Given("the shipping response is 'Standard'",
            ctx => reportedRate = ctx.Step!.Values[0].AsString());
        When("the shipping response is read", () => actualRate = reportedRate);
        Then(
            title: "shipping rate expected 'Free' but is 'Standard'",
            description: """
                ### Expected response

                ```json
                {"shippingRate":"Free"}
                ```
                """,
            step: ctx =>
            {
                var (expected, actual) = ctx.Step!.Values.As<string, string>();
                Assert.Equal(actual, actualRate);
                AttachJson(new { expected, actual = actualRate }, "Shipping rate response");
                Assert.Equal(expected, actualRate);
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
        var observed = "";
        Given("the repeated example value is 'same'",
            ctx => Assert.Equal(ctx.Step!.Values[0].AsString(), value));
        When("the example is processed", () => observed = value);
        Then("the value remains '<value>' for this example", () => Assert.Equal(value, observed));
    }
}

[Feature("Outline Step Evidence Probe")]
public class Outline_Step_Evidence_Probe : FeatureTest
{
    public Outline_Step_Evidence_Probe(ITestOutputHelper output) : base(output) { }

    [ScenarioOutline("Example '<number>' has its own step evidence")]
    [Example(1)]
    [Example(2)]
    [Example(3)]
    public void Each_example_owns_its_step_evidence(int number)
    {
        var observed = 0;
        Given($"example '{number}' records its evidence", ctx =>
        {
            Assert.Equal(number, ctx.Step!.Values[0].AsInt());
            if (number != 3)
                AttachJson(new { number }, $"Example {number} JSON");
        });
        When("the example is processed", () => observed = number);
        Then($"the result matches '{number}'", ctx => Assert.Equal(ctx.Step!.Values[0].AsInt(), observed));
    }
}

public sealed class Deferred_Theory_Result_Probe
{
    public static IEnumerable<object?[]> DistinctDisplayInputs()
    {
        yield return new object?[] { null };
        yield return new object?[] { Array.Empty<object>() };
    }

    [Theory]
    [MemberData(nameof(DistinctDisplayInputs), DisableDiscoveryEnumeration = true)]
    public void Distinct_display_names(object? input)
    {
        Assert.True(input is null or object[]);
    }

    public static IEnumerable<object[]> FailingThenPassingInputs()
    {
        yield return new object[] { new DeferredTheoryRow(false) };
        yield return new object[] { new DeferredTheoryRow(true) };
    }

    [Theory]
    [MemberData(nameof(FailingThenPassingInputs), DisableDiscoveryEnumeration = true)]
    public void Same_display_name_failing_then_passing(DeferredTheoryRow row)
    {
        Assert.True(row.IsValid);
    }

    public static IEnumerable<object[]> PassingThenFailingInputs()
    {
        yield return new object[] { new DeferredTheoryRow(true) };
        yield return new object[] { new DeferredTheoryRow(false) };
    }

    [Theory]
    [MemberData(nameof(PassingThenFailingInputs), DisableDiscoveryEnumeration = true)]
    public void Same_display_name_passing_then_failing(DeferredTheoryRow row)
    {
        Assert.True(row.IsValid);
    }
}

public sealed record DeferredTheoryRow(bool IsValid)
{
    public override string ToString() => "same";
}
