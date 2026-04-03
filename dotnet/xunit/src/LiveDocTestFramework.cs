using System.Reflection;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Custom xUnit test framework that enables LiveDoc reporting for all tests,
/// including vanilla [Fact] and [Theory] tests that don't use LiveDoc base classes.
/// </summary>
/// <remarks>
/// To use this framework, add the following to your project:
/// <code>
/// [assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]
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

        // Try to flush here first — has more time than ProcessExit handler
        try
        {
            await Reporter.LiveDocTestRunReporter.Instance.FlushAndCompleteAsync();
        }
        catch
        {
            // ProcessExit handler is backup
        }
    }
}

/// <summary>
/// Message sink that intercepts xUnit test results and reports them to LiveDoc.
/// </summary>
public class LiveDocMessageSink : IMessageSink
{
    private readonly IMessageSink _innerSink;
    private readonly Reporter.LiveDocTestRunReporter _reporter;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, int> _outlineRowCounters = new();

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
        
        var className = testClass.Name;
        var methodName = testMethod.Name;
        var durationMs = (long)(executionTime * 1000);

        // Skip fixture/helper classes that aren't real test specs.
        // Convention: real test classes end in "_Spec" or "Spec".
        var simpleClassName = className.Contains('.') ? className.Substring(className.LastIndexOf('.') + 1) : className;
        if ((isFeature || isSpec) && !simpleClassName.EndsWith("Spec", StringComparison.Ordinal))
            return;

        // Derive assembly simple name — IAssemblyInfo.Name may return full name with version or DLL path
        var rawAssemblyName = testCase.TestMethod.TestClass.TestCollection.TestAssembly.Assembly.Name;
        // Handle both "Name.dll" paths and "Name, Version=..." full names
        var assemblyName = rawAssemblyName.Contains(',')
            ? rawAssemblyName.Split(',')[0].Trim()
            : System.IO.Path.GetFileNameWithoutExtension(rawAssemblyName);
        var path = Reporter.LiveDocTestRunReporter.DerivePathFromNames(className, assemblyName);

        if (isFeature || isSpec)
        {
            // Feature/Spec test — serve as fallback for tests that didn't create a LiveDocContext.
            var testCaseId = $"TestCase:{className}";
            var kind = DeriveTestKind(testMethod, isSpec);
            var isOutline = kind == "RuleOutline" || kind == "ScenarioOutline";
            var testId = DeriveTestId(className, methodName, testMethod);

            // Skip if already handled by LiveDocContext (which provides richer data with steps)
            if (_reporter.HasTest(testId))
                return;

            var style = isSpec ? Reporter.Models.TestStyles.Specification : Reporter.Models.TestStyles.Feature;
            var title = FormatTestCaseTitle(className);
            var (description, tags) = ExtractClassMetadata(testClass, isSpec);
            _reporter.BufferTestCase(testCaseId, kind: style, title, description, tags, path);

            if (isOutline)
            {
                // Outline tests need template titles and example rows
                var templateTitle = GetOutlineTemplateTitle(testMethod, isSpec);
                var rowId = _outlineRowCounters.AddOrUpdate(testId, 1, (_, v) => v + 1);
                
                // Resolve actual MethodInfo for parameters
                var classType = Type.GetType(className) 
                    ?? AppDomain.CurrentDomain.GetAssemblies()
                        .Select(a => { try { return a.GetType(className); } catch { return null; } })
                        .FirstOrDefault(t => t != null);
                var methodInfo = classType?.GetMethod(methodName);
                var args = testCase.TestMethodArguments ?? Array.Empty<object>();
                var parameters = methodInfo?.GetParameters() ?? Array.Empty<ParameterInfo>();

                _reporter.BufferOutlineExample(testCaseId, testId, kind, templateTitle, rowId, parameters, args);
                _reporter.AddOutlineExampleResult(testId, rowId, testId, status, durationMs, error);
                _reporter.RecordResult(status, testCaseId);
            }
            else
            {
                var testTitle = test.DisplayName;
                // Strip common prefixes
                if (testTitle.StartsWith("Rule: ")) testTitle = testTitle.Substring("Rule: ".Length);
                else if (testTitle.StartsWith("Scenario: ")) testTitle = testTitle.Substring("Scenario: ".Length);

                _reporter.BufferTest(testCaseId, testId, kind, testTitle);
                _reporter.UpdateTestExecution(testId, status, durationMs, error);
                _reporter.RecordResult(status, testCaseId);
            }
        }
        else
        {
            // Standard (non-LiveDoc) test
            var displayName = test.DisplayName;
            var testCaseId = $"standard:{className}";
            var testId = $"{className}.{methodName}";

            _reporter.BufferTestCase(testCaseId, Reporter.Models.TestStyles.Standard, 
                FormatTestCaseTitle(className), path: path);
            _reporter.BufferTest(testCaseId, testId, "Test", displayName);
            _reporter.UpdateTestExecution(testId, status, durationMs, error);
            _reporter.RecordResult(status, testCaseId);
        }
    }

    /// <summary>
    /// Derives a test ID that matches what LiveDocContext would generate.
    /// Uses method attributes (not test case arguments) for reliable outline detection.
    /// </summary>
    private static string DeriveTestId(string className, string methodName, Xunit.Abstractions.IMethodInfo testMethod)
    {
        // Check for outline attributes — these generate shared IDs across all rows
        if (testMethod.GetCustomAttributes(typeof(RuleOutlineAttribute)).Any() ||
            testMethod.GetCustomAttributes(typeof(ScenarioOutlineAttribute)).Any())
        {
            return $"Outline:{className}:{methodName}";
        }
        // Simple scenario/rule — match GenerateScenarioId format
        return $"Scenario:{className}:{methodName}";
    }

    /// <summary>
    /// Determines the test kind from method attributes.
    /// </summary>
    private static string DeriveTestKind(Xunit.Abstractions.IMethodInfo testMethod, bool isSpec)
    {
        if (testMethod.GetCustomAttributes(typeof(RuleOutlineAttribute)).Any())
            return "RuleOutline";
        if (testMethod.GetCustomAttributes(typeof(ScenarioOutlineAttribute)).Any())
            return "ScenarioOutline";
        if (isSpec)
            return "Rule";
        return "Scenario";
    }

    private static string FormatTestCaseTitle(string className)
    {
        var lastDot = className.LastIndexOf('.');
        var name = lastDot >= 0 ? className.Substring(lastDot + 1) : className;
        return System.Text.RegularExpressions.Regex.Replace(name, "([a-z])([A-Z])", "$1 $2")
            .Replace("_", " ");
    }

    /// <summary>
    /// Extracts Description and Tags from the class-level [Feature] or [Specification] attribute.
    /// </summary>
    private static (string? description, string[]? tags) ExtractClassMetadata(
        Xunit.Abstractions.ITypeInfo testClass, bool isSpec)
    {
        string? description = null;
        string[]? tags = null;

        try
        {
            var attrType = isSpec ? typeof(SpecificationAttribute) : typeof(FeatureAttribute);
            var attrs = testClass.GetCustomAttributes(attrType);
            var attr = attrs.FirstOrDefault();
            if (attr != null)
                description = attr.GetNamedArgument<string>("Description");

            // Also extract [Tag] attributes
            var tagAttrs = testClass.GetCustomAttributes(typeof(TagAttribute));
            if (tagAttrs.Any())
            {
                var allTags = new List<string>();
                foreach (var tagAttr in tagAttrs)
                {
                    // TagAttribute constructor takes a string that gets split by comma
                    var ctorArgs = tagAttr.GetConstructorArguments().ToList();
                    if (ctorArgs.Count > 0 && ctorArgs[0] is string tagsStr)
                    {
                        allTags.AddRange(tagsStr.Split(',').Select(t => t.Trim())
                            .Where(t => !string.IsNullOrEmpty(t)));
                    }
                }
                if (allTags.Count > 0)
                    tags = allTags.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            }
        }
        catch
        {
            // Don't let metadata extraction errors affect test execution
        }

        return (description?.Trim(), tags);
    }

    /// <summary>
    /// Gets the template title for an outline test method (with &lt;placeholders&gt;).
    /// Mirrors LiveDocContext.GetOutlineTemplateTitle for the MessageSink fallback path.
    /// </summary>
    private static string GetOutlineTemplateTitle(Xunit.Abstractions.IMethodInfo testMethod, bool isSpec)
    {
        // Try to resolve actual MethodInfo via Type.GetMethod
        var classType = Type.GetType(testMethod.Type.Name) 
            ?? AppDomain.CurrentDomain.GetAssemblies()
                .Select(a => { try { return a.GetType(testMethod.Type.Name); } catch { return null; } })
                .FirstOrDefault(t => t != null);
        
        var methodInfo = classType?.GetMethod(testMethod.Name);
        
        if (methodInfo != null)
        {
            var paramNames = methodInfo.GetParameters().Select(p => p.Name!).ToArray();

            if (isSpec)
            {
                var ruleOutlineAttr = methodInfo.GetCustomAttribute<RuleOutlineAttribute>();
                if (!string.IsNullOrEmpty(ruleOutlineAttr?.Description))
                    return ruleOutlineAttr.Description;
            }
            else
            {
                var scenarioOutlineAttr = methodInfo.GetCustomAttribute<ScenarioOutlineAttribute>();
                if (scenarioOutlineAttr != null)
                {
                    var methodAsTitle = "Scenario Outline: " + methodInfo.Name.Replace("_", " ");
                    if (scenarioOutlineAttr.DisplayName != null && scenarioOutlineAttr.DisplayName != methodAsTitle)
                    {
                        var title = scenarioOutlineAttr.DisplayName;
                        if (title.StartsWith("Scenario Outline: ", StringComparison.OrdinalIgnoreCase))
                            title = title.Substring("Scenario Outline: ".Length);
                        return title;
                    }
                }
            }

            return Core.ValueParser.FormatMethodNameAsTemplate(methodInfo.Name, paramNames);
        }

        // Fallback: use xUnit's IAttributeInfo for description, or format method name
        if (isSpec)
        {
            var attrs = testMethod.GetCustomAttributes(typeof(RuleOutlineAttribute));
            var attr = attrs.FirstOrDefault();
            var desc = attr?.GetNamedArgument<string>("Description");
            if (!string.IsNullOrEmpty(desc)) return desc;
        }
        else
        {
            var attrs = testMethod.GetCustomAttributes(typeof(ScenarioOutlineAttribute));
            var attr = attrs.FirstOrDefault();
            var desc = attr?.GetNamedArgument<string>("Description");
            if (!string.IsNullOrEmpty(desc)) return desc;
        }
        
        // Last resort: format method name with param names from IMethodInfo
        var iParamNames = testMethod.GetParameters().Select(p => p.Name).ToArray();
        return Core.ValueParser.FormatMethodNameAsTemplate(testMethod.Name, iParamNames);
    }
}
