import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaDiffForImportNew, MetaHandlers} from '../types';
import {
  serializeMetaDiff,
  getSha1AsId,
  getAssetInfoListFromMeta,
  getSha1ToAssetInfo,
  getFullAssetInfo,
} from '../service';
import {diffMetaForImportNew} from '../service';
import {
  goOnOrNot,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  writeFileSync,
  byteToWord,
  formatDt,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, FILE_SUFFIX_DT_FORMAT} from '../service';
import {addAssetMeta} from './asset-base-operation';
import {getFileMetaHandler} from '../service';

export async function importAssetsByMeta(
  toMetaHandlers: MetaHandlers,
  fromMetaHandlers: MetaHandlers,
  options?: {
    /** must be relative dir to toMetaHandlers.rootDir */
    newAssetsDir?: string;
    outputDir?: string;
  }
): Promise<MetaDiffForImportNew> {
  const {
    newAssetsDir = `new-assets-${formatDt('yyyy-MM-ddThh-mm-ss')}`,
    outputDir = DIR_ASSET_MANAGE_TMP_DIR,
  } = options ?? {};
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
  const difference = await diffMetaForImportNew(toMeta, fromMeta);
  if (!difference.isNeedAction) {
    return difference;
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
    return;
  }
  const {added = [], duplicated} = difference;
  const totalSize = added.reduce((acc, assetInfo) => acc + assetInfo.size, 0);
  let copiedSize = 0;
  let copiedCount = 0;
  for (const assetInfo of added) {
    const {relativePath} = assetInfo;
    const sourcePath = path.join(fromMetaHandlers.rootDir, relativePath);
    const targetRelativePath = path.join(newAssetsDirRelativePath, relativePath);
    await addAssetMeta(toMetaHandlers, [{sourcePath, relativePath: targetRelativePath}]);
    copiedSize += assetInfo.size;
    copiedCount++;
    console.log(
      `copied size:${byteToWord(copiedSize)} / ${byteToWord(totalSize)} (${((copiedSize / totalSize) * 100).toFixed(2)}%), copied count:${copiedCount} / ${added.length}`
    );
  }
  return difference;
}

/**
 * Import assets from a folder or file list into target dir
 * @param toMetaHandlers - target meta handlers
 * @param from - MetaHandlers, folder path (string), or file list (string[])
 * @param options
 */
export async function importAssets(
  toMetaHandlers: MetaHandlers,
  /**
   * MetaHandlers, folder path or file path (string), or file list (string[])
   */
  from: MetaHandlers | string | string[],
  options?: {
    /** must be relative dir to toMetaHandlers.rootDir */
    newAssetsDir?: string;
    outputDir?: string;
  }
): Promise<Pick<MetaDiffForImportNew, 'added' | 'duplicated'>> {
  if (typeof from === 'string') {
    from = path.resolve(process.cwd(), from);
    if (fs.existsSync(from) && fs.statSync(from).isDirectory()) {
      const fromMetaHandlers = await getFileMetaHandler()(from);
      return importAssetsByMeta(toMetaHandlers, fromMetaHandlers, options);
    } else {
      /** treat it as file */
      from = [from];
    }
  }

  if (Array.isArray(from)) {
    const toMeta = await toMetaHandlers.getMeta();
    const existingList = getAssetInfoListFromMeta(toMeta);
    const sha1ToExisting = getSha1ToAssetInfo(existingList);
    const added: AssetInfoFull[] = [];
    const duplicated: MetaDiffForImportNew['duplicated'] = [];
    const mergeIntoSha1Map = (info: AssetInfoFull) => {
      const {sha1} = info;
      const cur = sha1ToExisting[sha1];
      if (!cur) {
        sha1ToExisting[sha1] = info;
      } else if (Array.isArray(cur)) {
        cur.push(info);
      } else {
        sha1ToExisting[sha1] = [cur, info];
      }
    };
    for (const filePath of from) {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        console.log(`file not exist, skip: ${fullPath}`);
        continue;
      }
      const {sha1} = await getSha1AsId(fullPath);
      if (sha1ToExisting[sha1]) {
        const origin = sha1ToExisting[sha1];
        const by = await getFullAssetInfo({
          rootDir: path.dirname(fullPath),
          relativePath: path.basename(fullPath),
        });
        duplicated.push({origin, by});
        console.log(`file already exist in target, skip: ${fullPath}`);
        continue;
      }
      const relativePath = path.basename(fullPath);
      const result = await addAssetMeta(toMetaHandlers, [{sourcePath: fullPath, relativePath}]);
      for (const info of result) {
        mergeIntoSha1Map(info);
      }
      added.push(...result);
    }
    return {added, duplicated};
  }

  // MetaHandlers
  return importAssetsByMeta(toMetaHandlers, from, options);
}
