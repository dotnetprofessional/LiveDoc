using System.Text.Json;
using System.Text.RegularExpressions;

namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>
/// Deep JSON comparison engine with configurable property rules.
/// Compares two JSON documents property by property, supporting:
/// <list type="bullet">
///   <item>Pure ignore (skip dynamic properties entirely)</item>
///   <item>Existence checks</item>
///   <item>Type assertions (string, number, boolean, array, object, null)</item>
///   <item>Numeric comparisons (&gt;, &gt;=, &lt;, &lt;=)</item>
///   <item>Length checks for arrays and strings</item>
///   <item>Regex pattern matching</item>
///   <item>Array pattern templates (single expected item validates all actual items)</item>
/// </list>
/// </summary>
public static class JsonAssertions
{
    /// <summary>
    /// Compares actual and expected JSON using property rules for flexible matching.
    /// Throws <see cref="JsonAssertionException"/> with all differences listed.
    /// </summary>
    public static void IsComparable(
        string actualJson,
        string expectedJson,
        PropertyRules rules,
        string context = "")
    {
        if (string.IsNullOrWhiteSpace(actualJson))
            throw new JsonAssertionException($"Actual JSON is empty or null{ForCtx(context)}");
        if (string.IsNullOrWhiteSpace(expectedJson))
            throw new JsonAssertionException($"Expected JSON is empty or null{ForCtx(context)}");

        JsonElement actual, expected;
        try { actual = JsonDocument.Parse(actualJson).RootElement; }
        catch (JsonException ex) { throw new JsonAssertionException($"Actual JSON is invalid{ForCtx(context)}: {ex.Message}"); }

        try { expected = JsonDocument.Parse(expectedJson).RootElement; }
        catch (JsonException ex) { throw new JsonAssertionException($"Expected JSON is invalid{ForCtx(context)}: {ex.Message}"); }

        var diffs = new List<string>();
        CompareElements(actual, expected, "", rules, diffs);

        if (diffs.Count > 0)
        {
            var header = string.IsNullOrEmpty(context)
                ? "JSON comparison failed:"
                : $"JSON comparison failed for '{context}':";
            throw new JsonAssertionException($"{header}\n  {string.Join("\n  ", diffs)}");
        }
    }

    /// <summary>
    /// Backward-compatible overload using a set of property names to ignore.
    /// </summary>
    public static void IsComparable(
        string actualJson,
        string expectedJson,
        IReadOnlySet<string> ignoreProperties,
        string context = "")
    {
        var rules = FromIgnoreSet(ignoreProperties);
        IsComparable(actualJson, expectedJson, rules, context);
    }

    /// <summary>
    /// Loads property rules from a text file.
    /// </summary>
    public static PropertyRules LoadPropertyRules(string filePath)
        => PropertyRules.Load(filePath);

    /// <summary>
    /// Loads and merges property rules from multiple files.
    /// </summary>
    public static PropertyRules LoadPropertyRules(params string[] filePaths)
        => PropertyRules.Load(filePaths);

    /// <summary>
    /// Backward-compatible: loads property names as a pure-ignore set.
    /// </summary>
    public static IReadOnlySet<string> LoadIgnoreProperties(string filePath)
    {
        if (!File.Exists(filePath))
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var props = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in File.ReadAllLines(filePath))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0 || trimmed.StartsWith('#'))
                continue;
            var colonIdx = trimmed.IndexOf(':');
            props.Add(colonIdx >= 0 ? trimmed[..colonIdx].Trim() : trimmed);
        }
        return props;
    }

    // ── Rule Evaluation ────────────────────────────────────────────

    internal static void EvaluateAssertions(
        IReadOnlyList<Assertion> assertions,
        JsonElement actual,
        string path,
        List<string> diffs)
    {
        foreach (var assertion in assertions)
        {
            switch (assertion.Kind)
            {
                case AssertionKind.Exists:
                    break;

                case AssertionKind.TypeCheck:
                    var actualType = GetTypeName(actual.ValueKind);
                    if (!string.Equals(actualType, assertion.TypeName, StringComparison.OrdinalIgnoreCase))
                        diffs.Add($"RULE at '{path}': expected type {assertion.TypeName}, actual {actualType}");
                    break;

                case AssertionKind.NumericComparison:
                    if (actual.ValueKind != JsonValueKind.Number)
                    {
                        diffs.Add($"RULE at '{path}': expected number for {assertion.Operator} {assertion.Threshold}, actual is {GetTypeName(actual.ValueKind)}");
                        break;
                    }
                    var numVal = actual.GetDecimal();
                    if (!CompareNumeric(numVal, assertion.Operator!, assertion.Threshold!.Value))
                        diffs.Add($"RULE at '{path}': {numVal} is not {assertion.Operator} {assertion.Threshold}");
                    break;

                case AssertionKind.LengthCheck:
                    int length;
                    if (actual.ValueKind == JsonValueKind.Array)
                        length = actual.GetArrayLength();
                    else if (actual.ValueKind == JsonValueKind.String)
                        length = actual.GetString()?.Length ?? 0;
                    else
                    {
                        diffs.Add($"RULE at '{path}': length check requires array or string, actual is {GetTypeName(actual.ValueKind)}");
                        break;
                    }
                    if (!CompareNumeric(length, assertion.Operator!, assertion.Threshold!.Value))
                        diffs.Add($"RULE at '{path}': length {length} is not {assertion.Operator} {assertion.Threshold}");
                    break;

                case AssertionKind.Matches:
                    if (actual.ValueKind != JsonValueKind.String)
                    {
                        diffs.Add($"RULE at '{path}': matches requires string, actual is {GetTypeName(actual.ValueKind)}");
                        break;
                    }
                    var strVal = actual.GetString() ?? "";
                    if (!Regex.IsMatch(strVal, assertion.Pattern!))
                        diffs.Add($"RULE at '{path}': '{strVal}' does not match pattern '{assertion.Pattern}'");
                    break;
            }
        }
    }

    private static bool CompareNumeric(decimal actual, string op, decimal threshold) => op switch
    {
        ">" => actual > threshold,
        ">=" => actual >= threshold,
        "<" => actual < threshold,
        "<=" => actual <= threshold,
        _ => false
    };

    private static string GetTypeName(JsonValueKind kind) => kind switch
    {
        JsonValueKind.String => "string",
        JsonValueKind.Number => "number",
        JsonValueKind.True or JsonValueKind.False => "boolean",
        JsonValueKind.Array => "array",
        JsonValueKind.Object => "object",
        JsonValueKind.Null => "null",
        _ => kind.ToString().ToLowerInvariant()
    };

    // ── Comparison Engine ──────────────────────────────────────────

    private static void CompareElements(
        JsonElement actual,
        JsonElement expected,
        string path,
        PropertyRules rules,
        List<string> diffs)
    {
        var expectedKind = NormalizeKind(expected.ValueKind);
        var actualKind = NormalizeKind(actual.ValueKind);

        if (expectedKind != actualKind)
        {
            diffs.Add($"TYPE at '{path}': expected {expected.ValueKind}, actual {actual.ValueKind}");
            return;
        }

        switch (expected.ValueKind)
        {
            case JsonValueKind.Object:
                CompareObjects(actual, expected, path, rules, diffs);
                break;
            case JsonValueKind.Array:
                CompareArrays(actual, expected, path, rules, diffs);
                break;
            case JsonValueKind.String:
                var es = expected.GetString();
                var @as = actual.GetString();
                if (!string.Equals(es, @as, StringComparison.Ordinal))
                    diffs.Add($"VALUE at '{path}': expected \"{es}\", actual \"{@as}\"");
                break;
            case JsonValueKind.Number:
                if (expected.GetDecimal() != actual.GetDecimal())
                    diffs.Add($"VALUE at '{path}': expected {expected.GetRawText()}, actual {actual.GetRawText()}");
                break;
            case JsonValueKind.True:
            case JsonValueKind.False:
                if (expected.GetBoolean() != actual.GetBoolean())
                    diffs.Add($"VALUE at '{path}': expected {expected.GetRawText()}, actual {actual.GetRawText()}");
                break;
            case JsonValueKind.Null:
                break;
        }
    }

    private static void CompareObjects(
        JsonElement actual,
        JsonElement expected,
        string path,
        PropertyRules rules,
        List<string> diffs)
    {
        var expectedProps = new Dictionary<string, JsonElement>();
        foreach (var prop in expected.EnumerateObject())
            expectedProps[prop.Name] = prop.Value;

        var actualProps = new Dictionary<string, JsonElement>();
        foreach (var prop in actual.EnumerateObject())
            actualProps[prop.Name] = prop.Value;

        foreach (var (name, expectedValue) in expectedProps)
        {
            var fieldPath = string.IsNullOrEmpty(path) ? name : $"{path}.{name}";
            var rule = rules.Find(name, path);

            if (rule is { IsIgnore: true, Assertions.Count: 0 })
                continue;

            if (!actualProps.TryGetValue(name, out var actualValue))
            {
                if (rule is { Assertions.Count: > 0 })
                    diffs.Add($"MISSING at '{fieldPath}': property has assertions but not found in response");
                else if (rule is null)
                    diffs.Add($"MISSING at '{fieldPath}': expected in response but not found");
                continue;
            }

            if (rule is { Assertions.Count: > 0 })
            {
                EvaluateAssertions(rule.Assertions, actualValue, fieldPath, diffs);
            }
            else
            {
                CompareElements(actualValue, expectedValue, fieldPath, rules, diffs);
            }
        }

        foreach (var name in actualProps.Keys)
        {
            var rule = rules.Find(name, path);
            if (rule is not null)
                continue;

            if (!expectedProps.ContainsKey(name))
            {
                var fieldPath = string.IsNullOrEmpty(path) ? name : $"{path}.{name}";
                diffs.Add($"UNEXPECTED at '{fieldPath}': present in response but not in expected");
            }
        }
    }

    private static void CompareArrays(
        JsonElement actual,
        JsonElement expected,
        string path,
        PropertyRules rules,
        List<string> diffs)
    {
        var expectedItems = expected.EnumerateArray().ToList();
        var actualItems = actual.EnumerateArray().ToList();

        if (expectedItems.Count > 0 && actualItems.Count == 0)
        {
            diffs.Add($"ARRAY at '{path}': expected {expectedItems.Count} item(s), actual is empty");
            return;
        }

        if (expectedItems.Count == 0 && actualItems.Count > 0)
        {
            diffs.Add($"ARRAY at '{path}': expected empty, actual has {actualItems.Count} item(s)");
            return;
        }

        if (expectedItems.Count == 0 && actualItems.Count == 0)
            return;

        bool isPattern = expectedItems.Count == 1 && actualItems.Count != 1;

        if (!isPattern && expectedItems.Count != actualItems.Count)
            diffs.Add($"ARRAY at '{path}': expected {expectedItems.Count} item(s), actual {actualItems.Count}");

        for (int i = 0; i < actualItems.Count; i++)
        {
            var expectedIndex = isPattern ? 0 : i;
            if (expectedIndex >= expectedItems.Count)
            {
                diffs.Add($"EXTRA at '{path}[{i}]': actual has more items than expected");
                break;
            }

            CompareElements(actualItems[i], expectedItems[expectedIndex], $"{path}[{i}]", rules, diffs);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private static PropertyRules FromIgnoreSet(IReadOnlySet<string> ignoreProperties)
    {
        var rules = ignoreProperties.Select(name =>
            new PropertyRule(name, IsIgnore: true, Assertions: []));
        return new PropertyRules(rules);
    }

    private static JsonValueKind NormalizeKind(JsonValueKind kind) =>
        kind is JsonValueKind.True or JsonValueKind.False ? JsonValueKind.True : kind;

    private static string ForCtx(string context) =>
        string.IsNullOrEmpty(context) ? "" : $" (context: '{context}')";
}
