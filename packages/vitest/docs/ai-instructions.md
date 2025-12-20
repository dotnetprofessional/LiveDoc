# LiveDoc AI Agent Instructions

This document is intended for AI Agents (LLMs) to automate the setup and maintenance of LiveDoc tests.

## 🤖 Role
You are a LiveDoc Setup Agent. Your goal is to configure the developer's environment to use `@livedoc/vitest` for living documentation.

## 📋 Agent Execution Plan

Follow this plan to initialize or update the LiveDoc environment:

1.  **Environment Discovery**:
    *   Check for `package.json` to confirm it's a Node.js project.
    *   Check for `vitest.config.ts` or `vite.config.ts`.
    *   Identify if the project uses TypeScript (`tsconfig.json`).
2.  **Developer Consultation**:
    *   Ask: "Should I use **Globals mode** (zero imports) or **Explicit Imports**?"
    *   Ask: "Where should I place the spec files? (Default: `test/*.Spec.ts`)"
3.  **Dependency Injection**:
    *   Install `@livedoc/vitest` using the project's package manager (npm/pnpm/yarn).
4.  **Configuration**:
    *   Configure `vitest.config.ts` with `LiveDocSpecReporter`.
    *   If Globals mode is chosen, update `tsconfig.json` and add the setup file.
5.  **Verification**:
    *   Create a simple `SmokeTest.Spec.ts` to verify the setup.
    *   Run the tests and confirm the reporter output is visible.
6.  **Instruction Persistence**:
    *   Download the `spec-files.instructions.md` to the project's `.github/instructions/` folder.
    *   **CRITICAL**: Add a reference to these instructions in the project's root `README.md` or a dedicated AI rules file (e.g., `.cursorrules`, `.clinerules`, or `copilot-instructions.md`) so you and other agents can find them automatically in future sessions.
    *   Example link to add: `[LiveDoc Instructions](.github/instructions/spec-files.instructions.md)`

## 🛠️ Automated Setup Snippet

Use this snippet to quickly configure the environment once the developer has made their choices:

```bash
# Example for pnpm
pnpm add -D @livedoc/vitest
```

## ⚙️ Configuration Templates

### package.json Scripts

Add these scripts to allow easy switching between reporter detail levels:

```json
{
  "scripts": {
    "test:spec": "vitest run --reporter=@livedoc/vitest/reporter --reporter-options.detailLevel=spec+headers",
    "test:list": "vitest run --reporter=@livedoc/vitest/reporter --reporter-options.detailLevel=list+headers",
    "test:summary": "vitest run --reporter=@livedoc/vitest/reporter --reporter-options.detailLevel=summary+headers",
    "test:full": "vitest run --reporter=@livedoc/vitest/reporter --reporter-options.detailLevel=spec+summary+headers"
  }
}
```

### Option A: Imports mode (explicit dependencies)

#### vitest.config.ts
```ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })
    ],
  },
});
```

### Option B: Globals mode (zero imports)

#### vitest.config.ts
```ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@livedoc/vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    setupFiles: ['@livedoc/vitest/setup'],
    reporters: [
      new LiveDocSpecReporter({ detailLevel: 'spec+summary+headers' })
    ],
  },
});
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@livedoc/vitest/globals"]
  }
}
```

## 📝 Authoring Reference

For detailed authoring rules (Gherkin syntax, data extraction, etc.), always refer to:
https://raw.githubusercontent.com/dotNetProfessional/LiveDoc/main/.github/instructions/spec-files.instructions.md
