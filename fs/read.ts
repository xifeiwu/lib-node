import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import {HOME_PATH} from './service';

/**
 * NOTICE:
 * for link file, fs.existsSync or fs.statSync will throw error even link file exist,
 * so here use fs.lstatSync to check existence of link file
 */
export function isFileExist(filePath: string) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat) {
      return stat;
    }
  } catch {
    return false;
  }
}

export function getFileStat(filePath: string) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat) {
      return stat;
    }
  } catch {
    return null;
  }
}

/**
 * start from @param 'startDir', find upwards to find the file with name @param'targetFileName'
 * @param startDir, start dir
 * @param targetFileName, target file name
 */
export function findClosestFile(startDir: string, targetFileName: string): string | null {
  const fullPath = path.resolve(startDir, targetFileName);
  if (startDir == HOME_PATH || startDir == '/') {
    return null;
  }
  if (fs.existsSync(fullPath)) {
    return fullPath;
  } else {
    return findClosestFile(path.resolve(startDir, '..'), targetFileName);
  }
}

export function findModulePath(moduleName: string, currentPath: string) {
  const pathList = [];
  try {
    const globalDir = path.resolve(
      childProcess.execSync(`which node`).toString(),
      '../..',
      'lib/node_modules'
    );
    pathList.push(globalDir);
    pathList.push(path.resolve(currentPath, 'node_modules'));
    do {
      currentPath = path.resolve(currentPath, '..');
      if (!/.*node_modules$/.test(currentPath)) {
        pathList.push(path.resolve(currentPath, 'node_modules'));
      }
    } while (currentPath !== HOME_PATH);
  } catch (err) {
    console.log(err);
  }
  const fullPath = pathList.map(it => path.resolve(it, moduleName)).find(it => fs.existsSync(it));
  return fullPath;
}
