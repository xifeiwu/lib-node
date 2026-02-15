import path from 'path';
import {alignMetaWithAssets} from '../meta-handler';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';
import {alignAssets} from '../meta-handler/assets-assets';

export async function testAlignMetaWithAssetChange() {
  const metaHandlers = await getDirMetaHandler(DIR_TMP_DATA);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  const bkMetaHandlers = await getDirMetaHandler(path.resolve(DIR_TMP_DATA, '../.tmp-bak'));
  await bkMetaHandlers.getMeta();
  await alignMetaWithAssets(bkMetaHandlers);
  await alignAssets(bkMetaHandlers, metaHandlers);
}
