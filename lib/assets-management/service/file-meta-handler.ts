import fs from 'fs';
import {
  AssetInfoFull,
  GetMetaHandlers,
  GetDirAssetOptions,
  CreateOrUpdateItemOptions,
  MetaHandlers,
  AssetTree,
  AssetTreeMeta,
  GetMetaHandlersOptions,
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
  toAssetListMeta,
} from './assets-meta';
import {goOnOrNot, removeFile} from '../external';

/**
 * get a meta handler for a directory
 * @param options.metaFile - the meta file path, if not set, will use the default meta file path in rootDir
 * Rules:
 * 1. to avoid write meta file too often, default archive is false
 */
export const getFileMetaHandler = (
  options?: GetMetaHandlersOptions & {
    /**
     * @deprecated metaFile will make logic more complex, and not easy to maintain, so it will be removed in the future
     */
    metaFile?: string;
    maxBackupFileCnt?: number;
    backUpInterval?: number;
  }
) => {
  const {metaFile, maxBackupFileCnt, backUpInterval, reset, runDirectly, initMetaOptions} = options ?? {};
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

    function updateMeta(options?: {newValue?: AssetTreeMeta | null; save?: boolean}) {
      const {newValue, save} = options ?? {};
      if (newValue !== undefined) {
        meta = {...newValue, rootDir};
      }
      if (save === false) {
        return;
      }
      if (metaFile) {
        saveMetaToFile(metaFile, {...meta, rootDir});
      } else {
        saveDirMeta(rootDir, meta, {maxBackupFileCnt, backUpInterval});
      }
    }

    async function resetMeta(options?: GetDirAssetOptions) {
      const result = await getAssetFullInfoTreeMeta(rootDir, options);
      updateMeta({newValue: result});
      return result;
    }

    async function initMeta(options?: GetDirAssetOptions) {
      const {getAssetInfoParams = {}, goThroughDirOptions} = options ?? {};
      const result = metaFile ? readMetaFromFile(metaFile) : readMetaFromDir(rootDir);
      if (result) {
        if (result.rootDir !== rootDir) {
          throw new Error(`rootDir from assetMeta is different from rootDir of meta handler!`);
        }
        updateMeta({newValue: result, save: false});
      } else {
        if (
          runDirectly !== true &&
          !(await goOnOrNot({
            tips: [`Meta not found for dir: ${rootDir}, do you want to create it now?`],
            style: {color: 'red'},
            defaultValue: true,
          }))
        ) {
          throw new Error(`Meta not found, and user not want to create it`);
        }
        await resetMeta({getAssetInfoParams, goThroughDirOptions});
      }
    }
    async function initOrResetMeta(options?: GetDirAssetOptions) {
      if (reset) {
        await resetMeta(options ?? initMetaOptions);
      } else {
        await initMeta(options ?? initMetaOptions);
      }
    }

    async function getMeta(options?: GetDirAssetOptions) {
      if (!meta) {
        throw new Error(`Can't get meta, because meta is not initialized!`);
      }
      return toAssetListMeta({...meta, rootDir});
    }

    async function cleanUpMeta() {
      if (fs.existsSync(metaFile)) {
        removeFile(metaFile);
      }
      updateMeta({newValue: null});
      return true;
    }

    async function createOrUpdateItem(param: CreateOrUpdateItemOptions) {
      const {info, prevInfo} = param;
      const result = insertOrUpdateItemOfAssetTree(meta, info);
      updateMeta({});
      return result;
    }

    async function createOrUpdateItems(optionList: CreateOrUpdateItemOptions[]) {
      const results: AssetInfoFull[] = [];
      for (const option of optionList) {
        const target = await createOrUpdateItem(option);
        results.push(target);
      }
      updateMeta({});
      return results;
    }

    async function createItem(info: AssetInfoFull) {
      const target = await createOrUpdateItem({info});
      return target;
    }
    async function createItems(infoList: AssetInfoFull[]) {
      const results: AssetInfoFull[] = [];
      for (const info of infoList) {
        const target = await createItem(info);
        results.push(target);
      }
      return results;
    }

    async function updateItem(param: CreateOrUpdateItemOptions) {
      return createOrUpdateItem(param);
    }
    async function updateItems(paramList: CreateOrUpdateItemOptions[]) {
      const results: AssetInfoFull[] = [];
      for (const param of paramList) {
        const target = await updateItem(param);
        results.push(target);
      }
      updateMeta({});
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

    async function removeItem(relativePath: string) {
      const item = deleteItemFromAssetTree(meta, relativePath);
      updateMeta({});
      return item;
    }

    async function removeItems(relativePathList: string[]) {
      const results: AssetInfoFull[] = [];
      for (const relativePath of relativePathList) {
        const result = await removeItem(relativePath);
        results.push(result);
      }
      updateMeta({});
      return results;
    }

    await initOrResetMeta();
    const handlers: MetaHandlers = {
      rootDir,
      getKey,
      getMeta,
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
    };
    return handlers;
  };
  return metaHandler;
};
