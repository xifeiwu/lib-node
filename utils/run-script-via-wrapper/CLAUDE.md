# run-script-via-wrapper

## Design

`runScriptInCP` spawns a target script in a child process with two modes:

### Direct mode (default)
When only `spawnOptions` is provided, the target script is spawned directly — no wrapper, no IPC. Stdio is `[0, 1, 2]`. Suitable for scripts that just need to run as-is (e.g. `runTsScript`).

### Wrapper mode
When `spawnWrapperOptions` is provided, the target script is spawned via `cp-wrapper-script.ts`. The wrapper provides:
- **IPC communication** between parent and child process
- **Pre-script execution** (`preScript`) before the main script
- **Selective function execution** (`runExportedFunc`, `funcName`) — run specific exported functions from the script instead of the whole file

The wrapper config (`NodeCpWrapScriptOptions`) is passed via `spawnWrapperOptions.infoToCp`, which the wrapper receives through IPC as `CpWrapScriptIpcMessage`.

## Signature

```typescript
runScriptInCP<WrapperCpConfig>(
  targetScript: string,
  options?: {
    dryRun?: boolean;
    spawnOptions?: SpawnScriptOptions;
    spawnWrapperOptions?: SpawnScriptOptions<any, WrapperCpConfig>;
  }
)
```

- `spawnOptions` — runtime options, params, spawn options for the target script
- `spawnWrapperOptions` — config for cp-wrapper; `WrapperCpConfig` is `NodeCpWrapScriptOptions` for node runtime
- In wrapper mode, only `params` from `spawnOptions` is used (appended to target script args)

## Call chain

```
Direct:   runScriptInCP → getSpawnConfigByScript → spawnAndTryIpc → targetScript
Wrapper:  runScriptInCP → getSpawnConfigForCpScript → spawnAndTryIpc → cp-wrapper-script → run-target-script → targetScript
```
