namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>Exception thrown by <see cref="JsonAssertions"/> on comparison failure.</summary>
public class JsonAssertionException : Exception
{
    public JsonAssertionException(string message) : base(message) { }
}

/// <summary>Exception thrown by <see cref="JourneyResult.AssertStep(string)"/> on step assertion failure.</summary>
public class JourneyAssertionException : Exception
{
    public JourneyAssertionException(string message) : base(message) { }
}

/// <summary>Exception thrown when a property rule file has invalid syntax.</summary>
public class PropertyRuleParseException : Exception
{
    public PropertyRuleParseException(string message) : base(message) { }
}
