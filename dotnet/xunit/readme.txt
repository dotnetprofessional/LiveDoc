╔══════════════════════════════════════════════════════════════════╗
║                  SweDevTools.LiveDoc.xUnit                      ║
║              AI-Powered Test Authoring Skills                   ║
╚══════════════════════════════════════════════════════════════════╝

LiveDoc includes AI skills that help your coding assistant (Copilot,
Claude Code, Cursor, Windsurf, Roo Code) write better BDD and
Specification tests — with correct patterns, value extraction, and
living documentation best practices.

QUICK SETUP (one-time)
──────────────────────

1. Add a local tool manifest (skip if you already have one):

     dotnet new tool-manifest

2. Install the LiveDoc CLI tool:

     dotnet tool install SweDevTools.LiveDoc.Tool

3. Install the AI skill for your coding tool:

     dotnet livedoc install-skill

   This will ask which AI tool(s) you use and where to install.

NON-INTERACTIVE (CI / scripts)
──────────────────────────────

     dotnet livedoc install-skill --tool copilot --scope project
     dotnet livedoc install-skill --all

For more information:
  https://github.com/dotnetprofessional/LiveDoc
