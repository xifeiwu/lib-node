import fs from 'fs';
import path from 'path';
import {addSuffixToBareBasename} from '../path';
import {PartialExcept} from '../external';
import {convertObjectToCjsExport} from '../transform';
import {formatDt} from '../external';

interface DataWriterOptions {
  dir: string;
  subdir?: string;
  basename: string;
  dataCategory?: string;
  dtForamtAsCategory?: string;
  categoryWay?: 'folder' | 'basenameSuffix';
  createDirIfNotExist?: boolean;
}

/**
 * write data to a file, and create the directory if it does not exist by default
 */
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

function getDataFilePath(
  config: Pick<
    DataWriterOptions,
    'dir' | 'subdir' | 'basename' | 'dataCategory' | 'dtForamtAsCategory' | 'categoryWay'
  >
) {
  const {dir, subdir, basename, dtForamtAsCategory, dataCategory, categoryWay = 'basenameSuffix'} = config;
  const tag = dataCategory ?? formatDt(dtForamtAsCategory);
  let tagDir = '';
  let finalBasename = basename;
  if (categoryWay === 'basenameSuffix') {
    finalBasename = addSuffixToBareBasename(basename, tag);
  } else if (categoryWay === 'folder') {
    tagDir = tag;
  }
  const fullpath = path.join(dir, subdir, tagDir, finalBasename);
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
