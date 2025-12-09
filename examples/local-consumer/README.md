# Local Consumer Sample

This sample is an isolated project that installs `@livedoc/vitest` from a locally packed tarball (no source/dist linking). Use it to validate the published artifacts and as a quickstart template.

## Prerequisites
- Node 18+
- pnpm (recommended) or npm

## 1) Build the local tarball
From the repo root:

```bash
pnpm -C packages/vitest run pack:local
```

This produces `packages/vitest/livedoc-vitest-1.0.0.tgz`.

## 2) Install dependencies
From this sample folder:

```bash
pnpm install
```

The dependency is resolved via `file:../../packages/vitest/livedoc-vitest-1.0.0.tgz`, so it consumes the packed artifact only.

## 3) Run the tests

```bash
pnpm test
```

You should see the `Calculator basics` feature passing, confirming the package works when installed from the tarball.

## Updating the tarball path
If the package version changes, update `dependencies.@livedoc/vitest` in `package.json` to the new tarball filename and rerun steps 1–3.
