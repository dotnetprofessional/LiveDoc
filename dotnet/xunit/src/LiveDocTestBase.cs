using System.Reflection;
using SweDevTools.LiveDoc.xUnit.Core;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
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

    #region Attachments

    private static readonly Dictionary<string, string> MimeTypeMap = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
        [".svg"] = "image/svg+xml",
        [".pdf"] = "application/pdf"
    };

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp"
    };

    /// <summary>
    /// Attaches base64-encoded data to the current step.
    /// Call this inside a Given/When/Then/And/But step callback.
    /// </summary>
    /// <param name="base64Data">The base64-encoded content.</param>
    /// <param name="mimeType">The MIME type of the content (e.g., "image/png").</param>
    /// <param name="title">Optional descriptive title for the attachment.</param>
    /// <param name="kind">The attachment kind: "file", "image", or "screenshot".</param>
    protected void Attach(string base64Data, string mimeType, string? title = null, string kind = "file")
    {
        EnsureContext();
        _context!.AddAttachment(new Attachment
        {
            Id = Guid.NewGuid().ToString("N"),
            Kind = kind,
            MimeType = mimeType,
            Title = title,
            Base64 = base64Data
        });
    }

    /// <summary>
    /// Attaches a screenshot (PNG) to the current step.
    /// Convenience wrapper around <see cref="Attach"/> with screenshot defaults.
    /// </summary>
    /// <param name="base64Data">The base64-encoded PNG screenshot data.</param>
    /// <param name="title">Optional descriptive title for the screenshot.</param>
    protected void AttachScreenshot(string base64Data, string? title = null)
    {
        Attach(base64Data, "image/png", title, "screenshot");
    }

    /// <summary>
    /// Reads a file from disk and attaches it to the current step.
    /// MIME type is auto-detected from the file extension.
    /// Image files (.png, .jpg, .jpeg, .gif, .webp) use kind "image"; others use "file".
    /// </summary>
    /// <param name="filePath">Path to the file to attach.</param>
    /// <param name="title">Optional descriptive title. Defaults to the file name.</param>
    protected void AttachFile(string filePath, string? title = null)
    {
        var bytes = File.ReadAllBytes(filePath);
        var base64 = Convert.ToBase64String(bytes);
        var ext = Path.GetExtension(filePath);
        var mimeType = MimeTypeMap.GetValueOrDefault(ext, "application/octet-stream");
        var kind = ImageExtensions.Contains(ext) ? "image" : "file";
        var attachTitle = title ?? Path.GetFileName(filePath);

        Attach(base64, mimeType, attachTitle, kind);
    }

    /// <summary>
    /// Attaches a JSON payload to the current step (e.g., API response body).
    /// The object is serialized to JSON with indented formatting.
    /// </summary>
    /// <param name="data">The object to serialize as JSON. If already a string, used as-is.</param>
    /// <param name="title">Optional descriptive title.</param>
    protected void AttachJson(object data, string? title = null)
    {
        var json = data is string s
            ? s
            : System.Text.Json.JsonSerializer.Serialize(data, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        var base64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json));
        Attach(base64, "application/json", title, "file");
    }

    #endregion

    /// <summary>
    /// Disposes the LiveDoc context, outputting the test summary.
    /// </summary>
    public virtual void Dispose()
    {
        _context?.Dispose();
    }
}
