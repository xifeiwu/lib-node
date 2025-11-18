import fs from 'fs';
import path from 'path';
import {addSuffixToBareBasename} from '../path';
import {PartialExcept} from '../types/external';
import {convertObjectToCjsExport} from '../transform';
import {getDtStrInFormat} from '../external';

interface DataWriterOptions {
  dir: string;
  subdir?: string;
  basename: string;
  basenameSuffix?: string;
  dtSuffixFormat?: string;
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

export function getDataFilePath(
  config: Pick<DataWriterOptions, 'dir' | 'subdir' | 'basename' | 'basenameSuffix' | 'dtSuffixFormat'>
) {
  const {dir, subdir = '', basename, dtSuffixFormat, basenameSuffix} = config;
  const finalSuffix = basenameSuffix ?? getDtStrInFormat(dtSuffixFormat);
  const fullpath = addSuffixToBareBasename(path.join(dir, subdir, basename), finalSuffix);
  return fullpath;
}

export function getDataWriter(globalConfig: PartialExcept<DataWriterOptions, 'dir'>) {
  function dataWriter(config: PartialExcept<DataWriterOptions, 'basename'>, obj: object) {
    const mergedConfig = {
      ...globalConfig,
      ...config,
    };
    const fullpath = getDataFilePath(mergedConfig);
    const content = convertObjectToCjsExport(obj);
    writeFileSync(fullpath, content);
    return {fullpath, content};
  }
  return dataWriter;
}
