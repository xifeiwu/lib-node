/**
 * All logics in this folder are related to assets management, by sequence:
 * 1. meta alignment, align the meta with the latest status of its assets
 * 2. asset deduplication, handle duplicate files in assets dir
 * 3. asset base operation, copy, move, delete, update on both meta and assets
 * 4. asset backup, backup the assets to a backup dir
 * They are based on meta handler, which is a wrapper of meta file.
 */
export * from './meta-align';
export * from './assets-operation';
export * from './assets-dedupe';
export * from './assets-backup';
