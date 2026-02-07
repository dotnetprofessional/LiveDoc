namespace LiveDoc.xUnit.Core;

/// <summary>
/// Context for the current step being executed.
/// Provides access to extracted values and parameters from the step description.
/// </summary>
public class StepContext
{
    /// <summary>
    /// The original step title/description.
    /// </summary>
    public string Title { get; }

    /// <summary>
    /// The display title with placeholders replaced.
    /// </summary>
    public string DisplayTitle { get; }

    /// <summary>
    /// The step keyword type (Given, When, Then, And, But).
    /// </summary>
    public string Type { get; }

    /// <summary>
    /// Extracted values from quoted strings in the description.
    /// Access by index: Values[0].AsInt()
    /// </summary>
    public LiveDocValueArray Values { get; }

    /// <summary>
    /// Raw string values before conversion.
    /// </summary>
    public string[] ValuesRaw { get; }

    /// <summary>
    /// Extracted named parameters from &lt;name:value&gt; patterns.
    /// Access by name: Params["name"].AsString()
    /// </summary>
    public LiveDocValueDictionary Params { get; }

    /// <summary>
    /// Raw parameter values before conversion.
    /// </summary>
    public IReadOnlyDictionary<string, string> ParamsRaw { get; }

    /// <summary>
    /// Creates a new step context.
    /// </summary>
    public StepContext(
        string title,
        string displayTitle,
        string type,
        string[] valuesRaw,
        Dictionary<string, string> paramsRaw)
    {
        Title = title;
        DisplayTitle = displayTitle;
        Type = type;
        ValuesRaw = valuesRaw;
        ParamsRaw = paramsRaw;

        // Create wrapped values
        Values = new LiveDocValueArray(
            ValueParser.CreateValueArray(valuesRaw, title),
            title);
        Params = new LiveDocValueDictionary(paramsRaw, title);
    }
}

/// <summary>
/// A wrapper around LiveDocValue[] that provides bounds-checked access with helpful error messages.
/// </summary>
public class LiveDocValueArray
{
    private readonly LiveDocValue[] _values;
    private readonly string _stepTitle;

    /// <summary>
    /// Creates a new value array.
    /// </summary>
    public LiveDocValueArray(LiveDocValue[] values, string stepTitle)
    {
        _values = values;
        _stepTitle = stepTitle;
    }

    /// <summary>
    /// Gets the value at the specified index.
    /// </summary>
    /// <param name="index">The zero-based index.</param>
    /// <returns>The LiveDocValue at the index.</returns>
    /// <exception cref="LiveDocValueIndexException">Thrown when index is out of range.</exception>
    public LiveDocValue this[int index]
    {
        get
        {
            if (index < 0 || index >= _values.Length)
            {
                throw new LiveDocValueIndexException(index, _values.Length, _stepTitle);
            }
            return _values[index];
        }
    }

    /// <summary>
    /// Gets the number of values.
    /// </summary>
    public int Length => _values.Length;

    /// <summary>
    /// Gets the number of values.
    /// </summary>
    public int Count => _values.Length;

    /// <summary>
    /// Converts to a typed tuple of 2 values.
    /// </summary>
    public (T1, T2) As<T1, T2>() => _values.As<T1, T2>();

    /// <summary>
    /// Converts to a typed tuple of 3 values.
    /// </summary>
    public (T1, T2, T3) As<T1, T2, T3>() => _values.As<T1, T2, T3>();

    /// <summary>
    /// Converts to a typed tuple of 4 values.
    /// </summary>
    public (T1, T2, T3, T4) As<T1, T2, T3, T4>() => _values.As<T1, T2, T3, T4>();

    /// <summary>
    /// Converts to a typed tuple of 5 values.
    /// </summary>
    public (T1, T2, T3, T4, T5) As<T1, T2, T3, T4, T5>() => _values.As<T1, T2, T3, T4, T5>();

    /// <summary>
    /// Converts to a typed tuple of 6 values.
    /// </summary>
    public (T1, T2, T3, T4, T5, T6) As<T1, T2, T3, T4, T5, T6>() => _values.As<T1, T2, T3, T4, T5, T6>();

    /// <summary>
    /// Allows tuple deconstruction of 2 values.
    /// </summary>
    public void Deconstruct(out LiveDocValue v1, out LiveDocValue v2)
        => _values.Deconstruct(out v1, out v2);

    /// <summary>
    /// Allows tuple deconstruction of 3 values.
    /// </summary>
    public void Deconstruct(out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3)
        => _values.Deconstruct(out v1, out v2, out v3);

    /// <summary>
    /// Allows tuple deconstruction of 4 values.
    /// </summary>
    public void Deconstruct(out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3, out LiveDocValue v4)
        => _values.Deconstruct(out v1, out v2, out v3, out v4);

    /// <summary>
    /// Allows tuple deconstruction of 5 values.
    /// </summary>
    public void Deconstruct(out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3, out LiveDocValue v4, out LiveDocValue v5)
        => _values.Deconstruct(out v1, out v2, out v3, out v4, out v5);

    /// <summary>
    /// Allows tuple deconstruction of 6 values.
    /// </summary>
    public void Deconstruct(out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3, out LiveDocValue v4, out LiveDocValue v5, out LiveDocValue v6)
        => _values.Deconstruct(out v1, out v2, out v3, out v4, out v5, out v6);

    /// <summary>
    /// Gets the underlying array.
    /// </summary>
    public LiveDocValue[] ToArray() => _values.ToArray();
}
