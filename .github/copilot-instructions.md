# LiveDoc Project - Copilot Instructions

## Project Overview

LiveDoc is a modern living documentation framework that generates documentation from executable specifications. It is a monorepo managed with pnpm workspaces.

### Key Packages
- **`packages/vitest`**: Core testing framework and Gherkin/Spec parser (`@livedoc/vitest`).
- **`packages/viewer`**: Real-time test result visualizer (`@livedoc/viewer`).
- **`packages/vscode`**: VS Code extension for LiveDoc (`@livedoc/vscode`).
- **`dotnet/xunit`**: .NET integration (separate solution).

## Technology Stack

- **Language**: TypeScript
- **Testing**: Vitest
- **UI Framework**: React 19
- **State Management**: Zustand
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui

## Core Development Principles

### 1. Legacy Reference & Feature Parity (CRITICAL)
**Applies to:** `packages/vitest` (Core Logic)

Although the migration is technically "complete", the **Mocha implementation (`_archive/livedoc-mocha`) remains the authoritative reference** for expected behavior.

- **When in doubt, check Mocha**: If a feature's behavior is unclear, check how it was implemented in `_archive/livedoc-mocha/_src/app`.
- **Feature Parity**: The Vitest version must match Mocha's behavior unless explicitly decided otherwise.
- **Code Preservation**: Retain original logic where possible to minimize regression risks.

### 2. UI Development (Professional & Polished)
**Applies to:** `packages/viewer` and `packages/vscode` (Webviews)

We aim for a **professional, polished, and delightful user experience**.

- **Component Library**: Use **shadcn/ui** for all UI components.
  - Do not reinvent common components (buttons, dialogs, inputs, etc.).
  - If a component is missing, implement it following the shadcn/ui pattern (headless primitives + Tailwind).
- **State Management**: Use **Zustand** for global state.
- **Design Philosophy**:
  - **Clean & Minimal**: Avoid clutter. Use whitespace effectively.
  - **Responsive**: Ensure layouts work on different screen sizes.
  - **Accessible**: Follow WAI-ARIA guidelines.
  - **Delightful**: Add subtle animations and transitions where appropriate (using `framer-motion` or CSS transitions).

### 3. Testing & Specifications
**Applies to:** All tests in `packages/vitest`, `packages/viewer`, etc.

**Strictly follow the guidelines in `.github/instructions/spec-files.instructions.md`.**

- **File Naming**: Must end in `.Spec.ts` (e.g., `UserLogin.Spec.ts`).
- **Patterns**:
  - Use **BDD** (`feature`, `scenario`) for high-level/acceptance tests.
  - Use **Specification** (`specification`, `rule`) for unit/component tests.
- **Self-Documenting Steps**:
  - **CRITICAL**: Embed all inputs and expected outputs directly in the step titles.
  - Do NOT hide test data inside the step implementation.
  - Use the `ctx.step.values` or `ctx.step.table` APIs to extract data.

```typescript
// ✅ CORRECT
given("the user has '5' items in cart", (ctx) => { ... });

// ❌ INCORRECT
given("the user has items", (ctx) => { const items = 5; ... });
```

### 4. Code Quality & Architecture
- **TypeScript**: Use strict typing. Avoid `any`.
- **Monorepo**: Respect package boundaries. Use workspace protocols (`workspace:*`) for internal dependencies.
- **Modern Standards**: Use ES modules, async/await, and modern React patterns (Hooks, Context).

## Common Tasks & Commands

### Build & Run
- **Root**: `pnpm install`, `pnpm build`
- **Viewer**: `pnpm --filter @livedoc/viewer dev`
- **Vitest Package**: `pnpm --filter @livedoc/vitest test`
- **VS Code**: `pnpm --filter @livedoc/vscode compile`

### Adding UI Components
When asked to create a UI feature:
1. Check if a relevant **shadcn/ui** component exists.
2. If yes, use it (or instruct the user to install it if missing).
3. Style it to match the "Professional & Polished" aesthetic.
4. Ensure it is fully typed.

## Reference Documentation
- **Testing API**: See `.github/instructions/spec-files.instructions.md`
- **Migration History**: See `MIGRATION_PLAN.md` (Migration is complete, but useful for context).
