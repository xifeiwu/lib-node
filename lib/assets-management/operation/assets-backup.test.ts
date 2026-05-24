import path from 'path';
import {updateMetaHandlerMeta} from '.';
import {getFileMetaHandler} from '../service';
import {handleAssetsBackup} from './assets-backup';

// const rootDir = '/Volumes/ssd_4t/z-movie';
// const bkrootDir = '/Volumes/12T_APFS/z-movie';
// path.resolve(DIR_TMP_DATA, '../.tmp-bak')
const rootDir = '/Volumes/ssd_4t/camera';
const bkrootDir = '/Volumes/12T_APFS/camera';

export async function runBackupAssets() {
  const metaHandlers = await getFileMetaHandler()(rootDir);
  await metaHandlers.getMeta();
  await updateMetaHandlerMeta(metaHandlers);
  const bkMetaHandlers = await getFileMetaHandler()(bkrootDir);
  await bkMetaHandlers.getMeta();
  await updateMetaHandlerMeta(bkMetaHandlers);
  await handleAssetsBackup(bkMetaHandlers, metaHandlers);
}
