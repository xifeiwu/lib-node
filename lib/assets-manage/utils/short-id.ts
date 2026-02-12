import fs from 'fs';
import path from 'path';
import {getFileList, GetFileListOption} from '../external';
import {removeShortIdInFilePath} from '../service';

export function removeShortIdSuffixOfDir(
  targetDir: string,
  options?: {getFileListOption?: GetFileListOption}
) {
  const {
    getFileListOption = {
      dirFilter({basename}) {
        return !basename.startsWith('.');
      },
      fileFilter({basename}) {
        return !basename.startsWith('.');
      },
    },
  } = options ?? {};

  const fileList = getFileList(targetDir, getFileListOption);
  for (let relativePath of fileList) {
    const newRelativePath = removeShortIdInFilePath(relativePath);
    if (relativePath === newRelativePath) {
      continue;
    }
    const originPath = path.join(targetDir, relativePath);
    const targetPath = path.join(targetDir, newRelativePath);
    fs.renameSync(originPath, targetPath);
    console.log(`${originPath} -> ${targetPath}`);
  }
}
