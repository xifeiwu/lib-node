## Target

Run a script file (.ts/.js) in a child process, with the ability to select and invoke specific exported functions.

## How It Works

### Two-Layer Design

**Layer 1 — Child Process Wrapper (`main.ts` → `runScriptInCP`)**

Spawns a child process to run the target script in an isolated environment:

1. Resolves the appropriate runtime (`ts-node`, `tsx`, or `node`) based on the target file extension and whether the project uses ESM (`"type": "module"`)
2. Spawns `cp-wrap-script.ts` as the child process entry point, passing it the target script path and options via IPC
3. Manages TTY raw mode around the child process lifecycle
4. Returns serialized spawn response (stdout, exit code, etc.)

Runtime selection logic:

| Target file | ESM? | Runtime |
|-------------|------|---------|
| `.ts` | yes | `tsx` |
| `.ts` | no | `ts-node` (with `--swc` by default) |
| `.js` | — | `node` |

**Layer 2 — Script Execution (`on-node/run-target-script.ts` → `runTargetScriptOnNode`)**

Handles the actual script loading and function invocation inside the child process:

1. `require()`/`import()` the target script
2. If `funcName` is specified, call that exported function directly
3. If `runExportedFunc` is set but no `funcName`, present an interactive prompt listing all exported functions for the user to select
4. Supports a special `_all` option to run every exported function sequentially
5. Handles both sync and async functions, and class-based modules (`module.exports = class {}`)

### cp-wrap-script.ts

The bridge between the two layers. Runs inside the child process:

1. Receives `CpWrapScriptOptions` (target script path, function name, params) from the parent via IPC, or falls back to `process.argv`
2. Optionally runs a `preScript` before the main script (e.g. to set up global env)
3. Delegates to `runTargetScriptOnNode` to execute the target

## Exports

- `runScriptInCP(options)` — run a script in a child process (main entry point)
- `runTargetScriptOnNode(scriptPath, options)` — run a script in the current process (used internally by cp-wrap-script, also exported for direct use)
