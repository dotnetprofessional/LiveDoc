using System.Reflection;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Validates LiveDoc paradigm usage. Public <c>Type</c>-based methods enable
/// negative testing; internal <c>ITestMethod</c>-based methods are called
/// during xUnit discovery.
/// </summary>
public static class LiveDocParadigmValidator
{
    // ── Public API (testable with plain reflection) ────────────────

    /// <summary>
    /// Validates that a Gherkin method ([Scenario] or [ScenarioOutline]) is used correctly
    /// on the given class. Returns a violation if invalid, null if valid.
    /// </summary>
    /// <param name="testClassType">The test class <see cref="Type"/>.</param>
    /// <param name="methodName">The test method name (for error messages).</param>
    /// <param name="attributeName">The attribute being validated: <c>"Scenario"</c> or <c>"ScenarioOutline"</c>.</param>
    public static LiveDocViolationException? ValidateGherkinMethod(
        Type testClassType, string methodName, string attributeName = "Scenario")
    {
        var className = testClassType.Name;
        var hasFeature = Attribute.IsDefined(testClassType, typeof(FeatureAttribute));
        var hasSpecification = Attribute.IsDefined(testClassType, typeof(SpecificationAttribute));

        if (hasFeature && hasSpecification)
            return LiveDocViolationException.MixedClassAttributes(className);

        if (hasSpecification)
        {
            return attributeName == "ScenarioOutline"
                ? LiveDocViolationException.ScenarioOutlineInSpecification(className, methodName)
                : LiveDocViolationException.ScenarioInSpecification(className, methodName);
        }

        if (!hasFeature)
        {
            return attributeName == "ScenarioOutline"
                ? LiveDocViolationException.ScenarioOutlineWithoutFeature(className, methodName)
                : LiveDocViolationException.ScenarioWithoutFeature(className, methodName);
        }

        var featureAttr = (FeatureAttribute)Attribute.GetCustomAttribute(testClassType, typeof(FeatureAttribute))!;
        if (string.IsNullOrWhiteSpace(featureAttr.Name))
            return LiveDocViolationException.FeatureMissingTitle(className, methodName);

        return null;
    }

    /// <summary>
    /// Validates that a Specification method ([Rule] or [RuleOutline]) is used correctly
    /// on the given class. Returns a violation if invalid, null if valid.
    /// </summary>
    /// <param name="testClassType">The test class <see cref="Type"/>.</param>
    /// <param name="methodName">The test method name (for error messages).</param>
    /// <param name="attributeName">The attribute being validated: <c>"Rule"</c> or <c>"RuleOutline"</c>.</param>
    public static LiveDocViolationException? ValidateSpecificationMethod(
        Type testClassType, string methodName, string attributeName = "Rule")
    {
        var className = testClassType.Name;
        var hasFeature = Attribute.IsDefined(testClassType, typeof(FeatureAttribute));
        var hasSpecification = Attribute.IsDefined(testClassType, typeof(SpecificationAttribute));

        if (hasFeature && hasSpecification)
            return LiveDocViolationException.MixedClassAttributes(className);

        if (hasFeature)
        {
            return attributeName == "RuleOutline"
                ? LiveDocViolationException.RuleOutlineInFeature(className, methodName)
                : LiveDocViolationException.RuleInFeature(className, methodName);
        }

        if (!hasSpecification)
        {
            return attributeName == "RuleOutline"
                ? LiveDocViolationException.RuleOutlineWithoutSpecification(className, methodName)
                : LiveDocViolationException.RuleWithoutSpecification(className, methodName);
        }

        return null;
    }

    // ── Internal API (xUnit discovery pipeline) ────────────────────

    /// <summary>
    /// Validates a Gherkin method during xUnit test discovery.
    /// </summary>
    internal static LiveDocViolationException? ValidateGherkinMethod(ITestMethod testMethod, string attributeName)
    {
        if (testMethod.TestClass.Class is IReflectionTypeInfo rti)
            return ValidateGherkinMethod(rti.Type, testMethod.Method.Name, attributeName);

        // Fallback for non-reflection discovery (rare)
        return ValidateGherkinMethodFromTypeInfo(testMethod.TestClass.Class, testMethod.Method.Name, attributeName);
    }

    /// <summary>
    /// Validates a Specification method during xUnit test discovery.
    /// </summary>
    internal static LiveDocViolationException? ValidateSpecificationMethod(ITestMethod testMethod, string attributeName)
    {
        if (testMethod.TestClass.Class is IReflectionTypeInfo rti)
            return ValidateSpecificationMethod(rti.Type, testMethod.Method.Name, attributeName);

        // Fallback for non-reflection discovery (rare)
        return ValidateSpecificationMethodFromTypeInfo(testMethod.TestClass.Class, testMethod.Method.Name, attributeName);
    }

    /// <summary>
    /// Creates a failing test case that reports a violation.
    /// </summary>
    internal static IXunitTestCase CreateViolationTestCase(
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

    // ── Fallback for non-reflection discovery ──────────────────────

    private static LiveDocViolationException? ValidateGherkinMethodFromTypeInfo(
        ITypeInfo testClass, string methodName, string attributeName)
    {
        var className = testClass.Name;
        var hasFeature = testClass.GetCustomAttributes(typeof(FeatureAttribute)).Any();
        var hasSpecification = testClass.GetCustomAttributes(typeof(SpecificationAttribute)).Any();

        if (hasFeature && hasSpecification)
            return LiveDocViolationException.MixedClassAttributes(className);

        if (hasSpecification)
            return attributeName == "ScenarioOutline"
                ? LiveDocViolationException.ScenarioOutlineInSpecification(className, methodName)
                : LiveDocViolationException.ScenarioInSpecification(className, methodName);

        if (!hasFeature)
            return attributeName == "ScenarioOutline"
                ? LiveDocViolationException.ScenarioOutlineWithoutFeature(className, methodName)
                : LiveDocViolationException.ScenarioWithoutFeature(className, methodName);

        var featureAttr = testClass.GetCustomAttributes(typeof(FeatureAttribute)).First();
        if (!HasExplicitFeatureTitle(featureAttr))
            return LiveDocViolationException.FeatureMissingTitle(className, methodName);

        return null;
    }

    private static LiveDocViolationException? ValidateSpecificationMethodFromTypeInfo(
        ITypeInfo testClass, string methodName, string attributeName)
    {
        var className = testClass.Name;
        var hasFeature = testClass.GetCustomAttributes(typeof(FeatureAttribute)).Any();
        var hasSpecification = testClass.GetCustomAttributes(typeof(SpecificationAttribute)).Any();

        if (hasFeature && hasSpecification)
            return LiveDocViolationException.MixedClassAttributes(className);

        if (hasFeature)
            return attributeName == "RuleOutline"
                ? LiveDocViolationException.RuleOutlineInFeature(className, methodName)
                : LiveDocViolationException.RuleInFeature(className, methodName);

        if (!hasSpecification)
            return attributeName == "RuleOutline"
                ? LiveDocViolationException.RuleOutlineWithoutSpecification(className, methodName)
                : LiveDocViolationException.RuleWithoutSpecification(className, methodName);

        return null;
    }

    private static bool HasExplicitFeatureTitle(IAttributeInfo featureAttr)
    {
        var ctorArgs = featureAttr.GetConstructorArguments().ToList();
        var name = ctorArgs.Count > 0 ? ctorArgs[0] as string : null;
        if (!string.IsNullOrWhiteSpace(name))
            return true;

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
