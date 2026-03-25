## Purpose

Generate file for assets management testing
Should have the ability while creating file:

1. identify size of file
2. can create content-duplicate file, that have same content of existing file.
3. create link file

## Concept

index: the id of file in EXISTING_FILES
size: size of file content
name: index + '.txt'

## Structure

- `index.ts` - File operations: create, delete, update, duplicate, link files
- `service.ts` - File index management: tracks existing files, computes paths/sizes, manages indices
- `types.ts` - Shared types: Folder, FileOperationResult
