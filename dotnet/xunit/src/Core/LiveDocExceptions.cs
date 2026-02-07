namespace LiveDoc.xUnit.Core;

/// <summary>
/// Exception thrown when a LiveDocValue conversion fails.
/// Includes step context for better error messages.
/// </summary>
public class LiveDocConversionException : Exception
{
    /// <summary>
    /// The step title where the conversion failed.
    /// </summary>
    public string StepTitle { get; }

    /// <summary>
    /// Creates a new conversion exception.
    /// </summary>
    /// <param name="message">The error message.</param>
    /// <param name="stepTitle">The step title for context.</param>
    /// <param name="innerException">The underlying exception.</param>
    public LiveDocConversionException(string message, string stepTitle, Exception? innerException = null)
        : base(FormatMessage(message, stepTitle), innerException)
    {
        StepTitle = stepTitle;
    }

    private static string FormatMessage(string message, string stepTitle)
    {
        return $"{message}\n  in step: \"{stepTitle}\"";
    }
}

/// <summary>
/// Exception thrown when accessing a value at an invalid index.
/// </summary>
public class LiveDocValueIndexException : Exception
{
    /// <summary>
    /// The step title where the error occurred.
    /// </summary>
    public string StepTitle { get; }

    /// <summary>
    /// The index that was requested.
    /// </summary>
    public int RequestedIndex { get; }

    /// <summary>
    /// The number of values available.
    /// </summary>
    public int AvailableCount { get; }

    /// <summary>
    /// Creates a new index exception.
    /// </summary>
    /// <param name="requestedIndex">The index that was requested.</param>
    /// <param name="availableCount">The number of values available.</param>
    /// <param name="stepTitle">The step title for context.</param>
    public LiveDocValueIndexException(int requestedIndex, int availableCount, string stepTitle)
        : base(FormatMessage(requestedIndex, availableCount, stepTitle))
    {
        RequestedIndex = requestedIndex;
        AvailableCount = availableCount;
        StepTitle = stepTitle;
    }

    private static string FormatMessage(int requestedIndex, int availableCount, string stepTitle)
    {
        return $"Index {requestedIndex} out of range ({availableCount} values available)\n  in step: \"{stepTitle}\"";
    }
}

/// <summary>
/// Exception thrown when accessing a named parameter that doesn't exist.
/// </summary>
public class LiveDocParamNotFoundException : Exception
{
    /// <summary>
    /// The step title where the error occurred.
    /// </summary>
    public string StepTitle { get; }

    /// <summary>
    /// The parameter name that was requested.
    /// </summary>
    public string ParamName { get; }

    /// <summary>
    /// The available parameter names.
    /// </summary>
    public string[] AvailableParams { get; }

    /// <summary>
    /// Creates a new parameter not found exception.
    /// </summary>
    /// <param name="paramName">The parameter name that was requested.</param>
    /// <param name="availableParams">The available parameter names.</param>
    /// <param name="stepTitle">The step title for context.</param>
    public LiveDocParamNotFoundException(string paramName, string[] availableParams, string stepTitle)
        : base(FormatMessage(paramName, availableParams, stepTitle))
    {
        ParamName = paramName;
        AvailableParams = availableParams;
        StepTitle = stepTitle;
    }

    private static string FormatMessage(string paramName, string[] availableParams, string stepTitle)
    {
        var available = availableParams.Length > 0 
            ? string.Join(", ", availableParams) 
            : "(none)";
        return $"Parameter '{paramName}' not found. Available: {available}\n  in step: \"{stepTitle}\"";
    }
}
