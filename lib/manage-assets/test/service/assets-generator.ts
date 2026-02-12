/**
 *
 */
import fs from 'fs';
import path from 'path';
import {
  getFileInfoList,
  getRandomBase64String,
  getSequentialBase64String,
  removeFile,
  writeFileSync,
} from '../../external';

interface FileOperationResult {
  fullPath;
  relativePath;
  size;
}

export type Folder = 'a' | 'b';
const STEP = 10;
// 10, 20, 30, 40,
const SIZE_LIST = new Array(60).fill('').map((_, index) => (index + 1) * STEP);

function getRelativePath(folder: Folder, size: number) {
  const relativePath = `${folder}/${size}.txt`;
  return relativePath;
}

type ExistingFiles = Record<string, {[tag in Folder]: number[]}>;
const allExistingFiles: ExistingFiles = {};

function getExistingFiles(rootDir: string) {
  if (!allExistingFiles[rootDir]) {
    allExistingFiles[rootDir] = {
      a: [],
      b: [],
    };
  }
  return allExistingFiles[rootDir];
}

function getIndex(size: number) {
  return Math.floor(size / STEP) * STEP;
}

export function removeDataDir(rootDir: string) {
  if (fs.existsSync(rootDir)) {
    removeFile(rootDir);
  }
}

const REG_RELATIVE_PATH = /^([ab])\/([0-9]+).txt$/;
export function syncUpExistingFiles(rootDir: string) {
  const existingFiles = getExistingFiles(rootDir);
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

function createFile(rootDir: string, folder: Folder, size: number, content?: string) {
  const existingFiles = getExistingFiles(rootDir);
  const relativePath = getRelativePath(folder, size);
  const fullPath = path.join(rootDir, relativePath);
  if (fs.existsSync(fullPath)) {
    throw new Error(`file already exist: ${fullPath}`);
  }
  // 10, 11 have the same content
  const realSize = Math.floor(size / STEP) * STEP;
  content = content ?? getSequentialBase64String(realSize);
  writeFileSync(fullPath, content);
  existingFiles[folder].push(size);
  existingFiles[folder].sort();
  return {fullPath, relativePath, size};
}

export function deleteFile(rootDir: string, folder: Folder, size: number) {
  const existingFiles = getExistingFiles(rootDir);
  const relativePath = getRelativePath(folder, size);
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  fs.unlinkSync(fullPath);
  existingFiles[folder] = existingFiles[folder].filter(it => it !== size);
  return {fullPath, relativePath, size};
}

function getNameForCreatingDuplicateFile(rootDir: string, folder: Folder, referIndex: number) {
  const existingFiles = getExistingFiles(rootDir);
  const sizeList = existingFiles[folder];
  const duplicateInfo = sizeList.reduce<Record<string, number>>((sum, size) => {
    const index = getIndex(size);
    if (sum[index] === undefined) {
      sum[index] = 0;
    }
    sum[index]++;
    return sum;
  }, {});
  const info = Object.entries(duplicateInfo);
  if (info.length === 0) {
    throw new Error(`File count of folder ${folder} is empty`);
  }
  // if (referIndex !== undefined) {
  if (
    !info.find(([index]) => {
      return parseInt(index) === referIndex;
    })
  ) {
    throw new Error(`Can't found refer to index: ${referIndex}`);
  }
  // } else {
  //   const {value} = await selectOption<{label: string; value: number}>(
  //     info.map(([index, count]) => {
  //       return {
  //         label: `${index} [${count}]`,
  //         value: count,
  //       };
  //     }),
  //     {
  //       tip: 'Select the file want to duplicate',
  //     }
  //   );
  //   referIndex = value;
  // }
  let step = 1;
  while (sizeList.includes(referIndex + step) && step < 10) {
    step++;
  }
  if (step >= 10) {
    throw new Error(`not found duplicate file name for referIndex: ${referIndex}`);
  }
  return referIndex + step;
}

export function createNewFile(rootDir: string, folder: Folder, size?: number, content?: string) {
  const existingFiles = getExistingFiles(rootDir);
  const sizeList = existingFiles[folder];
  if (size !== undefined) {
    if (sizeList.includes(size)) {
      throw new Error(`Can't createNewFile: ${size} as it already exist`);
    }
  } else {
    size = SIZE_LIST.find(it => !sizeList.includes(it));
  }
  return createFile(rootDir, folder, size, content);
}

export function createNewFiles(rootDir: string, folder: Folder, count: number = 1) {
  let i = 0;
  const results: FileOperationResult[] = [];
  while (i++ < count) {
    results.push(createNewFile(rootDir, folder));
  }
  return results;
}

export function createDuplicateFile(rootDir: string, folder: Folder, index: number) {
  const size = getNameForCreatingDuplicateFile(rootDir, folder, index);
  return createFile(rootDir, folder, size);
}

export function updateFile(rootDir: string, folder: Folder, size: number) {
  const relativePath = getRelativePath(folder, size);
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`file to update not exist: ${fullPath}`);
  }
  const content = getRandomBase64String(size);
  fs.writeFileSync(fullPath, content);
  return {fullPath, relativePath, size};
}
