using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingSpecifications;

/// <summary>
/// Specification: RuleOutline
/// 
/// Tests for the [RuleOutline] attribute that enables data-driven
/// rules with [Example] attributes.
/// </summary>
[Specification("Rule Outline", Description = @"
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

    [Rule("A single positional RuleOutline narrative is stored as its authored description")]
    public void Positional_narrative_binds_as_description()
    {
        var method = typeof(Rule_Outline_Spec).GetMethod(nameof(Basic_addition));
        var attribute = method?.GetCustomAttributes(typeof(RuleOutlineAttribute), false)
            .Cast<RuleOutlineAttribute>()
            .Single();

        Assert.Equal("Adding '<a>' and '<b>' equals '<expected>'", attribute?.Description);
    }

    [Rule("A parameterless RuleOutline continues to derive its narrative from the method name")]
    public void Parameterless_outline_uses_method_name()
    {
        var method = typeof(Rule_Outline_Spec).GetMethod(nameof(Dividing_A_by_B_equals_EXPECTED))!;
        var attribute = method.GetCustomAttributes(typeof(RuleOutlineAttribute), false)
            .Cast<RuleOutlineAttribute>()
            .Single();
        var values = new Dictionary<string, object?>
        {
            ["a"] = 10,
            ["b"] = 2,
            ["expected"] = 5
        };

        Assert.Equal("Dividing 10 by 2 equals 5", attribute.GetDisplayName(method, values));
        Assert.Null(attribute.Description);
        Assert.Null(attribute.GetDescription(method));
    }

    [Rule("An explicit RuleOutline DisplayName template takes precedence and substitutes example values")]
    public void Explicit_display_name_is_the_title_template()
    {
        var method = typeof(Rule_Outline_Spec).GetMethod(nameof(Explicit_display_name))!;
        var attribute = method.GetCustomAttributes(typeof(RuleOutlineAttribute), false)
            .Cast<RuleOutlineAttribute>()
            .Single();

        Assert.Equal(
            "Explicit display '7' is used",
            attribute.GetDisplayName(method, new Dictionary<string, object?> { ["value"] = 7 }));
    }

    [RuleOutline(DisplayName = "Explicit display '<value>' is used")]
    [Example(7)]
    public void Explicit_display_name(int value)
    {
        Assert.Equal(7, value);
    }

    [Rule("RuleOutline and ScenarioOutline test cases retain their original five-parameter constructors")]
    public void Outline_test_case_constructor_compatibility()
    {
        var signature = new[]
        {
            typeof(IMessageSink),
            typeof(TestMethodDisplay),
            typeof(TestMethodDisplayOptions),
            typeof(ITestMethod),
            typeof(object[])
        };

        Assert.NotNull(typeof(LiveDocRuleOutlineTestCase).GetConstructor(signature));
        Assert.NotNull(typeof(LiveDocScenarioOutlineTestCase).GetConstructor(signature));
    }

    [RuleOutline]
    [Example(10, 2, 5)]
    [Example(100, 10, 10)]
    [Example(9, 3, 3)]
    public void Dividing_A_by_B_equals_EXPECTED(int a, int b, int expected)
    {
        Assert.Equal(expected, a / b);
    }

    [RuleOutline("Status '<status>' uses retry delay '60' seconds and <attempts:3> attempts")]
    [Example("Transient")]
    public void Authored_description_populates_rule_values_and_params(string status)
    {
        Assert.Equal(status, Rule.Values[0].AsString());
        Assert.Equal(60, Rule.Values[1].AsInt());
        Assert.Equal(3, Rule.Params["attempts"].AsInt());
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
#pragma warning disable CS8625 // The null example is the behavior under test.
    [Example(null, "default")]
#pragma warning restore CS8625
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
