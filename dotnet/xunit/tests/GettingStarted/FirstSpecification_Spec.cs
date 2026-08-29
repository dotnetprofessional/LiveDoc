using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.GettingStarted;

[Specification("First Specification", Description = @"
    A minimal MSpec-style example that shows how a rule title can carry
    the inputs and expected result while the assertion extracts those values.")]
public class FirstSpecification_Spec : SpecificationTest
{
    public FirstSpecification_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("Adding '5' and '3' returns '8'")]
    public void Adding_two_numbers_returns_the_expected_sum()
    {
        var (left, right, expected) = Rule.Values.As<int, int, int>();

        Assert.Equal(expected, left + right);
    }
}
