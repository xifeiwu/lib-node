import path from 'path';
import {alignMetaWithAssets, handleDuplicateFile} from '.';
import {getFileMetaHandler} from '../service';

// const rootDir = DIR_TMP_DATA;
// const rootDir = path.resolve(process.env.HOME, 'Downloads');
// const rootDir = '/Volumes/ssd_4t/z-movie';
const rootDir = '/Volumes/ssd_4t/camera';
// const rootDir = '/Volumes/ssd_4t/ruby';
// const rootDir = '/Volumes/12T_APFS/z-movie';
// const rootDir = '/Volumes/HIKSEMI/xl-photo/';

export async function testAlignMetaWithAssets() {
  const metaHandlers = await getFileMetaHandler()(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
}

export async function runHandleDuplicateFile() {
  const metaHandlers = await getFileMetaHandler()(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  const solution = undefined;
  // const solution = 'short-name';
  await handleDuplicateFile(metaHandlers, {dir4DeletedFile: '../backup-deleted', solution});
}
