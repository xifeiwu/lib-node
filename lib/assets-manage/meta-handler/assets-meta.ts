import fs from 'fs';
import path from 'path';
import {AssetInfoFull} from '../types';
import {MetaHandlers} from '../types';
import {
  getActionsFromAssetsChange,
  getAssetFullInfoTreeMeta,
  getAssetPartialInfoTreeMeta,
  getAssetsPartailInfoListOfDir,
  serializeMetaDiff,
} from '../service';
import {diffMeta} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  makeSureDirExistForFile,
  convertObjectToCjsExport,
  writeFileSync,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, DT_FORMAT} from '../service';

// export async function getAssetStateChange(metaHandlers: MetaHandlers) {
//   const {rootDir} = metaHandlers;
//   let assetInfoListMeta: AssetInfoFull[] = await metaHandlers.getAllItems();
//   /** only get partial asset info to reduce cost */
//   let latestAssetInfoList: AssetInfoFull[] = await getAssetsPartailInfoListOfDir(rootDir);
//   return {
//     assetInfoListMeta,
//     latestAssetInfoList,
//     stateChange: await diffAssetInfoList(assetInfoListMeta, latestAssetInfoList, {rootDir}),
//   };
// }

export async function alignMetaWithAssets(
  metaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const {outputDir: tmpDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const {rootDir} = metaHandlers;
  const toMeta = await metaHandlers.getMeta();
  /** only get partial asset info to reduce cost */
  const fromMeta = await getAssetPartialInfoTreeMeta(rootDir);
  const difference = await diffMeta(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return true;
  }
  const action = getActionsFromAssetsChange(difference);
  const stateFile = addDtSuffixToBareBasename(path.join(tmpDir, 'meta-assets-diff.js'), {
    dtFormat: DT_FORMAT,
  });
  writeFileSync(
    stateFile,
    convertObjectToCjsExport({difference: serializeMetaDiff(difference), action}, {format: true})
  );
  if (
    !(await goOnOrNot({
      tips: [`state change is saved to file: ${stateFile}`, `Are you sure to apply state change above?`],
      style: {color: 'red'},
      defaultValue: true,
    }))
  ) {
    return false;
  }
  const {toAdd, toDelete, toModify} = action;
  await metaHandlers.createItems(toAdd);
  await metaHandlers.updateItems(toModify.map(it => ({info: it.to, prevInfo: it.from})));
  await metaHandlers.removeItems(toDelete.map(it => it.relativePath));
  return true;
}
