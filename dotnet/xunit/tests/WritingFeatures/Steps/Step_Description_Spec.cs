using System.Reflection;
using System.Text.Json;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingFeatures.Steps;

[Feature("Step Descriptions", Description = @"
    Steps can include Markdown content beneath a concise title so important
    request and response contracts remain visible in living documentation.")]
[Tag("steps")]
public class Step_Description_Spec : FeatureTest
{
    public Step_Description_Spec(ITestOutputHelper output) : base(output) { }

    [Scenario("Synchronous and asynchronous steps retain inline Markdown descriptions")]
    public async Task Steps_retain_inline_markdown_descriptions()
    {
        string? synchronousDescription = null;
        string? asynchronousDescription = null;
        var myJsonVariable = JsonSerializer.Serialize(new { value = 11 });

        Given(
            title: "an increment request",
            description: $"""
                ### Input

                ```json
                {myJsonVariable}
                ```
                """,
            step: ctx => synchronousDescription = ctx.Step!.Description);

        await When(
            title: "the value is incremented",
            description: "The mapping adds `1` to the supplied value.",
            step: async ctx =>
            {
                await Task.Yield();
                asynchronousDescription = ctx.Step!.Description;
            });

        Then("both step descriptions remain available", () =>
        {
            Assert.Contains(myJsonVariable, synchronousDescription);
            Assert.DoesNotContain(JsonSerializer.Serialize(myJsonVariable), synchronousDescription);
            Assert.Equal("The mapping adds `1` to the supplied value.", asynchronousDescription);
        });

        And("all step keywords expose title, description, then callback overloads", () =>
        {
            var expectedCallbacks = new HashSet<Type>
            {
                typeof(Action),
                typeof(Action<LiveDocContext>),
                typeof(Func<Task>),
                typeof(Func<LiveDocContext, Task>)
            };

            foreach (var keyword in new[] { "Given", "When", "Then", "And", "But" })
            {
                var callbackTypes = typeof(FeatureTest)
                    .GetMethods(BindingFlags.Instance | BindingFlags.NonPublic)
                    .Where(method => method.Name == keyword)
                    .Select(method => method.GetParameters())
                    .Where(parameters =>
                        parameters.Length == 3 &&
                        parameters[0].ParameterType == typeof(string) &&
                        parameters[1].ParameterType == typeof(string))
                    .Select(parameters => parameters[2].ParameterType)
                    .ToHashSet();

                Assert.True(
                    expectedCallbacks.SetEquals(callbackTypes),
                    $"{keyword} must expose title, description, then callback for every callback shape.");
            }
        });
    }

    [ScenarioOutline("Outline value '<value>' binds in the runtime description")]
    [Example(11)]
    public void Outline_descriptions_bind_for_runtime_use(int value)
    {
        string? observedDescription = null;

        Given(
            title: "an increment request for <value>",
            description: """
                Values must be < 100.

                ```json
                {"value":<value>}
                ```
                """,
            step: ctx => observedDescription = ctx.Step!.Description);

        When("the runtime description is read", () => { });

        Then("the JSON contains the selected value", () =>
            Assert.Contains($$"""{"value":{{value}}}""", observedDescription));
    }
}
