import fs from 'fs';
import path, {relative} from 'path';
import {hashData, logColorful, byteToWord, isBoolean, isDate, toDate, getFilePathInfo} from '../external';
import {SHORT_ID_LENGTH} from './constant';
import {AssetInfoPartial, AssetInfoFull, GetAssetInfoParams} from '../types';
import {appendShortIdToFilePath, parseFilePath} from './short-id';

export async function getSha1AsId(fullPath: string): Promise<Pick<AssetInfoFull, 'sha1' | 'shortId'>> {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`file not exist: ${fullPath}`);
  }
  const sha1 = await hashData(fs.createReadStream(fullPath), {algorithm: 'sha1', encode: 'base64url'});
  return {
    sha1,
    shortId: sha1.substring(0, SHORT_ID_LENGTH),
  };
}

/**
 * Get info from asset, try to avoid sha1 calculation as much as possible
 * @returns
 */
export async function getAssetInfo(options?: GetAssetInfoParams): Promise<AssetInfoPartial> {
  const {relativePath, rootDir, reCalcId, appendShortId, logging} = options ?? {};
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not exist: ${fullPath}`);
  }
  const {shortId: shortIdFromName, extname} = parseFilePath(fullPath);
  let newRelativePath = relativePath;
  /** file stat may be change by action of appendIdToFile */
  const newFullPath = path.resolve(rootDir, newRelativePath);
  const stat = fs.statSync(newFullPath);
  const {ctime, mtime, size: sizeInByte} = stat;
  let sha1: string;
  let shortId = shortIdFromName;
  if (reCalcId) {
    if (logging) {
      logColorful({}, `calculating sha1 for file ${fullPath}[${byteToWord(sizeInByte)}]`);
    }
    const sha1Info = await getSha1AsId(fullPath);
    sha1 = sha1Info.sha1;
    if (shortIdFromName !== sha1Info.shortId) {
      shortId = sha1Info.shortId;
      /**
       * If shortIdFromBaseName exist and it's vlaue is different from shortId calculated
       * we should update shortId on file basename
       */
      if (shortIdFromName || appendShortId) {
        newRelativePath = appendShortIdToFilePath(relativePath, shortId);
        if (newRelativePath !== relativePath) {
          fs.renameSync(path.resolve(rootDir, fullPath), path.resolve(rootDir, newRelativePath));
        }
      }
    }
  }
  const assetInfo: AssetInfoPartial = {
    relativePath: newRelativePath,
    changeDate: ctime,
    modifyDate: mtime,
    size: sizeInByte,
    extname,
  };
  /** add prop id only when id exist, as all props of assetInfo will be used for asset compare */
  if (sha1) {
    assetInfo.sha1 = sha1;
  }
  if (shortId) {
    assetInfo.shortId = shortId;
  }
  return assetInfo;
}

function convertOptions(options: Partial<GetAssetInfoParams> & {fullPath?: string}): GetAssetInfoParams {
  const {fullPath, ...restOptions} = options;
  const {dirname, basename} = getFilePathInfo(fullPath);
  return {...restOptions, rootDir: dirname, relativePath: basename};
}

/**
 * A wrapper for getAssetInfo with functionality:
 * 1. pass value of reCalcId for getFullAssetInfo
 * 2. support param with type Partial<GetAssetInfoParams> & {fullPath?: string}, which is very useful for some scenario
 */
export async function getFullAssetInfo(
  options: Partial<GetAssetInfoParams> & {fullPath?: string}
): Promise<AssetInfoFull> {
  const assetInfo = await getAssetInfo({...convertOptions(options), reCalcId: true});
  return assetInfo as AssetInfoFull;
}
export async function getPartialAssetInfo(
  options: Partial<GetAssetInfoParams> & {fullPath?: string}
): Promise<AssetInfoPartial> {
  const assetInfo = await getAssetInfo({...convertOptions(options), reCalcId: false});
  return assetInfo;
}

export async function toFullAssetInfo(
  assetInfo: AssetInfoPartial,
  rootDir: string,
  options?: Pick<GetAssetInfoParams, 'appendShortId'>
): Promise<AssetInfoFull> {
  const {sha1, shortId, relativePath} = assetInfo;
  /** id is undefined means, shortId is got from filePath, which is not correct maybe. */
  if (sha1 === undefined) {
    return getAssetInfo({
      relativePath,
      rootDir,
      ...(options ?? {}),
      reCalcId: true,
    }) as Promise<Required<AssetInfoPartial>>;
  }
  return {...assetInfo, sha1, shortId};
}

function compareAssetProp(
  fileValue: Date | boolean | number | string,
  dbValue: Date | boolean | number | string
) {
  if (isDate(fileValue)) {
    /** accurate is millisecond */
    const fileDateInMs = toDate(fileValue as Date | string).getTime();
    const dbDateInMs = toDate(dbValue as Date | string).getTime();
    return fileDateInMs === dbDateInMs;
  } else if (isBoolean(fileValue)) {
    return fileValue == Boolean(dbValue);
  } else {
    return fileValue === dbValue;
  }
}
/**
 * Get the diff between these two assetInfo, to get what should be changed if we want make properties of item the same as properties of refer
 * @param refer only compare props of refer
 * @param item asset info on db
 */
export function diffAssets(refer: AssetInfoFull, item: AssetInfoFull) {
  const diff: Partial<AssetInfoFull> = {};
  for (const key of ['sha1', 'shortId', 'relativePath', 'extname', 'size', 'modifyDate', 'changeDate']) {
    if (refer[key] !== undefined && !compareAssetProp(refer[key], item[key])) {
      diff[key] = refer[key];
    }
  }
  if (Object.keys(diff).length > 0) {
    return diff;
  } else {
    return null;
  }
}

export function toAssetInfoArray(info: AssetInfoFull[] | AssetInfoFull) {
  if (Array.isArray(info)) {
    return info;
  }
  return [info];
}

export function getOneAssetInfo(info: AssetInfoFull[] | AssetInfoFull) {
  if (Array.isArray(info)) {
    if (info.length === 0) {
      return null;
    }
    return info[0];
  }
  return info;
}
