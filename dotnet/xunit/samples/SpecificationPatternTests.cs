using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit;
using Xunit.Abstractions;

namespace ShippingSample;

/// <summary>
/// Specification: Calculator Operations
/// 
/// Tests for basic arithmetic operations using the Specification pattern.
/// This demonstrates [Specification], [Rule], and [RuleOutline] attributes.
/// </summary>
[Specification("Calculator Operations", Description = @"
    Core arithmetic operations for the calculator module.
    Uses the specification pattern for cleaner unit tests.
")]
public class CalculatorSpec : LiveDocTest
{
    public CalculatorSpec(ITestOutputHelper output) : base(output)
    {
    }

    #region Basic Rules

    [Rule]
    public void Adding_positive_numbers_works()
    {
        var result = Add(5, 3);
        
        Then("the result should be correct", () =>
        {
            Assert.Equal(8, result);
        });
    }

    [Rule]
    public void Multiplying_by_zero_returns_zero()
    {
        var result = Multiply(100, 0);
        
        Then("the result should be zero", () =>
        {
            Assert.Equal(0, result);
        });
    }

    [Rule("Division by '0' throws DivideByZeroException")]
    public void Division_by_zero_throws()
    {
        Then("attempting to divide by zero throws", () =>
        {
            Assert.Throws<DivideByZeroException>(() => Divide(10, 0));
        });
    }

    #endregion

    #region Rules with Descriptions

    [Rule("Adding '5' and '3' returns '8'")]
    public void Add_with_values()
    {
        Given("the addition '5' + '3'", ctx =>
        {
            var (a, b) = ctx.Step!.Values.As<int, int>();
            var result = Add(a, b);
            Assert.Equal(8, result);
        });
    }

    [Rule("Subtracting <b:3> from <a:10> returns <expected:7>")]
    public void Subtract_with_named_params()
    {
        Given("the subtraction <a:10> - <b:3>", ctx =>
        {
            var a = ctx.Step!.Params["a"].AsInt();
            var b = ctx.Step!.Params["b"].AsInt();
            var result = Subtract(a, b);
            Assert.Equal(7, result);
        });
    }

    #endregion

    #region RuleOutline with Examples

    [RuleOutline("Adding '<a>' and '<b>' returns '<result>'")]
    [Example(1, 2, 3)]
    [Example(5, 5, 10)]
    [Example(100, 0, 100)]
    [Example(-5, 5, 0)]
    public void Addition_examples(int a, int b, int result)
    {
        Assert.Equal(result, Add(a, b));
    }

    [RuleOutline]
    [Example(10, 2, 5)]
    [Example(100, 10, 10)]
    [Example(7, 1, 7)]
    public void Dividing_A_by_B_returns_RESULT(int a, int b, int result)
    {
        // Using method name placeholders: _A_, _B_, _RESULT_
        Assert.Equal(result, Divide(a, b));
    }

    [RuleOutline("Multiplying '<x>' by '<y>' equals '<product>'")]
    [Example(3, 4, 12)]
    [Example(7, 8, 56)]
    [Example(0, 100, 0)]
    public void Multiplication_examples(int x, int y, int product)
    {
        Assert.Equal(product, Multiply(x, y));
    }

    #endregion

    #region Helper Methods

    private static int Add(int a, int b) => a + b;
    private static int Subtract(int a, int b) => a - b;
    private static int Multiply(int a, int b) => a * b;
    private static int Divide(int a, int b) => a / b;

    #endregion
}

/// <summary>
/// Specification: Email Validation Rules
/// 
/// Validates email format using data-driven rule outlines.
/// </summary>
[Specification("Email Validation Rules")]
public class EmailValidationSpec : LiveDocTest
{
    public EmailValidationSpec(ITestOutputHelper output) : base(output)
    {
    }

    [RuleOutline("Email '<email>' is <validity>")]
    [Example("test@example.com", "valid")]
    [Example("user.name@domain.org", "valid")]
    [Example("invalid-email", "invalid")]
    [Example("@nodomain.com", "invalid")]
    [Example("spaces in@email.com", "invalid")]
    [Example("", "invalid")]
    public void Email_validation(string email, string validity)
    {
        var isValid = IsValidEmail(email);
        var expected = validity == "valid";
        
        Assert.Equal(expected, isValid);
    }

    [Rule("Empty emails are always invalid")]
    public void Empty_email_is_invalid()
    {
        Assert.False(IsValidEmail(""));
        Assert.False(IsValidEmail(null!));
    }

    private static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;
        
        // Simple validation: contains @ and has content before and after
        var atIndex = email.IndexOf('@');
        if (atIndex <= 0 || atIndex >= email.Length - 1)
            return false;
        
        // No spaces allowed
        if (email.Contains(' '))
            return false;
        
        return true;
    }
}

/// <summary>
/// Specification: Method Name Placeholder Parsing
/// 
/// Tests for the _ALLCAPS placeholder syntax in method names.
/// </summary>
[Specification("Method Name Placeholder Parsing")]
public class MethodNamePlaceholderSpec : LiveDocTest
{
    public MethodNamePlaceholderSpec(ITestOutputHelper output) : base(output)
    {
    }

    [RuleOutline]
    [Example("hello", "HELLO")]
    [Example("World", "WORLD")]
    [Example("test123", "TEST123")]
    public void Converting_INPUT_to_uppercase_returns_EXPECTED(string input, string expected)
    {
        Assert.Equal(expected, input.ToUpperInvariant());
    }

    [RuleOutline]
    [Example(5, 25)]
    [Example(10, 100)]
    [Example(0, 0)]
    public void Square_of_N_is_RESULT(int n, int result)
    {
        Assert.Equal(result, n * n);
    }

    [RuleOutline]
    [Example("hello", 5)]
    [Example("", 0)]
    [Example("test", 4)]
    public void Length_of_STR_is_LEN(string str, int len)
    {
        Assert.Equal(len, str.Length);
    }
}
