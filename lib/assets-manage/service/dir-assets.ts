import fs from 'fs';
import path from 'path';
import {
  getFileInfoTree,
  FileInfoTreeItem,
  makeSureDirExist,
  rerequire,
  logColorful,
  addDtSuffixToBareBasename,
  makeSureDirExistForFile,
  toDate,
  formatDate,
} from '../external';
import {
  AssetInfoFull,
  GetAssetInfoParams,
  AssetTree,
  ShortIdToAssetInfo,
  AssetInfoPartial,
  GetDirAssetOptions,
  Sha1ToAssetInfo,
} from '../types';
import {getAssetInfo} from './asset-info';

async function getOneAssetMeta(
  item: FileInfoTreeItem,
  getAssetInfoParams: Omit<GetAssetInfoParams, 'relativePath'>
): Promise<AssetTree | AssetInfoFull> {
  const {relativePath, children: fileList, stats} = item;
  if (stats.isDirectory()) {
    /** make sure children exist for dir path */
    const children: Array<AssetTree | AssetInfoFull> = [];
    for (const file of fileList) {
      children.push(await getOneAssetMeta(file, getAssetInfoParams));
    }
    return {
      relativePath,
      children,
    };
  }
  if (Array.isArray(fileList)) {
    throw new Error(`children should not exist in file`);
  }
  return (await getAssetInfo({...getAssetInfoParams, relativePath})) as AssetInfoFull;
}

async function getDirAssetTree(rootDir: string, options?: GetDirAssetOptions): Promise<Required<AssetTree>> {
  const {
    goThroughDirOptions = {
      dirFilter({basename}) {
        return !basename.startsWith('.');
      },
      fileFilter({basename}) {
        return !basename.startsWith('.');
      },
    },
    getAssetInfoParams = {},
  } = options ?? {};
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Not exist or is not directory: ${rootDir}`);
  }
  const fileTree = getFileInfoTree(rootDir, goThroughDirOptions);
  const meta = (await getOneAssetMeta(fileTree, {...getAssetInfoParams, rootDir})) as AssetTree;
  meta.rootDir = rootDir;
  return meta as Required<AssetTree>;
}

export async function getAssetFullInfoTreeOfDir(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<Required<AssetTree>> {
  const {getAssetInfoParams = {}, goThroughDirOptions} = options ?? {};
  return await getDirAssetTree(rootDir, {
    goThroughDirOptions,
    getAssetInfoParams: {...getAssetInfoParams, reCalcId: true},
  });
}

/**
 * dir assetPartialInfoMeta is mainly used for meta compare
 */
export async function getAssetPartialInfoTreeOfDir(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<Required<AssetTree>> {
  const {getAssetInfoParams = {}, goThroughDirOptions} = options ?? {};
  return await getDirAssetTree(rootDir, {
    goThroughDirOptions,
    getAssetInfoParams: {...getAssetInfoParams, reCalcId: false},
  });
}

export function assetInfoTreeToList(tree: AssetTree) {
  const results: AssetInfoFull[] = [];
  function traverse(meta: AssetTree | AssetInfoFull) {
    const {children} = meta as AssetTree;
    if (!Array.isArray(children)) {
      results.push(meta as AssetInfoFull);
    } else {
      children.map(traverse);
    }
  }
  traverse(tree);
  return results;
}

export function assetInfoListToTree(assetInfoList: AssetInfoPartial[], rootDir: string) {
  const tree: AssetTree = {rootDir, relativePath: '.', children: []};
  function insertOne(relativePath, info: AssetInfoPartial) {
    const normalized = path.normalize(relativePath);
    const parts = normalized.split(path.sep).slice(0, -1);
    let tmpChildren = tree.children;
    let part: string;
    while ((part = parts.shift()) !== undefined) {
      const target = tmpChildren.find(it => it.relativePath === part);
      if (!target) {
        const children: AssetTree['children'] = [];
        tmpChildren.push({relativePath: part, children});
        tmpChildren = children;
      } else {
        tmpChildren = (target as AssetTree).children;
      }
    }
    let target: AssetTree | AssetInfoPartial;
    if ((target = tmpChildren.find(it => it.relativePath === info.relativePath))) {
      logColorful({color: 'red'}, `There shouldn't be two child have same relativePath, how to handle this?`);
    }
    tmpChildren.push(info);
  }
  for (const info of assetInfoList) {
    const {relativePath} = info;
    if (!relativePath) {
      throw new Error(`relativePath not found for: ${relativePath}`);
    }
    insertOne(relativePath, info);
  }
  return tree;
}

/**
 * Mainly used for init dir meta
 */
export async function getAssetFullInfoListOfDir(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<AssetInfoFull[]> {
  const infoTree = await getAssetFullInfoTreeOfDir(rootDir, options);
  return assetInfoTreeToList(infoTree);
}

/**
 * Mainly used for comparision between latest assets and meta
 */
export async function getAssetsPartailInfoListOfDir(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<AssetInfoFull[]> {
  const infoTree = await getAssetPartialInfoTreeOfDir(rootDir, options);
  return assetInfoTreeToList(infoTree);
}

/**
 * @deprecated by getSha1ToAssetInfo
 * @param infoList
 * @returns
 */
export function getShortIdToAssetInfo(infoList: AssetInfoFull[]): ShortIdToAssetInfo {
  const results: ShortIdToAssetInfo = {};
  for (const info of infoList) {
    const {shortId} = info;
    if (results[shortId]) {
      if (!Array.isArray(results[shortId])) {
        results[shortId] = [results[shortId]] as AssetInfoFull[];
      }
      (results[shortId] as AssetInfoFull[]).push(info);
    } else {
      results[shortId] = info;
    }
  }
  return results;
}

export function getSha1ToAssetInfo(infoList: AssetInfoFull[]): Sha1ToAssetInfo {
  const results: Sha1ToAssetInfo = {};
  for (const info of infoList) {
    const {sha1} = info;
    if (results[sha1]) {
      if (!Array.isArray(results[sha1])) {
        results[sha1] = [results[sha1]] as AssetInfoFull[];
      }
      (results[sha1] as AssetInfoFull[]).push(info);
    } else {
      results[sha1] = info;
    }
  }
  return results;
}
/**
 * Return the first item of assetInfo list
 * @param shortIdToAssetInfo
 * @param id
 * @returns
 */
export function getAssetInfoById(shortIdToAssetInfo: ShortIdToAssetInfo, id: string): AssetInfoFull {
  const info = shortIdToAssetInfo[id];
  if (!info) {
    return null;
  }
  if (Array.isArray(info)) {
    if (info.length > 0) {
      return info[0];
    }
    return null;
  }
  return info;
}

export function getRelativePathToAssetInfo(infoList: AssetInfoFull[]) {
  const results: Record<string, AssetInfoFull> = {};
  for (const info of infoList) {
    const {relativePath} = info;
    results[relativePath] = info;
  }
  return results;
}

export function getMetaDir(rootDir: string) {
  const metaDir = path.join(rootDir, '.meta');
  makeSureDirExist(metaDir, {isDir: true});
  return metaDir;
}

export function getMetaFilePath(rootDir: string) {
  const metaDir = getMetaDir(rootDir);
  return path.resolve(metaDir, 'index.ts');
}

export function getMetaOfDir(rootDir: string): AssetTree | undefined {
  const metaFile = getMetaFilePath(rootDir);
  if (!fs.existsSync(metaFile)) {
    return undefined;
  }
  const convertToDate = (item: AssetTree | AssetInfoFull) => {
    if ('children' in item && Array.isArray(item.children)) {
      item.children.forEach(convertToDate);
    } else {
      (item as AssetInfoFull).modifyDate = toDate((item as AssetInfoFull).modifyDate);
      (item as AssetInfoFull).changeDate = toDate((item as AssetInfoFull).changeDate);
    }
  };
  const meta = rerequire(metaFile).meta as AssetTree;
  convertToDate(meta);
  return meta;
}

export function saveDirMetaToFile(
  rootDir: string,
  assetMeta: AssetInfoFull[] | AssetTree,
  options?: {
    /** override existing meta file or not */
    backupOutdatedMeta?: boolean;
  }
) {
  const {backupOutdatedMeta} = options ?? {};
  if (Array.isArray(assetMeta)) {
    assetMeta = assetInfoListToTree(assetMeta, rootDir);
  }
  const metaFile = getMetaFilePath(rootDir);
  if (backupOutdatedMeta && fs.existsSync(metaFile)) {
    fs.renameSync(metaFile, addDtSuffixToBareBasename(metaFile));
  }
  makeSureDirExistForFile(metaFile);
  /** convert date to string before save to file */
  const convertDateToString = (item: AssetTree | AssetInfoFull) => {
    if ('children' in item && Array.isArray(item.children)) {
      item.children.forEach(convertDateToString);
    } else {
      // @ts-ignore
      (item as AssetInfoFull).modifyDate = formatDate((item as AssetInfoFull).modifyDate);
      // @ts-ignore
      (item as AssetInfoFull).changeDate = formatDate((item as AssetInfoFull).changeDate);
    }
  };
  convertDateToString(assetMeta);
  fs.writeFileSync(metaFile, `export const meta = ${JSON.stringify(assetMeta, null, 2)}`);
}
