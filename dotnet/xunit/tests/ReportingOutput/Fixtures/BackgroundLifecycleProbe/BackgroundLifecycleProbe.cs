using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

[assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput.Fixtures.BackgroundLifecycleProbe;

[Feature("Shared Background Reporting Probe")]
public class Shared_Background_Probe : FeatureTest
{
    private int _credits;

    public Shared_Background_Probe(ITestOutputHelper output) : base(output) { }

    protected override Task BackgroundAsync()
    {
        Given("the account starts with '10' credits", ctx =>
            _credits = ctx.Step!.Values[0].AsInt());
        And("the account is ready", () => Assert.Equal(10, _credits));
        return Task.CompletedTask;
    }

    [Scenario("Background supplies the shared Given")]
    public void Shared_given()
    {
        When("the account spends '3' credits", ctx =>
            _credits -= ctx.Step!.Values[0].AsInt());
        Then("the balance is '7' credits", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), _credits));
    }

    [Scenario("A scenario adds its own Given")]
    public void Scenario_given()
    {
        Given("the account receives '2' more credits", ctx =>
            _credits += ctx.Step!.Values[0].AsInt());
        When("the balance is checked", () => Assert.Equal(12, _credits));
        Then("the balance is '12' credits", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), _credits));
    }

    [Scenario("A scenario continues its Background Given")]
    public void Continues_background_given()
    {
        And("the account has '10' credits", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), _credits));
        When("the account spends '3' credits", ctx =>
            _credits -= ctx.Step!.Values[0].AsInt());
        Then("the balance is '7' credits", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), _credits));
    }
}

[Feature("Without Background Probe")]
public class Without_Background_Probe : FeatureTest
{
    public Without_Background_Probe(ITestOutputHelper output) : base(output) { }

    [Scenario("A scenario without shared setup")]
    public void Scenario_without_background()
    {
        var credits = 0;
        var observed = 0;
        Given("the account starts with '1' credit", ctx =>
            credits = ctx.Step!.Values[0].AsInt());
        When("the balance is checked", () => observed = credits);
        Then("the balance remains '1' credit", ctx =>
            Assert.Equal(ctx.Step!.Values[0].AsInt(), observed));
    }
}

[Feature("Mixed Background Reporting Probe")]
public class Mixed_Background_Probe : FeatureTest
{
    private bool _ready;
    private bool _observed;

    public Mixed_Background_Probe(ITestOutputHelper output) : base(output) { }

    protected override Task BackgroundAsync()
    {
        Given("the dependency is ready", () =>
        {
            if (Scenario.Name == "A failing setup prevents its scenario")
                throw new InvalidOperationException("Dependency setup failed");
            _ready = true;
        });
        return Task.CompletedTask;
    }

    [Scenario("A failing setup prevents its scenario")]
    public void Failing_setup() => throw new InvalidOperationException("Scenario should not run");

    [Scenario("A passing setup permits its scenario")]
    public void Passing_setup()
    {
        When("the dependency is checked", () => _observed = _ready);
        Then("the dependency is ready", () => Assert.True(_observed));
    }
}

[Feature("Failed Background Lifecycle Probe")]
public class Failed_Background_Probe : FeatureTest
{
    public Failed_Background_Probe(ITestOutputHelper output) : base(output) { }

    protected override Task BackgroundAsync()
    {
        Given("the setup fails", (Action)(() => throw new InvalidOperationException("Background setup failed")));
        return Task.CompletedTask;
    }

    protected override Task AfterBackgroundAsync() =>
        throw new InvalidOperationException("Cleanup ran after background failure");

    [Scenario("A failed Background still runs cleanup")]
    public void Setup_fails() => throw new InvalidOperationException("Scenario should not run");
}

[Feature("Failed Scenario Lifecycle Probe")]
public class Failed_Scenario_Probe : FeatureTest
{
    private bool _ready;
    public Failed_Scenario_Probe(ITestOutputHelper output) : base(output) { }

    protected override Task BackgroundAsync()
    {
        Given("setup succeeds", () => _ready = true);
        return Task.CompletedTask;
    }

    protected override Task AfterBackgroundAsync() =>
        throw new InvalidOperationException("Cleanup ran after scenario failure");

    [Scenario("A failed Scenario still runs cleanup")]
    public void Scenario_fails()
    {
        Assert.True(_ready);
        When("the action fails", (Action)(() => throw new InvalidOperationException("Scenario action failed")));
    }
}

[Feature("Failed Cleanup Lifecycle Probe")]
public class Failed_Cleanup_Probe : FeatureTest
{
    private bool _ready;
    private bool _acted;
    public Failed_Cleanup_Probe(ITestOutputHelper output) : base(output) { }

    protected override Task BackgroundAsync()
    {
        Given("setup succeeds", () => _ready = true);
        return Task.CompletedTask;
    }

    [Feature("Outline Cleanup Lifecycle Probe")]
    public class Outline_Cleanup_Probe : FeatureTest
    {
        private int _amount;
        private int _credits;

        public Outline_Cleanup_Probe(ITestOutputHelper output) : base(output) { }

        protected override Task BackgroundAsync()
        {
            Given("the account starts with '10' credits", ctx =>
                _credits = ctx.Step!.Values[0].AsInt());
            return Task.CompletedTask;
        }

        [Feature("Invalid Background Lifecycle Probe")]
        public class Invalid_Background_Probe : FeatureTest
        {
            public Invalid_Background_Probe(ITestOutputHelper output) : base(output) { }

            protected override Task BackgroundAsync()
            {
                When("an action appears inside the Background", () => { });
                return Task.CompletedTask;
            }

            protected override Task AfterBackgroundAsync() =>
                throw new InvalidOperationException("Cleanup ran after invalid Background");

            [Scenario("Invalid Background steps fail before the Scenario")]
            public void Invalid_step() => throw new InvalidOperationException("Invalid Scenario should not run");
        }

        protected override Task AfterBackgroundAsync()
        {
            if (_amount == 2)
                throw new InvalidOperationException("Cleanup failed for example 2");
            return Task.CompletedTask;
        }

        [ScenarioOutline("Cleanup for example '<amount>' is isolated")]
        [Example(1)]
        [Example(2)]
        public void Cleanup_per_example(int amount)
        {
            When("the '<amount>' is recorded", () => _amount = amount);
            Then("the initial balance is '10' and the recorded amount matches <amount>",
                ctx =>
                {
                    Assert.Equal(amount, _amount);
                    Assert.Equal(ctx.Step!.Values[0].AsInt(), _credits);
                });
        }
    }

    protected override Task AfterBackgroundAsync() =>
        throw new InvalidOperationException("Cleanup failed on its own");

    [Scenario("A cleanup failure fails the Scenario")]
    public void Cleanup_fails()
    {
        When("the action succeeds", () => _acted = _ready);
        Then("the outcome is valid", () => Assert.True(_acted));
    }
}
