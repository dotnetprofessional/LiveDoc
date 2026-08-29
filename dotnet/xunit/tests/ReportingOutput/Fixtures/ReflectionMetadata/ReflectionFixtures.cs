using SweDevTools.LiveDoc.xUnit;

namespace SweDevTools.LiveDoc.xUnit.Tests.FilteringAndTags
{
    [Tag("feature-tag")]
    [Feature("Tag Class Helper")]
    public sealed class ClassWithTags { }

    [Tag("smoke, regression")]
    [Tag("integration")]
    [Feature("Tag Multiple Helper")]
    public sealed class ClassWithMultipleTags { }

    [Feature("Tag Method Helper")]
    public sealed class ClassWithMethodTags
    {
        [Tag("method-tag")]
        [Scenario]
        public void Tagged_method() { }
    }

    [Tag("class-tag")]
    [Feature("Tag Merge Helper")]
    public sealed class ClassWithBothTags
    {
        [Tag("method-tag")]
        [Scenario]
        public void Tagged_method() { }
    }

    [Tag("smoke")]
    [Feature("Tag Dedup Helper")]
    public sealed class ClassWithDuplicateTags
    {
        [Tag("smoke")]
        [Scenario]
        public void Tagged_method() { }
    }

    [Tag("SMOKE")]
    [Feature("Tag Case Dedup Helper")]
    public sealed class ClassWithCaseDuplicates
    {
        [Tag("smoke")]
        [Scenario]
        public void Tagged_method() { }
    }

    [Feature("Tag Empty Helper")]
    public sealed class ClassWithoutTags { }
}

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingFeatures.Scenario
{
    [Feature("Scenario Statement Fixtures")]
    public sealed class Scenario_Statement_Fixtures
    {
        [Scenario]
        public void User_logs_in_successfully() { }

        [Scenario]
        public void Named_scenario() { }

        [Scenario(Description = "Tests the complete login flow for registered users")]
        public void Described_scenario() { }

        [Tag("happy-path, auth")]
        [Scenario]
        public void Tagged_scenario() { }
    }

    [Feature("Scenario Outline Attribute Fixtures")]
    public sealed class Scenario_Outline_Attribute_Fixtures
    {
        [ScenarioOutline(Description = "This is a data-driven test")]
        [Example(1)]
        public void Described_outline(int value) => _ = value;

        [Tag("edge-cases, boundary")]
        [ScenarioOutline]
        [Example(1)]
        public void Tagged_outline(int value) => _ = value;

        [ScenarioOutline]
        [Example(1, "one")]
        [Example(2, "two")]
        public void With_examples(int number, string word)
        {
            _ = number;
            _ = word;
        }
    }
}
