import path from 'path';
import {alignMetaWithAssets} from '../meta-handler';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';
import {backupAssets} from '../meta-handler/2-assets-backup';

// const rootDir = '/Volumes/ssd_4t/z-movie';
// const bkrootDir = '/Volumes/12T_APFS/z-movie';
// path.resolve(DIR_TMP_DATA, '../.tmp-bak')
const rootDir = '/Volumes/ssd_4t/camera';
const bkrootDir = '/Volumes/12T_APFS/camera';

export async function runBackupAssets() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  const bkMetaHandlers = await getDirMetaHandler(bkrootDir);
  await bkMetaHandlers.getMeta();
  await alignMetaWithAssets(bkMetaHandlers);
  await backupAssets(bkMetaHandlers, metaHandlers);
}
