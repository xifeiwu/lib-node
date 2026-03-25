import path from 'path';
import {getFileInfoList} from '../external';
import {BaseOptions, FileOptions, Folder, FolderOptions} from './types';

export const DEFAULT_ROOT_DIR = path.join(__dirname, '.tmp');

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

export function getFullPath(options: FileOptions) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, index} = options;
  return path.join(rootDir, getRelativePath(folder, index));
}

type FileIndex = Record<string, {[tag in Folder]: number[]}>;

/**
 * Record existing files in rootDir by file index
 */
export const FILE_INDEX: FileIndex = {};

export function getFileIndex(options: BaseOptions = {}) {
  const {rootDir = DEFAULT_ROOT_DIR} = options;
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

export function getFileIndexOfFolder(options: FolderOptions) {
  const existingFiles = getFileIndex(options);
  return existingFiles[options.folder];
}

export function isFileExist(options: FileOptions) {
  const existingFiles = getFileIndexOfFolder(options);
  return existingFiles.includes(options.index);
}

/**
 * add file index to file index directly, with out create new file
 */
export function addToFileIndex(options: FileOptions) {
  if (isFileExist(options)) {
    throw new Error(`File already exist: ${getFullPath(options)}`);
  }
  const existingFiles = getFileIndexOfFolder(options);
  existingFiles.push(options.index);
  existingFiles.sort();
}

export function removeFromFileIndex(options: FileOptions) {
  const {rootDir = DEFAULT_ROOT_DIR, folder, index} = options;
  const existingFiles = getFileIndex({rootDir});
  existingFiles[folder] = existingFiles[folder].filter(it => it !== index);
  existingFiles[folder].sort();
}

export function getNextNewFileIndex(options: FolderOptions) {
  const existingFiles = getFileIndex(options);
  const indexList = existingFiles[options.folder];
  return SIZE_LIST.find(it => !indexList.includes(it));
}

export function getNextDuplicateIndex(options: FolderOptions & {referIndex: number}) {
  const {referIndex} = options;
  const existingFiles = getFileIndex(options);
  const indexList = existingFiles[options.folder];
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
export function syncUpExistingFiles(options: BaseOptions = {}) {
  const {rootDir = DEFAULT_ROOT_DIR} = options;
  const existingFiles = getFileIndex({rootDir});
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
