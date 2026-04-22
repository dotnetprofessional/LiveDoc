using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = "Journey generator emits LiveDoc test code with configurable namespace and fixture types.")]
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

    [Rule("Code emitter uses configured base namespace and fixture type")]
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
        Assert.Contains("IClassFixture<JourneyServerFixture>", code);
        Assert.Contains("using Acme.Specs.Journeys.Infrastructure;", code);
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
