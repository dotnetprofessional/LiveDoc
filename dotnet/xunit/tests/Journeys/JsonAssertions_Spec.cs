using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Journeys;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Journeys;

[Specification(Description = @"
    Verifies the JsonAssertions.IsComparable() deep comparison engine.
    Covers value matching, structural checks, array handling, property rules,
    assertion rules, and error reporting for JSON contract validation.
")]
public class JsonAssertions_Spec : SpecificationTest
{
    public JsonAssertions_Spec(ITestOutputHelper output) : base(output) { }

    private static readonly PropertyRules NoRules = PropertyRules.Empty;

    // ── Passing Cases ──────────────────────────────────────────────

    [Rule("Identical simple objects pass comparison")]
    public void Identical_simple_objects_pass()
    {
        var json = """{"name":"Alice","age":30}""";
        JsonAssertions.IsComparable(json, json, NoRules);
    }

    [Rule("Identical nested objects pass comparison")]
    public void Identical_nested_objects_pass()
    {
        var json = """{"user":{"name":"Alice","address":{"city":"Sydney"}}}""";
        JsonAssertions.IsComparable(json, json, NoRules);
    }

    [Rule("Identical arrays pass comparison")]
    public void Identical_arrays_pass()
    {
        var json = """{"items":["a","b","c"]}""";
        JsonAssertions.IsComparable(json, json, NoRules);
    }

    [Rule("Empty objects pass comparison")]
    public void Empty_objects_pass()
    {
        JsonAssertions.IsComparable("{}", "{}", NoRules);
    }

    // ── Value Mismatches ───────────────────────────────────────────

    [Rule("String value mismatch throws with VALUE diff")]
    public void String_value_mismatch_detected()
    {
        var actual = """{"name":"Bob"}""";
        var expected = """{"name":"Alice"}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("VALUE at 'name'", ex.Message);
        Assert.Contains("Alice", ex.Message);
        Assert.Contains("Bob", ex.Message);
    }

    [Rule("Number value mismatch throws with VALUE diff")]
    public void Number_value_mismatch_detected()
    {
        var actual = """{"count":5}""";
        var expected = """{"count":10}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("VALUE at 'count'", ex.Message);
    }

    [Rule("Boolean value mismatch throws with VALUE diff")]
    public void Boolean_value_mismatch_detected()
    {
        var actual = """{"active":false}""";
        var expected = """{"active":true}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("VALUE at 'active'", ex.Message);
    }

    // ── Structural ─────────────────────────────────────────────────

    [Rule("Missing property throws with MISSING diff")]
    public void Missing_property_detected()
    {
        var actual = """{"name":"Alice"}""";
        var expected = """{"name":"Alice","email":"a@b.com"}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("MISSING at 'email'", ex.Message);
    }

    [Rule("Unexpected property throws with UNEXPECTED diff")]
    public void Unexpected_property_detected()
    {
        var actual = """{"name":"Alice","extra":"data"}""";
        var expected = """{"name":"Alice"}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("UNEXPECTED at 'extra'", ex.Message);
    }

    [Rule("Type mismatch between string and number throws with TYPE diff")]
    public void Type_mismatch_detected()
    {
        var actual = """{"value":"text"}""";
        var expected = """{"value":42}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("TYPE at 'value'", ex.Message);
    }

    // ── Arrays ─────────────────────────────────────────────────────

    [Rule("Array count mismatch throws with ARRAY diff")]
    public void Array_count_mismatch_detected()
    {
        var actual = """{"items":[1,2]}""";
        var expected = """{"items":[1,2,3]}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("ARRAY at 'items'", ex.Message);
    }

    [Rule("Array pattern template validates each actual item against single expected template")]
    public void Array_pattern_template_validates_all_items()
    {
        var actual = """{"items":[{"name":"A","type":"x"},{"name":"B","type":"x"},{"name":"C","type":"x"}]}""";
        var expected = """{"items":[{"name":"A","type":"x"}]}""";

        // Pattern template: 1 expected, 3 actual — items[1] and items[2] have different names
        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        // items[1].name and items[2].name differ from the template "A"
        Assert.Contains("VALUE at 'items[1].name'", ex.Message);
        Assert.Contains("VALUE at 'items[2].name'", ex.Message);
    }

    [Rule("Both empty arrays pass comparison")]
    public void Both_empty_arrays_pass()
    {
        var json = """{"items":[]}""";
        JsonAssertions.IsComparable(json, json, NoRules);
    }

    // ── Edge Cases ─────────────────────────────────────────────────

    [Rule("Empty actual JSON throws with descriptive message")]
    public void Empty_actual_throws()
    {
        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable("", """{"a":1}""", NoRules));

        Assert.Contains("Actual JSON is empty or null", ex.Message);
    }

    [Rule("Null actual JSON throws with descriptive message")]
    public void Null_actual_throws()
    {
        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(null!, """{"a":1}""", NoRules));

        Assert.Contains("Actual JSON is empty or null", ex.Message);
    }

    [Rule("Invalid JSON throws with parse error info")]
    public void Invalid_json_throws()
    {
        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable("{bad json}", """{"a":1}""", NoRules));

        Assert.Contains("Actual JSON is invalid", ex.Message);
    }

    [Rule("Context string appears in error message")]
    public void Context_string_in_error()
    {
        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable("""{"a":1}""", """{"a":2}""", NoRules, "step:getUser"));

        Assert.Contains("step:getUser", ex.Message);
    }

    // ── Rules: Ignore ──────────────────────────────────────────────

    [Rule("Ignored property is skipped even when values differ")]
    public void Ignored_property_skipped()
    {
        var actual = """{"id":"abc-123","name":"Alice"}""";
        var expected = """{"id":"template-id","name":"Alice"}""";

        var rules = new PropertyRules([
            new PropertyRule("id", IsIgnore: true, Assertions: [])
        ]);

        // Should not throw — id is ignored, name matches
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    [Rule("Unexpected property with ignore rule does not trigger error")]
    public void Unexpected_property_with_ignore_rule_no_error()
    {
        var actual = """{"name":"Alice","timestamp":"2024-01-01T00:00:00Z"}""";
        var expected = """{"name":"Alice"}""";

        var rules = new PropertyRules([
            new PropertyRule("timestamp", IsIgnore: true, Assertions: [])
        ]);

        // Should not throw — timestamp is unexpected but ignored via rule
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    // ── Rules: Type Assertion ──────────────────────────────────────

    [Rule("Type assertion rule passes for matching type")]
    public void Type_assertion_passes_for_matching_type()
    {
        var actual = """{"name":"Alice"}""";
        var expected = """{"name":"template"}""";

        var rules = new PropertyRules([
            new PropertyRule("name", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.TypeCheck, TypeName: "string")])
        ]);

        // Should not throw — "Alice" is a string
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    [Rule("Type assertion rule fails for mismatched type")]
    public void Type_assertion_fails_for_mismatched_type()
    {
        var actual = """{"name":42}""";
        var expected = """{"name":"template"}""";

        var rules = new PropertyRules([
            new PropertyRule("name", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.TypeCheck, TypeName: "string")])
        ]);

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, rules));

        Assert.Contains("RULE at 'name'", ex.Message);
        Assert.Contains("expected type string", ex.Message);
        Assert.Contains("actual number", ex.Message);
    }

    // ── Rules: Numeric Comparison ──────────────────────────────────

    [Rule("Numeric comparison rule passes when condition is met")]
    public void Numeric_comparison_passes()
    {
        var actual = """{"score":5}""";
        var expected = """{"score":0}""";

        var rules = new PropertyRules([
            new PropertyRule("score", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.NumericComparison, Operator: ">", Threshold: 0)])
        ]);

        // Should not throw — 5 > 0
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    [Rule("Numeric comparison rule fails when condition is not met")]
    public void Numeric_comparison_fails()
    {
        var actual = """{"score":-1}""";
        var expected = """{"score":0}""";

        var rules = new PropertyRules([
            new PropertyRule("score", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.NumericComparison, Operator: ">", Threshold: 0)])
        ]);

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, rules));

        Assert.Contains("RULE at 'score'", ex.Message);
        Assert.Contains("-1 is not > 0", ex.Message);
    }

    // ── Rules: Length Check ────────────────────────────────────────

    [Rule("Length check rule passes for array meeting condition")]
    public void Length_check_passes()
    {
        var actual = """{"tags":["a","b"]}""";
        var expected = """{"tags":["placeholder"]}""";

        var rules = new PropertyRules([
            new PropertyRule("tags", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.LengthCheck, Operator: ">=", Threshold: 1)])
        ]);

        // Should not throw — array length 2 >= 1
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    // ── Rules: Regex Match ─────────────────────────────────────────

    [Rule("Regex match rule passes for matching string")]
    public void Regex_match_passes()
    {
        var actual = """{"name":"Alice"}""";
        var expected = """{"name":"template"}""";

        var rules = new PropertyRules([
            new PropertyRule("name", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.Matches, Pattern: "^[A-Z]")])
        ]);

        // Should not throw — "Alice" starts with uppercase
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    [Rule("Regex match rule fails for non-matching string")]
    public void Regex_match_fails()
    {
        var actual = """{"name":"alice"}""";
        var expected = """{"name":"template"}""";

        var rules = new PropertyRules([
            new PropertyRule("name", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.Matches, Pattern: "^[A-Z]")])
        ]);

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, rules));

        Assert.Contains("RULE at 'name'", ex.Message);
        Assert.Contains("does not match pattern", ex.Message);
    }

    // ── Rules: Exists ──────────────────────────────────────────────

    [Rule("Exists assertion passes when property exists with any value")]
    public void Exists_assertion_passes()
    {
        var actual = """{"id":"completely-different-value","name":"Alice"}""";
        var expected = """{"id":"template","name":"Alice"}""";

        var rules = new PropertyRules([
            new PropertyRule("id", IsIgnore: false,
                Assertions: [new Assertion(AssertionKind.Exists)])
        ]);

        // Should not throw — id exists in actual, value is irrelevant
        JsonAssertions.IsComparable(actual, expected, rules);
    }

    // ── Nested Path Reporting ──────────────────────────────────────

    [Rule("Nested object mismatch reports full dotted path")]
    public void Nested_mismatch_reports_full_path()
    {
        var actual = """{"user":{"address":{"city":"Melbourne"}}}""";
        var expected = """{"user":{"address":{"city":"Sydney"}}}""";

        var ex = Assert.Throws<JsonAssertionException>(
            () => JsonAssertions.IsComparable(actual, expected, NoRules));

        Assert.Contains("VALUE at 'user.address.city'", ex.Message);
    }
}
