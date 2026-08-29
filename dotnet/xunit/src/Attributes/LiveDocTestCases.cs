using System.ComponentModel;
using System.Reflection;
using System.Runtime.CompilerServices;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

internal static class LiveDocTestInvocationRegistry
{
    private sealed record InvocationData(object?[] Values, int OutlineRowId);

    private static readonly ConditionalWeakTable<ITest, InvocationData> Invocations = new();

    public static void Register(ITest test, object?[]? values, int outlineRowId)
    {
        if (values == null)
            return;

        Invocations.Remove(test);
        Invocations.Add(test, new InvocationData(values.ToArray(), outlineRowId));
    }

    public static object?[]? GetArguments(ITest test)
    {
        return Invocations.TryGetValue(test, out var invocation) ? invocation.Values : null;
    }

    public static int? GetOutlineRowId(ITest test)
    {
        return Invocations.TryGetValue(test, out var invocation) ? invocation.OutlineRowId : null;
    }
}

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
    private int _nextRowIndex;

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
        var parameterValues = OutlineDisplayNameFormatter.GetParameterValues(testMethod, testMethodArguments);
        var ruleOutline = testMethod.GetCustomAttribute<RuleOutlineAttribute>();
        var scenarioOutline = testMethod.GetCustomAttribute<ScenarioOutlineAttribute>();
        if (test.TestCase is IXunitTestCase xunitTestCase && ruleOutline != null)
        {
            test = new XunitTest(xunitTestCase, "Rule: " + ruleOutline.GetDisplayName(testMethod, parameterValues));
        }
        else if (test.TestCase is IXunitTestCase scenarioTestCase && scenarioOutline != null)
        {
            test = new XunitTest(scenarioTestCase, "Scenario: " + scenarioOutline.GetDisplayName(testMethod, parameterValues));
        }

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
            cancellationTokenSource,
            _nextRowIndex++);
    }
}

/// <summary>
/// Custom test case that resolves Rule titles against the owning method.
/// </summary>
public class LiveDocRuleTestCase : XunitTestCase
{
    [EditorBrowsable(EditorBrowsableState.Never)]
    [Obsolete("Called by the deserializer; should only be called by deriving classes for de-serialization purposes")]
    public LiveDocRuleTestCase() { }

    public LiveDocRuleTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod)
        : base(diagnosticMessageSink, defaultMethodDisplay, defaultMethodDisplayOptions, testMethod)
    {
    }

    protected override string GetDisplayName(IAttributeInfo factAttribute, string displayName)
    {
        var method = TestMethod.Method.ToRuntimeMethod();
        var rule = method.GetCustomAttribute<RuleAttribute>();
        return "Rule: " + (rule?.GetDisplayName(method) ?? method.Name.Replace('_', ' '));
    }
}

/// <summary>
/// Custom test case for RuleOutline that automatically injects example data.
/// </summary>
public class LiveDocRuleOutlineTestCase : XunitTestCase
{
    private int _outlineRowIndex;
    private string? _dataRowSkipReason;

    [EditorBrowsable(EditorBrowsableState.Never)]
    [Obsolete("Called by the deserializer; should only be called by deriving classes for de-serialization purposes")]
    public LiveDocRuleOutlineTestCase() { }

    public LiveDocRuleOutlineTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod,
        object?[]? testMethodArguments = null)
        : this(
            diagnosticMessageSink,
            defaultMethodDisplay,
            defaultMethodDisplayOptions,
            testMethod,
            testMethodArguments,
            0,
            null)
    {
    }

    public LiveDocRuleOutlineTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod,
        object?[]? testMethodArguments,
        int outlineRowIndex,
        string? dataRowSkipReason)
        : base(diagnosticMessageSink, defaultMethodDisplay, defaultMethodDisplayOptions, testMethod, testMethodArguments)
    {
        _outlineRowIndex = outlineRowIndex;
        _dataRowSkipReason = dataRowSkipReason;
    }

    internal void SetOutlineRowIndex(int outlineRowIndex)
    {
        _outlineRowIndex = outlineRowIndex;
    }

    internal int OutlineRowIndex => _outlineRowIndex;

    protected override string GetDisplayName(IAttributeInfo factAttribute, string displayName)
    {
        var method = TestMethod.Method.ToRuntimeMethod();
        var arguments = TestMethodArguments;

        if (arguments == null || arguments.Length == 0)
            return "Rule: " + FormatMethodName(method.Name);

        var paramValues = OutlineDisplayNameFormatter.GetParameterValues(method, arguments);

        // Get the RuleOutline attribute
        var ruleOutlineAttr = method.GetCustomAttribute<RuleOutlineAttribute>();
        if (ruleOutlineAttr != null)
        {
            return "Rule: " + ruleOutlineAttr.GetDisplayName(method, paramValues);
        }

        // Fallback to formatting method name
        return "Rule: " + Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }

    protected override string GetSkipReason(IAttributeInfo factAttribute)
    {
        return _dataRowSkipReason ?? base.GetSkipReason(factAttribute);
    }

    protected override string GetUniqueID()
    {
        return $"{base.GetUniqueID()}-{_outlineRowIndex}";
    }

    public override void Serialize(IXunitSerializationInfo data)
    {
        base.Serialize(data);
        data.AddValue("LiveDocOutlineRowIndex", _outlineRowIndex);
        data.AddValue("LiveDocDataRowSkipReason", _dataRowSkipReason);
    }

    public override void Deserialize(IXunitSerializationInfo data)
    {
        base.Deserialize(data);
        _outlineRowIndex = data.GetValue<int>("LiveDocOutlineRowIndex");
        _dataRowSkipReason = data.GetValue<string?>("LiveDocDataRowSkipReason");
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
    private int _outlineRowIndex;
    private string? _dataRowSkipReason;

    [EditorBrowsable(EditorBrowsableState.Never)]
    [Obsolete("Called by the deserializer; should only be called by deriving classes for de-serialization purposes")]
    public LiveDocScenarioOutlineTestCase() { }

    public LiveDocScenarioOutlineTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod,
        object?[]? testMethodArguments = null)
        : this(
            diagnosticMessageSink,
            defaultMethodDisplay,
            defaultMethodDisplayOptions,
            testMethod,
            testMethodArguments,
            0,
            null)
    {
    }

    public LiveDocScenarioOutlineTestCase(
        IMessageSink diagnosticMessageSink,
        TestMethodDisplay defaultMethodDisplay,
        TestMethodDisplayOptions defaultMethodDisplayOptions,
        ITestMethod testMethod,
        object?[]? testMethodArguments,
        int outlineRowIndex,
        string? dataRowSkipReason)
        : base(diagnosticMessageSink, defaultMethodDisplay, defaultMethodDisplayOptions, testMethod, testMethodArguments)
    {
        _outlineRowIndex = outlineRowIndex;
        _dataRowSkipReason = dataRowSkipReason;
    }

    internal void SetOutlineRowIndex(int outlineRowIndex)
    {
        _outlineRowIndex = outlineRowIndex;
    }

    internal int OutlineRowIndex => _outlineRowIndex;

    protected override string GetDisplayName(IAttributeInfo factAttribute, string displayName)
    {
        var method = TestMethod.Method.ToRuntimeMethod();
        var arguments = TestMethodArguments;

        if (arguments == null || arguments.Length == 0)
            return "Scenario: " + FormatMethodName(method.Name);

        var paramValues = OutlineDisplayNameFormatter.GetParameterValues(method, arguments);

        // Get the ScenarioOutline attribute
        var scenarioOutlineAttr = method.GetCustomAttribute<ScenarioOutlineAttribute>();
        if (scenarioOutlineAttr != null)
        {
            return "Scenario: " + scenarioOutlineAttr.GetDisplayName(method, paramValues);
        }

        // Fallback to formatting method name
        return "Scenario: " + Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }

    protected override string GetSkipReason(IAttributeInfo factAttribute)
    {
        return _dataRowSkipReason ?? base.GetSkipReason(factAttribute);
    }

    protected override string GetUniqueID()
    {
        return $"{base.GetUniqueID()}-{_outlineRowIndex}";
    }

    public override void Serialize(IXunitSerializationInfo data)
    {
        base.Serialize(data);
        data.AddValue("LiveDocOutlineRowIndex", _outlineRowIndex);
        data.AddValue("LiveDocDataRowSkipReason", _dataRowSkipReason);
    }

    public override void Deserialize(IXunitSerializationInfo data)
    {
        base.Deserialize(data);
        _outlineRowIndex = data.GetValue<int>("LiveDocOutlineRowIndex");
        _dataRowSkipReason = data.GetValue<string?>("LiveDocDataRowSkipReason");
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
        var outlineRowIndex = TestCase switch
        {
            LiveDocRuleOutlineTestCase ruleOutline => ruleOutline.OutlineRowIndex,
            LiveDocScenarioOutlineTestCase scenarioOutline => scenarioOutline.OutlineRowIndex,
            _ => 0
        };
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
            CancellationTokenSource,
            outlineRowIndex);
        
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
        CancellationTokenSource cancellationTokenSource,
        int outlineRowIndex)
        : base(test, messageBus, testClass, constructorArguments, testMethod, testMethodArguments, skipReason, beforeAfterAttributes, aggregator, cancellationTokenSource)
    {
        _testMethodArguments = testMethodArguments;
        LiveDocTestInvocationRegistry.Register(test, testMethodArguments, outlineRowIndex);
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
    private readonly int? _outlineRowId;

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
        _outlineRowId = LiveDocTestInvocationRegistry.GetOutlineRowId(test);
    }

    protected override object CreateTestClass()
    {
        // Set the test data in AsyncLocal BEFORE creating the test class
        // This allows EnsureContext() to pick it up during construction or first step
        if (_testMethodArguments != null && _testMethodArguments.Length > 0)
        {
            LiveDocExampleDataAttribute.SetCurrentTestData(_testMethodInfo, _testMethodArguments, _outlineRowId);
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
            specTest.SetExampleDataInternal(_testMethodInfo, _testMethodArguments);
        }
        
        return testClassInstance;
    }
}
