# VS Code Legacy Reporter Webview (Archived)

- **Archived:** 2025-12-12
- **Reason:** Unified UI stack for right-side views.
- **Replaced by:** The embedded Viewer panel (`livedoc.openViewer` / `livedoc.viewItem`) which reuses the shared Viewer webview bundle.

## Contents

This archive contains the previous VS Code-only Reporter webview implementation:

- `packages/vscode/src/reporter/` (React app + webview host)
- `packages/vscode/build-reporter.js` (esbuild bundling script)
- `packages/vscode/src/resources/{css,js,fontawesome}` (Bootstrap + FontAwesome assets)

## Deletion

Once the replacement is verified in real usage, this archive may be deleted.
