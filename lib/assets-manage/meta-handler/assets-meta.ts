import path from 'path';
import {MetaHandlers} from '../types';
import {getActions, getAssetPartialInfoTreeMeta, serializeMetaDiff} from '../service';
import {diffMeta} from '../service';
import {goOnOrNot, addDtSuffixToBareBasename, convertObjectToCjsExport, writeFileSync} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, DT_FORMAT} from '../service';

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
  const action = getActions(difference);
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

// export function getActions(stateChange: MetaDiff, options?: {newFileDir?: string}) {
//   const {toDir, fromDir, added = [], copied = [], moved = [], modified = [], deleted = [], isNeedAction} = stateChange;
//   const isSameDir = toDir === fromDir;
//   if (!isSameDir && !options?.newFileDir) {
//     throw new Error('newFileDir is required when import new assets');
//   }
//   if (isSameDir) {
//     /** just need to upadte assetsMeta of current dir */
//   }
//   const toAdd: AssetInfoFull[] = [...added, ...copied.map(it => it.to), ...moved.map(it => it.to)];
//   const toDelete: AssetInfoFull[] = [...deleted, ...moved.map(it => it.from)];
//   const toModify = modified;
//   return {toAdd, toDelete, toModify, isNeedAction};
// }
