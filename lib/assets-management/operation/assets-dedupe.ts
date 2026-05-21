import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {getSha1ToAssetInfo} from '../service';
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
  logColorful,
} from '../external';
import {DIR_ASSET_MANAGE_TMP_DIR, FILE_SUFFIX_DT_FORMAT} from '../service';

/**
 * handle duplicate file
 * @param metaHandlers
 * @param options
 * @returns
 */
export async function handleAssetsDedupe(
  metaHandlers: MetaHandlers,
  options: {
    /** move the file to delete to a folder first, to double confirm before completely remove the file  */
    dir4DeletedFile: string;
    /** solution to handle duplicate file */
    solution?: 'short-name';
    outputDir?: string;
    runDirectly?: boolean;
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
  const assetInfoList = meta.assetInfoList;
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
  let stateFile: string;
  if (options.runDirectly !== true) {
    stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'duplicate.js'), {
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
  logColorful({color: 'red'}, `Deleted file are backed up to: ${dir4DeletedFile}`);
  logColorful({color: 'red'}, `Info of duplicate file is saved to file: ${stateFile}`);
}
