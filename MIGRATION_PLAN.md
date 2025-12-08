# LiveDoc Monorepo Migration Plan

> **Created:** December 6, 2025  
> **Updated:** December 7, 2025  
> **Branch:** vitest-upgrade  
> **Goal:** Modern, minimal-dependency monorepo focused on Vitest (JavaScript) and xUnit (.NET)

---

## 🎉 Migration Status: COMPLETE

### Phase Summary

|  Phase  |         Description          |   Status   |
| ------- | -------------                | --------   |
| Phase 0 | Preparation                  | ✅ Complete |
| Phase 1 | Infrastructure Modernization | ✅ Complete |
| Phase 2 | Package Restructuring        | ✅ Complete |
| Phase 3 | Documentation & Polish       | ✅ Complete |

### What Was Done

**Phase 1: Infrastructure Modernization**
- ✅ Removed Lerna, configured pnpm workspaces
- ✅ Created shared `tsconfig.base.json`
- ✅ Configured root scripts
- ✅ Deleted empty `livedoc` package
- ✅ Archived `livedoc-emoji-reporter` to `_archive/`
- ✅ Moved `livedoc-sample` to `examples/vitest-sample`

**Phase 2: Package Restructuring**
- ✅ Archived `livedoc-mocha` to `_archive/livedoc-mocha`
- ✅ Renamed `livedoc-vitest` → `packages/vitest` (`@livedoc/vitest`)
- ✅ Renamed `livedoc-viewer` → `packages/viewer` (`@livedoc/viewer`)
- ✅ Renamed `livedoc-vscode` → `packages/vscode` (`@livedoc/vscode`)
- ✅ Moved `livedoc-xunit` → `dotnet/xunit`
- ✅ Updated all package.json names to scoped `@livedoc/*`
- ✅ Added missing dependencies (strip-ansi, @vitest/runner) for pnpm strict mode
- ✅ All 489 tests pass

**Phase 3: Documentation & Polish**
- ✅ Created custom reporter example in `examples/custom-reporter/`
- ✅ Updated VS Code extension README with local development instructions
- ✅ Updated main vitest package README with scoped package names
- ✅ Fixed VS Code settings for pnpm symlink issues (rg.exe fix)
- ✅ Updated .gitignore for pnpm

### Current Project Structure

```
LiveDoc/
├── packages/
│   ├── vitest/          # @livedoc/vitest - Primary JavaScript BDD SDK
│   ├── viewer/          # @livedoc/viewer - Web-based test results viewer
│   └── vscode/          # @livedoc/vscode - VS Code extension
├── dotnet/
│   └── xunit/           # LiveDoc.xUnit - .NET BDD framework
├── examples/
│   ├── vitest-sample/   # Basic Vitest BDD example
│   └── custom-reporter/ # How to build a custom Vitest reporter
├── _archive/            # Deprecated packages (reference only)
│   ├── livedoc-mocha/
│   ├── livedoc-emoji-reporter/
│   └── docs/
├── pnpm-workspace.yaml  # pnpm workspace configuration
├── tsconfig.base.json   # Shared TypeScript config
└── MIGRATION_PLAN.md    # This document
```

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Package Naming Decision](#package-naming-decision)
4. [Reporter Organization Decision](#reporter-organization-decision)
5. [Migration Phases](#migration-phases)
6. [Detailed Implementation Steps](#detailed-implementation-steps)
7. [Risk Mitigation](#risk-mitigation)

---

## Current State Analysis

### Monorepo Infrastructure
|      Aspect       |         Current         |                   Issue                    |
| --------          | ---------               | -------                                    |
| Tool              | Lerna 2.0.0-beta.38     | Extremely outdated (2017), beta version    |
| Features Used     | Package discovery only  | Overkill - npm workspaces do this natively |
| Root package.json | Only contains lerna dep | No scripts, no workspaces                  |

### Current Package Inventory

|         Package          |         Purpose         |          Status          |  Language  |
| ---------                | ---------               | --------                 | ---------- |
| `livedoc`                | Empty placeholder       | ❌ Delete                 | -          |
| `livedoc-mocha`          | Mocha BDD framework     | 🗄️ Archive (deprecated) | TypeScript |
| `livedoc-vitest`         | Vitest BDD framework    | ✅ Active (primary JS)    | TypeScript |
| `livedoc-xunit`          | xUnit BDD framework     | ✅ Active (primary .NET)  | C#         |
| `livedoc-emoji-reporter` | Custom reporter example | 🗄️ Archive (reference)  | TypeScript |
| `livedoc-viewer`         | Web UI for results      | ✅ Active                 | TypeScript |
| `livedoc-vscode`         | VS Code extension       | ✅ Active                 | TypeScript |
| `livedoc-sample`         | Sample tests            | 📁 Move to examples      | TypeScript |

### Deprecation: livedoc-mocha

**Decision:** Deprecate `livedoc-mocha` in favor of `livedoc-vitest`.

**Rationale:**
- Mocha is outdated and required significant work to upgrade
- Vitest is the modern standard: faster, TypeScript-first, better DX
- No value in maintaining two JavaScript test framework adapters
- Vitest has broader adoption and active development

**Action:**
- Archive `livedoc-mocha` to `_archive/` folder (preserve for reference)
- Publish final npm version with deprecation notice
- Remove from active development/testing

### Current Reporter Structure (Vitest - Active)

**livedoc-vitest reporters** (in `_src/app/reporter/`):
- `LiveDocSpecReporter.ts` - Main spec reporter (Vitest Reporter interface)
- `LiveDocVitestReporter.ts` - Base Vitest reporter
- `LiveDocViewerReporter.ts` - Viewer integration
- `JsonReporter.ts` - JSON output
- `SilentReporter.ts` - Silent mode

---

## Target Architecture

### Recommended Structure

```
LiveDoc/
├── package.json              # Workspaces config, root scripts
├── pnpm-workspace.yaml       # pnpm workspace definition (if using pnpm)
├── tsconfig.base.json        # Shared TypeScript config
├── .github/
│   └── workflows/            # CI/CD
│
├── packages/
│   ├── vitest/               # @livedoc/vitest - Primary JavaScript SDK
│   │   ├── src/
│   │   │   ├── livedoc.ts    # Vitest BDD DSL
│   │   │   ├── model/        # FeatureModel, ScenarioModel, etc.
│   │   │   ├── parser/       # StepParser, GherkinParser
│   │   │   ├── rules/        # BDD validation rules
│   │   │   ├── reporter/     # All reporters (bundled)
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── viewer/               # @livedoc/viewer - Web UI
│   │   └── ...
│   │
│   └── vscode/               # @livedoc/vscode - VS Code extension
│       └── ...
│
├── dotnet/                   # .NET packages (separate ecosystem)
│   └── xunit/                # LiveDoc.xUnit
│       └── ...
│
├── examples/                 # Sample projects (not packages)
│   ├── vitest-sample/        # Basic Vitest BDD tests
│   ├── xunit-sample/         # Basic xUnit BDD tests  
│   └── custom-reporter/      # How to build a custom Vitest reporter
│
├── docs/                     # Consolidated documentation
│   ├── getting-started.md
│   ├── vitest.md             # JavaScript guide
│   ├── xunit.md              # .NET guide
│   └── api/
│
└── _archive/                 # Deprecated packages (reference only)
    ├── livedoc-mocha/        # Original Mocha implementation
    └── livedoc-emoji-reporter/  # Custom reporter example (Mocha)
```

---

## Package Naming Decision

### Decision: Use Scoped Package Names with Short Folder Names

|   Current Name    |   New NPM Name    |    Folder Path    |    Status    |
| --------------    | --------------    | -------------     | ----------   |
| `livedoc-vitest`  | `@livedoc/vitest` | `packages/vitest` | ✅ Active     |
| `@livedoc/viewer` | `@livedoc/viewer` | `packages/viewer` | ✅ Active     |
| `livedoc-vscode`  | `@livedoc/vscode` | `packages/vscode` | ✅ Active     |
| `livedoc-xunit`   | `LiveDoc.xUnit`   | `dotnet/xunit`    | ✅ Active     |
| `livedoc-mocha`   | *(deprecated)*    | `_archive/mocha`  | 🗄️ Archived |

### Rationale
1. **Scoped names** (`@livedoc/*`) prevent npm name collisions
2. **Short folder names** reduce path length and improve readability
3. **Consistent pattern** across TypeScript packages
4. **NuGet naming** for .NET (`LiveDoc.xUnit`)
5. **No @livedoc/core needed** - with single JS SDK, keep models in vitest package

---

## Reporter Organization Decision

### Decision: Bundle Reporters Within SDK Packages

**Recommended:** Keep reporters **inside** each SDK package, not as separate packages.

```
packages/
  vitest/
    src/
      reporter/
        LiveDocSpecReporter.ts   # Main output reporter
        JsonReporter.ts          # JSON export
        ViewerReporter.ts        # Viewer integration
        SilentReporter.ts        # No output
        index.ts                 # Export all
```

### Rationale

|                      Approach                       |                           Pros                            |                 Cons                  |
| ----------                                          | ------                                                    | ------                                |
| **Bundled (recommended)**                           | Simpler deps, version-locked with SDK, easier maintenance | Larger package size                   |
| Separate packages (`@livedoc/vitest-reporter-spec`) | Smaller installs, independent versions                    | Complex deps, version matrix issues   |
| Nested packages (`packages/vitest/reporters/spec/`) | Organized                                                 | Over-engineering for simple reporters |

### When to Extract a Reporter

Only create a separate reporter package if:
1. It has significant external dependencies (e.g., database writer)
2. It's used across multiple SDKs with identical code
3. It has independent release cycles

**Current reporters are small (<500 lines each) and SDK-specific → Keep bundled**

### Export Pattern

```typescript
// packages/vitest/src/index.ts
export * from './livedoc';
export * from './reporter';

// User imports
import { feature, scenario, Given, When, Then } from '@livedoc/vitest';
import { LiveDocSpecReporter, JsonReporter } from '@livedoc/vitest/reporter';
```

---

## Migration Phases

### Phase 0: Preparation (Current Sprint)
- [x] Create this migration plan document
- [x] Ensure all tests pass on `vitest-upgrade` branch
- [x] Document current package dependencies

### Phase 1: Infrastructure Modernization
- [x] Remove Lerna, configure npm/pnpm workspaces
- [x] Set up shared TypeScript config
- [x] Configure root scripts
- [x] Delete empty `livedoc` package
- [x] Archive `livedoc-emoji-reporter` (custom reporter example)
- [x] Move `livedoc-sample` to `examples/vitest-sample`

### Phase 2: Archive Mocha & Restructure
- [x] Move `livedoc-mocha` to `_archive/livedoc-mocha` (preserve for reference)
- [ ] Publish final `livedoc-mocha` npm version with deprecation notice
- [x] Rename active package folders (keep git history)
- [x] Update package.json names to scoped (`@livedoc/*`)
- [x] Move `livedoc-xunit` to `dotnet/xunit`
- [x] Test all active packages still work

### Phase 3: Documentation & Polish
- [x] Create Vitest emoji reporter example in `examples/custom-reporter/`
- [x] Update READMEs with migration guides
- [x] Update VS Code extension for Vitest-only support
- [ ] Consolidate documentation to `docs/` (optional - per-package docs sufficient)
- [ ] Set up proper CI/CD with caching (future enhancement)

---

## Detailed Implementation Steps

### Phase 1: Infrastructure Modernization

#### Step 1.1: Switch to npm Workspaces

**Delete lerna.json:**
```powershell
Remove-Item d:\private\LiveDoc\lerna.json
```

**Update root package.json:**
```json
{
  "name": "livedoc-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "clean": "npm run clean --workspaces --if-present",
    "test:vitest": "npm test -w packages/vitest"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### Step 1.2: Shared TypeScript Config

**Create tsconfig.base.json in root:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Each package extends:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

#### Step 1.3: Clean Up Empty/Obsolete Packages

```powershell
# Delete empty livedoc package
Remove-Item -Recurse -Force d:\private\LiveDoc\packages\livedoc

# Move sample to examples (update for Vitest)
New-Item -ItemType Directory -Path d:\private\LiveDoc\examples -Force
Move-Item d:\private\LiveDoc\packages\livedoc-sample d:\private\LiveDoc\examples\vitest-sample
```

#### Step 1.4: Archive Emoji Reporter (Custom Reporter Example)

```powershell
# Create archive folder
New-Item -ItemType Directory -Path d:\private\LiveDoc\_archive -Force

# Archive emoji reporter as reference for custom reporter implementation
git mv d:\private\LiveDoc\packages\livedoc-emoji-reporter d:\private\LiveDoc\_archive\livedoc-emoji-reporter
```

> **Note:** The emoji reporter demonstrates how to implement a custom Mocha reporter.
> A Vitest equivalent will be created in `examples/custom-reporter/` as part of Phase 3.

### Phase 2: Package Restructuring

#### Step 2.1: Archive Mocha Package

```powershell
cd d:\private\LiveDoc

# Create archive folder
New-Item -ItemType Directory -Path _archive -Force

# Archive mocha (preserve for reference, keeps git history)
git mv packages/livedoc-mocha _archive/livedoc-mocha
```

#### Step 2.2: Rename Active Folders (Preserving Git History)

```powershell
# Rename active TypeScript packages
git mv packages/livedoc-vitest packages/vitest
git mv packages/livedoc-viewer packages/viewer
git mv packages/livedoc-vscode packages/vscode

# Move xUnit to dotnet folder
New-Item -ItemType Directory -Path dotnet -Force
git mv packages/livedoc-xunit dotnet/xunit
```

#### Step 2.3: Update package.json Names

```json
// packages/vitest/package.json
{
  "name": "@livedoc/vitest",
  ...
}

// packages/viewer/package.json  
{
  "name": "@livedoc/viewer",
  ...
}

// packages/vscode/package.json
{
  "name": "@livedoc/vscode",
  ...
}
```

---

## Alternative: pnpm Instead of npm

### Why Consider pnpm?

|      Feature       |        npm workspaces         |           pnpm workspaces           |
| ---------          | ---------------               | -----------------                   |
| Speed              | Good                          | Excellent (2-3x faster)             |
| Disk space         | Full node_modules             | Content-addressable (saves 50%+)    |
| Strictness         | Loose (phantom deps possible) | Strict (catches missing deps)       |
| Workspace protocol | Basic                         | Rich (`workspace:*`, `workspace:^`) |
| Adoption           | Built-in                      | Requires install                    |

### pnpm Setup

**Install pnpm:**
```powershell
npm install -g pnpm
```

**Create pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

**Update package.json:**
```json
{
  "name": "livedoc-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:vitest": "pnpm --filter @livedoc/vitest test"
  },
  "packageManager": "pnpm@9.14.2"
}
```

### Recommendation

**Use pnpm** - the strictness catches real bugs (missing dependencies), the speed is 2-3x faster, and disk usage is significantly lower. This is especially valuable for a monorepo.

---

## xUnit Package Decision

### Decision: Keep in Monorepo, Separate Folder

Move to `dotnet/xunit/` to clearly separate from TypeScript packages.

```
dotnet/
  xunit/                      # LiveDoc.xUnit (NuGet package)
    src/
    tests/
    livedoc-xunit.csproj
    README.md
```

### Rationale
- Same repository allows shared documentation and issue tracking
- Separate folder makes it clear this is a different ecosystem
- Independent build/test commands (dotnet CLI vs npm)
- NuGet package naming (`LiveDoc.xUnit`) follows .NET conventions

---

## Risk Mitigation

### Breaking Changes

| Risk                            | Mitigation                                                      |
| ------                          | ------------                                                    |
| NPM name change breaks installs | Publish under old names with deprecation notice pointing to new |
| Internal imports break          | Use search/replace, test thoroughly                             |
| CI/CD breaks                    | Update workflows before merging                                 |

### Rollback Plan

1. All changes on `vitest-upgrade` branch
2. Don't delete old packages until new ones published
3. Keep git history with `git mv`

---

## Decision Summary

|    Decision    |               Choice               |                Rationale                 |
| ----------     | --------                           | -----------                              |
| Monorepo tool  | **pnpm workspaces**                | Fast, strict, excellent monorepo support |
| Package naming | **@livedoc/\*** scoped             | Consistent, no conflicts                 |
| Folder naming  | **Short names** (vitest, viewer)   | Cleaner paths                            |
| Reporters      | **Bundled in vitest package**      | Simple, version-locked                   |
| livedoc-mocha  | **Deprecated & Archived**          | Vitest is the modern standard            |
| Shared core    | **Not needed**                     | Single JS SDK, keep models in vitest     |
| xUnit          | **Keep in repo at `dotnet/xunit`** | Same repo, separate ecosystem folder     |

---

## Next Steps

1. **Review this plan** and confirm decisions
2. **Start Phase 1** - Infrastructure modernization
3. **Test thoroughly** before Phase 2 folder renames
4. **Consider Phase 3** (shared core) as future improvement

---

## Appendix: Current vs Target Comparison

### Before (Current)
```
packages/
  livedoc/                    ← Empty, delete
  livedoc-emoji-reporter/     ← Custom reporter example, archive
  livedoc-mocha/              ← Deprecated, archive
  livedoc-sample/             ← Move to examples
  livedoc-viewer/             ← Rename
  livedoc-vitest/             ← Rename (primary JS SDK)
  livedoc-vscode/             ← Rename
  livedoc-xunit/              ← Move to dotnet/
```

### After (Target)
```
packages/
  vitest/                     ← @livedoc/vitest (primary JavaScript SDK)
  viewer/                     ← @livedoc/viewer
  vscode/                     ← @livedoc/vscode

dotnet/
  xunit/                      ← LiveDoc.xUnit (NuGet)

examples/
  vitest-sample/              ← Example Vitest tests
  xunit-sample/               ← Example xUnit tests
  custom-reporter/            ← How to build a Vitest custom reporter

_archive/
  livedoc-mocha/              ← Original implementation (reference)
  livedoc-emoji-reporter/     ← Custom reporter example (Mocha)

docs/
  getting-started.md
  vitest.md
  xunit.md
```
