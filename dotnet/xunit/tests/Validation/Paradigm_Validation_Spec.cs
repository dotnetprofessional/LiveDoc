using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Validation;

/// <summary>
/// Specification: Paradigm Validation
/// 
/// Tests that verify LiveDoc correctly detects and reports paradigm violations.
/// These tests validate the violation detection system itself.
/// </summary>
[Specification(Description = @"
    LiveDoc enforces paradigm rules: [Scenario] must be inside [Feature],
    [Rule] must be inside [Specification], and a class cannot mix both.
    Violations produce actionable error messages with fix suggestions.")]
public class Paradigm_Validation_Spec : SpecificationTest
{
    public Paradigm_Validation_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Violation Types

    [Rule("ViolationType enum includes ScenarioWithoutFeature")]
    public void ViolationType_includes_ScenarioWithoutFeature()
    {
        Assert.True(Enum.IsDefined(typeof(ViolationType), ViolationType.ScenarioWithoutFeature));
    }

    [Rule("ViolationType enum includes RuleWithoutSpecification")]
    public void ViolationType_includes_RuleWithoutSpecification()
    {
        Assert.True(Enum.IsDefined(typeof(ViolationType), ViolationType.RuleWithoutSpecification));
    }

    [Rule("ViolationType enum includes ScenarioInSpecification")]
    public void ViolationType_includes_ScenarioInSpecification()
    {
        Assert.True(Enum.IsDefined(typeof(ViolationType), ViolationType.ScenarioInSpecification));
    }

    [Rule("ViolationType enum includes RuleInFeature")]
    public void ViolationType_includes_RuleInFeature()
    {
        Assert.True(Enum.IsDefined(typeof(ViolationType), ViolationType.RuleInFeature));
    }

    [Rule("ViolationType enum includes MixedClassAttributes")]
    public void ViolationType_includes_MixedClassAttributes()
    {
        Assert.True(Enum.IsDefined(typeof(ViolationType), ViolationType.MixedClassAttributes));
    }

    #endregion

    #region Violation Messages

    [Rule("ScenarioWithoutFeature violation has helpful message")]
    public void ScenarioWithoutFeature_has_helpful_message()
    {
        var violation = LiveDocViolationException.ScenarioWithoutFeature("TestClass", "TestMethod");
        
        Assert.Contains("Scenario must be within a Feature", violation.Message);
        Assert.Contains("[Feature]", violation.Message);
        Assert.Contains("[Rule]", violation.Message);
    }

    [Rule("ScenarioInSpecification violation suggests Rule")]
    public void ScenarioInSpecification_suggests_Rule()
    {
        var violation = LiveDocViolationException.ScenarioInSpecification("TestClass", "TestMethod");
        
        Assert.Contains("[Specification]", violation.Message);
        Assert.Contains("[Rule]", violation.Message);
        Assert.Contains("Did you mean", violation.Message);
    }

    [Rule("RuleWithoutSpecification violation has helpful message")]
    public void RuleWithoutSpecification_has_helpful_message()
    {
        var violation = LiveDocViolationException.RuleWithoutSpecification("TestClass", "TestMethod");
        
        Assert.Contains("Rule must be within a Specification", violation.Message);
        Assert.Contains("[Specification]", violation.Message);
        Assert.Contains("[Scenario]", violation.Message);
    }

    [Rule("RuleInFeature violation suggests Scenario")]
    public void RuleInFeature_suggests_Scenario()
    {
        var violation = LiveDocViolationException.RuleInFeature("TestClass", "TestMethod");
        
        Assert.Contains("[Feature]", violation.Message);
        Assert.Contains("[Scenario]", violation.Message);
        Assert.Contains("Did you mean", violation.Message);
    }

    [Rule("MixedClassAttributes violation is clear")]
    public void MixedClassAttributes_is_clear()
    {
        var violation = LiveDocViolationException.MixedClassAttributes("TestClass");
        
        Assert.Contains("[Feature]", violation.Message);
        Assert.Contains("[Specification]", violation.Message);
        Assert.Contains("cannot have both", violation.Message);
    }

    #endregion

    #region Violation Properties

    [Rule("Violation exception includes test class name")]
    public void Violation_includes_class_name()
    {
        var violation = LiveDocViolationException.ScenarioWithoutFeature("MyTestClass", "MyTestMethod");
        
        Assert.Equal("MyTestClass", violation.TestClass);
    }

    [Rule("Violation exception includes test method name")]
    public void Violation_includes_method_name()
    {
        var violation = LiveDocViolationException.ScenarioWithoutFeature("MyTestClass", "MyTestMethod");
        
        Assert.Equal("MyTestMethod", violation.TestMethod);
    }

    [Rule("Violation exception includes violation type")]
    public void Violation_includes_type()
    {
        var violation = LiveDocViolationException.ScenarioWithoutFeature("TestClass", "TestMethod");
        
        Assert.Equal(ViolationType.ScenarioWithoutFeature, violation.ViolationType);
    }

    #endregion
}
