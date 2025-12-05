using Xunit.Abstractions;
using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Trait discoverer for Feature attributes.
/// Displays the feature name in Test Explorer as a trait.
/// </summary>
public class FeatureDiscoverer : ITraitDiscoverer
{
    internal const string AssemblyName = "livedoc-xunit";
    internal const string DiscovererTypeName = "LiveDoc.xUnit." + nameof(FeatureDiscoverer);

    public IEnumerable<KeyValuePair<string, string>> GetTraits(IAttributeInfo traitAttribute)
    {
        var categoryName = traitAttribute.GetNamedArgument<string>("Name");

        if (!string.IsNullOrWhiteSpace(categoryName))
            yield return new KeyValuePair<string, string>("Feature: " + categoryName, "");
    }
}
