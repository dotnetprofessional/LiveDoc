using System.Text.RegularExpressions;

namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>Kind of assertion to apply to a property value.</summary>
public enum AssertionKind { Exists, TypeCheck, NumericComparison, LengthCheck, Matches }

/// <summary>A single assertion applied to a JSON property.</summary>
public record Assertion(
    AssertionKind Kind,
    string? Operator = null,
    decimal? Threshold = null,
    string? TypeName = null,
    string? Pattern = null);

/// <summary>
/// Rule for how to handle a property during JSON comparison.
/// Bare names (IsIgnore=true, no assertions) skip the property entirely.
/// Properties with assertions are validated against those rules instead of exact matching.
/// </summary>
public record PropertyRule(
    string PropertyName,
    bool IsIgnore,
    IReadOnlyList<Assertion> Assertions);

/// <summary>
/// Collection of property rules loaded from a rules file.
/// Supports direct name, wildcard (*.name), full path, and parent.name matching.
/// </summary>
public class PropertyRules
{
    private readonly Dictionary<string, PropertyRule> _rules;

    public PropertyRules(IEnumerable<PropertyRule> rules)
    {
        _rules = new Dictionary<string, PropertyRule>(StringComparer.OrdinalIgnoreCase);
        foreach (var rule in rules)
            _rules[rule.PropertyName] = rule;
    }

    /// <summary>
    /// Finds a rule matching the given property name and JSON path.
    /// Checks in order: direct name, *.name, full path, parent.name.
    /// </summary>
    public PropertyRule? Find(string propertyName, string currentPath)
    {
        if (_rules.TryGetValue(propertyName, out var rule))
            return rule;

        if (_rules.TryGetValue($"*.{propertyName}", out rule))
            return rule;

        var fullPath = string.IsNullOrEmpty(currentPath) ? propertyName : $"{currentPath}.{propertyName}";
        if (_rules.TryGetValue(fullPath, out rule))
            return rule;

        var lastDot = currentPath.LastIndexOf('.');
        var parentName = lastDot >= 0 ? currentPath[(lastDot + 1)..] : currentPath;
        var bracket = parentName.IndexOf('[');
        if (bracket >= 0) parentName = parentName[..bracket];
        if (!string.IsNullOrEmpty(parentName) && _rules.TryGetValue($"{parentName}.{propertyName}", out rule))
            return rule;

        return null;
    }

    /// <summary>Returns the set of property names that are pure ignores (for backward compat).</summary>
    public IReadOnlySet<string> ToIgnoreSet()
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, rule) in _rules)
        {
            if (rule.IsIgnore && rule.Assertions.Count == 0)
                set.Add(key);
        }
        return set;
    }

    public static readonly PropertyRules Empty = new([]);

    // ── Rule Parsing ───────────────────────────────────────────────

    /// <summary>
    /// Loads property rules from a text file. Supports both bare ignore names
    /// and assertion syntax (name: rule1, rule2).
    /// Returns <see cref="Empty"/> if the file does not exist.
    /// </summary>
    public static PropertyRules Load(string filePath)
    {
        if (!File.Exists(filePath))
            return Empty;

        var rules = new List<PropertyRule>();
        var lines = File.ReadAllLines(filePath);
        for (int i = 0; i < lines.Length; i++)
        {
            var trimmed = lines[i].Trim();
            if (trimmed.Length == 0 || trimmed.StartsWith('#'))
                continue;

            rules.Add(ParseRuleLine(trimmed, i + 1));
        }
        return new PropertyRules(rules);
    }

    /// <summary>
    /// Loads and merges property rules from multiple files.
    /// Later files override earlier ones for the same property name.
    /// </summary>
    public static PropertyRules Load(params string[] filePaths)
    {
        var allRules = new List<PropertyRule>();
        foreach (var path in filePaths)
        {
            if (!File.Exists(path)) continue;
            var lines = File.ReadAllLines(path);
            for (int i = 0; i < lines.Length; i++)
            {
                var trimmed = lines[i].Trim();
                if (trimmed.Length == 0 || trimmed.StartsWith('#'))
                    continue;
                allRules.Add(ParseRuleLine(trimmed, i + 1));
            }
        }
        return new PropertyRules(allRules);
    }

    internal static PropertyRule ParseRuleLine(string line, int lineNumber)
    {
        var colonIdx = line.IndexOf(':');
        if (colonIdx < 0)
            return new PropertyRule(line, IsIgnore: true, Assertions: []);

        var propName = line[..colonIdx].Trim();
        var rulesPart = line[(colonIdx + 1)..].Trim();

        if (string.IsNullOrWhiteSpace(propName))
            throw new PropertyRuleParseException($"Line {lineNumber}: empty property name");
        if (string.IsNullOrWhiteSpace(rulesPart))
            throw new PropertyRuleParseException($"Line {lineNumber}: empty assertion after ':'");

        var assertions = new List<Assertion>();
        foreach (var segment in rulesPart.Split(','))
        {
            var rule = segment.Trim();
            if (rule.Length == 0) continue;
            assertions.Add(ParseAssertion(rule, lineNumber));
        }

        if (assertions.Count == 0)
            throw new PropertyRuleParseException($"Line {lineNumber}: no valid assertions found");

        return new PropertyRule(propName, IsIgnore: false, Assertions: assertions);
    }

    internal static Assertion ParseAssertion(string text, int lineNumber)
    {
        if (text.Equals("exists", StringComparison.OrdinalIgnoreCase))
            return new Assertion(AssertionKind.Exists);

        if (text.StartsWith("type ", StringComparison.OrdinalIgnoreCase))
        {
            var typeName = text[5..].Trim().ToLowerInvariant();
            if (typeName is not ("string" or "number" or "boolean" or "array" or "object" or "null"))
                throw new PropertyRuleParseException(
                    $"Line {lineNumber}: unknown type '{typeName}'. Valid: string, number, boolean, array, object, null");
            return new Assertion(AssertionKind.TypeCheck, TypeName: typeName);
        }

        if (text.StartsWith("length ", StringComparison.OrdinalIgnoreCase))
        {
            var rest = text[7..].Trim();
            var (op, value) = ParseComparison(rest, lineNumber);
            return new Assertion(AssertionKind.LengthCheck, Operator: op, Threshold: value);
        }

        if (text.StartsWith("matches ", StringComparison.OrdinalIgnoreCase))
        {
            var pattern = text[8..].Trim();
            if (string.IsNullOrWhiteSpace(pattern))
                throw new PropertyRuleParseException($"Line {lineNumber}: empty regex pattern");
            try { _ = new Regex(pattern); }
            catch (RegexParseException ex)
            {
                throw new PropertyRuleParseException(
                    $"Line {lineNumber}: invalid regex '{pattern}': {ex.Message}");
            }
            return new Assertion(AssertionKind.Matches, Pattern: pattern);
        }

        if (text.StartsWith(">=") || text.StartsWith("<=") || text.StartsWith(">") || text.StartsWith("<"))
        {
            var (op, value) = ParseComparison(text, lineNumber);
            return new Assertion(AssertionKind.NumericComparison, Operator: op, Threshold: value);
        }

        throw new PropertyRuleParseException(
            $"Line {lineNumber}: unrecognized assertion '{text}'. Valid: exists, type <t>, > N, >= N, < N, <= N, length <op> N, matches <pattern>");
    }

    private static (string op, decimal value) ParseComparison(string text, int lineNumber)
    {
        string op;
        string rest;
        if (text.StartsWith(">=")) { op = ">="; rest = text[2..].Trim(); }
        else if (text.StartsWith("<=")) { op = "<="; rest = text[2..].Trim(); }
        else if (text.StartsWith(">")) { op = ">"; rest = text[1..].Trim(); }
        else if (text.StartsWith("<")) { op = "<"; rest = text[1..].Trim(); }
        else
            throw new PropertyRuleParseException(
                $"Line {lineNumber}: expected comparison operator (>, >=, <, <=) in '{text}'");

        if (!decimal.TryParse(rest, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var value))
            throw new PropertyRuleParseException(
                $"Line {lineNumber}: invalid number '{rest}' in comparison");

        return (op, value);
    }
}
