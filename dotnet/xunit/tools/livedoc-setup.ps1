<#
.SYNOPSIS
    LiveDoc AI Skill Installer — install AI coding skills for your team.
.PARAMETER Tool
    Skip the menu and install for a specific tool (or 'all').
    Valid values: copilot, claude, roo, cursor, windsurf, all
#>
param(
    [string]$Tool
)

# If interactive (no -Tool) and stdin is redirected (e.g. MSBuild Exec),
# relaunch in a proper console window so Read-Host works.
if (-not $Tool -and [Console]::IsInputRedirected) {
    $proc = Start-Process powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File",$MyInvocation.MyCommand.Path -Wait -PassThru
    exit $proc.ExitCode
}

# Resolve paths relative to this script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillsSource = Join-Path $scriptDir "skills"

if (-not (Test-Path (Join-Path $skillsSource "SKILL.md"))) {
    Write-Host "  Error: Could not find skill files at $skillsSource" -ForegroundColor Red
    exit 1
}

# Find git root
$gitRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $gitRoot) { $gitRoot = Get-Location }

$tools = [ordered]@{
    "1" = @{ Key = "copilot";  Name = "GitHub Copilot"; Dest = ".github/skills/livedoc-xunit" }
    "2" = @{ Key = "claude";   Name = "Claude Code";    Dest = ".claude/skills/livedoc-xunit" }
    "3" = @{ Key = "roo";      Name = "Roo Code";       Dest = ".roo/skills/livedoc-xunit" }
    "4" = @{ Key = "cursor";   Name = "Cursor";         Dest = ".cursor/rules/livedoc-xunit" }
    "5" = @{ Key = "windsurf"; Name = "Windsurf";       Dest = ".windsurf/rules/livedoc-xunit" }
}

# Non-interactive mode (CI)
if ($Tool) {
    $Tool = $Tool.ToLower()
    if ($Tool -eq "all") {
        $selected = $tools.Keys
    } else {
        $match = $null
        foreach ($k in $tools.Keys) {
            if ($tools[$k].Key -eq $Tool) { $match = $k; break }
        }
        if (-not $match) {
            Write-Host "  Unknown tool: $Tool. Use: copilot, claude, roo, cursor, windsurf, all" -ForegroundColor Red
            exit 1
        }
        $selected = @($match)
    }
} else {
    # Interactive menu
    Write-Host ""
    Write-Host "  LiveDoc AI Skill Installer" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Select AI tool(s) to install skills for:"
    Write-Host ""
    foreach ($key in $tools.Keys) {
        Write-Host "    $key. $($tools[$key].Name)"
    }
    Write-Host "    A. All of the above"
    Write-Host ""
    $choice = Read-Host "  Choice [A]"
    if (-not $choice) { $choice = "A" }

    if ($choice -eq "A" -or $choice -eq "a") {
        $selected = $tools.Keys
    } elseif ($tools.Contains($choice)) {
        $selected = @($choice)
    } else {
        Write-Host "  Invalid choice: $choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

$normalizedSource = (Resolve-Path $skillsSource).Path.TrimEnd('\', '/')
$sourceFiles = Get-ChildItem $normalizedSource -Recurse -File

foreach ($key in $selected) {
    $entry = $tools[$key]
    $dest = Join-Path $gitRoot $entry.Dest

    foreach ($file in $sourceFiles) {
        $relativePath = $file.FullName.Substring($normalizedSource.Length + 1)
        $targetPath = Join-Path $dest $relativePath
        $targetDir = Split-Path $targetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item $file.FullName $targetPath -Force
    }

    Write-Host "  ✓ $($entry.Name) → $dest" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Done! Commit the generated files to share with your team." -ForegroundColor Cyan
Write-Host ""
