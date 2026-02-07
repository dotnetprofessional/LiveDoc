using System.ComponentModel;
using System.Reflection;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Custom theory test case that groups examples in Test Explorer while 
/// still auto-injecting example data via our custom invoker.
/// </summary>
public class LiveDocTheoryTestCase : XunitTheoryTestCase
{
    [EditorBrowsable(EditorBrowsableState.Never)]
    [Obsolete("Called by the deserializer; should only be called by deriving classes for de-serialization purposes")]
    public LiveDocTheoryTestCase() { }

    public LiveDocTheoryTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod)
        : base(diagnosticMessageSink, defaultMethodDisplay, defaultMethodDisplayOptions, testMethod)
    {
    }

    public override async Task<RunSummary> RunAsync(
        IMessageSink diagnosticMessageSink,
        IMessageBus messageBus,
        object[] constructorArguments,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
    {
        // Use our custom theory runner that injects example data
        var runner = new LiveDocTheoryTestCaseRunner(
            this,
            DisplayName,
            SkipReason,
            constructorArguments,
            diagnosticMessageSink,
            messageBus,
            aggregator,
            cancellationTokenSource);
        
        return await runner.RunAsync();
    }
}

/// <summary>
/// Custom theory test case runner that creates individual test cases and runs them with example data injection.
/// </summary>
internal class LiveDocTheoryTestCaseRunner : XunitTheoryTestCaseRunner
{
    public LiveDocTheoryTestCaseRunner(
        IXunitTestCase testCase,
        string displayName,
        string? skipReason,
        object[] constructorArguments,
        IMessageSink diagnosticMessageSink,
        IMessageBus messageBus,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
        : base(testCase, displayName, skipReason, constructorArguments, diagnosticMessageSink, messageBus, aggregator, cancellationTokenSource)
    {
    }

    protected override XunitTestRunner CreateTestRunner(
        ITest test,
        IMessageBus messageBus,
        Type testClass,
        object[] constructorArguments,
        MethodInfo testMethod,
        object?[]? testMethodArguments,
        string? skipReason,
        IReadOnlyList<BeforeAfterTestAttribute> beforeAfterAttributes,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
    {
        // Return our custom runner that injects example data
        return new LiveDocTestRunner(
            test,
            messageBus,
            testClass,
            constructorArguments,
            testMethod,
            testMethodArguments,
            skipReason,
            beforeAfterAttributes,
            aggregator,
            cancellationTokenSource);
    }
}

/// <summary>
/// Custom test case for RuleOutline that automatically injects example data.
/// </summary>
public class LiveDocRuleOutlineTestCase : XunitTestCase
{
    [EditorBrowsable(EditorBrowsableState.Never)]
    [Obsolete("Called by the deserializer; should only be called by deriving classes for de-serialization purposes")]
    public LiveDocRuleOutlineTestCase() { }

    public LiveDocRuleOutlineTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod,
        object?[]? testMethodArguments = null)
        : base(diagnosticMessageSink, defaultMethodDisplay, defaultMethodDisplayOptions, testMethod, testMethodArguments)
    {
    }

    protected override string GetDisplayName(IAttributeInfo factAttribute, string displayName)
    {
        var method = TestMethod.Method.ToRuntimeMethod();
        var parameters = method.GetParameters();
        var arguments = TestMethodArguments;

        if (arguments == null || arguments.Length == 0)
            return "Rule: " + FormatMethodName(method.Name);

        // Build parameter values dictionary
        var paramValues = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < Math.Min(parameters.Length, arguments.Length); i++)
        {
            paramValues[parameters[i].Name!] = arguments[i];
        }

        // Get the RuleOutline attribute
        var ruleOutlineAttr = method.GetCustomAttribute<RuleOutlineAttribute>();
        if (ruleOutlineAttr != null)
        {
            return "Rule: " + ruleOutlineAttr.GetDisplayName(method, paramValues);
        }

        // Fallback to formatting method name
        return "Rule: " + Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }

    public override async Task<RunSummary> RunAsync(
        IMessageSink diagnosticMessageSink,
        IMessageBus messageBus,
        object[] constructorArguments,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
    {
        // Use our custom test case runner that injects example data
        var runner = new LiveDocTestCaseRunner(
            this,
            DisplayName,
            SkipReason,
            constructorArguments,
            TestMethodArguments,
            messageBus,
            aggregator,
            cancellationTokenSource);
        
        return await runner.RunAsync();
    }

    private static string FormatMethodName(string name) => name.Replace("_", " ");
}

/// <summary>
/// Custom test case for ScenarioOutline that automatically injects example data.
/// </summary>
public class LiveDocScenarioOutlineTestCase : XunitTestCase
{
    [EditorBrowsable(EditorBrowsableState.Never)]
    [Obsolete("Called by the deserializer; should only be called by deriving classes for de-serialization purposes")]
    public LiveDocScenarioOutlineTestCase() { }

    public LiveDocScenarioOutlineTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod,
        object?[]? testMethodArguments = null)
        : base(diagnosticMessageSink, defaultMethodDisplay, defaultMethodDisplayOptions, testMethod, testMethodArguments)
    {
    }

    protected override string GetDisplayName(IAttributeInfo factAttribute, string displayName)
    {
        var method = TestMethod.Method.ToRuntimeMethod();
        var parameters = method.GetParameters();
        var arguments = TestMethodArguments;

        if (arguments == null || arguments.Length == 0)
            return "Scenario: " + FormatMethodName(method.Name);

        // Build parameter values dictionary
        var paramValues = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < Math.Min(parameters.Length, arguments.Length); i++)
        {
            paramValues[parameters[i].Name!] = arguments[i];
        }

        // Get the ScenarioOutline attribute
        var scenarioOutlineAttr = method.GetCustomAttribute<ScenarioOutlineAttribute>();
        if (scenarioOutlineAttr != null && !string.IsNullOrEmpty(scenarioOutlineAttr.Description))
        {
            // Replace <paramName> with actual values
            var formattedDesc = System.Text.RegularExpressions.Regex.Replace(
                scenarioOutlineAttr.Description,
                @"<([^>]+)>",
                match =>
                {
                    var paramName = match.Groups[1].Value;
                    if (paramValues.TryGetValue(paramName, out var value))
                    {
                        return value?.ToString() ?? "";
                    }
                    return match.Value;
                });
            return "Scenario: " + formattedDesc;
        }

        // Fallback to formatting method name
        return "Scenario: " + Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }

    public override async Task<RunSummary> RunAsync(
        IMessageSink diagnosticMessageSink,
        IMessageBus messageBus,
        object[] constructorArguments,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
    {
        // Use our custom test case runner that injects example data
        var runner = new LiveDocTestCaseRunner(
            this,
            DisplayName,
            SkipReason,
            constructorArguments,
            TestMethodArguments,
            messageBus,
            aggregator,
            cancellationTokenSource);
        
        return await runner.RunAsync();
    }

    private static string FormatMethodName(string name) => name.Replace("_", " ");
}

/// <summary>
/// Custom test case runner that injects example data before test execution.
/// </summary>
internal class LiveDocTestCaseRunner : XunitTestCaseRunner
{
    public LiveDocTestCaseRunner(
        IXunitTestCase testCase,
        string displayName,
        string? skipReason,
        object[] constructorArguments,
        object?[]? testMethodArguments,
        IMessageBus messageBus,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
        : base(testCase, displayName, skipReason, constructorArguments, testMethodArguments, messageBus, aggregator, cancellationTokenSource)
    {
    }

    protected override async Task<RunSummary> RunTestAsync()
    {
        // Use our custom test runner that injects example data
        var runner = new LiveDocTestRunner(
            new XunitTest(TestCase, DisplayName),
            MessageBus,
            TestClass,
            ConstructorArguments,
            TestMethod,
            TestMethodArguments,
            SkipReason,
            BeforeAfterAttributes,
            Aggregator,
            CancellationTokenSource);
        
        return await runner.RunAsync();
    }
}

/// <summary>
/// Custom test runner that injects example data before test method invocation.
/// </summary>
internal class LiveDocTestRunner : XunitTestRunner
{
    private readonly object?[]? _testMethodArguments;

    public LiveDocTestRunner(
        ITest test,
        IMessageBus messageBus,
        Type testClass,
        object[] constructorArguments,
        MethodInfo testMethod,
        object?[]? testMethodArguments,
        string? skipReason,
        IReadOnlyList<BeforeAfterTestAttribute> beforeAfterAttributes,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
        : base(test, messageBus, testClass, constructorArguments, testMethod, testMethodArguments, skipReason, beforeAfterAttributes, aggregator, cancellationTokenSource)
    {
        _testMethodArguments = testMethodArguments;
    }

    protected override Task<decimal> InvokeTestMethodAsync(ExceptionAggregator aggregator)
    {
        // Use our custom invoker that injects example data
        return new LiveDocTestInvoker(
            Test,
            MessageBus,
            TestClass,
            ConstructorArguments,
            TestMethod,
            _testMethodArguments,
            BeforeAfterAttributes,
            aggregator,
            CancellationTokenSource).RunAsync();
    }
}

/// <summary>
/// Custom test invoker that injects example data into the test instance.
/// </summary>
internal class LiveDocTestInvoker : XunitTestInvoker
{
    private readonly object?[]? _testMethodArguments;
    private readonly MethodInfo _testMethodInfo;

    public LiveDocTestInvoker(
        ITest test,
        IMessageBus messageBus,
        Type testClass,
        object[] constructorArguments,
        MethodInfo testMethod,
        object?[]? testMethodArguments,
        IReadOnlyList<BeforeAfterTestAttribute> beforeAfterAttributes,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource)
        : base(test, messageBus, testClass, constructorArguments, testMethod, testMethodArguments, beforeAfterAttributes, aggregator, cancellationTokenSource)
    {
        _testMethodArguments = testMethodArguments;
        _testMethodInfo = testMethod;
    }

    protected override object CreateTestClass()
    {
        // Set the test data in AsyncLocal BEFORE creating the test class
        // This allows EnsureContext() to pick it up during construction or first step
        if (_testMethodArguments != null && _testMethodArguments.Length > 0)
        {
            LiveDocExampleDataAttribute.SetCurrentTestData(_testMethodInfo, _testMethodArguments);
        }
        
        var testClassInstance = base.CreateTestClass();
        
        // For SpecificationTest (RuleOutline), eagerly inject example data.
        // These tests have no Given/When/Then steps to trigger EnsureContext(),
        // so we must create the context now for output to appear.
        // (ScenarioOutline tests use steps which trigger EnsureContext + AsyncLocal instead,
        // because some have manual SetExampleData calls that would conflict with eager injection.)
        if (testClassInstance is SpecificationTest specTest && 
            _testMethodArguments != null && 
            _testMethodArguments.Length > 0)
        {
            var args = _testMethodArguments.Select(a => a ?? DBNull.Value).ToArray();
            specTest.SetExampleDataInternal(_testMethodInfo, args);
        }
        
        return testClassInstance;
    }
}
