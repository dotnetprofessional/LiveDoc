using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingFeatures.Background;

[Feature("Scenario Background Lifecycle", Description = "Shared preconditions run independently for each scenario and example, followed by cleanup.")]
[Tag("backgrounds")]
public class Background_Lifecycle_Spec : FeatureTest
{
    private int _credits;
    private int _backgroundCalls;
    private bool _afterCalled;

    public Background_Lifecycle_Spec(ITestOutputHelper output) : base(output) { }

    protected override async Task BackgroundAsync()
    {
        await Task.Yield();
        Given("the account starts with '10' credits", ctx =>
        {
            _credits = ctx.Step!.Values[0].AsInt();
            _backgroundCalls++;
        });
    }

    protected override async Task AfterBackgroundAsync()
    {
        await Task.Yield();
        Assert.Equal(1, _backgroundCalls);
        _afterCalled = true;
    }

    [Scenario("A scenario uses its own Background precondition")]
    public void Background_supplies_given()
    {
        When("the account spends '3' credits", ctx =>
            _credits -= ctx.Step!.Values[0].AsInt());
        Then("the balance is '7' credits", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), _credits));
    }

    [Scenario("A scenario may add a Given after its Background")]
    public void Own_given_after_background()
    {
        var observedCredits = 0;
        Given("the account receives '2' more credits", ctx =>
            _credits += ctx.Step!.Values[0].AsInt());
        When("the balance is checked", () => observedCredits = _credits);
        Then("the balance is '12' credits", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), observedCredits));
    }

    [ScenarioOutline("A Background runs for the '<amount>' credit example")]
    [Example(2, 8)]
    [Example(4, 6)]
    public void Background_runs_for_every_example(int amount, int remaining)
    {
        When("the account spends '<amount>' credits", () => _credits -= amount);
        Then("the balance is '<remaining>' credits", () =>
            Assert.Equal(remaining, _credits));
    }

    public override void Dispose()
    {
        Assert.True(_afterCalled, "AfterBackgroundAsync must run before xUnit disposes the test instance.");
        base.Dispose();
    }
}
