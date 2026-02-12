import fs from 'fs';
import path from 'path';
import {isFileExist} from './read';

/**
 * Remove file, directory, link
 * @param filepath
 * @returns
 */
export function removeFile(filepath: string) {
  const fullpath = path.resolve(filepath);
  const result: {
    fullpath: string;
    stat?: fs.Stats;
  } = {
    fullpath,
  };
  const stat = fs.lstatSync(filepath);
  result.stat = stat;
  if (stat.isSymbolicLink() || stat.isFile()) {
    fs.unlinkSync(filepath);
  } else if (stat.isDirectory()) {
    fs.rmdirSync(filepath, {recursive: true});
  }
  return result;
}

/**
 * @deprecated by removeFile
 * @param path
 */
export function recursiveDeleteFile(path: string) {
  if (fs.existsSync(path)) {
    if (fs.statSync(path).isFile()) {
      fs.unlinkSync(path);
    } else if (fs.statSync(path).isDirectory()) {
      fs.readdirSync(path).forEach((file, index) => {
        const curPath = path + '/' + file;
        if (fs.statSync(curPath).isDirectory()) {
          // recurse
          recursiveDeleteFile(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  } else {
    console.error(`Error: path ${path} not exist`);
  }
}

/**
 * @deprecated by linkFile
 */
export function link(sourceFile: string, targetFile: string) {
  // link can't be overrided, so remove it first
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`binFile not exist: ${sourceFile}`);
  }
  targetFile = path.resolve(targetFile);
  if (isFileExist(targetFile)) {
    fs.unlinkSync(targetFile);
  }
  const relativePath = path.relative(path.dirname(targetFile), sourceFile);
  fs.symlinkSync(relativePath, targetFile);
  return {sourceFile, targetFile, relativePath};
}
export function linkFile(sourceFile: string, targetFile: string) {
  return link(sourceFile, targetFile);
}

export function isInSameDevice(fullPath1: string, fullPath2: string) {
  try {
    const stat1 = fs.statSync(fullPath1);
    const stat2 = fs.statSync(fullPath2);
    return stat1.dev === stat2.dev;
  } catch (err) {
    return false;
  }
}

export function moveFile(fromPath: string, toPath: string) {
  fromPath = path.resolve(fromPath);
  toPath = path.resolve(toPath);
  if (isInSameDevice(fromPath, toPath)) {
    fs.renameSync(fromPath, fromPath);
  } else {
    fs.copyFileSync(fromPath, toPath);
    fs.unlinkSync(fromPath);
  }
}
