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

interface PathInfo {
  baseName: string;
  relativePath: string;
  depth: number;
}
/**
 * relativePath: path relative to root
 * baseName: one level filename, not include any child dir. like value return from path.basename
 */
type FileFilter = (pathInfo: PathInfo) => boolean;
/**
 * @returns relative path list to root
 */
export function readDirRecursive<T = any>(
  root: string,
  cb: (err: Error | null, res: {pathInfo: PathInfo; children?: T[]}) => T | null,
  /** option passed through each recursive without any change */
  option?: {
    dirFilter?: FileFilter;
    fileFilter?: FileFilter;
  },
  /** use for recursive: pass path related info */
  pathInfo?: PathInfo
) {
  pathInfo = pathInfo || {
    baseName: '',
    relativePath: '.',
    depth: 0,
  };
  // const relativePath = path.join(pathInfo.prefix, pathInfo.baseName);
  // pathInfo.relativePath = relativePath;
  const {relativePath, depth} = pathInfo;
  const {dirFilter = () => true, fileFilter = () => true} = option ? option : {};
  const fullpath = path.join(root, relativePath);
  if (!fs.existsSync(fullpath)) {
    return cb(new Error(`Not exist: ${fullpath}`), {pathInfo});
  }
  if (fs.statSync(fullpath).isDirectory()) {
    if (dirFilter(pathInfo)) {
      const children = fs
        .readdirSync(fullpath)
        .map(baseName => {
          const child = readDirRecursive(root, cb, option, {
            baseName,
            relativePath: path.join(relativePath, baseName),
            depth: depth + 1,
          });
          return child;
        })
        .filter(it => it !== null);
      return cb(null, {pathInfo, children});
    }
  } else {
    if (fileFilter(pathInfo)) {
      return cb(null, {pathInfo});
    }
  }
  return null;
}

export interface FileInfoTreeItem {
  relativePath: string;
  stat: fs.Stats;
  children?: FileInfoTreeItem[];
}
export function getFileInfoTree(
  root: string,
  options?: {
    dirFilter?: FileFilter;
    fileFilter?: FileFilter;
  }
): FileInfoTreeItem {
  const {dirFilter, fileFilter} = options ?? {};
  const filterMode = Boolean(dirFilter || fileFilter);
  return readDirRecursive<FileInfoTreeItem>(
    root,
    (err, {pathInfo, children}) => {
      if (err) {
        throw err;
        // return null;
      }
      const {relativePath} = pathInfo;
      const isDir = Array.isArray(children);
      /** in filterMode, filter out dir info when it's children is empty */
      if (filterMode) {
        if (isDir) {
          if (dirFilter) {
            if (!dirFilter(pathInfo)) {
              return null;
            }
          } else {
            if (children.length === 0) {
              return null;
            }
          }
        }
      }
      const stat = fs.statSync(path.join(root, relativePath));
      return {stat, relativePath, children};
    },
    options
  );
}

/**
 * mapInfo container more info. Can convert to list by this function for some usecase.
 * @param mapInfo
 * @param options
 * @returns
 */
export function flatChildren<T extends {children?: any[]}>(
  mapInfo: T,
  options?: {sortChildren?: (a: T, b: T) => number; ignoreParent?: boolean}
) {
  const {sortChildren, ignoreParent} = options ?? {};
  function mapToList(map: T): T[] {
    const {children, ...others} = map;
    if (Array.isArray(children)) {
      if (sortChildren) {
        children.sort(sortChildren);
      }
      const reducedChildren = children.map(mapToList).reduce<T[]>((sum, it) => {
        return [...sum, ...it];
      }, []);
      if (ignoreParent) {
        return reducedChildren;
      } else {
        return [map, ...reducedChildren];
      }
    } else {
      return [map];
    }
  }
  return mapToList(mapInfo);
}

interface FileSize {
  relativePath: string;
  size: number;
  children?: FileSize[];
}
export function getFileSizeTree(
  root: string,
  options?: {
    sortChildren?: (prev: FileSize, next: FileSize) => number;
  }
) {
  const {sortChildren = () => 0} = options ?? {};
  const fileInfoTree = getFileInfoTree(root);
  function toFileSize(fileInfo: FileInfoTreeItem): FileSize {
    const {relativePath, stat, children} = fileInfo;
    if (Array.isArray(children)) {
      const childrenFileSize = children.map(toFileSize).sort(sortChildren);
      const totalSize = childrenFileSize.reduce<number>((sum, it) => {
        return sum + it.size;
      }, 0);
      return {
        relativePath,
        size: totalSize,
        children: childrenFileSize,
      };
    } else {
      return {
        relativePath,
        size: stat.size,
      };
    }
  }
  return toFileSize(fileInfoTree);
}
// export function getFileSizeList() {
//   const fileInfoTree = getFileInfoTree(__dirname);
//   function getFileSize(it: FileInfoTreeItem): FileSize {
//     const {relativePath, stat, children} = it;
//     if (stat.isDirectory()) {
//       /** sort child by size */
//       const childrenInfo = children.map(getFileSize).sort((prev, next) => {
//         return next.size - prev.size;
//       });
//       const totalSize = childrenInfo.reduce<number>((sum, it) => {
//         return sum + it.size;
//       }, 0);
//       return {
//         relativePath,
//         children: childrenInfo,
//         size: totalSize,
//       };
//     } else {
//       return {relativePath, size: stat.size};
//     }
//   }
//   const fileSizeInfo = getFileSize(fileInfoTree);
//   console.log(fileSizeInfo);
// }

interface LineCountMapItem {
  relativePath: string;
  lineCount: number;
  children?: LineCountMapItem[];
}
export function getLineCountMap(
  filePath: string,
  options?: {
    dirFilter?: FileFilter;
    fileFilter?: FileFilter;
  }
): LineCountMapItem {
  if (!filePath) {
    filePath = '.';
  }
  const fullPath = path.resolve(filePath);
  return readDirRecursive<LineCountMapItem>(
    fullPath,
    (err, {pathInfo: {relativePath}, children}) => {
      const fullPath = path.join(filePath, relativePath);
      if (Array.isArray(children)) {
        const lineCount = children.reduce<number>((sum, it) => {
          return sum + it.lineCount;
        }, 0);
        return {relativePath, lineCount, children};
      } else {
        const content = fs.readFileSync(fullPath);
        const lineCount = content.toString().split('\n').length;
        return {relativePath, lineCount};
      }
    },
    options
  );
}

/**
 * @deprecated replaced by getFileInfoTree, flatChildren
 * @param root
 * @param options
 * @returns
 */
export function getFileList(
  root: string,
  options?: {
    dirFilter?: FileFilter;
    fileFilter?: FileFilter;
    includeDir?: boolean;
  }
) {
  const {includeDir = false} = options ?? {};
  const fileList: string[] = [];
  readDirRecursive(
    root,
    (err, {pathInfo: {relativePath}, children}) => {
      if (err) {
        return null;
      }
      if (Array.isArray(children) && !includeDir) {
        return null;
      }
      fileList.push(relativePath);
    },
    options
  );
  return fileList;
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

export function writeFileSync(fullPath: string, data: string | NodeJS.ArrayBufferView) {
  const dirName = path.dirname(fullPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {recursive: true});
  }
  fs.writeFileSync(fullPath, data);
}
