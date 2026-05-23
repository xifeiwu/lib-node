import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {serializeMetaDiff, getPartialAssetInfo} from '../service';
import {diffMetaForSyncUp} from '../service';
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
  targetMetaHandlers: MetaHandlers,
  sourceMetaHandlers: MetaHandlers,
  options?: {
    outputDir?: string;
    runDirectly?: boolean;
  }
) {
  const {rootDir: rootDir1} = targetMetaHandlers;
  const {rootDir: rootDir2} = sourceMetaHandlers;
  if (!rootDir1 || !rootDir2) {
    throw new Error(`source or target rootDir is empty!`);
  }
  if (rootDir1 === rootDir2) {
    throw new Error(`rootDir should not be the same!`);
  }

  const targetMeta = await targetMetaHandlers.getMeta();
  const sourceMeta = await sourceMetaHandlers.getMeta();
  const difference = await diffMetaForSyncUp(targetMeta, sourceMeta);
  if (!difference.isNeedAction) {
    return true;
  }

  /** save diff info to file and ask user to double confirm */
  if (!options?.runDirectly) {
    const {outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
    const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'assets-assets-diff.js'), {
      dtFormat: FILE_SUFFIX_DT_FORMAT,
    });
    writeFileSync(
      stateFile,
      convertObjectToCjsExport({difference: serializeMetaDiff(difference)}, {format: true})
    );
    if (
      !(await goOnOrNot({
        tips: [
          `backup assets from ${rootDir2} to ${rootDir1}`,
          `state change is saved to file: ${stateFile}`,
          `Are you sure to apply state change above?`,
        ],
        style: {color: 'yellow'},
        defaultValue: true,
      }))
    ) {
      return false;
    }
  }
  const {added = [], copied = [], moved = [], modified = [], deleted = []} = difference;
  let copiedCount = 0;
  const totalSize = added.reduce((acc, assetInfo) => acc + assetInfo.size, 0);
  let copiedSize = 0;
  for (const assetInfo of added) {
    const {relativePath, sha1, shortId} = assetInfo;
    const sourcePath = path.join(sourceMetaHandlers.rootDir, relativePath);
    const targetPath = path.join(targetMetaHandlers.rootDir, relativePath);
    makeSureDirExistForFile(targetPath);
    console.log(
      `[${++copiedCount}/${added.length}] copying [${byteToWord(assetInfo.size)}] from ${sourcePath} to ${targetPath}`
    );
    fs.copyFileSync(sourcePath, targetPath);
    copiedSize += assetInfo.size;
    console.log(
      `copied size:${byteToWord(copiedSize)} / ${byteToWord(totalSize)} (${((copiedSize / totalSize) * 100).toFixed(2)}%)`
    );
    await targetMetaHandlers.createItem({
      sha1,
      shortId,
      ...(await getPartialAssetInfo({rootDir: targetMetaHandlers.rootDir, relativePath})),
    } as AssetInfoFull);
  }

  const operationOnTargetDir = async ({
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
    const fromPath = path.join(targetMetaHandlers.rootDir, fromRelativePath);
    const toPath = path.join(targetMetaHandlers.rootDir, toRelativePath);
    makeSureDirExistForFile(toPath);
    if (action === 'copy') {
      makeSureDirExistForFile(toPath);
      fs.copyFileSync(fromPath, toPath);
      await targetMetaHandlers.createItem({
        ...(await getPartialAssetInfo({rootDir: targetMetaHandlers.rootDir, relativePath: toRelativePath})),
        sha1,
        shortId,
      } as AssetInfoFull);
    } else if (action === 'move') {
      moveFile(fromPath, toPath);
      await targetMetaHandlers.createItem({
        sha1,
        shortId,
        ...(await getPartialAssetInfo({rootDir: targetMetaHandlers.rootDir, relativePath: toRelativePath})),
      } as AssetInfoFull);
      await targetMetaHandlers.removeItem(fromRelativePath);
    }
  };

  /** copy should be handled before move */
  for (const assetInfo of [...copied, ...modified]) {
    await operationOnTargetDir({from: assetInfo.from, to: assetInfo.to, action: 'copy'});
  }
  for (const assetInfo of moved) {
    await operationOnTargetDir({from: assetInfo.from, to: assetInfo.to, action: 'move'});
  }
  for (const assetInfo of deleted) {
    const {relativePath} = assetInfo;
    const fromPath = path.join(targetMetaHandlers.rootDir, relativePath);
    removeFile(fromPath);
    await targetMetaHandlers.removeItem(relativePath);
  }

  return true;
}
