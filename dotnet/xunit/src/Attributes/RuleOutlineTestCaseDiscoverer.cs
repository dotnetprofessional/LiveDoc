using System.Reflection;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Test case discoverer for RuleOutline attributes.
/// Uses XunitTheoryTestCase for grouped display in Test Explorer.
/// Example data injection happens via AsyncLocal in the custom invoker.
/// </summary>
public class RuleOutlineTestCaseDiscoverer : IXunitTestCaseDiscoverer
{
    private readonly IMessageSink _diagnosticMessageSink;

    public RuleOutlineTestCaseDiscoverer(IMessageSink diagnosticMessageSink)
    {
        _diagnosticMessageSink = diagnosticMessageSink;
    }

    public IEnumerable<IXunitTestCase> Discover(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo factAttribute)
    {
        // Validate paradigm usage
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(testMethod, "RuleOutline");
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
