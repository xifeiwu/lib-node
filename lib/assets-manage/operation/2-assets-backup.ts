import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {serializeMetaDiff, getPartialAssetInfo} from '../service';
import {diffMetaForAssetsSyncUp} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  writeFileSync,
  makeSureDirExistForFile,
  moveFile,
  removeFile,
  byteToWord,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, FILE_SUFFIX_DT_FORMAT} from '../service';

export async function backupAssets(
  toMetaHandlers: MetaHandlers,
  fromMetaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
  }
) {
  const {rootDir: rootDir1} = toMetaHandlers;
  const {rootDir: rootDir2} = fromMetaHandlers;
  if (
    !(await goOnOrNot({
      tips: [`Will back up assets by meta?`, `from dir: ${rootDir2}`, `to dir: ${rootDir1}`],
      defaultValue: true,
    }))
  ) {
    return;
  }
  if (!rootDir1 || !rootDir2 || rootDir1 === rootDir2) {
    throw new Error(`rootDir check fail!`);
  }

  const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const toMeta = await toMetaHandlers.getMeta();
  const fromMeta = await fromMetaHandlers.getMeta();
  const difference = await diffMetaForAssetsSyncUp(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return true;
  }

  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'assets-assets-diff.js'), {
    dtFormat: FILE_SUFFIX_DT_FORMAT,
  });
  writeFileSync(
    stateFile,
    convertObjectToCjsExport({difference: serializeMetaDiff(difference)}, {format: true})
  );
  if (
    !(await goOnOrNot({
      tips: [`state change is saved to file: ${stateFile}`, `Are you sure to apply state change above?`],
      style: {color: 'yellow'},
      defaultValue: true,
    }))
  ) {
    return false;
  }
  const {added = [], copied = [], moved = [], modified = [], deleted = []} = difference;
  let copiedCount = 0;
  const totalSize = added.reduce((acc, assetInfo) => acc + assetInfo.size, 0);
  let copiedSize = 0;
  for (const assetInfo of added) {
    const {relativePath, sha1, shortId} = assetInfo;
    const fromPath = path.join(fromMetaHandlers.rootDir, relativePath);
    const toPath = path.join(toMetaHandlers.rootDir, relativePath);
    makeSureDirExistForFile(toPath);
    console.log(
      `[${++copiedCount}/${added.length}] copying [${byteToWord(assetInfo.size)}] from ${fromPath} to ${toPath}`
    );
    fs.copyFileSync(fromPath, toPath);
    copiedSize += assetInfo.size;
    console.log(
      `copied size:${byteToWord(copiedSize)} / ${byteToWord(totalSize)} (${((copiedSize / totalSize) * 100).toFixed(2)}%)`
    );
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
    const fromPath = path.join(toMetaHandlers.rootDir, fromRelativePath);
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
