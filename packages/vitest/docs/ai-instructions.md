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
    *   **Vitest version compatibility checkpoint (CRITICAL):**
        *   Determine the installed Vitest **major** version (prefer: read `devDependencies.vitest` in `package.json`; fallback: run `vitest --version` or `pnpm vitest --version`).
        *   If Vitest is **< 4**, instruct the developer/agent to upgrade to Vitest 4+ (or warn loudly).
            *   Reason: on older versions, reporter hooks may not run reliably and LiveDoc output can appear “missing” even when configured.
            *   Example upgrades:
                *   pnpm: `pnpm add -D vitest@^4`
                *   npm: `npm i -D vitest@^4`
                *   yarn: `yarn add -D vitest@^4`
2.  **Developer Consultation**:
    *   Ask: "Should I use **Globals mode** (zero imports) or **Explicit Imports**?"
    *   Ask: "Where should I place the spec files? (Default: `test/*.Spec.ts`)"
3.  **Dependency Injection**:
    *   Install/ensure `vitest` is present (and 4+ per the checkpoint above).
    *   Install `@livedoc/vitest` using the project's package manager (npm/pnpm/yarn).
4.  **Configuration**:
  *   Configure `vitest.config.ts` with `LiveDocSpecReporter`.
  *   **Config safety (recommended):**
    *   Do **not** delete (“wipe”) an existing Vitest config by default.
    *   Prefer **additive** changes (append reporter/setup/settings) to avoid breaking unrelated test behavior.
    *   If the existing config is complex or you need to make a large rewrite, choose one:
      *   **Backup-in-place:** copy the current file to `vitest.config.backup.ts` (or similar) before editing.
      *   **Side-by-side config (often best):** create `vitest.config.livedoc.ts` and run LiveDoc via scripts using `vitest --config vitest.config.livedoc.ts`.
    *   Only remove/replace existing config with explicit developer approval.
    *   If Globals mode is chosen, update `tsconfig.json` and add the setup file.
5.  **Verification**:
    *   Create a `SmokeTest.Spec.ts` to verify the setup.
        *   **CRITICAL:** it must use LiveDoc's `feature`/`scenario`/`given`/`when`/`Then` APIs.
        *   A plain `describe`/`it` smoke test does **not** validate the LiveDoc formatting/reporting path.
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

Avoid relying on `--reporter-options.*` CLI flags for LiveDoc settings.

- The `--reporter-options.detailLevel=...` syntax is not stable across Vitest/CAC parsing and can fail as “Unknown option”.
- Prefer **config-driven** or **env-driven** configuration instead.

Add these scripts to allow easy switching between reporter detail levels (env-driven):

Note: environment variable syntax varies across shells/OSes. The most portable approach is to use `cross-env`.

```bash
pnpm add -D cross-env
```

```json
{
  "scripts": {
    "test:spec": "cross-env LIVEDOC_DETAIL_LEVEL=spec+headers vitest run",
    "test:list": "cross-env LIVEDOC_DETAIL_LEVEL=list+headers vitest run",
    "test:summary": "cross-env LIVEDOC_DETAIL_LEVEL=summary+headers vitest run",
    "test:full": "cross-env LIVEDOC_DETAIL_LEVEL=spec+summary+headers vitest run"
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
      // Most reliable: configure reporter in config (avoid CLI reporter-options parsing)
      new LiveDocSpecReporter({
        detailLevel: process.env.LIVEDOC_DETAIL_LEVEL ?? 'spec+summary+headers',
      })
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
    // Preferred: use the package-provided globals setup.
    // Fallback: if the consuming repo is pinned to an older @livedoc/vitest that
    // doesn't export this entrypoint, use a local ./livedoc.setup.ts instead.
    setupFiles: ['@livedoc/vitest/setup'],
    reporters: [
      new LiveDocSpecReporter({
        detailLevel: process.env.LIVEDOC_DETAIL_LEVEL ?? 'spec+summary+headers',
      })
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

#### Globals mode fallback (when `@livedoc/vitest/setup` and/or `@livedoc/vitest/globals` do not exist)

1) Create `livedoc.setup.ts` (referenced by `setupFiles` above) and attach the API to `globalThis`:

```ts
import {
  feature,
  scenario,
  scenarioOutline,
  background,
  given,
  when,
  Then,
  and,
  but,
  specification,
  rule,
  ruleOutline,
} from '@livedoc/vitest';

Object.assign(globalThis, {
  feature,
  scenario,
  scenarioOutline,
  background,
  given,
  when,
  Then,
  and,
  but,
  specification,
  rule,
  ruleOutline,
});
```

2) Create a minimal `livedoc-globals.d.ts` so TypeScript knows about the globals:

```ts
export {};

declare global {
  const feature: typeof import('@livedoc/vitest').feature;
  const scenario: typeof import('@livedoc/vitest').scenario;
  const scenarioOutline: typeof import('@livedoc/vitest').scenarioOutline;
  const background: typeof import('@livedoc/vitest').background;
  const given: typeof import('@livedoc/vitest').given;
  const when: typeof import('@livedoc/vitest').when;
  const Then: typeof import('@livedoc/vitest').Then;
  const and: typeof import('@livedoc/vitest').and;
  const but: typeof import('@livedoc/vitest').but;
  const specification: typeof import('@livedoc/vitest').specification;
  const rule: typeof import('@livedoc/vitest').rule;
  const ruleOutline: typeof import('@livedoc/vitest').ruleOutline;
}
```

3) Ensure TS includes it (pick one):
- Add it to `include` in `tsconfig.json`, or
- Place it in a folder already included (common: `src/`), or
- Add a `/// <reference path="./livedoc-globals.d.ts" />` in a shared types entry.

### Avoid alias collisions with `@livedoc/*` (CRITICAL)

Many repos alias `@` → `src`. That can accidentally rewrite scoped packages like `@livedoc/vitest/...` in some bundler/test configs.

- Prefer aliasing only `@/` → `src` (or a regex that matches `^@/`) rather than bare `@`.
- If the repo already has a bare `@` alias, update it carefully so `@livedoc/*` remains untouched.

### Reporter loading expectations (CLI vs config)

- **Most reliable**: instantiate `new LiveDocSpecReporter(...)` in `vitest.config.ts` (as shown above).
- If using CLI `--reporter=@livedoc/vitest/reporter`, be aware some builds may export `LiveDocSpecReporter` as a **named** export (not a default export).
    - If Vitest expects a **default export** for custom reporter modules, use a tiny wrapper file.

Example wrapper `livedoc.reporter.ts`:

```ts
export { LiveDocSpecReporter as default } from '@livedoc/vitest/reporter';
```

Then reference it in config or CLI as your reporter module path.

## ✅ Minimal Smoke Test (must be LiveDoc)

Create `test/SmokeTest.Spec.ts` (or your preferred spec folder). This validates both parsing and reporting:

```ts
import { feature, scenario, given, when, Then as then } from '@livedoc/vitest';

feature(`LiveDoc Smoke Test
  Verifies that LiveDoc steps render and the reporter prints output
  `, () => {
  scenario('adds two numbers', () => {
    let result = 0;

    given("a = '2'", (ctx) => {
      const [a] = ctx.step.values;
      result = a;
    });

    when("adding b = '3'", (ctx) => {
      const [b] = ctx.step.values;
      result += b;
    });

    then("the result should be '5'", (ctx) => {
      const [expected] = ctx.step.values;
      expect(result).toBe(expected);
    });
  });
});
```

## 📝 Authoring Reference

For detailed authoring rules (Gherkin syntax, data extraction, etc.), always refer to:
https://raw.githubusercontent.com/dotNetProfessional/LiveDoc/main/.github/instructions/spec-files.instructions.md
