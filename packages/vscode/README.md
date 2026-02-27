# livedoc-vscode

VS Code extension providing tools and snippets for working with the LiveDoc BDD testing framework.

📖 **[Full Documentation →](http://livedoc.swedevtools.com/docs/vscode/overview)**

## Features

- **Data Table Formatting** — Auto-format Scenario Outline and Data Tables with alignment
- **Code Snippets** — Quickly scaffold BDD constructs
- **Activity Bar Explorer** — Browse test results in the sidebar
- **Integrated Viewer** — Open the LiveDoc Viewer directly in VS Code

### Code Snippets

| Snippet                | Purpose                                              |
| ---------              | ---------                                            |
| `ld-feature`           | Adds a basic feature definition                      |
| `ld-background`        | Adds a basic background definition                   |
| `ld-scenario`          | Adds a basic scenario definition                     |
| `ld-scenario-outline`  | Adds a basic scenario outline definition             |
| `ld-given`             | Adds a basic given step definition                   |
| `ld-when`              | Adds a basic when step definition                    |
| `ld-then`              | Adds a basic then step definition                    |
| `ld-and`               | Adds a basic and step definition                     |
| `ld-but`               | Adds a basic but step definition                     |
| `ld-step`              | Adds a step definition where you can choose the type |
| `ld-step-datatable`    | Adds a step with a 2x1 data table                    |
| `ld-step-datatable-4x` | Adds a step with a 4x1 data table                    |
| `ld-step-docString`    | Adds a step with a docString                         |

### Commands

- `LiveDoc: Format Data Tables` — Formats all data tables in the active document
- `LiveDoc: Open Viewer` — Opens the LiveDoc Viewer (shared UI webview)

## Installation

### From VS Code Marketplace

Search for "livedoc" in the VS Code Extensions view (`Ctrl+Shift+X`).

### From VSIX (Local Build)

```bash
cd packages/vscode
pnpm install && pnpm run package
code --install-extension livedoc-0.0.1.vsix
```

## Documentation

📖 **[Full documentation at livedoc.swedevtools.com →](http://livedoc.swedevtools.com/docs/vscode/overview)**

Covers features, usage workflow, development setup, debugging, project structure, and packaging.

## License

MIT