using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Steps;

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
        
        Given("a quantity of '42' items", ctx =>
        {
            capturedValue = ctx.Step!.Values[0].AsString();
        });

        Then("the value should be extracted", () =>
        {
            Assert.Equal("42", capturedValue);
        });
    }

    [Scenario]
    public void Multiple_quoted_values_are_extracted_in_order()
    {
        List<string>? values = null;
        
        When("I add '5' items of 'Earl Grey Tea' at '4.99'", ctx =>
        {
            values = new List<string>();
            for (int i = 0; i < ctx.Step!.Values.Count; i++)
            {
                values.Add(ctx.Step!.Values[i].AsString());
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
        
        Given("a product named 'Byron Breakfast Tea Blend'", ctx =>
        {
            productName = ctx.Step!.Values[0].AsString();
        });

        Then("the full name with spaces is captured", () =>
        {
            Assert.Equal("Byron Breakfast Tea Blend", productName);
        });
    }

    [Scenario]
    public void Empty_quoted_value_is_extracted()
    {
        string? value = null;
        
        Given("a name of '' (empty)", ctx =>
        {
            value = ctx.Step!.Values[0].AsString();
        });

        Then("the empty string is captured", () =>
        {
            Assert.Equal("", value);
        });
    }

    [Scenario]
    public void Values_count_reflects_actual_quotes()
    {
        int? count = null;
        
        Given("no quoted values here", ctx =>
        {
            count = ctx.Step!.Values.Count;
        });

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
        
        When("user '123' buys product '456'", ctx =>
        {
            var (v1, v2) = ctx.Step!.Values;
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
        
        When("user '42' buys 'Tea' for '9.99'", ctx =>
        {
            (userId, productName, price) = ctx.Step!.Values.As<int, string, decimal>();
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
        
        Given("only one value '42'", ctx =>
        {
            try
            {
                _ = ctx.Step!.Values[5];
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
        
        Given("values '42' and 'true'", ctx =>
        {
            rawValues = ctx.Step!.ValuesRaw;
        });

        Then("raw values are plain strings", () =>
        {
            Assert.Equal(2, rawValues!.Count);
            Assert.Equal("42", rawValues[0]);
            Assert.Equal("true", rawValues[1]);
        });
    }
}
