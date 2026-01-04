import fs from 'fs';
import path from 'path';
import {isPlainObject} from '../../external';
import {
  makeSureHttpRequestOptionsSerializable,
  mergeHttpRequestOptions,
  requestAndGetResponseInfo,
} from '../../http';
import {RecordHttpByDirOptions, RecordHttpOptions, HttpRecordContent, HttpRequestOptions} from './types';
import {getFileListOfMultipleDir} from '../../fs';
import {MOCK_FILE_SUFFIX} from './service';
import {selectFileAndGetExports} from '../../utils';
import {SendRequestWithResponseInfoResult} from '../../types';
import {getHashDigest} from '../../crypto';
import {convertToBuffer} from '../../transform';
import {makeSureDirExistForFile} from '../../path';

export function convertObjectToCjsContent<T extends HttpRecordContent>(info: T) {
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
    }`;
    return line;
  });
  return lines.join('\n');
}

function getMockFileBaseName(requestResult: SendRequestWithResponseInfoResult) {
  const {
    url: {pathname, search},
    requestOptions: {method, data},
  } = requestResult;
  const searchKey = search
    ? search.length > 12
      ? getHashDigest(convertToBuffer(search), {algorithm: 'md5', maxDigestLength: 8})
      : encodeURIComponent(search)
    : '';

  const dataKey = data ? getHashDigest(convertToBuffer(data), {algorithm: 'md5', maxDigestLength: 8}) : '';
  return (
    [method ?? '', encodeURIComponent(pathname), searchKey, dataKey]
      .filter(it => it.trim().length > 0)
      .join('-') + MOCK_FILE_SUFFIX
  );
}
/**
 * Create output dir if not exist
 * @param info
 * @param requestResult
 * @returns
 */
function getFullPath(
  info: Pick<RecordHttpOptions, 'fullPath' | 'outputDir' | 'getBasename'>,
  requestResult: SendRequestWithResponseInfoResult
) {
  const {fullPath, outputDir, getBasename = getMockFileBaseName} = info;
  const finalPath = (fullPath ?? outputDir) ? path.join(outputDir, getBasename(requestResult)) : undefined;
  if (!finalPath) {
    throw new Error(`Can not generate full path by options provided`);
  }
  makeSureDirExistForFile(finalPath);
  return finalPath;
}

export function recordHttpRequestResult(
  requestResult: Awaited<ReturnType<typeof requestAndGetResponseInfo>>,
  options: RecordHttpOptions
) {
  const {defaultRequestOptions, moreMockItems} = options;
  const {responseInfo, requestOptions: finalRequestOptions} = requestResult;
  const fullPath = getFullPath(options, requestResult);
  console.log(`writing mock file ${fullPath}`);
  const content: HttpRecordContent = {
    ignore: false,
    requestCompare: {
      query: {
        ignore: false,
        includeObjectKeys: null,
        excludeObjectKeys: {},
      },
      payload: {
        ignore: false,
        includeObjectKeys: null,
        excludeObjectKeys: {},
      },
    },
    requestOptions: makeSureHttpRequestOptionsSerializable(finalRequestOptions),
    responseInfo,
    ...(moreMockItems ?? {}),
  };
  fs.writeFileSync(fullPath, convertObjectToCjsContent(content));
  return {content, fullPath};
}
/**
 * send a http request, and save all request info to a file, include request info and response info
 */
export async function recordHttpRequest<ResData = any>(
  requestOptions: HttpRequestOptions,
  options: RecordHttpOptions
) {
  const {defaultRequestOptions, moreMockItems} = options;
  const mergedOptions = mergeHttpRequestOptions(requestOptions, defaultRequestOptions);
  const {validateStatus, printCurlCommandOnError} = options;
  const requestResult = await requestAndGetResponseInfo<ResData>(mergedOptions, {
    validateStatus,
    printCurlCommandOnError,
  });
  return recordHttpRequestResult(requestResult, options);
}

/**
 * list all request configs under the dir, select the one want to record
 */
export async function recordHttpRequestBySelectConfigFile(options: RecordHttpByDirOptions) {
  const {targetDirList, moreMockItems = {}, ...restOptions} = options;
  const {
    allExports: {requestOptions, ...restExports},
    relativePath,
  } = await selectFileAndGetExports<{
    requestOptions: HttpRequestOptions;
  }>(targetDirList);
  return await recordHttpRequest(requestOptions, {
    /** User relativePath as mock file name */
    getBasename() {
      return relativePath;
    },
    ...restOptions,
    moreMockItems: {
      ...restExports,
      ...moreMockItems,
    },
  });
}

/**
 * recordHttpRequest for all the config files of target dir
 */
export async function recordHttpRequestByDir(options: RecordHttpByDirOptions) {
  const {targetDirList, moreMockItems = {}, ...restOptions} = options;
  // requestConfigDir: string, options: RequestByDir
  // const {outputDir} = options;
  // if (!fs.existsSync(targetDirList)) {
  //   throw new Error(`Error, request config dir not exist: ${targetDirList}`);
  // }
  // if (!fs.existsSync(outputDir)) {
  //   logColorful({color: 'yellow'}, `Will create dir: ${outputDir}`);
  //   fs.mkdirSync(outputDir, {recursive: true});
  //   // throw new Error(`Error, output dir not exist: ${outputDir}`);
  // }
  const fileList = getFileListOfMultipleDir(targetDirList);
  for (const {fullPath, relativePath} of fileList) {
    console.log(`reqesting using config from file ${fullPath}`);
    const {requestOptions, ...restExports} = require(fullPath) as HttpRecordContent;
    // await generateMockInfoByRequest(requestOptions, {
    //   ...restOptions,
    //   moreMockItems: {
    //     ...moreMockItems,
    //     ...restExports,
    //   },
    // });
    const result = await recordHttpRequest(requestOptions, {
      /** User relativePath as mock file name */
      getBasename() {
        return relativePath;
      },
      ...restOptions,
      moreMockItems: {
        ...restExports,
        ...moreMockItems,
      },
    });
  }
}
