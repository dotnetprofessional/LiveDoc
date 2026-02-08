using LiveDoc.xUnit;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// Specification: RuleOutline with Complex Types
/// </summary>
[Specification(Description = @"
    [RuleOutline] supports complex types such as enums in [Example] data.
    Values are passed as strongly-typed method parameters by xUnit.")]
public class Rule_Outline_Complex_Types_Spec : SpecificationTest
{
    public Rule_Outline_Complex_Types_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [RuleOutline("Day '<day>' is a weekday: '<isWeekday>'")]
    [Example(DayOfWeek.Monday, true)]
    [Example(DayOfWeek.Tuesday, true)]
    [Example(DayOfWeek.Wednesday, true)]
    [Example(DayOfWeek.Thursday, true)]
    [Example(DayOfWeek.Friday, true)]
    [Example(DayOfWeek.Saturday, false)]
    [Example(DayOfWeek.Sunday, false)]
    public void Weekday_detection(DayOfWeek day, bool isWeekday)
    {
        var actual = day != DayOfWeek.Saturday && day != DayOfWeek.Sunday;
        Assert.Equal(isWeekday, actual);
    }
}
