import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
const HOME_PATH = process.env['HOME'];
/**
 * start from @param 'dir', find one file with @param'name' upwards
 * @param dir, start dir
 * @param name, target file name
 */
export function findClosestFile(dir: string, name: string): string | null {
  let fullPath = path.resolve(dir, name);
  if (dir == HOME_PATH || dir == '/') {
    return null;
  }
  if (fs.existsSync(fullPath)) {
    return fullPath;
  } else {
    return findClosestFile(path.resolve(dir, '..'), name);
  }
}

/**
 * start from @param 'dir', find file list with @param'name' upwards
 * @param dir, start dir
 * @param name, target file name
 */
export function findFileListByNameUpward(dir: string, name: string) {
  const results = [];
  let currentPath = dir;
  while (currentPath !== HOME_PATH && currentPath !== '/' && currentPath !== null) {
    // console.log(currentPath);
    var toFind = path.resolve(currentPath, name);
    if (fs.existsSync(toFind)) {
      results.push(toFind);
    }
    currentPath = path.resolve(currentPath, '..');
  }

  return results;
}

export function readDirRecursive(
  root: string,
  option?: {
    dirFilter?: (fullpath: string) => boolean;
    fileFilter?: (fullpath: string) => boolean;
    includeDir?: boolean;
  },
  files?: string[],
  prefix?: string
): string[] {
  prefix = prefix || '';
  files = files || [];
  // filter = filter || (() => true);
  const {dirFilter = () => true, fileFilter = () => true, includeDir = false} = option ? option : {};
  const fullpath = path.join(root, prefix);
  if (!fs.existsSync(fullpath)) return files;
  if (fs.statSync(fullpath).isDirectory()) {
    if (!dirFilter(fullpath) && fullpath !== root) {
      return [];
    }
    if (includeDir) {
      files.push(`${prefix}/`);
    }
    fs.readdirSync(fullpath)
      .forEach((name) => {
        readDirRecursive(root, option, files, path.join(prefix as string, name));
      });
  } else {
    if (fileFilter(fullpath)) {
      files.push(prefix);
    }
  }
  return files;
}

export function deleteFile(path: string) {
  if (fs.existsSync(path)) {
    if (fs.statSync(path).isFile()) {
      fs.unlinkSync(path);
    } else if (fs.statSync(path).isDirectory()) {
      fs.readdirSync(path).forEach((file, index) => {
        var curPath = path + '/' + file;
        if (fs.statSync(curPath).isDirectory()) {
          // recurse
          deleteFile(curPath);
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

export function getModulePath(moduleName: string, currentPath: string) {
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
