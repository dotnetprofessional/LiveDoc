using System.Reflection;
using System.Text.RegularExpressions;
using SweDevTools.LiveDoc.xUnit.Formatters;
using SweDevTools.LiveDoc.xUnit.Reporter;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Core;

/// <summary>
/// Context that manages step execution and provides access to test metadata.
/// Passed to step callbacks for value extraction.
/// </summary>
public class LiveDocContext : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly Type _testClassType;
    private readonly MethodInfo? _testMethod;
    private readonly object?[]? _testMethodArgs;
    private readonly LiveDocFormatter _formatter;
    private readonly LiveDocTestRunReporter? _runReporter;
    
    private readonly List<StepExecution> _steps = new();
    private readonly System.Diagnostics.Stopwatch _scenarioStopwatch;
    private string _currentStepType = "";
    private bool _hasGiven;
    private bool _hasWhen;
    private bool _hasThen;
    private ExampleData? _currentExample;
    private StepContext? _currentStep;
    private string? _testCaseId;
    private string? _scenarioId;
    private string? _outlineId;
    private int _outlineRowId;
    private int _exampleNumber;
    private bool _isOutline;
    private int _stepIndex;
    private static readonly Dictionary<string, int> _exampleCounters = new();
    private static readonly object _counterLock = new();
    
    private readonly bool _isSpecification;
    private List<Reporter.Models.Attachment>? _currentStepAttachments;

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

    /// <summary>
    /// Adds an attachment to the currently executing step.
    /// </summary>
    internal void AddAttachment(Reporter.Models.Attachment attachment)
    {
        _currentStepAttachments ??= new List<Reporter.Models.Attachment>();
        _currentStepAttachments.Add(attachment);
    }

    internal LiveDocContext(
        ITestOutputHelper output, 
        Type testClassType, 
        MethodInfo? testMethod = null,
        object?[]? testMethodArgs = null,
        int? outlineRowId = null)
    {
        _output = output;
        _testClassType = testClassType;
        _testMethod = testMethod;
        _testMethodArgs = testMethodArgs;
        _formatter = new LiveDocFormatter();
        _scenarioStopwatch = System.Diagnostics.Stopwatch.StartNew();

        _runReporter = LiveDocTestRunReporter.Instance;

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
        
        // Detect outline tests
        var isScenarioOutline = testMethod?.GetCustomAttribute<ScenarioOutlineAttribute>() != null;
        var isRuleOutline = testMethod?.GetCustomAttribute<RuleOutlineAttribute>() != null;
        _isOutline = isScenarioOutline || isRuleOutline;

        if (_isOutline && testMethod != null)
        {
            _outlineId = LiveDocTestRunReporter.GenerateOutlineId(testClassType, testMethod.Name);
            _outlineRowId = outlineRowId ?? GetExampleNumber() - 1;
            _exampleNumber = _outlineRowId + 1;
            _scenarioId = null; // outlines don't use per-row scenario IDs
        }
        else
        {
            _scenarioId = testMethod != null 
                ? LiveDocTestRunReporter.GenerateScenarioId(testClassType, testMethod.Name, testMethodArgs)
                : null;
        }

        // Buffer test case and scenario data for bulk sending at end
        if (_runReporter != null && _testCaseId != null)
        {
            var style = _isSpecification ? TestKinds.Specification : TestKinds.Feature;
            var path = LiveDocTestRunReporter.DerivePath(testClassType);
            _runReporter.BufferTestCase(
                _testCaseId,
                kind: style,
                TestCase.Title,
                TestCase.Description,
                TestCase.Tags,
                path);

            if (_isOutline && _outlineId != null && testMethod != null && testMethodArgs != null)
            {
                var testDesc = _isSpecification ? Rule.Description : Scenario.Description;
                var testTags = _isSpecification ? Rule.Tags : Scenario.Tags;
                var kind = isScenarioOutline ? "ScenarioOutline" : "RuleOutline";

                // For outline titles, use the template form with <placeholders>
                var testName = GetOutlineTemplateTitle(testMethod, _isSpecification);

                _runReporter.BufferOutlineExample(
                    _testCaseId,
                    _outlineId,
                    kind,
                    testName,
                    _outlineRowId,
                    testMethod.GetParameters(),
                    testMethodArgs,
                    testDesc,
                    testTags);
            }
            else if (_scenarioId != null)
            {
                var testName = _isSpecification ? Rule.Name : Scenario.Name;
                var testDesc = _isSpecification ? Rule.Description : Scenario.Description;
                var testTags = _isSpecification ? Rule.Tags : Scenario.Tags;
                var kind = _isSpecification ? "Rule" : "Scenario";

                _runReporter.BufferTest(
                    _testCaseId,
                    _scenarioId,
                    kind,
                    testName,
                    testDesc,
                    testTags);
            }
        }

        // Output feature and scenario headers
        OutputHeader();
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
            Name = StripScenarioPrefix(name),
            Description = scenarioAttr?.Description ?? outlineAttr?.Description,
            Tags = TagAttribute.GetTags(_testClassType, _testMethod)
        };
    }

    private static string StripScenarioPrefix(string name)
    {
        if (name.StartsWith("Scenario Outline: ", StringComparison.OrdinalIgnoreCase))
            return name.Substring("Scenario Outline: ".Length);

        if (name.StartsWith("Scenario: ", StringComparison.OrdinalIgnoreCase))
            return name.Substring("Scenario: ".Length);

        return name;
    }

    private RuleContext InitializeRuleContext()
    {
        if (_testMethod == null)
            return new RuleContext { Name = "Unknown" };

        var ruleAttr = _testMethod.GetCustomAttribute<RuleAttribute>();
        var ruleOutlineAttr = _testMethod.GetCustomAttribute<RuleOutlineAttribute>();
        var parameterValues = OutlineDisplayNameFormatter.GetParameterValues(_testMethod, _testMethodArgs);

        string name;
        if (ruleOutlineAttr != null)
        {
            name = ruleOutlineAttr.GetDisplayName(_testMethod, parameterValues);
        }
        else if (ruleAttr != null)
        {
            name = ruleAttr.GetDisplayName(_testMethod);
        }
        else
        {
            name = FeatureAttribute.FormatName(_testMethod.Name);
        }

        var valuesRaw = ValueParser.ExtractQuotedValues(name);
        var paramsRaw = ValueParser.ExtractNamedParams(name);

        return new RuleContext
        {
            Name = name,
            Description = ruleAttr?.GetDescription(_testMethod) ?? ruleOutlineAttr?.GetDescription(_testMethod),
            Tags = TagAttribute.GetTags(_testClassType, _testMethod),
            ValuesRaw = valuesRaw,
            ParamsRaw = paramsRaw,
            Values = new LiveDocValueArray(
                ValueParser.CreateValueArray(valuesRaw, name), name),
            Params = new LiveDocValueDictionary(paramsRaw, name),
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
                
                _output.WriteLine("");
                _output.WriteLine(_formatter.FormatExampleHeader(_exampleNumber));
                
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
                    _output.WriteLine("");
                    _output.WriteLine(_formatter.FormatExampleHeader(_exampleNumber));
                    
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
            var paramValue = OutlineDisplayNameFormatter.FormatValue(_testMethodArgs[i]);
            
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

    /// <summary>
    /// Gets the template title for an outline test, with placeholders in angle brackets.
    /// For RuleOutline: uses Description attribute (already has &lt;placeholders&gt;) or generates from method name.
    /// For ScenarioOutline: uses explicit title from constructor or generates from method name.
    /// </summary>
    private static string GetOutlineTemplateTitle(MethodInfo testMethod, bool isSpecification)
    {
        var paramNames = testMethod.GetParameters().Select(p => p.Name!).ToArray();

        if (isSpecification)
        {
            var ruleOutlineAttr = testMethod.GetCustomAttribute<RuleOutlineAttribute>();
            // RuleOutline Description or non-default DisplayName is the explicit title template.
            var configuredTemplate = ruleOutlineAttr?.GetTitleTemplate(testMethod);
            if (!string.IsNullOrEmpty(configuredTemplate))
                return configuredTemplate;

            var methodAsTitle = "Rule Outline: " + testMethod.Name.Replace("_", " ");
            if (!string.IsNullOrEmpty(ruleOutlineAttr?.DisplayName) &&
                !string.Equals(ruleOutlineAttr.DisplayName, methodAsTitle, StringComparison.Ordinal))
            {
                var title = ruleOutlineAttr.DisplayName;
                if (title.StartsWith("Rule Outline: ", StringComparison.OrdinalIgnoreCase))
                    title = title.Substring("Rule Outline: ".Length);
                return title;
            }
        }
        else
        {
            var scenarioOutlineAttr = testMethod.GetCustomAttribute<ScenarioOutlineAttribute>();
            if (scenarioOutlineAttr != null)
            {
                // ScenarioOutline title comes from the constructor parameter
                // If DisplayName differs from the method name → user provided an explicit title
                var methodAsTitle = "Scenario Outline: " + testMethod.Name.Replace("_", " ");
                if (scenarioOutlineAttr.DisplayName != null && scenarioOutlineAttr.DisplayName != methodAsTitle)
                {
                    // Strip "Scenario Outline: " prefix — the viewer adds its own formatting
                    var title = scenarioOutlineAttr.DisplayName;
                    if (title.StartsWith("Scenario Outline: ", StringComparison.OrdinalIgnoreCase))
                        title = title.Substring("Scenario Outline: ".Length);
                    return title;
                }
            }
        }

        // No explicit title — generate template from method name with <placeholders>
        return ValueParser.FormatMethodNameAsTemplate(testMethod.Name, paramNames);
    }

    public void ExecuteStep(string type, string description, Action step)
    {
        // Create step context with extracted values
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _currentStepAttachments = null;
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
            OriginalDescription = description,
            TemplateDescription = _isOutline ? ReconstructTemplate(description) : description,
            QuotedParameterCandidates = GetQuotedParameterCandidates(description),
            StartTime = DateTime.UtcNow,
            RuleViolations = TrackStepRuleViolations(type, displayTitle)
        };

        try
        {
            // Execute the actual step (this preserves debugging!)
            step();

            // Record success
            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);

            // Re-throw to let xUnit handle the failure
            throw;
        }
        finally
        {
            _currentStep = null;
            _currentStepAttachments = null;
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
        _currentStepAttachments = null;
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
            OriginalDescription = description,
            TemplateDescription = _isOutline ? ReconstructTemplate(description) : description,
            QuotedParameterCandidates = GetQuotedParameterCandidates(description),
            StartTime = DateTime.UtcNow,
            RuleViolations = TrackStepRuleViolations(type, displayTitle)
        };

        try
        {
            // Execute with context
            step(this);

            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result (fire and forget)
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
            
            throw;
        }
        finally
        {
            _currentStep = null;
            _currentStepAttachments = null;
        }
    }

    public async Task ExecuteStepAsync(string type, string description, Func<Task> step)
    {
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _currentStepAttachments = null;
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
            OriginalDescription = description,
            TemplateDescription = _isOutline ? ReconstructTemplate(description) : description,
            QuotedParameterCandidates = GetQuotedParameterCandidates(description),
            StartTime = DateTime.UtcNow,
            RuleViolations = TrackStepRuleViolations(type, displayTitle)
        };

        try
        {
            await step();

            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
            
            throw;
        }
        finally
        {
            _currentStep = null;
            _currentStepAttachments = null;
        }
    }

    /// <summary>
    /// Executes an async step with context access for value extraction.
    /// </summary>
    public async Task ExecuteStepAsync(string type, string description, Func<LiveDocContext, Task> step)
    {
        var displayTitle = ProcessDescription(description);
        _currentStep = CreateStepContext(type, description, displayTitle);
        _currentStepAttachments = null;
        _stepIndex++;
        var currentStepIndex = _stepIndex;
        
        var execution = new StepExecution
        {
            Type = type,
            Description = displayTitle,
            OriginalDescription = description,
            TemplateDescription = _isOutline ? ReconstructTemplate(description) : description,
            QuotedParameterCandidates = GetQuotedParameterCandidates(description),
            StartTime = DateTime.UtcNow,
            RuleViolations = TrackStepRuleViolations(type, displayTitle)
        };

        try
        {
            await step(this);

            execution.Status = StepStatus.Passed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
        }
        catch (Exception ex)
        {
            execution.Status = StepStatus.Failed;
            execution.Duration = DateTime.UtcNow - execution.StartTime;
            execution.Exception = ex;
            execution.Attachments = _currentStepAttachments;
            _steps.Add(execution);
            
            // Report step result
            ReportStepAsync(currentStepIndex, type, displayTitle, execution);
            
            throw;
        }
        finally
        {
            _currentStep = null;
            _currentStepAttachments = null;
        }
    }

    private void ReportStepAsync(int stepIndex, string type, string title, StepExecution execution)
    {
        // Steps are not individually reported in bulk mode — 
        // final status is captured in scenario completion
    }

    private List<Reporter.Models.RuleViolation>? TrackStepRuleViolations(string type, string title)
    {
        if (_isSpecification)
            return null;

        var normalizedType = type.ToLowerInvariant();
        var violations = new List<Reporter.Models.RuleViolation>();

        if (string.IsNullOrWhiteSpace(title))
        {
            violations.Add(CreateRuleViolation(
                "enforceTitle",
                $"{normalizedType} seems to be missing a title. Titles are important to convey the meaning of the Spec."));
        }

        switch (normalizedType)
        {
            case "given":
                if (_hasGiven)
                    violations.Add(CreateRepeatedStepViolation(normalizedType));
                _hasGiven = true;
                _currentStepType = normalizedType;
                break;

            case "when":
                if (!_hasGiven)
                {
                    violations.Add(CreateRuleViolation(
                        "mustIncludeGiven",
                        "scenario does not have a given."));
                }
                if (_hasWhen)
                    violations.Add(CreateRepeatedStepViolation(normalizedType));
                _hasWhen = true;
                _currentStepType = normalizedType;
                break;

            case "then":
                if (!_hasWhen)
                {
                    violations.Add(CreateRuleViolation(
                        "mustIncludeWhen",
                        "scenario does not have a when, use when to describe the test action."));
                }
                if (_hasThen)
                    violations.Add(CreateRepeatedStepViolation(normalizedType));
                _hasThen = true;
                _currentStepType = normalizedType;
                break;

            case "and":
            case "but":
                if (string.IsNullOrEmpty(_currentStepType))
                {
                    violations.Add(CreateRuleViolation(
                        "andButMustHaveGivenWhenThen",
                        $"{normalizedType} step definition must be preceded by a given, when or then."));
                }
                break;
        }

        return violations.Count > 0 ? violations : null;
    }

    private Reporter.Models.RuleViolation CreateRepeatedStepViolation(string type)
    {
        return CreateRuleViolation(
            "singleGivenWhenThen",
            $"there should be only one {type} in a Scenario or Scenario Outline. Try using and or but instead.");
    }

    private Reporter.Models.RuleViolation CreateRuleViolation(string rule, string message)
    {
        return new Reporter.Models.RuleViolation
        {
            Rule = rule,
            Message = message,
            Title = Scenario.Name
        };
    }

    private List<Reporter.Models.RuleViolation> BuildScenarioRuleViolations()
    {
        if (_isSpecification)
            return new List<Reporter.Models.RuleViolation>();

        var violations = new List<Reporter.Models.RuleViolation>();
        var stepViolations = _steps
            .SelectMany(step => step.RuleViolations ?? Enumerable.Empty<Reporter.Models.RuleViolation>())
            .ToList();

        if (!_hasGiven && stepViolations.All(violation => violation.Rule != "mustIncludeGiven"))
            violations.Add(CreateRuleViolation("mustIncludeGiven", "scenario does not have a given."));

        if (!_hasWhen && stepViolations.All(violation => violation.Rule != "mustIncludeWhen"))
        {
            violations.Add(CreateRuleViolation(
                "mustIncludeWhen",
                "scenario does not have a when, use when to describe the test action."));
        }

        if (!_hasThen)
        {
            violations.Add(CreateRuleViolation(
                "mustIncludeThen",
                "scenario does not have a then, use then to describe the expected outcome."));
        }

        return violations;
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
        
        // Update buffered test with final execution result
        var hasFailed = failed > 0;
        if (_runReporter != null)
        {
            _scenarioStopwatch.Stop();
            var failedStep = _steps.FirstOrDefault(s => s.Status == StepStatus.Failed);
            var error = CreateErrorInfo(failedStep?.Exception);

            var finalStatus = hasFailed ? Reporter.Models.Status.Failed : Reporter.Models.Status.Passed;
            var durationMs = _scenarioStopwatch.ElapsedMilliseconds;

            // Build step data for reporting
            var reportedSteps = BuildStepData();
            var testRuleViolations = BuildScenarioRuleViolations();

            if (_isOutline && _outlineId != null)
            {
                _runReporter.SetTestRuleViolations(_outlineId, testRuleViolations);
                // Resolve authored constants and parameterized values across all observed rows.
                if (reportedSteps.Count > 0)
                {
                    _runReporter.SetOutlineTestSteps(
                        _outlineId,
                        _outlineRowId,
                        BuildStepData(useTemplate: false),
                        reportedSteps,
                        _steps.Select(step => step.QuotedParameterCandidates).ToList());
                }

                // Add per-step example results for this row (matches vitest format)
                // Server expects testId = step ID, not outline ID
                if (reportedSteps.Count > 0)
                {
                    foreach (var step in reportedSteps)
                    {
                        _runReporter.AddOutlineExampleResult(
                            _outlineId, _outlineRowId, step.Id,
                            step.Execution.Status, step.Execution.Duration);
                    }
                }
                else
                {
                    // No steps (e.g., Rules) — use outline ID as fallback
                    _runReporter.AddOutlineExampleResult(
                        _outlineId, _outlineRowId, _outlineId,
                        finalStatus, durationMs, error);
                }
                _runReporter.RecordResult(
                    finalStatus,
                    _testCaseId,
                    LiveDocTestRunReporter.GenerateOutlineResultId(_outlineId, _outlineRowId));
            }
            else if (_scenarioId != null)
            {
                _runReporter.SetTestRuleViolations(_scenarioId, testRuleViolations);
                // Set steps on scenario test
                if (reportedSteps.Count > 0)
                    _runReporter.SetTestSteps(_scenarioId, reportedSteps);

                _runReporter.UpdateTestExecution(_scenarioId, finalStatus, durationMs, error);
                _runReporter.RecordResult(finalStatus, _testCaseId, _scenarioId);
            }
        }
    }

    private List<StepTest> BuildStepData(bool useTemplate = true)
    {
        var parentId = _isOutline ? _outlineId! : _scenarioId!;
        var result = new List<StepTest>();
        for (int i = 0; i < _steps.Count; i++)
        {
            var step = _steps[i];
            var stepId = LiveDocTestRunReporter.GenerateStepId(parentId, step.Type, i + 1);
            var title = _isOutline
                ? useTemplate
                    ? step.TemplateDescription ?? step.OriginalDescription ?? step.Description
                    : step.OriginalDescription ?? step.Description
                : step.Description;
            result.Add(new StepTest
            {
                Id = stepId,
                Title = title,
                Keyword = step.Type.ToStepKeyword(),
                Execution = new ExecutionResult
                {
                    Status = step.Status.ToReporterStatus(),
                    Duration = (long)step.Duration.TotalMilliseconds,
                    Error = CreateErrorInfo(step.Exception),
                    Attachments = step.Attachments
                },
                RuleViolations = step.RuleViolations
            });
        }
        return result;
    }

    private static ErrorInfo? CreateErrorInfo(Exception? exception)
    {
        return exception == null
            ? null
            : new ErrorInfo
            {
                Message = exception.Message,
                Stack = exception.StackTrace
            };
    }

    /// <summary>
    /// Reconstructs a template step by replacing bound example values with &lt;paramName&gt; placeholders.
    /// E.g., "an order total of '100'" → "an order total of '&lt;orderTotal&gt;'" when orderTotal=100.
    /// </summary>
    private string ReconstructTemplate(string description)
    {
        if (_currentExample == null)
            return description;

        var result = description;
        // Stable ordering handles duplicate values consistently.
        foreach (var kvp in _currentExample.GetAll()
                     .OrderBy(item => item.Key, StringComparer.Ordinal))
        {
            var placeholder = $"<{kvp.Key}>";
            var formats = OutlineDisplayNameFormatter.GetValueFormats(kvp.Value)
                .OrderByDescending(value => value.Length)
                .ThenBy(value => value, StringComparer.Ordinal);
            foreach (var value in formats)
            {
                if (string.IsNullOrEmpty(value))
                    continue;

                result = Regex.Replace(
                    result,
                    $"'{Regex.Escape(value)}'",
                    $"'{placeholder}'");
            }
        }
        return result;
    }

    private List<string[]> GetQuotedParameterCandidates(string description)
    {
        if (_currentExample == null)
            return new List<string[]>();

        return Regex.Matches(description, @"'([^']*)'")
            .Select(match =>
            {
                var quotedValue = match.Groups[1].Value;
                return _currentExample.GetAll()
                    .Where(parameter => OutlineDisplayNameFormatter
                        .GetValueFormats(parameter.Value)
                        .Contains(quotedValue, StringComparer.Ordinal))
                    .Select(parameter => parameter.Key)
                    .OrderBy(name => name, StringComparer.Ordinal)
                    .ToArray();
            })
            .ToList();
    }
}
