import path from 'path';
import {AssetInfoFull, AssetMeta, MetaDiffForSyncUp, MetaHandlers} from '../types';
import {getAssetPartialInfoTreeMeta, serializeMetaDiff} from '../service';
import {diffMetaForSyncUp} from '../service';
import {goOnOrNot, addDtSuffixToBareBasename, convertObjectToCjsExport, writeFileSync} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, FILE_SUFFIX_DT_FORMAT} from '../service';

function getActions(stateChange: MetaDiffForSyncUp) {
  const {added = [], copied = [], moved = [], modified = [], deleted = [], isNeedAction} = stateChange;
  const toAdd: AssetInfoFull[] = [...added, ...copied.map(it => it.to), ...moved.map(it => it.to)];
  const toDelete: AssetInfoFull[] = [...deleted, ...moved.map(it => it.from)];
  const toModify = modified;
  return {toAdd, toDelete, toModify, isNeedAction};
}

/**
 * align two metas of the same dir
 * @param metaHandlers
 * @param fromMeta
 * @param options
 * @returns two metas are the same or not
 */
async function alignTwoMetas(
  metaHandlers: MetaHandlers,
  fromMeta: AssetMeta,
  options?: {
    outputDir?: string;
  }
): Promise<boolean> {
  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const toMeta = await metaHandlers.getMeta();
  if (toMeta.rootDir !== fromMeta.rootDir) {
    throw new Error(`toMeta.rootDir should not be the same as fromMeta.rootDir`);
  }
  const difference = await diffMetaForSyncUp(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return true;
  }
  const action = getActions(difference);
  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'meta-meta-diff.js'), {
    dtFormat: FILE_SUFFIX_DT_FORMAT,
  });
  writeFileSync(
    stateFile,
    convertObjectToCjsExport({difference: serializeMetaDiff(difference), action}, {format: true})
  );
  if (
    !(await goOnOrNot({
      tips: [
        `Need to do meta-asset sync up for dir: ${toMeta.rootDir}`,
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
  return false;
}

/**
 * align meta with latest status of its assets
 * @param metaHandlers
 * @param options
 * @returns
 */
export async function alignMetaWithAssets(
  metaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const {rootDir} = metaHandlers;
  /** only get partial asset info to reduce cost */
  const fromMeta = await getAssetPartialInfoTreeMeta(rootDir);
  const isSame = await alignTwoMetas(metaHandlers, fromMeta, options);
  return isSame;
}
