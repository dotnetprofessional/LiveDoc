using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// Specification: Method Name Placeholders
/// 
/// Tests for the _ALLCAPS placeholder syntax in method names.
/// When no explicit description is provided, the method name
/// is used with placeholders replaced by parameter values.
/// </summary>
[Specification(Description = @"
    Method names can contain _ALLCAPS placeholders that are replaced
    with parameter values at runtime. This provides self-documenting
    test names without requiring explicit description attributes.
    
    Rules:
    - ALLCAPS segments are matched to parameter names (case-insensitive)
    - Underscores are converted to spaces after placeholder replacement
    - Unmatched placeholders remain as-is
")]
public class Method_Name_Placeholders_Spec : SpecificationTest
{
    public Method_Name_Placeholders_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Basic Placeholder Replacement

    [RuleOutline]
    [Example(5, 3, 8)]
    [Example(10, 20, 30)]
    [Example(0, 0, 0)]
    public void Adding_A_and_B_returns_RESULT(int a, int b, int result)
    {
        // Method name: "Adding_A_and_B_returns_RESULT"
        // With a=5, b=3, result=8 → "Adding 5 and 3 returns 8"
        Assert.Equal(result, a + b);
    }

    [RuleOutline]
    [Example(10, 2, 5)]
    [Example(100, 4, 25)]
    public void Dividing_DIVIDEND_by_DIVISOR_equals_QUOTIENT(int dividend, int divisor, int quotient)
    {
        Assert.Equal(quotient, dividend / divisor);
    }

    [RuleOutline]
    [Example("hello", 5)]
    [Example("", 0)]
    [Example("test", 4)]
    public void Length_of_STR_is_LEN(string str, int len)
    {
        Assert.Equal(len, str.Length);
    }

    #endregion

    #region Single Placeholder

    [RuleOutline]
    [Example(0, true)]
    [Example(1, false)]
    [Example(-1, false)]
    public void VALUE_is_zero(int value, bool expected)
    {
        Assert.Equal(expected, value == 0);
    }

    [RuleOutline]
    [Example("", true)]
    [Example("a", false)]
    [Example("hello", false)]
    public void STRING_is_empty(string @string, bool expected)
    {
        Assert.Equal(expected, string.IsNullOrEmpty(@string));
    }

    #endregion

    #region Multiple Same-Type Placeholders

    [RuleOutline]
    [Example(5, 3, true)]
    [Example(3, 5, false)]
    [Example(5, 5, false)]
    public void LEFT_is_greater_than_RIGHT(int left, int right, bool expected)
    {
        Assert.Equal(expected, left > right);
    }

    [RuleOutline]
    [Example("abc", "abc", true)]
    [Example("abc", "ABC", false)]
    [Example("", "", true)]
    public void FIRST_equals_SECOND(string first, string second, bool expected)
    {
        Assert.Equal(expected, first == second);
    }

    #endregion

    #region Trailing Placeholder

    [RuleOutline]
    [Example(5, 25)]
    [Example(10, 100)]
    [Example(0, 0)]
    public void Square_of_N_is_RESULT(int n, int result)
    {
        Assert.Equal(result, n * n);
    }

    [RuleOutline]
    [Example(8, 2)]
    [Example(27, 3)]
    [Example(1, 1)]
    public void Cube_root_of_N_is_RESULT(int n, int result)
    {
        Assert.Equal(result, (int)Math.Cbrt(n));
    }

    #endregion

    #region Leading Placeholder

    [RuleOutline]
    [Example(100, 50)]
    [Example(50, 25)]
    public void TOTAL_split_in_half_is_RESULT(int total, int result)
    {
        Assert.Equal(result, total / 2);
    }

    #endregion

    #region Mixed Case Matching

    [RuleOutline]
    [Example("hello", "HELLO")]
    [Example("World", "WORLD")]
    public void Converting_INPUT_to_uppercase_returns_EXPECTED(string input, string expected)
    {
        // Parameter names: input, expected
        // Placeholders: INPUT, EXPECTED
        // Should match case-insensitively
        Assert.Equal(expected, input.ToUpperInvariant());
    }

    #endregion

    #region No Placeholders

    [RuleOutline]
    [Example(1, 2)]
    [Example(3, 4)]
    public void Simple_method_name_without_placeholders(int a, int b)
    {
        // Method name has no ALLCAPS segments
        // Should just convert underscores to spaces
        Assert.True(a < b);
    }

    #endregion
}

/// <summary>
/// Additional placeholder edge cases.
/// </summary>
[Specification]
public class Placeholder_Edge_Cases_Spec : SpecificationTest
{
    public Placeholder_Edge_Cases_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [RuleOutline]
    [Example(true, "yes")]
    [Example(false, "no")]
    public void Boolean_FLAG_outputs_LABEL(bool flag, string label)
    {
        var result = flag ? "yes" : "no";
        Assert.Equal(label, result);
    }

    [RuleOutline]
    [Example(3.14, "3.14")]
    [Example(2.718, "2.718")]
    public void Double_VALUE_as_string_is_EXPECTED(double value, string expected)
    {
        Assert.Equal(expected, value.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }
}
