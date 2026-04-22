# Intro

A collection of commonly-used small-granularity utility functions based on Node.js native modules. No third-party dependencies except:

- `modules/lib/js`
- `modules/types/common`

# Three-Layer Architecture

This project follows a strict three-layer architecture. Each layer may only depend on layers below it, never above.

## Layer 1 — Single-Module Utilities (top-level directories)

Directories named after Node.js native modules (e.g. `fs/`, `http/`, `stream/`, `crypto/`). Each directory contains utility functions built on top of **that single native module only** — no cross-module dependencies within this layer.

If the logic does not depend on any native module, it is platform-independent and belongs in `modules/lib/js`, not here.

## Layer 2 — Cross-Module Utilities (`utils/`)

Logic that combines multiple native modules or uses functions from multiple Layer 1 directories.

## Layer 3 — Feature Libraries (`lib/`)

Complex, self-contained feature implementations (e.g. `lib/socks`, `lib/http-proxy`, `lib/process-manager`). These are designed with the potential to become independent projects in the future.

To maintain a clean boundary with Layer 1, all utility functions used by `lib/` modules are re-exported through `external.ts` rather than imported directly from Layer 1 directories.

## Dependency Rule

**Each layer may only call into layers below it, never above:**

- Layer 1: depends only on Node.js native modules and `modules/lib/js`
- Layer 2: may use Layer 1
- Layer 3: may use Layer 1 (via `external.ts`) and Layer 2

# Export Policy

`index.ts` only re-exports Layer 1 modules by default. `utils/` and `lib/` are **not** re-exported — consumers must import them independently.

This is intentional: since this module is widely used, `export * from './file'` causes `tsc` to compile all referenced logic transitively. Minimizing exports in `index.ts` keeps compile times down for consumers.

# Notice

1. To avoid introducing `@types/node` dependency into `lib/js`, unit tests for `lib/js` are located in the `fe.test/` directory.

# TODO

1. dir net needs refactor
