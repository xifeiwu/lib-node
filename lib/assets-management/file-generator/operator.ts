import fs from 'fs';
import path from 'path';
import {getRandomBase64String, getSequentialBase64String, removeFile, writeFileSync} from '../external';
import {
  addToFileIndex,
  DEFAULT_ROOT_DIR,
  getFileSizeByIndex,
  getFullPath,
  getNextDuplicateIndex,
  getNextNewFileIndex,
  getRelativePath,
  removeFromFileIndex,
} from './file-index';
import {BaseOptions, FileOperationResult, FileOptions, Folder, FolderOptions} from './types';
import {getFileStat, linkFile} from '../external';

function createFile(options: FileOptions & {content?: string}) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, index, content: inputContent} = options;
  const fullPath = getFullPath({rootDir, folder, index});
  if (fs.existsSync(fullPath)) {
    throw new Error(`file already exist: ${fullPath}`);
  }
  const size = getFileSizeByIndex(index);
  /** By default,make the same size file have the same content */
  const content = inputContent ?? getSequentialBase64String(size);
  writeFileSync(fullPath, content);
  addToFileIndex({rootDir, folder, index});
  return {fullPath, relativePath: getRelativePath(folder, index), size, index};
}

export function createNewFile(options: FolderOptions & {index?: number}) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, index: inputIndex} = options;
  const index = inputIndex ?? getNextNewFileIndex({rootDir, folder});
  return createFile({rootDir, folder, index});
}

export function createNewFiles(options: FolderOptions & {count?: number}) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, count = 1} = options;
  let i = 0;
  const results: FileOperationResult[] = [];
  while (i++ < count) {
    results.push(createNewFile({rootDir, folder}));
  }
  return results;
}

export function createDuplicateFile(options: FolderOptions & {referName: number}) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, referName} = options;
  const index = getNextDuplicateIndex({rootDir, folder, referIndex: referName});
  return createFile({rootDir, folder, index});
}

export function updateFileContent(options: FileOptions) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, index} = options;
  const relativePath = getRelativePath(folder, index);
  const fullPath = path.join(rootDir, relativePath);
  const stat = getFileStat(fullPath);
  if (!stat) {
    throw new Error(`fail to get stat of file: ${fullPath}`);
  }
  const {size} = stat;
  const content = getRandomBase64String(size);
  fs.writeFileSync(fullPath, content);
  return {fullPath, relativePath, size};
}

export function deleteFile(options: FileOptions) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, index} = options;
  const relativePath = getRelativePath(folder, index);
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  fs.unlinkSync(fullPath);
  removeFromFileIndex({rootDir, folder, index});
  return {fullPath, relativePath, size: getFileStat(fullPath)?.size};
}

export function createLinkFile(options: FolderOptions & {sourceIndex: number; targetName: string}) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, sourceIndex, targetName} = options;
  const sourceRelativePath = getRelativePath(folder, sourceIndex);
  const sourceFile = path.join(rootDir, sourceRelativePath);
  if (!fs.existsSync(sourceFile)) {
    return null;
  }
  const targetFile = path.resolve(path.join(rootDir, folder), targetName);
  linkFile(sourceFile, targetFile);
  return {sourceFile, sourceRelativePath, targetFile};
}

export function removeDataDir(options: BaseOptions = {}) {
  const {rootDir = DEFAULT_ROOT_DIR} = options;
  if (fs.existsSync(rootDir)) {
    removeFile(rootDir);
  }
}
