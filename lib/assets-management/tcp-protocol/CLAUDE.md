# TCP Protocol

TCP-based asset sync protocol for transferring large static files between two asset stores through client/server connections. Designed for files not suitable for git. Reusable from any context — the TCP middleware wrapper (`net/koa/middleware/assets/`) and CLI (`src/1-command/assets-sync.ts`) are thin consumers of this module.

## Wire Protocol

Protocol identification byte: `0x10`. The TCP gateway reads the first byte of each non-HTTP connection and dispatches by numeric value.

JSON control frames: `[4 bytes big-endian uint32 length][JSON payload]`. File data: raw bytes streamed directly (size communicated via preceding `add-file` JSON frame).

All JSON frames (except the initial `CommandMessage`) use `ChatMessage` format: `{label, meta?}`. See `types.ts` for the full type definition.

### Connection Flow

```
C→S: [0x10]                                           protocol byte
C→S: frame{command: "push"|"pull"|"diff", meta}        CommandMessage

S→C: frame{label: "diff", meta: MetaDiffForSyncUp}     diff result

(diff: connection closes here)

push — client sends files:
  C→S: frame{label: "add-file", meta: {relativePath, size}}   per-file header
  C→S: [raw file bytes]                                        per-file data
  C→S: frame{label: "transfer-complete"}
  S→C: frame{label: "info", meta: {message}}                   0..N info messages
  S→C: frame{label: "success", meta: {git?}}                   final result

pull — server sends files:
  S→C: frame{label: "add-file", meta: {relativePath, size}}
  S→C: [raw file bytes]
  S→C: frame{label: "transfer-complete"}
```

### Diff Semantics

- **push**: `diffMetaForSyncUp(serverMeta, clientMeta)` — what server needs to match client
- **pull**: `diffMetaForSyncUp(clientMeta, serverMeta)` — what client needs to match server

Files to transfer = `added` + `modified` (from the `fromMeta` side). `moved`/`copied` are handled locally on the receiver. `deleted` files are removed on the receiver.

## File Structure

| File | Purpose |
|------|---------|
| `types.ts` | `ChatMessage` union type and subtypes: `AddFileMessage`, `DiffMessage`, `SuccessMessage`, `InfoMessage`, `ErrorMessage`, `SimpleMessage`, `AssetsSyncCommand` |
| `protocol.ts` | Protocol byte constant, frame I/O utilities (`readExactly`/`readFrame`/`writeFrame`/`readJsonFrame`/`writeJsonFrame`), file streaming helpers (`streamFileToSocket`/`receiveFileFromSocket`). Re-exports `types.ts`. |
| `server.ts` | Server-side handler (`handleAssetsSyncConnection`), `handlePush`/`handlePull`, `gitSyncUp`. Auto-creates dir if not exists. `gitSyncUp` sends `info` frames on git errors. |
| `client.ts` | Client-side logic (`runAssetsSyncCommand`), local meta scanning, diff display, push/pull file transfer. Handles `info` frames from server before reading final result. |
| `remote-syncup.test.ts` | Integration tests: `testPushFlow`, `testPullFlow` using local TCP server + `runAssetsSyncCommand` |
| `index.ts` | Re-exports all modules |

## Key Exports

- `ASSETS_SYNC_PROTOCOL_BYTE` — `0x10`, used by TCP middleware to identify this protocol
- `handleAssetsSyncConnection(socket, config)` — server entry point, handles the full protocol lifecycle
- `AssetsSyncServerConfig` — `{dir: string; git?: string}`
- `runAssetsSyncCommand(command, dir, options)` — client entry point, scans local files, connects, runs sync
- `ChatMessage` and subtypes — unified JSON frame type definitions
- Frame I/O: `readFrame`, `writeFrame`, `readJsonFrame`, `writeJsonFrame`, `streamFileToSocket`, `receiveFileFromSocket`

## Dependencies

- `../service/file-meta-handler` — `getFileMetaHandler` (factory for scanning files and computing SHA1)
- `../service/diff-meta` — `diffMetaForSyncUp`, `serializeMetaDiff`
- `../service/asset-info` — `getPartialAssetInfo`, `serailizeAssetInfo`
- `../types` — `AssetInfoFull`, `AssetListMeta`, `MetaDiffForSyncUp`, `MetaHandlers`
- `../external` — `byteToWord` (human-readable sizes)

## Consumers

- `modules/lib/net/koa/middleware/assets/mw-tcp.ts` — TCP middleware wrapper, imports `ASSETS_SYNC_PROTOCOL_BYTE` and `handleAssetsSyncConnection` via `net/service/external.ts`
- `src/1-command/assets-sync.ts` — CLI wrapper, imports `runAssetsSyncCommand` directly
