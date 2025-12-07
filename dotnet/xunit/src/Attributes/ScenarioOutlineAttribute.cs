using System.Runtime.CompilerServices;
using Xunit;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Marks a test method as a Scenario Outline (data-driven scenario) in BDD terminology.
/// Inherits from xUnit's TheoryAttribute.
/// Use with [Example] attributes to provide data rows.
/// </summary>
[XunitTestCaseDiscoverer("LiveDoc.xUnit.ScenarioOutlineTestCaseDiscoverer", "livedoc-xunit")]
[AttributeUsage(AttributeTargets.Method)]
public class ScenarioOutlineAttribute : TheoryAttribute
{
    /// <summary>
    /// Constructs a new instance of the ScenarioOutlineAttribute with an optional test method name.
    /// </summary>
    /// <param name="testMethodName">
    /// The name of the test method. This is optional and defaults to the name of the method that calls the constructor.
    /// The testMethodName is used in the DisplayName of the test, with underscores replaced by spaces for better readability.
    /// </param>
    public ScenarioOutlineAttribute([CallerMemberName] string testMethodName = "")
    {
        this.DisplayName = "Scenario Outline: " + testMethodName.Replace("_", " ");
    }

    public string? Description { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
}
