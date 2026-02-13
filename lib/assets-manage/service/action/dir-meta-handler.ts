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
  getAssetFullInfoListOfDir,
  getAssetFullInfoTreeOfDir,
  getMetaDir,
  getMetaFilePath,
  getMetaOfDir,
  saveDirMetaToFile,
} from '../dir-assets';
import {addDtSuffixToBareBasename, goOnOrNot, removeFile} from '../../external';

export const getDirMetaHandler: GetMetaHandlers = async (rootDir: string, globalOptions) => {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`rootDir not exist: ${rootDir}`);
  }

  const {getAssetInfoParams, goThroughDirOptions} = globalOptions ?? {};
  let meta: AssetTree;
  let assetInfoList: AssetInfoFull[];

  function getKey() {
    return getMetaDir(rootDir);
  }

  function haveMeta() {
    return Array.isArray(assetInfoList);
  }

  async function resetMeta(options?: GetDirAssetOptions) {
    meta = await getAssetFullInfoTreeOfDir(rootDir, options ?? globalOptions);
    saveDirMetaToFile(rootDir, meta, {backupOutdatedMeta: true});
    return meta;
  }
  async function checkMeta() {
    let meta = getMetaOfDir(rootDir);
    if (!meta) {
      if (
        !(await goOnOrNot({
          tips: [`Meta not found for dir: ${rootDir}, do you want to create it now?`],
          style: {color: 'red'},
          defaultValue: true,
        }))
      ) {
        throw new Error(`Meta not found, and user not want to create it`);
      }
      meta = await resetMeta({getAssetInfoParams, goThroughDirOptions});
    }
    return meta;
  }

  function getMetaLocation() {
    return getMetaFilePath(rootDir);
  }

  async function cleanUpMeta() {
    assetInfoList = [];
    const metaDir = getMetaDir(rootDir);
    if (fs.existsSync(metaDir)) {
      removeFile(metaDir);
    }
    return true;
  }

  async function createOrUpdateItem(options?: CreateOrUpdateItemOptions & {archive?: boolean}) {
    const {info, prevInfo, archive = true} = options ?? {};
    const target = findItemByRelativePath(prevInfo?.relativePath ?? info.relativePath);
    if (!target) {
      assetInfoList.push(info);
    } else {
      Object.entries(info).forEach(([key, value]) => {
        target[key] = value;
      });
    }
    if (archive) {
      saveState();
    }
    return target;
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
    saveState();
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
    saveState();
    return results;
  }

  // TODO: optimize this function
  async function createOrUpdateItems(optionList: CreateOrUpdateItemOptions[]) {
    const results: AssetInfoFull[] = [];
    for (const option of optionList) {
      const target = await createOrUpdateItem({...option, archive: false});
      results.push(target);
    }
    saveState();
    return results;
  }

  async function findItems(filter: Partial<AssetInfoFull>) {
    const match = (item: AssetInfoFull) => {
      return Object.entries(filter).every(([key, value]) => {
        return value === item[key];
      });
    };
    return assetInfoList.filter(match);
  }
  function findItemByRelativePath(relativePath: string) {
    return assetInfoList.find(it => it.relativePath === relativePath);
  }
  // function findItemByShortId(shortId: string) {
  //   return assetInfoList.find(it => it.shortId === shortId);
  // }
  // function findItemBySha1(sha1: string) {
  //   return assetInfoList.find(it => it.sha1 === sha1);
  // }

  async function removeItem(relativePath: string) {
    checkMeta();
    const index = assetInfoList.findIndex(it => it.relativePath === relativePath);
    const item = assetInfoList[index];
    assetInfoList.splice(index, 1);
    saveState();
    return item;
  }

  async function removeItems(relativePathList: string[]) {
    checkMeta();
    const results: AssetInfoFull[] = [];
    for (const relativePath of relativePathList) {
      const result = await removeItem(relativePath);
      results.push(result);
    }
    return results;
  }

  async function getAllItems(options: {paranoid?: boolean}) {
    checkMeta();
    return assetInfoList;
  }
  function saveState() {
    // checkMeta();
    saveDirMetaToFile(rootDir, assetInfoList);
    return assetInfoList;
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
    checkMeta,
    haveMeta,
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
