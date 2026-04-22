using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Validation;

/// <summary>
/// Specification: Violation Detection
/// 
/// Negative tests that verify the validator correctly detects each violation
/// by running it against intentionally-invalid fixture classes. Each rule is
/// a "negative test case" — it asserts that a violation IS produced.
/// </summary>
[Specification("Violation Detection", Description = @"
    Validates that LiveDocParadigmValidator correctly detects every violation
    type when presented with intentionally-invalid test class configurations.
    Uses the public Type-based API for direct, in-process validation.")]
public class Violation_Detection_Spec : SpecificationTest
{
    public Violation_Detection_Spec(ITestOutputHelper output) : base(output) { }

    #region Gherkin Violations

    [Rule("Scenario without Feature produces ScenarioWithoutFeature violation")]
    public void Scenario_without_Feature()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_NoAttributes), "SomeScenario");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.ScenarioWithoutFeature, violation.ViolationType);
        Assert.Contains("[Feature]", violation.Message);
    }

    [Rule("ScenarioOutline without Feature produces ScenarioWithoutFeature violation")]
    public void ScenarioOutline_without_Feature()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_NoAttributes), "SomeOutline", "ScenarioOutline");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.ScenarioWithoutFeature, violation.ViolationType);
        Assert.Contains("ScenarioOutline", violation.Message);
    }

    [Rule("Scenario in Specification class produces ScenarioInSpecification violation")]
    public void Scenario_in_Specification()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_SpecificationOnly), "SomeScenario");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.ScenarioInSpecification, violation.ViolationType);
        Assert.Contains("[Rule]", violation.Message);
    }

    [Rule("Feature without title produces FeatureMissingTitle violation")]
    public void Feature_without_title()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_FeatureNoTitle), "SomeScenario");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.FeatureMissingTitle, violation.ViolationType);
        Assert.Contains("[Feature(\"My Feature Name\")]", violation.Message);
    }

    [Rule("Feature with empty string title produces FeatureMissingTitle violation")]
    public void Feature_with_empty_title()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_FeatureEmptyTitle), "SomeScenario");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.FeatureMissingTitle, violation.ViolationType);
    }

    [Rule("Feature with Description but no title produces FeatureMissingTitle violation")]
    public void Feature_with_description_only()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_FeatureDescriptionOnly), "SomeScenario");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.FeatureMissingTitle, violation.ViolationType);
    }

    [Rule("Feature with valid title produces no violation")]
    public void Feature_with_valid_title()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_FeatureValidTitle), "SomeScenario");

        Assert.Null(violation);
    }

    #endregion

    #region Specification Violations

    [Rule("Rule without Specification produces RuleWithoutSpecification violation")]
    public void Rule_without_Specification()
    {
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(
            typeof(Violation_NoAttributes), "SomeRule");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.RuleWithoutSpecification, violation.ViolationType);
        Assert.Contains("[Specification]", violation.Message);
    }

    [Rule("RuleOutline without Specification produces RuleWithoutSpecification violation")]
    public void RuleOutline_without_Specification()
    {
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(
            typeof(Violation_NoAttributes), "SomeOutline", "RuleOutline");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.RuleWithoutSpecification, violation.ViolationType);
        Assert.Contains("RuleOutline", violation.Message);
    }

    [Rule("Rule in Feature class produces RuleInFeature violation")]
    public void Rule_in_Feature()
    {
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(
            typeof(Violation_FeatureValidTitle), "SomeRule");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.RuleInFeature, violation.ViolationType);
        Assert.Contains("[Scenario]", violation.Message);
    }

    [Rule("Specification with valid title produces no violation")]
    public void Specification_valid()
    {
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(
            typeof(Violation_SpecificationOnly), "SomeRule");

        Assert.Null(violation);
    }

    #endregion

    #region Mixed Paradigm Violations

    [Rule("Mixed attributes detected from Gherkin validation")]
    public void Mixed_from_Gherkin()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_MixedAttributes), "SomeScenario");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.MixedClassAttributes, violation.ViolationType);
        Assert.Contains("cannot have both", violation.Message);
    }

    [Rule("Mixed attributes detected from Specification validation")]
    public void Mixed_from_Specification()
    {
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(
            typeof(Violation_MixedAttributes), "SomeRule");

        Assert.NotNull(violation);
        Assert.Equal(ViolationType.MixedClassAttributes, violation.ViolationType);
    }

    #endregion

    #region Violation Properties

    [Rule("Violation includes the test class name")]
    public void Violation_includes_class_name()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_NoAttributes), "MyMethod");

        Assert.NotNull(violation);
        Assert.Equal("Violation_NoAttributes", violation.TestClass);
    }

    [Rule("Violation includes the test method name")]
    public void Violation_includes_method_name()
    {
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(
            typeof(Violation_NoAttributes), "MyMethod");

        Assert.NotNull(violation);
        Assert.Equal("MyMethod", violation.TestMethod);
    }

    #endregion
}

// ── Violation Fixture Classes ──────────────────────────────────────
// These are intentionally-invalid configurations used ONLY as Type
// references for the validator. They have no test methods, so xUnit
// will not discover or run them.

public class Violation_NoAttributes { }

[Feature]
public class Violation_FeatureNoTitle { }

[Feature("")]
public class Violation_FeatureEmptyTitle { }

[Feature(Description = "Has description but no title")]
public class Violation_FeatureDescriptionOnly { }

[Feature("Valid Feature Title")]
public class Violation_FeatureValidTitle { }

[Specification("Valid Specification")]
public class Violation_SpecificationOnly { }

[Feature("Mixed")]
[Specification("Mixed")]
public class Violation_MixedAttributes { }
