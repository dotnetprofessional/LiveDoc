using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "PropertyRules.Find() resolves rules by direct name, wildcard (*.name), full path, and parent.name — all case-insensitive.")]
public class PropertyRules_Find_Spec : SpecificationTest
{
    public PropertyRules_Find_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Find matching strategies

    [Rule("Direct name match returns the rule")]
    public void Direct_name_match()
    {
        var rules = BuildRules(MakeRule("id"));

        var found = rules.Find("id", "user");

        Assert.NotNull(found);
        Assert.Equal("id", found!.PropertyName);
    }

    [Rule("Wildcard '*.name' matches a property at any path")]
    public void Wildcard_match()
    {
        var rules = BuildRules(MakeRule("*.createdAt"));

        var found = rules.Find("createdAt", "user.profile");

        Assert.NotNull(found);
        Assert.Equal("*.createdAt", found!.PropertyName);
    }

    [Rule("Full path match returns the rule for an exact path")]
    public void Full_path_match()
    {
        var rules = BuildRules(MakeRule("user.address.city"));

        var found = rules.Find("city", "user.address");

        Assert.NotNull(found);
        Assert.Equal("user.address.city", found!.PropertyName);
    }

    [Rule("Parent.name match returns the rule when parent segment matches")]
    public void Parent_name_match()
    {
        var rules = BuildRules(MakeRule("address.city"));

        var found = rules.Find("city", "root.address");

        Assert.NotNull(found);
        Assert.Equal("address.city", found!.PropertyName);
    }

    [Rule("No match returns null")]
    public void No_match_returns_null()
    {
        var rules = BuildRules(MakeRule("id"));

        var found = rules.Find("unknownProp", "some.path");

        Assert.Null(found);
    }

    #endregion

    #region Case sensitivity and precedence

    [Rule("Find is case-insensitive")]
    public void Case_insensitive()
    {
        var rules = BuildRules(MakeRule("ID"));

        var found = rules.Find("id", "");

        Assert.NotNull(found);
        Assert.Equal("ID", found!.PropertyName);
    }

    [Rule("Direct name takes precedence over wildcard when both exist")]
    public void Direct_beats_wildcard()
    {
        var directRule = new PropertyRule("id", IsIgnore: false,
            Assertions: [new Assertion(AssertionKind.TypeCheck, TypeName: "number")]);
        var wildcardRule = new PropertyRule("*.id", IsIgnore: false,
            Assertions: [new Assertion(AssertionKind.TypeCheck, TypeName: "string")]);
        var rules = BuildRules(directRule, wildcardRule);

        var found = rules.Find("id", "user");

        Assert.NotNull(found);
        Assert.Equal("id", found!.PropertyName);
        Assert.Equal("number", found.Assertions[0].TypeName);
    }

    #endregion

    #region ToIgnoreSet

    [Rule("ToIgnoreSet returns only pure-ignore property names")]
    public void To_ignore_set()
    {
        var ignoreRule = new PropertyRule("api_key", IsIgnore: true, Assertions: []);
        var assertionRule = MakeRule("id");
        var rules = BuildRules(ignoreRule, assertionRule);

        var ignoreSet = rules.ToIgnoreSet();

        Assert.Single(ignoreSet);
        Assert.Contains("api_key", ignoreSet);
        Assert.DoesNotContain("id", ignoreSet);
    }

    #endregion

    #region Helpers

    private static PropertyRule MakeRule(string name) =>
        new(name, IsIgnore: false,
            Assertions: [new Assertion(AssertionKind.Exists)]);

    private static PropertyRules BuildRules(params PropertyRule[] rules) =>
        new(rules);

    #endregion
}
