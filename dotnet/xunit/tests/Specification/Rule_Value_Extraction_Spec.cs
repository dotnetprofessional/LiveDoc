using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// Specification: Rule Value Extraction
/// 
/// Tests for extracting quoted values and named parameters from rule titles.
/// Mirrors the vitest specification-rules.Spec.ts value extraction tests.
/// </summary>
[Specification("Rule Value Extraction", Description = @"
    Rules support inline value extraction via Rule.Values and Rule.Params,
    using the same parsing and coercion infrastructure as Step.Values.
    Quoted values use single quotes: 'value'. Named params use angle brackets: <name:value>.")]
public class Rule_Value_Extraction_Spec : SpecificationTest
{
    public Rule_Value_Extraction_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Quoted Values (Rule.Values)

    [Rule("Adding '5' and '3' returns '8'")]
    public void Extracts_quoted_integer_values()
    {
        var (a, b, expected) = Rule.Values.As<int, int, int>();
        Assert.Equal(expected, a + b);
    }

    [Rule("Multiplying '7' by '6' equals '42'")]
    public void Extracts_multiple_quoted_values()
    {
        Assert.Equal(3, Rule.Values.Count);
        Assert.Equal(7, Rule.Values[0].AsInt());
        Assert.Equal(6, Rule.Values[1].AsInt());
        Assert.Equal(42, Rule.Values[2].AsInt());
    }

    [Rule("Boolean coercion: 'true' and 'false' are booleans")]
    public void Coerces_boolean_values()
    {
        Assert.True(Rule.Values[0].AsBool());
        Assert.False(Rule.Values[1].AsBool());
    }

    [Rule("String value: 'hello world' is extracted")]
    public void Extracts_string_values()
    {
        Assert.Equal("hello world", Rule.Values[0].AsString());
    }

    [Rule("Decimal value: '3.14' is extracted")]
    public void Extracts_decimal_values()
    {
        Assert.Equal(3.14, Rule.Values[0].AsDouble(), 2);
    }

    [Rule("Rule with no quoted values has empty collection")]
    public void Empty_values_when_none_quoted()
    {
        Assert.Equal(0, Rule.Values.Count);
    }

    [Rule("Raw values are strings: '42' stays '42'")]
    public void Raw_values_are_strings()
    {
        Assert.Equal("42", Rule.ValuesRaw[0]);
        Assert.Equal("42", Rule.ValuesRaw[1]);
    }

    #endregion

    #region Named Parameters (Rule.Params)

    [Rule("Processing <action:login> for <user:alice>")]
    public void Extracts_named_string_params()
    {
        Assert.Equal("login", Rule.Params["action"].AsString());
        Assert.Equal("alice", Rule.Params["user"].AsString());
    }

    [Rule("Transfer <amount:500> from <source:checking> to <dest:savings>")]
    public void Extracts_multiple_named_params()
    {
        Assert.Equal(500, Rule.Params["amount"].AsInt());
        Assert.Equal("checking", Rule.Params["source"].AsString());
        Assert.Equal("savings", Rule.Params["dest"].AsString());
    }

    [Rule("Boolean param: <enabled:true> and <debug:false>")]
    public void Coerces_named_boolean_params()
    {
        Assert.True(Rule.Params["enabled"].AsBool());
        Assert.False(Rule.Params["debug"].AsBool());
    }

    [Rule("Raw params are strings: <count:42>")]
    public void Raw_params_are_strings()
    {
        Assert.Equal("42", Rule.ParamsRaw["count"]);
    }

    [Rule("Rule with no named params has empty dictionary")]
    public void Empty_params_when_none_named()
    {
        Assert.Equal(0, Rule.Params.Count);
    }

    #endregion

    #region Mixed Values and Params

    [Rule("Adding <a:10> to '5' returns <expected:15>")]
    public void Extracts_both_values_and_params()
    {
        // Quoted value
        Assert.Equal(1, Rule.Values.Count);
        Assert.Equal(5, Rule.Values[0].AsInt());

        // Named params
        Assert.Equal(10, Rule.Params["a"].AsInt());
        Assert.Equal(15, Rule.Params["expected"].AsInt());

        // Verify the math
        var a = Rule.Params["a"].AsInt();
        var b = Rule.Values[0].AsInt();
        var expected = Rule.Params["expected"].AsInt();
        Assert.Equal(expected, a + b);
    }

    #endregion
}
