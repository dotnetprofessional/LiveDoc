using LiveDoc.xUnit;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// A simple specification without description.
/// </summary>
[Specification]
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
