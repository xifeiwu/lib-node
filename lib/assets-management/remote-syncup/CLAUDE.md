# Remote Syncup

TCP-based asset sync library for transferring large static files between a client and a server. Designed for files not suitable for git. Reusable from any context — the TCP middleware wrapper (`net/koa/middleware/assets/`) and CLI (`src/1-command/assets-sync.ts`) are thin consumers of this module.

## Wire Protocol

Protocol identification byte: `0x10`. The TCP gateway reads the first byte of each non-HTTP connection and dispatches by numeric value.

Frame format: `[4 bytes big-endian uint32 length][payload]`. JSON for control messages, raw bytes for file data. The protocol is sequential — both sides know the expected type at each step.

### Connection Flow

```
C→S: [0x10]                                     protocol byte
C→S: frame{command: "push"|"pull"|"diff", meta}  AssetListMeta (serialized)
S→C: frame{diff}                                 MetaDiffForSyncUp (serialized)

(diff: connection closes here)

(push/pull, after client-side user confirmation:)
C→S: frame{confirmed: true|false}

push — client sends files:
  C→S: frame{file: relativePath, size: N}        per-file header
  C→S: frame[N bytes]                            per-file data
  C→S: frame{transferComplete: true}
  S→C: frame{success: true, git?: {...}}

pull — server sends files:
  S→C: frame{file: relativePath, size: N}
  S→C: frame[N bytes]
  S→C: frame{transferComplete: true}
```

### Diff Semantics

- **push**: `diffMetaForSyncUp(serverMeta, clientMeta)` — what server needs to match client
- **pull**: `diffMetaForSyncUp(clientMeta, serverMeta)` — what client needs to match server

Files to transfer = `added` + `modified` (from the `fromMeta` side). `moved`/`copied` are handled locally on the receiver. `deleted` files are removed on the receiver.

## File Structure

| File | Purpose |
|------|---------|
| `protocol.ts` | Protocol byte constant, frame I/O utilities (`readExactly`/`readFrame`/`writeFrame`/`readJsonFrame`/`writeJsonFrame`), file streaming helpers (`streamFileToSocket`/`writeFileFrame`/`receiveFileFromSocket`) |
| `server.ts` | Server-side handler (`handleAssetsSyncConnection`), `handlePush`/`handlePull`, `gitSyncUp` |
| `client.ts` | Client-side logic (`runAssetsSyncCommand`), local meta scanning, diff display, push/pull file transfer |
| `index.ts` | Re-exports all three modules |

## Key Exports

- `ASSETS_SYNC_PROTOCOL_BYTE` — `0x10`, used by TCP middleware to identify this protocol
- `handleAssetsSyncConnection(socket, config)` — server entry point, handles the full protocol lifecycle
- `AssetsSyncServerConfig` — `{dir: string; git?: string}`
- `runAssetsSyncCommand(command, dir, options)` — client entry point, scans local files, connects, runs sync
- Frame I/O: `readFrame`, `writeFrame`, `readJsonFrame`, `writeJsonFrame`, `writeFileFrame`, `receiveFileFromSocket`

## Dependencies

- `../service/file-meta-handler` — `getFileMetaHandler` (factory for scanning files and computing SHA1)
- `../service/diff-meta` — `diffMetaForSyncUp`, `serializeMetaDiff`
- `../service/asset-info` — `getPartialAssetInfo`, `serailizeAssetInfo`
- `../service/assets-meta` — `getAssetInfoListFromMeta`
- `../types` — `AssetInfoFull`, `AssetListMeta`, `MetaDiffForSyncUp`, `MetaHandlers`
- `../external` — `goOnOrNot` (readline confirmation), `byteToWord` (human-readable sizes)

## Consumers

- `modules/lib/net/koa/middleware/assets/mw-tcp.ts` — TCP middleware wrapper, imports `ASSETS_SYNC_PROTOCOL_BYTE` and `handleAssetsSyncConnection` via `net/service/external.ts`
- `src/1-command/assets-sync.ts` — CLI wrapper, imports `runAssetsSyncCommand` directly
