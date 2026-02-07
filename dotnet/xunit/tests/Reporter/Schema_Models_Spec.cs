using System.Text.Json;
using LiveDoc.xUnit;
using LiveDoc.xUnit.Reporter;
using LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Reporter;

/// <summary>
/// Specification: Schema Models
/// 
/// Tests for the C# schema models that map to the v3 protocol.
/// Verifies correct JSON serialization.
/// </summary>
[Specification]
public class Schema_Models_Spec : SpecificationTest
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public Schema_Models_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Status Enum

    [RuleOutline("Status '<status>' serializes to '<expected>'")]
    [Example(Status.Pending, "pending")]
    [Example(Status.Running, "running")]
    [Example(Status.Passed, "passed")]
    [Example(Status.Failed, "failed")]
    [Example(Status.Skipped, "skipped")]
    public void Status_serialization(Status status, string expected)
    {
        var json = JsonSerializer.Serialize(status, _jsonOptions);
        Assert.Equal($"\"{expected}\"", json);
    }

    #endregion

    #region StepKeyword Enum

    [RuleOutline("StepKeyword '<keyword>' serializes to '<expected>'")]
    [Example(StepKeyword.Given, "given")]
    [Example(StepKeyword.When, "when")]
    [Example(StepKeyword.Then, "then")]
    [Example(StepKeyword.And, "and")]
    [Example(StepKeyword.But, "but")]
    public void StepKeyword_serialization(StepKeyword keyword, string expected)
    {
        var json = JsonSerializer.Serialize(keyword, _jsonOptions);
        Assert.Equal($"\"{expected}\"", json);
    }

    #endregion

    #region ExecutionResult

    [Rule("ExecutionResult serializes correctly")]
    public void ExecutionResult_serializes_correctly()
    {
        var result = new ExecutionResult
        {
            Status = Status.Passed,
            Duration = 123
        };

        var json = JsonSerializer.Serialize(result, _jsonOptions);
        
        Assert.Contains("\"status\":\"passed\"", json);
        Assert.Contains("\"duration\":123", json);
    }

    [Rule("ExecutionResult with error serializes correctly")]
    public void ExecutionResult_with_error_serializes()
    {
        var result = new ExecutionResult
        {
            Status = Status.Failed,
            Duration = 50,
            Error = new ErrorInfo
            {
                Message = "Test failed",
                Stack = "at Test.Method()"
            }
        };

        var json = JsonSerializer.Serialize(result, _jsonOptions);
        
        Assert.Contains("\"status\":\"failed\"", json);
        Assert.Contains("\"message\":\"Test failed\"", json);
        Assert.Contains("\"stack\":\"at Test.Method()\"", json);
    }

    [Rule("ExecutionResult with rowId for outlines")]
    public void ExecutionResult_with_rowId()
    {
        var result = new ExecutionResult
        {
            RowId = 5,
            Status = Status.Passed,
            Duration = 10
        };

        var json = JsonSerializer.Serialize(result, _jsonOptions);
        
        Assert.Contains("\"rowId\":5", json);
    }

    #endregion

    #region Statistics

    [Rule("Statistics serializes all fields")]
    public void Statistics_serializes_all_fields()
    {
        var stats = new Statistics
        {
            Total = 100,
            Passed = 80,
            Failed = 10,
            Pending = 5,
            Skipped = 5
        };

        var json = JsonSerializer.Serialize(stats, _jsonOptions);
        
        Assert.Contains("\"total\":100", json);
        Assert.Contains("\"passed\":80", json);
        Assert.Contains("\"failed\":10", json);
        Assert.Contains("\"pending\":5", json);
        Assert.Contains("\"skipped\":5", json);
    }

    #endregion

    #region StepTest

    [Rule("StepTest has correct kind")]
    public void StepTest_has_correct_kind()
    {
        var step = new StepTest
        {
            Id = "step-1",
            Title = "the user is logged in",
            Keyword = StepKeyword.Given
        };

        var json = JsonSerializer.Serialize(step, _jsonOptions);
        
        Assert.Contains("\"kind\":\"Step\"", json);
        Assert.Contains("\"keyword\":\"given\"", json);
    }

    #endregion

    #region ScenarioTest

    [Rule("ScenarioTest has correct kind")]
    public void ScenarioTest_has_correct_kind()
    {
        var scenario = new ScenarioTest
        {
            Id = "scenario-1",
            Title = "User logs in",
            Steps = new List<StepTest>()
        };

        var json = JsonSerializer.Serialize(scenario, _jsonOptions);
        
        Assert.Contains("\"kind\":\"Scenario\"", json);
    }

    #endregion

    #region TestCase

    [Rule("TestCase with Feature style")]
    public void TestCase_with_feature_style()
    {
        var testCase = new TestCase
        {
            Id = "feature-1",
            Style = TestStyles.Feature,
            Title = "User Authentication",
            Tests = new List<BaseTest>()
        };

        var json = JsonSerializer.Serialize(testCase, _jsonOptions);
        
        Assert.Contains("\"style\":\"Feature\"", json);
        Assert.Contains("\"title\":\"User Authentication\"", json);
    }

    [Rule("TestCase with Specification style")]
    public void TestCase_with_specification_style()
    {
        var testCase = new TestCase
        {
            Id = "spec-1",
            Style = TestStyles.Specification,
            Title = "Calculator Operations"
        };

        var json = JsonSerializer.Serialize(testCase, _jsonOptions);
        
        Assert.Contains("\"style\":\"Specification\"", json);
    }

    #endregion

    #region TestRunV3

    [Rule("TestRunV3 has protocol version 3.0")]
    public void TestRunV3_has_protocol_version()
    {
        var run = new TestRunV3
        {
            RunId = "run-123",
            Project = "TestProject",
            Environment = "local",
            Framework = "xunit"
        };

        var json = JsonSerializer.Serialize(run, _jsonOptions);
        
        Assert.Contains("\"protocolVersion\":\"3.0\"", json);
        Assert.Contains("\"framework\":\"xunit\"", json);
    }

    #endregion

    #region TypedValue

    [Rule("TypedValue.From creates correct type for string")]
    public void TypedValue_from_string()
    {
        var typed = TypedValue.From("hello");
        
        Assert.Equal("hello", typed.Value);
        Assert.Equal("string", typed.Type);
    }

    [Rule("TypedValue.From creates correct type for int")]
    public void TypedValue_from_int()
    {
        var typed = TypedValue.From(42);
        
        Assert.Equal(42, typed.Value);
        Assert.Equal("number", typed.Type);
    }

    [Rule("TypedValue.From creates correct type for bool")]
    public void TypedValue_from_bool()
    {
        var typed = TypedValue.From(true);
        
        Assert.Equal(true, typed.Value);
        Assert.Equal("boolean", typed.Type);
    }

    [Rule("TypedValue.From handles null")]
    public void TypedValue_from_null()
    {
        var typed = TypedValue.From(null);
        
        Assert.Null(typed.Value);
        Assert.Equal("null", typed.Type);
    }

    #endregion
}
