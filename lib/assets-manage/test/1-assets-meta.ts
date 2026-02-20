import path from 'path';
import {alignMetaWithAssets, handleDuplicateFile} from '../meta-handler';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';

// const rootDir = DIR_TMP_DATA;
// const rootDir = path.resolve(process.env.HOME, 'Downloads');
// const rootDir = '/Volumes/ssd_4t/z-movie';
// const rootDir = '/Volumes/ssd_4t/camera';
// const rootDir = '/Volumes/12T_APFS/z-movie';
const rootDir = '/Volumes/HIKSEMI/xl-photo/';

export async function testGetDirMetaHandler() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
}

export async function testAlignMetaWithAssets() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
}

export async function runHandleDuplicateFile() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  // const solution = 'short-name';
  let solution;
  await handleDuplicateFile(metaHandlers, {dir4DeletedFile: '../backup-deleted', solution});
}
