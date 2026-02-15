import {alignMetaWithAssets, handleDuplicateFile} from '../meta-handler';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';

export async function testAlignMetaWithAssetChange() {
  const metaHandlers = await getDirMetaHandler(DIR_TMP_DATA);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
}

export async function runHandleDuplicateFile() {
  const metaHandlers = await getDirMetaHandler(DIR_TMP_DATA);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  await handleDuplicateFile(metaHandlers);
}
