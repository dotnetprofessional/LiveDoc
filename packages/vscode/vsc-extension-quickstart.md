# livedoc-vscode Extension - Developer Guide

This document provides a quickstart guide for developing the LiveDoc VS Code extension.

## Project Structure

```
packages/vscode/
 package.json          # Extension manifest (commands, snippets, activation)
 src/
    extension.ts      # Main extension entry point
 snippets/
    livedoc.json      # BDD code snippets for LiveDoc
 images/
    icon.png          # Extension icon
 out/                  # Compiled JavaScript (generated)
 .vscode/
     launch.json       # Debug configurations (when opened standalone)
     tasks.json        # Build tasks
```

## Getting Started

### From the Monorepo Root (Recommended)

1. **Install dependencies** (if not already done):
   ```bash
   pnpm install
   ```

2. **Debug the extension** - Press `F5` and select:
   - ** VS Code Extension: Launch** - Opens Extension Development Host
   - ** VS Code Extension: Tests** - Runs extension tests

3. **Compile manually**:
   ```bash
   pnpm --filter livedoc-vscode run compile
   ```

### From the Extension Folder Directly

1. Open `packages/vscode` folder in VS Code
2. Run `pnpm install`
3. Press `F5` to launch the Extension Development Host

## Available Debug Configurations

| Configuration | Description |
|--------------|-------------|
|  VS Code Extension: Launch | Launch extension in new VS Code window |
|  VS Code Extension: Tests | Run extension unit tests |

## Key Features

### Snippets
The extension provides BDD snippets for LiveDoc testing:
- `feature` - Create a Feature block
- `scenario` - Create a Scenario block  
- `given`, `when`, `then` - Create step blocks
- `and`, `but` - Create continuation steps

### Commands
- View the `contributes.commands` section in `package.json` for available commands

## Making Changes

1. Edit source files in `src/`
2. The extension auto-compiles if `watch` task is running
3. Press `Ctrl+R` (or `Cmd+R` on Mac) in the Extension Development Host to reload
4. Or restart debugging with `Ctrl+Shift+F5`

## Exploring the VS Code API

- Open `node_modules/@types/vscode/index.d.ts` for full API documentation
- See [VS Code Extension API](https://code.visualstudio.com/api) for official docs

## Running Tests

1. From debug menu, select ** VS Code Extension: Tests**
2. Press `F5` to run tests in Extension Development Host
3. View results in the Debug Console
4. Test files are in `src/test/` matching `*.test.ts`

## Packaging for Distribution

```bash
cd packages/vscode
pnpm run package    # Creates .vsix file
```

To install the packaged extension:
```bash
code --install-extension livedoc-0.0.1.vsix
```

## Related Packages

- [@swedevtools/livedoc-vitest](../vitest/) - Core BDD testing framework
- [@swedevtools/livedoc-viewer](../viewer/) - Test results visualization
