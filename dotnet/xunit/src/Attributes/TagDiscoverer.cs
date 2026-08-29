using Xunit.Abstractions;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Exposes LiveDoc tags as xUnit Category traits for test-runner filtering.
/// </summary>
public class TagDiscoverer : ITraitDiscoverer
{
    internal const string AssemblyName = "livedoc-xunit";
    internal const string DiscovererTypeName = "SweDevTools.LiveDoc.xUnit." + nameof(TagDiscoverer);

    public IEnumerable<KeyValuePair<string, string>> GetTraits(IAttributeInfo traitAttribute)
    {
        var constructorArguments = traitAttribute.GetConstructorArguments().ToList();
        if (constructorArguments.Count == 0 || constructorArguments[0] is not string rawTags)
            yield break;

        foreach (var tag in TagAttribute.ParseTags(rawTags).Distinct(StringComparer.OrdinalIgnoreCase))
            yield return new KeyValuePair<string, string>("Category", tag);
    }
}
