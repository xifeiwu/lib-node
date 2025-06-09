import fs from 'fs';
import {AssetInfoFull, GetMetaHandlers, GetDirAssetOptions} from '../../types';
import {
  assetInfoTreeToList,
  getAssetFullInfoListOfDir,
  getMetaDir,
  getMetaFilePath,
  getMetaOfDir,
  saveDirMetaToFile,
} from '../dir-assets';
import {getPathWithDtSuffix, recursiveDeleteFile} from '../../external';

export const getDirMetaHandler: GetMetaHandlers = async (rootDir: string, globalOptions) => {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`rootDir not exist: ${rootDir}`);
  }

  const {initMetaIfNotExist, getAssetInfoParams, goThroughDirOptions} = globalOptions ?? {};
  let assetInfoList: AssetInfoFull[];

  try {
    const meta = getMetaOfDir(rootDir);
    assetInfoList = assetInfoTreeToList(meta);
  } catch (err) {
    console.error(err);
    if (initMetaIfNotExist) {
      await resetMeta({getAssetInfoParams, goThroughDirOptions});
    }
  }
  function getKey() {
    return getMetaDir(rootDir);
  }
  function haveMeta() {
    return Array.isArray(assetInfoList);
  }
  function checkMeta() {
    if (!haveMeta()) {
      throw new Error(`Not found meta, please init it first`);
    }
  }

  function getMetaLocation() {
    return getMetaFilePath(rootDir);
  }

  async function resetMeta(options?: GetDirAssetOptions) {
    assetInfoList = await getAssetFullInfoListOfDir(rootDir, options ?? globalOptions);
    saveDirMetaToFile(rootDir, assetInfoList, {toNewFile: true});
    return assetInfoList;
  }
  async function cleanUpMeta() {
    assetInfoList = [];
    const metaDir = getMetaDir(rootDir);
    if (fs.existsSync(metaDir)) {
      recursiveDeleteFile(metaDir);
    }
    return true;
  }

  async function insertOrUpdateItem(assetInfo: AssetInfoFull) {
    checkMeta();
    let target = assetInfoList.find(it => it.relativePath === assetInfo.relativePath);
    if (target) {
      Object.entries(assetInfo).forEach(([key, value]) => {
        target[key] = value;
      });
    } else {
      assetInfoList.push(assetInfo);
      target = assetInfo;
    }
    saveState();
    return target;
  }

  async function findItems(filter: Partial<AssetInfoFull>) {
    checkMeta();
    const match = (item: AssetInfoFull) => {
      return Object.entries(filter).every(([key, value]) => {
        return value === item[key];
      });
    };
    return assetInfoList.filter(match);
  }

  async function removeItem(relativePath: string) {
    checkMeta();
    const index = assetInfoList.findIndex(it => it.relativePath === relativePath);
    const item = assetInfoList[index];
    assetInfoList.splice(index, 1);
    saveState();
    return item;
  }

  async function getAllItems(options: {paranoid?: boolean}) {
    checkMeta();
    return assetInfoList;
  }
  async function saveState() {
    checkMeta();
    saveDirMetaToFile(rootDir, assetInfoList);
    return assetInfoList;
  }
  async function snapshot() {
    const metaFile = getMetaFilePath(rootDir);
    if (!fs.existsSync(metaFile)) {
      return false;
    }
    const backUpMetaFile = getPathWithDtSuffix(metaFile);
    fs.cpSync(metaFile, backUpMetaFile);
    return backUpMetaFile;
  }

  return {
    rootDir,
    getKey,
    getMetaLocation,
    haveMeta,
    resetMeta,
    cleanUpMeta,
    insertOrUpdateItem,
    findItems,
    removeItem,
    getAllItems,
    saveState,
    snapshot,
  };
};
