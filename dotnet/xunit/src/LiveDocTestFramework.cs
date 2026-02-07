using System.Reflection;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Custom xUnit test framework that enables LiveDoc reporting for all tests,
/// including vanilla [Fact] and [Theory] tests that don't use LiveDoc base classes.
/// </summary>
/// <remarks>
/// To use this framework, add the following to your project:
/// <code>
/// [assembly: TestFramework("LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]
/// </code>
/// This will automatically report all test results to the LiveDoc viewer.
/// </remarks>
public class LiveDocTestFramework : XunitTestFramework
{
    public LiveDocTestFramework(IMessageSink messageSink) : base(messageSink)
    {
    }

    protected override ITestFrameworkExecutor CreateExecutor(AssemblyName assemblyName)
    {
        return new LiveDocTestFrameworkExecutor(assemblyName, SourceInformationProvider, DiagnosticMessageSink);
    }
}

/// <summary>
/// Test framework executor that wraps xUnit's executor to add LiveDoc reporting.
/// </summary>
public class LiveDocTestFrameworkExecutor : XunitTestFrameworkExecutor
{
    public LiveDocTestFrameworkExecutor(
        AssemblyName assemblyName,
        ISourceInformationProvider sourceInformationProvider,
        IMessageSink diagnosticMessageSink)
        : base(assemblyName, sourceInformationProvider, diagnosticMessageSink)
    {
    }

    protected override async void RunTestCases(
        IEnumerable<IXunitTestCase> testCases,
        IMessageSink executionMessageSink,
        ITestFrameworkExecutionOptions executionOptions)
    {
        // Wrap the message sink to intercept test results for LiveDoc reporting
        var liveDocSink = new LiveDocMessageSink(executionMessageSink);
        
        using var assemblyRunner = new XunitTestAssemblyRunner(
            TestAssembly,
            testCases,
            DiagnosticMessageSink,
            liveDocSink,
            executionOptions);
        
        await assemblyRunner.RunAsync();
    }
}

/// <summary>
/// Message sink that intercepts xUnit test results and reports them to LiveDoc.
/// </summary>
public class LiveDocMessageSink : IMessageSink
{
    private readonly IMessageSink _innerSink;
    private readonly Reporter.LiveDocTestRunReporter _reporter;

    public LiveDocMessageSink(IMessageSink innerSink)
    {
        _innerSink = innerSink;
        _reporter = Reporter.LiveDocTestRunReporter.Instance;
    }

    public bool OnMessage(IMessageSinkMessage message)
    {
        // Pass through to inner sink first
        var result = _innerSink.OnMessage(message);

        // Intercept test results if reporter is enabled
        if (_reporter.IsEnabled)
        {
            try
            {
                HandleMessage(message);
            }
            catch
            {
                // Don't let reporting errors affect test execution
            }
        }

        return result;
    }

    private void HandleMessage(IMessageSinkMessage message)
    {
        switch (message)
        {
            case ITestPassed passed:
                ReportTestResult(passed.Test, Reporter.Models.Status.Passed, passed.ExecutionTime, null);
                break;

            case ITestFailed failed:
                var errorMessage = string.Join(Environment.NewLine, failed.Messages);
                var stackTrace = string.Join(Environment.NewLine, failed.StackTraces ?? Array.Empty<string>());
                ReportTestResult(failed.Test, Reporter.Models.Status.Failed, failed.ExecutionTime, 
                    new Reporter.Models.ErrorInfo { Message = errorMessage, Stack = stackTrace });
                break;

            case ITestSkipped skipped:
                ReportTestResult(skipped.Test, Reporter.Models.Status.Skipped, 0, 
                    new Reporter.Models.ErrorInfo { Message = skipped.Reason });
                break;
        }
    }

    private void ReportTestResult(ITest test, Reporter.Models.Status status, decimal executionTime, Reporter.Models.ErrorInfo? error)
    {
        var testCase = test.TestCase;
        var testClass = testCase.TestMethod.TestClass.Class;
        var testMethod = testCase.TestMethod.Method;

        // Determine test style based on attributes
        var isFeature = testClass.GetCustomAttributes(typeof(FeatureAttribute)).Any();
        var isSpec = testClass.GetCustomAttributes(typeof(SpecificationAttribute)).Any();
        
        // Skip if already reported by LiveDoc base classes
        if (isFeature || isSpec)
            return;

        // This is a "standard" test - report it
        var className = testClass.Name;
        var methodName = testMethod.Name;
        var displayName = test.DisplayName;
        
        // Fire and forget - don't block test execution
        Task.Run(async () =>
        {
            try
            {
                await _reporter.ReportStandardTestAsync(
                    className,
                    methodName,
                    displayName,
                    status,
                    (long)(executionTime * 1000), // Convert to milliseconds
                    error);
            }
            catch
            {
                // Ignore reporting errors
            }
        });
    }
}
