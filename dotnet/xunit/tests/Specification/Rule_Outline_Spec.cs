using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// Specification: RuleOutline
/// 
/// Tests for the [RuleOutline] attribute that enables data-driven
/// rules with [Example] attributes.
/// </summary>
[Specification(Description = @"
    RuleOutline is the specification pattern equivalent of ScenarioOutline.
    It allows data-driven testing with [Example] attributes.
    The rule description can include <placeholder> syntax.
")]
public class Rule_Outline_Spec : SpecificationTest
{
    public Rule_Outline_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Basic RuleOutline

    [RuleOutline("Adding '<a>' and '<b>' equals '<expected>'")]
    [Example(1, 2, 3)]
    [Example(5, 5, 10)]
    [Example(0, 0, 0)]
    [Example(-1, 1, 0)]
    public void Basic_addition(int a, int b, int expected)
    {
        Assert.Equal(expected, a + b);
    }

    [RuleOutline]
    [Example(10, 2, 5)]
    [Example(100, 10, 10)]
    [Example(9, 3, 3)]
    public void Dividing_A_by_B_equals_EXPECTED(int a, int b, int expected)
    {
        Assert.Equal(expected, a / b);
    }

    #endregion

    #region String Operations

    [RuleOutline("String '<input>' has length '<length>'")]
    [Example("", 0)]
    [Example("a", 1)]
    [Example("hello", 5)]
    [Example("hello world", 11)]
    public void String_length(string input, int length)
    {
        Assert.Equal(length, input.Length);
    }

    [RuleOutline("'<input>' converted to uppercase is '<expected>'")]
    [Example("hello", "HELLO")]
    [Example("World", "WORLD")]
    [Example("TEST", "TEST")]
    [Example("", "")]
    public void String_uppercase(string input, string expected)
    {
        Assert.Equal(expected, input.ToUpperInvariant());
    }

    #endregion

    #region Boolean Operations

    [RuleOutline("'<a>' AND '<b>' equals '<expected>'")]
    [Example(true, true, true)]
    [Example(true, false, false)]
    [Example(false, true, false)]
    [Example(false, false, false)]
    public void Boolean_and(bool a, bool b, bool expected)
    {
        Assert.Equal(expected, a && b);
    }

    [RuleOutline("'<a>' OR '<b>' equals '<expected>'")]
    [Example(true, true, true)]
    [Example(true, false, true)]
    [Example(false, true, true)]
    [Example(false, false, false)]
    public void Boolean_or(bool a, bool b, bool expected)
    {
        Assert.Equal(expected, a || b);
    }

    #endregion

    #region Decimal/Currency Operations

    [RuleOutline("'<price>' with '<discount>'% off equals '<expected>'")]
    [Example(100.0, 10.0, 90.0)]
    [Example(50.0, 50.0, 25.0)]
    [Example(200.0, 25.0, 150.0)]
    [Example(99.99, 0.0, 99.99)]
    public void Discount_calculation(double price, double discount, double expected)
    {
        var result = price * (1 - discount / 100);
        Assert.Equal(expected, result, 2);
    }

    #endregion

    #region Edge Cases

    [RuleOutline("Null coalescing: '<input>' ?? 'default' = '<expected>'")]
    [Example(null, "default")]
    [Example("value", "value")]
    [Example("", "")]
    public void Null_coalescing(string? input, string expected)
    {
        var result = input ?? "default";
        Assert.Equal(expected, result);
    }

    [RuleOutline]
    [Example(0, true)]
    [Example(1, false)]
    [Example(-1, false)]
    [Example(100, false)]
    public void Value_N_is_zero_returns_EXPECTED(int n, bool expected)
    {
        Assert.Equal(expected, n == 0);
    }

    #endregion
}
