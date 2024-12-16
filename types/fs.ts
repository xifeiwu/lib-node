/** PathInfo for go through dir */
export interface PathInfoForRecur {
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
export type FileFilter = (pathInfo: PathInfoForRecur) => boolean;
export interface GoThroughDirOptions {
  /** Whether Go through/Ignore this dir or not */
  dirFilter?: FileFilter;
  /** Whether Ignore this dir or not */
  fileFilter?: FileFilter;
  /** max depth for dir. root dir is level 0 */
  maxDepth?: number;
  /** throw Error or not */
  ignoreError?: boolean;
}
export interface GetFileListOption extends GoThroughDirOptions {
  includeDir?: boolean;
}

export interface FilePathInfo {
  relativePath: string;
  fullPath: string;
  /** More accurate description for the file when there are the same relativePath exist in multiple dir */
  label: string;
}
export interface GetFileListInfo {
  targetDir: string;
  options?: GetFileListOption;
  getLabel?: (pathInfo: Omit<FilePathInfo, 'label'>) => string;
}
