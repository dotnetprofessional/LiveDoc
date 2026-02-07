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
        var featureName = traitAttribute.GetNamedArgument<string>("Name");

        if (!string.IsNullOrWhiteSpace(featureName))
        {
            // Show as "Feature: Name" in Test Explorer
            yield return new KeyValuePair<string, string>($"Feature: {featureName}", "");
        }
        else
        {
            // No explicit name - just show "Feature" category
            yield return new KeyValuePair<string, string>("Feature", "");
        }
    }
}
