using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests._Internal;

/// <summary>
/// Specification: ValueParser
/// 
/// Unit tests for the ValueParser static class that extracts
/// quoted values and named parameters from step descriptions.
/// </summary>
[Specification(Description = @"
    The ValueParser is responsible for extracting embedded values
    from step descriptions. It handles both 'quoted values' and
    <name:value> named parameters.
")]
public class Value_Parser_Spec : SpecificationTest
{
    public Value_Parser_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region ExtractQuotedValues

    [Rule("Empty string returns empty list")]
    public void Empty_string_returns_empty_list()
    {
        var result = ValueParser.ExtractQuotedValues("");
        Assert.Empty(result);
    }

    [Rule("String without quotes returns empty list")]
    public void String_without_quotes_returns_empty_list()
    {
        var result = ValueParser.ExtractQuotedValues("a step without any values");
        Assert.Empty(result);
    }

    [Rule("Single quoted value is extracted")]
    public void Single_quoted_value_is_extracted()
    {
        var result = ValueParser.ExtractQuotedValues("user has '42' items");
        
        Assert.Single(result);
        Assert.Equal("42", result[0]);
    }

    [Rule("Multiple quoted values are extracted in order")]
    public void Multiple_quoted_values_are_extracted_in_order()
    {
        var result = ValueParser.ExtractQuotedValues("add '5' items of 'Tea' at '9.99'");
        
        Assert.Equal(3, result.Length);
        Assert.Equal("5", result[0]);
        Assert.Equal("Tea", result[1]);
        Assert.Equal("9.99", result[2]);
    }

    [Rule("Empty quoted value is extracted")]
    public void Empty_quoted_value_is_extracted()
    {
        var result = ValueParser.ExtractQuotedValues("name is '' (empty)");
        
        Assert.Single(result);
        Assert.Equal("", result[0]);
    }

    [Rule("Quoted values with spaces are preserved")]
    public void Quoted_values_with_spaces_are_preserved()
    {
        var result = ValueParser.ExtractQuotedValues("product is 'Byron Breakfast Tea'");
        
        Assert.Single(result);
        Assert.Equal("Byron Breakfast Tea", result[0]);
    }

    [Rule("Unclosed quote is not extracted")]
    public void Unclosed_quote_is_not_extracted()
    {
        var result = ValueParser.ExtractQuotedValues("value is 'incomplete");
        Assert.Empty(result);
    }

    [RuleOutline("Extracts '<expected>' values from '<input>'")]
    [Example("no quotes", 0)]
    [Example("'one'", 1)]
    [Example("'one' and 'two'", 2)]
    [Example("'a' 'b' 'c' 'd'", 4)]
    public void Quoted_value_count(string input, int expected)
    {
        var result = ValueParser.ExtractQuotedValues(input);
        Assert.Equal(expected, result.Length);
    }

    #endregion

    #region ExtractNamedParams

    [Rule("Empty string returns empty dictionary")]
    public void Named_params_empty_string_returns_empty_dict()
    {
        var result = ValueParser.ExtractNamedParams("");
        Assert.Empty(result);
    }

    [Rule("String without params returns empty dictionary")]
    public void String_without_params_returns_empty_dict()
    {
        var result = ValueParser.ExtractNamedParams("a step without params");
        Assert.Empty(result);
    }

    [Rule("Single named param is extracted")]
    public void Single_named_param_is_extracted()
    {
        var result = ValueParser.ExtractNamedParams("user with <name:John>");
        
        Assert.Single(result);
        Assert.Equal("John", result["name"]);
    }

    [Rule("Multiple named params are extracted")]
    public void Multiple_named_params_are_extracted()
    {
        var result = ValueParser.ExtractNamedParams("user <name:John> age <age:30>");
        
        Assert.Equal(2, result.Count);
        Assert.Equal("John", result["name"]);
        Assert.Equal("30", result["age"]);
    }

    [Rule("Named param with empty value is extracted")]
    public void Named_param_with_empty_value_is_extracted()
    {
        var result = ValueParser.ExtractNamedParams("field <empty:>");
        
        Assert.Single(result);
        Assert.Equal("", result["empty"]);
    }

    [Rule("Placeholder without colon is not a named param")]
    public void Placeholder_without_colon_is_not_named_param()
    {
        var result = ValueParser.ExtractNamedParams("outline <placeholder>");
        Assert.Empty(result);
    }

    [Rule("Named param keys are case-insensitive")]
    public void Named_param_keys_are_case_insensitive()
    {
        var result = ValueParser.ExtractNamedParams("user <Name:John>");
        
        Assert.True(result.ContainsKey("name"));
        Assert.True(result.ContainsKey("NAME"));
        Assert.True(result.ContainsKey("Name"));
    }

    [Rule("Spaces in param names are preserved as-is")]
    public void Spaces_in_param_names_are_preserved()
    {
        // Param names preserve spaces - users should avoid spaces in param names
        var result = ValueParser.ExtractNamedParams("user <first name:John>");
        
        Assert.True(result.ContainsKey("first name"));
        Assert.Equal("John", result["first name"]);
    }

    #endregion

    #region ReplaceNamedParams

    [Rule("Named params are replaced with just the value")]
    public void Named_params_are_replaced_with_value()
    {
        var result = ValueParser.ReplaceNamedParams("user <name:John> is <age:30>");
        
        Assert.Equal("user John is 30", result);
    }

    [Rule("Regular placeholders are not replaced")]
    public void Regular_placeholders_are_not_replaced()
    {
        var result = ValueParser.ReplaceNamedParams("outline <country>");
        
        Assert.Equal("outline <country>", result);
    }

    [Rule("Mixed named params and placeholders")]
    public void Mixed_named_params_and_placeholders()
    {
        var result = ValueParser.ReplaceNamedParams("<name:John> from <country>");
        
        Assert.Equal("John from <country>", result);
    }

    #endregion

    #region FormatMethodNameWithValues

    [Rule("Underscores are converted to spaces")]
    public void Underscores_are_converted_to_spaces()
    {
        var result = ValueParser.FormatMethodNameWithValues(
            "Adding_numbers_works", 
            new Dictionary<string, object?>());
        
        Assert.Equal("Adding numbers works", result);
    }

    [Rule("ALLCAPS placeholders are replaced with values")]
    public void Allcaps_placeholders_are_replaced()
    {
        var values = new Dictionary<string, object?> { ["a"] = 5, ["b"] = 3 };
        var result = ValueParser.FormatMethodNameWithValues(
            "Adding_A_and_B", 
            values);
        
        Assert.Equal("Adding 5 and 3", result);
    }

    [Rule("Case-insensitive placeholder matching")]
    public void Case_insensitive_placeholder_matching()
    {
        var values = new Dictionary<string, object?> { ["MyParam"] = "test" };
        var result = ValueParser.FormatMethodNameWithValues(
            "Value_is_MYPARAM", 
            values);
        
        Assert.Equal("Value is test", result);
    }

    [Rule("Unmatched placeholders remain as spaces")]
    public void Unmatched_placeholders_remain_as_spaces()
    {
        var values = new Dictionary<string, object?>();
        var result = ValueParser.FormatMethodNameWithValues(
            "Value_is_UNKNOWN", 
            values);
        
        // UNKNOWN has no match, so just converted to space
        Assert.Equal("Value is UNKNOWN", result);
    }

    [RuleOutline]
    [Example("Simple_test", "Simple test")]
    [Example("Adding_A_and_B", "Adding 1 and 2")]
    [Example("Result_is_EXPECTED", "Result is 3")]
    public void Method_name_formatting_EXPECTED(string methodName, string expected)
    {
        var values = new Dictionary<string, object?> 
        { 
            ["a"] = 1, 
            ["b"] = 2, 
            ["expected"] = 3 
        };
        var result = ValueParser.FormatMethodNameWithValues(methodName, values);
        Assert.Equal(expected, result);
    }

    #endregion
}
