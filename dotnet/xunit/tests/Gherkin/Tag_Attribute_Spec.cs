using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Gherkin;

/// <summary>
/// Feature: Tag Attribute
/// 
/// Tests for the [Tag] attribute used to categorize and filter tests.
/// Tags can be applied to classes and test methods, and are merged from both levels.
/// </summary>
[Specification(Description = @"
    The [Tag] attribute enables categorization and filtering of tests.
    Tags can be applied at class and method level, are merged together,
    and deduplicated in a case-insensitive manner.")]
public class Tag_Attribute_Spec : SpecificationTest
{
    public Tag_Attribute_Spec(ITestOutputHelper output) : base(output) { }

    #region Parsing

    [Rule("Single tag is parsed correctly")]
    public void Single_tag()
    {
        var attr = new TagAttribute("smoke");
        Assert.Single(attr.Tags);
        Assert.Equal("smoke", attr.Tags[0]);
    }

    [Rule("Comma-separated tags are parsed into individual values")]
    public void Comma_separated_tags()
    {
        var attr = new TagAttribute("smoke, regression, integration");
        Assert.Equal(3, attr.Tags.Length);
        Assert.Equal("smoke", attr.Tags[0]);
        Assert.Equal("regression", attr.Tags[1]);
        Assert.Equal("integration", attr.Tags[2]);
    }

    [Rule("Whitespace around tags is trimmed")]
    public void Whitespace_trimmed()
    {
        var attr = new TagAttribute("  smoke ,  regression  ");
        Assert.Equal(2, attr.Tags.Length);
        Assert.Equal("smoke", attr.Tags[0]);
        Assert.Equal("regression", attr.Tags[1]);
    }

    [Rule("Empty strings produce no tags")]
    public void Empty_string()
    {
        var attr = new TagAttribute("");
        Assert.Empty(attr.Tags);
    }

    #endregion

    #region Class-Level Tags

    [Rule("Tags on a class are collected")]
    public void Class_level_tags()
    {
        var tags = TagAttribute.GetTags(typeof(ClassWithTags));
        Assert.Contains("feature-tag", tags);
    }

    [Rule("Multiple Tag attributes on a class are merged")]
    public void Multiple_class_tags()
    {
        var tags = TagAttribute.GetTags(typeof(ClassWithMultipleTags));
        Assert.Contains("smoke", tags);
        Assert.Contains("regression", tags);
        Assert.Contains("integration", tags);
    }

    #endregion

    #region Method-Level Tags

    [Rule("Tags on a method are collected")]
    public void Method_level_tags()
    {
        var method = typeof(ClassWithMethodTags).GetMethod(nameof(ClassWithMethodTags.Tagged_method))!;
        var tags = TagAttribute.GetTags(typeof(ClassWithMethodTags), method);
        Assert.Contains("method-tag", tags);
    }

    #endregion

    #region Tag Merging

    [Rule("Class and method tags are merged")]
    public void Tags_are_merged()
    {
        var method = typeof(ClassWithBothTags).GetMethod(nameof(ClassWithBothTags.Tagged_method))!;
        var tags = TagAttribute.GetTags(typeof(ClassWithBothTags), method);
        Assert.Contains("class-tag", tags);
        Assert.Contains("method-tag", tags);
    }

    [Rule("Duplicate tags are deduplicated")]
    public void Duplicates_removed()
    {
        var method = typeof(ClassWithDuplicateTags).GetMethod(nameof(ClassWithDuplicateTags.Tagged_method))!;
        var tags = TagAttribute.GetTags(typeof(ClassWithDuplicateTags), method);
        
        var smokeCount = tags.Count(t => t.Equals("smoke", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(1, smokeCount);
    }

    [Rule("Deduplication is case-insensitive")]
    public void Case_insensitive_dedup()
    {
        var method = typeof(ClassWithCaseDuplicates).GetMethod(nameof(ClassWithCaseDuplicates.Tagged_method))!;
        var tags = TagAttribute.GetTags(typeof(ClassWithCaseDuplicates), method);
        
        var smokeCount = tags.Count(t => t.Equals("smoke", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(1, smokeCount);
    }

    #endregion

    #region No Tags

    [Rule("Class without tags returns empty array")]
    public void No_tags_returns_empty()
    {
        var tags = TagAttribute.GetTags(typeof(ClassWithoutTags));
        Assert.Empty(tags);
    }

    #endregion
}

#region Test Fixtures

[Tag("feature-tag")]
[Feature]
public class ClassWithTags : FeatureTest
{
    public ClassWithTags(ITestOutputHelper output) : base(output) { }
}

[Tag("smoke, regression")]
[Tag("integration")]
[Feature]
public class ClassWithMultipleTags : FeatureTest
{
    public ClassWithMultipleTags(ITestOutputHelper output) : base(output) { }
}

[Feature]
public class ClassWithMethodTags : FeatureTest
{
    public ClassWithMethodTags(ITestOutputHelper output) : base(output) { }
    
    [Tag("method-tag")]
    [Scenario]
    public void Tagged_method() { }
}

[Tag("class-tag")]
[Feature]
public class ClassWithBothTags : FeatureTest
{
    public ClassWithBothTags(ITestOutputHelper output) : base(output) { }
    
    [Tag("method-tag")]
    [Scenario]
    public void Tagged_method() { }
}

[Tag("smoke")]
[Feature]
public class ClassWithDuplicateTags : FeatureTest
{
    public ClassWithDuplicateTags(ITestOutputHelper output) : base(output) { }
    
    [Tag("smoke")]
    [Scenario]
    public void Tagged_method() { }
}

[Tag("SMOKE")]
[Feature]
public class ClassWithCaseDuplicates : FeatureTest
{
    public ClassWithCaseDuplicates(ITestOutputHelper output) : base(output) { }
    
    [Tag("smoke")]
    [Scenario]
    public void Tagged_method() { }
}

[Feature]
public class ClassWithoutTags : FeatureTest
{
    public ClassWithoutTags(ITestOutputHelper output) : base(output) { }
}

#endregion
