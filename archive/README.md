# Repo Archive

This folder is intentionally committed.

## Purpose

During migrations/refactors we temporarily preserve deprecated implementations here (instead of deleting them immediately) so we:

- don’t accidentally lose behavior that might still be needed for reference
- can compare old vs new behavior during rollout
- can restore code quickly if we discover missing edge cases

## Policy

- When replacing any legacy UI/feature, move the old code into `./archive/` from the repo root.
- Archived code must not be referenced by production entrypoints (extension activation paths, server start paths, published webview bundles).
- Once the replacement is verified, the archived code may be deleted.

## Suggested structure

- `archive/vscode-reporter-webview/`
- `archive/viewer-legacy/`
- `archive/server-legacy/`
