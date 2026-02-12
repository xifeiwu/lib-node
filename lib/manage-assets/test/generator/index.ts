/**
 *
 */
import fs from 'fs';
import path from 'path';
import {getRandomBase64String, getSequentialBase64String, removeFile, writeFileSync} from '../../external';
import {
  STEP,
  addToExistingFile,
  getFileSizeByIndex,
  getFullPath,
  getNextDuplicateIndex,
  getNextNewFileIndex,
  getRelativePath,
  removeFromExistingFile,
} from './service';
import {FileOperationResult, Folder} from './types';
import {getFileStat, linkFile} from '../../../../fs';

function createFile(rootDir: string, folder: Folder, index: number, content?: string) {
  const fullPath = getFullPath(rootDir, folder, index);
  if (fs.existsSync(fullPath)) {
    throw new Error(`file already exist: ${fullPath}`);
  }
  const size = getFileSizeByIndex(index);
  /** By default,make the same size file have the same content */
  content = content ?? getSequentialBase64String(size);
  writeFileSync(fullPath, content);
  addToExistingFile(rootDir, folder, index);
  return {fullPath, relativePath: getRelativePath(folder, index), size, index};
}

export function createNewFile(rootDir: string, folder: Folder, index?: number) {
  index = index ?? getNextNewFileIndex(rootDir, folder);
  return createFile(rootDir, folder, index);
}

export function createNewFiles(rootDir: string, folder: Folder, count: number = 1) {
  let i = 0;
  const results: FileOperationResult[] = [];
  while (i++ < count) {
    results.push(createNewFile(rootDir, folder));
  }
  return results;
}

export function createDuplicateFile(rootDir: string, folder: Folder, referName: number) {
  const index = getNextDuplicateIndex(rootDir, folder, referName);
  return createFile(rootDir, folder, index);
}

export function updateFileContent(rootDir: string, folder: Folder, index: number) {
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

export function deleteFile(rootDir: string, folder: Folder, index: number) {
  const relativePath = getRelativePath(folder, index);
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  fs.unlinkSync(fullPath);
  removeFromExistingFile(rootDir, folder, index);
  return {fullPath, relativePath, size: getFileStat(fullPath)?.size};
}

export function link(rootDir: string, folder: Folder, sourceIndex: number, targetName: string) {
  const sourceRelativePath = getRelativePath(folder, sourceIndex);
  const sourceFile = path.join(rootDir, sourceRelativePath);
  if (!fs.existsSync(sourceFile)) {
    return null;
  }
  const targetFile = path.resolve(path.join(rootDir, folder), targetName);
  linkFile(sourceFile, targetFile);
  return {sourceFile, sourceRelativePath, targetFile};
}

export function removeDataDir(rootDir: string) {
  if (fs.existsSync(rootDir)) {
    removeFile(rootDir);
  }
}
