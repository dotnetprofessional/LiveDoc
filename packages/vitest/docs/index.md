<div align="center">

# 📖 @livedoc/vitest

### Turn your tests into living documentation

[![npm version](https://img.shields.io/npm/v/@livedoc/vitest.svg)](https://www.npmjs.com/package/@livedoc/vitest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

</div>

---

**LiveDoc** transforms your Vitest specs into beautiful, self-documenting test reports that everyone on your team can understand — from developers to product managers.

Write tests using natural Gherkin syntax. Get documentation that stays in sync with your code, forever.

```ts
// BDD style — perfect for user stories and acceptance tests
feature("Shopping Cart", () => {
  scenario("Adding items increases the total", () => {
    given("an empty cart", () => { /* ... */ });
    when("the user adds a '$25' book", () => { /* ... */ });
    then("the cart total should be '$25'", () => { /* ... */ });
  });
});
```

```ts
// Specification style — ideal for domain rules and technical constraints
specification("Cart Pricing Rules", () => {
  rule("Items under $10 do not qualify for free shipping", () => { /* ... */ });
  rule("Orders over $100 receive a 10% discount", () => { /* ... */ });
});
```

> 💡 **Most projects benefit from using both patterns** — BDD for user-facing flows and acceptance criteria, Specifications for business rules and technical constraints. Pick the style that best communicates each test's intent.

---

## 🚀 Quick Start

New to LiveDoc? Start here:

| Guide                                       | Description                                  |
| -------                                     | -------------                                |
| **[Getting Started](./getting-started.md)** | Install and run your first spec in 5 minutes |
| **[Tutorial](./tutorial.md)**               | Build your first living spec from scratch    |
| [Setup: Imports](./setup-imports.md)        | Explicit imports for full control            |
| [Setup: Globals](./setup-globals.md)        | Zero-import specs for maximum clarity        |

---

## ✍️ Writing Specs

Learn the two authoring patterns — use whichever fits your team's style:

| Guide                                                       | Best for                                               |
| -------                                                     | ----------                                             |
| **[BDD Authoring](./authoring-bdd.md)**                     | Acceptance tests, user stories, cross-functional specs |
| **[Specification Authoring](./authoring-specification.md)** | Technical rules, domain logic, unit-level specs        |
| [Data Extraction](./data-extraction.md)                     | Tables, doc strings, quoted values                     |
| [Tags & Filtering](./tags-and-filtering.md)                 | Running subsets of tests (`@smoke`, `@slow`, etc.)     |

---

## 📊 Output & Reporting

| Guide                                     | Description                                 |
| -------                                   | -------------                               |
| **[Reporting](./reporting.md)**           | CLI output, JSON export, Viewer integration |
| [Custom Reporters](./custom-reporters.md) | Build your own post or UI reporters         |
| [Troubleshooting](./troubleshooting.md)   | Common issues and how to fix them           |

---

## 🔧 For Contributors

Want to improve LiveDoc? We'd love your help.

| Guide                             | Description                       |
| -------                           | -------------                     |
| [Architecture](./architecture.md) | How it works under the hood       |
| [Contributing](./contributing.md) | Dev setup, testing, PR guidelines |

---

## � VS Code Extension

For the best authoring experience, install the **LiveDoc VS Code extension**:

→ **[LiveDoc for VS Code](https://marketplace.visualstudio.com/items?itemName=dotNetProfessional.livedoc-vscode)**

Features:
- 📐 Automatic table formatting and alignment
- ✂️ Snippets for features, scenarios, and steps  
- 🎨 Syntax highlighting for Gherkin keywords

Highly recommended when working with LiveDoc!

---

## �🤖 AI-Friendly Setup

Integrating LiveDoc with an AI coding assistant? This page has copy-paste-ready configs:

→ **[AI Setup Guide](./ai-setup-guide.md)**

---

<div align="center">

Made with ❤️ by the LiveDoc community

</div>
