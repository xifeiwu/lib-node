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
} from '../types';
import {
  assetInfoTreeToList,
  deleteItemFromAssetTree,
  findAssetItemsByFilter,
  getAssetFullInfoTreeMeta,
  readMetaFromDir,
  insertOrUpdateItemOfAssetTree,
  saveDirMeta,
  readMetaFromFile,
  saveMetaToFile,
} from './assets-meta';
import {goOnOrNot, removeFile} from '../external';

/**
 * get a meta handler for a directory
 * Rules:
 * 1. to avoid write meta file too often, default archive is false
 */
export const getFileMetaHandler = (options?: {metaFile: string}) => {
  const {metaFile} = options ?? {};
  if (metaFile && !fs.existsSync(metaFile)) {
    throw new Error(`metaFile not exist: ${metaFile}`);
  }
  const metaHandler: GetMetaHandlers = async (rootDir: string) => {
    if (!fs.existsSync(rootDir)) {
      throw new Error(`rootDir not exist: ${rootDir}`);
    }

    let meta: AssetTreeMeta;

    function getKey() {
      return metaFile;
    }

    function updateMeta(options?: {newValue?: AssetTreeMeta | null; archive?: boolean}) {
      const {newValue, archive} = options ?? {};
      if (newValue !== undefined) {
        meta = {...newValue, rootDir};
      }
      if (archive) {
        if (metaFile) {
          saveMetaToFile(metaFile, {...meta, rootDir});
        } else {
          saveDirMeta(rootDir, meta, {maxMetaBackupFile: 20, backUpInterval: 1000 * 60 * 20});
        }
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
      const result = metaFile ? readMetaFromFile(metaFile) : readMetaFromDir(rootDir);
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

    async function cleanUpMeta() {
      if (fs.existsSync(metaFile)) {
        removeFile(metaFile);
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

    async function getItemList(options: {paranoid?: boolean}) {
      return assetInfoTreeToList(meta);
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

    const handlers: MetaHandlers = {
      rootDir,
      getKey,
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
      getItemList,
      archiveMeta,
    };
    return handlers;
  };
  return metaHandler;
};
