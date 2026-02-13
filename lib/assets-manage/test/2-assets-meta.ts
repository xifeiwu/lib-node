import {alignMetaWithAssets} from '../utils/assets-meta';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';

export async function testAlignMetaWithAssetChange() {
  const metaHandlers = await getDirMetaHandler(DIR_TMP_DATA);
  await metaHandlers.checkMeta();
  await alignMetaWithAssets(metaHandlers);
}
