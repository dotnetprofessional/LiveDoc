<div align="center">

# 🤝 Contributing

### Help make LiveDoc better

</div>

---

## Welcome!

We're excited you're interested in contributing to LiveDoc. Whether it's fixing a bug, adding a feature, improving docs, or just asking questions — every contribution matters.

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/user/livedoc.git
cd livedoc
pnpm install
```

> **Note:** This is a pnpm monorepo. Make sure you have pnpm installed (`npm install -g pnpm`).

### 2. Build the vitest package

```bash
pnpm --filter @livedoc/vitest build
```

### 3. Run tests

```bash
pnpm --filter @livedoc/vitest test
```

---

## Project structure

```
packages/vitest/
├── _src/
│   ├── app/           # Core implementation
│   │   ├── livedoc.ts      # DSL (feature, scenario, etc.)
│   │   ├── parser/         # Title parsing
│   │   ├── model/          # Data structures
│   │   └── reporter/       # Output formatters
│   └── test/          # Specs for the package itself
├── docs/              # Documentation (you are here)
├── dist/              # Build output
└── package.json
```

---

## Development workflow

### Making changes

1. Create a branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Add/update tests in `_src/test/`
4. Run tests: `pnpm --filter @livedoc/vitest test`
5. Build: `pnpm --filter @livedoc/vitest build`

### Running a specific test file

```bash
pnpm --filter @livedoc/vitest test -- _src/test/MyFeature.Spec.ts
```

### Watch mode

```bash
pnpm --filter @livedoc/vitest test -- --watch
```

---

## Writing tests

LiveDoc tests are written using... LiveDoc! We dogfood the framework.

### Test file naming

All test files must end in `.Spec.ts`:

```
_src/test/
├── Feature.Spec.ts
├── ScenarioOutline.Spec.ts
├── TagFiltering.Spec.ts
└── ...
```

### Test structure

```ts
import { feature, scenario, given, when, Then as then } from '../app/livedoc';

feature("My Feature", () => {
  scenario("Expected behavior", () => {
    given("a setup condition", () => {
      // arrange
    });

    when("an action occurs", () => {
      // act
    });

    then("the expected outcome happens", () => {
      // assert
    });
  });
});
```

### Guidelines

1. **Embed test data in step titles** (LiveDoc best practice):
   ```ts
   // ✅ Good
   given("a user with '$100' balance", (ctx) => {});
   
   // ❌ Avoid
   given("a user with balance", () => { const balance = 100; });
   ```

2. **One concept per scenario**

3. **Descriptive scenario names**

---

## Adding a DSL feature

If you're adding a new keyword or modifying behavior:

1. **Update `livedoc.ts`** — Add/modify the function
2. **Update `index.ts`** — Export it
3. **Update `setup.ts`** — Register global (if applicable)
4. **Update `globals.d.ts`** — Add TypeScript declaration
5. **Add tests** — Cover happy path and edge cases
6. **Update docs** — Document the feature

---

## Code style

- **TypeScript strict mode** — No `any` unless absolutely necessary
- **Meaningful names** — `createStepFunction` not `csf`
- **Comments for "why"** — Code shows "what", comments explain "why"

---

## Pull request process

1. **Fork the repo** and create your branch
2. **Make your changes** with tests
3. **Ensure tests pass**: `pnpm --filter @livedoc/vitest test`
4. **Ensure build works**: `pnpm --filter @livedoc/vitest build`
5. **Open a PR** with:
   - Clear description of what and why
   - Link to any related issues
   - Screenshots if UI-related

### PR checklist

- [ ] Tests added/updated
- [ ] Documentation updated (if applicable)
- [ ] Build passes
- [ ] No new TypeScript errors

---

## Reporting bugs

Open an issue with:

1. **What you expected**
2. **What happened instead**
3. **Steps to reproduce**
4. **Your environment** (Node version, OS, Vitest version)
5. **Minimal reproduction** (if possible)

---

## Feature requests

We love ideas! Open an issue with:

1. **The problem you're solving**
2. **Your proposed solution**
3. **Alternatives you considered**

---

## Documentation

Docs live in `packages/vitest/docs/`. We use Markdown with:

- Clear headings
- Code examples that actually work
- Links between related pages

To update docs:

1. Edit the relevant `.md` file
2. Test any code examples
3. Submit a PR

---

## Questions?

- **GitHub Issues** — For bugs and features
- **Discussions** — For questions and ideas

---

<div align="center">

Thank you for contributing! 🎉

[← Architecture](./architecture.md) · [Back to Docs →](./index.md)

</div>
