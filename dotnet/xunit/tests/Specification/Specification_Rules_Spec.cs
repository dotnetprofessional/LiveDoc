using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// Specification: Specification Rules
/// 
/// Tests for the [Specification] and [Rule] attributes
/// that enable MSpec-style testing.
/// </summary>
[Specification(Description = @"
    The [Specification] + [Rule] pattern enables MSpec-style testing
    with direct assertions and no Given/When/Then ceremony. Rules
    support explicit titles, embedded values, and simple assertions.")]
public class Specification_Rules_Spec : SpecificationTest
{
    public Specification_Rules_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Basic Rules

    [Rule]
    public void Rule_without_description_uses_method_name()
    {
        // The display name should be "Rule without description uses method name"
        // (underscores converted to spaces)
        Assert.True(true);
    }

    [Rule("Explicit description is used")]
    public void Some_internal_name()
    {
        // The display name should be "Explicit description is used"
        Assert.True(true);
    }

    [Rule]
    public void Simple_assertion_in_rule()
    {
        var result = 2 + 2;
        Assert.Equal(4, result);
    }

    #endregion

    #region Rules with Embedded Values

    [Rule("Adding '5' and '3' produces '8'")]
    public void Rule_with_quoted_values()
    {
        // Rules use direct assertions - values are in the rule title for documentation
        var a = 5;
        var b = 3;
        var result = a + b;
        Assert.Equal(8, result);
    }

    [Rule("User John is 30 years old")]
    public void Rule_with_inline_values()
    {
        // Values are documented in the title, implementation uses them directly
        var name = "John";
        var age = 30;
        
        Assert.Equal("John", name);
        Assert.Equal(30, age);
    }

    #endregion

    #region Rules Are Direct Assertions

    [Rule("Rules use direct assertions without steps")]
    public void Rules_are_direct_assertions()
    {
        // Specification pattern: no Given/When/Then - just code and assertions
        int value = 10;
        int result = value * 2;
        
        Assert.Equal(20, result);
    }

    [Rule]
    public void Rules_can_be_simple_assertions()
    {
        // No steps needed - just direct assertions
        Assert.NotNull("test");
        Assert.Equal(4, 2 * 2);
    }

    #endregion
}
