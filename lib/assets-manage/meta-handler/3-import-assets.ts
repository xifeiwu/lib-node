import fs from 'fs';
import path from 'path';
import {AssetInfoFull, ForOperation, MetaHandlers} from '../types';
import {serializeMetaDiff, getPartialAssetInfo} from '../service';
import {diffMeta} from '../service';
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
  const forOperation: ForOperation = 'importNew';
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
  const difference = await diffMeta(toMeta, fromMeta, {forOperation});
  if (!difference.isNeedAction) {
    return true;
  }

  const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'new-assets-diff.js'), {
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
  if ([...copied, ...moved, ...modified, ...deleted].length > 0) {
    throw new Error(`copied, moved, modified, deleted should be empty`);
  }
  return true;
}
