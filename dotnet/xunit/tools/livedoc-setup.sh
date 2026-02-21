#!/usr/bin/env bash
# LiveDoc AI Skill Installer — install AI coding skills for your team.
# Usage: livedoc-setup.sh [--tool copilot|claude|roo|cursor|windsurf|all]

set -euo pipefail

# Resolve paths relative to this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SOURCE="$SCRIPT_DIR/skills"

if [ ! -f "$SKILLS_SOURCE/SKILL.md" ]; then
    echo "  Error: Could not find skill files at $SKILLS_SOURCE" >&2
    exit 1
fi

# Find git root
GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Tool definitions: key|name|dest
TOOLS=(
    "copilot|GitHub Copilot|.github/skills/livedoc-xunit"
    "claude|Claude Code|.claude/skills/livedoc-xunit"
    "roo|Roo Code|.roo/skills/livedoc-xunit"
    "cursor|Cursor|.cursor/rules/livedoc-xunit"
    "windsurf|Windsurf|.windsurf/rules/livedoc-xunit"
)

# Parse --tool argument
TOOL_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --tool) TOOL_ARG="$2"; shift 2 ;;
        *) shift ;;
    esac
done

if [ -n "$TOOL_ARG" ]; then
    # Non-interactive mode (CI)
    TOOL_ARG="$(echo "$TOOL_ARG" | tr '[:upper:]' '[:lower:]')"
    if [ "$TOOL_ARG" = "all" ]; then
        selected=("${!TOOLS[@]}")
    else
        found=false
        for i in "${!TOOLS[@]}"; do
            key="${TOOLS[$i]%%|*}"
            if [ "$key" = "$TOOL_ARG" ]; then
                selected=("$i")
                found=true
                break
            fi
        done
        if [ "$found" = false ]; then
            echo "  Unknown tool: $TOOL_ARG. Use: copilot, claude, roo, cursor, windsurf, all" >&2
            exit 1
        fi
    fi
else
    # Interactive menu
    echo ""
    echo "  LiveDoc AI Skill Installer"
    echo ""
    echo "  Select AI tool(s) to install skills for:"
    echo ""
    for i in "${!TOOLS[@]}"; do
        IFS='|' read -r _ name _ <<< "${TOOLS[$i]}"
        echo "    $((i+1)). $name"
    done
    echo "    A. All of the above"
    echo ""
    printf "  Choice [A]: "
    # Reconnect stdin to terminal if redirected (e.g. running under MSBuild)
    if [ ! -t 0 ] && [ -e /dev/tty ]; then
        read -r choice < /dev/tty
    else
        read -r choice
    fi
    [ -z "$choice" ] && choice="A"

    if [[ "$choice" =~ ^[Aa]$ ]]; then
        selected=("${!TOOLS[@]}")
    elif [[ "$choice" =~ ^[1-5]$ ]]; then
        selected=("$((choice-1))")
    else
        echo "  Invalid choice: $choice" >&2
        exit 1
    fi
fi

echo ""

for idx in "${selected[@]}"; do
    IFS='|' read -r _ name dest <<< "${TOOLS[$idx]}"
    target="$GIT_ROOT/$dest"
    mkdir -p "$target"
    cp -R "$SKILLS_SOURCE"/. "$target"/
    echo "  ✓ $name → $target"
done

echo ""
echo "  Done! Commit the generated files to share with your team."
echo ""
