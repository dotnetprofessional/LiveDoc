using System.Globalization;

namespace SweDevTools.LiveDoc.xUnit.Core;

/// <summary>
/// Wrapper for extracted values that provides fluent type conversion.
/// All conversions use CultureInfo.InvariantCulture for consistent behavior.
/// </summary>
public class LiveDocValue
{
    private readonly object? _raw;
    private readonly string _stepTitle;
    private readonly int? _index;
    private readonly string? _paramName;

    /// <summary>
    /// Creates a LiveDocValue from a raw value.
    /// </summary>
    /// <param name="raw">The raw value (typically a string from parsing).</param>
    /// <param name="stepTitle">The step title for error context.</param>
    /// <param name="index">The index in the Values array (for error messages).</param>
    /// <param name="paramName">The parameter name if from Params (for error messages).</param>
    public LiveDocValue(object? raw, string stepTitle, int? index = null, string? paramName = null)
    {
        _raw = raw;
        _stepTitle = stepTitle;
        _index = index;
        _paramName = paramName;
    }

    /// <summary>
    /// Gets the raw value without conversion.
    /// </summary>
    public object? Raw => _raw;

    /// <summary>
    /// Converts the value to a string.
    /// </summary>
    public string AsString() => _raw?.ToString() ?? "";

    /// <summary>
    /// Converts the value to an integer.
    /// </summary>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public int AsInt()
    {
        try
        {
            return Convert.ToInt32(_raw, CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            throw CreateConversionException("Int32", ex);
        }
    }

    /// <summary>
    /// Converts the value to a long.
    /// </summary>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public long AsLong()
    {
        try
        {
            return Convert.ToInt64(_raw, CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            throw CreateConversionException("Int64", ex);
        }
    }

    /// <summary>
    /// Converts the value to a decimal.
    /// </summary>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public decimal AsDecimal()
    {
        try
        {
            return Convert.ToDecimal(_raw, CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            throw CreateConversionException("Decimal", ex);
        }
    }

    /// <summary>
    /// Converts the value to a double.
    /// </summary>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public double AsDouble()
    {
        try
        {
            return Convert.ToDouble(_raw, CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            throw CreateConversionException("Double", ex);
        }
    }

    /// <summary>
    /// Converts the value to a boolean.
    /// </summary>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public bool AsBool()
    {
        try
        {
            return Convert.ToBoolean(_raw, CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            throw CreateConversionException("Boolean", ex);
        }
    }

    /// <summary>
    /// Converts the value to a DateTime.
    /// </summary>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public DateTime AsDateTime()
    {
        try
        {
            return Convert.ToDateTime(_raw, CultureInfo.InvariantCulture);
        }
        catch (Exception ex)
        {
            throw CreateConversionException("DateTime", ex);
        }
    }

    /// <summary>
    /// Converts the value to the specified type.
    /// Supports enums, arrays (JSON format), and any type that implements IConvertible.
    /// </summary>
    /// <typeparam name="T">The target type.</typeparam>
    /// <exception cref="LiveDocConversionException">Thrown when conversion fails.</exception>
    public T As<T>()
    {
        try
        {
            var targetType = typeof(T);

            // Handle nullable types
            var underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;

            // Handle null
            if (_raw == null)
            {
                if (targetType.IsValueType && Nullable.GetUnderlyingType(targetType) == null)
                {
                    throw new InvalidCastException($"Cannot convert null to non-nullable type {targetType.Name}");
                }
                return default!;
            }

            // Handle enums
            if (underlyingType.IsEnum)
            {
                return (T)Enum.Parse(underlyingType, _raw.ToString()!, ignoreCase: true);
            }

            // Handle arrays (JSON format)
            if (underlyingType.IsArray)
            {
                return ParseArray<T>();
            }

            // Handle Guid
            if (underlyingType == typeof(Guid))
            {
                return (T)(object)Guid.Parse(_raw.ToString()!);
            }

            // Standard conversion
            return (T)Convert.ChangeType(_raw, underlyingType, CultureInfo.InvariantCulture);
        }
        catch (LiveDocConversionException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw CreateConversionException(typeof(T).Name, ex);
        }
    }

    private T ParseArray<T>()
    {
        var rawString = _raw?.ToString() ?? "";
        var elementType = typeof(T).GetElementType()!;

        // Simple JSON-like array parsing: [1, 2, 3] or ["a", "b", "c"]
        if (!rawString.StartsWith("[") || !rawString.EndsWith("]"))
        {
            throw new FormatException($"Array must be in format [value1, value2, ...], got: {rawString}");
        }

        var content = rawString.Substring(1, rawString.Length - 2);
        if (string.IsNullOrWhiteSpace(content))
        {
            return (T)(object)Array.CreateInstance(elementType, 0);
        }

        var elements = ParseArrayElements(content);
        var array = Array.CreateInstance(elementType, elements.Length);

        for (int i = 0; i < elements.Length; i++)
        {
            var element = elements[i].Trim();
            
            // Remove quotes from string elements
            if (element.StartsWith("\"") && element.EndsWith("\""))
            {
                element = element.Substring(1, element.Length - 2);
            }

            var converted = Convert.ChangeType(element, elementType, CultureInfo.InvariantCulture);
            array.SetValue(converted, i);
        }

        return (T)(object)array;
    }

    private static string[] ParseArrayElements(string content)
    {
        var elements = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;
        var depth = 0;

        foreach (var c in content)
        {
            if (c == '"' && depth == 0)
            {
                inQuotes = !inQuotes;
                current.Append(c);
            }
            else if (c == '[')
            {
                depth++;
                current.Append(c);
            }
            else if (c == ']')
            {
                depth--;
                current.Append(c);
            }
            else if (c == ',' && !inQuotes && depth == 0)
            {
                elements.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        if (current.Length > 0)
        {
            elements.Add(current.ToString());
        }

        return elements.ToArray();
    }

    private LiveDocConversionException CreateConversionException(string targetType, Exception innerException)
    {
        var valueDesc = _raw == null ? "null" : $"'{_raw}'";
        var location = _paramName != null 
            ? $"parameter '{_paramName}'" 
            : _index.HasValue 
                ? $"index {_index}" 
                : "value";

        return new LiveDocConversionException(
            $"Cannot convert {valueDesc} to {targetType} at {location}",
            _stepTitle,
            innerException);
    }

    /// <summary>
    /// Returns the string representation of the value.
    /// </summary>
    public override string ToString() => AsString();
}
