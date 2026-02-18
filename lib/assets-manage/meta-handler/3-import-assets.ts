import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {serializeMetaDiff, getPartialAssetInfo} from '../service';
import {diffMetaForAssetsImport} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  writeFileSync,
  makeSureDirExistForFile,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, DT_FORMAT} from '../service';

export async function importAssetsFromDir(
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
      tips: [`Will import assets?`, `from dir: ${rootDir2}`, `to dir: ${rootDir1}`],
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
  const difference = await diffMetaForAssetsImport(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return true;
  }

  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'import-assets-diff.js'), {
    dtFormat: DT_FORMAT,
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
  return true;
}
