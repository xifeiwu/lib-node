import fs from 'fs';
import path from 'path';
import {addDtSuffixToBareBasename} from '../path';
import {PartialExcept} from '../types/external';
import {convertObjectToCjsExport} from '../transform';

interface DataWriterOptions {
  dir: string;
  subdir?: string;
  basename: string;
  dtFormat?: string;
  createDirIfNotExist?: boolean;
}

export function writeFileSync(
  fullPath: string,
  data: string | NodeJS.ArrayBufferView,
  options?: {
    createDirIfNotExist?: boolean;
  }
) {
  const {createDirIfNotExist = true} = options ?? {};
  const dirName = path.dirname(fullPath);
  if (createDirIfNotExist && !fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {recursive: true});
  }
  fs.writeFileSync(fullPath, data);
}

export function getFullPath(config: Pick<DataWriterOptions, 'dir' | 'subdir' | 'basename' | 'dtFormat'>) {
  const {dir, subdir = '', basename, dtFormat} = config;
  const fullpath = addDtSuffixToBareBasename(path.join(dir, subdir, basename), {dtFormat});
  return fullpath;
}

export function getDataWriter(globalConfig: PartialExcept<DataWriterOptions, 'dir'>) {
  function dataWriter(config: PartialExcept<DataWriterOptions, 'basename'>, obj: object) {
    const mergedConfig = {
      ...globalConfig,
      ...config,
    };
    const fullpath = getFullPath(mergedConfig);
    writeFileSync(fullpath, convertObjectToCjsExport(obj));
  }
  return dataWriter;
}
