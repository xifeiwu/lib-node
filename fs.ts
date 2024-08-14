import fs from 'fs';
import path from 'path';
import childProcess from 'child_process';
import {selectOption} from './general';
import {isNumber} from './external';
import {getFilePathInfo} from './path';

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
  /** filename */
  basename: string;
  /** relativePath to root dir */
  relativePath: string;
  depth: number;
}
/**
 * relativePath: path relative to root
 * baseName: one level filename, not include any child dir. like value return from path.basename
 */
export type FileFilter = (pathInfo: PathInfo) => boolean;
export interface GoThroughDirOptions {
  /** Whether Go through/Ignore this dir or not */
  dirFilter?: FileFilter;
  /** Whether Ignore this dir or not */
  fileFilter?: FileFilter;
  /** max depth for dir. root dir is level 0 */
  maxDepth?: number;
}
/**
 * @returns go through dir, and return value returned from cb function
 */
export function goThroughDir<T = any>(
  root: string,
  /**
   * Should take care about return value of cb function if want to get a correct structure by goThroughDir
   * Should return null if not want the item to be part of children list of parent dir
   */
  cb: (err: Error | null, res: {pathInfo: PathInfo; children?: T[]}) => T | null,
  /** option passed through each recursive without any change */
  options?: GoThroughDirOptions,
  /** use for recursive: pass path related info */
  pathInfo?: PathInfo
) {
  pathInfo = pathInfo || {
    basename: '',
    relativePath: '.',
    depth: 0,
  };
  // const relativePath = path.join(pathInfo.prefix, pathInfo.baseName);
  // pathInfo.relativePath = relativePath;
  const {relativePath, depth} = pathInfo;
  const {
    dirFilter = () => true,
    fileFilter = () => true,
    maxDepth,
  } = (options ? options : {}) as GoThroughDirOptions;
  const largerThanMaxDepth = (d: number) => isNumber(maxDepth) && d > maxDepth;
  if (largerThanMaxDepth(depth)) {
    return null;
  }
  const fullpath = path.join(root, relativePath);
  // if (!fs.existsSync(fullpath)) {
  // return cb(new Error(`File not exist: ${fullpath}`), {pathInfo});
  // }
  if (fs.statSync(fullpath).isDirectory()) {
    if (dirFilter(pathInfo)) {
      const fileListOfCurDir = fs.readdirSync(fullpath);
      const children = fileListOfCurDir
        .map(name => {
          const nextDepth = depth + 1;
          const child = goThroughDir(root, cb, options, {
            basename: name,
            relativePath: path.join(relativePath, name),
            depth: nextDepth,
          });
          return child;
        })
        .filter(it => it !== null && it !== undefined);
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
export function getFileInfoTree(root: string, options?: GoThroughDirOptions): FileInfoTreeItem {
  // const {dirFilter, fileFilter} = options ?? {};
  // const filterMode = Boolean(dirFilter || fileFilter);
  return goThroughDir<FileInfoTreeItem>(
    root,
    (err, {pathInfo, children}) => {
      if (err) {
        throw err;
      }
      const {relativePath} = pathInfo;
      // const isDir = Array.isArray(children);
      /** in filterMode, filter out dir info when it's children is empty */
      // if (filterMode) {
      //   if (isDir) {
      //     if (dirFilter) {
      //       if (!dirFilter(pathInfo)) {
      //         return null;
      //       }
      //     } else {
      //       if (children.length === 0) {
      //         return null;
      //       }
      //     }
      //   }
      // }
      const stat = fs.statSync(path.join(root, relativePath));
      return {stat, relativePath, children};
    },
    options
  );
}

// interface FileSize {
//   relativePath: string;
//   size: number;
//   children?: FileSize[];
// }
// export function getFileSizeTree(
//   root: string,
//   options?: {
//     sortChildren?: FlatChildrenOptions<FileSize>['sortChildren'];
//   }
// ) {
//   const {sortChildren = () => 0} = options ?? {};
//   const fileInfoTree = getFileInfoTree(root);
//   function toFileSize(fileInfo: FileInfoTreeItem): FileSize {
//     const {relativePath, stat, children} = fileInfo;
//     if (Array.isArray(children)) {
//       const childrenFileSize = children.map(toFileSize).sort(sortChildren);
//       const totalSize = childrenFileSize.reduce<number>((sum, it) => {
//         return sum + it.size;
//       }, 0);
//       return {
//         relativePath,
//         size: totalSize,
//         children: childrenFileSize,
//       };
//     } else {
//       return {
//         relativePath,
//         size: stat.size,
//       };
//     }
//   }
//   return toFileSize(fileInfoTree);
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
  return goThroughDir<LineCountMapItem>(
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

interface FlatChildrenOptions<T = any> {
  sortChildren?: (a: T, b: T) => number;
  includeDir?: boolean;
}
/**
 * mapInfo container more info. Can convert to list by this function for some usecase.
 * @param mapInfo
 * @param options
 * @returns
 */
export function flatChildren<T extends {children?: any[]}>(mapInfo: T, options?: FlatChildrenOptions) {
  const {sortChildren, includeDir = true} = options ?? {};
  function mapToList(map: T): T[] {
    const {children, ...others} = map;
    if (Array.isArray(children)) {
      if (sortChildren) {
        children.sort(sortChildren);
      }
      const reducedChildren = children.map(mapToList).reduce<T[]>((sum, it) => {
        return [...sum, ...it];
      }, []);
      if (includeDir) {
        return [map, ...reducedChildren];
      } else {
        return reducedChildren;
      }
    } else {
      return [map];
    }
  }
  return mapToList(mapInfo);
}

export function getFileInfoList(
  root: string,
  options?: FlatChildrenOptions<FileInfoTreeItem> & GoThroughDirOptions
): FileInfoTreeItem[] {
  const {includeDir, sortChildren, ...goThroughDirOptions} = options;
  const fileInfoTree = getFileInfoTree(root, goThroughDirOptions);
  const fileInfoList = flatChildren(fileInfoTree, {includeDir, sortChildren});
  return fileInfoList;
}

export interface GetFileListOption extends GoThroughDirOptions {
  includeDir?: boolean;
}
/**
 * @param root
 * @param options
 * @returns
 */
export function getFileList(root: string, options?: GetFileListOption) {
  const {includeDir, ...goThroughDirOptions} = options ?? {};
  const fileList: string[] = [];
  goThroughDir(
    root,
    (err, {pathInfo: {relativePath}, children}) => {
      if (err) {
        return null;
      }
      const isDir = Array.isArray(children);
      if (isDir && !includeDir) {
        return null;
      }
      fileList.push(relativePath);
    },
    goThroughDirOptions
  );
  return fileList;
}

export function getMultipleDirFileList(
  targetList: Array<{
    targetDir: string;
    options?: GetFileListOption;
  }>
): Array<{relativePath: string; fullPath: string}> {
  const allFiles = targetList.reduce<
    Array<{
      fullPath: string;
      relativePath: string;
    }>
  >((sum, it) => {
    const {targetDir, options} = it;
    const fileList = getFileList(targetDir, options);
    return [
      ...sum,
      ...fileList.map(relativePath => {
        return {
          relativePath,
          fullPath: path.join(targetDir, relativePath),
        };
      }),
    ];
  }, []);
  return allFiles;
}

export async function selectFileOfDir(
  targetList: Array<{
    targetDir: string;
    options?: GetFileListOption;
  }>
) {
  const fileList = getMultipleDirFileList(targetList);
  const {relativePath, fullPath} = await selectOption(
    fileList.map(it => {
      const {relativePath} = it;
      return {
        ...it,
        label: relativePath,
      };
    })
  );
  return {relativePath, fullPath};
}

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

export function makeSureDirExist(dirPath: string) {
  const fileExist = fs.existsSync(dirPath);
  if (!fileExist) {
    const res = fs.mkdirSync(dirPath, {recursive: true});
    return res;
  }
}
export function makeSureDirExistForFile(filePath: string) {
  const {dirname} = getFilePathInfo(filePath);
  return makeSureDirExist(dirname);
}

export function writeFileSync(fullPath: string, data: string | NodeJS.ArrayBufferView) {
  const dirName = path.dirname(fullPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {recursive: true});
  }
  fs.writeFileSync(fullPath, data);
}
