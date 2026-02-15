import path from 'path';
import {AssetInfoFull, ForOperation, MetaDiff, MetaHandlers} from '../types';
import {
  getAssetInfoListFromMeta,
  getAssetPartialInfoTreeMeta,
  getSha1ToAssetInfo,
  serializeMetaDiff,
} from '../service';
import {diffMeta} from '../service';
import {goOnOrNot, addDtSuffixToBareBasename, convertObjectToCjsExport, writeFileSync} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, DT_FORMAT} from '../service';

function getActions(stateChange: MetaDiff) {
  const {added = [], copied = [], moved = [], modified = [], deleted = [], isNeedAction} = stateChange;
  const toAdd: AssetInfoFull[] = [...added, ...copied.map(it => it.to), ...moved.map(it => it.to)];
  const toDelete: AssetInfoFull[] = [...deleted, ...moved.map(it => it.from)];
  const toModify = modified;
  return {toAdd, toDelete, toModify, isNeedAction};
}

export async function alignMetaWithAssets(
  metaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const forOperation: ForOperation = 'syncUp';
  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const {rootDir} = metaHandlers;
  const toMeta = await metaHandlers.getMeta();
  /** only get partial asset info to reduce cost */
  const fromMeta = await getAssetPartialInfoTreeMeta(rootDir);
  const difference = await diffMeta(toMeta, fromMeta, {forOperation});
  if (!difference.isNeedAction) {
    return true;
  }
  const action = getActions(difference);
  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'meta-assets-diff.js'), {
    dtFormat: DT_FORMAT,
  });
  writeFileSync(
    stateFile,
    convertObjectToCjsExport({difference: serializeMetaDiff(difference), action}, {format: true})
  );
  if (
    !(await goOnOrNot({
      tips: [
        `Need to do meta-asset sync up for dir: ${rootDir}`,
        `state change is saved to file: ${stateFile}`,
        `Are you sure to apply state change above?`,
      ],
      style: {color: 'yellow'},
      defaultValue: true,
    }))
  ) {
    return false;
  }
  const {toAdd, toDelete, toModify} = action;
  await metaHandlers.createItems(toAdd);
  await metaHandlers.updateItems(toModify.map(it => ({info: it.to, prevInfo: it.from})));
  await metaHandlers.removeItems(toDelete.map(it => it.relativePath));
  // const {toAdd, toDelete, toModify} = action;
  // for (const item of [...toAdd, ...toModify.map(it => it.to)]) {
  //   if (!item.sha1) {
  //     const fullInfo = await toFullAssetInfo(item, rootDir);
  //     Object.assign(item, fullInfo);
  //   }
  // }
  return true;
}

export async function handleDuplicateFile(
  metaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const meta = await metaHandlers.getMeta();
  const assetInfoList = getAssetInfoListFromMeta(meta);
  const sha1ToAssetInfo = getSha1ToAssetInfo(assetInfoList);
  const duplicate: Record<string, AssetInfoFull[]> = {};
  for (const key of Object.keys(sha1ToAssetInfo)) {
    const assetInfoList = sha1ToAssetInfo[key];
    if (Array.isArray(assetInfoList) && assetInfoList.length > 1) {
      duplicate[key] = assetInfoList;
    }
  }
  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'duplicate.js'), {
    dtFormat: DT_FORMAT,
  });
  writeFileSync(stateFile, convertObjectToCjsExport({duplicate}, {format: true}));
  if (
    !(await goOnOrNot({
      tips: [
        `Info of duplicate file is saved to file: ${stateFile}`,
        `Do you want to remove duplicate file?`,
      ],
      style: {color: 'yellow'},
      defaultValue: true,
    }))
  ) {
    return false;
  }
}
