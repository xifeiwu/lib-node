import fs from 'fs';
import path from 'path';
import {deepEqual, isObject, matchFilters} from '../../external';
import {getFileList} from '../../fs';
import {FindRecordInfoInDirOptions, RecordHttpRequestContent, RequestOptionsForMock, RecordFileFinder} from './types';

function unifyObject(value: any) {
  if (isObject(value)) {
    if (Object.keys(value).length === 0) {
      return undefined;
    }
  }
  return value;
}

export function findMockFile(
  targetRequestConfig: RequestOptionsForMock,
  mockContentList: MockFileContentWithPathInfo[],
  options?: {
    debugCompare?: FindRecordInfoInDirOptions['debugCompare'];
  }
) {
  const {debugCompare = false} = options ?? {};
  if (!targetRequestConfig) {
    return null;
  }
  const {
    pathname: targetPathname,
    method: targetMethod,
    query: targetQuery,
    data: targetPayload,
  } = targetRequestConfig;
  const target = mockContentList.find(it => {
    const {relativePath, ignore, requestOptions, payloadCompare = {}, queryCompare = {}} = it;
    if (ignore || !requestOptions) {
      return false;
    }
    const {method, pathname, query, data: payload} = requestOptions;
    if (debugCompare) {
      console.log(`start compare: ${relativePath}`);
    }
    /** compare method and pathname first */
    const httpHeaderMatched = deepEqual(
      {pathname, method},
      {pathname: targetPathname, method: targetMethod},
      {
        debug: debugCompare,
      }
    );
    if (!httpHeaderMatched) {
      return false;
    }

    const queryMatched =
      queryCompare.ignore === true ||
      deepEqual(unifyObject(query), unifyObject(targetQuery), {
        includeObjectKeys: queryCompare.includeObjectKeys,
        excludeObjectKeys: queryCompare.excludeObjectKeys,
        debug: debugCompare,
      });
    if (!queryMatched) {
      return false;
    }

    const payloadMatched =
      payloadCompare.ignore === true ||
      deepEqual(unifyObject(payload), unifyObject(targetPayload), {
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
  return target;
}

export interface MockFileContentWithPathInfo extends RecordHttpRequestContent {
  fullPath: string;
  relativePath: string;
}
export function getMockFileFinderByDir(options: FindRecordInfoInDirOptions): {
  mockFileList: Array<MockFileContentWithPathInfo>;
  finder: RecordFileFinder;
} {
  const {targetDir, includedFileList, excludedFileList, debugCompare, getFileListOptions} = options;
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Error, dir not exist: ${targetDir}`);
  }
  const relativeFileList = getFileList(targetDir, getFileListOptions);
  let targetFileList: string[] = relativeFileList;
  if (Array.isArray(includedFileList)) {
    targetFileList = relativeFileList.filter(it => matchFilters(includedFileList, it));
  } else if (Array.isArray(excludedFileList)) {
    targetFileList = relativeFileList.filter(it => !matchFilters(excludedFileList, it));
  }
  const mockFileList: MockFileContentWithPathInfo[] = targetFileList
    .map(relativePath => {
      const fullPath = path.resolve(targetDir, relativePath);
      try {
        const mockFileContent = require(fullPath) as RecordHttpRequestContent;
        return {...mockFileContent, relativePath, fullPath};
      } catch (err) {
        console.log(`Error, require mock file: ${fullPath}`);
        // console.log(err);
        return null;
      }
    })
    .filter(it => Boolean(it));
  const finder = (targetRequestConfig: RequestOptionsForMock) => {
    if (targetFileList.length === 0) {
      return null;
    }
    return findMockFile(targetRequestConfig, mockFileList, {debugCompare});
  };
  return {mockFileList, finder};
}
