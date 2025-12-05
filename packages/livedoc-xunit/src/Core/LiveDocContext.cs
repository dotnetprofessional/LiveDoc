using System.Reflection;
using System.Text.RegularExpressions;
using LiveDoc.xUnit.Formatters;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Core;

/// <summary>
/// Internal context that manages step execution and formatting.
/// Handles the actual execution, timing, and output of test steps.
/// </summary>
internal class LiveDocContext : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly Type _testClassType;
    private readonly MethodInfo? _testMethod;
    private readonly object[]? _testMethodArgs;
    private readonly LiveDocFormatter _formatter;
    
    private readonly List<StepExecution> _steps = new();
    private string _currentStepType = "Given";
    private ExampleData? _currentExample;
    private static readonly Dictionary<string, int> _exampleCounters = new();
    private static readonly object _counterLock = new();

    public FeatureContext Feature { get; }
    public ScenarioContext Scenario { get; }
    public dynamic? Example => _currentExample?.AsDynamic();

    public LiveDocContext(
        ITestOutputHelper output, 
        Type testClassType, 
        MethodInfo? testMethod = null,
        object[]? testMethodArgs = null)
    {
        _output = output;
        _testClassType = testClassType;
        _testMethod = testMethod;
        _testMethodArgs = testMethodArgs;
        _formatter = new LiveDocFormatter();

        // Initialize feature context
        Feature = InitializeFeatureContext();
        
        // Initialize scenario context
        Scenario = InitializeScenarioContext();

        // Initialize example data if this is a scenario outline
        if (testMethod != null && testMethodArgs != null)
        {
            _currentExample = new ExampleData(testMethod, testMethodArgs);
        }

        // Output feature and scenario headers
        OutputHeader();
    }

    private FeatureContext InitializeFeatureContext()
    {
        var featureAttr = _testClassType.GetCustomAttribute<FeatureAttribute>();
        
        var name = featureAttr?.GetDisplayName(_testClassType) ?? 
                   FeatureAttribute.FormatName(_testClassType.Name);
        
        return new FeatureContext
        {
            Name = name,
            Description = featureAttr?.Description,
            Tags = featureAttr?.Tags ?? Array.Empty<string>()
        };
    }

    private ScenarioContext InitializeScenarioContext()
    {
        if (_testMethod == null)
            return new ScenarioContext { Name = "Unknown" };

        var scenarioAttr = _testMethod.GetCustomAttribute<ScenarioAttribute>();
        var outlineAttr = _testMethod.GetCustomAttribute<ScenarioOutlineAttribute>();

        var name = scenarioAttr?.DisplayName ?? 
                   outlineAttr?.DisplayName ?? 
                   FeatureAttribute.FormatName(_testMethod.Name);

        return new ScenarioContext
        {
            Name = name,
            Description = scenarioAttr?.Description ?? outlineAttr?.Description,
            Tags = scenarioAttr?.Tags ?? outlineAttr?.Tags ?? Array.Empty<string>()
        };
    }

    private void OutputHeader()
    {
        _output.WriteLine("");
        _output.WriteLine(_formatter.FormatFeature(Feature.Name));
        _output.WriteLine("");

        // Check if this is a scenario outline
        var isOutline = _testMethod?.GetCustomAttribute<ScenarioOutlineAttribute>() != null;
        
        if (isOutline)
        {
            // For scenario outlines, show "Scenario:" in the output (not "Scenario Outline:")
            // because at execution time, it's a specific scenario instance, not an outline
            // Strip "Outline" from the name if present
            var scenarioName = Scenario.Name.Replace("Scenario Outline:", "Scenario:");
            _output.WriteLine(_formatter.FormatScenario(scenarioName));
            
            // Output example header with cleaner format
            if (_testMethodArgs != null && _testMethodArgs.Length > 0)
            {
                // Try to find the example number by getting all Example attributes
                var exampleNumber = GetExampleNumber();
                _output.WriteLine("");
                _output.WriteLine(_formatter.FormatExampleHeader(exampleNumber));
                
                // Show the parameter values in a nice format
                if (_currentExample != null && _testMethod != null)
                {
                    var parameters = _testMethod.GetParameters();
                    var paramLines = new List<string>();
                    for (int i = 0; i < Math.Min(parameters.Length, _testMethodArgs.Length); i++)
                    {
                        var paramName = parameters[i].Name;
                        var paramValue = _testMethodArgs[i];
                        paramLines.Add($"{paramName}: {paramValue}");
                    }
                    
                    if (paramLines.Count > 0)
                    {
                        _output.WriteLine(_formatter.FormatExampleValues(paramLines));
                    }
                }
            }
        }
        else
        {
            _output.WriteLine(_formatter.FormatScenario(Scenario.Name));
        }
        
        _output.WriteLine("");
    }
    private int GetExampleNumber()
    {
        if (_testMethod == null) return 1;
        
        // Use a counter based on the test method name to track example numbers
        var key = $"{_testMethod.DeclaringType?.FullName}.{_testMethod.Name}";
        
        lock (_counterLock)
        {
            if (!_exampleCounters.ContainsKey(key))
            {
                _exampleCounters[key] = 0;
            }
            
            _exampleCounters[key]++;
            return _exampleCounters[key];
        }
    }

    public void ExecuteStep(string type, string description, Action step)
    {
        var execution = new StepExecution
        {
            Type = type,
            Description = ReplacePlaceholders(description),
            StartTime = DateTime.UtcNow
        };

        try
        {
            // Track current step type for And/But indentation
            if (type != "and" && type != "but")
                _currentStepType = type;

            // Execute the actual step (this preserves debugging!)
            step();

            // Record success
            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            _steps.Add(execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            _steps.Add(execution);

            // Re-throw to let xUnit handle the failure
            throw;
        }
    }

    public async Task ExecuteStepAsync(string type, string description, Func<Task> step)
    {
        var execution = new StepExecution
        {
            Type = type,
            Description = ReplacePlaceholders(description),
            StartTime = DateTime.UtcNow
        };

        try
        {
            if (type != "and" && type != "but")
                _currentStepType = type;

            await step();

            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            _steps.Add(execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            _steps.Add(execution);
            throw;
        }
    }

    private string ReplacePlaceholders(string description)
    {
        if (_currentExample == null)
            return description;

        // Replace <PropertyName> with actual values from Example
        return Regex.Replace(description, @"<([^>]+)>", match =>
        {
            var propName = match.Groups[1].Value.Replace(" ", "");
            var value = _currentExample[propName];
            return value?.ToString() ?? match.Value;
        });
    }

    public void Dispose()
    {
        // Output step results with pass/fail indicators
        _output.WriteLine("");
        
        foreach (var step in _steps)
        {
            var isPassed = step.Status == StepStatus.Passed;
            _output.WriteLine(_formatter.FormatStepWithStatus(step.Type, step.Description, isPassed));
            
            // If step failed, show error details
            if (!isPassed && step.Exception != null)
            {
                var errorMsg = step.Exception.Message;
                var stackTrace = step.Exception.StackTrace;
                _output.WriteLine(_formatter.FormatStepError(errorMsg, stackTrace));
            }
        }
        
        // Output summary
        _output.WriteLine("");
        
        var passed = _steps.Count(s => s.Status == StepStatus.Passed);
        var failed = _steps.Count(s => s.Status == StepStatus.Failed);
        var totalMs = _steps.Sum(s => s.Duration.TotalMilliseconds);

        if (passed > 0)
        {
            _output.WriteLine(_formatter.FormatPassingSummary(passed, totalMs));
        }

        if (failed > 0)
        {
            _output.WriteLine(_formatter.FormatFailingSummary(failed));
        }

        _output.WriteLine("");
    }
}
