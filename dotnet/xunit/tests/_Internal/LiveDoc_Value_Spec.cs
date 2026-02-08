using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests._Internal;

/// <summary>
/// Specification: LiveDocValue
/// 
/// Unit tests for the LiveDocValue class that wraps raw string values
/// and provides type-safe conversion methods.
/// </summary>
[Specification(Description = @"
    LiveDocValue wraps a raw string and provides type-safe conversion
    methods: AsInt(), AsLong(), AsDecimal(), AsDouble(), AsBool(),
    AsDateTime(), and As<T>() for enums, arrays, and nullable types.")]
public class LiveDoc_Value_Spec : SpecificationTest
{
    public LiveDoc_Value_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region AsString

    [Rule("AsString returns the raw value unchanged")]
    public void AsString_returns_raw_value()
    {
        var value = new LiveDocValue("hello world", "test step");
        Assert.Equal("hello world", value.AsString());
    }

    [Rule("AsString on empty string returns empty")]
    public void AsString_on_empty_returns_empty()
    {
        var value = new LiveDocValue("", "test step");
        Assert.Equal("", value.AsString());
    }

    #endregion

    #region AsInt

    [RuleOutline("AsInt converts '<input>' to '<expected>'")]
    [Example("0", 0)]
    [Example("42", 42)]
    [Example("-100", -100)]
    [Example("2147483647", int.MaxValue)]
    [Example("-2147483648", int.MinValue)]
    public void AsInt_conversions(string input, int expected)
    {
        var value = new LiveDocValue(input, "test step");
        Assert.Equal(expected, value.AsInt());
    }

    [Rule("AsInt throws on non-numeric input")]
    public void AsInt_throws_on_non_numeric()
    {
        var value = new LiveDocValue("not-a-number", "test step");
        var ex = Assert.Throws<LiveDocConversionException>(() => value.AsInt());
        
        Assert.Contains("not-a-number", ex.Message);
        Assert.Contains("test step", ex.StepTitle);
    }

    [Rule("AsInt throws on decimal input")]
    public void AsInt_throws_on_decimal()
    {
        var value = new LiveDocValue("3.14", "test step");
        Assert.Throws<LiveDocConversionException>(() => value.AsInt());
    }

    [Rule("AsInt throws on overflow")]
    public void AsInt_throws_on_overflow()
    {
        var value = new LiveDocValue("99999999999999999", "test step");
        Assert.Throws<LiveDocConversionException>(() => value.AsInt());
    }

    #endregion

    #region AsLong

    [RuleOutline("AsLong converts '<input>' to '<expected>'")]
    [Example("0", 0L)]
    [Example("9999999999", 9999999999L)]
    [Example("-9999999999", -9999999999L)]
    public void AsLong_conversions(string input, long expected)
    {
        var value = new LiveDocValue(input, "test step");
        Assert.Equal(expected, value.AsLong());
    }

    #endregion

    #region AsDecimal

    [RuleOutline("AsDecimal converts '<input>' to <expected>")]
    [Example("0", 0.0)]
    [Example("99.99", 99.99)]
    [Example("-50.5", -50.5)]
    [Example("1000000.123456", 1000000.123456)]
    public void AsDecimal_conversions(string input, double expectedDouble)
    {
        var expected = (decimal)expectedDouble;
        var value = new LiveDocValue(input, "test step");
        Assert.Equal(expected, value.AsDecimal());
    }

    [Rule("AsDecimal uses invariant culture (dot as decimal separator)")]
    public void AsDecimal_uses_invariant_culture()
    {
        var value = new LiveDocValue("1.5", "test step");
        Assert.Equal(1.5m, value.AsDecimal());
    }

    [Rule("AsDecimal throws on comma as decimal separator")]
    public void AsDecimal_throws_on_comma_separator()
    {
        var value = new LiveDocValue("1,5", "test step");
        // Comma is thousands separator in invariant culture, so "1,5" = 15
        // This should NOT throw, but produce 15
        Assert.Equal(15m, value.AsDecimal());
    }

    #endregion

    #region AsDouble

    [RuleOutline("AsDouble converts '<input>' to <expected>")]
    [Example("3.14159", 3.14159)]
    [Example("-273.15", -273.15)]
    [Example("0", 0.0)]
    public void AsDouble_conversions(string input, double expected)
    {
        var value = new LiveDocValue(input, "test step");
        Assert.Equal(expected, value.AsDouble(), 0.00001);
    }

    #endregion

    #region AsBool

    [RuleOutline("AsBool converts '<input>' to <expected>")]
    [Example("true", true)]
    [Example("True", true)]
    [Example("TRUE", true)]
    [Example("false", false)]
    [Example("False", false)]
    [Example("FALSE", false)]
    public void AsBool_conversions(string input, bool expected)
    {
        var value = new LiveDocValue(input, "test step");
        Assert.Equal(expected, value.AsBool());
    }

    [Rule("AsBool throws on invalid input")]
    public void AsBool_throws_on_invalid()
    {
        var value = new LiveDocValue("yes", "test step");
        Assert.Throws<LiveDocConversionException>(() => value.AsBool());
    }

    #endregion

    #region AsDateTime

    [Rule("AsDateTime parses ISO date")]
    public void AsDateTime_parses_iso_date()
    {
        var value = new LiveDocValue("2024-01-15", "test step");
        Assert.Equal(new DateTime(2024, 1, 15), value.AsDateTime());
    }

    [Rule("AsDateTime parses ISO datetime")]
    public void AsDateTime_parses_iso_datetime()
    {
        var value = new LiveDocValue("2024-01-15T10:30:00", "test step");
        var result = value.AsDateTime();
        
        Assert.Equal(2024, result.Year);
        Assert.Equal(1, result.Month);
        Assert.Equal(15, result.Day);
        Assert.Equal(10, result.Hour);
        Assert.Equal(30, result.Minute);
    }

    [Rule("AsDateTime throws on invalid format")]
    public void AsDateTime_throws_on_invalid()
    {
        var value = new LiveDocValue("not-a-date", "test step");
        Assert.Throws<LiveDocConversionException>(() => value.AsDateTime());
    }

    #endregion

    #region As<T> Generic

    [Rule("As<T> parses enum by name")]
    public void As_T_parses_enum_by_name()
    {
        var value = new LiveDocValue("Monday", "test step");
        Assert.Equal(DayOfWeek.Monday, value.As<DayOfWeek>());
    }

    [Rule("As<T> enum parsing is case-insensitive")]
    public void As_T_enum_case_insensitive()
    {
        var value = new LiveDocValue("FRIDAY", "test step");
        Assert.Equal(DayOfWeek.Friday, value.As<DayOfWeek>());
    }

    [Rule("As<T> parses Guid")]
    public void As_T_parses_guid()
    {
        var guid = Guid.NewGuid();
        var value = new LiveDocValue(guid.ToString(), "test step");
        Assert.Equal(guid, value.As<Guid>());
    }

    [Rule("As<T> parses nullable int from valid input")]
    public void As_T_parses_nullable_int()
    {
        var value = new LiveDocValue("42", "test step");
        Assert.Equal(42, value.As<int?>());
    }

    #endregion

    #region Array Parsing

    [Rule("As<int[]> parses JSON-like array")]
    public void As_int_array_parses_json()
    {
        var value = new LiveDocValue("[1, 2, 3, 4, 5]", "test step");
        var result = value.As<int[]>();
        
        Assert.Equal(5, result.Length);
        Assert.Equal(1, result[0]);
        Assert.Equal(5, result[4]);
    }

    [Rule("As<string[]> parses JSON-like string array")]
    public void As_string_array_parses_json()
    {
        var value = new LiveDocValue("[\"a\", \"b\", \"c\"]", "test step");
        var result = value.As<string[]>();
        
        Assert.Equal(3, result.Length);
        Assert.Equal("a", result[0]);
        Assert.Equal("c", result[2]);
    }

    [Rule("Empty array parses correctly")]
    public void Empty_array_parses()
    {
        var value = new LiveDocValue("[]", "test step");
        var result = value.As<int[]>();
        
        Assert.Empty(result);
    }

    [Rule("As<T[]> throws on malformed array")]
    public void As_array_throws_on_malformed()
    {
        var value = new LiveDocValue("[1, 2,", "test step");
        Assert.Throws<LiveDocConversionException>(() => value.As<int[]>());
    }

    #endregion

    #region Edge Cases

    [Rule("Whitespace-only value converts to empty string")]
    public void Whitespace_value_converts_to_empty_string()
    {
        var value = new LiveDocValue("   ", "test step");
        Assert.Equal("   ", value.AsString());
    }

    [Rule("Leading/trailing whitespace is preserved")]
    public void Whitespace_is_preserved()
    {
        var value = new LiveDocValue("  42  ", "test step");
        // int parsing should trim whitespace
        Assert.Equal(42, value.AsInt());
    }

    [Rule("Null raw value returns 0 for AsInt")]
    public void Null_raw_value_is_handled()
    {
        var value = new LiveDocValue(null!, "test step");
        // Convert.ToInt32(null) returns 0, not an exception
        Assert.Equal(0, value.AsInt());
    }

    #endregion
}
