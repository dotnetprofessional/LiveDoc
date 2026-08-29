---
name: "project-conventions"
description: "Core conventions and patterns for this codebase"
domain: "project-conventions"
confidence: "medium"
source: "template"
---

## Context

> **This is a starter template.** Replace the placeholder patterns below with your actual project conventions. Skills train agents on codebase-specific practices — accurate documentation here improves agent output quality.

## Patterns

### UI Controls

For `packages/viewer` and `packages/vscode`, use shadcn/ui-style components backed by Radix primitives for common controls before building custom UI behavior.

- Use existing local wrappers in `packages/viewer/src/client/components/ui/` for buttons, dialogs, dropdowns, tabs, progress, cards, badges, separators, and similar primitives.
- If a matching shadcn component exists but is missing locally, add the wrapper following the shadcn pattern instead of hand-rolling spans/divs with ARIA.
- If no shadcn/Radix primitive fits a bespoke surface, use native semantic elements first (`button`, `a`, `input`) and document why a custom implementation is necessary.
- Do not hand-roll checkboxes, switches, tabs, menus, dialogs, buttons, selects, sliders, or inputs when a shadcn/Radix component exists. This keeps styling, keyboard behavior, focus rings, disabled states, and accessibility consistent.
- Raw Radix primitives are acceptable for specialized layouts only when the shadcn wrapper is too opinionated; follow the existing attachment viewer decision pattern and record the rationale.

### Error Handling

<!-- Example: How does your project handle errors? -->
<!-- - Use try/catch with specific error types? -->
<!-- - Log to a specific service? -->
<!-- - Return error objects vs throwing? -->

### Testing

<!-- Example: What test framework? Where do tests live? How to run them? -->
<!-- - Test framework: Jest/Vitest/node:test/etc. -->
<!-- - Test location: test/, __tests__/, *.test.ts, etc. -->
<!-- - Run command: npm test, etc. -->

### Code Style

<!-- Example: Linting, formatting, naming conventions -->
<!-- - Linter: ESLint config? -->
<!-- - Formatter: Prettier? -->
<!-- - Naming: camelCase, snake_case, etc.? -->

### File Structure

<!-- Example: How is the project organized? -->
<!-- - src/ — Source code -->
<!-- - test/ — Tests -->
<!-- - docs/ — Documentation -->

## Examples

```
// Add code examples that demonstrate your conventions
```

## Anti-Patterns

- **Hand-rolled common controls** — Avoid custom `span`/`div` controls for standard UI primitives such as checkboxes, switches, buttons, dialogs, dropdowns, tabs, inputs, and selects. Use or add the shadcn/Radix wrapper instead to reduce visual drift and interaction bugs.
