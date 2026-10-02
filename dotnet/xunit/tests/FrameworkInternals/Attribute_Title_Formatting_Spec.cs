using System.Reflection;
using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.FrameworkInternals;

[Specification("Attribute Title Formatting", Description = @"
    Titles supplied through nameof use identifier formatting, while authored
    literal titles preserve meaningful underscores.")]
[Tag("attributes")]
public class Attribute_Title_Formatting_Spec : SpecificationTest
{
    public Attribute_Title_Formatting_Spec(ITestOutputHelper output) : base(output) { }

    [Rule("nameof titles replace underscores for Feature, Specification, Scenario, ScenarioOutline, Rule, and RuleOutline")]
    public void Nameof_titles_replace_underscores()
    {
        Assert.Equal(
            "My feature name is a description",
            GetClassAttribute<FeatureAttribute>(typeof(My_feature_name_is_a_description))
                .GetDisplayName(typeof(My_feature_name_is_a_description)));
        Assert.Equal(
            "My specification name is a description",
            GetClassAttribute<SpecificationAttribute>(typeof(My_specification_name_is_a_description))
                .GetDisplayName(typeof(My_specification_name_is_a_description)));

        var scenarioMethod = GetMethod(nameof(NameofMethodFixtures.My_scenario_name_is_a_description));
        Assert.Equal(
            "Scenario: My scenario name is a description",
            GetMethodAttribute<ScenarioAttribute>(scenarioMethod).DisplayName);

        var scenarioOutlineMethod = GetMethod(nameof(NameofMethodFixtures.My_scenario_outline_name_is_a_description));
        Assert.Equal(
            "Scenario Outline: My scenario outline name is a description",
            GetMethodAttribute<ScenarioOutlineAttribute>(scenarioOutlineMethod).DisplayName);

        var ruleMethod = GetMethod(nameof(NameofMethodFixtures.My_rule_name_is_a_description));
        Assert.Equal(
            "My rule name is a description",
            GetMethodAttribute<RuleAttribute>(ruleMethod).GetDisplayName(ruleMethod));

        var ruleOutlineMethod = GetMethod(nameof(NameofMethodFixtures.My_rule_outline_name_is_a_description));
        Assert.Equal(
            "My rule outline name is a description",
            GetMethodAttribute<RuleOutlineAttribute>(ruleOutlineMethod)
                .GetDisplayName(
                    ruleOutlineMethod,
                    new Dictionary<string, object?>()));

        var parameterizedOutlineMethod = GetMethod(
            nameof(NameofMethodFixtures.Dividing_A_by_B_equals_EXPECTED));
        Assert.Null(
            GetMethodAttribute<RuleOutlineAttribute>(parameterizedOutlineMethod)
                .GetTitleTemplate(parameterizedOutlineMethod));
    }

    [Rule("Literal title 'LIVEDOC_RUN_TYPE' preserves underscores for every declaration attribute")]
    public void Literal_titles_preserve_underscores()
    {
        var expected = Rule.Values[0].AsString();

        Assert.Equal(
            expected,
            GetClassAttribute<FeatureAttribute>(typeof(Literal_feature_title))
                .GetDisplayName(typeof(Literal_feature_title)));
        Assert.Equal(
            expected,
            GetClassAttribute<SpecificationAttribute>(typeof(Literal_specification_title))
                .GetDisplayName(typeof(Literal_specification_title)));

        var scenarioMethod = GetMethod(nameof(LiteralMethodFixtures.Scenario_title));
        Assert.Equal(
            $"Scenario: {expected}",
            GetMethodAttribute<ScenarioAttribute>(scenarioMethod).DisplayName);

        var scenarioOutlineMethod = GetMethod(nameof(LiteralMethodFixtures.Scenario_outline_title));
        Assert.Equal(
            $"Scenario Outline: {expected}",
            GetMethodAttribute<ScenarioOutlineAttribute>(scenarioOutlineMethod).DisplayName);

        var ruleMethod = GetMethod(nameof(LiteralMethodFixtures.Rule_title));
        Assert.Equal(
            expected,
            GetMethodAttribute<RuleAttribute>(ruleMethod).GetDisplayName(ruleMethod));

        var ruleOutlineMethod = GetMethod(nameof(LiteralMethodFixtures.Rule_outline_title));
        Assert.Equal(
            expected,
            GetMethodAttribute<RuleOutlineAttribute>(ruleOutlineMethod)
                .GetTitleTemplate(ruleOutlineMethod));
    }

    private static T GetClassAttribute<T>(Type type) where T : Attribute =>
        type.GetCustomAttribute<T>()!;

    private static MethodInfo GetMethod(string name) =>
        typeof(NameofMethodFixtures).GetMethod(name) ??
        typeof(LiteralMethodFixtures).GetMethod(name) ??
        throw new InvalidOperationException($"Method '{name}' was not found.");

    private static T GetMethodAttribute<T>(MethodInfo method) where T : Attribute =>
        method.GetCustomAttribute<T>()!;

#pragma warning disable xUnit1000, xUnit1003, xUnit1006, xUnit1026 // Reflection-only attribute fixtures.
    [Feature(nameof(My_feature_name_is_a_description))]
    private sealed class My_feature_name_is_a_description { }

    [Specification(nameof(My_specification_name_is_a_description))]
    private sealed class My_specification_name_is_a_description { }

    [Feature("LIVEDOC_RUN_TYPE")]
    private sealed class Literal_feature_title { }

    [Specification("LIVEDOC_RUN_TYPE")]
    private sealed class Literal_specification_title { }

    private sealed class NameofMethodFixtures
    {
        [Scenario(nameof(My_scenario_name_is_a_description))]
        public void My_scenario_name_is_a_description() { }

        [ScenarioOutline(nameof(My_scenario_outline_name_is_a_description))]
        public void My_scenario_outline_name_is_a_description() { }

        [Rule(nameof(My_rule_name_is_a_description))]
        public void My_rule_name_is_a_description() { }

        [RuleOutline(nameof(My_rule_outline_name_is_a_description))]
        public void My_rule_outline_name_is_a_description() { }

        [RuleOutline(nameof(Dividing_A_by_B_equals_EXPECTED))]
        public void Dividing_A_by_B_equals_EXPECTED(int a, int b, int expected) { }
    }

    private sealed class LiteralMethodFixtures
    {
        [Scenario("LIVEDOC_RUN_TYPE")]
        public void Scenario_title() { }

        [ScenarioOutline("LIVEDOC_RUN_TYPE")]
        public void Scenario_outline_title() { }

        [Rule("LIVEDOC_RUN_TYPE")]
        public void Rule_title() { }

        [RuleOutline("LIVEDOC_RUN_TYPE")]
        public void Rule_outline_title() { }
    }
#pragma warning restore xUnit1000, xUnit1003, xUnit1006, xUnit1026
}
