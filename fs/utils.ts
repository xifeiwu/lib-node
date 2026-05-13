import fs from 'fs';
import path from 'path';
import {selectOption} from '../readline';
import {rerequire} from '../service';
import {FilePathInfo, GetFileListInfo} from '../types';
import {getFileListOfDirs} from './go-through-dir';
import {findClosestFile} from './read';

export function isEsmPackage(filePath: string): boolean {
  const pkgPath = findClosestFile(path.dirname(filePath), 'package.json');
  if (!pkgPath) return false;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.type === 'module';
}

export async function selectFileFromDir(
  targetDirInfoList: Array<GetFileListInfo>,
  options?: {
    /** sort file list before display */
    handleFileList?: (fileList: FilePathInfo[]) => FilePathInfo[];
  }
) {
  const {handleFileList = items => items} = options ?? {};
  const fileList = getFileListOfDirs(targetDirInfoList);
  if (fileList.length === 0) {
    throw new Error(`fileList is empty for dir: ${targetDirInfoList.map(it => it.targetDir).join(', ')}`);
  }
  const selectedFileInfo = await selectOption<FilePathInfo>(handleFileList(fileList), {
    tips: ['Please select target file:'],
  });
  return selectedFileInfo;
}

export async function selectAndRequireFile<ContentType = any>(
  targetDirInfoList: Array<GetFileListInfo>,
  options?: {
    /** sort file list before display */
    handleFileList?: (fileList: FilePathInfo[]) => FilePathInfo[];
  }
) {
  const fileInfo = await selectFileFromDir(targetDirInfoList, options);
  if (!fileInfo.fullPath) {
    throw new Error(`The file selected not exist`);
  }
  const content = rerequire(fileInfo.fullPath);
  return content as ContentType;
}
