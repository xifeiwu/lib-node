import fs from 'fs';
import path from 'path';
import {AssetInfoFull, AssetMeta, AssetsSyncUpMetaDiff, MetaHandlers} from '../types';
import {
  getAssetInfoListFromMeta,
  getAssetPartialInfoTreeMeta,
  getSha1ToAssetInfo,
  serializeMetaDiff,
} from '../service';
import {diffMetaForSyncUp} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  writeFileSync,
  moveFile,
  makeSureDirExistForFile,
  isInSameDevice,
  selectOption,
  makeSureDirExist,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, FILE_SUFFIX_DT_FORMAT} from '../service';

function getActions(stateChange: AssetsSyncUpMetaDiff) {
  const {added = [], copied = [], moved = [], modified = [], deleted = [], isNeedAction} = stateChange;
  const toAdd: AssetInfoFull[] = [...added, ...copied.map(it => it.to), ...moved.map(it => it.to)];
  const toDelete: AssetInfoFull[] = [...deleted, ...moved.map(it => it.from)];
  const toModify = modified;
  return {toAdd, toDelete, toModify, isNeedAction};
}

export async function alignMeta(
  metaHandlers: MetaHandlers,
  fromMeta: AssetMeta,
  options?: {
    outputDir?: string;
  }
) {
  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const toMeta = await metaHandlers.getMeta();
  if (toMeta.rootDir === fromMeta.rootDir) {
    throw new Error(`toMeta.rootDir should not be the same as fromMeta.rootDir`);
  }
  const difference = await diffMetaForSyncUp(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return true;
  }
  const action = getActions(difference);
  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'meta-assets-diff.js'), {
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
  // const {toAdd, toDelete, toModify} = action;
  // for (const item of [...toAdd, ...toModify.map(it => it.to)]) {
  //   if (!item.sha1) {
  //     const fullInfo = await toFullAssetInfo(item, rootDir);
  //     Object.assign(item, fullInfo);
  //   }
  // }
  return true;
}

export async function alignMetaWithAssets(
  metaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const {rootDir} = metaHandlers;
  /** only get partial asset info to reduce cost */
  const fromMeta = await getAssetPartialInfoTreeMeta(rootDir);
  return alignMeta(metaHandlers, fromMeta, options);
}

export async function handleDuplicateFile(
  metaHandlers: MetaHandlers,
  options: {
    /** solution to handle duplicate file */
    solution?: 'short-name';
    /** move the file to delete to a folder first, to double confirm before completely remove the file  */
    dir4DeletedFile: string;
    outputDir?: string;
  }
) {
  const rootDir = metaHandlers.rootDir;
  if (!rootDir || !options.dir4DeletedFile) {
    throw new Error(`rootDir or dir4DeletedFile is not set`);
  }
  const dir4DeletedFile = path.resolve(rootDir, options.dir4DeletedFile);
  makeSureDirExist(dir4DeletedFile);
  if (!isInSameDevice(rootDir, dir4DeletedFile)) {
    throw new Error(`dir4DeletedFile should be in the same device as rootDir`);
  }
  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const meta = await metaHandlers.getMeta();
  const assetInfoList = getAssetInfoListFromMeta(meta);
  const sha1ToAssetInfo = getSha1ToAssetInfo(assetInfoList);
  const duplicateFiles: Record<string, AssetInfoFull[]> = {};
  for (const key of Object.keys(sha1ToAssetInfo)) {
    const assetInfoList = sha1ToAssetInfo[key];
    if (Array.isArray(assetInfoList) && assetInfoList.length > 1) {
      duplicateFiles[key] = assetInfoList;
    }
  }
  if (Object.keys(duplicateFiles).length === 0) {
    return true;
  }
  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'duplicate.js'), {
    dtFormat: FILE_SUFFIX_DT_FORMAT,
  });
  writeFileSync(stateFile, convertObjectToCjsExport({duplicate: duplicateFiles}, {format: true}));
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
  let deletedAssets: AssetInfoFull[] = [];
  const DELETE_ALL = 'delete all';
  let index = 0;
  const items = Object.entries(duplicateFiles);
  const total = items.length;
  for (const [sha1, assetInfoList] of items) {
    if (assetInfoList.length < 2) {
      continue;
    }
    let selection: string;
    if (options?.solution === 'short-name') {
      selection = assetInfoList.sort((a, b) => a.relativePath.length - b.relativePath.length)[0].relativePath;
    } else {
      const optionsForSelect: {label: string}[] = [
        {label: DELETE_ALL},
        ...assetInfoList.map(it => ({label: it.relativePath})),
      ];
      const {label} = await selectOption(optionsForSelect, {
        tips: [`[${index++}/${total}]Which one do you want to keep?[${sha1}]`],
      });
      selection = label;
    }
    const assetsToDelete =
      selection === DELETE_ALL ? assetInfoList : assetInfoList.filter(it => it.relativePath !== selection);
    deletedAssets.push(...assetsToDelete);
    let backUpDone = false;
    for (const assetInfo of assetsToDelete) {
      const {relativePath} = assetInfo;
      const filePath = path.join(metaHandlers.rootDir, relativePath);
      if (!backUpDone) {
        const destFilePath = path.join(dir4DeletedFile, `${sha1}-${path.basename(relativePath)}`);
        makeSureDirExistForFile(destFilePath);
        moveFile(filePath, destFilePath);
        backUpDone = true;
        continue;
      }
      fs.unlinkSync(filePath);
    }
  }
  await metaHandlers.removeItems(deletedAssets.map(it => it.relativePath));
}
