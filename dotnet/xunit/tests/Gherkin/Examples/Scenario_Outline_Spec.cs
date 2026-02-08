using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Gherkin.Examples;

/// <summary>
/// Feature: Scenario Outline
/// 
/// Tests for the [ScenarioOutline] attribute and Example data binding.
/// Validates parameterized scenarios with multiple example rows.
/// </summary>
[Feature(Description = @"
    ScenarioOutline enables data-driven BDD scenarios via [Example] rows.
    Each example row runs the scenario with different parameters, validating
    type preservation, string handling, and multi-assertion support.")]
public class Scenario_Outline_Spec : FeatureTest
{
    public Scenario_Outline_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Basic Example Data Binding

    [ScenarioOutline("Calculating discounts for order totals")]
    [Example(100.0, 10, 90.0)]
    [Example(200.0, 15, 170.0)]
    [Example(50.0, 0, 50.0)]
    public void Calculating_discounts(double orderTotal, int discountPercent, double expectedTotal)
    {
        double actualTotal = 0;
        
        Given($"an order total of '{orderTotal}'", () =>
        {
            // Value is embedded in step description
        });
        
        When($"a '{discountPercent}%' discount is applied", () =>
        {
            actualTotal = orderTotal * (1 - discountPercent / 100.0);
        });
        
        Then($"the final total should be '{expectedTotal}'", () =>
        {
            Assert.Equal(expectedTotal, actualTotal, 2);
        });
    }

    #endregion

    #region Example Access via Context

    [ScenarioOutline("Accessing example data via context")]
    [Example("Alice", 25)]
    [Example("Bob", 30)]
    public void Accessing_example_data(string name, int age)
    {
        object? capturedName = null;
        object? capturedAge = null;
        
        Given("a user profile", () =>
        {
            // Access via method parameters directly
            capturedName = name;
            capturedAge = age;
        });
        
        Then("the values match the example row", () =>
        {
            Assert.Equal(name, capturedName);
            Assert.Equal(age, capturedAge);
        });
    }

    #endregion

    #region Type Preservation

    [ScenarioOutline("Numeric values preserve their types")]
    [Example(42, 3.14, true)]
    [Example(0, 0.0, false)]
    public void Type_preservation(int intValue, double doubleValue, bool boolValue)
    {
        Given("example data with different types", () =>
        {
            // Values are strongly typed via method parameters
            Assert.IsType<int>(intValue);
            Assert.IsType<double>(doubleValue);
            Assert.IsType<bool>(boolValue);
        });
        
        Then("types are preserved in the test", () =>
        {
            // This validates the xUnit [InlineData] underpinning works correctly
            Assert.True(true);
        });
    }

    #endregion

    #region String Values

    [ScenarioOutline("String values are passed correctly")]
    [Example("hello", "world", "hello world")]
    [Example("foo", "bar", "foo bar")]
    public void String_values(string first, string second, string expected)
    {
        string? result = null;
        
        Given($"first value is '{first}' and second is '{second}'", () =>
        {
            result = $"{first} {second}";
        });
        
        Then($"concatenated result is '{expected}'", () =>
        {
            Assert.Equal(expected, result);
        });
    }

    #endregion

    #region Multiple Assertions Per Scenario

    [ScenarioOutline("Complex validation with multiple assertions")]
    [Example("user@example.com", true, "valid")]
    [Example("invalid-email", false, "invalid")]
    [Example("test@test.org", true, "valid")]
    public void Email_validation(string email, bool isValid, string status)
    {
        bool? actualIsValid = null;
        
        Given($"an email address '{email}'", () => { });
        
        When("the email is validated", () =>
        {
            actualIsValid = email.Contains("@") && email.Contains(".");
        });
        
        Then($"isValid should be '{isValid}'", () =>
        {
            Assert.Equal(isValid, actualIsValid);
        });
        
        And($"status should be '{status}'", () =>
        {
            var actualStatus = actualIsValid == true ? "valid" : "invalid";
            Assert.Equal(status, actualStatus);
        });
    }

    #endregion
}
