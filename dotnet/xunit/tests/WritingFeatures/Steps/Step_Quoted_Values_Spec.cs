using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingFeatures.Steps;

/// <summary>
/// Feature: Step Quoted Values
/// 
/// Step statements can include values in single quotes.
/// These are extracted and made available via ctx.Step.Values array.
/// </summary>
[Feature("Step Quoted Values", Description = @"
    Single-quoted values in step descriptions are automatically extracted
    into ctx.Step.Values. The array supports indexing, tuple deconstruction,
    typed conversion, and bounds-checked access with helpful errors.")]
public class Step_Quoted_Values_Spec : FeatureTest
{
    public Step_Quoted_Values_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Scenario]
    public void Single_quoted_value_is_extracted()
    {
        string? capturedValue = null;
        StepContext? sourceStep = null;
        
        Given("a quantity of '42' items", ctx => sourceStep = ctx.Step);

        When("the quoted quantity is extracted", () =>
            capturedValue = sourceStep!.Values[0].AsString());

        Then("the value should be extracted", () =>
        {
            Assert.Equal("42", capturedValue);
        });
    }

    [Scenario]
    public void Multiple_quoted_values_are_extracted_in_order()
    {
        List<string>? values = null;
        StepContext? sourceStep = null;
        
        Given("an item entry contains '5', 'Earl Grey Tea', and '4.99'", ctx =>
            sourceStep = ctx.Step);

        When("the quoted item values are extracted", () =>
        {
            values = new List<string>();
            for (int i = 0; i < sourceStep!.Values.Count; i++)
            {
                values.Add(sourceStep.Values[i].AsString());
            }
        });

        Then("all values should be extracted in order", () =>
        {
            Assert.Equal(3, values!.Count);
            Assert.Equal("5", values[0]);
            Assert.Equal("Earl Grey Tea", values[1]);
            Assert.Equal("4.99", values[2]);
        });
    }

    [Scenario]
    public void Quoted_values_with_spaces_are_preserved()
    {
        string? productName = null;
        StepContext? sourceStep = null;
        
        Given("a product named 'Byron Breakfast Tea Blend'", ctx => sourceStep = ctx.Step);

        When("the quoted product name is extracted", () =>
            productName = sourceStep!.Values[0].AsString());

        Then("the full name with spaces is captured", () =>
        {
            Assert.Equal("Byron Breakfast Tea Blend", productName);
        });
    }

    [Scenario]
    public void Empty_quoted_value_is_extracted()
    {
        string? value = null;
        StepContext? sourceStep = null;
        
        Given("a name of '' (empty)", ctx => sourceStep = ctx.Step);

        When("the quoted name is extracted", () =>
            value = sourceStep!.Values[0].AsString());

        Then("the empty string is captured", () =>
        {
            Assert.Equal("", value);
        });
    }

    [Scenario]
    public void Values_count_reflects_actual_quotes()
    {
        int? count = null;
        StepContext? sourceStep = null;
        
        Given("a step has no quoted values", ctx => sourceStep = ctx.Step);

        When("the quoted value count is read", () => count = sourceStep!.Values.Count);

        Then("count should be zero", () =>
        {
            Assert.Equal(0, count);
        });
    }

    [Scenario]
    public void Tuple_deconstruction_for_two_values()
    {
        string? first = null;
        string? second = null;
        StepContext? sourceStep = null;
        
        Given("user '123' selects product '456'", ctx => sourceStep = ctx.Step);

        When("the user and product values are deconstructed", () =>
        {
            var (v1, v2) = sourceStep!.Values;
            first = v1.AsString();
            second = v2.AsString();
        });

        Then("both values are extracted via deconstruction", () =>
        {
            Assert.Equal("123", first);
            Assert.Equal("456", second);
        });
    }

    [Scenario]
    public void Typed_tuple_deconstruction()
    {
        int? userId = null;
        string? productName = null;
        decimal? price = null;
        StepContext? sourceStep = null;
        
        Given("user '42' selects 'Tea' priced at '9.99'", ctx => sourceStep = ctx.Step);

        When("the values are deconstructed with target types", () =>
        {
            (userId, productName, price) = sourceStep!.Values.As<int, string, decimal>();
        });

        Then("values are correctly typed", () =>
        {
            Assert.Equal(42, userId);
            Assert.Equal("Tea", productName);
            Assert.Equal(9.99m, price);
        });
    }

    [Scenario]
    public void Accessing_beyond_available_values_throws()
    {
        LiveDocValueIndexException? caught = null;
        StepContext? sourceStep = null;
        
        Given("only one value '42'", ctx => sourceStep = ctx.Step);

        When("a sixth value is requested", () =>
        {
            try
            {
                _ = sourceStep!.Values[5];
            }
            catch (LiveDocValueIndexException ex)
            {
                caught = ex;
            }
        });

        Then("the exception provides helpful context", () =>
        {
            Assert.NotNull(caught);
            Assert.Equal(5, caught!.RequestedIndex);
            Assert.Equal(1, caught.AvailableCount);
        });
    }

    [Scenario("ValuesRaw contains raw strings before coercion")]
    public void ValuesRaw_contains_raw_strings()
    {
        IReadOnlyList<string>? rawValues = null;
        StepContext? sourceStep = null;
        
        Given("values '42' and 'true'", ctx => sourceStep = ctx.Step);

        When("the raw values are read", () => rawValues = sourceStep!.ValuesRaw);

        Then("raw values are plain strings", () =>
        {
            Assert.Equal(2, rawValues!.Count);
            Assert.Equal("42", rawValues[0]);
            Assert.Equal("true", rawValues[1]);
        });
    }
}
