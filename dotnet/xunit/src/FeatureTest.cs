using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit;

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
    protected void Given(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("Given", description, step);
    }

    /// <summary>
    /// Defines a Given step with context access for value extraction.
    /// </summary>
    protected void Given(string description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("Given", description, step);
    }

    /// <summary>
    /// Defines a Given step with async support.
    /// </summary>
    protected async Task Given(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Given", description, step);
    }

    /// <summary>
    /// Defines an async Given step with context access.
    /// </summary>
    protected async Task Given(string description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Given", description, step);
    }

    #endregion

    #region When Steps

    /// <summary>
    /// Defines a When step (action/event).
    /// </summary>
    protected void When(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("When", description, step);
    }

    /// <summary>
    /// Defines a When step with context access for value extraction.
    /// </summary>
    protected void When(string description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("When", description, step);
    }

    /// <summary>
    /// Defines a When step with async support.
    /// </summary>
    protected async Task When(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("When", description, step);
    }

    /// <summary>
    /// Defines an async When step with context access.
    /// </summary>
    protected async Task When(string description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("When", description, step);
    }

    #endregion

    #region Then Steps

    /// <summary>
    /// Defines a Then step (assertion/expected outcome).
    /// </summary>
    protected void Then(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("Then", description, step);
    }

    /// <summary>
    /// Defines a Then step with context access for value extraction.
    /// </summary>
    protected void Then(string description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("Then", description, step);
    }

    /// <summary>
    /// Defines a Then step with async support.
    /// </summary>
    protected async Task Then(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Then", description, step);
    }

    /// <summary>
    /// Defines an async Then step with context access.
    /// </summary>
    protected async Task Then(string description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("Then", description, step);
    }

    #endregion

    #region And Steps

    /// <summary>
    /// Defines an And step (continuation of previous step type).
    /// </summary>
    protected void And(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("and", description, step);
    }

    /// <summary>
    /// Defines an And step with context access for value extraction.
    /// </summary>
    protected void And(string description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("and", description, step);
    }

    /// <summary>
    /// Defines an And step with async support.
    /// </summary>
    protected async Task And(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("and", description, step);
    }

    /// <summary>
    /// Defines an async And step with context access.
    /// </summary>
    protected async Task And(string description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("and", description, step);
    }

    #endregion

    #region But Steps

    /// <summary>
    /// Defines a But step (continuation with contrast).
    /// </summary>
    protected void But(string description, Action step)
    {
        EnsureContext();
        _context!.ExecuteStep("but", description, step);
    }

    /// <summary>
    /// Defines a But step with context access for value extraction.
    /// </summary>
    protected void But(string description, Action<LiveDocContext> step)
    {
        EnsureContext();
        _context!.ExecuteStep("but", description, step);
    }

    /// <summary>
    /// Defines a But step with async support.
    /// </summary>
    protected async Task But(string description, Func<Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("but", description, step);
    }

    /// <summary>
    /// Defines an async But step with context access.
    /// </summary>
    protected async Task But(string description, Func<LiveDocContext, Task> step)
    {
        EnsureContext();
        await _context!.ExecuteStepAsync("but", description, step);
    }

    #endregion
}
