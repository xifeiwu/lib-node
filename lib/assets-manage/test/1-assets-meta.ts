import path from 'path';
import {alignMetaWithAssets, handleDuplicateFile} from '../meta-handler';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';

// const rootDir = DIR_TMP_DATA;
// const rootDir = path.resolve(process.env.HOME, 'Downloads');
const rootDir = '/Volumes/ssd_4t/z-movie';

export async function testGetDirMetaHandler() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
}

export async function testAlignMetaWithAssetChange() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
}

export async function runHandleDuplicateFile() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  await handleDuplicateFile(metaHandlers);
}
