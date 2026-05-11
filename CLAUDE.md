# Architecture

Three-layer architecture — each layer may only depend on layers below it:

- **Layer 1** (top-level dirs: `fs/`, `http/`, `stream/`, `crypto/`, `net/`, `process/`, `child-process/`, `config/`, `transform/`, `path.ts`, `log.ts`, `readline.ts`): utility functions based on a single Node.js native module, no cross-module dependencies
- **Layer 2** (`utils/`): logic that spans multiple native modules
- **Layer 3** (`lib/`): complex feature libraries (e.g. socks, http-proxy, tcp-gateway, process-manager), potential future standalone projects; uses Layer 1 utilities only via module-level `external.ts`

All third-party dependencies (like `modules/lib/js`, `modules/types/common`) must be re-exported through top-level `external.ts`. Project files import these from `external.ts`, never directly from the third-party modules.

`index.ts` does not re-export `utils/`, `lib/`, or third-party functions from `external.ts` to minimize tsc compile scope for consumers.

Types used only within a `utils/{feature}` should be defined in `utils/{feature}/types.ts` (or `utils/{feature}/types/` directory if there are multiple type files).

See `README.md` for the full folder structure.
