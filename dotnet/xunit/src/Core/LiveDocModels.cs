using System.Reflection;

namespace SweDevTools.LiveDoc.xUnit.Core;

/// <summary>
/// Represents the execution status of a step.
/// </summary>
public enum StepStatus
{
    Pending,
    Passed,
    Failed,
    Skipped
}

/// <summary>
/// Tracks the execution of a single step (Given/When/Then/And/But).
/// </summary>
public class StepExecution
{
    public string Type { get; set; } = "";
    public string Description { get; set; } = "";
    /// <summary>
    /// The original step description before placeholder substitution.
    /// For outlines, this contains &lt;placeholder&gt; tokens for template display.
    /// </summary>
    public string? OriginalDescription { get; set; }
    public StepStatus Status { get; set; }
    public TimeSpan Duration { get; set; }
    public Exception? Exception { get; set; }
    public DateTime StartTime { get; set; }
}

/// <summary>
/// Base class for test case contexts (Feature or Specification).
/// Contains shared properties common to all test case types.
/// </summary>
public abstract class TestCaseContext
{
    /// <summary>
    /// The title/name of the test case.
    /// </summary>
    public string Title { get; set; } = "";
    
    /// <summary>
    /// Optional description providing additional context.
    /// </summary>
    public string? Description { get; set; }
    
    /// <summary>
    /// Tags for filtering/categorization.
    /// </summary>
    public string[] Tags { get; set; } = Array.Empty<string>();
}

/// <summary>
/// Provides context about the current feature being executed.
/// Used with BDD/Gherkin-style tests.
/// </summary>
public class FeatureContext : TestCaseContext
{
    // Feature-specific properties can be added here
}

/// <summary>
/// Provides context about the current specification being executed.
/// Used with MSpec-style tests.
/// </summary>
public class SpecificationContext : TestCaseContext
{
    // Specification-specific properties can be added here
}

/// <summary>
/// Provides context about the current scenario being executed.
/// </summary>
public class ScenarioContext
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
    public List<StepExecution> Steps { get; } = new();
}

/// <summary>
/// Provides context about the current rule being executed.
/// Includes value extraction from the rule title for self-documenting tests.
/// </summary>
/// <example>
/// <code>
/// [Rule("Adding '5' and '3' returns '8'")]
/// public void Add_values()
/// {
///     var (a, b, expected) = Rule.Values.As&lt;int, int, int&gt;();
///     Assert.Equal(expected, a + b);
/// }
/// </code>
/// </example>
public class RuleContext
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Extracted values from quoted strings in the rule title.
    /// Access by index: Values[0].AsInt()
    /// </summary>
    public LiveDocValueArray Values { get; set; } = LiveDocValueArray.Empty;

    /// <summary>
    /// Extracted named parameters from &lt;name:value&gt; patterns in the rule title.
    /// Access by name: Params["name"].AsString()
    /// </summary>
    public LiveDocValueDictionary Params { get; set; } = LiveDocValueDictionary.Empty;

    /// <summary>
    /// Raw string values before conversion.
    /// </summary>
    public string[] ValuesRaw { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Raw parameter values before conversion.
    /// </summary>
    public IReadOnlyDictionary<string, string> ParamsRaw { get; set; }
        = new Dictionary<string, string>();
}

/// <summary>
/// Dynamic wrapper for accessing example data in scenario outlines.
/// Supports both dictionary-style and property-style access.
/// </summary>
public class ExampleData
{
    private readonly Dictionary<string, object?> _data;
    private readonly object[]? _rawParameters;

    public ExampleData(Dictionary<string, object?> data)
    {
        _data = data;
    }

    public ExampleData(MethodInfo method, object[] parameters)
    {
        _rawParameters = parameters;
        _data = new Dictionary<string, object?>();

        var paramInfos = method.GetParameters();
        for (int i = 0; i < paramInfos.Length && i < parameters.Length; i++)
        {
            var name = paramInfos[i].Name;
            if (name != null)
            {
                _data[name] = parameters[i];
            }
        }
    }

    /// <summary>
    /// Gets a value by key (case-insensitive).
    /// </summary>
    public object? this[string key]
    {
        get
        {
            // Try exact match first
            if (_data.TryGetValue(key, out var value))
                return value;

            // Try case-insensitive match
            var actualKey = _data.Keys.FirstOrDefault(k => 
                k.Equals(key, StringComparison.OrdinalIgnoreCase));
            
            return actualKey != null ? _data[actualKey] : null;
        }
    }

    /// <summary>
    /// Gets all key-value pairs in the example data.
    /// </summary>
    public IEnumerable<KeyValuePair<string, object?>> GetAll() => _data;

    /// <summary>
    /// Gets a strongly-typed value by key.
    /// </summary>
    public T? Get<T>(string key)
    {
        var value = this[key];
        if (value is T typed)
            return typed;

        if (value == null)
            return default;

        // Try conversion
        try
        {
            return (T)Convert.ChangeType(value, typeof(T));
        }
        catch
        {
            return default;
        }
    }

    /// <summary>
    /// Provides property-style access (e.g., Example.CustomerCountry).
    /// Uses dynamic to enable natural syntax.
    /// </summary>
    public dynamic AsDynamic() => new DynamicExampleData(_data);

    private class DynamicExampleData : System.Dynamic.DynamicObject
    {
        private readonly Dictionary<string, object?> _data;

        public DynamicExampleData(Dictionary<string, object?> data)
        {
            _data = data;
        }

        public override bool TryGetMember(System.Dynamic.GetMemberBinder binder, out object? result)
        {
            var key = _data.Keys.FirstOrDefault(k => 
                k.Equals(binder.Name, StringComparison.OrdinalIgnoreCase));

            if (key != null)
            {
                result = _data[key];
                return true;
            }

            result = null;
            return false;
        }
    }
}
