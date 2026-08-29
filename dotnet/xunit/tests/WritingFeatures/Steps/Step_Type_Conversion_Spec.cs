using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingFeatures.Steps;

/// <summary>
/// Feature: Step Type Conversion
/// 
/// Quoted and named values can be converted to various types
/// using the .AsInt(), .AsDecimal(), .As<T>() methods.
/// </summary>
[Feature("Step Type Conversion", Description = @"
    Extracted quoted and named values support type conversion via
    .AsInt(), .AsDecimal(), .AsBool(), .AsDateTime(), .As<T>(), and
    array parsing. Invalid conversions throw LiveDocConversionException.")]
public class Step_Type_Conversion_Spec : FeatureTest
{
    public Step_Type_Conversion_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Numeric Conversions

    [Scenario]
    public void Convert_to_integer()
    {
        int? value = null;
        LiveDocValue? source = null;
        
        Given("a quantity of '100' items", ctx => source = ctx.Step!.Values[0]);

        When("the quantity is converted to an integer", () => value = source!.AsInt());

        Then("the integer value is correct", () =>
        {
            Assert.Equal(100, value);
        });
    }

    [Scenario("Convert to long for large numbers")]
    public void Convert_to_long()
    {
        long? value = null;
        LiveDocValue? source = null;
        
        Given("a large ID '9999999999999'", ctx => source = ctx.Step!.Values[0]);

        When("the ID is converted to a long integer", () => value = source!.AsLong());

        Then("the long value is correct", () =>
        {
            Assert.Equal(9999999999999L, value);
        });
    }

    [Scenario("Convert to decimal for currency")]
    public void Convert_to_decimal()
    {
        decimal? value = null;
        LiveDocValue? source = null;
        
        Given("a price of '99.99'", ctx => source = ctx.Step!.Values[0]);

        When("the price is converted to a decimal", () => value = source!.AsDecimal());

        Then("the decimal value is correct", () =>
        {
            Assert.Equal(99.99m, value);
        });
    }

    [Scenario("Convert to double for scientific notation")]
    public void Convert_to_double()
    {
        double? value = null;
        LiveDocValue? source = null;
        
        Given("a measurement of '3.14159'", ctx => source = ctx.Step!.Values[0]);

        When("the measurement is converted to a double", () => value = source!.AsDouble());

        Then("the double value is correct", () =>
        {
            Assert.Equal(3.14159, value!.Value, 0.00001);
        });
    }

    [Scenario]
    public void Negative_numbers_are_handled()
    {
        int? negInt = null;
        decimal? negDecimal = null;
        LiveDocValue? integerSource = null;
        LiveDocValue? decimalSource = null;
        
        Given("values '-42' and '-99.99'", ctx =>
        {
            integerSource = ctx.Step!.Values[0];
            decimalSource = ctx.Step.Values[1];
        });

        When("the negative values are converted", () =>
        {
            negInt = integerSource!.AsInt();
            negDecimal = decimalSource!.AsDecimal();
        });

        Then("negative values are parsed correctly", () =>
        {
            Assert.Equal(-42, negInt);
            Assert.Equal(-99.99m, negDecimal);
        });
    }

    #endregion

    #region Boolean Conversions

    [Scenario]
    public void Convert_to_boolean_true()
    {
        bool? value = null;
        LiveDocValue? source = null;
        
        Given("active is 'true'", ctx => source = ctx.Step!.Values[0]);

        When("the active value is converted to a boolean", () => value = source!.AsBool());

        Then("the boolean is true", () =>
        {
            Assert.True(value);
        });
    }

    [Scenario]
    public void Convert_to_boolean_false()
    {
        bool? value = null;
        LiveDocValue? source = null;
        
        Given("disabled is 'false'", ctx => source = ctx.Step!.Values[0]);

        When("the disabled value is converted to a boolean", () => value = source!.AsBool());

        Then("the boolean is false", () =>
        {
            Assert.False(value);
        });
    }

    [Scenario]
    public void Boolean_parsing_is_case_insensitive()
    {
        bool? upper = null;
        bool? mixed = null;
        LiveDocValue? upperSource = null;
        LiveDocValue? mixedSource = null;
        
        Given("values 'TRUE' and 'False'", ctx =>
        {
            upperSource = ctx.Step!.Values[0];
            mixedSource = ctx.Step.Values[1];
        });

        When("the values are converted to booleans", () =>
        {
            upper = upperSource!.AsBool();
            mixed = mixedSource!.AsBool();
        });

        Then("both are parsed correctly", () =>
        {
            Assert.True(upper);
            Assert.False(mixed);
        });
    }

    #endregion

    #region DateTime Conversions

    [Scenario]
    public void Convert_iso_date()
    {
        DateTime? value = null;
        LiveDocValue? source = null;
        
        Given("a date of '2024-06-15'", ctx => source = ctx.Step!.Values[0]);

        When("the date is converted to a date-time value", () => value = source!.AsDateTime());

        Then("the date is parsed correctly", () =>
        {
            Assert.Equal(2024, value!.Value.Year);
            Assert.Equal(6, value.Value.Month);
            Assert.Equal(15, value.Value.Day);
        });
    }

    [Scenario]
    public void Convert_iso_datetime()
    {
        DateTime? value = null;
        LiveDocValue? source = null;
        
        Given("a timestamp of '2024-06-15T14:30:00'", ctx => source = ctx.Step!.Values[0]);

        When("the timestamp is converted to a date-time value", () => value = source!.AsDateTime());

        Then("the datetime is parsed correctly", () =>
        {
            Assert.Equal(14, value!.Value.Hour);
            Assert.Equal(30, value.Value.Minute);
        });
    }

    #endregion

    #region Enum Conversions

    [Scenario]
    public void Convert_to_enum_by_name()
    {
        DayOfWeek? value = null;
        LiveDocValue? source = null;
        
        Given("a day of <day:Wednesday>", ctx => source = ctx.Step!.Params["day"]);

        When("the day is converted to an enum", () => value = source!.As<DayOfWeek>());

        Then("the enum is parsed correctly", () =>
        {
            Assert.Equal(DayOfWeek.Wednesday, value);
        });
    }

    [Scenario]
    public void Enum_parsing_is_case_insensitive()
    {
        DayOfWeek? value = null;
        LiveDocValue? source = null;
        
        Given("a day of <day:FRIDAY>", ctx => source = ctx.Step!.Params["day"]);

        When("the uppercase day is converted to an enum", () => value = source!.As<DayOfWeek>());

        Then("the enum is parsed correctly", () =>
        {
            Assert.Equal(DayOfWeek.Friday, value);
        });
    }

    #endregion

    #region Array Conversions

    [Scenario]
    public void Convert_to_integer_array()
    {
        int[]? values = null;
        LiveDocValue? source = null;
        
        Given("IDs '[1, 2, 3, 4, 5]'", ctx => source = ctx.Step!.Values[0]);

        When("the IDs are converted to an integer array", () => values = source!.As<int[]>());

        Then("the array is parsed correctly", () =>
        {
            Assert.Equal(new[] { 1, 2, 3, 4, 5 }, values);
        });
    }

    [Scenario]
    public void Convert_to_string_array()
    {
        string[]? values = null;
        LiveDocValue? source = null;
        
        Given("tags '[\"sale\", \"new\", \"featured\"]'", ctx => source = ctx.Step!.Values[0]);

        When("the tags are converted to a string array", () => values = source!.As<string[]>());

        Then("the string array is parsed correctly", () =>
        {
            Assert.Equal(new[] { "sale", "new", "featured" }, values);
        });
    }

    #endregion

    #region Error Handling

    [Scenario]
    public void Invalid_integer_throws_with_context()
    {
        LiveDocConversionException? caught = null;
        LiveDocValue? source = null;
        
        Given("an invalid number 'abc'", ctx => source = ctx.Step!.Values[0]);

        When("the invalid number is converted to an integer", () =>
        {
            try
            {
                _ = source!.AsInt();
            }
            catch (LiveDocConversionException ex)
            {
                caught = ex;
            }
        });

        Then("the exception contains useful info", () =>
        {
            Assert.NotNull(caught);
            Assert.Contains("abc", caught!.Message);
            Assert.Contains("an invalid number", caught.StepTitle);
        });
    }

    [Scenario]
    public void Invalid_boolean_throws_with_context()
    {
        LiveDocConversionException? caught = null;
        LiveDocValue? source = null;
        
        Given("an invalid bool 'yes'", ctx => source = ctx.Step!.Values[0]);

        When("the invalid value is converted to a boolean", () =>
        {
            try
            {
                _ = source!.AsBool();
            }
            catch (LiveDocConversionException ex)
            {
                caught = ex;
            }
        });

        Then("the exception indicates the problem", () =>
        {
            Assert.NotNull(caught);
            Assert.Contains("yes", caught!.Message);
        });
    }

    [Scenario]
    public void Invalid_date_throws_with_context()
    {
        LiveDocConversionException? caught = null;
        LiveDocValue? source = null;
        
        Given("an invalid date 'not-a-date'", ctx => source = ctx.Step!.Values[0]);

        When("the invalid value is converted to a date", () =>
        {
            try
            {
                _ = source!.AsDateTime();
            }
            catch (LiveDocConversionException ex)
            {
                caught = ex;
            }
        });

        Then("the exception is informative", () =>
        {
            Assert.NotNull(caught);
            Assert.Contains("not-a-date", caught!.Message);
        });
    }

    #endregion
}
