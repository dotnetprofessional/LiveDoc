using System.Reflection;
using System.Runtime.CompilerServices;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit;

/// <summary>
/// DEPRECATED: Use FeatureTest for Gherkin/BDD tests or SpecificationTest for MSpec-style tests.
/// This class will be removed in a future version.
/// </summary>
[Obsolete("Use FeatureTest for Gherkin/BDD tests or SpecificationTest for MSpec-style tests.")]
public abstract class LiveDocTest : FeatureTest
{
    /// <summary>
    /// Constructor that receives xUnit's test output helper.
    /// </summary>
    protected LiveDocTest(ITestOutputHelper output) : base(output)
    {
    }
}
