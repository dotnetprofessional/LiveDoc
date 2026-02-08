using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Gherkin.Steps;

/// <summary>
/// Feature: Step Type Conversion
/// 
/// Quoted and named values can be converted to various types
/// using the .AsInt(), .AsDecimal(), .As<T>() methods.
/// </summary>
[Feature(Description = @"
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
        
        Given("a quantity of '100' items", ctx =>
        {
            value = ctx.Step!.Values[0].AsInt();
        });

        Then("the integer value is correct", () =>
        {
            Assert.Equal(100, value);
        });
    }

    [Scenario("Convert to long for large numbers")]
    public void Convert_to_long()
    {
        long? value = null;
        
        Given("a large ID '9999999999999'", ctx =>
        {
            value = ctx.Step!.Values[0].AsLong();
        });

        Then("the long value is correct", () =>
        {
            Assert.Equal(9999999999999L, value);
        });
    }

    [Scenario("Convert to decimal for currency")]
    public void Convert_to_decimal()
    {
        decimal? value = null;
        
        Given("a price of '99.99'", ctx =>
        {
            value = ctx.Step!.Values[0].AsDecimal();
        });

        Then("the decimal value is correct", () =>
        {
            Assert.Equal(99.99m, value);
        });
    }

    [Scenario("Convert to double for scientific notation")]
    public void Convert_to_double()
    {
        double? value = null;
        
        Given("a measurement of '3.14159'", ctx =>
        {
            value = ctx.Step!.Values[0].AsDouble();
        });

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
        
        Given("values '-42' and '-99.99'", ctx =>
        {
            negInt = ctx.Step!.Values[0].AsInt();
            negDecimal = ctx.Step!.Values[1].AsDecimal();
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
        
        Given("active is 'true'", ctx =>
        {
            value = ctx.Step!.Values[0].AsBool();
        });

        Then("the boolean is true", () =>
        {
            Assert.True(value);
        });
    }

    [Scenario]
    public void Convert_to_boolean_false()
    {
        bool? value = null;
        
        Given("disabled is 'false'", ctx =>
        {
            value = ctx.Step!.Values[0].AsBool();
        });

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
        
        Given("values 'TRUE' and 'False'", ctx =>
        {
            upper = ctx.Step!.Values[0].AsBool();
            mixed = ctx.Step!.Values[1].AsBool();
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
        
        Given("a date of '2024-06-15'", ctx =>
        {
            value = ctx.Step!.Values[0].AsDateTime();
        });

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
        
        Given("a timestamp of '2024-06-15T14:30:00'", ctx =>
        {
            value = ctx.Step!.Values[0].AsDateTime();
        });

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
        
        Given("a day of <day:Wednesday>", ctx =>
        {
            value = ctx.Step!.Params["day"].As<DayOfWeek>();
        });

        Then("the enum is parsed correctly", () =>
        {
            Assert.Equal(DayOfWeek.Wednesday, value);
        });
    }

    [Scenario]
    public void Enum_parsing_is_case_insensitive()
    {
        DayOfWeek? value = null;
        
        Given("a day of <day:FRIDAY>", ctx =>
        {
            value = ctx.Step!.Params["day"].As<DayOfWeek>();
        });

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
        
        Given("IDs '[1, 2, 3, 4, 5]'", ctx =>
        {
            values = ctx.Step!.Values[0].As<int[]>();
        });

        Then("the array is parsed correctly", () =>
        {
            Assert.Equal(new[] { 1, 2, 3, 4, 5 }, values);
        });
    }

    [Scenario]
    public void Convert_to_string_array()
    {
        string[]? values = null;
        
        Given("tags '[\"sale\", \"new\", \"featured\"]'", ctx =>
        {
            values = ctx.Step!.Values[0].As<string[]>();
        });

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
        
        Given("an invalid number 'abc'", ctx =>
        {
            try
            {
                _ = ctx.Step!.Values[0].AsInt();
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
        
        Given("an invalid bool 'yes'", ctx =>
        {
            try
            {
                _ = ctx.Step!.Values[0].AsBool();
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
        
        Given("an invalid date 'not-a-date'", ctx =>
        {
            try
            {
                _ = ctx.Step!.Values[0].AsDateTime();
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
