import path from 'path';
import {alignMetaWithAssets} from '.';
import {getFileMetaHandler} from '../service';
import {backupAssets} from './assets-backup';

// const rootDir = '/Volumes/ssd_4t/z-movie';
// const bkrootDir = '/Volumes/12T_APFS/z-movie';
// path.resolve(DIR_TMP_DATA, '../.tmp-bak')
const rootDir = '/Volumes/ssd_4t/camera';
const bkrootDir = '/Volumes/12T_APFS/camera';

export async function runBackupAssets() {
  const metaHandlers = await getFileMetaHandler()(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  const bkMetaHandlers = await getFileMetaHandler()(bkrootDir);
  await bkMetaHandlers.getMeta();
  await alignMetaWithAssets(bkMetaHandlers);
  await backupAssets(bkMetaHandlers, metaHandlers);
}
