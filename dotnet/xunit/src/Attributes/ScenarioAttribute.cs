using System.Runtime.CompilerServices;
using Xunit;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Marks a test method as a Scenario in BDD terminology.
/// Inherits from xUnit's FactAttribute.
/// </summary>
[XunitTestCaseDiscoverer("SweDevTools.LiveDoc.xUnit.ScenarioTestCaseDiscoverer", "livedoc-xunit")]
[AttributeUsage(AttributeTargets.Method)]
public class ScenarioAttribute : FactAttribute
{
    /// <summary>
    /// Constructs a new instance of the ScenarioAttribute with an optional test method name.
    /// </summary>
    /// <param name="title">
    /// The name of the test method. This is optional and defaults to the name of the method that calls the constructor.
    /// A title supplied through nameof(...) also has underscores replaced by spaces.
    /// </param>
    public ScenarioAttribute(
        [CallerMemberName] string title = "",
        [CallerArgumentExpression(nameof(title))] string? titleExpression = null)
    {
        DisplayName = "Scenario: " +
            AttributeTitleFormatter.FormatMemberName(title, titleExpression);
    }

    public string? Description { get; set; }
}
