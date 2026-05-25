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
  getFileList,
  convertObjectToCjsExport,
} from '../external';
import {
  AssetInfoFull,
  GetAssetInfoParams,
  AssetTree,
  ShortIdToAssetInfo,
  AssetInfoPartial,
  GetDirAssetOptions,
  Sha1ToAssetInfo,
  AssetTreeMeta,
  AssetListMeta,
  AssetMeta,
  MetaFileContent,
  MetaHandlers,
} from '../types';
import {deserailizeAssetInfo, diffAssets, getAssetInfo, serailizeAssetInfo} from './asset-info';
import {isNumber, toDtStr} from '../../../external';
import {FILE_SUFFIX_DT_FORMAT, META_DIR_NAME} from '..';

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

async function getAssetTreeMeta(rootDir: string, options?: GetDirAssetOptions): Promise<AssetTreeMeta> {
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
  const meta: AssetTreeMeta = {
    rootDir,
    ...((await getOneAssetMeta(fileTree, {...getAssetInfoParams, rootDir})) as AssetTree),
  };
  return meta;
}

export async function getAssetFullInfoTreeMeta(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<AssetTreeMeta> {
  const {getAssetInfoParams = {}, goThroughDirOptions} = options ?? {};
  return await getAssetTreeMeta(rootDir, {
    goThroughDirOptions,
    getAssetInfoParams: {...getAssetInfoParams, reCalcId: true},
  });
}

/**
 * dir assetPartialInfoMeta is mainly used for meta compare
 */
export async function getAssetPartialInfoTreeMeta(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<AssetTreeMeta> {
  const {getAssetInfoParams = {}, goThroughDirOptions} = options ?? {};
  return await getAssetTreeMeta(rootDir, {
    goThroughDirOptions,
    getAssetInfoParams: {...getAssetInfoParams, reCalcId: false},
  });
}

function getPathParts(relativePath: string) {
  const normalized = path.normalize(relativePath);
  const parts = normalized.split(path.sep);
  return parts;
}

export function findItemFromAssetTree(
  tree: AssetTree,
  relativePath: string
): AssetTree | AssetInfoFull | undefined {
  if (!tree || !relativePath) {
    return undefined;
  }
  const parts = getPathParts(relativePath);
  let i = 1;
  let curItem: AssetTree | AssetInfoFull = tree;
  while (i <= parts.length) {
    const curPath = parts.slice(0, i).join(path.sep);
    let target = (curItem as AssetTree).children?.find(it => it.relativePath === curPath);
    if (!target) {
      break;
    }
    if (i === parts.length) {
      return target;
    }
    curItem = target;
    i++;
  }
  return undefined;
}

function goThroughAssetTree(tree: AssetTree, cb: (item: AssetTree | AssetInfoFull) => void) {
  function traverse(item: AssetTree | AssetInfoFull) {
    if ('children' in item && Array.isArray(item.children)) {
      item.children.forEach(traverse);
    }
    cb(item);
  }
  traverse(tree);
}
export function findAssetItemsByFilter(
  tree: AssetTree,
  filter: (item: AssetTree | AssetInfoFull) => boolean
) {
  const results: AssetInfoFull[] = [];
  goThroughAssetTree(tree, item => {
    if (filter(item)) {
      results.push(item as AssetInfoFull);
    }
  });
  return results;
}

export function findAssetItemsByProps(tree: AssetTree, props: Partial<AssetInfoFull>) {
  return findAssetItemsByFilter(tree, item => {
    return Object.entries(props).every(([key, value]) => {
      return item[key] === value;
    });
  });
}

function insertItemToAssetTree(tree: AssetTree, assetInfo: AssetInfoPartial) {
  const {relativePath} = assetInfo;
  if (!relativePath) {
    throw new Error(`relativePath not found for: ${assetInfo}`);
  }
  const parts = getPathParts(assetInfo.relativePath);
  let i = 1;
  let curItem: AssetTree | AssetInfoFull = tree;
  while (i <= parts.length) {
    const curPath = parts.slice(0, i).join(path.sep);
    if (!Array.isArray((curItem as AssetTree).children)) {
      (curItem as AssetTree).children = [];
    }
    let target = (curItem as AssetTree).children.find(it => it.relativePath === curPath);
    if (!target) {
      if (i === parts.length) {
        (curItem as AssetTree).children.push(assetInfo);
      } else {
        target = {relativePath: curPath, children: []};
        (curItem as AssetTree).children.push(target);
        curItem = target;
      }
    } else {
      curItem = target;
    }
    i++;
  }
  return curItem as AssetInfoFull;
}

export function updateItemOfAssetTree(
  tree: AssetTree,
  params: {
    newInfo: AssetInfoPartial;
    prevInfo?: AssetInfoPartial;
  }
) {
  const {newInfo, prevInfo} = params;
  const relavivePath = prevInfo?.relativePath ?? newInfo.relativePath;
  const target = findItemFromAssetTree(tree, relavivePath);
  if (!target) {
    throw new Error(`Item not found for: ${relavivePath}`);
  }
  Object.entries(newInfo).forEach(([key, value]) => {
    target[key] = value;
  });
  return target as AssetInfoFull;
}

export function insertOrUpdateItemOfAssetTree(
  tree: AssetTree,
  assetInfo: AssetInfoPartial,
  prevInfo?: AssetInfoPartial
): AssetInfoFull {
  let result: AssetInfoFull | undefined = undefined;
  const target = findItemFromAssetTree(tree, prevInfo?.relativePath ?? assetInfo.relativePath);
  if (!target) {
    result = insertItemToAssetTree(tree, assetInfo);
  } else {
    result = updateItemOfAssetTree(tree, {newInfo: assetInfo, prevInfo});
  }
  return result as AssetInfoFull;
}

export function deleteItemFromAssetTree(tree: AssetTree, relativePath: string): AssetInfoFull | undefined {
  let result: AssetInfoFull | undefined = undefined;
  const parts = getPathParts(relativePath);
  let i = 1;
  let parentItem: AssetTree | AssetInfoFull = tree;
  let curItem: AssetTree | AssetInfoFull = tree;
  while (i <= parts.length) {
    const curPath = parts.slice(0, i).join(path.sep);
    let target = (curItem as AssetTree).children.find(it => it.relativePath === curPath);
    if (!target) {
      break;
    }
    if (i === parts.length) {
      (curItem as AssetTree).children = (curItem as AssetTree).children.filter(it => it !== target);
      if ((curItem as AssetTree).children.length === 0) {
        (parentItem as AssetTree).children = (parentItem as AssetTree).children.filter(it => it !== curItem);
      }
      result = target;
      break;
    }
    parentItem = curItem;
    curItem = target;
    i++;
  }
  return result;
}

export function isSameAssetMeta(tree1: AssetTree, tree2: AssetTree) {
  if (Array.isArray((tree1 as AssetTree).children) !== Array.isArray((tree2 as AssetTree).children)) {
    return false;
  }
  if (Array.isArray((tree1 as AssetTree).children)) {
    if ((tree1 as AssetTree).children.length !== (tree2 as AssetTree).children.length) {
      return false;
    }
    for (let i = 0; i < (tree1 as AssetTree).children.length; i++) {
      if (!isSameAssetMeta((tree1 as AssetTree).children[i], (tree2 as AssetTree).children[i])) {
        return false;
      }
    }
    return true;
  } else {
    return diffAssets(tree1 as AssetInfoFull, tree2 as AssetInfoFull) === null;
  }
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

export function toAssetListMeta(treeMeta: AssetTreeMeta): AssetListMeta {
  const {rootDir, ...tree} = treeMeta;
  const assetInfoList = assetInfoTreeToList(tree);
  return {
    rootDir,
    assetInfoList,
  };
}

export function getAssetInfoListFromMeta(meta: AssetMeta): AssetInfoFull[] {
  if (Array.isArray((meta as AssetListMeta).assetInfoList)) {
    return (meta as AssetListMeta).assetInfoList;
  }
  return assetInfoTreeToList(meta as AssetTree);
}

/**
 * Mainly used for init dir meta
 */
export async function getAssetFullInfoListOfDir(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<AssetInfoFull[]> {
  const infoTree = await getAssetFullInfoTreeMeta(rootDir, options);
  return assetInfoTreeToList(infoTree);
}

/**
 * Mainly used for comparision between latest assets and meta
 */
export async function getAssetsPartailInfoListOfDir(
  rootDir: string,
  options?: GetDirAssetOptions
): Promise<AssetInfoFull[]> {
  const infoTree = await getAssetPartialInfoTreeMeta(rootDir, options);
  return assetInfoTreeToList(infoTree);
}

export function assetInfoListToTree(assetInfoList: AssetInfoPartial[]) {
  const tree: AssetTree = {relativePath: '.', children: []};
  for (const info of assetInfoList) {
    const {relativePath} = info;
    if (!relativePath) {
      throw new Error(`relativePath not found for: ${relativePath}`);
    }
    insertItemToAssetTree(tree, info);
  }
  return tree;
}
export function toAssetTreeMeta(assetInfoList: AssetInfoPartial[], rootDir: string) {
  return {
    rootDir,
    ...assetInfoListToTree(assetInfoList),
  };
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

export function serializeMeta(meta: AssetTree) {
  if (meta.children) {
    return {
      ...meta,
      children: meta.children.map(serializeMeta),
    };
  }
  return serailizeAssetInfo(meta as AssetInfoFull);
}

export function deserailizeTreeMeta(meta: AssetTree) {
  if (meta.children) {
    return {
      ...meta,
      children: meta.children.map(deserailizeTreeMeta),
    };
  }
  return deserailizeAssetInfo(meta as AssetInfoFull);
}

/**
 * get meta dir of assets
 * the existence of meta dir means the assets is initialized
 */
export function getMetaDir(rootDir: string) {
  const metaDir = path.join(rootDir, META_DIR_NAME);
  return metaDir;
}

function getDefaultMetaFilePath(rootDir: string) {
  const metaDir = getMetaDir(rootDir);
  return path.resolve(metaDir, 'local.js');
}

export function readMetaFromDir(rootDir: string): AssetTreeMeta | undefined {
  const metaFile = getDefaultMetaFilePath(rootDir);
  if (!fs.existsSync(metaFile)) {
    return undefined;
  }
  const meta = (rerequire(metaFile) as MetaFileContent).meta as AssetMeta;
  return deserailizeTreeMeta(meta as AssetTreeMeta);
}

export function saveDirMeta(
  rootDir: string,
  assetMeta: AssetInfoFull[] | AssetTree,
  options?: {
    /**
     * If this param is not set, do not backup the meta file
     * If the count of backup file larger than this value, remove the extral file by date
     */
    maxBackupFileCnt?: number;
    /** if the last backup is less than this value, do not backup again */
    backUpInterval?: number;
  }
) {
  const {maxBackupFileCnt, backUpInterval} = options ?? {};
  if (Array.isArray(assetMeta)) {
    assetMeta = toAssetTreeMeta(assetMeta, rootDir);
  }
  const metaFile = getDefaultMetaFilePath(rootDir);
  makeSureDirExistForFile(metaFile);
  const lastBackupTime = fs.existsSync(metaFile) ? fs.statSync(metaFile).mtime.getTime() : 0;
  if (
    lastBackupTime > 0 &&
    isNumber(backUpInterval) &&
    backUpInterval > 0 &&
    lastBackupTime + backUpInterval < Date.now()
  ) {
    if (isNumber(maxBackupFileCnt) && maxBackupFileCnt > 0 && fs.existsSync(metaFile)) {
      fs.renameSync(metaFile, addDtSuffixToBareBasename(metaFile, {dtFormat: '-' + FILE_SUFFIX_DT_FORMAT}));
      /** remove the extral backup file by date */
      const reg = new RegExp(`^index-[\\dT-]+\\.js$`);
      const backupFiles = getFileList(getMetaDir(rootDir), {fileFilter: ({basename}) => reg.test(basename)});
      if (backupFiles.length > maxBackupFileCnt) {
        backupFiles.sort((a, b) => fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime());
        const filesToRemove = backupFiles.slice(0, maxBackupFileCnt);
        for (const file of filesToRemove) {
          fs.unlinkSync(file);
        }
      }
    }
  }
  makeSureDirExistForFile(metaFile);
  const serializedMeta = serializeMeta(assetMeta);
  const metaFileContent: MetaFileContent = {
    meta: serializedMeta,
    timestamp: toDtStr(),
  };
  fs.writeFileSync(metaFile, convertObjectToCjsExport(metaFileContent, {format: true}));
}
/** End: meta file persistence in dir level */
/** Start: meta file persistence in file level */
export function readMetaFromFile(metaFile: string): AssetTreeMeta | undefined {
  if (!fs.existsSync(metaFile)) {
    return undefined;
  }
  const meta = rerequire(metaFile).meta as AssetMeta;
  return deserailizeTreeMeta(meta as AssetTreeMeta);
}

/**
 * @deprecated metaFile will make logic more complex, and not easy to maintain, so it will be removed in the future
 */
export function saveMetaToFile(metaFile: string, meta: AssetTreeMeta) {
  makeSureDirExistForFile(metaFile);
  const serializedMeta = serializeMeta(meta);
  fs.writeFileSync(metaFile, `export const meta = ${JSON.stringify(serializedMeta, null, 2)}`);
}
/** End: meta file persistence in file level */
