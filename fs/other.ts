import fs from 'fs';
import path from 'path';

/**
 * NOTICE:
 * for link file, fs.existsSync or fs.statSync will throw error even link file exist,
 * so here use fs.lstatSync to check existence of link file
 */
export function isFileExist(filePath: string) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat) {
      return true;
    }
  } catch {
    return false;
  }
}

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
  try {
    const stat = fs.lstatSync(filepath);
    result.stat = stat;
    if (stat.isSymbolicLink() || stat.isFile()) {
      fs.unlinkSync(filepath);
    } else if (stat.isDirectory()) {
      fs.rmdirSync(filepath, {recursive: true});
    }
  } catch (err) {
    return result;
  }
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
export function linkFile(sourceFile: string, targetFile: string) {
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
  return linkFile(sourceFile, targetFile)
}

export function writeFileSync(fullPath: string, data: string | NodeJS.ArrayBufferView) {
  const dirName = path.dirname(fullPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {recursive: true});
  }
  fs.writeFileSync(fullPath, data);
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