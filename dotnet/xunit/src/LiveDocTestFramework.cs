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
    private readonly AssemblyName _assemblyName;

    public LiveDocTestFrameworkExecutor(
        AssemblyName assemblyName,
        ISourceInformationProvider sourceInformationProvider,
        IMessageSink diagnosticMessageSink)
        : base(assemblyName, sourceInformationProvider, diagnosticMessageSink)
    {
        _assemblyName = assemblyName;
    }

    protected override async void RunTestCases(
        IEnumerable<IXunitTestCase> testCases,
        IMessageSink executionMessageSink,
        ITestFrameworkExecutionOptions executionOptions)
    {
        Reporter.LiveDocTestRunReporter.Instance.SetDefaultProject(_assemblyName);

        // Wrap the message sink to intercept test results for LiveDoc reporting
        var liveDocSink = new LiveDocMessageSink(executionMessageSink);

        using var assemblyRunner = new XunitTestAssemblyRunner(
            TestAssembly,
            testCases,
            DiagnosticMessageSink,
            liveDocSink,
            executionOptions);

        await assemblyRunner.RunAsync();

        // The primary flush happens inside LiveDocMessageSink when it intercepts
        // ITestAssemblyFinished — BEFORE the inner sink signals completion to VSTest.
        // This defensive call is a no-op if the sink already flushed successfully
        // (FlushAndCompleteAsync is idempotent via _flushTask guard).
        try
        {
            await Reporter.LiveDocTestRunReporter.Instance.FlushAndCompleteAsync();
        }
        catch
        {
            // ProcessExit handler is the final fallback
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
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Collections.Concurrent.ConcurrentDictionary<int, byte>>
        _claimedOutlineRows = new();

    private sealed record ClassMetadata(string Title, string? Description, string[]? Tags);

    private sealed record MethodMetadata(string Title, string? Description, string[]? Tags);

    public LiveDocMessageSink(IMessageSink innerSink)
    {
        _innerSink = innerSink;
        _reporter = Reporter.LiveDocTestRunReporter.Instance;
    }

    public bool OnMessage(IMessageSinkMessage message)
    {
        // Intercept test results even when server discovery has not completed yet.
        // The reporter decides whether to publish or discard buffered results at flush time.
        try
        {
            HandleMessage(message);
        }
        catch
        {
            // Don't let reporting errors affect test execution
        }

        // Flush all buffered results BEFORE the assembly-finished message reaches
        // the inner sink. Once the inner sink processes ITestAssemblyFinished,
        // the VSTest adapter considers the run complete and the process may exit.
        // For partial/subset runs this race is almost always lost, so we must
        // ensure the HTTP flush completes within the normal execution flow.
        if (message is Xunit.Sdk.TestAssemblyFinished)
        {
            try
            {
                _reporter.FlushAndCompleteAsync().GetAwaiter().GetResult();
            }
            catch
            {
                // ProcessExit handler is backup
            }
        }

        // Pass through to inner sink
        return _innerSink.OnMessage(message);
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
            var args = GetTestArguments(test);
            var testId = DeriveTestId(className, methodName, testMethod, args);
            var classType = ResolveType(className);
            var methodInfo = ResolveMethod(classType, methodName, testMethod);
            var classMetadata = ExtractClassMetadata(testClass, isSpec, classType, className);
            var methodMetadata = ExtractMethodMetadata(
                testMethod,
                kind,
                isSpec,
                methodInfo,
                test.DisplayName,
                classMetadata.Tags);

            if (isOutline)
            {
                var registeredRowId = LiveDocTestInvocationRegistry.GetOutlineRowId(test);
                if (registeredRowId.HasValue && _reporter.HasOutlineRow(testId, registeredRowId.Value))
                {
                    MarkOutlineRowClaimed(testId, registeredRowId.Value);
                    _reporter.ReconcileOutlineExampleExecution(
                        testId,
                        registeredRowId.Value,
                        status,
                        durationMs,
                        error);
                    _reporter.RecordResult(
                        status,
                        testCaseId,
                        Reporter.LiveDocTestRunReporter.GenerateOutlineResultId(testId, registeredRowId.Value));
                    return;
                }

                var rowId = ClaimOutlineRow(testId, args);
                if (rowId.HasValue)
                {
                    _reporter.ReconcileOutlineExampleExecution(testId, rowId.Value, status, durationMs, error);
                    _reporter.RecordResult(
                        status,
                        testCaseId,
                        Reporter.LiveDocTestRunReporter.GenerateOutlineResultId(testId, rowId.Value));
                    return;
                }
            }
            else if (_reporter.HasTest(testId))
            {
                _reporter.UpdateTestExecution(testId, status, durationMs, error);
                _reporter.RecordResult(status, testCaseId, testId);
                return;
            }

            var style = isSpec ? Reporter.Models.TestKinds.Specification : Reporter.Models.TestKinds.Feature;
            _reporter.BufferTestCase(
                testCaseId,
                kind: style,
                classMetadata.Title,
                classMetadata.Description,
                classMetadata.Tags,
                path);

            if (isOutline)
            {
                // Outline tests need template titles and example rows
                var templateTitle = methodMetadata.Title;
                var rowId = LiveDocTestInvocationRegistry.GetOutlineRowId(test)
                    ?? _reporter.GetNextOutlineRowId(testId);
                var parameters = methodInfo?.GetParameters() ?? Array.Empty<ParameterInfo>();

                _reporter.BufferOutlineExample(
                    testCaseId,
                    testId,
                    kind,
                    templateTitle,
                    rowId,
                    parameters,
                    args,
                    methodMetadata.Description,
                    methodMetadata.Tags);
                MarkOutlineRowClaimed(testId, rowId);
                _reporter.AddOutlineExampleResult(testId, rowId, testId, status, durationMs, error);
                _reporter.RecordResult(
                    status,
                    testCaseId,
                    Reporter.LiveDocTestRunReporter.GenerateOutlineResultId(testId, rowId));
            }
            else
            {
                _reporter.BufferTest(
                    testCaseId,
                    testId,
                    kind,
                    methodMetadata.Title,
                    methodMetadata.Description,
                    methodMetadata.Tags);
                _reporter.UpdateTestExecution(testId, status, durationMs, error);
                _reporter.RecordResult(status, testCaseId, testId);
            }
        }
        else
        {
            // Standard (non-LiveDoc) test
            var displayName = test.DisplayName;
            var testCaseId = $"standard:{className}";
            var args = GetTestArguments(test);
            var testId = args.Length == 0
                ? $"{className}.{methodName}"
                : $"{className}.{methodName}:{testCase.UniqueID}:{test.DisplayName}";

            _reporter.BufferTestCase(testCaseId, Reporter.Models.TestKinds.Standard, 
                FormatTestCaseTitle(className), path: path);
            _reporter.BufferTest(testCaseId, testId, "Test", displayName);
            _reporter.UpdateTestExecution(testId, status, durationMs, error);
            _reporter.RecordResult(status, testCaseId, $"{testCase.UniqueID}:{test.DisplayName}");
        }
    }

    private static object?[] GetTestArguments(ITest test)
    {
        return LiveDocTestInvocationRegistry.GetArguments(test)
            ?? test.TestCase.TestMethodArguments?.ToArray()
            ?? Array.Empty<object?>();
    }

    private int? ClaimOutlineRow(string outlineId, object?[] args)
    {
        var claimedRows = _claimedOutlineRows.GetOrAdd(
            outlineId,
            _ => new System.Collections.Concurrent.ConcurrentDictionary<int, byte>());

        foreach (var rowId in _reporter.FindOutlineRowIds(outlineId, args))
        {
            if (claimedRows.TryAdd(rowId, 0))
                return rowId;
        }

        return null;
    }

    private void MarkOutlineRowClaimed(string outlineId, int rowId)
    {
        _claimedOutlineRows
            .GetOrAdd(
                outlineId,
                _ => new System.Collections.Concurrent.ConcurrentDictionary<int, byte>())
            .TryAdd(rowId, 0);
    }

    private static Type? ResolveType(string className)
    {
        return Type.GetType(className)
            ?? AppDomain.CurrentDomain.GetAssemblies()
                .Select(assembly =>
                {
                    try { return assembly.GetType(className); }
                    catch { return null; }
                })
                .FirstOrDefault(type => type != null);
    }

    private static MethodInfo? ResolveMethod(
        Type? classType,
        string methodName,
        Xunit.Abstractions.IMethodInfo testMethod)
    {
        if (classType == null)
            return null;

        var parameterCount = testMethod.GetParameters().Count();
        return classType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(method =>
                method.Name == methodName &&
                method.GetParameters().Length == parameterCount);
    }

    /// <summary>
    /// Derives a test ID that matches what LiveDocContext would generate.
    /// Uses method attributes (not test case arguments) for reliable outline detection.
    /// </summary>
    private static string DeriveTestId(
        string className,
        string methodName,
        Xunit.Abstractions.IMethodInfo testMethod,
        object?[] args)
    {
        // Check for outline attributes — these generate shared IDs across all rows
        if (testMethod.GetCustomAttributes(typeof(RuleOutlineAttribute)).Any() ||
            testMethod.GetCustomAttributes(typeof(ScenarioOutlineAttribute)).Any())
        {
            return $"Outline:{className}:{methodName}";
        }
        // Simple scenario/rule — match GenerateScenarioId format
        return Reporter.LiveDocTestRunReporter.GenerateScenarioId(className, methodName, args);
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
    /// Extracts title, Description, and Tags from the class-level [Feature] or [Specification] attribute.
    /// </summary>
    private static ClassMetadata ExtractClassMetadata(
        Xunit.Abstractions.ITypeInfo testClass,
        bool isSpec,
        Type? classType,
        string className)
    {
        var title = FormatTestCaseTitle(className);
        string? description = null;
        string[]? tags = null;

        try
        {
            if (classType != null)
            {
                if (isSpec)
                {
                    var specAttr = classType.GetCustomAttribute<SpecificationAttribute>();
                    if (specAttr != null)
                    {
                        title = specAttr.GetDisplayName(classType);
                        description = specAttr.Description;
                    }
                }
                else
                {
                    var featureAttr = classType.GetCustomAttribute<FeatureAttribute>();
                    if (featureAttr != null)
                    {
                        title = featureAttr.GetDisplayName(classType);
                        description = featureAttr.Description;
                    }
                }

                tags = TagAttribute.GetTags(classType).NullIfEmpty();
                return new ClassMetadata(title, description?.Trim(), tags);
            }

            var attrType = isSpec ? typeof(SpecificationAttribute) : typeof(FeatureAttribute);
            var attrs = testClass.GetCustomAttributes(attrType);
            var attr = attrs.FirstOrDefault();
            if (attr != null)
            {
                var configuredTitle = GetAttributeString(attr, isSpec ? "Title" : "Name", 0);
                if (!string.IsNullOrWhiteSpace(configuredTitle))
                    title = configuredTitle;

                description = attr.GetNamedArgument<string>("Description");
            }

            tags = ExtractTags(testClass.GetCustomAttributes(typeof(TagAttribute)));
        }
        catch
        {
            // Don't let metadata extraction errors affect test execution
        }

        return new ClassMetadata(title, description?.Trim(), tags);
    }

    private static MethodMetadata ExtractMethodMetadata(
        Xunit.Abstractions.IMethodInfo testMethod,
        string kind,
        bool isSpec,
        MethodInfo? methodInfo,
        string displayName,
        string[]? classTags)
    {
        var title = StripKnownPrefix(displayName);
        string? description = null;
        string[]? methodTags = null;

        try
        {
            if (methodInfo != null)
            {
                var ruleAttribute = methodInfo.GetCustomAttribute<RuleAttribute>();
                title = kind switch
                {
                    "RuleOutline" => GetOutlineTemplateTitle(methodInfo, isSpecification: true),
                    "ScenarioOutline" => GetOutlineTemplateTitle(methodInfo, isSpecification: false),
                    "Rule" => ruleAttribute?.GetDisplayName(methodInfo) ?? StripKnownPrefix(displayName),
                    "Scenario" => StripKnownPrefix(methodInfo.GetCustomAttribute<ScenarioAttribute>()?.DisplayName ?? displayName),
                    _ => title
                };

                description = kind switch
                {
                    "RuleOutline" => methodInfo.GetCustomAttribute<RuleOutlineAttribute>()?.Description,
                    "ScenarioOutline" => methodInfo.GetCustomAttribute<ScenarioOutlineAttribute>()?.Description,
                    "Rule" => ruleAttribute?.GetDescription(methodInfo),
                    "Scenario" => methodInfo.GetCustomAttribute<ScenarioAttribute>()?.Description,
                    _ => null
                };

                methodTags = TagAttribute.GetTags(methodInfo.DeclaringType!, methodInfo).NullIfEmpty();
                return new MethodMetadata(title, description?.Trim(), methodTags);
            }

            if (kind == "RuleOutline" || kind == "ScenarioOutline")
                title = GetOutlineTemplateTitle(testMethod, isSpec);

            var attrType = kind switch
            {
                "RuleOutline" => typeof(RuleOutlineAttribute),
                "ScenarioOutline" => typeof(ScenarioOutlineAttribute),
                "Rule" => typeof(RuleAttribute),
                "Scenario" => typeof(ScenarioAttribute),
                _ => null
            };

            if (attrType != null)
            {
                var attr = testMethod.GetCustomAttributes(attrType).FirstOrDefault();
                description = attr?.GetNamedArgument<string>("Description");

                // Rule/RuleOutline descriptions are constructor values. Avoid treating
                // CallerMemberName-provided method names as user-authored descriptions.
                if (string.IsNullOrWhiteSpace(description) && attrType != typeof(ScenarioAttribute) && attrType != typeof(ScenarioOutlineAttribute))
                {
                    var ctorDescription = GetAttributeString(attr, "Description", 0);
                    if (!string.IsNullOrWhiteSpace(ctorDescription) &&
                        !string.Equals(ctorDescription, testMethod.Name, StringComparison.Ordinal))
                    {
                        description = ctorDescription;
                    }
                }
            }

            methodTags = MergeTags(classTags, ExtractTags(testMethod.GetCustomAttributes(typeof(TagAttribute))));
        }
        catch
        {
            // Don't let metadata extraction errors affect test execution
        }

        return new MethodMetadata(title, description?.Trim(), methodTags);
    }

    private static string StripKnownPrefix(string title)
    {
        return title
            .StripPrefix("Rule Outline: ")
            .StripPrefix("Scenario Outline: ")
            .StripPrefix("Rule: ")
            .StripPrefix("Scenario: ");
    }

    private static string? GetAttributeString(
        Xunit.Abstractions.IAttributeInfo? attr,
        string namedArgument,
        int constructorArgumentIndex)
    {
        if (attr == null)
            return null;

        try
        {
            var named = attr.GetNamedArgument<string>(namedArgument);
            if (!string.IsNullOrWhiteSpace(named))
                return named;
        }
        catch
        {
            // Fall back to constructor arguments below.
        }

        try
        {
            var ctorArgs = attr.GetConstructorArguments().ToList();
            if (ctorArgs.Count > constructorArgumentIndex &&
                ctorArgs[constructorArgumentIndex] is string ctorValue &&
                !string.IsNullOrWhiteSpace(ctorValue))
            {
                return ctorValue;
            }
        }
        catch
        {
            // Metadata extraction is best-effort.
        }

        return null;
    }

    private static string[]? ExtractTags(IEnumerable<Xunit.Abstractions.IAttributeInfo> tagAttrs)
    {
        var tags = new List<string>();
        foreach (var tagAttr in tagAttrs)
        {
            var tagsStr = GetAttributeString(tagAttr, "Tags", 0);
            if (!string.IsNullOrWhiteSpace(tagsStr))
            {
                tags.AddRange(tagsStr.Split(',').Select(t => t.Trim())
                    .Where(t => !string.IsNullOrEmpty(t)));
            }
        }

        return tags.Distinct(StringComparer.OrdinalIgnoreCase).ToArray().NullIfEmpty();
    }

    private static string[]? MergeTags(params string[]?[] tagSets)
    {
        return tagSets
            .Where(tags => tags != null)
            .SelectMany(tags => tags!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray()
            .NullIfEmpty();
    }

    /// <summary>
    /// Gets the template title for an outline test method (with &lt;placeholders&gt;).
    /// Mirrors LiveDocContext.GetOutlineTemplateTitle for the MessageSink fallback path.
    /// </summary>
    private static string GetOutlineTemplateTitle(Xunit.Abstractions.IMethodInfo testMethod, bool isSpec)
    {
        // Try to resolve actual MethodInfo via Type.GetMethod
        var classType = ResolveType(testMethod.Type.Name);
        var methodInfo = ResolveMethod(classType, testMethod.Name, testMethod);

        if (methodInfo != null)
            return GetOutlineTemplateTitle(methodInfo, isSpec);

        var attrType = isSpec ? typeof(RuleOutlineAttribute) : typeof(ScenarioOutlineAttribute);
        var attr = testMethod.GetCustomAttributes(attrType).FirstOrDefault();
        var configuredTitle = GetAttributeString(attr, isSpec ? "Description" : "DisplayName", 0);
        if (!string.IsNullOrWhiteSpace(configuredTitle) &&
            !string.Equals(configuredTitle, testMethod.Name, StringComparison.Ordinal))
        {
            return StripKnownPrefix(configuredTitle);
        }

        // Last resort: format method name with param names from IMethodInfo
        var iParamNames = testMethod.GetParameters().Select(p => p.Name).ToArray();
        return Core.ValueParser.FormatMethodNameAsTemplate(testMethod.Name, iParamNames);
    }

    private static string GetOutlineTemplateTitle(MethodInfo methodInfo, bool isSpecification)
    {
        var paramNames = methodInfo.GetParameters().Select(p => p.Name!).ToArray();
        var methodAsTitle = isSpecification
            ? "Rule Outline: " + methodInfo.Name.Replace("_", " ")
            : "Scenario Outline: " + methodInfo.Name.Replace("_", " ");

        if (isSpecification)
        {
            var ruleOutlineAttr = methodInfo.GetCustomAttribute<RuleOutlineAttribute>();
            if (!string.IsNullOrWhiteSpace(ruleOutlineAttr?.Description))
                return ruleOutlineAttr.Description;

            if (!string.IsNullOrWhiteSpace(ruleOutlineAttr?.DisplayName) &&
                !string.Equals(ruleOutlineAttr.DisplayName, methodAsTitle, StringComparison.Ordinal))
            {
                return StripKnownPrefix(ruleOutlineAttr.DisplayName);
            }
        }
        else
        {
            var scenarioOutlineAttr = methodInfo.GetCustomAttribute<ScenarioOutlineAttribute>();
            if (!string.IsNullOrWhiteSpace(scenarioOutlineAttr?.DisplayName) &&
                !string.Equals(scenarioOutlineAttr.DisplayName, methodAsTitle, StringComparison.Ordinal))
            {
                return StripKnownPrefix(scenarioOutlineAttr.DisplayName);
            }
        }

        return Core.ValueParser.FormatMethodNameAsTemplate(methodInfo.Name, paramNames);
    }
}

internal static class LiveDocReporterMetadataExtensions
{
    public static string StripPrefix(this string value, string prefix)
    {
        return value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? value.Substring(prefix.Length)
            : value;
    }

    public static string[]? NullIfEmpty(this string[] values)
    {
        return values.Length == 0 ? null : values;
    }
}
