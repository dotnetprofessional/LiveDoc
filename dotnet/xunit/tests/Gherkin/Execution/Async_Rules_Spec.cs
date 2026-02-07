using LiveDoc.xUnit;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Gherkin.Execution;

/// <summary>
/// Specification: Async Rules
/// 
/// Tests for async support in Specification-style rules.
/// </summary>
[Specification]
public class Async_Rules_Spec : SpecificationTest
{
    public Async_Rules_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule]
    public async Task Async_rule_executes_correctly()
    {
        await Task.Delay(1);
        var result = await ComputeAsync(5);
        Assert.Equal(10, result);
    }

    [RuleOutline("Async rule outline with examples")]
    [Example(2, 4)]
    [Example(5, 10)]
    [Example(10, 20)]
    public async Task Async_rule_outline(int input, int expected)
    {
        var result = await ComputeAsync(input);
        Assert.Equal(expected, result);
    }

    private static async Task<int> ComputeAsync(int value)
    {
        await Task.Delay(1);
        return value * 2;
    }
}
