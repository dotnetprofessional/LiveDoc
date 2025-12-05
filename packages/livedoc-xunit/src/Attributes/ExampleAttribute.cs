using System.Reflection;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Provides a data row for a Scenario Outline.
/// Use positional parameters: [Example("Australia", 100.00, "Free")]
/// </summary>
/// <summary>
/// An attribute to define example data for a ScenarioOutline or RuleOutline in a Behavior-Driven Development (BDD) style.
/// It can be used in place of the built-in InlineData, as provides the same functionality.
/// </summary>
/// <remarks>
/// This attribute inherits from DataAttribute, allowing it to provide data for a parameterized test
/// (a test method marked with ScenarioOutline or RuleOutline attribute). When applied to a method, the test runner will run
/// the test method once for each ExampleAttribute, passing the parameters of the ExampleAttribute to
/// the test method. The test runner calls the GetData method to get the data for each run of the test.
/// </remarks>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
[DataDiscoverer("Xunit.Sdk.InlineDataDiscoverer", "xunit.core")]
public class ExampleAttribute : DataAttribute
{
    /// <summary>
    /// The example data to be passed to the test method.
    /// </summary>
    private readonly object[] _data;

    /// <summary>
    /// Constructs a new instance of ExampleAttribute with the given data.
    /// </summary>
    /// <param name="data">The example data to be passed to the test method.</param>
    public ExampleAttribute(params object[] data)
    {
        _data = data;
    }

    /// <summary>
    /// Returns the example data provided to the constructor as an enumerable of object arrays.
    /// Each object array contains the parameters to be passed to the test method for one run of the test.
    /// </summary>
    /// <param name="testMethod">The method that is being tested</param>
    /// <returns>An enumerable of object arrays, each array containing the parameters for one run of the test</returns>
    public override IEnumerable<object[]> GetData(MethodInfo testMethod)
    {
        yield return _data;
    }
}
