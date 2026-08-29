using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Test case discoverer for ScenarioOutline attributes.
/// Uses xUnit's normal theory pre-enumeration rules so serializable examples
/// receive concrete per-row display names while unsupported rows retain the
/// runtime-enumerated theory fallback.
/// </summary>
public class ScenarioOutlineTestCaseDiscoverer : TheoryDiscoverer
{
    public ScenarioOutlineTestCaseDiscoverer(IMessageSink diagnosticMessageSink)
        : base(diagnosticMessageSink)
    {
    }

    public override IEnumerable<IXunitTestCase> Discover(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo factAttribute)
    {
        // Validate paradigm usage
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(testMethod, "ScenarioOutline");
        if (violation != null)
        {
            return
            [
                LiveDocParadigmValidator.CreateViolationTestCase(
                    DiagnosticMessageSink, testMethod, violation)
            ];
        }

        var testCases = base.Discover(discoveryOptions, testMethod, factAttribute).ToList();
        var rowIndex = 0;
        foreach (var testCase in testCases.OfType<LiveDocScenarioOutlineTestCase>())
            testCase.SetOutlineRowIndex(rowIndex++);

        return testCases;
    }

    protected override IEnumerable<IXunitTestCase> CreateTestCasesForDataRow(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo theoryAttribute,
        object[] dataRow)
    {
        return
        [
            new LiveDocScenarioOutlineTestCase(
                DiagnosticMessageSink,
                discoveryOptions.MethodDisplayOrDefault(),
                discoveryOptions.MethodDisplayOptionsOrDefault(),
                testMethod,
                dataRow)
        ];
    }

    protected override IEnumerable<IXunitTestCase> CreateTestCasesForSkippedDataRow(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo theoryAttribute,
        object[] dataRow,
        string skipReason)
    {
        return
        [
            new LiveDocScenarioOutlineTestCase(
                DiagnosticMessageSink,
                discoveryOptions.MethodDisplayOrDefault(),
                discoveryOptions.MethodDisplayOptionsOrDefault(),
                testMethod,
                dataRow,
                0,
                skipReason)
        ];
    }

    protected override IEnumerable<IXunitTestCase> CreateTestCasesForSkip(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo theoryAttribute,
        string skipReason)
    {
        return
        [
            new LiveDocScenarioOutlineTestCase(
                DiagnosticMessageSink,
                discoveryOptions.MethodDisplayOrDefault(),
                discoveryOptions.MethodDisplayOptionsOrDefault(),
                testMethod,
                testMethodArguments: null,
                outlineRowIndex: -1,
                dataRowSkipReason: skipReason)
        ];
    }

    protected override IEnumerable<IXunitTestCase> CreateTestCasesForTheory(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo theoryAttribute)
    {
        return
        [
            new LiveDocTheoryTestCase(
                DiagnosticMessageSink,
                discoveryOptions.MethodDisplayOrDefault(),
                discoveryOptions.MethodDisplayOptionsOrDefault(),
                testMethod)
        ];
    }
}
