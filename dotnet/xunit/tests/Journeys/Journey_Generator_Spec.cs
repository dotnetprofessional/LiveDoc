using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification("Journey Generator", Description = "Journey generator emits LiveDoc test code with configurable namespace and fixture types.")]
[Tag("journeys")]
public class Journey_Generator_Spec : SpecificationTest
{
    public Journey_Generator_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule("Path derivation maps journey folders to PascalCase output paths")]
    public void Path_derivation_maps_journey_folders()
    {
        var output = PathDeriver.DeriveOutputPath("api/ai-services/_ai-services.http");
        var expected = Path.Combine("Api", "AiServices.Journey.cs");
        Assert.Equal(expected, output);
    }

    [Rule("Code emitter shares configured fixture type through one collection")]
    public void Code_emitter_uses_configured_namespace_and_fixture()
    {
        var journey = new JourneyFile(
            "api/chat-completions/_chat-completions.http",
            "Chat Completions API",
            null,
            [],
            [new JourneyScenario("Simple scenario", [new JourneyStep("Given", "a chat request", "simpleChat")])]);

        var options = new GeneratorOptions(
            "Acme.Specs.Journeys",
            "Acme.Specs.Journeys.Infrastructure",
            "JourneyServerFixture");

        var code = CodeEmitter.Emit(journey, ["simpleChat"], options);

        Assert.Contains("namespace Acme.Specs.Journeys.Api;", code);
        Assert.Contains("[Collection(JourneyServerFixtureCollection.Name)]", code);
        Assert.DoesNotContain("IClassFixture<JourneyServerFixture>", code);
        Assert.Contains("using Acme.Specs.Journeys.Infrastructure;", code);

        var collectionCode = CodeEmitter.EmitCollectionDefinition(options);
        Assert.Contains("namespace Acme.Specs.Journeys.Infrastructure;", collectionCode);
        Assert.Contains(
            "JourneyServerFixtureCollection : ICollectionFixture<JourneyServerFixture>",
            collectionCode);
    }

    [Rule("Scaffold migration replaces only the per-class fixture declaration")]
    public void Scaffold_migration_preserves_developer_owned_test_body()
    {
        var journey = new JourneyFile(
            "api/chat-completions/_chat-completions.http",
            "Chat Completions API",
            null,
            [],
            [new JourneyScenario("Simple scenario", [])]);
        var options = new GeneratorOptions(
            "Acme.Specs.Journeys",
            "Acme.Specs.Journeys.Infrastructure",
            "JourneyServerFixture");
        const string developerOwnedCode = """
            [Feature("Chat Completions")]
            public class ChatCompletions_Journey : FeatureTest, IClassFixture<JourneyServerFixture>
            {
                // Developer-owned assertion remains unchanged.
            }
            """;

        var migrated = CodeEmitter.TryMigrateFixtureLifecycle(
            developerOwnedCode,
            journey,
            options,
            out var migratedCode);

        Assert.True(migrated);
        Assert.Contains("[Collection(JourneyServerFixtureCollection.Name)]", migratedCode);
        Assert.Contains("public class ChatCompletions_Journey : FeatureTest", migratedCode);
        Assert.DoesNotContain("IClassFixture<JourneyServerFixture>", migratedCode);
        Assert.Contains("// Developer-owned assertion remains unchanged.", migratedCode);
    }

    [Rule("Collection type keeps fully qualified fixture names collision-safe")]
    public void Collection_type_uses_qualified_fixture_name()
    {
        var options = new GeneratorOptions(
            "Acme.Specs.Journeys",
            "Acme.Specs.Journeys.Infrastructure",
            "Acme.Inventory.JourneyServerFixture");

        Assert.Equal(
            "Acme_Inventory_JourneyServerFixtureCollection",
            CodeEmitter.GetCollectionTypeName(options));
    }

    [Rule("Real LLM tag emits credential guard against configured fixture type")]
    public void Real_llm_tag_emits_fixture_guard()
    {
        var journey = new JourneyFile(
            "real/chat-completions/_chat-completions.http",
            "Real LLM",
            null,
            ["real-llm"],
            [new JourneyScenario("Call real model", [new JourneyStep("Given", "credentials exist", "callReal")])]);

        var options = new GeneratorOptions(
            "Acme.Specs.Journeys",
            "Acme.Specs.Journeys.Infrastructure",
            "CustomFixture");

        var code = CodeEmitter.Emit(journey, [], options);

        Assert.Contains("if (!CustomFixture.HasAzureCredentials)", code);
        Assert.Contains("[Trait(\"Category\", \"RealLLM\")]", code);
    }
}
