import path from 'path';
import {MetaHandlers} from '../types';
import {serializeMetaDiff} from '../service';
import {diffMetaForAddNew} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  writeFileSync,
  byteToWord,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, FILE_SUFFIX_DT_FORMAT} from '../service';
import {addAssetMeta} from './1-assets-meta';

export async function importAssets(
  toMetaHandlers: MetaHandlers,
  fromMetaHandlers: MetaHandlers,
  options: {
    /** must be relative dir to toMetaHandlers.rootDir */
    newAssetsDir: string;
    outputDir?: string;
  }
) {
  const {newAssetsDir, outputDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const {rootDir: rootDir1} = toMetaHandlers;
  const {rootDir: rootDir2} = fromMetaHandlers;
  const newAssetsDirPath = path.resolve(toMetaHandlers.rootDir, newAssetsDir);
  const newAssetsDirRelativePath = path.relative(toMetaHandlers.rootDir, newAssetsDirPath);
  if (!newAssetsDirPath.startsWith(toMetaHandlers.rootDir)) {
    throw new Error(`newAssetsDir should be a subdir of toMetaHandlers.rootDir`);
  }
  if (
    !(await goOnOrNot({
      tips: [`Will import assets?`, `from dir: ${rootDir2}`, `to dir: ${rootDir1}`],
      defaultValue: true,
    }))
  ) {
    return;
  }
  if (!rootDir1 || !rootDir2 || rootDir1 === rootDir2) {
    throw new Error(`rootDir check fail!`);
  }

  const toMeta = await toMetaHandlers.getMeta();
  const fromMeta = await fromMetaHandlers.getMeta();
  const difference = await diffMetaForAddNew(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return true;
  }

  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'import-assets-diff.js'), {
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
  const {added = [], duplicated} = difference;
  const totalSize = added.reduce((acc, assetInfo) => acc + assetInfo.size, 0);
  let copiedSize = 0;
  let copiedCount = 0;
  for (const assetInfo of added) {
    const {relativePath} = assetInfo;
    const sourcePath = path.join(fromMetaHandlers.rootDir, relativePath);
    const targetRelativePath = path.join(newAssetsDirRelativePath, relativePath);
    await addAssetMeta(toMetaHandlers, [
      {sourcePath, relativePath: targetRelativePath},
    ]);
    copiedSize += assetInfo.size;
    copiedCount++;
    console.log(
      `copied size:${byteToWord(copiedSize)} / ${byteToWord(totalSize)} (${((copiedSize / totalSize) * 100).toFixed(2)}%), copied count:${copiedCount} / ${added.length}`
    );
  }
  return true;
}
