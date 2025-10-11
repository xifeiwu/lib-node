import fs from 'fs';
import path from 'path';
import {FilterItem, isNumber, isString, matchFilter} from '../external';
import {
  PathInfoForRecur,
  FileFilter,
  FilePathInfo,
  GetFileListInfo,
  GetFileListOption,
  GoThroughDirOptions,
  FileInfoTreeItem,
  GoThroughDirCb,
} from '../types';

/**
 * @returns go through dir, and return value returned from cb function
 */
export function goThroughDir<T = any>(
  root: string,
  /**
   * 1. About return value of cb function:
   * - Be serous about data returned from cb as the value will be treated as final result or tree item of final result
   * - Should return null if not want the item to be part of children list of parent dir
   * 2. If children passed to cb is array, it means current item is dir.
   */
  cb: GoThroughDirCb<T>,
  /** option passed through each recursive without any change */
  options?: GoThroughDirOptions,
  /** use for recursive: pass path related info */
  pathInfo?: PathInfoForRecur
) {
  pathInfo = pathInfo || {
    basename: '',
    relativePath: '.',
    depth: 0,
  };
  const {relativePath, depth} = pathInfo;
  const {
    dirFilter = () => true,
    fileFilter = () => true,
    maxDepth,
    ignoreError,
  } = (options ? options : {}) as GoThroughDirOptions;
  const largerThanMaxDepth = (d: number) => isNumber(maxDepth) && d > maxDepth;
  if (largerThanMaxDepth(depth)) {
    return null;
  }
  const fullpath = path.join(root, relativePath);
  if (!fs.existsSync(fullpath)) {
    return cb(new Error(`File not exist: ${fullpath}`), {pathInfo});
  }
  const stats = fs.statSync(fullpath);
  if (stats.isDirectory()) {
    if (depth === 0 || dirFilter(pathInfo, stats)) {
      let error = null;
      let fileListOfCurDir = [];
      try {
        /** Catch the error: EPERM: operation not permitted */
        fileListOfCurDir = fs.readdirSync(fullpath);
      } catch (err) {
        error = err;
      }
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
      return cb(ignoreError ? null : error, {pathInfo, children});
    }
  } else {
    if (fileFilter(pathInfo, stats)) {
      return cb(null, {pathInfo});
    }
  }
  return null;
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

export function getFileInfoTree(root: string, options?: GoThroughDirOptions): FileInfoTreeItem {
  if (!fs.existsSync(root)) {
    return null;
  }
  return goThroughDir<FileInfoTreeItem>(
    root,
    (err, {pathInfo, children}) => {
      if (err) {
        return null;
      }
      const {relativePath, basename} = pathInfo;
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
      const stats = fs.statSync(path.join(root, relativePath));
      return {stats, relativePath, basename, children};
    },
    options
  );
}

export function getFileInfoList(
  root: string,
  options?: FlatChildrenOptions<FileInfoTreeItem> & GoThroughDirOptions
): FileInfoTreeItem[] {
  const {includeDir, sortChildren, ...goThroughDirOptions} = options ?? {};
  const fileInfoTree = getFileInfoTree(root, goThroughDirOptions);
  if (!fileInfoTree) {
    return [];
  }
  const fileInfoList = flatChildren(fileInfoTree, {includeDir, sortChildren});
  return fileInfoList;
}

/**
 * Only return relativepath of file, dir is not included
 * It's a simple version of getFileInfoList
 * @param root
 * @param options
 * @returns relativePath list
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

function getLabelDefault(pathInfo: Omit<FilePathInfo, 'label'>) {
  const {relativePath} = pathInfo;
  return relativePath;
}
export function getFileListOfMultipleDir(targetDirInfoList: Array<GetFileListInfo>): Array<FilePathInfo> {
  const allFiles = targetDirInfoList.reduce<Array<FilePathInfo>>((sum, it) => {
    const {targetDir, options, getLabel = getLabelDefault} = it;
    const fileList = getFileList(targetDir, options);
    return [
      ...sum,
      ...fileList.map(relativePath => {
        const fullPath = path.join(targetDir, relativePath);
        return {
          relativePath,
          label: getLabel({relativePath, fullPath}),
          fullPath,
        };
      }),
    ];
  }, []);
  return allFiles;
}

interface LineCountMapItem {
  relativePath: string;
  lineCount: number;
  depth: number;
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
    (err, {pathInfo: {relativePath, depth}, children}) => {
      const fullPath = path.join(filePath, relativePath);
      if (Array.isArray(children)) {
        const lineCount = children.reduce<number>((sum, it) => {
          return sum + it.lineCount;
        }, 0);
        return {relativePath, lineCount, depth, children};
      } else {
        const content = fs.readFileSync(fullPath);
        const lineCount = content.toString().split('\n').length;
        return {relativePath, lineCount, depth};
      }
    },
    options
  );
}

interface SearchFileOptions {
  filter: FilterItem;
}
interface SearchFileResultMapItem {
  relativePath: string;
  fullpath: string;
  children?: SearchFileResultMapItem[];
}
export function searchFileInDir(dir: string, options?: SearchFileOptions) {
  const filter: FilterItem = isString(options.filter)
    ? (str: string) => str.includes(options.filter as string)
    : options.filter;
  const goThroughDirOptions: GoThroughDirOptions = {
    fileFilter({basename}) {
      const match = filter ? matchFilter(filter, basename) : true;
      return !basename.startsWith('.') && match;
    },
    dirFilter({basename}) {
      return !basename.startsWith('.');
    },
  };
  const dirPath = path.resolve(dir);
  const cb: GoThroughDirCb = (err, {pathInfo: {relativePath, depth}, children}) => {
    const fullpath = path.join(dirPath, relativePath);
    return {relativePath, fullpath, children};
  };
  const fileTree = goThroughDir<SearchFileResultMapItem>(dirPath, cb, goThroughDirOptions);
  const fileList = flatChildren(fileTree, {includeDir: false});
  return fileList;
}
