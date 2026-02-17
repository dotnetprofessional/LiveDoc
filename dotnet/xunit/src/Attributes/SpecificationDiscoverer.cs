using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Trait discoverer for Specification attributes.
/// Displays the specification name in Test Explorer as a trait.
/// </summary>
public class SpecificationDiscoverer : ITraitDiscoverer
{
    internal const string AssemblyName = "livedoc-xunit";
    internal const string DiscovererTypeName = "SweDevTools.LiveDoc.xUnit." + nameof(SpecificationDiscoverer);

    public IEnumerable<KeyValuePair<string, string>> GetTraits(IAttributeInfo traitAttribute)
    {
        var title = traitAttribute.GetNamedArgument<string>("Title");

        if (!string.IsNullOrWhiteSpace(title))
        {
            // Show as "Specification: Title" in Test Explorer
            yield return new KeyValuePair<string, string>($"Specification: {title}", "");
        }
        else
        {
            // No explicit title - just show "Specification" category
            yield return new KeyValuePair<string, string>("Specification", "");
        }
    }
}
