import {updateMetaHandlerMeta} from '../../operation/meta-align';
import {getFileMetaHandler} from '../../service';
import {handleAssetsBackup} from '../../operation/assets-backup';
import {initSampleAssets} from '../../file-generator';
import {SOURCE_DIR, TARGET_DIR} from '../serivice';

export async function testHandleAssetsBackup() {
  // initSampleAssets(SOURCE_DIR);
  // if (fs.existsSync(TARGET_DIR)) {
  //     fs.rmSync(TARGET_DIR, {recursive: true});
  // }
  // fs.mkdirSync(TARGET_DIR, {recursive: true});
  const metaHandlers = await getFileMetaHandler()(SOURCE_DIR);
  await updateMetaHandlerMeta(metaHandlers);
  const bkMetaHandlers = await getFileMetaHandler()(TARGET_DIR);
  await updateMetaHandlerMeta(bkMetaHandlers);
  await handleAssetsBackup(bkMetaHandlers, metaHandlers);
}
export async function testHandleAssetsBackup2() {
  // const rootDir = '/Volumes/ssd_4t/z-movie';
  // const bkrootDir = '/Volumes/12T_APFS/z-movie';
  // path.resolve(DIR_TMP_DATA, '../.tmp-bak')
  const rootDir = '/Volumes/ssd_4t/camera';
  const bkrootDir = '/Volumes/12T_APFS/camera';
  const metaHandlers = await getFileMetaHandler()(rootDir);
  await metaHandlers.getMeta();
  await updateMetaHandlerMeta(metaHandlers);
  const bkMetaHandlers = await getFileMetaHandler()(bkrootDir);
  await bkMetaHandlers.getMeta();
  await updateMetaHandlerMeta(bkMetaHandlers);
  await handleAssetsBackup(bkMetaHandlers, metaHandlers);
}
