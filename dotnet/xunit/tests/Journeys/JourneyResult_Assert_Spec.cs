using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "JourneyResult.AssertStep verifies individual journey steps passed, providing clear diagnostics on failure.")]
public class JourneyResult_Assert_Spec : SpecificationTest
{
    public JourneyResult_Assert_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("Passing step does not throw")]
    public void Passing_step_does_not_throw()
    {
        var steps = new Dictionary<string, StepResult>
        {
            ["login"] = new StepResult("login", Passed: true, StatusCode: 200, Output: "OK", Reached: true)
        };
        var result = new JourneyResult(success: true, output: "", steps: steps);

        result.AssertStep("login");
    }

    [Rule("Failed step throws JourneyAssertionException with step name")]
    public void Failed_step_throws()
    {
        var steps = new Dictionary<string, StepResult>
        {
            ["createUser"] = new StepResult("createUser", Passed: false, StatusCode: 500, Output: "Server Error", Reached: true)
        };
        var result = new JourneyResult(success: false, output: "", steps: steps);

        var ex = Assert.Throws<JourneyAssertionException>(() => result.AssertStep("createUser"));

        Assert.Contains("createUser", ex.Message);
        Assert.Contains("500", ex.Message);
    }

    [Rule("Missing step throws with available step names")]
    public void Missing_step_throws_with_available_names()
    {
        var steps = new Dictionary<string, StepResult>
        {
            ["login"] = new StepResult("login", Passed: true, StatusCode: 200, Output: "", Reached: true),
            ["getProfile"] = new StepResult("getProfile", Passed: true, StatusCode: 200, Output: "", Reached: true)
        };
        var result = new JourneyResult(success: true, output: "", steps: steps);

        var ex = Assert.Throws<JourneyAssertionException>(() => result.AssertStep("nonexistent"));

        Assert.Contains("nonexistent", ex.Message);
        Assert.Contains("login", ex.Message);
        Assert.Contains("getProfile", ex.Message);
    }

    [Rule("Unreached step throws with 'not reached' message")]
    public void Unreached_step_throws()
    {
        var steps = new Dictionary<string, StepResult>
        {
            ["finalStep"] = new StepResult("finalStep", Passed: false, StatusCode: null, Output: "", Reached: false)
        };
        var result = new JourneyResult(success: false, output: "", steps: steps);

        var ex = Assert.Throws<JourneyAssertionException>(() => result.AssertStep("finalStep"));

        Assert.Contains("not reached", ex.Message);
    }

    [Rule("AssertStep with action runs action on passing step")]
    public void Action_overload_runs_on_passing_step()
    {
        var step = new StepResult("getItems", Passed: true, StatusCode: 200, Output: "items response", Reached: true);
        var steps = new Dictionary<string, StepResult> { ["getItems"] = step };
        var result = new JourneyResult(success: true, output: "", steps: steps);

        StepResult? captured = null;
        result.AssertStep("getItems", s => captured = s);

        Assert.NotNull(captured);
        Assert.Equal("getItems", captured.Name);
        Assert.Equal(200, captured.StatusCode);
    }

    [Rule("AssertStep with action does not run action on failed step")]
    public void Action_overload_skips_action_on_failed_step()
    {
        var steps = new Dictionary<string, StepResult>
        {
            ["badStep"] = new StepResult("badStep", Passed: false, StatusCode: 400, Output: "Bad Request", Reached: true)
        };
        var result = new JourneyResult(success: false, output: "", steps: steps);

        bool actionCalled = false;
        Assert.Throws<JourneyAssertionException>(() =>
            result.AssertStep("badStep", _ => actionCalled = true));

        Assert.False(actionCalled);
    }
}
