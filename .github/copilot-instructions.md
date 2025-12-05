# LiveDoc Project - Copilot Instructions

## Project Overview

LiveDoc is a living documentation framework that generates documentation from executable specifications. This monorepo contains multiple packages supporting different test frameworks and tooling.

## Current Migration Context

This project is actively migrating from Mocha to Vitest. The `vitest-upgrade` branch contains ongoing migration work.

## Critical Development Rules

### Reference Implementation First

When fixing tests, implementing features, or debugging issues during the migration:

1. **Always consult the Mocha implementation first** - The original `packages/livedoc-mocha/` is the authoritative reference
2. The Mocha version is battle-tested and represents the correct behavior
3. Check `packages/livedoc-mocha/_src/app/` for application logic
4. Check `packages/livedoc-mocha/_src/test/` for test implementations

### Code Preservation

- Retain as much original code as possible from the Mocha version
- Only deviate from the original when:
  - The approach doesn't work in Vitest's architecture
  - Vitest provides better built-in functionality
  - There's a demonstrably more efficient solution
- Document any significant deviations from the original implementation

### Package Mapping

|  Purpose  |          Mocha (Reference)          |           Vitest (Target)            |
| --------- | -------------------                 | -----------------                    |
| App Code  | `packages/livedoc-mocha/_src/app/`  | `packages/livedoc-vitest/_src/app/`  |
| Tests     | `packages/livedoc-mocha/_src/test/` | `packages/livedoc-vitest/_src/test/` |
| Docs      | `packages/livedoc-mocha/docs/`      | `packages/livedoc-vitest/_docs/`     |

## Test Fixing Workflow

1. Identify the failing test in `packages/livedoc-vitest/`
2. Find the equivalent test in `packages/livedoc-mocha/_src/test/`
3. Compare what the test is validating
4. Check how the Mocha implementation handles the scenario in `packages/livedoc-mocha/_src/app/`
5. Apply the same approach to the Vitest version unless there's a compelling reason not to

## Key Principles

- **Feature Parity**: The Vitest version must match Mocha's behavior
- **API Compatibility**: External APIs should remain consistent, unless improvements are justified such as a context parameter addition
- **Test Coverage**: All Mocha tests need Vitest equivalents
- **When in doubt, match the Mocha behavior**

## Migration Status Documents

- `packages/livedoc-vitest/MIGRATION.md` - Migration notes and approach
- `packages/livedoc-vitest/IMPLEMENTATION_STATUS.md` - Current progress
- `packages/livedoc-vitest/TODO-test-parity.md` - Test parity tracking

## Build and Test Commands

### Vitest Package
```bash
cd packages/livedoc-vitest
npm test                    # Run all tests
npm run test:file           # Run specific file tests
```

### Mocha Package (for reference/comparison)
```bash
cd packages/livedoc-mocha
npm test                    # Run original tests
```

## Technology Stack

- **Language**: TypeScript
- **Package Manager**: npm with Lerna (monorepo)
- **Test Frameworks**: Mocha (original), Vitest (migration target)
- **Build**: TypeScript compiler
