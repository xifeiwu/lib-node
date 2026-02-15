import fs from 'fs';
import path from 'path';
import {AssetInfoFull, ForOperation, MetaDiff, MetaHandlers} from '../types';
import {serializeMetaDiff, getPartialAssetInfo} from '../service';
import {diffMeta} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  writeFileSync,
  makeSureDirExistForFile,
  moveFile,
  removeFile,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, DT_FORMAT} from '../service';

export async function alignAssets(
  toMetaHandlers: MetaHandlers,
  fromMetaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const forOperation: ForOperation = 'syncUp';
  const {rootDir: rootDir1} = toMetaHandlers;
  const {rootDir: rootDir2} = fromMetaHandlers;
  if (!rootDir1 || !rootDir2 || rootDir1 === rootDir2) {
    throw new Error(`rootDir check fail!`);
  }

  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const toMeta = await toMetaHandlers.getMeta();
  const fromMeta = await fromMetaHandlers.getMeta();
  const difference = await diffMeta(toMeta, fromMeta, {forOperation});
  if (!difference.isNeedAction) {
    return true;
  }

  // const action = getActions(difference);
  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'assets-assets-diff.js'), {
    dtFormat: DT_FORMAT,
  });
  writeFileSync(
    stateFile,
    convertObjectToCjsExport({difference: serializeMetaDiff(difference)}, {format: true})
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
  // const {toAdd, toDelete, toModify} = action;
  const {added = [], copied = [], moved = [], modified = [], deleted = []} = difference;
  for (const assetInfo of added) {
    const {relativePath, sha1, shortId} = assetInfo;
    const fromPath = path.join(fromMetaHandlers.rootDir, relativePath);
    const toPath = path.join(toMetaHandlers.rootDir, relativePath);
    makeSureDirExistForFile(toPath);
    fs.copyFileSync(fromPath, toPath);
    await toMetaHandlers.createItem({
      sha1,
      shortId,
      ...(await getPartialAssetInfo({rootDir: toMetaHandlers.rootDir, relativePath})),
    } as AssetInfoFull);
  }
  const operationOnToDir = async ({
    from,
    to,
    action,
  }: {
    from: AssetInfoFull;
    to: AssetInfoFull;
    action: 'copy' | 'move';
  }) => {
    const {relativePath: fromRelativePath, sha1, shortId} = from;
    const {relativePath: toRelativePath} = to;
    const fromPath = path.join(fromMetaHandlers.rootDir, fromRelativePath);
    const toPath = path.join(toMetaHandlers.rootDir, toRelativePath);
    makeSureDirExistForFile(toPath);
    if (action === 'copy') {
      makeSureDirExistForFile(toPath);
      fs.copyFileSync(fromPath, toPath);
      await toMetaHandlers.createItem({
        ...(await getPartialAssetInfo({rootDir: toMetaHandlers.rootDir, relativePath: toRelativePath})),
        sha1,
        shortId,
      } as AssetInfoFull);
    } else if (action === 'move') {
      moveFile(fromPath, toPath);
      await toMetaHandlers.createItem({
        sha1,
        shortId,
        ...(await getPartialAssetInfo({rootDir: toMetaHandlers.rootDir, relativePath: toRelativePath})),
      } as AssetInfoFull);
      await toMetaHandlers.removeItem(fromRelativePath);
    }
  };
  for (const assetInfo of [...copied, ...modified]) {
    await operationOnToDir({from: assetInfo.from, to: assetInfo.to, action: 'copy'});
  }
  for (const assetInfo of moved) {
    await operationOnToDir({from: assetInfo.from, to: assetInfo.to, action: 'move'});
  }
  for (const assetInfo of deleted) {
    const {relativePath} = assetInfo;
    const fromPath = path.join(toMetaHandlers.rootDir, relativePath);
    removeFile(fromPath);
    await toMetaHandlers.removeItem(relativePath);
  }

  return true;
}
