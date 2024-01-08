import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';

const HOME_PATH = process.env.HOME;

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
    const toFind = path.resolve(currentPath, name);
    if (fs.existsSync(toFind)) {
      results.push(toFind);
    }
    currentPath = path.resolve(currentPath, '..');
  }

  return results;
}

/**
 * @returns relative path list to root
 */
export function readDirRecursive(
  root: string,
  /** option passed through each recursive without any change */
  option?: {
    dirFilter?: (baseName: string, relativePath: string) => boolean;
    fileFilter?: (baseName: string, relativePath: string) => boolean;
    includeDir?: boolean;
  },
  /** use for recursive: pass path related info */
  pathInfo?: {prefix: string; fileName: string},
  /** use for recursive: passed recursively, correct value in each recursive, and return as final data */
  files?: string[]
): string[] {
  pathInfo = pathInfo || {
    prefix: '',
    fileName: '',
  };
  const relativePath = path.join(pathInfo.prefix, pathInfo.fileName);
  files = files || [];
  const {dirFilter = () => true, fileFilter = () => true, includeDir = false} = option ? option : {};
  const fullpath = path.join(root, relativePath);
  if (!fs.existsSync(fullpath)) {
    return files;
  }
  if (fs.statSync(fullpath).isDirectory()) {
    if (!dirFilter(pathInfo.fileName, relativePath) && fullpath !== root) {
      return [];
    }
    if (includeDir) {
      files.push(`${relativePath}/`);
    }
    fs.readdirSync(fullpath).forEach(name => {
      readDirRecursive(
        root,
        option,
        {
          prefix: relativePath,
          fileName: name,
        },
        files
      );
    });
  } else {
    if (fileFilter(pathInfo.fileName, relativePath)) {
      files.push(relativePath);
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
        const curPath = path + '/' + file;
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

export function getFilePathInfo(fullPath: string): {
  dirPath: string;
  extName: string;
  fileName: string;
  fileBaseName: string;
} {
  const dirPath = path.dirname(fullPath);
  const extName = path.extname(fullPath);
  const fileName = path.basename(fullPath);
  const fileBaseName = path.basename(fileName, extName);
  const pathInfo = {
    dirPath,
    fileName,
    extName,
    fileBaseName,
  };
  return pathInfo;
}

interface LineCountInfo {
  fullPath: string;
  relativePath: string;
  lineCount: number;
}
export function getLineCount(filePath: string): LineCountInfo | LineCountInfo[] {
  if (!filePath) {
    filePath = '.';
  }
  const fullPath = path.resolve(filePath);
  const fStat = fs.statSync(fullPath);
  if (fStat.isDirectory()) {
    let totalCount = 0;
    const files = readDirRecursive(fullPath);
    return files.map(it => {
      const destFile = path.join(fullPath, it);
      const {lineCount} = getLineCount(destFile) as LineCountInfo;
      return {fullPath: destFile, relativePath: it, lineCount};
    });
  } else {
    const content = fs.readFileSync(fullPath);
    const lineCount = content.toString().split('\n').length;
    return {fullPath, relativePath: filePath, lineCount};
  }
}

export function writeFileSync(fullPath: string, data: string | NodeJS.ArrayBufferView) {
  const dirName = path.dirname(fullPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {recursive: true});
  }
  fs.writeFileSync(fullPath, data);
}
