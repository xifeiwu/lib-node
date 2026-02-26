import fs from 'fs';
import {
  AssetInfoFull,
  GetMetaHandlers,
  GetDirAssetOptions,
  CreateOrUpdateItemOptions,
  MetaHandlers,
  AssetTree,
  MoreOptions,
  AssetTreeMeta,
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
import {goOnOrNot, removeFile} from '../../external';

/**
 * get a meta handler for a directory
 * Rules:
 * 1. to avoid write meta file too often, default archive is false
 */
export const getDirMetaHandler: GetMetaHandlers = async (rootDir: string) => {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`rootDir not exist: ${rootDir}`);
  }

  let meta: AssetTree;

  function getKey() {
    return getMetaDir(rootDir);
  }

  function updateMeta(options?: {newValue?: AssetTree | null; archive?: boolean}) {
    const {newValue, archive} = options ?? {};
    if (newValue !== undefined) {
      meta = newValue;
    }
    if (archive) {
      saveDirMetaToFile(rootDir, meta, {maxMetaBackupFile: 20});
    }
  }
  function archiveMeta() {
    updateMeta({archive: true});
    return {...meta, rootDir} as AssetTreeMeta;
  }

  async function resetMeta(options?: GetDirAssetOptions) {
    const result = await getAssetFullInfoTreeMeta(rootDir, options);
    updateMeta({newValue: result, archive: true});
    return result;
  }

  async function initMeta(options?: GetDirAssetOptions) {
    const {getAssetInfoParams = {}, goThroughDirOptions} = options ?? {};
    const result = readMetaFromDir(rootDir);
    if (result) {
      if (result.rootDir !== rootDir) {
        throw new Error(`rootDir from assetMeta is different from rootDir of meta handler!`);
      }
      updateMeta({newValue: result});
    } else {
      if (
        !(await goOnOrNot({
          tips: [`Meta not found for dir: ${rootDir}, do you want to create it now?`],
          style: {color: 'red'},
          defaultValue: true,
        }))
      ) {
        throw new Error(`Meta not found, and user not want to create it`);
      }
      getAssetInfoParams.logging = true;
      await resetMeta({getAssetInfoParams, goThroughDirOptions});
    }
  }

  async function getMeta(options?: GetDirAssetOptions) {
    await initMeta(options);
    return {...meta, rootDir} as AssetTreeMeta;
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

  async function createOrUpdateItem(param: CreateOrUpdateItemOptions, options?: MoreOptions) {
    const {info, prevInfo} = param;
    const {archive} = options ?? {};
    const result = insertOrUpdateItemOfAssetTree(meta, info);
    updateMeta({archive});
    return result;
  }

  async function createOrUpdateItems(optionList: CreateOrUpdateItemOptions[], options?: MoreOptions) {
    const results: AssetInfoFull[] = [];
    for (const option of optionList) {
      const target = await createOrUpdateItem(option, {...(options ?? {}), archive: false});
      results.push(target);
    }
    updateMeta({archive: options?.archive});
    return results;
  }

  async function createItem(info: AssetInfoFull, options?: MoreOptions) {
    const target = await createOrUpdateItem({info}, options);
    return target;
  }
  async function createItems(infoList: AssetInfoFull[], options?: MoreOptions) {
    const results: AssetInfoFull[] = [];
    for (const info of infoList) {
      const target = await createItem(info, {...(options ?? {}), archive: false});
      results.push(target);
    }
    updateMeta({archive: options?.archive});
    return results;
  }

  async function updateItem(param: CreateOrUpdateItemOptions, options?: MoreOptions) {
    return createOrUpdateItem(param, options);
  }
  async function updateItems(paramList: CreateOrUpdateItemOptions[], options?: MoreOptions) {
    const results: AssetInfoFull[] = [];
    for (const param of paramList) {
      const target = await updateItem(param, {...(options ?? {}), archive: false});
      results.push(target);
    }
    updateMeta({archive: options?.archive});
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
    const item = deleteItemFromAssetTree(meta, relativePath);
    updateMeta({archive: options?.archive});
    return item;
  }

  async function removeItems(relativePathList: string[], options?: {archive?: boolean}) {
    const results: AssetInfoFull[] = [];
    for (const relativePath of relativePathList) {
      const result = await removeItem(relativePath, {archive: false});
      results.push(result);
    }
    updateMeta({archive: options?.archive});
    return results;
  }

  async function getAllItems(options: {paranoid?: boolean}) {
    return assetInfoTreeToList(meta);
  }

  const handlers: MetaHandlers = {
    rootDir,
    getKey,
    getMetaLocation,
    initMeta,
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
    archiveMeta,
  };
  return handlers;
};
