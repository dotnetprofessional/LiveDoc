╔══════════════════════════════════════════════════════════════════╗
║                  SweDevTools.LiveDoc.xUnit                      ║
║              AI-Powered Test Authoring Skills                   ║
╚══════════════════════════════════════════════════════════════════╝

LiveDoc includes AI skills that teach Copilot, Claude, Cursor and
other AI tools how to write great BDD and Specification tests.

SETUP — one command from your project directory:

    dotnet msbuild -t:LiveDoc

You'll see a menu to choose your AI tool(s):

    1. GitHub Copilot
    2. Claude Code
    3. Roo Code
    4. Cursor
    5. Windsurf
    A. All of the above

CI / non-interactive:

    dotnet msbuild -t:LiveDoc -p:LiveDocTool=copilot
    dotnet msbuild -t:LiveDoc -p:LiveDocTool=all

Commit the generated files to share with your team.

For more information:
  https://github.com/dotnetprofessional/LiveDoc
