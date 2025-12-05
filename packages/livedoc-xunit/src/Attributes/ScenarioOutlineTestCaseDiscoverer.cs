using Xunit.Abstractions;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Test case discoverer for ScenarioOutline attributes.
/// This allows custom display names to be shown in Test Explorer for data-driven tests.
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
        // For theory/data-driven tests, use xUnit's theory discovery
        // This will create one test case per [Example] attribute
        var defaultMethodDisplay = discoveryOptions.MethodDisplayOrDefault();
        var defaultMethodDisplayOptions = discoveryOptions.MethodDisplayOptionsOrDefault();

        // Simply return a theory test case - xUnit will handle the data discovery
        // through the [Example] attributes which inherit from DataAttribute
        yield return new XunitTheoryTestCase(
            _diagnosticMessageSink,
            defaultMethodDisplay,
            defaultMethodDisplayOptions,
            testMethod);
    }
}
