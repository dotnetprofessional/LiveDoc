using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Steps;

/// <summary>
/// Feature: Step Named Values
/// 
/// Step statements can include named values using the <name:value> syntax.
/// These values are extracted and made available via ctx.Step.Params["name"].
/// </summary>
[Feature("Step Named Values", Description = @"
    Named values in step descriptions use the <name:value> syntax.
    They are extracted and accessible via ctx.Step.Params dictionary.
    The display title shows only the value (name is removed).
")]
public class Step_Named_Values_Spec : FeatureTest
{
    public Step_Named_Values_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Scenario]
    public void Step_statement_has_named_values()
    {
        string? name = null;
        int? age = null;
        
        Given("a user with <name:John> and <age:30> years old", ctx =>
        {
            name = ctx.Step!.Params["name"].AsString();
            age = ctx.Step!.Params["age"].AsInt();
        });

        When("the step is parsed", () => { });

        Then("the params should contain the named values", () =>
        {
            Assert.Equal("John", name);
            Assert.Equal(30, age);
        });
    }

    [Scenario]
    public void Step_statement_has_named_values_with_different_types()
    {
        bool? active = null;
        int? count = null;
        
        Given("a config with <active:true> and <count:10>", ctx =>
        {
            active = ctx.Step!.Params["active"].AsBool();
            count = ctx.Step!.Params["count"].AsInt();
        });

        When("the step is parsed", () => { });

        Then("the params should be correctly coerced", () =>
        {
            Assert.True(active);
            Assert.Equal(10, count);
        });
    }

    [Scenario]
    public void Step_statement_has_both_quoted_and_named_values()
    {
        int? age = null;
        List<string>? quotedValues = null;
        
        Given("a user 'John' with <age:30> and 'active' status", ctx =>
        {
            age = ctx.Step!.Params["age"].AsInt();
            quotedValues = new List<string>();
            for (int i = 0; i < ctx.Step!.Values.Count; i++)
            {
                quotedValues.Add(ctx.Step!.Values[i].AsString());
            }
        });

        When("the step is parsed", () => { });

        Then("both should be extracted correctly", () =>
        {
            Assert.Equal(30, age);
            Assert.Equal(new[] { "John", "active" }, quotedValues);
        });
    }

    [Scenario]
    public void Step_statement_has_named_values_with_spaces()
    {
        string? userName = null;
        int? userAge = null;
        
        Given("a user with <user name:John> and <user age:30>", ctx =>
        {
            // Spaces in param names are preserved - access with exact name
            userName = ctx.Step!.Params["user name"].AsString();
            userAge = ctx.Step!.Params["user age"].AsInt();
        });

        When("the step is parsed", () => { });

        Then("the names should preserve spaces (use exact name to access)", () =>
        {
            Assert.Equal("John", userName);
            Assert.Equal(30, userAge);
        });
    }

    [Scenario]
    public void Named_values_without_colon_are_not_params()
    {
        int? paramCount = null;
        
        Given("a step with <named:value> and <placeholder>", ctx =>
        {
            paramCount = ctx.Step!.Params.Count;
        });

        When("the step is parsed", () => { });

        Then("only the colon-syntax should be in params", () =>
        {
            Assert.Equal(1, paramCount);
        });
    }

    [Scenario]
    public void Display_title_replaces_named_params()
    {
        string? displayTitle = null;
        
        Given("a user with email <email:test@example.com>", ctx =>
        {
            displayTitle = ctx.Step!.DisplayTitle;
        });

        When("the step is executed", () => { });

        Then("the display title shows only the value", () =>
        {
            Assert.Equal("a user with email test@example.com", displayTitle);
        });
    }

    [Scenario]
    public void Named_params_are_case_insensitive()
    {
        string? value = null;
        
        Given("a param <MyParam:test>", ctx =>
        {
            // Access with different casing
            value = ctx.Step!.Params["myparam"].AsString();
        });

        When("accessed with different case", () => { });

        Then("the value is still found", () =>
        {
            Assert.Equal("test", value);
        });
    }

    [Scenario]
    public void Missing_named_param_throws()
    {
        LiveDocParamNotFoundException? caught = null;
        
        Given("a param <existing:value>", ctx =>
        {
            try
            {
                _ = ctx.Step!.Params["nonexistent"];
            }
            catch (LiveDocParamNotFoundException ex)
            {
                caught = ex;
            }
        });

        When("accessing a non-existent param", () => { });

        Then("the exception includes helpful info", () =>
        {
            Assert.NotNull(caught);
            Assert.Equal("nonexistent", caught!.ParamName);
            Assert.Contains("existing", caught.AvailableParams);
        });
    }
}
