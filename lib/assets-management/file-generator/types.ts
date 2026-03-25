export interface FileOperationResult {
  fullPath;
  relativePath;
  size;
}

export type Folder = 'a' | 'b' | 'c';

export interface BaseOptions {
  rootDir?: string;
}

export interface FolderOptions extends BaseOptions {
  folder: Folder;
}

export interface FileOptions extends FolderOptions {
  index: number;
}
