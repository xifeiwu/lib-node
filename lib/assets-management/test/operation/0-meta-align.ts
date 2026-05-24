import {updateMetaHandlerMeta} from '../..';
import {logColorful} from '../../external';
import {getFileMetaHandler} from '../../service';
import {SOURCE_DIR} from '../serivice';

export async function testAlignMetaWithAssets() {
  const metaHandler = await getFileMetaHandler()(SOURCE_DIR);
  const meta = await metaHandler.getMeta();
  updateMetaHandlerMeta(metaHandler);
  logColorful({}, meta);
}

export async function testAlignMetaWithAssets2() {
  const rootDir = '/Volumes/ssd_4t/camera';
  // const rootDir = '/Volumes/ssd_4t/ruby';
  // const rootDir = '/Volumes/12T_APFS/z-movie';
  // const rootDir = '/Volumes/HIKSEMI/xl-photo/';
  const metaHandlers = await getFileMetaHandler()(rootDir);
  await metaHandlers.getMeta();
  await updateMetaHandlerMeta(metaHandlers);
}
