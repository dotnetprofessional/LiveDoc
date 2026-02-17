using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Execution;

/// <summary>
/// Feature: Async Execution
/// 
/// Tests for async/await support in LiveDoc tests.
/// Validates that steps can use async operations.
/// </summary>
[Feature(Description = @"
    Steps in LiveDoc scenarios support async/await. Given, When, and Then
    steps can each be asynchronous, and async works with context access
    and scenario outlines.")]
public class Async_Execution_Spec : FeatureTest
{
    public Async_Execution_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Async Scenarios

    [Scenario]
    public async Task Async_Given_step()
    {
        string? result = null;
        
        await Given("an async operation completes", async () =>
        {
            await Task.Delay(1); // Simulate async work
            result = "completed";
        });
        
        Then("the result is set", () =>
        {
            Assert.Equal("completed", result);
        });
    }

    [Scenario]
    public async Task Async_When_step()
    {
        int value = 0;
        
        Given("an initial value", () => value = 5);
        
        await When("an async calculation occurs", async () =>
        {
            await Task.Delay(1);
            value = value * 2;
        });
        
        Then("the value is doubled", () =>
        {
            Assert.Equal(10, value);
        });
    }

    [Scenario]
    public async Task Async_Then_step()
    {
        var data = new List<string>();
        
        Given("some data", () => data.Add("item"));
        
        await Then("the async assertion passes", async () =>
        {
            await Task.Delay(1);
            Assert.Single(data);
        });
    }

    [Scenario]
    public async Task Multiple_async_steps()
    {
        var log = new List<string>();
        
        await Given("step 1", async () =>
        {
            await Task.Delay(1);
            log.Add("given");
        });
        
        await When("step 2", async () =>
        {
            await Task.Delay(1);
            log.Add("when");
        });
        
        await Then("all steps executed", async () =>
        {
            await Task.Delay(1);
            Assert.Equal(new[] { "given", "when" }, log);
        });
    }

    #endregion

    #region Async with Context

    [Scenario]
    public async Task Async_step_with_context_access()
    {
        int? extractedValue = null;
        
        await Given("a value of '42' is provided", async ctx =>
        {
            await Task.Delay(1);
            extractedValue = ctx.Step!.Values[0].AsInt();
        });
        
        Then("the value was extracted", () =>
        {
            Assert.Equal(42, extractedValue);
        });
    }

    #endregion

    #region Async Scenario Outlines

    [ScenarioOutline]
    [Example(100, 10)]
    [Example(200, 20)]
    public async Task Async_scenario_outline(int input, int expected)
    {
        int result = 0;
        
        await Given($"input is '{input}'", async () =>
        {
            await Task.Delay(1);
        });
        
        await When("the input is divided by 10", async () =>
        {
            await Task.Delay(1);
            result = input / 10;
        });
        
        Then($"the result is '{expected}'", () =>
        {
            Assert.Equal(expected, result);
        });
    }

    #endregion
}
