import fs from 'fs';
import path from 'path';
import {hashData, logColorful, byteToWord, isBoolean, toDate, formatDate, toDurationStr} from '../external';
import {SHORT_ID_LENGTH} from './config';
import {AssetInfoPartial, AssetInfoFull, GetAssetInfoParams} from '../types';
import {appendShortIdToFilePath, parseFilePath} from './short-id';

function getShortId(sha1: string): string {
  return sha1.slice(0, SHORT_ID_LENGTH);
}

export async function getSha1AsId(fullPath: string): Promise<Pick<AssetInfoFull, 'sha1' | 'shortId'>> {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`file not exist: ${fullPath}`);
  }
  const st = fs.statSync(fullPath);
  if (st.isDirectory()) {
    throw new Error(`Cannot hash a directory: ${fullPath}`);
  }
  const sha1 = await hashData(fs.createReadStream(fullPath), {algorithm: 'sha1', encode: 'base64url'});
  return {
    sha1,
    shortId: getShortId(sha1),
  };
}

/**
 * Get asset info from stat, that can used to check whether asset is changed by asset info compare
 * @param stat
 * @returns
 */
function getAssetInfoFromStat(stat: fs.Stats): Pick<AssetInfoPartial, 'changeDate' | 'modifyDate' | 'size'> {
  const info = {
    changeDate: stat.ctime,
    modifyDate: stat.mtime,
    size: stat.size,
  };
  return info;
}

/**
 * Get info from asset, try to avoid sha1 calculation as much as possible
 * 1. calculate sha1 only when reCalcId is true, by default will not calculate sha1 in consideration of cost
 * 2. calculate shortId only when shortIdFromName is not exist
 */
export async function getAssetInfo(options?: GetAssetInfoParams): Promise<AssetInfoPartial> {
  const {relativePath, rootDir, reCalcId, appendShortId, logging} = options ?? {};
  const fullPath = options?.fullPath ?? path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not exist: ${fullPath}`);
  }
  const {shortId: shortIdFromName, extname} = parseFilePath(fullPath);
  const stat = options?.stat ?? fs.statSync(path.resolve(rootDir, relativePath));
  if (stat.isDirectory()) {
    throw new Error(`Not a file (directory): ${fullPath}`);
  }
  let fileStatInfo = getAssetInfoFromStat(stat);

  let fixedFullPath: string | undefined;
  let sha1: string;
  let shortId = shortIdFromName;
  /** SHA-1 computation should be avoided because it is resource-intensive. */
  if (reCalcId) {
    const start = Date.now();
    if (logging) {
      logColorful({}, `calculating sha1 for file ${fullPath}[${byteToWord(fileStatInfo.size)}]`);
    }
    const sha1Info = await getSha1AsId(fullPath);
    sha1 = sha1Info.sha1;
    if (logging) {
      logColorful({}, `[${toDurationStr(Date.now() - start)}]sha1: ${sha1}`);
    }
    /** fix shortId when it's not correct after sha1 calculation */
    if (shortIdFromName !== sha1Info.shortId) {
      shortId = sha1Info.shortId;
      /** append correct shortId to filename */
      if (shortIdFromName || appendShortId) {
        fixedFullPath = appendShortIdToFilePath(fullPath, shortId);
        if (fixedFullPath !== fullPath) {
          fs.renameSync(fullPath, fixedFullPath);
        }
      }
    }
  }
  /** use fullPath if it's passed, otherwise use relativePath */
  const finalPathValue = fixedFullPath
    ? options?.fullPath
      ? fixedFullPath
      : path.relative(rootDir, fixedFullPath)
    : (options?.fullPath ?? relativePath);
  const assetInfo: AssetInfoPartial = {
    relativePath: finalPathValue,
    extname,
    ...(fixedFullPath
      ? getAssetInfoFromStat(fs.statSync(path.resolve(rootDir, fixedFullPath)))
      : fileStatInfo),
    sha1,
    shortId,
  };
  for (const key of Object.keys(assetInfo) as Array<keyof AssetInfoPartial>) {
    if (assetInfo[key] === undefined) {
      delete assetInfo[key];
    }
  }
  return assetInfo;
}

export async function getFullAssetInfo(options: GetAssetInfoParams): Promise<AssetInfoFull> {
  const assetInfo = await getAssetInfo({...options, reCalcId: true});
  return assetInfo as AssetInfoFull;
}
export async function getPartialAssetInfo(options: GetAssetInfoParams) {
  const assetInfo = await getAssetInfo({...options, reCalcId: false});
  return assetInfo;
}

/**
 * Convert from partial asset info to full asset info
 */
export async function toFullAssetInfo(
  assetInfo: AssetInfoPartial,
  rootDir: string,
  options?: Pick<GetAssetInfoParams, 'appendShortId'>
): Promise<AssetInfoFull> {
  const {sha1, shortId, relativePath} = assetInfo;
  /** id is undefined means, shortId is got from filePath, which is not correct maybe. */
  if (sha1 === undefined) {
    return getFullAssetInfo({
      relativePath,
      rootDir,
      ...(options ?? {}),
      reCalcId: true,
    });
  }
  if (shortId === undefined) {
    return {
      ...assetInfo,
      sha1,
      shortId: getShortId(sha1),
    } as AssetInfoFull;
  }
  return assetInfo as AssetInfoFull;
}

function compareAssetProp(
  firstValue: Date | boolean | number | string,
  secondValue: Date | boolean | number | string,
  key: keyof AssetInfoFull
) {
  if (['modifyDate', 'changeDate'].includes(key)) {
    /** accurate is millisecond */
    const fileDateInMs = toDate(firstValue as Date | string).getTime();
    const dbDateInMs = toDate(secondValue as Date | string).getTime();
    return fileDateInMs === dbDateInMs;
  } else if (isBoolean(firstValue)) {
    return firstValue == Boolean(secondValue);
  } else {
    return firstValue === secondValue;
  }
}

/**
 * Get the diff between these two assetInfo, to get what should be changed
 * if we want align @param item info with @param refer info
 * @param refer only compare props in @param refer
 * @param current asset info on db
 */
export function diffAssets(
  refer: AssetInfoFull,
  current: AssetInfoFull,
  keyList?: Array<keyof AssetInfoFull>
) {
  keyList =
    keyList ??
    (['sha1', 'shortId', 'relativePath', 'extname', 'size', 'modifyDate', 'changeDate'] as Array<
      keyof AssetInfoFull
    >);
  const diff: Partial<AssetInfoFull> = {};
  for (const key of keyList) {
    if (refer[key] !== undefined && !compareAssetProp(refer[key], current[key], key as keyof AssetInfoFull)) {
      // @ts-ignore
      diff[key] = current[key];
    }
  }
  if (Object.keys(diff).length > 0) {
    return diff;
  } else {
    return null;
  }
}

const dtFormat = 'yyyy-MM-ddThh:mm:ss.SSSz';
export function serailizeAssetInfo(info: Partial<AssetInfoPartial>) {
  if (!info) {
    return null;
  }
  const result = {...info};
  if (result.modifyDate) {
    // @ts-ignore
    result.modifyDate = formatDate(result.modifyDate, dtFormat);
  }
  if (result.changeDate) {
    // @ts-ignore
    result.changeDate = formatDate(result.changeDate, dtFormat);
  }
  return result;
}

export function deserailizeAssetInfo(info: Partial<AssetInfoPartial>) {
  if (!info) {
    return null;
  }
  const result = {...info};
  if (result.modifyDate) {
    result.modifyDate = toDate(result.modifyDate);
  }
  if (result.changeDate) {
    result.changeDate = toDate(result.changeDate);
  }
  return result;
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
