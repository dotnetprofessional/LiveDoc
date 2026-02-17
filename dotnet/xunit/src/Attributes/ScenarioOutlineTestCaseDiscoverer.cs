using System.Reflection;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Test case discoverer for ScenarioOutline attributes.
/// Uses XunitTheoryTestCase for grouped display in Test Explorer.
/// Example data injection happens via AsyncLocal in the custom invoker.
/// </summary>
public class ScenarioOutlineTestCaseDiscoverer : IXunitTestCaseDiscoverer
{
    private readonly IMessageSink _diagnosticMessageSink;

    public ScenarioOutlineTestCaseDiscoverer(IMessageSink diagnosticMessageSink)
    {
        _diagnosticMessageSink = diagnosticMessageSink;
    }

    public IEnumerable<IXunitTestCase> Discover(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo factAttribute)
    {
        // Validate paradigm usage
        var violation = LiveDocParadigmValidator.ValidateGherkinMethod(testMethod, "ScenarioOutline");
        if (violation != null)
        {
            yield return LiveDocParadigmValidator.CreateViolationTestCase(
                _diagnosticMessageSink, testMethod, violation);
            yield break;
        }

        // Use XunitTheoryTestCase for grouped display - it handles data enumeration internally
        yield return new LiveDocTheoryTestCase(
            _diagnosticMessageSink,
            discoveryOptions.MethodDisplayOrDefault(),
            discoveryOptions.MethodDisplayOptionsOrDefault(),
            testMethod);
    }
}
