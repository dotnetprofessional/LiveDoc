using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

// HttpJourneyGenerator — Parses BDD comments from .http files and generates
// LiveDoc xUnit test classes for automated journey testing.
//
// Usage: HttpJourneyGenerator <mode> <journeysDir> <outputDir>
//
// Modes:
//   scaffold  — Generate test file only if it doesn't exist (default)
//   validate  — Report missing/extra steps without modifying files
//   force     — Regenerate all test files (overwrites existing)
//   capture   — Run .http files via httpYac and save response bodies as .Response.json
//
// Journey folder convention:
//   journeys/api/ai-services/_ai-services.http  → Journeys/Api/AiServices.Journey.cs
//   journeys/user/01-getting-started/_01-getting-started.http → Journeys/User/GettingStarted.Journey.cs
//
// Naming: .http files are prefixed with '_' so they sort above .Response.json files in directory listings.

const string usage =
    "Usage: SweDevTools.LiveDoc.xUnit.JourneyGenerator [scaffold|validate|force|capture] <journeysDir> <outputDir> " +
    "[--base-namespace <ns>] [--infrastructure-namespace <ns>] [--fixture-type <type>]\n" +
    "       SweDevTools.LiveDoc.xUnit.JourneyGenerator capture <journeysDir> " +
    "[--var key=value ...] [--env <name>] [--overwrite]";

if (args.Length < 2)
{
    Console.Error.WriteLine(usage);
    return 1;
}

// Parse mode (optional first arg) and paths
var mode = "scaffold";
int pathStart = 0;
if (args[0] is "scaffold" or "validate" or "force" or "capture")
{
    mode = args[0];
    pathStart = 1;
}

// Capture mode has its own argument parsing and execution path
if (mode == "capture")
    return await CaptureMode.RunAsync(args.Skip(pathStart).ToArray());

if (args.Length < pathStart + 2)
{
    Console.Error.WriteLine(usage);
    return 1;
}

// Support legacy --force flag
if (args.Contains("--force"))
    mode = "force";

var journeysDir = Path.GetFullPath(args[pathStart]);
var outputDir = Path.GetFullPath(args[pathStart + 1]);
var optionArgs = args.Skip(pathStart + 2).ToArray();
if (!TryParseOptions(optionArgs, out var generatorOptions, out var optionError))
{
    Console.Error.WriteLine(optionError);
    Console.Error.WriteLine(usage);
    return 1;
}

if (!Directory.Exists(journeysDir))
{
    Console.Error.WriteLine($"Journeys directory not found: {journeysDir}");
    return 1;
}

Directory.CreateDirectory(outputDir);

var httpFiles = Directory.GetFiles(journeysDir, "*.http", SearchOption.AllDirectories);
if (httpFiles.Length == 0)
{
    Console.WriteLine("No .http files found.");
    return 0;
}

Console.WriteLine($"Mode: {mode} | Journeys: {journeysDir} | Output: {outputDir}");

var processedCount = 0;
var skippedCount = 0;
var validationIssues = new List<string>();

foreach (var file in httpFiles)
{
    var journey = HttpFileParser.Parse(file, journeysDir);
    if (journey == null || journey.Scenarios.Count == 0)
    {
        Console.WriteLine($"  SKIP {Path.GetRelativePath(journeysDir, file)} (no BDD comments)");
        continue;
    }

    // Derive output path from journey folder structure
    var outputRelPath = PathDeriver.DeriveOutputPath(journey.RelativePath);
    var outputPath = Path.Combine(outputDir, outputRelPath);

    if (mode == "validate")
    {
        // Check if test file exists and has matching steps
        if (!File.Exists(outputPath))
        {
            validationIssues.Add($"MISSING: {outputRelPath} (journey: {journey.RelativePath})");
        }
        else
        {
            var existingCode = File.ReadAllText(outputPath);
            foreach (var scenario in journey.Scenarios)
            {
                foreach (var step in scenario.Steps.Where(s => s.RequestName != null))
                {
                    if (!existingCode.Contains($"\"{step.RequestName}\""))
                        validationIssues.Add($"MISSING STEP: '{step.RequestName}' not found in {outputRelPath}");
                }
            }
        }
        continue;
    }

    if (mode == "scaffold" && File.Exists(outputPath))
    {
        skippedCount++;
        continue;
    }

    // Detect response files in the journey folder
    var journeyFolder = Path.GetDirectoryName(file)!;
    var responseFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    foreach (var rf in Directory.GetFiles(journeyFolder, "*.Response.json"))
        responseFiles.Add(Path.GetFileNameWithoutExtension(rf).Replace(".Response", ""));

    var code = CodeEmitter.Emit(journey, responseFiles, generatorOptions);
    Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
    File.WriteAllText(outputPath, code);
    Console.WriteLine($"  EMIT {outputRelPath}");
    processedCount++;
}

if (mode == "validate")
{
    if (validationIssues.Count == 0)
    {
        Console.WriteLine("All journey test files are in sync.");
        return 0;
    }
    Console.WriteLine($"\n{validationIssues.Count} validation issue(s):");
    foreach (var issue in validationIssues)
        Console.WriteLine($"  {issue}");
    return 1;
}

Console.WriteLine($"Done. Generated {processedCount}, skipped {skippedCount} existing file(s).");
return 0;

static bool TryParseOptions(string[] args, out GeneratorOptions options, out string? error)
{
    var baseNamespace = "LiveDoc.Journeys";
    string? infrastructureNamespace = null;
    var fixtureType = "JourneyServerFixture";

    for (var i = 0; i < args.Length; i++)
    {
        var current = args[i];
        if (current == "--force")
            continue;

        if (i + 1 >= args.Length)
        {
            error = $"Missing value for option '{current}'.";
            options = default!;
            return false;
        }

        switch (current)
        {
            case "--base-namespace":
                baseNamespace = args[++i];
                break;
            case "--infrastructure-namespace":
                infrastructureNamespace = args[++i];
                break;
            case "--fixture-type":
                fixtureType = args[++i];
                break;
            default:
                error = $"Unknown option '{current}'.";
                options = default!;
                return false;
        }
    }

    if (string.IsNullOrWhiteSpace(baseNamespace))
    {
        error = "--base-namespace cannot be empty.";
        options = default!;
        return false;
    }

    if (string.IsNullOrWhiteSpace(fixtureType))
    {
        error = "--fixture-type cannot be empty.";
        options = default!;
        return false;
    }

    options = new GeneratorOptions(
        baseNamespace.Trim(),
        string.IsNullOrWhiteSpace(infrastructureNamespace)
            ? $"{baseNamespace.Trim()}.Infrastructure"
            : infrastructureNamespace.Trim(),
        fixtureType.Trim());
    error = null;
    return true;
}

public record GeneratorOptions(
    string BaseNamespace,
    string InfrastructureNamespace,
    string FixtureType);

// ============================================================
// Path Derivation
// ============================================================

public static class PathDeriver
{
    /// <summary>
    /// Derives the output .cs file path from the journey's relative path.
    /// api/ai-services/ai-services.http → Api\AiServices.Journey.cs
    /// user/01-getting-started/01-getting-started.http → User\GettingStarted.Journey.cs
    /// 00-health-check/00-health-check.http → HealthCheck.Journey.cs
    /// </summary>
    public static string DeriveOutputPath(string journeyRelativePath)
    {
        // Split path segments: "api/ai-services/ai-services.http" → ["api", "ai-services", "ai-services.http"]
        var segments = journeyRelativePath.Replace('\\', '/').Split('/');

        // The folder containing the .http file determines the class name
        // Parent folders determine the namespace/directory
        if (segments.Length < 2)
        {
            // Flat file at root (shouldn't happen with folder convention)
            var name = PascalCase(Path.GetFileNameWithoutExtension(segments[0]));
            return $"{name}.Journey.cs";
        }

        // Folder name = segments[^2] (parent of the .http file)
        var folderName = segments[^2];
        var className = PascalCase(folderName);

        // Directory path = all segments except the last two (file + its folder)
        // e.g., "api/ai-services/ai-services.http" → directory is "api" → "Api"
        var dirParts = segments[..^2]
            .Select(PascalCase)
            .Where(s => !string.IsNullOrEmpty(s));

        var dirPath = string.Join(Path.DirectorySeparatorChar.ToString(), dirParts);

        return string.IsNullOrEmpty(dirPath)
            ? $"{className}.Journey.cs"
            : Path.Combine(dirPath, $"{className}.Journey.cs");
    }

    /// <summary>
    /// Derives the namespace suffix from the journey's relative path.
    /// api/ai-services/ai-services.http → Api
    /// user/01-getting-started/01-getting-started.http → User
    /// 00-health-check/00-health-check.http → (empty)
    /// </summary>
    public static string DeriveNamespaceSuffix(string journeyRelativePath)
    {
        var segments = journeyRelativePath.Replace('\\', '/').Split('/');
        if (segments.Length <= 2) return "";

        return string.Join(".", segments[..^2].Select(PascalCase).Where(s => !string.IsNullOrEmpty(s)));
    }

    /// <summary>
    /// Derives the journey folder path (relative to journeys root) for response file loading.
    /// api/ai-services/ai-services.http → api/ai-services
    /// </summary>
    public static string DeriveJourneyFolder(string journeyRelativePath)
    {
        var idx = journeyRelativePath.Replace('\\', '/').LastIndexOf('/');
        return idx >= 0 ? journeyRelativePath[..idx] : "";
    }

    /// <summary>Converts kebab-case/snake_case to PascalCase, stripping numeric prefixes.</summary>
    public static string PascalCase(string input)
    {
        // Strip leading numeric prefix: "01-getting-started" → "getting-started"
        var cleaned = Regex.Replace(input, @"^\d+-?", "");
        if (string.IsNullOrEmpty(cleaned)) return input;

        // Split on hyphens and underscores
        var words = cleaned.Split(['-', '_'], StringSplitOptions.RemoveEmptyEntries);
        return string.Join("", words.Select(w =>
            w.Length > 0 ? char.ToUpperInvariant(w[0]) + w[1..] : ""));
    }
}

// ============================================================
// Parser
// ============================================================

public record JourneyFile(string RelativePath, string FeatureTitle, string? Description, List<string> Tags, List<JourneyScenario> Scenarios);
public record JourneyScenario(string Title, List<JourneyStep> Steps);
public record JourneyStep(string Keyword, string Title, string? RequestName);

public static class HttpFileParser
{
    private static readonly Regex FeatureRegex = new(@"^#\s*Feature:\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex DescriptionRegex = new(@"^#\s*Description:\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex ScenarioRegex = new(@"^#\s*Scenario:\s*(.+)$", RegexOptions.Compiled);
    private static readonly Regex StepRegex = new(@"^#\s*(Given|When|Then|And|But)\s+(.+)$", RegexOptions.Compiled);
    private static readonly Regex NameRegex = new(@"^#\s*@name\s+(\S+)", RegexOptions.Compiled);
    private static readonly Regex TagRegex = new(@"^#\s*@tag\s+(\S+)", RegexOptions.Compiled);

    public static JourneyFile? Parse(string filePath, string baseDir)
    {
        var lines = File.ReadAllLines(filePath);
        string? featureTitle = null;
        string? description = null;
        var tags = new List<string>();
        var scenarios = new List<JourneyScenario>();

        JourneyScenario? currentScenario = null;
        JourneyStep? pendingStep = null;

        foreach (var line in lines)
        {
            var trimmed = line.Trim();

            var featureMatch = FeatureRegex.Match(trimmed);
            if (featureMatch.Success) { featureTitle = featureMatch.Groups[1].Value.Trim(); continue; }

            var descMatch = DescriptionRegex.Match(trimmed);
            if (descMatch.Success) { description = descMatch.Groups[1].Value.Trim(); continue; }

            var tagMatch = TagRegex.Match(trimmed);
            if (tagMatch.Success) { tags.Add(tagMatch.Groups[1].Value.Trim()); continue; }

            var scenarioMatch = ScenarioRegex.Match(trimmed);
            if (scenarioMatch.Success)
            {
                currentScenario = new JourneyScenario(scenarioMatch.Groups[1].Value.Trim(), []);
                scenarios.Add(currentScenario);
                continue;
            }

            var stepMatch = StepRegex.Match(trimmed);
            if (stepMatch.Success && currentScenario != null)
            {
                if (pendingStep != null) currentScenario.Steps.Add(pendingStep);
                pendingStep = new JourneyStep(stepMatch.Groups[1].Value, stepMatch.Groups[2].Value.Trim(), null);
                continue;
            }

            var nameMatch = NameRegex.Match(trimmed);
            if (nameMatch.Success && pendingStep != null)
            {
                pendingStep = pendingStep with { RequestName = nameMatch.Groups[1].Value.Trim() };
                currentScenario!.Steps.Add(pendingStep);
                pendingStep = null;
                continue;
            }
        }

        if (pendingStep != null && currentScenario != null)
            currentScenario.Steps.Add(pendingStep);

        if (featureTitle == null || scenarios.Count == 0)
            return null;

        return new JourneyFile(
            Path.GetRelativePath(baseDir, filePath).Replace('\\', '/'),
            featureTitle, description, tags, scenarios);
    }
}

// ============================================================
// Code Emitter
// ============================================================

public static class CodeEmitter
{
    public static string Emit(JourneyFile journey, HashSet<string> responseFiles, GeneratorOptions options)
    {
        var folderName = PathDeriver.DeriveJourneyFolder(journey.RelativePath);
        var className = PathDeriver.PascalCase(folderName.Split('/')[^1]) + "_Journey";
        var namespaceSuffix = PathDeriver.DeriveNamespaceSuffix(journey.RelativePath);
        var hasContracts = responseFiles.Count > 0;
        var isRealLlm = journey.Tags.Contains("real-llm", StringComparer.OrdinalIgnoreCase);
        var sb = new StringBuilder();

        var fullNamespace = string.IsNullOrEmpty(namespaceSuffix)
            ? options.BaseNamespace
            : $"{options.BaseNamespace}.{namespaceSuffix}";

        sb.AppendLine($"// Generated from {journey.RelativePath}");
        sb.AppendLine("// This file is developer-owned. The generator will not overwrite it.");
        sb.AppendLine("// Re-scaffold with: dotnet msbuild -t:Build");
        sb.AppendLine();
        sb.AppendLine("using SweDevTools.LiveDoc.xUnit;");
        sb.AppendLine("using SweDevTools.LiveDoc.xUnit.Journeys;");
        sb.AppendLine("using Xunit;");
        sb.AppendLine("using Xunit.Abstractions;");
        sb.AppendLine($"using {options.InfrastructureNamespace};");
        sb.AppendLine();
        sb.AppendLine($"namespace {fullNamespace};");
        sb.AppendLine();

        var descAttr = journey.Description != null
            ? $", Description = \"{Escape(journey.Description)}\""
            : "";
        sb.AppendLine($"[Feature(\"{Escape(journey.FeatureTitle)}\"{descAttr})]");
        if (isRealLlm)
            sb.AppendLine("[Trait(\"Category\", \"RealLLM\")]");
        sb.AppendLine($"public class {className} : FeatureTest, IClassFixture<{options.FixtureType}>");
        sb.AppendLine("{");
        sb.AppendLine($"    private readonly {options.FixtureType} _server;");
        if (hasContracts)
        {
            sb.AppendLine("    private readonly PropertyRules _propertyRules;");
        }
        sb.AppendLine();
        sb.AppendLine($"    public {className}(ITestOutputHelper output, {options.FixtureType} server) : base(output)");
        sb.AppendLine("    {");
        sb.AppendLine("        _server = server;");
        if (hasContracts)
        {
            // For real-llm journeys, merge global + folder-specific rules
            var journeyTopFolder = PathDeriver.DeriveJourneyFolder(journey.RelativePath).Split('/')[0];
            var folderRulesPath = $"Path.Combine(server.JourneysDir, \"{journeyTopFolder}\", \"property-rules.txt\")";
            if (isRealLlm || journeyTopFolder == "real")
            {
                sb.AppendLine("        _propertyRules = JsonAssertions.LoadPropertyRules(");
                sb.AppendLine("            Path.Combine(server.JourneysDir, \"property-rules.txt\"),");
                sb.AppendLine($"            {folderRulesPath});");
            }
            else
            {
                sb.AppendLine("        _propertyRules = JsonAssertions.LoadPropertyRules(");
                sb.AppendLine("            Path.Combine(server.JourneysDir, \"property-rules.txt\"));");
            }
        }
        sb.AppendLine("    }");

        foreach (var scenario in journey.Scenarios)
        {
            sb.AppendLine();
            EmitScenario(sb, journey, scenario, isRealLlm, responseFiles, options);
        }

        sb.AppendLine("}");
        return sb.ToString();
    }

    private static void EmitScenario(StringBuilder sb, JourneyFile journey, JourneyScenario scenario,
        bool isRealLlm, HashSet<string> responseFiles, GeneratorOptions options)
    {
        var methodName = Slugify(scenario.Title);
        var journeyFolder = PathDeriver.DeriveJourneyFolder(journey.RelativePath);

        sb.AppendLine($"    [Scenario(\"{Escape(scenario.Title)}\")]");
        sb.AppendLine($"    public async Task {methodName}()");
        sb.AppendLine("    {");

        if (isRealLlm)
        {
            sb.AppendLine($"        if (!{options.FixtureType}.HasAzureCredentials)");
            sb.AppendLine("        {");
            sb.AppendLine("            Given(\"Azure OpenAI credentials are not configured\", ctx => { });");
            sb.AppendLine("            Then(\"test is skipped — set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT\", ctx => { });");
            sb.AppendLine("            return;");
            sb.AppendLine("        }");
            sb.AppendLine();
        }

        sb.AppendLine($"        var run = await _server.RunJourneyAsync(\"{journey.RelativePath}\");");
        sb.AppendLine();

        foreach (var step in scenario.Steps)
        {
            var keyword = step.Keyword;
            var title = Escape(step.Title);
            var hasResponseFile = step.RequestName != null && responseFiles.Contains(step.RequestName);

            if (step.RequestName != null)
            {
                sb.AppendLine($"        {keyword}(\"{title}\", ctx =>");
                sb.AppendLine("        {");

                if (hasResponseFile)
                {
                    sb.AppendLine($"            run.AssertStep(\"{step.RequestName}\", step =>");
                    sb.AppendLine("            {");
                    sb.AppendLine($"                var expected = _server.LoadResponseFile(\"{journeyFolder}\", \"{step.RequestName}\");");
                    sb.AppendLine($"                Assert.False(string.IsNullOrWhiteSpace(step.ResponseBody),");
                    sb.AppendLine($"                    \"Step '{step.RequestName}' has a response contract but returned no body\");");
                    sb.AppendLine($"                JsonAssertions.IsComparable(step.ResponseBody, expected, _propertyRules, \"{step.RequestName}\");");
                    sb.AppendLine("            });");
                }
                else
                {
                    sb.AppendLine($"            run.AssertStep(\"{step.RequestName}\");");
                }

                sb.AppendLine("        });");
            }
            else
            {
                sb.AppendLine($"        {keyword}(\"{title}\", ctx => {{ }});");
            }
        }

        sb.AppendLine("    }");
    }

    private static string Slugify(string text)
    {
        var cleaned = Regex.Replace(text, @"[^a-zA-Z0-9\s]", "");
        var words = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join("", words.Select(w =>
            char.ToUpperInvariant(w[0]) + w[1..].ToLowerInvariant()));
    }

    private static string Escape(string text) =>
        text.Replace("\\", "\\\\").Replace("\"", "\\\"");
}

// ============================================================
// Capture Mode — Run .http files and save response bodies
// ============================================================

public static class CaptureMode
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*m", RegexOptions.Compiled);

    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine(
                "Usage: capture <journeysDir> [--var key=value ...] [--env <name>] [--overwrite]");
            return 1;
        }

        var journeysDir = Path.GetFullPath(args[0]);
        if (!Directory.Exists(journeysDir))
        {
            Console.Error.WriteLine($"Journeys directory not found: {journeysDir}");
            return 1;
        }

        var envName = "local";
        var overwrite = false;
        var vars = new List<string>();

        for (var i = 1; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--env" when i + 1 < args.Length:
                    envName = args[++i];
                    break;
                case "--overwrite":
                    overwrite = true;
                    break;
                default:
                    if (args[i].StartsWith("--var") && i + 1 < args.Length)
                        vars.Add(args[++i]);
                    else if (args[i].Contains('=') && !args[i].StartsWith("--"))
                        vars.Add(args[i]); // bare key=value
                    break;
            }
        }

        var httpFiles = Directory.GetFiles(journeysDir, "*.http", SearchOption.AllDirectories);
        if (httpFiles.Length == 0)
        {
            Console.WriteLine("No .http files found.");
            return 0;
        }

        Console.WriteLine($"Capture mode | Journeys: {journeysDir} | Env: {envName} | Overwrite: {overwrite}");

        var totalCaptured = 0;
        var totalSkipped = 0;
        var totalErrors = 0;

        foreach (var file in httpFiles)
        {
            var relativePath = Path.GetRelativePath(journeysDir, file).Replace('\\', '/');
            Console.WriteLine($"\n  Running: {relativePath}");

            var result = await HttpYacRunner.RunAsync(file, journeysDir, envName, vars);
            if (!result.Success)
            {
                Console.WriteLine($"    WARN: httpYac exited with errors (some steps may have failed)");
            }

            var journeyFolder = Path.GetDirectoryName(file)!;
            foreach (var (stepName, step) in result.Steps)
            {
                var body = step.ResponseBody;
                if (string.IsNullOrWhiteSpace(body)) continue;

                var trimmed = body.Trim();
                if (trimmed.Length == 0 || (trimmed[0] != '{' && trimmed[0] != '[')) continue;

                var outputPath = Path.Combine(journeyFolder, $"{stepName}.Response.json");
                if (File.Exists(outputPath) && !overwrite)
                {
                    totalSkipped++;
                    continue;
                }

                try
                {
                    var doc = JsonDocument.Parse(trimmed);
                    var formatted = JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(outputPath, formatted);
                    Console.WriteLine($"    CAPTURE {stepName}.Response.json");
                    totalCaptured++;
                }
                catch (JsonException)
                {
                    Console.WriteLine($"    SKIP {stepName} (invalid JSON)");
                    totalErrors++;
                }
            }
        }

        Console.WriteLine($"\nDone. Captured {totalCaptured}, skipped {totalSkipped} existing, {totalErrors} error(s).");
        return 0;
    }
}

// ============================================================
// httpYac CLI Runner
// ============================================================

public record CapturedStep(
    string Name,
    bool Passed,
    int? StatusCode,
    string Output,
    bool Reached)
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*m", RegexOptions.Compiled);

    /// <summary>
    /// Extracts the JSON response body from the httpyac output.
    /// The body sits between the response headers (blank line after last header)
    /// and the assertion lines ([x]/[-]).
    /// </summary>
    public string? ResponseBody => ExtractResponseBody();

    private string? ExtractResponseBody()
    {
        if (string.IsNullOrEmpty(Output)) return null;

        var lines = Output.Split('\n');
        bool pastHeaders = false;
        bool foundStatus = false;
        var bodyLines = new List<string>();
        bool inBody = false;

        foreach (var rawLine in lines)
        {
            var line = StripAnsi(rawLine).TrimEnd('\r');

            if (!foundStatus && line.TrimStart().StartsWith("HTTP/"))
            {
                foundStatus = true;
                continue;
            }

            if (!foundStatus) continue;

            if (!pastHeaders)
            {
                if (string.IsNullOrWhiteSpace(line))
                {
                    pastHeaders = true;
                    continue;
                }
                continue;
            }

            var trimmed = line.TrimStart();
            if (trimmed.StartsWith("[x]") || trimmed.StartsWith("[-]") ||
                trimmed.StartsWith("[ ]") || trimmed.StartsWith("[✗]") ||
                trimmed.StartsWith("[✓]"))
                break;

            if (Regex.IsMatch(trimmed, @"^\d+ requests processed"))
                break;

            if (!string.IsNullOrWhiteSpace(line))
                inBody = true;

            if (inBody)
                bodyLines.Add(line);
        }

        while (bodyLines.Count > 0 && string.IsNullOrWhiteSpace(bodyLines[^1]))
            bodyLines.RemoveAt(bodyLines.Count - 1);

        return bodyLines.Count > 0 ? string.Join("\n", bodyLines) : null;
    }

    private static string StripAnsi(string input) => AnsiEscapePattern.Replace(input, string.Empty);
}

public class CapturedJourneyResult
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*m", RegexOptions.Compiled);

    public bool Success { get; }
    public string Output { get; }
    public IReadOnlyDictionary<string, CapturedStep> Steps { get; }

    public CapturedJourneyResult(bool success, string output, Dictionary<string, CapturedStep> steps)
    {
        Success = success;
        Output = output;
        Steps = steps;
    }

    public static CapturedJourneyResult Parse(int exitCode, string output)
    {
        var steps = new Dictionary<string, CapturedStep>(StringComparer.OrdinalIgnoreCase);
        var lines = output.Split('\n');

        string? currentStep = null;
        int? currentStatus = null;
        bool hasFailedAssertion = false;
        var currentOutput = new List<string>();

        var stepHeaderPattern = new Regex(@"^===\s+(.+?)\s+===(?:\s.*)?$", RegexOptions.Compiled);
        var statusPattern = new Regex(@"HTTP/[\d.]+\s+(\d{3})\s", RegexOptions.Compiled);

        foreach (var rawLine in lines)
        {
            var line = StripAnsi(rawLine).TrimEnd('\r');

            var stepMatch = stepHeaderPattern.Match(line.Trim());
            if (stepMatch.Success)
            {
                if (currentStep != null)
                {
                    steps[currentStep] = new CapturedStep(
                        currentStep, !hasFailedAssertion, currentStatus,
                        string.Join("\n", currentOutput), true);
                }

                currentStep = NormalizeStepName(stepMatch.Groups[1].Value);
                currentStatus = null;
                hasFailedAssertion = false;
                currentOutput.Clear();
                continue;
            }

            if (currentStep == null) continue;

            currentOutput.Add(line);

            var statusMatch = statusPattern.Match(line);
            if (statusMatch.Success)
                currentStatus = int.Parse(statusMatch.Groups[1].Value);

            var trimmed = line.Trim();
            if (trimmed.StartsWith("[-]") || trimmed.StartsWith("[ ]") || trimmed.StartsWith("[✗]"))
                hasFailedAssertion = true;
        }

        if (currentStep != null)
        {
            steps[currentStep] = new CapturedStep(
                currentStep, !hasFailedAssertion, currentStatus,
                string.Join("\n", currentOutput), true);
        }

        return new CapturedJourneyResult(exitCode == 0, output, steps);
    }

    private static string StripAnsi(string input) => AnsiEscapePattern.Replace(input, string.Empty);

    private static string NormalizeStepName(string rawName)
    {
        var cleaned = StripAnsi(rawName).Trim();
        if (string.IsNullOrEmpty(cleaned)) return cleaned;
        var firstToken = cleaned.Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries)[0];
        return firstToken.Trim('"', '\'', '`');
    }
}

public static class HttpYacRunner
{
    public static async Task<CapturedJourneyResult> RunAsync(
        string httpFilePath, string workingDir, string env, List<string> vars)
    {
        var varArgs = string.Join(" ", vars.Select(v => $"--var {v}"));
        var isWindows = OperatingSystem.IsWindows();

        var psi = new ProcessStartInfo
        {
            FileName = isWindows ? "cmd.exe" : "npx",
            Arguments = isWindows
                ? $"/c npx httpyac send \"{httpFilePath}\" --all -e {env} {varArgs}"
                : $"httpyac send \"{httpFilePath}\" --all -e {env} {varArgs}",
            WorkingDirectory = workingDir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start httpyac");

        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        var fullOutput = stdout + (string.IsNullOrEmpty(stderr) ? "" : $"\n\nSTDERR:\n{stderr}");
        return CapturedJourneyResult.Parse(process.ExitCode, fullOutput);
    }
}
