using System.Reflection;
using System.Runtime.CompilerServices;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit;

/// <summary>
/// Base class for LiveDoc tests. Inherit from this to gain BDD-style test capabilities.
/// Provides Given/When/Then/And/But methods for writing readable tests.
/// </summary>
/// <example>
/// <code>
/// [Feature]
/// public class MyTests : LiveDocTest
/// {
///     [Scenario]
///     public void My_scenario()
///     {
///         Given("some precondition", () => { ... });
///         When("some action occurs", () => { ... });
///         Then("some result is expected", () => { ... });
///     }
/// }
/// </code>
/// </example>
public abstract class LiveDocTest : IDisposable
{
    private LiveDocContext? _context;
    private readonly ITestOutputHelper _output;

    /// <summary>
    /// Constructor that receives xUnit's test output helper.
    /// This is injected automatically by xUnit.
    /// </summary>
    protected LiveDocTest(ITestOutputHelper output)
    {
        _output = output;
    }

    /// <summary>
    /// Initializes the LiveDoc context for the current test method.
    /// Called automatically before first step execution.
    /// </summary>
    private void EnsureContext()
    {
        if (_context != null)
            return;

        // Walk up the stack to find the test method (the one with [Scenario] or [ScenarioOutline] attribute)
        var stackTrace = new System.Diagnostics.StackTrace();
        MethodInfo? testMethod = null;
        
        for (int i = 0; i < stackTrace.FrameCount; i++)
        {
            var frame = stackTrace.GetFrame(i);
            var method = frame?.GetMethod() as MethodInfo;
            
            if (method != null &&
                method.DeclaringType == GetType() &&
                (method.GetCustomAttribute<ScenarioAttribute>() != null ||
                 method.GetCustomAttribute<ScenarioOutlineAttribute>() != null))
            {
                testMethod = method;
                break;
            }
        }

        _context = new LiveDocContext(_output, GetType(), testMethod);
    }

    /// <summary>
    /// Sets the current example data for scenario outlines.
    /// This should be called at the start of the test method.
    /// </summary>
    protected void SetExampleData(params object[] args)
    {
        if (args.Length > 0)
        {
            var testMethod = new System.Diagnostics.StackFrame(1).GetMethod() as MethodInfo;
            if (testMethod != null)
            {
                // Dispose existing context if present and reinitialize with example data
                _context?.Dispose();
                _context = new LiveDocContext(_output, GetType(), testMethod, args);
            }
        }
    }

    /// <summary>
    /// Access to the current feature context.
    /// </summary>
    protected FeatureContext Feature
    {
        get
        {
            EnsureContext();
            return _context!.Feature;
        }
    }

    /// <summary>
    /// Access to the current scenario context.
    /// </summary>
    protected ScenarioContext Scenario
    {
        get
        {
            EnsureContext();
            return _context!.Scenario;
        }
    }

    /// <summary>
    /// Access to the current example data (for scenario outlines).
    /// Use Example.PropertyName to access values, where PropertyName matches the test method parameter.
    /// </summary>
    protected dynamic? Example
    {
        get
        {
            EnsureContext();
            return _context!.Example;
        }
    }

    /// <summary>
    /// Defines a Given step (precondition).
    /// </summary>
    /// <param name="description">Human-readable description. Use &lt;PropertyName&gt; for placeholders in scenario outlines.</param>
    /// <param name="step">The action to execute.</param>
    protected void Given(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("Given", description, step);
    }

    /// <summary>
    /// Defines a Given step (precondition) with async support.
    /// </summary>
    protected async Task Given(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Given", description, step);
    }

    /// <summary>
    /// Defines a When step (action/event).
    /// </summary>
    /// <param name="description">Human-readable description. Use &lt;PropertyName&gt; for placeholders in scenario outlines.</param>
    /// <param name="step">The action to execute.</param>
    protected void When(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("When", description, step);
    }

    /// <summary>
    /// Defines a When step (action/event) with async support.
    /// </summary>
    protected async Task When(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("When", description, step);
    }

    /// <summary>
    /// Defines a Then step (assertion/expected outcome).
    /// </summary>
    /// <param name="description">Human-readable description. Use &lt;PropertyName&gt; for placeholders in scenario outlines.</param>
    /// <param name="step">The action to execute.</param>
    protected void Then(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("Then", description, step);
    }

    /// <summary>
    /// Defines a Then step (assertion/expected outcome) with async support.
    /// </summary>
    protected async Task Then(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Then", description, step);
    }

    /// <summary>
    /// Defines an And step (continuation of previous step type).
    /// </summary>
    /// <param name="description">Human-readable description. Use &lt;PropertyName&gt; for placeholders in scenario outlines.</param>
    /// <param name="step">The action to execute.</param>
    protected void And(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("and", description, step);
    }

    /// <summary>
    /// Defines an And step (continuation of previous step type) with async support.
    /// </summary>
    protected async Task And(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("and", description, step);
    }

    /// <summary>
    /// Defines a But step (continuation with contrast).
    /// </summary>
    /// <param name="description">Human-readable description. Use &lt;PropertyName&gt; for placeholders in scenario outlines.</param>
    /// <param name="step">The action to execute.</param>
    protected void But(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("but", description, step);
    }

    /// <summary>
    /// Defines a But step (continuation with contrast) with async support.
    /// </summary>
    protected async Task But(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("but", description, step);
    }

    /// <summary>
    /// Disposes the LiveDoc context, outputting the test summary.
    /// </summary>
    public virtual void Dispose()
    {
        _context?.Dispose();
    }
}
