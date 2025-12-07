using System.Runtime.CompilerServices;
using Xunit;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Marks a test method as a Scenario in BDD terminology.
/// Inherits from xUnit's FactAttribute.
/// </summary>
[XunitTestCaseDiscoverer("LiveDoc.xUnit.ScenarioTestCaseDiscoverer", "livedoc-xunit")]
[AttributeUsage(AttributeTargets.Method)]
public class ScenarioAttribute : FactAttribute
{
    /// <summary>
    /// Constructs a new instance of the ScenarioAttribute with an optional test method name.
    /// </summary>
    /// <param name="testMethodName">
    /// The name of the test method. This is optional and defaults to the name of the method that calls the constructor.
    /// The testMethodName is used in the DisplayName of the test, with underscores replaced by spaces for better readability.
    /// </param>
    public ScenarioAttribute([CallerMemberName] string testMethodName = "")
    {
        this.DisplayName = "Scenario: " + testMethodName.Replace("_", " ");
    }

    public string? Description { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
}
