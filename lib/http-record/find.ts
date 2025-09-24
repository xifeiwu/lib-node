import fs from 'fs';
import path from 'path';
import {deepEqual, unifyNull, isSameUrlTarget, isString} from '../../external';
import {
  FindRecordFileOptions,
  HttpRecordContent,
  HttpRecordContentWithPathInfo,
  HttpRecordInfoForCompare,
} from './types';
import {getFileList, HttpRequestOptions} from '../..';

function isSameMethod(m1?: string, m2?: string) {
  if (isString(m1) && isString(m2)) {
    return m1.trim().toLowerCase() === m2.trim().toLowerCase();
  }
  return m1 === m2;
}

/**
 * TODO: use common logic isSameRequest of lib/url
 * @param targetRequestConfig
 * @param recordFileList
 * @param options
 * @returns
 */
export function findRecordFile(
  targetRequestConfig: HttpRequestOptions,
  recordFileList: HttpRecordInfoForCompare[],
  options?: {
    debugCompare?: FindRecordFileOptions['debugCompare'];
  }
) {
  const {debugCompare = false} = options ?? {};
  if (!targetRequestConfig) {
    return null;
  }
  const {method: targetMethod, data: targetPayload} = targetRequestConfig;
  const target = recordFileList.find(it => {
    const {
      relativePath,
      ignore,
      requestOptions,
      requestCompare: {query: queryCompare = {}, payload: payloadCompare = {}} = {},
    } = it;
    if (ignore || !requestOptions) {
      return false;
    }
    if (debugCompare) {
      console.log(`start compare: ${relativePath}`);
    }
    const {method = 'get', data: payload} = requestOptions;
    if (!isSameMethod(targetMethod, method)) {
      return false;
    }

    if (!isSameUrlTarget(targetRequestConfig, requestOptions, {ignoreOrigin: true})) {
      return false;
    }

    const payloadMatched =
      payloadCompare.ignore === true ||
      deepEqual(unifyNull(payload), unifyNull(targetPayload), {
        includeObjectKeys: payloadCompare.includeObjectKeys,
        excludeObjectKeys: payloadCompare.excludeObjectKeys,
        debug: debugCompare,
      });
    if (!payloadMatched) {
      return false;
    }
    if (debugCompare) {
      console.log(`matched: ${relativePath}`);
    }
    return true;
  });
  return target ?? null;
}

type HttpRecordFileFinder = (requestConfig: HttpRequestOptions) => HttpRecordContentWithPathInfo | null;
type GetRecordFileList = () => Array<HttpRecordInfoForCompare>;

export function getHttpRecordFinder(options: FindRecordFileOptions): {
  getRecordFileList: GetRecordFileList;
  finder: HttpRecordFileFinder;
} {
  const {ignore, debugCompare, getFileListOptions} = options;
  // let recordFileList: HttpRecordContenttWithPathInfo[] = [];
  let getRecordFileList: GetRecordFileList = () => [];
  let finder: HttpRecordFileFinder = () => undefined;
  if (ignore) {
    return {getRecordFileList, finder};
  }
  const dirMap: {
    [dir: string]: Array<HttpRecordInfoForCompare>;
  } = {};
  function updateFileList(target?: string) {
    const dirs = target ? getFileListOptions.filter(it => it.targetDir === target) : getFileListOptions;
    for (const {targetDir, options} of dirs) {
      const fileList = getFileList(targetDir, options);
      dirMap[targetDir] = fileList
        .map(relativePath => {
          const fullPath = path.join(targetDir, relativePath);
          try {
            /** Not import responseInfo to avoid too much memory consume */
            const {ignore, requestOptions, requestCompare} = require(fullPath) as HttpRecordContent;
            delete require.cache[fullPath];
            return {ignore, requestOptions, requestCompare, relativePath, fullPath};
          } catch (err) {
            console.log(`Error, require mock file: ${fullPath}`);
            // console.log(err);
            return null;
          }
        })
        .filter(it => Boolean(it));
    }
  }
  for (const dirInfo of getFileListOptions) {
    const {targetDir} = dirInfo;
    if (fs.existsSync(targetDir)) {
      fs.watch(targetDir, () => updateFileList(targetDir));
    }
  }
  updateFileList();
  getRecordFileList = () => {
    return Object.values(dirMap).flat();
  };

  finder = (requestConfig: HttpRequestOptions) => {
    const recordFileList = getRecordFileList();
    if (recordFileList.length === 0) {
      return null;
    }
    const target = findRecordFile(requestConfig, recordFileList, {debugCompare});
    if (target) {
      if (target.matchCount === undefined) {
        target.matchCount = 1;
      } else {
        target.matchCount++;
      }
      delete require.cache[target.fullPath];
      const {responseInfo} = require(target.fullPath) as HttpRecordContent;
      return {
        ...target,
        responseInfo,
      };
    }
    return null;
  };
  return {getRecordFileList, finder};
}
