using System.Reflection;
using SweDevTools.LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Internal base class with shared infrastructure for LiveDoc tests.
/// Not intended for direct use - inherit from FeatureTest or SpecificationTest instead.
/// </summary>
public abstract class LiveDocTestBase : IDisposable
{
    private protected LiveDocContext? _context;
    private protected readonly ITestOutputHelper _output;

    /// <summary>
    /// Constructor that receives xUnit's test output helper.
    /// This is injected automatically by xUnit.
    /// </summary>
    protected LiveDocTestBase(ITestOutputHelper output)
    {
        _output = output;
    }

    /// <summary>
    /// Initializes the LiveDoc context for the current test method.
    /// Called automatically before first step execution or context access.
    /// </summary>
    private protected void EnsureContext()
    {
        if (_context != null)
            return;

        // Check if we have injected test data from the custom invoker
        var injectedMethod = LiveDocExampleDataAttribute.CurrentTestMethod;
        var injectedArgs = LiveDocExampleDataAttribute.CurrentTestArgs;
        
        if (injectedMethod != null && injectedArgs != null && injectedArgs.Length > 0)
        {
            // Use injected data (for outline tests with auto-injection)
            _context = new LiveDocContext(_output, GetType(), injectedMethod, injectedArgs);
            return;
        }

        // Walk up the stack to find the test method
        var stackTrace = new System.Diagnostics.StackTrace();
        MethodInfo? testMethod = null;
        
        for (int i = 0; i < stackTrace.FrameCount; i++)
        {
            var frame = stackTrace.GetFrame(i);
            var method = frame?.GetMethod() as MethodInfo;
            
            if (method != null && method.DeclaringType == GetType())
            {
                // Check for any LiveDoc test attribute
                if (method.GetCustomAttribute<ScenarioAttribute>() != null ||
                    method.GetCustomAttribute<ScenarioOutlineAttribute>() != null ||
                    method.GetCustomAttribute<RuleAttribute>() != null ||
                    method.GetCustomAttribute<RuleOutlineAttribute>() != null)
                {
                    testMethod = method;
                    break;
                }
            }
        }

        // Async fallback: after await, the stack shows the state machine's
        // MoveNext() instead of the original method. Check for compiler-
        // generated state machine types nested inside our test class.
        if (testMethod == null)
        {
            for (int i = 0; i < stackTrace.FrameCount; i++)
            {
                var method = stackTrace.GetFrame(i)?.GetMethod();
                var declaringType = method?.DeclaringType;

                if (declaringType != null &&
                    declaringType.DeclaringType == GetType() &&
                    declaringType.Name.StartsWith("<"))
                {
                    // State machine names are like <MethodName>d__N
                    var match = System.Text.RegularExpressions.Regex.Match(
                        declaringType.Name, @"^<(.+)>d__\d+$");
                    if (match.Success)
                    {
                        var originalName = match.Groups[1].Value;
                        var original = GetType().GetMethod(originalName,
                            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                        if (original != null)
                        {
                            testMethod = original;
                            break;
                        }
                    }
                }
            }
        }

        _context = new LiveDocContext(_output, GetType(), testMethod);
    }

    /// <summary>
    /// Sets the current example data for outline tests.
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
    /// Sets the current example data for outline tests with explicit method info.
    /// Used by the test framework for automatic injection.
    /// </summary>
    internal void SetExampleDataInternal(MethodInfo testMethod, object[] args)
    {
        if (args.Length > 0 && testMethod != null)
        {
            // Dispose existing context if present and reinitialize with example data
            _context?.Dispose();
            _context = new LiveDocContext(_output, GetType(), testMethod, args);
        }
    }

    /// <summary>
    /// Disposes the LiveDoc context, outputting the test summary.
    /// </summary>
    public virtual void Dispose()
    {
        _context?.Dispose();
    }
}
