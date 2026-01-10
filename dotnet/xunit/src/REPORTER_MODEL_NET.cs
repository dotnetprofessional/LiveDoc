using System.Text.Json.Serialization;

namespace LiveDoc.Models
{
    // =============================================================================
    // Value Objects
    // =============================================================================

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

    public enum StepKeyword
    {
        Given,
        When,
        Then,
        And,
        But
    }

    public class TypedValue
    {

        /// <summary>
        /// The actual value, which can be of various types such as string, number, boolean, date, object, null, or undefined.
        /// </summary>
        public object Value { get; set; }
        public string Type { get; set; } // 'string' | 'number' | 'boolean' | 'date' | 'object' | 'null' | 'undefined'
        public string DisplayFormat { get; set; }
    }

    public class Row
    {
        public int RowId { get; set; }
        public List<TypedValue> Values { get; set; } = new List<TypedValue>();
    }

    public class DataTable
    {
        public string Name { get; set; }
        public List<string> Headers { get; set; } = new List<string>();
        public List<Row> Rows { get; set; } = new List<Row>();
    }



    public class Attachment
    {
        public string Id { get; set; }
        public string Kind { get; set; } // 'image' | 'screenshot' | 'file'
        public string Title { get; set; }
        public string MimeType { get; set; }
        public string Uri { get; set; }
        public string Base64 { get; set; }
    }

    public class ExecutionResult
    {
        /// <summary>
        /// For outline tests, its the RowId of the example row this result corresponds to.
        /// For non-outline tests, it can 0.
        /// </summary>
        public int RowId { get; set; }
        public Status Status { get; set; }
        public long Duration { get; set; }
        public ErrorInfo Error { get; set; }
        public List<Attachment> Attachments { get; set; } = new List<Attachment>();
    }



    public class ErrorInfo
    {
        /// <summary>
        /// The error message describing what went wrong.
        /// </summary>
        public string Message { get; set; }

        /// <summary>
        /// The stack trace at the point the error was thrown.
        /// </summary>
        public string Stack { get; set; }

        /// <summary>
        /// The code that was executing when the error occurred.
        /// </summary>
        public string Code { get; set; }

        /// <summary>
        /// The line number in the code where the error occurred.
        /// </summary>
        public int lineNumber { get; set; }
    }

    public class RuleViolation
    {
        public string Rule { get; set; }
        public string Message { get; set; }
        public string Title { get; set; }
        public int? ErrorId { get; set; }
    }

    public class Statistics
    {
        public int Total { get; set; }
        public int Passed { get; set; }
        public int Failed { get; set; }
        public int Pending { get; set; }
        public int Skipped { get; set; }
    }

    // =============================================================================
    // Core Nodes
    // =============================================================================

    /// <summary>
    /// Test cases represent the code that performs testing activities.
    /// We need to record the results, but we dont need to record data 
    /// extractions used by the code itself, unless we need to present it
    /// differently, than its raw form. For example, tables and tags.
    /// </summary>
    public abstract class TestCase
    {
        public string Id { get; set; }

        /// <summary>
        /// <see cref="TestStyles"/> value"/>
        /// </summary>
        public string Style { get; set; }
        public string Path { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public List<string> Tags { get; set; } = new List<string>();

        [JsonIgnore]
        public ExecutionAggregateResult Execution { get; set; } = new ExecutionAggregateResult();
        public List<RuleViolation> RuleViolations { get; set; } = new List<RuleViolation>();

        /// <summary>
        /// Ideally this would be a generic, however C# doesn't support multiple types ie List<T1 | T2 | T3>
        /// </summary>
        public List<Test> Tests { get; set; } = new List<Test>();

        public Statistics Statistics { get; set; } = new Statistics();

    }

    /// <summary>
    /// Represents the aggregate result of an execution, including status, duration, and error information.
    /// The values are calcualted from the individual test results contained within the test case.
    /// </summary>
    public class ExecutionAggregateResult
    {
        public Status Status { get; }
        public long Duration { get; }
        public bool HasError { get; }
    }
    public class FeatureTestCase : TestCase
    {
        public FeatureTestCase()
        {
            this.Style = TestStyles.Feature;
        }

        /// <summary>
        /// Features can have Backgrounds, which are similar to Tests
        /// </summary>
        public Test Background { get; set; }
    }

    public class SpecificationTestCase : TestCase
    {
        public SpecificationTestCase()
        {
            this.Style = TestStyles.Specification;
        }
    }

    public class ContainerTestCase : TestCase
    {
        public ContainerTestCase()
        {
            this.Style = TestStyles.Container;
        }
    }


    public static class TestStyles
    {
        public const string Feature = "Feature";
        public const string Specification = "Specification";
        public const string Container = "Container";
    }

    public static class TestKinds
    {
        public const string Scenario = "Scenario";
        public const string ScenarioOutline = "ScenarioOutline";
        public const string Step = "Step";
        public const string Rule = "Rule";
        public const string RuleOutline = "RuleOutline";
        public const string Test = "Test";
    }



    public abstract class Test
    {
        /// <summary>
        ///  A unique identifier for the test that is stable across runs. It uses a hash of the
        ///  test's fully qualified name and its location in the source code.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// <see cref="TestKinds"/> value"/>
        /// </summary>
        public string Kind { get; set; }

        /// <summary>
        /// The raw title of the test before any binding substitutions
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// The raw description of the test before any binding substitutions
        /// minus anything represented by another field (e.g., DataTable)
        /// DocStrings are extracted for test execution but for reporting purposes
        /// they are left in the description so they can be viewed in context.
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// Gets or sets the list of tags associated with the Test.
        /// </summary>
        public List<string> Tags { get; set; } = new List<string>();

        /// <summary>
        /// Each Test can have multiple DataTables associated with it.
        /// </summary>
        public List<DataTable> DataTables { get; set; } = new List<DataTable>();

        /// <summary>
        /// The execution result summary for the test.
        /// </summary>
        public ExecutionResult ExecutionResults { get; set; } = new ExecutionResult();

        /// <summary>
        /// A list of rule violations associated with the test.
        /// </summary>
        public List<RuleViolation> RuleViolations { get; set; } = new List<RuleViolation>();
    }

    public class ScenarioTest : Test
    {
        public ScenarioTest()
        {
            this.Kind = TestKinds.Scenario;
        }

        public List<StepTest> Steps { get; set; } = new List<StepTest>();
    }

    public class StepTest : Test
    {
        public StepTest()
        {
            this.Kind = TestKinds.Step;
        }

        public StepKeyword Keyword { get; set; }
    }

    public class RuleTest : Test
    {
        public RuleTest()
        {
            this.Kind = TestKinds.Rule;
        }
    }

    public class RuleOutlineTest : RuleTest
    {
        public RuleOutlineTest()
        {
            this.Kind = TestKinds.RuleOutline;
        }

        public List<DataTable> Examples { get; set; } = new List<DataTable>();

        /// <summary>
        /// The execution results for each example instance.
        /// </summary>
        public List<ExampleResult> ExampleResults { get; set; } = new List<ExampleResult>();

        public Statistics Statistics { get; set; } = new Statistics();

    }

    public class StandardTest : Test
    {
        public StandardTest()
        {
            this.Kind = TestKinds.Test;
        }
    }

    public class ScenarioOutlineTest : ScenarioTest
    {
        public ScenarioOutlineTest()
        {
            this.Kind = TestKinds.ScenarioOutline;
        }

        /// <summary>
        /// The list of data examples associated with the outline.
        /// </summary>
        public List<DataTable> Examples { get; set; } = new List<DataTable>();

        /// <summary>
        /// The execution results for each example instance.
        /// </summary>
        public List<ExampleResult> ExampleResults { get; set; } = new List<ExampleResult>();

        public Statistics Statistics { get; set; }
    }

    public class ExampleResult
    {
        /// <summary>
        /// The step template nodes test Id this result corresponds to.
        /// </summary>
        public string TestId { get; set; }

        /// <summary>
        /// The execution result for this example.
        /// </summary>
        public ExecutionResult Result { get; set; } = new ExecutionResult();
    }

    // =============================================================================
    // Root Envelope
    // =============================================================================

    public class TestRun
    {
        public string ProtocolVersion { get; set; } = "2.0";
        public string RunId { get; set; }
        public string Project { get; set; }
        public string Environment { get; set; }
        public string Framework { get; set; } // 'vitest' | 'xunit' | 'mocha' | 'jest'
        public string Timestamp { get; set; } // ISO 8601
        public long Duration { get; set; } // milliseconds
        public Status Status { get; set; }
        public Statistics Summary { get; set; } = new Statistics();
        public List<TestCase> TestCases { get; set; } = new List<TestCase>(); // Feature | Specification | TestSuite
    }
}
