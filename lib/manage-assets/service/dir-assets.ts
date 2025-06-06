import fs from 'fs';
import path from 'path';
import {
  getFileInfoTree,
  FileInfoTreeItem,
  makeSureDirExist,
  rerequire,
  logColorful,
  getPathWithDtSuffix,
  makeSureDirExistForFile,
} from '../external';
import {
  AssetInfoFull,
  GetAssetInfoParams,
  AssetTree,
  ShortIdToAssetInfo,
  AssetInfoPartial,
  GetDirAssetOptions,
} from '../types';
import {getAssetInfo} from './asset-info';

async function getOneAssetMeta(
  item: FileInfoTreeItem,
  getAssetInfoParams: Omit<GetAssetInfoParams, 'relativePath'>
): Promise<AssetTree | AssetInfoFull> {
  const {relativePath, children: fileList, stat} = item;
  if (stat.isDirectory()) {
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

export function getShortIdToAssetInfo(infoList: AssetInfoFull[]): ShortIdToAssetInfo {
  const results: ShortIdToAssetInfo = {};
  for (const info of infoList) {
    const {shortId} = info;
    if (results[shortId]) {
      if (!Array.isArray(results[shortId])) {
        results[shortId] = [results[shortId]];
      }
      results[shortId].push(info);
    } else {
      results[shortId] = info;
    }
  }
  return results;
}

/**
 * Return the first item of assetInfo list
 * @param shortIdToAssetInfo
 * @param shortId
 * @returns
 */
export function getAssetInfoByShortId(
  shortIdToAssetInfo: ShortIdToAssetInfo,
  shortId: string
): AssetInfoFull {
  const info = shortIdToAssetInfo[shortId];
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

export function getMetaOfDir(rootDir: string): AssetTree {
  const metaFile = getMetaFilePath(rootDir);
  if (!fs.existsSync(metaFile)) {
    throw new Error(`Can't found meta file: ${metaFile}`);
    // return {rootDir, relativePath: '.'};
  }
  const meta = rerequire(metaFile).meta as AssetTree;
  return meta;
}

export function saveDirMetaToFile(
  rootDir: string,
  assetMeta: AssetInfoFull[] | AssetTree,
  options?: {
    toNewFile?: boolean;
  }
) {
  const {toNewFile} = options ?? {};
  if (Array.isArray(assetMeta)) {
    assetMeta = assetInfoListToTree(assetMeta, rootDir);
  }
  const metaFile = getMetaFilePath(rootDir);
  if (toNewFile && fs.existsSync(metaFile)) {
    fs.renameSync(metaFile, getPathWithDtSuffix(metaFile));
  }
  makeSureDirExistForFile(metaFile);
  fs.writeFileSync(metaFile, `export const meta = ${JSON.stringify(assetMeta, null, 2)}`);
}
