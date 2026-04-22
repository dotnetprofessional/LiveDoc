namespace SweDevTools.LiveDoc.xUnit.Core;

/// <summary>
/// Extension methods for LiveDocValue arrays, including tuple deconstruction.
/// </summary>
public static class LiveDocValueExtensions
{
    #region Basic Deconstruction (returns LiveDocValue, need .AsX() calls)

    /// <summary>
    /// Deconstructs an array of 2 values.
    /// </summary>
    public static void Deconstruct(this LiveDocValue[] values, out LiveDocValue v1, out LiveDocValue v2)
    {
        ValidateLength(values, 2);
        v1 = values[0];
        v2 = values[1];
    }

    /// <summary>
    /// Deconstructs an array of 3 values.
    /// </summary>
    public static void Deconstruct(this LiveDocValue[] values, out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3)
    {
        ValidateLength(values, 3);
        v1 = values[0];
        v2 = values[1];
        v3 = values[2];
    }

    /// <summary>
    /// Deconstructs an array of 4 values.
    /// </summary>
    public static void Deconstruct(this LiveDocValue[] values, out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3, out LiveDocValue v4)
    {
        ValidateLength(values, 4);
        v1 = values[0];
        v2 = values[1];
        v3 = values[2];
        v4 = values[3];
    }

    /// <summary>
    /// Deconstructs an array of 5 values.
    /// </summary>
    public static void Deconstruct(this LiveDocValue[] values, out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3, out LiveDocValue v4, out LiveDocValue v5)
    {
        ValidateLength(values, 5);
        v1 = values[0];
        v2 = values[1];
        v3 = values[2];
        v4 = values[3];
        v5 = values[4];
    }

    /// <summary>
    /// Deconstructs an array of 6 values.
    /// </summary>
    public static void Deconstruct(this LiveDocValue[] values, out LiveDocValue v1, out LiveDocValue v2, out LiveDocValue v3, out LiveDocValue v4, out LiveDocValue v5, out LiveDocValue v6)
    {
        ValidateLength(values, 6);
        v1 = values[0];
        v2 = values[1];
        v3 = values[2];
        v4 = values[3];
        v5 = values[4];
        v6 = values[5];
    }

    #endregion

    #region Typed Deconstruction (returns typed values directly)

    /// <summary>
    /// Converts an array to a typed tuple of 2 values.
    /// </summary>
    public static (T1, T2) As<T1, T2>(this LiveDocValue[] values)
    {
        ValidateLength(values, 2);
        return (values[0].As<T1>(), values[1].As<T2>());
    }

    /// <summary>
    /// Converts an array to a typed tuple of 3 values.
    /// </summary>
    public static (T1, T2, T3) As<T1, T2, T3>(this LiveDocValue[] values)
    {
        ValidateLength(values, 3);
        return (values[0].As<T1>(), values[1].As<T2>(), values[2].As<T3>());
    }

    /// <summary>
    /// Converts an array to a typed tuple of 4 values.
    /// </summary>
    public static (T1, T2, T3, T4) As<T1, T2, T3, T4>(this LiveDocValue[] values)
    {
        ValidateLength(values, 4);
        return (values[0].As<T1>(), values[1].As<T2>(), values[2].As<T3>(), values[3].As<T4>());
    }

    /// <summary>
    /// Converts an array to a typed tuple of 5 values.
    /// </summary>
    public static (T1, T2, T3, T4, T5) As<T1, T2, T3, T4, T5>(this LiveDocValue[] values)
    {
        ValidateLength(values, 5);
        return (values[0].As<T1>(), values[1].As<T2>(), values[2].As<T3>(), values[3].As<T4>(), values[4].As<T5>());
    }

    /// <summary>
    /// Converts an array to a typed tuple of 6 values.
    /// </summary>
    public static (T1, T2, T3, T4, T5, T6) As<T1, T2, T3, T4, T5, T6>(this LiveDocValue[] values)
    {
        ValidateLength(values, 6);
        return (values[0].As<T1>(), values[1].As<T2>(), values[2].As<T3>(), values[3].As<T4>(), values[4].As<T5>(), values[5].As<T6>());
    }

    #endregion

    private static void ValidateLength(LiveDocValue[] values, int required)
    {
        if (values.Length < required)
        {
            throw new InvalidOperationException(
                $"Expected at least {required} values but got {values.Length}. " +
                "Ensure your step description contains enough quoted values.");
        }
    }
}
