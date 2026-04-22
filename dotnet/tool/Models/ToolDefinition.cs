namespace SweDevTools.LiveDoc.Tool.Models;

/// <summary>
/// Defines an AI coding tool and its skill/rule directory conventions.
/// </summary>
public record ToolDefinition(
    string Name,
    string CliKey,
    string ProjectSkillPath,
    string? UserSkillPath)
{
    /// <summary>
    /// All supported AI coding tools and their skill directory locations.
    /// </summary>
    public static readonly IReadOnlyList<ToolDefinition> All =
    [
        new("GitHub Copilot (VS Code / CLI)", "copilot",
            ".github/skills/livedoc-xunit",
            ".copilot/skills/livedoc-xunit"),

        new("Claude Code", "claude",
            ".claude/skills/livedoc-xunit",
            ".claude/skills/livedoc-xunit"),

        new("Roo Code", "roo",
            ".roo/skills/livedoc-xunit",
            ".roo/skills/livedoc-xunit"),

        new("Cursor", "cursor",
            ".cursor/rules/livedoc-xunit",
            null),

        new("Windsurf", "windsurf",
            ".windsurf/rules/livedoc-xunit",
            null),
    ];
}
