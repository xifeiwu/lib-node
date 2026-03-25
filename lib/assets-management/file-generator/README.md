## Purpose

Generate files for assets management testing.

Capabilities:
1. Create files with deterministic content based on size (same size = same content)
2. Create content-duplicate files (same content as an existing file, different name)
3. Create symlink files
4. Delete, update file content
5. Track created files via an in-memory file index

Default rootDir: `__dirname/.tmp`

## Concepts

- **Folder**: subfolder under rootDir, one of `'a' | 'b' | 'c'`
- **Index**: the numeric id of a file, used as filename (`{index}.txt`) and to derive size
- **Size**: `Math.floor(index / 10) * 10` — indices 10-19 share the same size (10), 20-29 share size 20, etc.
- **Duplicate file**: a file whose index falls in the same size group as another (e.g. index 11 duplicates index 10)
- **File index**: in-memory registry (`FILE_INDEX`) tracking which indices exist per rootDir/folder

## Structure

- `index.ts` — Re-exports from `operator` and `utils`
- `operator.ts` — File operations:
  - `createNewFile` — create a file at the next available index (or a given index)
  - `createNewFiles` — create multiple new files in a folder
  - `createDuplicateFile` — create a file with same content as `referName` index
  - `updateFileContent` — overwrite a file with random content of the same size
  - `deleteFile` — delete a file and remove from file index
  - `createLinkFile` — create a symlink to an existing file
  - `removeDataDir` — remove the entire rootDir
- `file-index.ts` — File index management:
  - `FILE_INDEX` / `getFileIndex` — in-memory registry of existing file indices per rootDir
  - `addToFileIndex` / `removeFromFileIndex` — register/unregister a file index
  - `getNextNewFileIndex` — find the next unused index (multiples of 10)
  - `getNextDuplicateIndex` — find the next available index in the same size group
  - `syncUpExistingFiles` — scan rootDir and populate file index from actual files on disk
  - `getRelativePath` / `getFullPath` — path helpers
  - `getFileSizeByIndex` — derive file size from index
- `utils.ts` — `initSampleAssets` — creates a standard set of test files (a10-a50, a11 duplicate, b10-b20, a30 link)
- `types.ts` — `Folder`, `BaseOptions`, `FolderOptions`, `FileOptions`, `FileOperationResult`
- `test.ts` — Quick test entry point
