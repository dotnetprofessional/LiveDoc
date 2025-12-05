using Xunit.Sdk;

namespace LiveDoc.xUnit;

/// <summary>
/// Marks a test class as a Feature in BDD terminology.
/// The feature name is automatically derived from the class name unless explicitly specified.
/// </summary>
[TraitDiscoverer(FeatureDiscoverer.DiscovererTypeName, FeatureDiscoverer.AssemblyName)]
[AttributeUsage(AttributeTargets.Class)]
public class FeatureAttribute : Attribute, ITraitAttribute
{
    public FeatureAttribute(string? name = null)
    {
        this.Name = name;
    }

    public string? Name { get; set; }
    public string? Description { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Gets the display name for the feature, using the provided name or formatting the class name
    /// </summary>
    public string GetDisplayName(Type testClassType)
    {
        return this.Name ?? FormatName("Feature: " + testClassType.Name);
    }

    /// <summary>
    /// Formats a name by replacing underscores with spaces
    /// </summary>
    public static string FormatName(string name)
    {
        return name.Replace("_", " ");
    }
}
