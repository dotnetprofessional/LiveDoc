using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Test case discoverer for Scenario attributes.
/// Validates that Scenario is used with [Feature] class attribute.
/// </summary>
public class ScenarioTestCaseDiscoverer : IXunitTestCaseDiscoverer
{
    private readonly IMessageSink _diagnosticMessageSink;

    public ScenarioTestCaseDiscoverer(IMessageSink diagnosticMessageSink)
    {
        _diagnosticMessageSink = diagnosticMessageSink;
    }

    public IEnumerable<IXunitTestCase> Discover(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo factAttribute)
    {
        // Validate paradigm usage
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(testMethod, "Scenario");
        if (violation != null)
        {
            yield return LiveDocParadigmValidator.CreateViolationTestCase(
                _diagnosticMessageSink, testMethod, violation);
            yield break;
        }

        // Valid - create normal test case
        yield return new XunitTestCase(
            _diagnosticMessageSink,
            discoveryOptions.MethodDisplayOrDefault(),
            discoveryOptions.MethodDisplayOptionsOrDefault(),
            testMethod);
    }
}
