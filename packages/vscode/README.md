# @livedoc/vscode

VS Code extension providing tools and snippets for working with LiveDoc BDD testing framework.

* [Features](#features)
* [Installation](#installation)
* [Using](#using)
* [Development](#development)
* [Configuration](#configuration)

![Demo](https://raw.githubusercontent.com/dotnetprofessional/LiveDoc/master/packages/livedoc-vscode/images/demo.gif)

## Features

* Formatting of Scenario Outline tables and Data Tables with styling
* Code snippets for BDD constructs
* Activity bar explorer for test results

### Code Snippets

| Snippet | Purpose |
|---------|---------|
| `ld-feature` | Adds a basic feature definition |
| `ld-background` | Adds a basic background definition |
| `ld-scenario` | Adds a basic scenario definition |
| `ld-scenario-outline` | Adds a basic scenario outline definition |
| `ld-given` | Adds a basic given step definition |
| `ld-when` | Adds a basic when step definition |
| `ld-then` | Adds a basic then step definition |
| `ld-and` | Adds a basic and step definition |
| `ld-but` | Adds a basic but step definition |
| `ld-step` | Adds a step definition where you can choose the type |
| `ld-step-datatable` | Adds a step with a 2x1 data table |
| `ld-step-datatable-4x` | Adds a step with a 4x1 data table |
| `ld-step-docString` | Adds a step with a docString |

### Commands

- `LiveDoc: Format Data Tables` - Formats all data tables in the active document
- `LiveDoc: Reporter` - Opens the LiveDoc test results viewer

## Installation

### From VS Code Marketplace

Search for "livedoc" in the VS Code Extensions view.

### From VSIX (Local Build)

```bash
# Build the extension
cd packages/vscode
pnpm install
pnpm run package

# Install the generated .vsix file
code --install-extension livedoc-0.0.1.vsix
```

## Using

This extension works with the [@livedoc/vitest](../vitest/README.md) testing library.

### Setup Your Project

```bash
npm install @livedoc/vitest vitest --save-dev
```

### Write BDD Tests

Use the snippets to quickly scaffold your tests:

1. Type `ld-feature` and press Tab
2. Fill in your feature description
3. Use `ld-scenario` for each test scenario
4. Add steps with `ld-given`, `ld-when`, `ld-then`

### Example Test

```typescript
import { feature, scenario, given, when, then } from "@livedoc/vitest";
import { expect } from "vitest";

feature(`User Authentication
    As a user
    I want to log in to the system
    So that I can access my account
`, () => {
    scenario("Successful login with valid credentials", () => {
        given("I am on the login page", () => {
            // Navigate to login page
        });

        when("I enter valid credentials", () => {
            // Enter username and password
        });

        then("I should be logged in successfully", () => {
            expect(isLoggedIn).toBe(true);
        });
    });
});
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+
- VS Code

### Running Locally

1. **Clone the repository and install dependencies:**

   ```bash
   git clone https://github.com/dotnetprofessional/LiveDoc.git
   cd LiveDoc
   pnpm install
   ```

2. **Navigate to the VS Code extension:**

   ```bash
   cd packages/vscode
   ```

3. **Build the extension:**

   ```bash
   pnpm run compile
   ```

4. **Launch in VS Code:**

   **Option A: Using VS Code's Extension Host (Recommended)**
   
   - Open the `packages/vscode` folder in VS Code
   - Press `F5` to launch the Extension Development Host
   - A new VS Code window will open with the extension loaded
   
   **Option B: Using the Watch Mode**
   
   ```bash
   # Start the TypeScript watcher
   pnpm run watch
   
   # Then press F5 in VS Code to launch
   ```

5. **Testing changes:**
   
   - Make changes to the extension source code
   - The watch task will automatically recompile
   - Press `Ctrl+R` (or `Cmd+R` on Mac) in the Extension Development Host to reload

### Project Structure

```
packages/vscode/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── ExecutionResultOutline/   # Test results tree view
│   ├── reporter/                 # WebView reporter components
│   └── tableFormatter/           # Data table formatting
├── snippets/
│   └── livedoc.json              # Code snippet definitions
├── images/                       # Icons and images
├── .vscode/
│   ├── launch.json               # Debug configurations
│   └── tasks.json                # Build tasks
├── package.json                  # Extension manifest
└── tsconfig.json                 # TypeScript configuration
```

### Debugging

1. Set breakpoints in your TypeScript code
2. Press `F5` to start debugging
3. The Extension Development Host will launch
4. Trigger your extension features to hit breakpoints

### Running Tests

```bash
pnpm test
```

### Packaging for Distribution

```bash
# Create a .vsix package
pnpm run package

# This generates: livedoc-{version}.vsix
```

## Configuration

*Configuration options coming soon.*

## Related Packages

- [@livedoc/vitest](../vitest/README.md) - The main BDD testing framework for Vitest
- [@livedoc/viewer](../viewer/README.md) - Web-based test results viewer

## Contributing

See the main [LiveDoc repository](https://github.com/dotnetprofessional/LiveDoc) for contribution guidelines.

## License

MIT