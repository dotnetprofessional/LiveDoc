using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "PropertyRules parsing: Load() reads rule files, classifies bare names as ignores vs assertion rules, and supports exists/type/comparisons/length/matches assertions.")]
public class PropertyRules_Parse_Spec : SpecificationTest
{
    public PropertyRules_Parse_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Bare names and simple assertions

    [Rule("Bare name line creates an ignore rule with no assertions")]
    public void Bare_name_creates_ignore_rule()
    {
        var rules = LoadFromContent("api_key");
        var rule = rules.Find("api_key", "");

        Assert.NotNull(rule);
        Assert.True(rule!.IsIgnore);
        Assert.Empty(rule.Assertions);
    }

    [Rule("'exists' assertion produces an Exists kind")]
    public void Exists_assertion()
    {
        var rules = LoadFromContent("id: exists");
        var rule = rules.Find("id", "");

        Assert.NotNull(rule);
        Assert.False(rule!.IsIgnore);
        Assert.Single(rule.Assertions);
        Assert.Equal(AssertionKind.Exists, rule.Assertions[0].Kind);
    }

    [Rule("'type string' assertion sets TypeName to 'string'")]
    public void Type_string_assertion()
    {
        var rules = LoadFromContent("name: type string");
        var rule = rules.Find("name", "");

        Assert.NotNull(rule);
        Assert.Single(rule!.Assertions);
        Assert.Equal(AssertionKind.TypeCheck, rule.Assertions[0].Kind);
        Assert.Equal("string", rule.Assertions[0].TypeName);
    }

    [Rule("'type number' assertion sets TypeName to 'number'")]
    public void Type_number_assertion()
    {
        var rules = LoadFromContent("amount: type number");
        var rule = rules.Find("amount", "");

        Assert.NotNull(rule);
        Assert.Single(rule!.Assertions);
        Assert.Equal(AssertionKind.TypeCheck, rule.Assertions[0].Kind);
        Assert.Equal("number", rule.Assertions[0].TypeName);
    }

    [Rule("Invalid type name throws PropertyRuleParseException")]
    public void Invalid_type_throws()
    {
        var ex = Assert.Throws<PropertyRuleParseException>(
            () => LoadFromContent("x: type foobar"));

        Assert.Contains("unknown type", ex.Message);
        Assert.Contains("foobar", ex.Message);
    }

    #endregion

    #region Numeric comparisons

    [Rule("'> 100' parses as NumericComparison with operator '>' and threshold '100'")]
    public void Greater_than_comparison()
    {
        var rules = LoadFromContent("score: > 100");
        var rule = rules.Find("score", "")!;

        Assert.Equal(AssertionKind.NumericComparison, rule.Assertions[0].Kind);
        Assert.Equal(">", rule.Assertions[0].Operator);
        Assert.Equal(100m, rule.Assertions[0].Threshold);
    }

    [Rule("'>= 0' parses as NumericComparison with operator '>=' and threshold '0'")]
    public void Greater_than_or_equal_comparison()
    {
        var rules = LoadFromContent("count: >= 0");
        var rule = rules.Find("count", "")!;

        Assert.Equal(AssertionKind.NumericComparison, rule.Assertions[0].Kind);
        Assert.Equal(">=", rule.Assertions[0].Operator);
        Assert.Equal(0m, rule.Assertions[0].Threshold);
    }

    [Rule("'< 1000' parses as NumericComparison with operator '<' and threshold '1000'")]
    public void Less_than_comparison()
    {
        var rules = LoadFromContent("price: < 1000");
        var rule = rules.Find("price", "")!;

        Assert.Equal(AssertionKind.NumericComparison, rule.Assertions[0].Kind);
        Assert.Equal("<", rule.Assertions[0].Operator);
        Assert.Equal(1000m, rule.Assertions[0].Threshold);
    }

    [Rule("'<= 50' parses as NumericComparison with operator '<=' and threshold '50'")]
    public void Less_than_or_equal_comparison()
    {
        var rules = LoadFromContent("age: <= 50");
        var rule = rules.Find("age", "")!;

        Assert.Equal(AssertionKind.NumericComparison, rule.Assertions[0].Kind);
        Assert.Equal("<=", rule.Assertions[0].Operator);
        Assert.Equal(50m, rule.Assertions[0].Threshold);
    }

    #endregion

    #region Length and matches

    [Rule("'length > 5' parses as LengthCheck with operator '>' and threshold '5'")]
    public void Length_check()
    {
        var rules = LoadFromContent("token: length > 5");
        var rule = rules.Find("token", "")!;

        Assert.Equal(AssertionKind.LengthCheck, rule.Assertions[0].Kind);
        Assert.Equal(">", rule.Assertions[0].Operator);
        Assert.Equal(5m, rule.Assertions[0].Threshold);
    }

    [Rule("'matches ^[A-Z].*' parses as Matches kind with the regex pattern")]
    public void Matches_regex()
    {
        var rules = LoadFromContent("code: matches ^[A-Z].*");
        var rule = rules.Find("code", "")!;

        Assert.Equal(AssertionKind.Matches, rule.Assertions[0].Kind);
        Assert.Equal("^[A-Z].*", rule.Assertions[0].Pattern);
    }

    [Rule("Invalid regex pattern throws PropertyRuleParseException")]
    public void Invalid_regex_throws()
    {
        var ex = Assert.Throws<PropertyRuleParseException>(
            () => LoadFromContent("code: matches [invalid("));

        Assert.Contains("invalid regex", ex.Message);
    }

    #endregion

    #region Comma-separated assertions

    [Rule("Multiple comma-separated assertions produce multiple assertion objects")]
    public void Multiple_assertions()
    {
        var rules = LoadFromContent("total: type number, >= 0");
        var rule = rules.Find("total", "")!;

        Assert.False(rule.IsIgnore);
        Assert.Equal(2, rule.Assertions.Count);
        Assert.Equal(AssertionKind.TypeCheck, rule.Assertions[0].Kind);
        Assert.Equal("number", rule.Assertions[0].TypeName);
        Assert.Equal(AssertionKind.NumericComparison, rule.Assertions[1].Kind);
        Assert.Equal(">=", rule.Assertions[1].Operator);
        Assert.Equal(0m, rule.Assertions[1].Threshold);
    }

    #endregion

    #region Load from file

    [Rule("Comments and blank lines are skipped when loading a rules file")]
    public void Comments_and_blanks_skipped()
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path,
                "# This is a comment\n" +
                "\n" +
                "id: exists\n" +
                "\n" +
                "# Another comment\n" +
                "name: type string\n");

            var rules = PropertyRules.Load(path);

            Assert.NotNull(rules.Find("id", ""));
            Assert.Equal(AssertionKind.Exists, rules.Find("id", "")!.Assertions[0].Kind);
            Assert.NotNull(rules.Find("name", ""));
            Assert.Equal(AssertionKind.TypeCheck, rules.Find("name", "")!.Assertions[0].Kind);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Rule("Load from a missing file returns PropertyRules.Empty")]
    public void Missing_file_returns_empty()
    {
        var result = PropertyRules.Load(Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".txt"));

        Assert.Same(PropertyRules.Empty, result);
    }

    [Rule("Load and merge two files — later file overrides same property name")]
    public void Merge_two_files()
    {
        var path1 = Path.GetTempFileName();
        var path2 = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path1, "id: exists\ntoken: type string");
            File.WriteAllText(path2, "id: type number");

            var rules = PropertyRules.Load(path1, path2);

            var idRule = rules.Find("id", "");
            Assert.NotNull(idRule);
            Assert.Equal(AssertionKind.TypeCheck, idRule!.Assertions[0].Kind);
            Assert.Equal("number", idRule.Assertions[0].TypeName);

            Assert.NotNull(rules.Find("token", ""));
        }
        finally
        {
            File.Delete(path1);
            File.Delete(path2);
        }
    }

    [Rule("Empty assertion after colon throws PropertyRuleParseException")]
    public void Empty_assertion_after_colon_throws()
    {
        var ex = Assert.Throws<PropertyRuleParseException>(
            () => LoadFromContent("name:"));

        Assert.Contains("empty assertion", ex.Message);
    }

    #endregion

    #region Helpers

    /// <summary>Writes content to a temp file, loads it, and cleans up.</summary>
    private static PropertyRules LoadFromContent(string content)
    {
        var path = Path.GetTempFileName();
        try
        {
            File.WriteAllText(path, content);
            return PropertyRules.Load(path);
        }
        finally
        {
            File.Delete(path);
        }
    }

    #endregion
}
