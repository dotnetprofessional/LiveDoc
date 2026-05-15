using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.FrameworkInternals.AttributeDefaults;

/// <summary>
/// A simple specification without an explicit title.
/// </summary>
[Specification(Description = @"
    A [Specification] with no explicit title still functions
    correctly, deriving its identity from the class name.")]
public class Minimal_Specification_Spec : SpecificationTest
{
    public Minimal_Specification_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule]
    public void Minimal_specification_works()
    {
        Assert.True(true);
    }
}
