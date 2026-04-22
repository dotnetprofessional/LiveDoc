using System.Collections;

namespace SweDevTools.LiveDoc.xUnit.Core;

/// <summary>
/// A dictionary-like collection for accessing named parameters extracted from step descriptions.
/// Provides LiveDocValue wrappers for type-safe conversion.
/// </summary>
public class LiveDocValueDictionary : IEnumerable<KeyValuePair<string, LiveDocValue>>
{
    private readonly Dictionary<string, string> _rawValues;
    private readonly Dictionary<string, LiveDocValue> _values;
    private readonly string _stepTitle;

    /// <summary>
    /// An empty dictionary (used as default for contexts with no extracted parameters).
    /// </summary>
    public static readonly LiveDocValueDictionary Empty = new(new Dictionary<string, string>(), "");

    /// <summary>
    /// Creates an empty dictionary.
    /// </summary>
    /// <param name="stepTitle">The step title for error context.</param>
    public LiveDocValueDictionary(string stepTitle)
    {
        _rawValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        _values = new Dictionary<string, LiveDocValue>(StringComparer.OrdinalIgnoreCase);
        _stepTitle = stepTitle;
    }

    /// <summary>
    /// Creates a dictionary from raw key-value pairs.
    /// </summary>
    /// <param name="rawValues">The raw string values.</param>
    /// <param name="stepTitle">The step title for error context.</param>
    public LiveDocValueDictionary(Dictionary<string, string> rawValues, string stepTitle)
    {
        _rawValues = new Dictionary<string, string>(rawValues, StringComparer.OrdinalIgnoreCase);
        _values = new Dictionary<string, LiveDocValue>(StringComparer.OrdinalIgnoreCase);
        _stepTitle = stepTitle;

        foreach (var kvp in rawValues)
        {
            _values[kvp.Key] = new LiveDocValue(kvp.Value, stepTitle, paramName: kvp.Key);
        }
    }

    /// <summary>
    /// Gets a value by name.
    /// </summary>
    /// <param name="name">The parameter name (case-insensitive).</param>
    /// <returns>The LiveDocValue wrapper for the parameter.</returns>
    /// <exception cref="LiveDocParamNotFoundException">Thrown when the parameter doesn't exist.</exception>
    public LiveDocValue this[string name]
    {
        get
        {
            if (_values.TryGetValue(name, out var value))
            {
                return value;
            }

            throw new LiveDocParamNotFoundException(name, _rawValues.Keys.ToArray(), _stepTitle);
        }
    }

    /// <summary>
    /// Tries to get a value by name.
    /// </summary>
    /// <param name="name">The parameter name (case-insensitive).</param>
    /// <param name="value">The LiveDocValue if found.</param>
    /// <returns>True if the parameter exists.</returns>
    public bool TryGetValue(string name, out LiveDocValue? value)
    {
        return _values.TryGetValue(name, out value);
    }

    /// <summary>
    /// Checks if a parameter exists.
    /// </summary>
    /// <param name="name">The parameter name (case-insensitive).</param>
    /// <returns>True if the parameter exists.</returns>
    public bool ContainsKey(string name) => _values.ContainsKey(name);

    /// <summary>
    /// Gets the number of parameters.
    /// </summary>
    public int Count => _values.Count;

    /// <summary>
    /// Gets all parameter names.
    /// </summary>
    public IEnumerable<string> Keys => _values.Keys;

    /// <summary>
    /// Gets all values.
    /// </summary>
    public IEnumerable<LiveDocValue> Values => _values.Values;

    /// <summary>
    /// Gets the raw string values dictionary.
    /// </summary>
    public IReadOnlyDictionary<string, string> Raw => _rawValues;

    public IEnumerator<KeyValuePair<string, LiveDocValue>> GetEnumerator() => _values.GetEnumerator();

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
