# Architecture

Three-layer architecture — each layer may only depend on layers below it:

- **Layer 1** (top-level dirs: `fs/`, `http/`, `stream/`, etc.): utility functions based on a single Node.js native module, no cross-module dependencies
- **Layer 2** (`utils/`): logic that spans multiple native modules
- **Layer 3** (`lib/`): complex feature libraries (e.g. socks, http-proxy), potential future standalone projects; uses Layer 1 utilities only via `external.ts`

`index.ts` does not re-export `utils/` or `lib/` to minimize tsc compile scope for consumers.
