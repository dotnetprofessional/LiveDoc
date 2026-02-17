using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Scenario;

/// <summary>
/// Specification: Scenario Statement
/// 
/// Unit tests for the [Scenario] attribute metadata.
/// </summary>
[Specification(Description = @"
    The [Scenario] attribute marks a method as a BDD scenario. It supports
    explicit display names (overriding the method name), descriptions,
    and tags for filtering.")]
public class Scenario_Statement_Spec : SpecificationTest
{
    public Scenario_Statement_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Attribute Properties

    [Rule("Scenario display name is formatted from method name")]
    public void Scenario_display_name_from_method()
    {
        var method = typeof(Scenario_Statement_Fixtures).GetMethod(nameof(Scenario_Statement_Fixtures.User_logs_in_successfully));
        var attr = method?.GetCustomAttributes(typeof(ScenarioAttribute), false)
            .FirstOrDefault() as ScenarioAttribute;
        
        Assert.NotNull(attr);
        Assert.Equal("Scenario: User logs in successfully", attr!.DisplayName);
    }

    [Rule("Scenario can have explicit display name")]
    public void Scenario_can_have_explicit_name()
    {
        var method = typeof(Scenario_Statement_Fixtures).GetMethod(nameof(Scenario_Statement_Fixtures.Named_scenario));
        var attr = method?.GetCustomAttributes(typeof(ScenarioAttribute), false)
            .FirstOrDefault() as ScenarioAttribute;
        
        Assert.NotNull(attr);
        // The display name replaces underscores with spaces
        Assert.Contains("Named scenario", attr!.DisplayName);
    }

    [Rule("Scenario can have description")]
    public void Scenario_can_have_description()
    {
        var method = typeof(Scenario_Statement_Fixtures).GetMethod(nameof(Scenario_Statement_Fixtures.Described_scenario));
        var attr = method?.GetCustomAttributes(typeof(ScenarioAttribute), false)
            .FirstOrDefault() as ScenarioAttribute;
        
        Assert.NotNull(attr?.Description);
        Assert.Contains("login flow", attr!.Description);
    }

    [Rule("Scenario can have tags")]
    public void Scenario_can_have_tags()
    {
        var method = typeof(Scenario_Statement_Fixtures).GetMethod(nameof(Scenario_Statement_Fixtures.Tagged_scenario));
        Assert.NotNull(method);
        
        var tags = TagAttribute.GetTags(typeof(Scenario_Statement_Fixtures), method!);
        
        Assert.Contains("happy-path", tags);
        Assert.Contains("auth", tags);
    }

    #endregion
}

#region Test Fixtures

/// <summary>
/// Helper fixture class for Scenario_Statement_Spec tests.
/// Not a real test - just provides methods to inspect via reflection.
/// </summary>
[Feature]
public class Scenario_Statement_Fixtures : FeatureTest
{
    public Scenario_Statement_Fixtures(ITestOutputHelper output) : base(output) { }
    
    [Scenario]
    public void User_logs_in_successfully() { }
    
    [Scenario]
    public void Named_scenario() { }
    
    [Scenario(Description = "Tests the complete login flow for registered users")]
    public void Described_scenario() { }
    
    [Tag("happy-path, auth")]
    [Scenario]
    public void Tagged_scenario() { }
}

#endregion
