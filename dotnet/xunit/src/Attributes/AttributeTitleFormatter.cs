namespace SweDevTools.LiveDoc.xUnit;

internal static class AttributeTitleFormatter
{
    public static string? FormatExplicitName(string? value, string? argumentExpression)
    {
        return IsNameof(argumentExpression) && value != null
            ? FeatureAttribute.FormatName(value)
            : value;
    }

    public static string FormatMemberName(
        string value,
        string? argumentExpression)
    {
        return string.IsNullOrWhiteSpace(argumentExpression) ||
               IsNameof(argumentExpression)
            ? FeatureAttribute.FormatName(value)
            : value;
    }

    public static bool IsNameof(string? argumentExpression)
    {
        return argumentExpression?.TrimStart().StartsWith(
            "nameof(",
            StringComparison.Ordinal) == true;
    }
}
