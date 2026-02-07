using System.Reflection;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// BeforeAfterTestAttribute that automatically injects example data into LiveDocTestBase instances.
/// This allows grouped Theory display while still providing automatic example data injection.
/// </summary>
internal class LiveDocExampleDataAttribute : BeforeAfterTestAttribute
{
    // Use AsyncLocal to pass test method arguments from the invoker to the test instance
    private static readonly AsyncLocal<object?[]?> _currentTestArgs = new();
    private static readonly AsyncLocal<MethodInfo?> _currentTestMethod = new();

    /// <summary>
    /// Sets the current test arguments for the executing test.
    /// Called by the custom test invoker before creating the test class.
    /// </summary>
    public static void SetCurrentTestData(MethodInfo testMethod, object?[]? args)
    {
        _currentTestMethod.Value = testMethod;
        _currentTestArgs.Value = args;
    }

    /// <summary>
    /// Gets the current test method.
    /// </summary>
    public static MethodInfo? CurrentTestMethod => _currentTestMethod.Value;

    /// <summary>
    /// Gets the current test arguments.
    /// </summary>
    public static object?[]? CurrentTestArgs => _currentTestArgs.Value;

    /// <summary>
    /// Clears the current test data after test execution.
    /// </summary>
    public static void ClearCurrentTestData()
    {
        _currentTestMethod.Value = null;
        _currentTestArgs.Value = null;
    }

    public override void Before(MethodInfo methodUnderTest)
    {
        // The injection happens in the base class constructor using the static CurrentTestArgs
    }

    public override void After(MethodInfo methodUnderTest)
    {
        ClearCurrentTestData();
    }
}
