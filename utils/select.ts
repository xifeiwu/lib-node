import path from 'path';
import {selectFileFromDir} from '../fs';
import {FileFilter, FilePathInfo, GetFileListInfo} from '../types';

const tmpFileReg = /tmp[\d]*\.(ts|js)$/;
const filterTsFile: FileFilter = ({relativePath}) => ['.js', '.ts'].includes(path.extname(relativePath));
/**
 * selectOption with two customization:
 * 1. should ends with .js or .ts
 * 2. file name match /tmp[\d]*\.(ts|js)$/ should be at front
 */
export async function selectSourceFile(targetList: Array<GetFileListInfo>): Promise<FilePathInfo> {
  const selectedFile = await selectFileFromDir(
    targetList,
    // .map(it => {
    //   return {
    //     options: {
    //       fileFilter: filterTsFile,
    //     },
    //     ...it,
    //   };
    // }),
    {
      handleFileList(fileList) {
        return fileList.sort((pre, _next) => {
          return tmpFileReg.test(pre.relativePath) ? -1 : 1;
        });
      },
    }
  );
  return selectedFile;
}

export async function selectFileAndGetExports<T = any>(targetList: Array<GetFileListInfo>) {
  const {fullPath, relativePath} = await selectSourceFile(targetList);
  const allExports = (require(fullPath) ?? {}) as T;
  // const {payload} = allExports;
  // if (!payload) {
  //   throw new Error(`payload not export in file: ${fullPath}`);
  // }
  return {allExports, fullPath, relativePath};
}
