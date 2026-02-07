using System.Reflection;
using System.Text.RegularExpressions;
using LiveDoc.xUnit.Formatters;
using LiveDoc.xUnit.Reporter;
using LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Core;

/// <summary>
/// Context that manages step execution and provides access to test metadata.
/// Passed to step callbacks for value extraction.
/// </summary>
public class LiveDocContext : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly Type _testClassType;
    private readonly MethodInfo? _testMethod;
    private readonly object[]? _testMethodArgs;
    private readonly LiveDocFormatter _formatter;
    private readonly LiveDocTestRunReporter? _runReporter;
    
    private readonly List<StepExecution> _steps = new();
    private readonly System.Diagnostics.Stopwatch _scenarioStopwatch;
    private string _currentStepType = "Given";
    private ExampleData? _currentExample;
    private StepContext? _currentStep;
    private string? _testCaseId;
    private string? _scenarioId;
    private int _stepIndex;
    private static readonly Dictionary<string, int> _exampleCounters = new();
    private static readonly object _counterLock = new();
    
    private readonly bool _isSpecification;

    /// <summary>
    /// The current feature context (for BDD/Gherkin tests).
    /// </summary>
    public FeatureContext Feature { get; }
    
    /// <summary>
    /// The current specification context (for MSpec-style tests).
    /// </summary>
    public SpecificationContext Specification { get; }
    
    /// <summary>
    /// The current test case context (either Feature or Specification).
    /// </summary>
    public TestCaseContext TestCase => _isSpecification ? Specification : Feature;
    
    /// <summary>
    /// The current scenario context.
    /// </summary>
    public ScenarioContext Scenario { get; }
    
    /// <summary>
    /// The current rule context (for specification tests).
    /// </summary>
    public RuleContext Rule { get; }
    
    /// <summary>
    /// Dynamic access to example data (for scenario outlines).
    /// </summary>
    public dynamic? Example => _currentExample?.AsDynamic();
    
    /// <summary>
    /// The current step context with extracted values and parameters.
    /// </summary>
    public StepContext? Step => _currentStep;

    internal LiveDocContext(
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
        _scenarioStopwatch = System.Diagnostics.Stopwatch.StartNew();

        // Initialize reporter if enabled
        _runReporter = LiveDocTestRunReporter.Instance.IsEnabled 
            ? LiveDocTestRunReporter.Instance 
            : null;

        // Determine test case type
        var specAttr = _testClassType.GetCustomAttribute<SpecificationAttribute>();
        _isSpecification = specAttr != null;

        // Initialize context based on type
        if (_isSpecification)
        {
            Specification = InitializeSpecificationContext(specAttr!);
            Feature = new FeatureContext(); // Empty placeholder
            Rule = InitializeRuleContext();
            Scenario = new ScenarioContext(); // Empty placeholder
        }
        else
        {
            Feature = InitializeFeatureContext();
            Specification = new SpecificationContext(); // Empty placeholder
            Scenario = InitializeScenarioContext();
            Rule = new RuleContext(); // Empty placeholder
        }

        // Initialize example data if this is an outline test
        if (testMethod != null && testMethodArgs != null)
        {
            _currentExample = new ExampleData(testMethod, testMethodArgs);
        }

        // Generate IDs for reporting
        _testCaseId = LiveDocTestRunReporter.GenerateTestCaseId(testClassType);
        _scenarioId = testMethod != null 
            ? LiveDocTestRunReporter.GenerateScenarioId(testClassType, testMethod.Name, testMethodArgs)
            : null;

        // Report test case and scenario start (fire and forget - don't block tests)
        ReportStartAsync().ConfigureAwait(false);

        // Output feature and scenario headers
        OutputHeader();
    }

    private async Task ReportStartAsync()
    {
        if (_runReporter == null || _testCaseId == null)
            return;

        try
        {
            var style = _isSpecification ? TestStyles.Specification : TestStyles.Feature;

            await _runReporter.ReportTestCaseAsync(
                _testCaseId,
                style,
                TestCase.Title,
                TestCase.Description,
                TestCase.Tags);

            if (_scenarioId != null)
            {
                // For specifications, report rule; for features, report scenario
                var testName = _isSpecification ? Rule.Name : Scenario.Name;
                var testDesc = _isSpecification ? Rule.Description : Scenario.Description;
                var testTags = _isSpecification ? Rule.Tags : Scenario.Tags;
                
                await _runReporter.ReportScenarioStartAsync(
                    _testCaseId,
                    _scenarioId,
                    testName,
                    testDesc,
                    testTags);
            }
        }
        catch
        {
            // Silently ignore reporting errors - don't affect test execution
        }
    }

    private FeatureContext InitializeFeatureContext()
    {
        var featureAttr = _testClassType.GetCustomAttribute<FeatureAttribute>();
        
        var title = featureAttr?.GetDisplayName(_testClassType) ?? 
                   FeatureAttribute.FormatName(_testClassType.Name);
        
        return new FeatureContext
        {
            Title = title,
            Description = featureAttr?.Description,
            Tags = TagAttribute.GetTags(_testClassType)
        };
    }

    private SpecificationContext InitializeSpecificationContext(SpecificationAttribute specAttr)
    {
        return new SpecificationContext
        {
            Title = specAttr.GetDisplayName(_testClassType),
            Description = specAttr.Description,
            Tags = TagAttribute.GetTags(_testClassType)
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
            Tags = TagAttribute.GetTags(_testClassType, _testMethod)
        };
    }

    private RuleContext InitializeRuleContext()
    {
        if (_testMethod == null)
            return new RuleContext { Name = "Unknown" };

        var ruleAttr = _testMethod.GetCustomAttribute<RuleAttribute>();
        var ruleOutlineAttr = _testMethod.GetCustomAttribute<RuleOutlineAttribute>();

        string name;
        if (ruleOutlineAttr != null)
        {
            // DisplayName is the single source of truth — it contains either the
            // user-provided description or formatted method name, prefixed with "Rule Outline: ".
            // Strip the prefix since FormatRule() adds its own "Rule:" prefix.
            var displayName = ruleOutlineAttr.DisplayName ?? FeatureAttribute.FormatName(_testMethod.Name);
            name = displayName.StartsWith("Rule Outline: ", StringComparison.OrdinalIgnoreCase)
                ? displayName.Substring("Rule Outline: ".Length)
                : displayName;
        }
        else if (ruleAttr != null)
        {
            // DisplayName is the single source of truth — it contains either the
            // user-provided description or formatted method name, prefixed with "Rule: ".
            var displayName = ruleAttr.DisplayName ?? FeatureAttribute.FormatName(_testMethod.Name);
            name = displayName.StartsWith("Rule: ", StringComparison.OrdinalIgnoreCase)
                ? displayName.Substring("Rule: ".Length)
                : displayName;
        }
        else
        {
            name = FeatureAttribute.FormatName(_testMethod.Name);
        }

        return new RuleContext
        {
            Name = name,
            Description = ruleAttr?.Description ?? ruleOutlineAttr?.Description,
            Tags = TagAttribute.GetTags(_testClassType, _testMethod)
        };
    }

    private void OutputHeader()
    {
        _output.WriteLine("");
        
        // Output header based on test type
        if (_isSpecification)
        {
            _output.WriteLine(_formatter.FormatSpecification(Specification.Title));
            if (!string.IsNullOrWhiteSpace(Specification.Description))
            {
                _output.WriteLine(_formatter.FormatDescription(Specification.Description));
            }
        }
        else
        {
            _output.WriteLine(_formatter.FormatFeature(Feature.Title));
            if (!string.IsNullOrWhiteSpace(Feature.Description))
            {
                _output.WriteLine(_formatter.FormatDescription(Feature.Description));
            }
        }
        
        _output.WriteLine("");

        // Output test (scenario/rule) header based on type
        if (_isSpecification)
        {
            // Check if this is a rule outline
            var isRuleOutline = _testMethod?.GetCustomAttribute<RuleOutlineAttribute>() != null;
            
            if (isRuleOutline && _testMethodArgs != null && _testMethodArgs.Length > 0)
            {
                // Resolve placeholders in rule name with actual values
                var ruleName = ResolveParameterPlaceholders(Rule.Name);
                _output.WriteLine(_formatter.FormatRule(ruleName));
                
                var exampleNumber = GetExampleNumber();
                _output.WriteLine("");
                _output.WriteLine(_formatter.FormatExampleHeader(exampleNumber));
                
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
            else
            {
                _output.WriteLine(_formatter.FormatRule(Rule.Name));
            }
        }
        else
        {
            // Check if this is a scenario outline
            var isOutline = _testMethod?.GetCustomAttribute<ScenarioOutlineAttribute>() != null;
            
            if (isOutline)
            {
                var scenarioName = Scenario.Name.Replace("Scenario Outline:", "Scenario:");
                _output.WriteLine(_formatter.FormatScenario(scenarioName));
                
                if (_testMethodArgs != null && _testMethodArgs.Length > 0)
                {
                    var exampleNumber = GetExampleNumber();
                    _output.WriteLine("");
                    _output.WriteLine(_formatter.FormatExampleHeader(exampleNumber));
                    
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

    /// <summary>
    /// Replaces &lt;paramName&gt; placeholders and ALLCAPS method name placeholders
    /// with actual parameter values.
    /// </summary>
    private string ResolveParameterPlaceholders(string name)
    {
        if (_testMethod == null || _testMethodArgs == null || _testMethodArgs.Length == 0)
            return name;

        var parameters = _testMethod.GetParameters();
        var result = name;

        for (int i = 0; i < Math.Min(parameters.Length, _testMethodArgs.Length); i++)
        {
            var paramName = parameters[i].Name;
            var paramValue = _testMethodArgs[i]?.ToString() ?? "";
            
            // Replace <paramName> with the actual value (case-insensitive)
            result = Regex.Replace(
                result,
                $@"<{Regex.Escape(paramName!)}>",
                paramValue,
                RegexOptions.IgnoreCase);
            
            // Replace ALLCAPS version of param name (method name placeholder convention)
            var upperParam = paramName!.ToUpperInvariant();
            result = Regex.Replace(
                result,
                $@"\b{Regex.Escape(upperParam)}\b",
                paramValue);
        }

        return result;
    }

    public void ExecuteStep(string type, string description, Action step)
    {
        // Create step context with extracted values
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
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
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution).ConfigureAwait(false);

            // Re-throw to let xUnit handle the failure
            throw;
        }
        finally
        {
            _currentStep = null;
        }
    }

    /// <summary>
    /// Executes a step with context access for value extraction.
    /// </summary>
    public void ExecuteStep(string type, string description, Action<LiveDocContext> step)
    {
        // Create step context with extracted values
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
            StartTime = DateTime.UtcNow
        };

        try
        {
            if (type != "and" && type != "but")
                _currentStepType = type;

            // Execute with context
            step(this);

            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution).ConfigureAwait(false);
            
            throw;
        }
        finally
        {
            _currentStep = null;
        }
    }

    public async Task ExecuteStepAsync(string type, string description, Func<Task> step)
    {
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
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
            
            // Report step result
            await ReportStepAsync(currentStepIndex, type, displayTitle, execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            _steps.Add(execution);
            
            // Report step result
            await ReportStepAsync(currentStepIndex, type, displayTitle, execution);
            
            throw;
        }
        finally
        {
            _currentStep = null;
        }
    }

    /// <summary>
    /// Executes an async step with context access for value extraction.
    /// </summary>
    public async Task ExecuteStepAsync(string type, string description, Func<LiveDocContext, Task> step)
    {
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
            StartTime = DateTime.UtcNow
        };

        try
        {
            if (type != "and" && type != "but")
                _currentStepType = type;

            await step(this);

            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            _steps.Add(execution);
            
            // Report step result
            await ReportStepAsync(currentStepIndex, type, displayTitle, execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            _steps.Add(execution);
            
            // Report step result
            await ReportStepAsync(currentStepIndex, type, displayTitle, execution);
            
            throw;
        }
        finally
        {
            _currentStep = null;
        }
    }

    private async Task ReportStepAsync(int stepIndex, string type, string title, StepExecution execution)
    {
        if (_runReporter == null || _testCaseId == null || _scenarioId == null)
            return;

        try
        {
            var stepId = LiveDocTestRunReporter.GenerateStepId(_scenarioId, type, stepIndex);
            
            ErrorInfo? error = null;
            if (execution.Exception != null)
            {
                error = new ErrorInfo
                {
                    Message = execution.Exception.Message,
                    Stack = execution.Exception.StackTrace
                };
            }

            await _runReporter.ReportStepAsync(
                _testCaseId,
                _scenarioId,
                stepId,
                type.ToStepKeyword(),
                title,
                execution.Status.ToReporterStatus(),
                (long)execution.Duration.TotalMilliseconds,
                error);
        }
        catch
        {
            // Silently ignore reporting errors
        }
    }

    private StepContext CreateStepContext(string type, string originalDescription, string displayTitle)
    {
        var valuesRaw = ValueParser.ExtractQuotedValues(originalDescription);
        var paramsRaw = ValueParser.ExtractNamedParams(originalDescription);
        
        return new StepContext(
            title: originalDescription,
            displayTitle: displayTitle,
            type: type,
            valuesRaw: valuesRaw,
            paramsRaw: paramsRaw);
    }

    private string ProcessDescription(string description)
    {
        // First, replace named params <name:value> with just the value
        var processed = ValueParser.ReplaceNamedParams(description);
        
        // Then replace outline placeholders <name> with example values
        processed = ReplacePlaceholders(processed);
        
        return processed;
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
        
        // Report scenario completion (fire and forget)
        ReportScenarioCompleteAsync(failed > 0).ConfigureAwait(false);
    }

    private async Task ReportScenarioCompleteAsync(bool hasFailed)
    {
        if (_runReporter == null || _scenarioId == null)
            return;

        try
        {
            _scenarioStopwatch.Stop();
            
            var failedStep = _steps.FirstOrDefault(s => s.Status == StepStatus.Failed);
            ErrorInfo? error = null;
            if (failedStep?.Exception != null)
            {
                error = new ErrorInfo
                {
                    Message = failedStep.Exception.Message,
                    Stack = failedStep.Exception.StackTrace
                };
            }

            await _runReporter.ReportScenarioCompleteAsync(
                _scenarioId,
                hasFailed ? Reporter.Models.Status.Failed : Reporter.Models.Status.Passed,
                _scenarioStopwatch.ElapsedMilliseconds,
                error);
        }
        catch
        {
            // Silently ignore reporting errors
        }
    }
}
