using System.Reflection;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Helper class for validating LiveDoc paradigm usage at test discovery time.
/// </summary>
internal static class LiveDocParadigmValidator
{
    /// <summary>
    /// Validates that a Scenario or ScenarioOutline is used correctly.
    /// </summary>
    /// <param name="testMethod">The test method being discovered.</param>
    /// <param name="attributeName">The attribute name for error messages.</param>
    /// <returns>A violation exception if invalid, null if valid.</returns>
    public static LiveDocViolationException? ValidateGherkinMethod(ITestMethod testMethod, string attributeName)
    {
        var testClass = testMethod.TestClass.Class;
        var className = testClass.Name;
        var methodName = testMethod.Method.Name;

        var hasFeature = testClass.GetCustomAttributes(typeof(FeatureAttribute)).Any();
        var hasSpecification = testClass.GetCustomAttributes(typeof(SpecificationAttribute)).Any();

        // Check for mixed paradigms — both [Feature] and [Specification]
        if (hasFeature && hasSpecification)
            return LiveDocViolationException.MixedClassAttributes(className);

        // Check for [Specification] on the class - invalid for Gherkin methods
        if (hasSpecification)
        {
            return attributeName == "ScenarioOutline"
                ? LiveDocViolationException.ScenarioOutlineInSpecification(className, methodName)
                : LiveDocViolationException.ScenarioInSpecification(className, methodName);
        }

        // Check for [Feature] on the class - required for Gherkin methods
        if (!hasFeature)
        {
            return attributeName == "ScenarioOutline"
                ? LiveDocViolationException.ScenarioOutlineWithoutFeature(className, methodName)
                : LiveDocViolationException.ScenarioWithoutFeature(className, methodName);
        }

        // Check that [Feature] has an explicit title
        var featureAttr = testClass.GetCustomAttributes(typeof(FeatureAttribute)).First();
        if (!HasExplicitFeatureTitle(featureAttr))
            return LiveDocViolationException.FeatureMissingTitle(className, methodName);

        return null; // Valid
    }

    /// <summary>
    /// Validates that a Rule or RuleOutline is used correctly.
    /// </summary>
    /// <param name="testMethod">The test method being discovered.</param>
    /// <param name="attributeName">The attribute name for error messages.</param>
    /// <returns>A violation exception if invalid, null if valid.</returns>
    public static LiveDocViolationException? ValidateSpecificationMethod(ITestMethod testMethod, string attributeName)
    {
        var testClass = testMethod.TestClass.Class;
        var className = testClass.Name;
        var methodName = testMethod.Method.Name;

        var hasFeature = testClass.GetCustomAttributes(typeof(FeatureAttribute)).Any();
        var hasSpecification = testClass.GetCustomAttributes(typeof(SpecificationAttribute)).Any();

        // Check for mixed paradigms — both [Feature] and [Specification]
        if (hasFeature && hasSpecification)
            return LiveDocViolationException.MixedClassAttributes(className);

        // Check for [Feature] on the class - invalid for Specification methods
        if (hasFeature)
        {
            return attributeName == "RuleOutline"
                ? LiveDocViolationException.RuleOutlineInFeature(className, methodName)
                : LiveDocViolationException.RuleInFeature(className, methodName);
        }

        // Check for [Specification] on the class - required for Specification methods
        if (!hasSpecification)
        {
            return attributeName == "RuleOutline"
                ? LiveDocViolationException.RuleOutlineWithoutSpecification(className, methodName)
                : LiveDocViolationException.RuleWithoutSpecification(className, methodName);
        }

        return null; // Valid
    }

    /// <summary>
    /// Creates a failing test case that reports a violation.
    /// </summary>
    public static IXunitTestCase CreateViolationTestCase(
        IMessageSink diagnosticMessageSink,
        ITestMethod testMethod,
        LiveDocViolationException violation)
    {
        return new ExecutionErrorTestCase(
            diagnosticMessageSink,
            TestMethodDisplay.Method,
            TestMethodDisplayOptions.None,
            testMethod,
            violation.Message);
    }

    /// <summary>
    /// Checks whether a FeatureAttribute has an explicit (non-empty) title.
    /// </summary>
    private static bool HasExplicitFeatureTitle(IAttributeInfo featureAttr)
    {
        // Check constructor argument: [Feature("Title")]
        var ctorArgs = featureAttr.GetConstructorArguments().ToList();
        var name = ctorArgs.Count > 0 ? ctorArgs[0] as string : null;
        if (!string.IsNullOrWhiteSpace(name))
            return true;

        // Check named property: [Feature(Name = "Title")]
        try
        {
            name = featureAttr.GetNamedArgument<string>("Name");
            if (!string.IsNullOrWhiteSpace(name))
                return true;
        }
        catch { /* Property not set */ }

        return false;
    }
}
