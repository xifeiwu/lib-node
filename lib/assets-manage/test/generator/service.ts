import path from 'path';
import {getFileInfoList} from '../../external';
import {Folder} from './types';

export const STEP = 10;
// 10, 20, 30, 40, ..., 600
export const SIZE_LIST = new Array(60).fill('').map((_, index) => (index + 1) * STEP);

/**
 * Different from size, path will have extension .txt
 */
export function getRelativePath(folder: Folder, index: number) {
  const relativePath = `${folder}/${index.toString()}.txt`;
  return relativePath;
}

export function getFullPath(rootDir: string, folder: Folder, index: number) {
  return path.join(rootDir, getRelativePath(folder, index));
}

type ExistingFiles = Record<string, {[tag in Folder]: number[]}>;

/**
 * Record existing files in rootDir by file index
 */
export const FILE_INDEX: ExistingFiles = {};

export function getFileIndex(rootDir: string) {
  if (!FILE_INDEX[rootDir]) {
    FILE_INDEX[rootDir] = {
      a: [],
      b: [],
      c: [],
    };
  }
  return FILE_INDEX[rootDir];
}

/**
 * 10, 11, 12 have the same size and content
 */
export function getFileSizeByIndex(index: number) {
  return Math.floor(index / STEP) * STEP;
}

export function getFileIndexOfFolder(rootDir: string, folder: Folder) {
  const existingFiles = getFileIndex(rootDir);
  return existingFiles[folder];
}

export function isFileExist(rootDir: string, folder: Folder, index: number) {
  const existingFiles = getFileIndexOfFolder(rootDir, folder);
  return existingFiles.includes(index);
}

export function addToExistingFile(rootDir: string, folder: Folder, index: number) {
  if (isFileExist(rootDir, folder, index)) {
    throw new Error(`File already exist: ${getFullPath(rootDir, folder, index)}`);
  }
  const existingFiles = getFileIndexOfFolder(rootDir, folder);
  existingFiles.push(index);
  existingFiles.sort();
}

export function removeFromExistingFile(rootDir: string, folder: Folder, index: number) {
  const existingFiles = getFileIndex(rootDir);
  existingFiles[folder] = existingFiles[folder].filter(it => it !== index);
  existingFiles[folder].sort();
}

export function getNextNewFileIndex(rootDir: string, folder: Folder) {
  const existingFiles = getFileIndex(rootDir);
  const indexList = existingFiles[folder];
  return SIZE_LIST.find(it => !indexList.includes(it));
}
export function getNextDuplicateIndex(rootDir: string, folder: Folder, referIndex: number) {
  const existingFiles = getFileIndex(rootDir);
  const indexList = existingFiles[folder];
  if (!SIZE_LIST.includes(referIndex)) {
    throw new Error(`Can't found refer to index: ${referIndex}`);
  }
  let step = 1;
  let result = referIndex + step;
  while (step < 10) {
    if (indexList.includes(result)) {
      step++;
      result = referIndex + step;
    } else {
      return result;
    }
  }
  throw new Error(`Not found duplicate file name for referIndex: ${referIndex}`);
}

const REG_RELATIVE_PATH = /^([abc])\/([0-9]+).txt$/;
export function syncUpExistingFiles(rootDir: string) {
  const existingFiles = getFileIndex(rootDir);
  const fileInfoList = getFileInfoList(rootDir);
  for (const fileInfo of fileInfoList) {
    const {relativePath} = fileInfo;
    const execResult = REG_RELATIVE_PATH.exec(relativePath);
    if (!execResult) {
      throw new Error(`Not match relativePath reg: ${relativePath}`);
    }
    const [_, folder, size] = execResult;
    existingFiles[folder].push(parseInt(size, 10));
  }
  return existingFiles;
}
