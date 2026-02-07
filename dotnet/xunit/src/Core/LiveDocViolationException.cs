namespace LiveDoc.xUnit.Core;

/// <summary>
/// Exception thrown when LiveDoc detects invalid usage patterns,
/// such as mixing Gherkin and Specification paradigms.
/// </summary>
public class LiveDocViolationException : Exception
{
    /// <summary>
    /// The type of violation detected.
    /// </summary>
    public ViolationType ViolationType { get; }

    /// <summary>
    /// The test class where the violation occurred.
    /// </summary>
    public string TestClass { get; }

    /// <summary>
    /// The test method where the violation occurred (if applicable).
    /// </summary>
    public string? TestMethod { get; }

    /// <summary>
    /// Creates a new LiveDocViolationException.
    /// </summary>
    public LiveDocViolationException(ViolationType violationType, string testClass, string? testMethod, string message)
        : base(FormatMessage(violationType, testClass, testMethod, message))
    {
        ViolationType = violationType;
        TestClass = testClass;
        TestMethod = testMethod;
    }

    private static string FormatMessage(ViolationType violationType, string testClass, string? testMethod, string message)
    {
        var location = testMethod != null 
            ? $"{testClass}.{testMethod}" 
            : testClass;
        
        return $"LiveDoc Violation [{violationType}]: {message}\n  Location: {location}";
    }

    #region Factory Methods

    public static LiveDocViolationException ScenarioWithoutFeature(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.ScenarioWithoutFeature,
            testClass,
            testMethod,
            "Scenario must be within a Feature. Add [Feature] to the test class or use [Rule] with [Specification] for MSpec-style tests.");
    }

    public static LiveDocViolationException ScenarioOutlineWithoutFeature(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.ScenarioWithoutFeature,
            testClass,
            testMethod,
            "ScenarioOutline must be within a Feature. Add [Feature] to the test class or use [RuleOutline] with [Specification] for MSpec-style tests.");
    }

    public static LiveDocViolationException RuleWithoutSpecification(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.RuleWithoutSpecification,
            testClass,
            testMethod,
            "Rule must be within a Specification. Add [Specification] to the test class or use [Scenario] with [Feature] for BDD-style tests.");
    }

    public static LiveDocViolationException RuleOutlineWithoutSpecification(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.RuleWithoutSpecification,
            testClass,
            testMethod,
            "RuleOutline must be within a Specification. Add [Specification] to the test class or use [ScenarioOutline] with [Feature] for BDD-style tests.");
    }

    public static LiveDocViolationException ScenarioInSpecification(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.ScenarioInSpecification,
            testClass,
            testMethod,
            "This class uses [Specification] which requires [Rule] methods. Did you mean to use [Rule] instead of [Scenario]?");
    }

    public static LiveDocViolationException ScenarioOutlineInSpecification(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.ScenarioInSpecification,
            testClass,
            testMethod,
            "This class uses [Specification] which requires [RuleOutline] methods. Did you mean to use [RuleOutline] instead of [ScenarioOutline]?");
    }

    public static LiveDocViolationException RuleInFeature(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.RuleInFeature,
            testClass,
            testMethod,
            "This class uses [Feature] which requires [Scenario] methods. Did you mean to use [Scenario] instead of [Rule]?");
    }

    public static LiveDocViolationException RuleOutlineInFeature(string testClass, string testMethod)
    {
        return new LiveDocViolationException(
            ViolationType.RuleInFeature,
            testClass,
            testMethod,
            "This class uses [Feature] which requires [ScenarioOutline] methods. Did you mean to use [ScenarioOutline] instead of [RuleOutline]?");
    }

    public static LiveDocViolationException MixedClassAttributes(string testClass)
    {
        return new LiveDocViolationException(
            ViolationType.MixedClassAttributes,
            testClass,
            null,
            "A class cannot have both [Feature] and [Specification] attributes. Choose one paradigm per test class.");
    }

    #endregion
}

/// <summary>
/// Types of violations that LiveDoc can detect.
/// </summary>
public enum ViolationType
{
    /// <summary>
    /// [Scenario] or [ScenarioOutline] used without [Feature] on the class.
    /// </summary>
    ScenarioWithoutFeature,

    /// <summary>
    /// [Rule] or [RuleOutline] used without [Specification] on the class.
    /// </summary>
    RuleWithoutSpecification,

    /// <summary>
    /// [Scenario] or [ScenarioOutline] used on a class with [Specification].
    /// </summary>
    ScenarioInSpecification,

    /// <summary>
    /// [Rule] or [RuleOutline] used on a class with [Feature].
    /// </summary>
    RuleInFeature,

    /// <summary>
    /// Both [Feature] and [Specification] on the same class.
    /// </summary>
    MixedClassAttributes
}
