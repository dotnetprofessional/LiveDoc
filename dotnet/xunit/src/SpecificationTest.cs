using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Base class for MSpec-style specification tests.
/// Use with [Specification] class attribute and [Rule] or [RuleOutline] method attributes.
/// </summary>
/// <remarks>
/// Unlike FeatureTest, SpecificationTest does not provide Given/When/Then steps.
/// Rules contain direct assertions without the ceremony of Gherkin steps.
/// </remarks>
/// <example>
/// <code>
/// [Specification("Calculator Rules")]
/// public class CalculatorSpec : SpecificationTest
/// {
///     public CalculatorSpec(ITestOutputHelper output) : base(output) { }
///     
///     [Rule("Adding positive numbers increases the value")]
///     public void Adding_positive_numbers()
///     {
///         var result = 5 + 3;
///         Assert.Equal(8, result);
///     }
///     
///     [RuleOutline("Multiplication of _A by _B equals _RESULT")]
///     [Example(2, 3, 6)]
///     [Example(4, 5, 20)]
///     public void Multiplication(int a, int b, int result)
///     {
///         Assert.Equal(result, a * b);
///     }
/// }
/// </code>
/// </example>
public abstract class SpecificationTest : LiveDocTestBase
{
    /// <summary>
    /// Constructor that receives xUnit's test output helper.
    /// </summary>
    protected SpecificationTest(ITestOutputHelper output) : base(output)
    {
    }

    /// <summary>
    /// Access to the current specification context.
    /// </summary>
    protected SpecificationContext Specification
    {
        get
        {
            EnsureContext();
            return _context!.Specification;
        }
    }

    /// <summary>
    /// Access to the current rule context.
    /// </summary>
    protected RuleContext Rule
    {
        get
        {
            EnsureContext();
            return _context!.Rule;
        }
    }

    /// <summary>
    /// Access to the current example data (for rule outlines).
    /// Use Example.PropertyName to access values.
    /// </summary>
    protected dynamic? Example
    {
        get
        {
            EnsureContext();
            return _context!.Example;
        }
    }
}
