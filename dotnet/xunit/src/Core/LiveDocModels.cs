using System.Reflection;

namespace LiveDoc.xUnit.Core;

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
    public StepStatus Status { get; set; }
    public TimeSpan Duration { get; set; }
    public Exception? Exception { get; set; }
    public DateTime StartTime { get; set; }
}

/// <summary>
/// Provides context about the current feature being executed.
/// </summary>
public class FeatureContext
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
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
