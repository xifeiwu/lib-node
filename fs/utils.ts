import fs from 'fs';
import path from 'path';
import {selectOption} from '../readline';
import {rerequire} from '../service';
import {FilePathInfo, GetFileListInfo} from '../types';
import childProcess from 'child_process';
import {getFileListOfMultipleDir} from './find';
import {HOME_PATH} from './service';

export async function selectFileFromDir(
  targetDirInfoList: Array<GetFileListInfo>,
  options?: {
    /** sort file list before display */
    handleFileList?: (fileList: FilePathInfo[]) => FilePathInfo[];
  }
) {
  const {handleFileList = items => items} = options ?? {};
  const fileList = getFileListOfMultipleDir(targetDirInfoList);
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

export function findModulePath(moduleName: string, currentPath: string) {
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
