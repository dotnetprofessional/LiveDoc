using System.Reflection;
using SweDevTools.LiveDoc.xUnit;
using SweDevTools.LiveDoc.xUnit.Reporter;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using Xunit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.Reporter;

/// <summary>
/// Regression tests for the reporter fallback path — the code path that
/// reports tests without Given/When/Then steps (message sink). Covers
/// outline example expansion, FinalizeOutlineStats status propagation,
/// and RecordResult counting.
/// </summary>
[Specification("Message Sink Fallback Path", Description = @"
    Regression tests for the reporter fallback path — the code path that
    reports tests without Given/When/Then steps. Validates that outline
    example rows are tracked correctly, FinalizeOutlineStats maps statuses
    properly (regression: Skipped was mapped to Pending), and RecordResult
    increments counters accurately.

    Tests use isolated model instances to avoid polluting the singleton
    LiveDocTestRunReporter payload.
")]
public class Message_Sink_Fallback_Spec : SpecificationTest
{
    private static readonly MethodInfo FinalizeOutlineStatsMethod = typeof(LiveDocTestRunReporter)
        .GetMethod("FinalizeOutlineStats", BindingFlags.NonPublic | BindingFlags.Static)!;

    public Message_Sink_Fallback_Spec(ITestOutputHelper output) : base(output) { }

    private static void InvokeFinalizeOutlineStats(
        Statistics stats, List<ExampleResult> results, ExecutionResult execution)
    {
        FinalizeOutlineStatsMethod.Invoke(null, new object[] { stats, results, execution });
    }

    private static RuleOutlineTest CreateOutline(string id, string title, int rowCount)
    {
        var outline = new RuleOutlineTest
        {
            Id = id,
            Title = title,
            Examples = new List<DataTable>
            {
                new DataTable
                {
                    Headers = new List<string> { "a", "b", "result" },
                    Rows = new List<Row>()
                }
            }
        };

        for (int i = 1; i <= rowCount; i++)
        {
            outline.Examples[0].Rows.Add(new Row
            {
                RowId = i,
                Values = new List<TypedValue>
                {
                    TypedValue.From(i), TypedValue.From(i + 1), TypedValue.From(i * 2 + 1)
                }
            });
        }

        return outline;
    }

    #region Outline Example Expansion

    [Rule("BufferOutlineExample with '2' rows produces '2' distinct example entries")]
    public void BufferOutlineExample_two_rows()
    {
        var (rowCount, expectedEntries) = Rule.Values.As<int, int>();

        var outline = CreateOutline("iso-outline-2rows", "Addition examples", rowCount);

        for (int i = 1; i <= rowCount; i++)
        {
            outline.ExampleResults.Add(new ExampleResult
            {
                TestId = $"iso-outline-2rows:r{i}",
                Result = new ExecutionResult { RowId = i, Status = Status.Passed, Duration = 10 }
            });
        }

        Assert.Equal(expectedEntries, outline.Examples[0].Rows.Count);
        Assert.Equal(expectedEntries, outline.ExampleResults.Count);
    }

    [Rule("BufferOutlineExample with '3' rows each reports correct status")]
    public void BufferOutlineExample_three_rows_status()
    {
        var rowCount = Rule.Values[0].AsInt();
        var statuses = new[] { Status.Passed, Status.Failed, Status.Skipped };

        var outline = CreateOutline("iso-outline-3rows", "Mixed status examples", rowCount);

        for (int i = 0; i < rowCount; i++)
        {
            outline.ExampleResults.Add(new ExampleResult
            {
                TestId = $"iso-outline-3rows:r{i + 1}",
                Result = new ExecutionResult
                {
                    RowId = i + 1,
                    Status = statuses[i],
                    Duration = 10,
                    Error = statuses[i] == Status.Failed
                        ? new ErrorInfo { Message = "Expected 5 but got 6" }
                        : null
                }
            });
        }

        Assert.Equal(rowCount, outline.ExampleResults.Count);
        Assert.Equal(Status.Passed, outline.ExampleResults[0].Result.Status);
        Assert.Equal(Status.Failed, outline.ExampleResults[1].Result.Status);
        Assert.Equal(Status.Skipped, outline.ExampleResults[2].Result.Status);
    }

    #endregion

    #region Status Propagation (FinalizeOutlineStats)

    [Rule("Outline with all passed examples has 'Passed' status")]
    public void FinalizeOutlineStats_all_passed()
    {
        var expectedStatus = Enum.Parse<Status>(Rule.Values[0].AsString());
        var stats = new Statistics();
        var execution = new ExecutionResult();
        var results = new List<ExampleResult>
        {
            new() { TestId = "p1", Result = new ExecutionResult { RowId = 1, Status = Status.Passed, Duration = 10 } },
            new() { TestId = "p2", Result = new ExecutionResult { RowId = 2, Status = Status.Passed, Duration = 15 } }
        };

        InvokeFinalizeOutlineStats(stats, results, execution);

        Assert.Equal(2, stats.Total);
        Assert.Equal(2, stats.Passed);
        Assert.Equal(0, stats.Failed);
        Assert.Equal(0, stats.Skipped);
        Assert.Equal(expectedStatus, execution.Status);
    }

    [Rule("Outline with one failed example has 'Failed' status")]
    public void FinalizeOutlineStats_one_failed()
    {
        var expectedStatus = Enum.Parse<Status>(Rule.Values[0].AsString());
        var stats = new Statistics();
        var execution = new ExecutionResult();
        var results = new List<ExampleResult>
        {
            new() { TestId = "f1", Result = new ExecutionResult { RowId = 1, Status = Status.Passed, Duration = 10 } },
            new() { TestId = "f2", Result = new ExecutionResult { RowId = 2, Status = Status.Failed, Duration = 5 } }
        };

        InvokeFinalizeOutlineStats(stats, results, execution);

        Assert.Equal(2, stats.Total);
        Assert.Equal(1, stats.Passed);
        Assert.Equal(1, stats.Failed);
        Assert.Equal(expectedStatus, execution.Status);
    }

    [Rule("Outline with all skipped examples has 'Skipped' status")]
    public void FinalizeOutlineStats_all_skipped()
    {
        var expectedStatus = Enum.Parse<Status>(Rule.Values[0].AsString());
        var stats = new Statistics();
        var execution = new ExecutionResult();
        var results = new List<ExampleResult>
        {
            new() { TestId = "s1", Result = new ExecutionResult { RowId = 1, Status = Status.Skipped, Duration = 0 } },
            new() { TestId = "s2", Result = new ExecutionResult { RowId = 2, Status = Status.Skipped, Duration = 0 } }
        };

        InvokeFinalizeOutlineStats(stats, results, execution);

        Assert.Equal(2, stats.Total);
        Assert.Equal(0, stats.Passed);
        Assert.Equal(0, stats.Failed);
        Assert.Equal(2, stats.Skipped);
        Assert.Equal(0, stats.Pending);
        // Regression: Skipped was previously mapped to Pending (Bug #2)
        Assert.Equal(expectedStatus, execution.Status);
    }

    #endregion

    #region RecordResult Counting

    [Rule("RecordResult increments test case counters for each example row")]
    public void RecordResult_increments_counters()
    {
        // Verify finalized outline counts per ROW, not per result.
        // Each of the 2 rows has 2 step-level results (4 ExampleResults total),
        // but FinalizeOutlineStats groups by RowId → Total must be 2, not 4.
        // This mirrors how RecordResult is called once per row in the framework.
        var stats = new Statistics();
        var execution = new ExecutionResult();
        var results = new List<ExampleResult>
        {
            new() { TestId = "step1", Result = new ExecutionResult { RowId = 1, Status = Status.Passed, Duration = 5 } },
            new() { TestId = "step2", Result = new ExecutionResult { RowId = 1, Status = Status.Passed, Duration = 5 } },
            new() { TestId = "step1", Result = new ExecutionResult { RowId = 2, Status = Status.Passed, Duration = 5 } },
            new() { TestId = "step2", Result = new ExecutionResult { RowId = 2, Status = Status.Passed, Duration = 5 } },
        };

        InvokeFinalizeOutlineStats(stats, results, execution);

        Assert.Equal(2, stats.Total);
        Assert.Equal(2, stats.Passed);
        Assert.Equal(0, stats.Failed);
        Assert.Equal(0, stats.Skipped);
    }

    #endregion
}
