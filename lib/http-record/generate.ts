import fs from 'fs';
import path from 'path';
import {isPlainObject} from '../../external';
import {
  makeSureHttpRequestOptionsSerializable,
  mergeHttpRequestOptions,
  requestAndGetResponseInfo,
} from '../../http';
import {RecordHttpByDirOptions, RecordHttpOptions, HttpRecordContent, RequestOptionsForMock} from './types';
import {getMultipleDirFileList, makeSureDirExist} from '../../fs';
import {urlPropsToHref} from '../../../fe/url';
import {MOCK_FILE_SUFFIX} from './service';
import {selectFileAndGetExports} from '../../utils';

export function convertObjectToCjsContent<T extends HttpRecordContent>(info: T) {
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
    }`;
    return line;
  });
  return lines.join('\n');
}

/**
 * Create output dir if not exist
 * @param info
 * @param requestOptions
 * @returns
 */
function getFullPath(
  info: Pick<RecordHttpOptions, 'fullPath' | 'outputDir' | 'getBasename'>,
  requestOptions: RequestOptionsForMock
) {
  const {fullPath, outputDir, getBasename = getMockFileBaseName} = info;
  const finalPath = fullPath ?? outputDir ? path.join(outputDir, getBasename(requestOptions)) : undefined;
  if (!finalPath) {
    throw new Error(`Can not generate full path by options provided`);
  }
  makeSureDirExist(finalPath);
  return finalPath;
}
function getMockFileBaseName(requestOptions: RequestOptionsForMock) {
  const {pathname, query} = requestOptions;
  const url = urlPropsToHref({pathname, query});
  return encodeURIComponent(url) + MOCK_FILE_SUFFIX;
}
export async function recordHttpRequest<ResData = any>(
  requestOptions: RequestOptionsForMock,
  options: RecordHttpOptions
) {
  const {defaultRequestOptions, moreMockItems} = options;
  const mergedOptions = mergeHttpRequestOptions(requestOptions, defaultRequestOptions);
  const fullPath = getFullPath(options, mergedOptions);
  const {validateStatus, printCurlCommandOnError} = options;
  const {responseInfo, requestOptions: finalRequestOptions} = await requestAndGetResponseInfo<ResData>(
    mergedOptions,
    {
      validateStatus,
      printCurlCommandOnError,
    }
  );
  console.log(`writing mock file ${fullPath}`);
  const content: HttpRecordContent = {
    ignore: false,
    // queryCompare: {

    // },
    // payloadCompare: {
    //   ignore: false,
    //   includeObjectKeys: null,
    //   excludeObjectKeys: {},
    // },
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

export async function recordHttpRequestBySelectConfigFile(options: RecordHttpByDirOptions) {
  const {targetDirList, moreMockItems = {}, ...restOptions} = options;
  const {
    allExports: {requestOptions, ...restExports},
    relativePath,
  } = await selectFileAndGetExports<{
    requestOptions: RequestOptionsForMock;
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
  const fileList = getMultipleDirFileList(targetDirList);
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
