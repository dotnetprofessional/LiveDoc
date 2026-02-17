<div align="center">

# 🚀 Getting Started

### Your first LiveDoc spec in 5 minutes

</div>

---

## What you'll build

By the end of this guide, you'll have:
- ✅ A working Vitest + LiveDoc setup
- ✅ A spec file using Gherkin syntax
- ✅ Beautiful, human-readable test output

---

## 🤖 Using an AI Assistant?

If you're using an AI coding assistant (like GitHub Copilot, Cursor, or Windsurf), you can skip the manual setup! 

Check out our **[AI Setup Guide](./ai-setup-guide.md)** for a one-sentence prompt that will have your AI agent configure everything for you.

---

## Step 1: Install

```bash
npm install --save-dev vitest @swedevtools/livedoc-vitest
```

> **Already using Vitest?** Great! LiveDoc works alongside your existing config.

---

## Step 2: Create your first spec

Create a file named `calculator.Spec.ts` (the `.Spec.ts` suffix is important):

```ts
// tests/calculator.Spec.ts
import { feature, scenario, given, when, Then as then, and } from '@swedevtools/livedoc-vitest';

feature("Calculator", () => {
  scenario("Adding two numbers", () => {
    let result = 0;

    given("I have entered '50' into the calculator", (ctx) => {
      result = ctx.step?.values?.[0] ?? 0;
    });

    and("I have entered '70' into the calculator", (ctx) => {
      result += ctx.step?.values?.[0] ?? 0;
    });

    when("I press add", () => {
      // The addition already happened above
    });

    then("the result should be '120'", (ctx) => {
      const expected = ctx.step?.values?.[0] ?? 0;
      expect(result).toBe(expected);
    });
  });
});
```

### 💡 Key things to notice

| Pattern            | Why                                                                       |
| ---------          | -----                                                                     |
| `Then as then`     | Avoids an ESM "thenable" quirk — see [Setup: Imports](./setup-imports.md) |
| `ctx.step?.values` | Extracts quoted values like `'50'` automatically                          |
| Lowercase keywords | `given`, `when`, `then` — LiveDoc's recommended style                     |

---

## Step 3: Configure Vitest

Create or update `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { LiveDocSpecReporter } from '@swedevtools/livedoc-vitest/reporter';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.Spec.ts'],
    reporters: [new LiveDocSpecReporter()],
  },
});
```

---

## Step 4: Run it! 🎉

```bash
npx vitest run
```

You'll see output like:

```
Feature: Calculator

  Scenario: Adding two numbers
    ✓ given I have entered '50' into the calculator
    ✓ and I have entered '70' into the calculator
    ✓ when I press add
    ✓ then the result should be '120'

──────────────────────────────────────────────────────
LiveDoc Test Summary
  ✓ 4 steps passed
  1 feature, 1 scenario, 4 steps
```

---

## Next steps

You're up and running! Here's where to go next:

| Your goal                      | Read this                               |
| -----------                    | -----------                             |
| Understand the import patterns | [Setup: Imports](./setup-imports.md)    |
| Use zero-import globals        | [Setup: Globals](./setup-globals.md)    |
| Learn all BDD keywords         | [BDD Authoring](./authoring-bdd.md)     |
| Try data-driven tests          | [Data Extraction](./data-extraction.md) |
| Configure reporters            | [Reporting](./reporting.md)             |

---

## Recommended: VS Code Extension

For the best authoring experience, install the **LiveDoc VS Code extension**:

→ **[LiveDoc for VS Code](https://marketplace.visualstudio.com/items?itemName=dotNetProfessional.livedoc-vscode)**

It provides:
- 📐 **Table formatting** — automatically align your data tables
- ✂️ **Snippets** — quickly scaffold features, scenarios, and steps
- 🎨 **Syntax highlighting** — Gherkin keywords stand out in your specs

Highly recommended when working with LiveDoc!

---

<div align="center">

**Questions?** Open an issue on GitHub — we're here to help!

</div>
