using System.CommandLine;
using System.Reflection;
using Spectre.Console;
using SweDevTools.LiveDoc.Tool.Models;

namespace SweDevTools.LiveDoc.Tool.Commands;

public static class InstallSkillCommand
{
    private const string SentinelFileName = ".livedoc-skill-installed";

    // Embedded resource paths (relative to assembly namespace)
    private static readonly string[] SkillFiles =
    [
        "SKILL.md",
        "VALIDATION.md",
        "examples/routing.md",
    ];

    public static Command Create()
    {
        var toolOption = new Option<string[]?>(
            "--tool",
            "AI tool(s) to install for: copilot, claude, roo, cursor, windsurf")
        {
            AllowMultipleArgumentsPerToken = true,
        };

        var scopeOption = new Option<string?>(
            "--scope",
            "Installation scope: project or user");

        var allOption = new Option<bool>(
            "--all",
            "Install for all supported AI tools at project level");

        var command = new Command("install-skill", "Install LiveDoc AI coding skill for your development tools")
        {
            toolOption,
            scopeOption,
            allOption,
        };

        command.SetHandler(async (string[]? tools, string? scope, bool all) =>
        {
            await RunAsync(tools, scope, all);
        }, toolOption, scopeOption, allOption);

        return command;
    }

    private static async Task RunAsync(string[]? toolKeys, string? scope, bool all)
    {
        AnsiConsole.MarkupLine("[bold blue]🛠️  LiveDoc Skill Installer[/]");
        AnsiConsole.WriteLine();

        // Resolve selected tools
        List<ToolDefinition> selectedTools;

        if (all)
        {
            selectedTools = ToolDefinition.All.ToList();
            scope ??= "project";
        }
        else if (toolKeys is { Length: > 0 })
        {
            selectedTools = ResolveToolsByKey(toolKeys);
            if (selectedTools.Count == 0) return;
        }
        else
        {
            // Interactive multi-select
            selectedTools = AnsiConsole.Prompt(
                new MultiSelectionPrompt<ToolDefinition>()
                    .Title("Which [green]AI coding tool(s)[/] do you use?")
                    .PageSize(10)
                    .InstructionsText("[grey](Press [blue]<space>[/] to toggle, [green]<enter>[/] to accept)[/]")
                    .UseConverter(t => t.Name)
                    .AddChoices(ToolDefinition.All));

            if (selectedTools.Count == 0)
            {
                AnsiConsole.MarkupLine("[yellow]No tools selected. Nothing to install.[/]");
                return;
            }
        }

        // Resolve scope
        bool hasUserSupport = selectedTools.Any(t => t.UserSkillPath is not null);
        bool projectScope;

        if (scope is not null)
        {
            projectScope = scope.Equals("project", StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            // Interactive
            var scopeChoice = AnsiConsole.Prompt(
                new SelectionPrompt<string>()
                    .Title("Where should the skill be installed?")
                    .AddChoices(GetScopeChoices(hasUserSupport)));

            projectScope = scopeChoice.Contains("Project");
        }

        // Resolve root paths
        string? gitRoot = projectScope ? FindGitRoot(Directory.GetCurrentDirectory()) : null;
        string userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

        if (projectScope && gitRoot is null)
        {
            AnsiConsole.MarkupLine("[red]Error:[/] Could not find a git repository root. Run this command from within a git repository.");
            return;
        }

        // Install for each selected tool
        int installed = 0;
        foreach (var tool in selectedTools)
        {
            string targetDir;

            if (projectScope)
            {
                targetDir = Path.Combine(gitRoot!, tool.ProjectSkillPath.Replace('/', Path.DirectorySeparatorChar));
            }
            else
            {
                if (tool.UserSkillPath is null)
                {
                    AnsiConsole.MarkupLine($"[yellow]⚠ {tool.Name}[/] does not support user-level skill installation. Skipping.");
                    continue;
                }
                targetDir = Path.Combine(userHome, tool.UserSkillPath.Replace('/', Path.DirectorySeparatorChar));
            }

            if (Directory.Exists(targetDir) && Directory.GetFiles(targetDir, "*", SearchOption.AllDirectories).Length > 0)
            {
                bool overwrite;
                if (scope is not null || all)
                {
                    // Non-interactive: overwrite silently
                    overwrite = true;
                }
                else
                {
                    overwrite = AnsiConsole.Confirm($"[yellow]{tool.Name}[/] skill already exists at [grey]{targetDir}[/]. Overwrite?", defaultValue: true);
                }

                if (!overwrite)
                {
                    AnsiConsole.MarkupLine($"  [grey]Skipped {tool.Name}[/]");
                    continue;
                }
            }

            CopySkillFiles(targetDir);
            AnsiConsole.MarkupLine($"  [green]✓[/] {tool.Name} → [grey]{targetDir}[/]");
            installed++;
        }

        // Create sentinel file
        if (projectScope && gitRoot is not null)
        {
            var sentinelPath = Path.Combine(gitRoot, SentinelFileName);
            if (!File.Exists(sentinelPath))
            {
                await File.WriteAllTextAsync(sentinelPath,
                    $"# LiveDoc skill installed on {DateTime.UtcNow:O}\n# This file suppresses the build reminder. Safe to commit.\n");
            }
        }

        AnsiConsole.WriteLine();
        if (installed > 0)
        {
            AnsiConsole.MarkupLine($"[bold green]Done![/] Installed skill for [bold]{installed}[/] tool(s).");
            if (projectScope)
            {
                AnsiConsole.MarkupLine("[grey]Tip: Commit the skill files to share with your team.[/]");
            }
        }
        else
        {
            AnsiConsole.MarkupLine("[yellow]No skills were installed.[/]");
        }
    }

    private static List<ToolDefinition> ResolveToolsByKey(string[] keys)
    {
        var result = new List<ToolDefinition>();
        foreach (var key in keys)
        {
            var tool = ToolDefinition.All.FirstOrDefault(t =>
                t.CliKey.Equals(key, StringComparison.OrdinalIgnoreCase));

            if (tool is null)
            {
                AnsiConsole.MarkupLine($"[red]Error:[/] Unknown tool '{key}'. Valid options: {string.Join(", ", ToolDefinition.All.Select(t => t.CliKey))}");
                return [];
            }
            result.Add(tool);
        }
        return result;
    }

    private static string[] GetScopeChoices(bool hasUserSupport)
    {
        var choices = new List<string> { "Project (shared with team via git)" };
        if (hasUserSupport)
        {
            choices.Add("User (personal, all repos)");
        }
        return choices.ToArray();
    }

    private static string? FindGitRoot(string startDir)
    {
        var dir = new DirectoryInfo(startDir);
        while (dir is not null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, ".git")))
                return dir.FullName;
            dir = dir.Parent;
        }
        return null;
    }

    private static void CopySkillFiles(string targetDir)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourcePrefix = "SweDevTools.LiveDoc.Tool.Skills.livedoc_xunit.";

        foreach (var skillFile in SkillFiles)
        {
            var resourceName = resourcePrefix + skillFile.Replace('/', '.');
            using var stream = assembly.GetManifestResourceStream(resourceName);

            if (stream is null)
            {
                AnsiConsole.MarkupLine($"  [yellow]⚠ Could not find embedded resource for {skillFile}[/]");
                continue;
            }

            WriteStreamToFile(stream, targetDir, skillFile);
        }
    }

    private static void WriteStreamToFile(Stream stream, string targetDir, string relativePath)
    {
        var targetPath = Path.Combine(targetDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var dir = Path.GetDirectoryName(targetPath)!;
        Directory.CreateDirectory(dir);

        using var fileStream = File.Create(targetPath);
        stream.CopyTo(fileStream);
    }
}
