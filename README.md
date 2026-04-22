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

## external.ts — Third-Party Dependency Gateway

All functions and types from third-party modules (`modules/lib/js`, `modules/types/common`) must be re-exported through `external.ts` before being used in this project. Files within this project should import these dependencies from `external.ts`, not directly from the third-party modules.

This provides a single point of control for all external dependencies.

## Dependency Rule

**Each layer may only call into layers below it, never above:**

- Layer 1: depends only on Node.js native modules and `external.ts` (third-party gateway)
- Layer 2: may use Layer 1
- Layer 3: may use Layer 1 (via module-level `external.ts`) and Layer 2

# Folder Structure

```
├── index.ts                        # Public API — re-exports Layer 1 only
├── external.ts                     # Third-party gateway — all imports from modules/lib/js
│                                   #   and modules/types/common must go through here
│
│── Layer 1 — Single-Module Utilities
│
├── child-process/                  # child_process: spawn, exec, IPC
│   ├── exec.ts
│   ├── spawn.ts
│   └── service.ts
├── config/                         # config: MySQL configuration
│   └── mysql.ts
├── crypto/                         # crypto: hash, XOR
│   ├── hash.ts
│   └── xor.ts
├── fs/                             # fs: file system operations
│   ├── go-through-dir.ts           #   recursive directory traversal
│   ├── read.ts                     #   file existence, stat, find
│   ├── write.ts                    #   file writing, data serialization
│   ├── others.ts                   #   remove, move, link
│   ├── stat.ts                     #   timestamp management
│   ├── utils.ts                    #   interactive file selection
│   └── service.ts
├── http/                           # http/https: full HTTP stack
│   ├── client/                     #   HTTP client (request sending)
│   │   ├── receiver.ts
│   │   └── sender.ts
│   ├── server/                     #   HTTP server
│   │   ├── server.ts
│   │   ├── debug-server.ts
│   │   └── service/
│   ├── tcp/                        #   raw TCP-level HTTP
│   │   ├── client/
│   │   ├── server/
│   │   └── service/
│   ├── service/                    #   shared HTTP utilities
│   ├── form-data.ts                #   multipart form-data encoding
│   └── test/
├── net/                            # net: TCP socket client/server
│   ├── one-chat.ts
│   └── service/
├── process/                        # process: process info, kill
│   ├── utils.ts
│   └── service/
├── stream/                         # stream: readable/writable/transform
│   ├── readable.ts
│   ├── transform.ts
│   └── writable/
├── transform/                      # Buffer/HTML/string conversion
│   ├── buffer.ts
│   ├── html.ts
│   └── str.ts
├── log.ts                          # Colorful logging
├── path.ts                         # Path parsing, directory ensuring
├── readline.ts                     # Interactive readline prompts
│
│── Layer 2 — Cross-Module Utilities
│
├── utils/                          # Not exported from index.ts
│   ├── cache.ts
│   ├── git.ts
│   ├── select.ts
│   ├── cp-script/                  #   child-process script utilities
│   ├── exec/                       #   diff-patch
│   ├── run-script/                 #   script runner (on-node)
│   └── write/                      #   log/snapshot writers
│
│── Layer 3 — Feature Libraries
│
├── lib/                            # Not exported from index.ts (except a few)
│   ├── assets-management/          #   directory asset metadata, backup, sync, import
│   │   ├── external.ts
│   │   ├── file-generator/
│   │   ├── operation/
│   │   ├── service/
│   │   └── types/
│   ├── http-body-parser/           #   HTTP request body parsing (multipart, urlencoded)
│   │   ├── parser/
│   │   ├── service/
│   │   │   └── external.ts
│   │   └── test/
│   ├── http-proxy/                 #   HTTP/WebSocket reverse proxy
│   │   ├── external.ts
│   │   ├── handler.ts
│   │   ├── server.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── http-record/                #   HTTP request/response recording
│   │   ├── external.ts
│   │   ├── generate.ts
│   │   ├── find.ts
│   │   ├── types.ts
│   │   └── service.ts
│   ├── memcached/                  #   Memcached client and server
│   │   ├── client/
│   │   ├── server/
│   │   ├── service/
│   │   │   └── external.ts
│   │   └── test/
│   ├── mime/                       #   MIME type lookup (re-exports from modules/lib/js/lib/mime)
│   ├── process-manager/            #   child process lifecycle management
│   │   ├── launch-cp/
│   │   ├── operation/
│   │   └── service/
│   │       └── external.ts
│   ├── socks/                      #   SOCKS5 and VC1 proxy protocol
│   │   ├── v5/
│   │   ├── vc1/
│   │   ├── service/
│   │   │   └── external.ts
│   │   ├── types/
│   │   └── test/
│   ├── sub-repo/                   #   Git sub-repository management
│   │   ├── external.ts
│   │   ├── service/
│   │   └── utils/
│   ├── tcp-gateway/                #   TCP connection router (protocol detection → dispatch)
│   │   ├── external.ts
│   │   └── index.ts
│   ├── cookies.ts                  #   HTTP cookie operations
│   └── keygrip.ts                  #   Key signing
│
│── Supporting
│
├── types/                          # TypeScript type definitions (by module)
│   ├── child_process/
│   ├── http/
│   ├── transform/
│   ├── utils/
│   ├── fs.ts
│   ├── net.ts
│   ├── stream.ts
│   └── ...
├── service/                        # Cross-module service layer, test utilities
│   ├── constants.ts
│   ├── other.ts
│   └── test.ts
├── fe.test/                        # Frontend-compatible tests (no @types/node)
│   ├── url.ts
│   └── service/
│
│── Config
│
├── package.json
├── tsconfig.json
└── README.md
```

# Export Policy

`index.ts` only re-exports Layer 1 modules by default. The following are **not** re-exported from `index.ts`:

- `utils/` and `lib/` — consumers must import them independently
- Third-party functions from `external.ts` — consumers should import from the third-party modules directly

This is intentional: since this module is widely used, `export * from './file'` causes `tsc` to compile all referenced logic transitively. Minimizing exports in `index.ts` keeps compile times down for consumers.

# Notice

1. To avoid introducing `@types/node` dependency into `lib/js`, unit tests for `lib/js` are located in the `fe.test/` directory.

# TODO

1. dir net needs refactor
