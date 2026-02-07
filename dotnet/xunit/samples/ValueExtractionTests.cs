using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;

namespace ShippingSample;

/// <summary>
/// Feature: Value Extraction API
/// 
/// Tests for the LiveDoc value extraction features including:
/// - Quoted values ('value')
/// - Named parameters (&lt;name:value&gt;)
/// - Type conversion (.AsInt(), .AsDecimal(), etc.)
/// - Tuple deconstruction
/// - Error handling
/// </summary>
[Feature("Value Extraction API", Description = @"
    The value extraction API allows developers to embed test data
    directly in step descriptions and extract it for use in assertions.
    This makes tests self-documenting and easier to understand.
")]
public class ValueExtractionTests : LiveDocTest
{
    public ValueExtractionTests(ITestOutputHelper output) : base(output)
    {
    }

    #region Quoted Values

    [Scenario("Extract single quoted value")]
    public void Extract_single_quoted_value()
    {
        int? capturedValue = null;

        Given("a step with a single value '42'", ctx =>
        {
            capturedValue = ctx.Step!.Values[0].AsInt();
        });

        Then("the value should be extracted correctly", () =>
        {
            Assert.Equal(42, capturedValue);
        });
    }

    [Scenario("Extract multiple quoted values")]
    public void Extract_multiple_quoted_values()
    {
        string? name = null;
        int? quantity = null;
        decimal? price = null;

        When("I add '5' items of 'Byron Breakfast Tea' at '9.99' each", ctx =>
        {
            quantity = ctx.Step!.Values[0].AsInt();
            name = ctx.Step!.Values[1].AsString();
            price = ctx.Step!.Values[2].AsDecimal();
        });

        Then("all values should be extracted correctly", () =>
        {
            Assert.Equal(5, quantity);
            Assert.Equal("Byron Breakfast Tea", name);
            Assert.Equal(9.99m, price);
        });
    }

    [Scenario("Extract values using tuple deconstruction")]
    public void Extract_values_using_tuple_deconstruction()
    {
        int? qty = null;
        string? product = null;
        decimal? cost = null;

        When("I purchase '3' units of 'Green Tea' for '15.50'", ctx =>
        {
            var (q, p, c) = ctx.Step!.Values;
            qty = q.AsInt();
            product = p.AsString();
            cost = c.AsDecimal();
        });

        Then("the deconstructed values should match", () =>
        {
            Assert.Equal(3, qty);
            Assert.Equal("Green Tea", product);
            Assert.Equal(15.50m, cost);
        });
    }

    [Scenario("Extract values using typed tuple deconstruction")]
    public void Extract_values_using_typed_tuple_deconstruction()
    {
        int? qty = null;
        string? product = null;
        decimal? cost = null;

        When("I purchase '7' units of 'Oolong Tea' for '22.99'", ctx =>
        {
            (qty, product, cost) = ctx.Step!.Values.As<int, string, decimal>();
        });

        Then("the typed values should match", () =>
        {
            Assert.Equal(7, qty);
            Assert.Equal("Oolong Tea", product);
            Assert.Equal(22.99m, cost);
        });
    }

    #endregion

    #region Named Parameters

    [Scenario("Extract named parameters")]
    public void Extract_named_parameters()
    {
        string? email = null;
        int? age = null;

        Given("a user with email <email:john@example.com> and age <age:25>", ctx =>
        {
            email = ctx.Step!.Params["email"].AsString();
            age = ctx.Step!.Params["age"].AsInt();
        });

        Then("the named parameters should be extracted correctly", () =>
        {
            Assert.Equal("john@example.com", email);
            Assert.Equal(25, age);
        });
    }

    [Scenario("Named parameters are case-insensitive")]
    public void Named_parameters_are_case_insensitive()
    {
        string? value = null;

        Given("a parameter <MyParam:test-value>", ctx =>
        {
            // Access with different casing
            value = ctx.Step!.Params["myparam"].AsString();
        });

        Then("the value should be found regardless of case", () =>
        {
            Assert.Equal("test-value", value);
        });
    }

    [Scenario("Display title replaces named params with values only")]
    public void Display_title_replaces_named_params()
    {
        string? displayTitle = null;

        Given("a user with email <email:test@test.com>", ctx =>
        {
            displayTitle = ctx.Step!.DisplayTitle;
        });

        Then("the display title should show only the value", () =>
        {
            Assert.Equal("a user with email test@test.com", displayTitle);
        });
    }

    #endregion

    #region Type Conversions

    [Scenario("Convert to various numeric types")]
    public void Convert_to_various_numeric_types()
    {
        int? intVal = null;
        long? longVal = null;
        double? doubleVal = null;
        decimal? decimalVal = null;

        Given("an integer '42' and a long '9999999999' and a double '3.14159' and a decimal '99.99'", ctx =>
        {
            var values = ctx.Step!.Values;
            intVal = values[0].AsInt();
            longVal = values[1].AsLong();
            doubleVal = values[2].AsDouble();
            decimalVal = values[3].AsDecimal();
        });

        Then("all conversions should succeed", () =>
        {
            Assert.Equal(42, intVal);
            Assert.Equal(9999999999L, longVal);
            Assert.Equal(3.14159, doubleVal!.Value, 0.00001);
            Assert.Equal(99.99m, decimalVal);
        });
    }

    [Scenario("Convert to boolean")]
    public void Convert_to_boolean()
    {
        bool? trueVal = null;
        bool? falseVal = null;

        Given("a true value 'true' and a false value 'false'", ctx =>
        {
            trueVal = ctx.Step!.Values[0].AsBool();
            falseVal = ctx.Step!.Values[1].AsBool();
        });

        Then("the boolean values should be correct", () =>
        {
            Assert.True(trueVal);
            Assert.False(falseVal);
        });
    }

    [Scenario("Convert to DateTime")]
    public void Convert_to_datetime()
    {
        DateTime? date = null;

        Given("a date value '2024-01-15'", ctx =>
        {
            date = ctx.Step!.Values[0].AsDateTime();
        });

        Then("the date should be parsed correctly", () =>
        {
            Assert.Equal(new DateTime(2024, 1, 15), date);
        });
    }

    [Scenario("Convert to enum using generic As")]
    public void Convert_to_enum()
    {
        DayOfWeek? day = null;

        Given("a day value <day:Monday>", ctx =>
        {
            day = ctx.Step!.Params["day"].As<DayOfWeek>();
        });

        Then("the enum value should be parsed correctly", () =>
        {
            Assert.Equal(DayOfWeek.Monday, day);
        });
    }

    #endregion

    #region Array Parsing

    [Scenario("Parse integer array")]
    public void Parse_integer_array()
    {
        int[]? ids = null;

        Given("product IDs '[101, 102, 103]'", ctx =>
        {
            ids = ctx.Step!.Values[0].As<int[]>();
        });

        Then("the array should contain correct values", () =>
        {
            Assert.NotNull(ids);
            Assert.Equal(3, ids.Length);
            Assert.Equal(101, ids[0]);
            Assert.Equal(102, ids[1]);
            Assert.Equal(103, ids[2]);
        });
    }

    [Scenario("Parse string array")]
    public void Parse_string_array()
    {
        string[]? tags = null;

        Given("tags '[\"sale\", \"new\", \"featured\"]'", ctx =>
        {
            tags = ctx.Step!.Values[0].As<string[]>();
        });

        Then("the string array should be parsed", () =>
        {
            Assert.NotNull(tags);
            Assert.Equal(3, tags.Length);
            Assert.Contains("sale", tags);
            Assert.Contains("new", tags);
            Assert.Contains("featured", tags);
        });
    }

    #endregion

    #region Error Handling

    [Scenario("Invalid conversion throws with context")]
    public void Invalid_conversion_throws_with_context()
    {
        LiveDocConversionException? caught = null;

        Given("an invalid number 'not-a-number'", ctx =>
        {
            try
            {
                var _ = ctx.Step!.Values[0].AsInt();
            }
            catch (LiveDocConversionException ex)
            {
                caught = ex;
            }
        });

        Then("the exception should include step context", () =>
        {
            Assert.NotNull(caught);
            Assert.Contains("not-a-number", caught.Message);
            Assert.Contains("an invalid number", caught.StepTitle);
        });
    }

    [Scenario("Index out of range throws with context")]
    public void Index_out_of_range_throws_with_context()
    {
        LiveDocValueIndexException? caught = null;

        Given("only one value '42'", ctx =>
        {
            try
            {
                var _ = ctx.Step!.Values[5]; // Way out of range
            }
            catch (LiveDocValueIndexException ex)
            {
                caught = ex;
            }
        });

        Then("the exception should include helpful info", () =>
        {
            Assert.NotNull(caught);
            Assert.Equal(5, caught.RequestedIndex);
            Assert.Equal(1, caught.AvailableCount);
            Assert.Contains("only one value", caught.StepTitle);
        });
    }

    [Scenario("Missing parameter throws with context")]
    public void Missing_parameter_throws_with_context()
    {
        LiveDocParamNotFoundException? caught = null;

        Given("a parameter <existing:value>", ctx =>
        {
            try
            {
                var _ = ctx.Step!.Params["nonexistent"];
            }
            catch (LiveDocParamNotFoundException ex)
            {
                caught = ex;
            }
        });

        Then("the exception should list available params", () =>
        {
            Assert.NotNull(caught);
            Assert.Equal("nonexistent", caught.ParamName);
            Assert.Contains("existing", caught.AvailableParams);
        });
    }

    #endregion

    #region Combined with ScenarioOutline

    [ScenarioOutline("Combine value extraction with outline placeholders")]
    [Example("Australia", 100.00)]
    [Example("New Zealand", 50.00)]
    public void Combine_value_extraction_with_outline(string country, decimal baseAmount)
    {
        SetExampleData(country, baseAmount);

        decimal? capturedMultiplier = null;
        decimal? calculatedTotal = null;

        Given("a customer from <country>", () =>
        {
            // Using outline placeholder (method param)
            Assert.NotNull(country);
        });

        When("I apply a multiplier of '1.1' to the base amount", ctx =>
        {
            // Using quoted value extraction
            capturedMultiplier = ctx.Step!.Values[0].AsDecimal();
            calculatedTotal = baseAmount * capturedMultiplier.Value;
        });

        Then("the total should be calculated correctly", () =>
        {
            Assert.Equal(1.1m, capturedMultiplier);
            Assert.Equal(baseAmount * 1.1m, calculatedTotal);
        });
    }

    #endregion

    #region Step Context Properties

    [Scenario("Step context exposes all properties")]
    public void Step_context_exposes_all_properties()
    {
        string? title = null;
        string? displayTitle = null;
        string? type = null;
        int? valuesCount = null;
        int? paramsCount = null;

        Given("a step with 'value1' and <param:value2>", ctx =>
        {
            title = ctx.Step!.Title;
            displayTitle = ctx.Step!.DisplayTitle;
            type = ctx.Step!.Type;
            valuesCount = ctx.Step!.Values.Count;
            paramsCount = ctx.Step!.Params.Count;
        });

        Then("all properties should be accessible", () =>
        {
            Assert.Equal("a step with 'value1' and <param:value2>", title);
            Assert.Equal("a step with 'value1' and value2", displayTitle);
            Assert.Equal("Given", type);
            Assert.Equal(1, valuesCount);
            Assert.Equal(1, paramsCount);
        });
    }

    #endregion
}
