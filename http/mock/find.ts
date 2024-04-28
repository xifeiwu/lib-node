import fs from 'fs';
import path from 'path';
import {deepEqual, isObject} from '../../external';
import {getFileList} from '../../fs';
import {ParamsForFindMockInfoInDir, MockFileContent, RequestConfig, MockFileFinder} from './types';

function convertPayload(value: any) {
  if (isObject(value)) {
    if (Object.keys(value).length === 0) {
      return undefined;
    }
  }
  return value;
}

export function findMockFile(
  targetRequestConfig: RequestConfig,
  mockContentList: MockFileContentWithRelativePath[],
  options?: {
    debugCompare?: ParamsForFindMockInfoInDir['options']['debugCompare'];
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
    const {relativePath, ignore, requestConfig, includeObjectKeys, excludeObjectKeys, ignoreComparePayload} =
      it;
    if (ignore || !requestConfig) {
      return false;
    }
    const {method, pathname, query, data: payload} = requestConfig;
    if (debugCompare) {
      console.log(`start compare: ${relativePath}`);
    }
    /** compare method, url, query first, as it is easy to compare */
    const httpHeaderMatched = deepEqual(
      {pathname, method, query},
      {pathname: targetPathname, method: targetMethod, query: targetQuery},
      {
        debug: debugCompare,
      }
    );
    if (!httpHeaderMatched) {
      return false;
    }

    const payloadMatched =
      ignoreComparePayload === true ||
      deepEqual(convertPayload(payload), convertPayload(targetPayload), {
        includeObjectKeys,
        excludeObjectKeys,
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

export interface MockFileContentWithRelativePath extends MockFileContent {
  relativePath: string;
}
export function getMockFileFinderByDir(config: ParamsForFindMockInfoInDir): {
  mockFileList: Array<MockFileContentWithRelativePath>;
  finder: MockFileFinder;
} {
  const {targetDir, options = {}} = config;
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Error, dir not exist: ${targetDir}`);
  }
  const relativeFileList = getFileList(targetDir, {
    fileFilter({relativePath}) {
      return relativePath.endsWith('.js');
    },
  });
  let targetFileList: string[] = relativeFileList;
  const {includedFileList, excludedFileList, debugCompare} = options;
  if (Array.isArray(includedFileList)) {
    targetFileList = relativeFileList.filter(it => includedFileList.includes(it));
  } else if (Array.isArray(excludedFileList)) {
    targetFileList = relativeFileList.filter(it => !excludedFileList.includes(it));
  }
  const mockFileList: MockFileContentWithRelativePath[] = targetFileList
    .map(relativePath => {
      const fullPath = path.resolve(targetDir, relativePath);
      try {
        const mockFileContent = require(fullPath) as MockFileContent;
        return {...mockFileContent, relativePath};
      } catch (err) {
        console.log(`Error, require mock file: ${fullPath}`);
        // console.log(err);
        return null;
      }
    })
    .filter(it => Boolean(it));
  const finder = (targetRequestConfig: RequestConfig) => {
    if (targetFileList.length === 0) {
      return null;
    }
    return findMockFile(targetRequestConfig, mockFileList, {debugCompare});
  };
  return {mockFileList, finder};
}
