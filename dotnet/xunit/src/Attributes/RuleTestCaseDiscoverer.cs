using Xunit.Abstractions;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Test case discoverer for Rule attributes.
/// Validates that Rule is used with [Specification] class attribute.
/// </summary>
public class RuleTestCaseDiscoverer : IXunitTestCaseDiscoverer
{
    private readonly IMessageSink _diagnosticMessageSink;

    public RuleTestCaseDiscoverer(IMessageSink diagnosticMessageSink)
    {
        _diagnosticMessageSink = diagnosticMessageSink;
    }

    public IEnumerable<IXunitTestCase> Discover(
        ITestFrameworkDiscoveryOptions discoveryOptions,
        ITestMethod testMethod,
        IAttributeInfo factAttribute)
    {
        // Validate paradigm usage
        var violation = LiveDocParadigmValidator.ValidateSpecificationMethod(testMethod, "Rule");
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
