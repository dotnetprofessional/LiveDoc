using System.Text.Json;
using System.Text.Json.Serialization;

namespace SweDevTools.LiveDoc.xUnit.Reporter.Models;

// =============================================================================
// Value Objects
// =============================================================================

/// <summary>
/// Execution status for a test or step.
/// </summary>
[JsonConverter(typeof(LowercaseEnumConverter<Status>))]
public enum Status
{
    Pending,
    Running,
    Passed,
    Failed,
    Skipped,
    TimedOut,
    Cancelled
}

/// <summary>
/// Step keyword in BDD/Gherkin scenarios.
/// </summary>
[JsonConverter(typeof(LowercaseEnumConverter<StepKeyword>))]
public enum StepKeyword
{
    Given,
    When,
    Then,
    And,
    But
}

/// <summary>
/// JSON converter that serializes enums as lowercase strings.
/// </summary>
internal class LowercaseEnumConverter<T> : JsonConverter<T> where T : struct, Enum
{
    public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        if (Enum.TryParse<T>(value, ignoreCase: true, out var result))
        {
            return result;
        }
        throw new JsonException($"Unable to convert '{value}' to {typeof(T).Name}");
    }

    public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value.ToString().ToLowerInvariant());
    }
}

/// <summary>
/// A typed value with optional display format.
/// </summary>
public class TypedValue
{
    [JsonPropertyName("value")]
    public object? Value { get; set; }

    [JsonPropertyName("type")]
    public string Type { get; set; } = "string";

    [JsonPropertyName("displayFormat")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DisplayFormat { get; set; }

    public static TypedValue From(object? value)
    {
        if (value is null)
            return new TypedValue { Value = null, Type = "null" };

        var type = value switch
        {
            string => "string",
            bool => "boolean",
            int or long or short or byte or uint or ulong or ushort or sbyte => "number",
            float or double or decimal => "number",
            DateTime or DateTimeOffset => "date",
            _ => "object"
        };

        var displayValue = value switch
        {
            DateTime dt => dt.ToString("O"),
            DateTimeOffset dto => dto.ToString("O"),
            _ => value
        };

        return new TypedValue { Value = displayValue, Type = type };
    }
}

/// <summary>
/// A row of values in an example table.
/// </summary>
public class Row
{
    [JsonPropertyName("rowId")]
    public int RowId { get; set; }

    [JsonPropertyName("values")]
    public List<TypedValue> Values { get; set; } = new();
}

/// <summary>
/// A data table with headers and rows.
/// </summary>
public class DataTable
{
    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; set; }

    [JsonPropertyName("headers")]
    public List<string> Headers { get; set; } = new();

    [JsonPropertyName("rows")]
    public List<Row> Rows { get; set; } = new();
}

/// <summary>
/// Error information for failed tests.
/// </summary>
public class ErrorInfo
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("stack")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Stack { get; set; }

    [JsonPropertyName("code")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Code { get; set; }

    [JsonPropertyName("lineNumber")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? LineNumber { get; set; }
}

/// <summary>
/// Execution result for a test or step.
/// </summary>
public class ExecutionResult
{
    [JsonPropertyName("rowId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? RowId { get; set; }

    [JsonPropertyName("status")]
    public Status Status { get; set; } = Status.Pending;

    [JsonPropertyName("duration")]
    public long Duration { get; set; }

    [JsonPropertyName("error")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ErrorInfo? Error { get; set; }
}

/// <summary>
/// Statistics for a test case or run.
/// </summary>
public class Statistics
{
    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("passed")]
    public int Passed { get; set; }

    [JsonPropertyName("failed")]
    public int Failed { get; set; }

    [JsonPropertyName("pending")]
    public int Pending { get; set; }

    [JsonPropertyName("skipped")]
    public int Skipped { get; set; }
}

// =============================================================================
// Test Types
// =============================================================================

/// <summary>
/// Base test information shared by all test types.
/// </summary>
[JsonDerivedType(typeof(ScenarioTest))]
[JsonDerivedType(typeof(ScenarioOutlineTest))]
[JsonDerivedType(typeof(RuleTest))]
[JsonDerivedType(typeof(RuleOutlineTest))]
[JsonDerivedType(typeof(StepTest))]
public class BaseTest
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("kind")]
    public string Kind { get; set; } = "Test";

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; set; }

    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Tags { get; set; }

    [JsonPropertyName("dataTables")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<DataTable>? DataTables { get; set; }

    [JsonPropertyName("execution")]
    public ExecutionResult Execution { get; set; } = new();
}

/// <summary>
/// A step in a scenario.
/// </summary>
public class StepTest : BaseTest
{
    public StepTest()
    {
        Kind = "Step";
    }

    [JsonPropertyName("keyword")]
    public StepKeyword Keyword { get; set; }
}

/// <summary>
/// A scenario with steps.
/// </summary>
public class ScenarioTest : BaseTest
{
    public ScenarioTest()
    {
        Kind = "Scenario";
    }

    [JsonPropertyName("steps")]
    public List<StepTest> Steps { get; set; } = new();
}

/// <summary>
/// A rule in a specification.
/// </summary>
public class RuleTest : BaseTest
{
    public RuleTest()
    {
        Kind = "Rule";
    }
}

/// <summary>
/// Result for a specific example row execution.
/// </summary>
public class ExampleResult
{
    [JsonPropertyName("testId")]
    public string TestId { get; set; } = string.Empty;

    [JsonPropertyName("result")]
    public ExecutionResult Result { get; set; } = new();
}

/// <summary>
/// A scenario outline with example tables.
/// </summary>
public class ScenarioOutlineTest : BaseTest
{
    public ScenarioOutlineTest()
    {
        Kind = "ScenarioOutline";
    }

    [JsonPropertyName("steps")]
    public List<StepTest> Steps { get; set; } = new();

    [JsonPropertyName("examples")]
    public List<DataTable> Examples { get; set; } = new();

    [JsonPropertyName("exampleResults")]
    public List<ExampleResult> ExampleResults { get; set; } = new();

    [JsonPropertyName("statistics")]
    public Statistics Statistics { get; set; } = new();
}

/// <summary>
/// A rule outline with example tables.
/// </summary>
public class RuleOutlineTest : BaseTest
{
    public RuleOutlineTest()
    {
        Kind = "RuleOutline";
    }

    [JsonPropertyName("examples")]
    public List<DataTable> Examples { get; set; } = new();

    [JsonPropertyName("exampleResults")]
    public List<ExampleResult> ExampleResults { get; set; } = new();

    [JsonPropertyName("statistics")]
    public Statistics Statistics { get; set; } = new();
}

// =============================================================================
// Test Case (Document)
// =============================================================================

/// <summary>
/// Style of test case (Feature, Specification, Container).
/// </summary>
public static class TestStyles
{
    public const string Feature = "Feature";
    public const string Specification = "Specification";
    public const string Container = "Container";
    public const string Standard = "Standard";
}

/// <summary>
/// A test case (document) containing tests.
/// </summary>
public class TestCase
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("style")]
    public string Style { get; set; } = TestStyles.Feature;

    [JsonPropertyName("path")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Path { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; set; }

    [JsonPropertyName("tags")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Tags { get; set; }

    [JsonPropertyName("tests")]
    public List<BaseTest> Tests { get; set; } = new();

    [JsonPropertyName("background")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public BaseTest? Background { get; set; }

    [JsonPropertyName("statistics")]
    public Statistics Statistics { get; set; } = new();
}

// =============================================================================
// Test Run
// =============================================================================

/// <summary>
/// A complete test run containing all documents.
/// </summary>
public class TestRunV3
{
    [JsonPropertyName("protocolVersion")]
    public string ProtocolVersion { get; set; } = "3.0";

    [JsonPropertyName("runId")]
    public string RunId { get; set; } = string.Empty;

    [JsonPropertyName("project")]
    public string Project { get; set; } = string.Empty;

    [JsonPropertyName("environment")]
    public string Environment { get; set; } = string.Empty;

    [JsonPropertyName("framework")]
    public string Framework { get; set; } = "xunit";

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("O");

    [JsonPropertyName("duration")]
    public long Duration { get; set; }

    [JsonPropertyName("status")]
    public Status Status { get; set; } = Status.Pending;

    [JsonPropertyName("summary")]
    public Statistics Summary { get; set; } = new();

    [JsonPropertyName("documents")]
    public List<TestCase> Documents { get; set; } = new();
}

// =============================================================================
// API Request/Response Models
// =============================================================================

/// <summary>
/// Request to start a new test run.
/// </summary>
public class StartRunRequest
{
    [JsonPropertyName("project")]
    public string Project { get; set; } = string.Empty;

    [JsonPropertyName("environment")]
    public string Environment { get; set; } = string.Empty;

    [JsonPropertyName("framework")]
    public string Framework { get; set; } = "xunit";

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("O");
}

/// <summary>
/// Response from starting a test run.
/// </summary>
public class StartRunResponse
{
    [JsonPropertyName("protocolVersion")]
    public string ProtocolVersion { get; set; } = "3.0";

    [JsonPropertyName("runId")]
    public string RunId { get; set; } = string.Empty;

    [JsonPropertyName("websocketUrl")]
    public string? WebsocketUrl { get; set; }
}

/// <summary>
/// Request to upsert a test case.
/// </summary>
public class UpsertTestCaseRequest
{
    [JsonPropertyName("testCase")]
    public TestCase TestCase { get; set; } = new();
}

/// <summary>
/// Request to upsert a test under a test case.
/// </summary>
public class UpsertTestRequest
{
    [JsonPropertyName("testCaseId")]
    public string TestCaseId { get; set; } = string.Empty;

    [JsonPropertyName("test")]
    public BaseTest Test { get; set; } = new();
}

/// <summary>
/// Request to patch execution result.
/// </summary>
public class PatchExecutionRequest
{
    [JsonPropertyName("status")]
    public Status Status { get; set; }

    [JsonPropertyName("duration")]
    public long Duration { get; set; }

    [JsonPropertyName("error")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ErrorInfo? Error { get; set; }
}

/// <summary>
/// Request to upsert example results for an outline.
/// </summary>
public class UpsertExampleResultsRequest
{
    [JsonPropertyName("results")]
    public List<ExampleResult> Results { get; set; } = new();
}

/// <summary>
/// Request to complete a test run.
/// </summary>
public class CompleteRunRequest
{
    [JsonPropertyName("status")]
    public Status Status { get; set; }

    [JsonPropertyName("duration")]
    public long Duration { get; set; }

    [JsonPropertyName("summary")]
    public Statistics Summary { get; set; } = new();
}
