import fs from 'fs';
import {
  AssetInfoFull,
  GetMetaHandlers,
  GetDirAssetOptions,
  CreateOrUpdateItemOptions,
  MetaHandlers,
  AssetTree,
} from '../../types';
import {
  assetInfoTreeToList,
  deleteItemFromAssetTree,
  findAssetItemsByFilter,
  getAssetFullInfoTreeMeta,
  getMetaDir,
  getMetaFilePath,
  readMetaFromDir,
  insertOrUpdateItemOfAssetTree,
  saveDirMetaToFile,
} from '../assets-meta';
import {addDtSuffixToBareBasename, goOnOrNot, removeFile} from '../../external';

export const getDirMetaHandler: GetMetaHandlers = async (rootDir: string, globalOptions) => {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`rootDir not exist: ${rootDir}`);
  }

  const {getAssetInfoParams, goThroughDirOptions} = globalOptions ?? {};
  let meta: AssetTree;
  // let relativePathToAssetInfo: Record<string, AssetInfoFull> = {};

  // let assetInfoList: AssetInfoFull[];
  function updateMeta(options?: {newValue?: AssetTree | null; archive?: boolean}) {
    const {newValue, archive} = options ?? {};
    if (newValue !== undefined) {
      meta = newValue;
      // if (newValue !== null) {
      //   relativePathToAssetInfo = getRelativePathToAssetInfo(assetInfoTreeToList(meta));
      // } else {
      //   relativePathToAssetInfo = {};
      // }
    }
    if (archive) {
      saveDirMetaToFile(rootDir, meta, {backupOutdatedMeta: true});
    }
  }

  function getKey() {
    return getMetaDir(rootDir);
  }

  async function resetMeta(options?: GetDirAssetOptions) {
    const result = await getAssetFullInfoTreeMeta(rootDir, options ?? globalOptions);
    updateMeta({newValue: result, archive: true});
    return result;
  }
  async function getMeta() {
    let result = readMetaFromDir(rootDir);
    if (!result) {
      if (
        !(await goOnOrNot({
          tips: [`Meta not found for dir: ${rootDir}, do you want to create it now?`],
          style: {color: 'red'},
          defaultValue: true,
        }))
      ) {
        throw new Error(`Meta not found, and user not want to create it`);
      }
      result = await resetMeta({getAssetInfoParams, goThroughDirOptions});
    }
    updateMeta({newValue: result});
    return result;
  }

  function getMetaLocation() {
    return getMetaFilePath(rootDir);
  }

  async function cleanUpMeta() {
    const metaDir = getMetaDir(rootDir);
    if (fs.existsSync(metaDir)) {
      removeFile(metaDir);
    }
    updateMeta({newValue: null});
    return true;
  }

  // function findItemByRelativePath(relativePath: string) {
  //   return relativePathToAssetInfo[relativePath];
  // }

  async function createOrUpdateItem(options?: CreateOrUpdateItemOptions & {archive?: boolean}) {
    const {info, prevInfo, archive = true} = options ?? {};
    const result = insertOrUpdateItemOfAssetTree(meta, info);
    updateMeta({archive});
    return result;
  }

  async function createItem(info: AssetInfoFull) {
    const target = await createOrUpdateItem({info});
    return target;
  }
  async function createItems(infoList: AssetInfoFull[]) {
    const results: AssetInfoFull[] = [];
    for (const info of infoList) {
      const target = await createOrUpdateItem({info, archive: false});
      results.push(target);
    }
    updateMeta({archive: true});
    return results;
  }

  async function updateItem(item: CreateOrUpdateItemOptions) {
    const target = await createOrUpdateItem(item);
    return target;
  }
  async function updateItems(items: CreateOrUpdateItemOptions[]) {
    const results: AssetInfoFull[] = [];
    for (const item of items) {
      const target = await createOrUpdateItem({...item, archive: false});
      results.push(target);
    }
    updateMeta({archive: true});
    return results;
  }

  // TODO: optimize this function
  async function createOrUpdateItems(optionList: CreateOrUpdateItemOptions[]) {
    const results: AssetInfoFull[] = [];
    for (const option of optionList) {
      const target = await createOrUpdateItem({...option, archive: false});
      results.push(target);
    }
    updateMeta({archive: true});
    return results;
  }

  async function findItems(filter: Partial<AssetInfoFull>) {
    const match = (item: AssetInfoFull) => {
      return Object.entries(filter).every(([key, value]) => {
        return value === item[key];
      });
    };
    return findAssetItemsByFilter(meta, match);
  }

  async function removeItem(relativePath: string, options?: {archive?: boolean}) {
    const {archive = true} = options ?? {};
    const item = deleteItemFromAssetTree(meta, relativePath);
    updateMeta({archive});
    return item;
  }

  async function removeItems(relativePathList: string[]) {
    const results: AssetInfoFull[] = [];
    for (const relativePath of relativePathList) {
      const result = await removeItem(relativePath, {archive: false});
      results.push(result);
    }
    return results;
  }

  async function getAllItems(options: {paranoid?: boolean}) {
    return assetInfoTreeToList(meta);
  }
  async function snapshot() {
    const metaFile = getMetaFilePath(rootDir);
    if (!fs.existsSync(metaFile)) {
      return false;
    }
    const backUpMetaFile = addDtSuffixToBareBasename(metaFile);
    fs.cpSync(metaFile, backUpMetaFile);
    return backUpMetaFile;
  }

  const handlers: MetaHandlers = {
    rootDir,
    getKey,
    getMetaLocation,
    getMeta,
    resetMeta,
    cleanUpMeta,
    createOrUpdateItem,
    createOrUpdateItems,
    createItem,
    createItems,
    updateItem,
    updateItems,
    findItems,
    removeItem,
    removeItems,
    getAllItems,
    snapshot,
  };
  return handlers;
};
