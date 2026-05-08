# Assets Management

Library for managing collections of large static files (images, videos, etc.) with content-addressed metadata. Tracks files via SHA1 hashes and short IDs, supports diffing between two asset directories, and provides operations for syncing, deduplication, backup, and import.

## Module Structure

| Directory | Purpose |
|-----------|---------|
| `types/` | Core type definitions: `AssetInfoFull`, `AssetMeta`, `MetaHandlers`, `MetaDiffForSyncUp`, etc. |
| `service/` | Core logic: file scanning, SHA1 hashing, meta persistence, diff computation, serialization |
| `operation/` | Higher-level operations: add/delete assets, dedupe, backup, import, meta alignment |
| `tcp-protocol/` | TCP-based asset sync protocol (client + server) for diff/pull/push operations |
| `file-generator/` | Test utility: deterministic file/folder generation for testing asset operations |

## Layering

`MetaHandlers` is the foundational abstraction — all higher layers operate through it rather than touching files or meta storage directly:

- `service/` defines `MetaHandlers` and its filesystem-backed factory (`getFileMetaHandler`)
- `operation/` takes a `MetaHandlers` instance as input and performs bulk operations (add, delete, dedupe, backup, import, align) by calling its CRUD methods
- `tcp-protocol/` takes a `MetaHandlers` instance (server) or creates one (client) to coordinate file transfer and meta updates during network sync

## Key Concepts

### Asset Identity

Each file is identified by:
- `relativePath` — path relative to the root directory (primary key for sync operations)
- `sha1` — SHA1 hash of file content (used for detecting moves, copies, deduplication)
- `shortId` — first 6 chars of SHA1 in base64url, optionally appended to filename as `[shortId]`

### Meta Storage

Asset metadata is stored as a tree structure (`AssetTreeMeta`) or flat list (`AssetListMeta`) in a JSON file alongside the asset directory. `MetaHandlers` provides the CRUD interface for reading, writing, and querying this metadata.

### MetaHandlers

Factory: `getFileMetaHandler()` returns `(rootDir) => Promise<MetaHandlers>`.

Key operations:
- `resetMeta()` — rescan the directory, recompute all SHA1 hashes, rebuild the meta file
- `getMeta()` — read current meta (from file if available, otherwise scan)
- `createOrUpdateItem()` / `removeItem()` — modify individual entries
- `getItemList()` — list all tracked assets

### Diff

`diffMetaForSyncUp(toMeta, fromMeta)` computes what changes `toMeta` needs to match `fromMeta`:
- `added` — files in `fromMeta` not in `toMeta`
- `deleted` — files in `toMeta` not in `fromMeta`
- `modified` — same `relativePath`, different content (SHA1 mismatch)
- `moved` — same SHA1, different `relativePath` (one-to-one)
- `copied` — same SHA1, source still exists in `toMeta`

## File Reference

### `service/`

| File | Purpose |
|------|---------|
| `config.ts` | Constants: `SHORT_ID_LENGTH`, `REG_SHORT_ID`, temp dir path |
| `short-id.ts` | Parse/append `[shortId]` suffixes in filenames |
| `asset-info.ts` | `getPartialAssetInfo`, `getFullAssetInfo`, `serailizeAssetInfo`, `diffAssets` |
| `assets-meta.ts` | Meta tree I/O: `readMetaFromDir`, `saveDirMeta`, `getAssetInfoListFromMeta`, `getAssetInfoById` |
| `diff-meta.ts` | `diffMetaForSyncUp`, `diffMetaForImportNew`, `serializeMetaDiff` |
| `file-meta-handler.ts` | `getFileMetaHandler` — factory for `MetaHandlers` backed by filesystem |

### `operation/`

| File | Purpose |
|------|---------|
| `asset-base-operation.ts` | `addAssetMeta`, `deleteAssetMeta` — add/remove files with meta updates |
| `meta-align.ts` | Align meta with actual filesystem state |
| `assets-dedupe.ts` | Find and remove duplicate files by SHA1 |
| `assets-backup.ts` | Backup assets to another directory |
| `assets-import.ts` | Import new files from an external directory |

### `tcp-protocol/`

See `tcp-protocol/CLAUDE.md` for details. TCP-based sync protocol with client (`runAssetsSyncCommand`) and server (`handleAssetsSyncConnection`).

## Dependencies

External dependencies (via `external.ts`):
- `modules/lib/js` — `formatDate`, `getRandomBase64String`, `byteToWord`, etc.
- `modules/lib/node` — `hashData`, `getFileInfoTree`, `goOnOrNot`, `removeFile`, file utilities

## Consumers

- `modules/lib/net/koa/middleware/assets/` — TCP middleware wrapper for the remote sync server
- `modules/lib/net/service/external.ts` — re-exports key functions for the net layer
- `src/1-command/assets-sync.ts` — CLI wrapper for the remote sync client
