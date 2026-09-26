using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Base class for BDD/Gherkin-style feature tests.
/// Provides Given/When/Then/And/But step methods for writing readable scenarios.
/// </summary>
/// <remarks>
/// Use with [Feature] class attribute and [Scenario] or [ScenarioOutline] method attributes.
/// </remarks>
/// <example>
/// <code>
/// [Feature("User Authentication")]
/// public class AuthTests : FeatureTest
/// {
///     public AuthTests(ITestOutputHelper output) : base(output) { }
///     
///     [Scenario("User logs in successfully")]
///     public void User_logs_in_successfully()
///     {
///         Given("a registered user", () => { ... });
///         When("they enter valid credentials", () => { ... });
///         Then("they should be authenticated", () => { ... });
///     }
/// }
/// </code>
/// </example>
public abstract class FeatureTest : LiveDocTestBase
{
    /// <summary>
    /// Constructor that receives xUnit's test output helper.
    /// </summary>
    protected FeatureTest(ITestOutputHelper output) : base(output)
    {
    }

    /// <summary>
    /// Runs before each Scenario or Scenario Outline example. Use Given/And steps
    /// to describe shared preconditions; each invocation has its own test instance.
    /// </summary>
    protected virtual Task BackgroundAsync() => Task.CompletedTask;

    /// <summary>
    /// Runs after each Scenario or Scenario Outline example, including failures
    /// in the background or scenario. Runs before the LiveDoc result is finalized.
    /// </summary>
    protected virtual Task AfterBackgroundAsync() => Task.CompletedTask;

    internal async Task RunBackgroundAsync(System.Reflection.MethodInfo method, object?[]? args, int? rowId)
    {
        _context ??= new LiveDocContext(_output, GetType(), method, args, rowId);
        _context.BeginBackground();
        try
        {
            await BackgroundAsync();
        }
        catch (Exception ex)
        {
            _context.RecordBackgroundFailure(ex);
            throw;
        }
        finally
        {
            _context.EndBackground();
        }
    }

    internal async Task RunAfterBackgroundAsync()
    {
        try
        {
            await AfterBackgroundAsync();
        }
        catch (Exception ex)
        {
            _context?.RecordLifecycleFailure(ex);
            throw;
        }
    }

    #region Context Properties

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
    /// Use Example.PropertyName to access values.
    /// </summary>
    protected dynamic? Example
    {
        get
        {
            EnsureContext();
            return _context!.Example;
        }
    }

    #endregion

    #region Given Steps

    /// <summary>
    /// Defines a Given step (precondition).
    /// </summary>
    protected void Given(string title, Action step)
    {
        Given(title, null, step);
    }

    /// <summary>
    /// Defines a Given step with inline Markdown content.
    /// </summary>
    protected void Given(string title, string? description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("Given", title, step, description);
    }

    /// <summary>
    /// Defines a Given step with context access for value extraction.
    /// </summary>
    protected void Given(string title, Action<LiveDocContext> step)
    {
        Given(title, null, step);
    }

    /// <summary>
    /// Defines a Given step with context access and inline Markdown content.
    /// </summary>
    protected void Given(string title, string? description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("Given", title, step, description);
    }

    /// <summary>
    /// Defines a Given step with async support.
    /// </summary>
    protected Task Given(string title, Func<Task> step)
    {
        return Given(title, null, step);
    }

    /// <summary>
    /// Defines an async Given step with inline Markdown content.
    /// </summary>
    protected async Task Given(string title, string? description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Given", title, step, description);
    }

    /// <summary>
    /// Defines an async Given step with context access.
    /// </summary>
    protected Task Given(string title, Func<LiveDocContext, Task> step)
    {
        return Given(title, null, step);
    }

    /// <summary>
    /// Defines an async Given step with context access and inline Markdown content.
    /// </summary>
    protected async Task Given(string title, string? description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Given", title, step, description);
    }

    #endregion

    #region When Steps

    /// <summary>
    /// Defines a When step (action/event).
    /// </summary>
    protected void When(string title, Action step)
    {
        When(title, null, step);
    }

    /// <summary>
    /// Defines a When step with inline Markdown content.
    /// </summary>
    protected void When(string title, string? description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("When", title, step, description);
    }

    /// <summary>
    /// Defines a When step with context access for value extraction.
    /// </summary>
    protected void When(string title, Action<LiveDocContext> step)
    {
        When(title, null, step);
    }

    /// <summary>
    /// Defines a When step with context access and inline Markdown content.
    /// </summary>
    protected void When(string title, string? description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("When", title, step, description);
    }

    /// <summary>
    /// Defines a When step with async support.
    /// </summary>
    protected Task When(string title, Func<Task> step)
    {
        return When(title, null, step);
    }

    /// <summary>
    /// Defines an async When step with inline Markdown content.
    /// </summary>
    protected async Task When(string title, string? description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("When", title, step, description);
    }

    /// <summary>
    /// Defines an async When step with context access.
    /// </summary>
    protected Task When(string title, Func<LiveDocContext, Task> step)
    {
        return When(title, null, step);
    }

    /// <summary>
    /// Defines an async When step with context access and inline Markdown content.
    /// </summary>
    protected async Task When(string title, string? description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("When", title, step, description);
    }

    #endregion

    #region Then Steps

    /// <summary>
    /// Defines a Then step (assertion/expected outcome).
    /// </summary>
    protected void Then(string title, Action step)
    {
        Then(title, null, step);
    }

    /// <summary>
    /// Defines a Then step with inline Markdown content.
    /// </summary>
    protected void Then(string title, string? description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("Then", title, step, description);
    }

    /// <summary>
    /// Defines a Then step with context access for value extraction.
    /// </summary>
    protected void Then(string title, Action<LiveDocContext> step)
    {
        Then(title, null, step);
    }

    /// <summary>
    /// Defines a Then step with context access and inline Markdown content.
    /// </summary>
    protected void Then(string title, string? description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("Then", title, step, description);
    }

    /// <summary>
    /// Defines a Then step with async support.
    /// </summary>
    protected Task Then(string title, Func<Task> step)
    {
        return Then(title, null, step);
    }

    /// <summary>
    /// Defines an async Then step with inline Markdown content.
    /// </summary>
    protected async Task Then(string title, string? description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Then", title, step, description);
    }

    /// <summary>
    /// Defines an async Then step with context access.
    /// </summary>
    protected Task Then(string title, Func<LiveDocContext, Task> step)
    {
        return Then(title, null, step);
    }

    /// <summary>
    /// Defines an async Then step with context access and inline Markdown content.
    /// </summary>
    protected async Task Then(string title, string? description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Then", title, step, description);
    }

    #endregion

    #region And Steps

    /// <summary>
    /// Defines an And step (continuation of previous step type).
    /// </summary>
    protected void And(string title, Action step)
    {
        And(title, null, step);
    }

    /// <summary>
    /// Defines an And step with inline Markdown content.
    /// </summary>
    protected void And(string title, string? description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("and", title, step, description);
    }

    /// <summary>
    /// Defines an And step with context access for value extraction.
    /// </summary>
    protected void And(string title, Action<LiveDocContext> step)
    {
        And(title, null, step);
    }

    /// <summary>
    /// Defines an And step with context access and inline Markdown content.
    /// </summary>
    protected void And(string title, string? description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("and", title, step, description);
    }

    /// <summary>
    /// Defines an And step with async support.
    /// </summary>
    protected Task And(string title, Func<Task> step)
    {
        return And(title, null, step);
    }

    /// <summary>
    /// Defines an async And step with inline Markdown content.
    /// </summary>
    protected async Task And(string title, string? description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("and", title, step, description);
    }

    /// <summary>
    /// Defines an async And step with context access.
    /// </summary>
    protected Task And(string title, Func<LiveDocContext, Task> step)
    {
        return And(title, null, step);
    }

    /// <summary>
    /// Defines an async And step with context access and inline Markdown content.
    /// </summary>
    protected async Task And(string title, string? description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("and", title, step, description);
    }

    #endregion

    #region But Steps

    /// <summary>
    /// Defines a But step (continuation with contrast).
    /// </summary>
    protected void But(string title, Action step)
    {
        But(title, null, step);
    }

    /// <summary>
    /// Defines a But step with inline Markdown content.
    /// </summary>
    protected void But(string title, string? description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("but", title, step, description);
    }

    /// <summary>
    /// Defines a But step with context access for value extraction.
    /// </summary>
    protected void But(string title, Action<LiveDocContext> step)
    {
        But(title, null, step);
    }

    /// <summary>
    /// Defines a But step with context access and inline Markdown content.
    /// </summary>
    protected void But(string title, string? description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("but", title, step, description);
    }

    /// <summary>
    /// Defines a But step with async support.
    /// </summary>
    protected Task But(string title, Func<Task> step)
    {
        return But(title, null, step);
    }

    /// <summary>
    /// Defines an async But step with inline Markdown content.
    /// </summary>
    protected async Task But(string title, string? description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("but", title, step, description);
    }

    /// <summary>
    /// Defines an async But step with context access.
    /// </summary>
    protected Task But(string title, Func<LiveDocContext, Task> step)
    {
        return But(title, null, step);
    }

    /// <summary>
    /// Defines an async But step with context access and inline Markdown content.
    /// </summary>
    protected async Task But(string title, string? description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("but", title, step, description);
    }

    #endregion
}
