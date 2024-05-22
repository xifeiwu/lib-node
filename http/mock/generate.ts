import fs from 'fs';
import path from 'path';
import {getUrlPropsFromConfig, isPlainObject} from '../../external';
import {
  GeneralRequestOptions,
  HttpRequestOptions,
  makeSureHttpRequestOptionsSerializable,
  mergeHttpRequestOptions,
  requestAndGetRelatedInfo,
} from '../client';
import {MockFileContent, RequestConfig} from './types';
import {getFileList} from '../../fs';
import {urlPropsToHref} from '../../../fe/url';
import {logWithColor} from '../../log';

export function convertObjectToCjsContent<T extends MockFileContent>(info: T) {
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
    }`;
    return line;
  });

  return lines.join('\n');
}

interface RequestGeneral {
  /** request config for all requestConfig under requestConfigDir */
  generalRequestConfig?: HttpRequestOptions;
}
interface RequestOne extends RequestGeneral {
  fullPath: string;
  otherContents?: Omit<MockFileContent, 'requestConfig'>;
}
interface RequestByDir extends RequestGeneral {
  outputDir: string;
}

export async function requestAndSaveMockInfo(requestConfig: RequestConfig, options: RequestOne) {
  const {generalRequestConfig, otherContents} = options;
  const mergedOptions = mergeHttpRequestOptions(requestConfig, generalRequestConfig);
  let fullPath =
    options.fullPath ??
    path.resolve(
      process.cwd(),
      encodeURIComponent(urlPropsToHref(getUrlPropsFromConfig(mergedOptions).urlProps))
    );
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: false});
  }
  // if (!fs.existsSync(mockFileDir)) {
  //   console.log(`Error, dir not exist: ${mockFileDir}`);
  //   console.log(`You can try to create the dir by command:`);
  //   console.log(`mkdir -p ${mockFileDir}`);
  //   throw new Error();
  // }
  const {
    responseInfo: {headers, data: resData},
  } = await requestAndGetRelatedInfo(mergedOptions, {validateStatus: true});
  if (!fullPath.endsWith('.js')) {
    fullPath = fullPath + '.js';
  }
  console.log(`writing mock file ${fullPath}`);
  fs.writeFileSync(
    fullPath,
    convertObjectToCjsContent({
      ignore: false,
      ignoreComparePayload: false,
      includeObjectKeys: null,
      excludeObjectKeys: null,
      requestConfig: makeSureHttpRequestOptionsSerializable(requestConfig),
      resHeaders: headers,
      resData,
      ...(otherContents ?? {}),
    })
  );
}

export async function generateMockInfoByDir(requestConfigDir: string, options: RequestByDir) {
  const {outputDir} = options;
  if (!fs.existsSync(requestConfigDir)) {
    throw new Error(`Error, request config dir not exist: ${requestConfigDir}`);
  }
  if (!fs.existsSync(outputDir)) {
    logWithColor('yellow', `Will create dir: ${outputDir}`);
    fs.mkdirSync(outputDir, {recursive: true});
    // throw new Error(`Error, output dir not exist: ${outputDir}`);
  }
  const relativeFileList = getFileList(requestConfigDir, {
    fileFilter({relativePath}) {
      return relativePath.endsWith('.ts');
    },
  });
  for (const relativeFile of relativeFileList) {
    console.log(`reqesting using config from file ${relativeFile}`);
    const fullPath = path.resolve(requestConfigDir, relativeFile);
    const {requestConfig, ...otherContents} = require(fullPath) as MockFileContent;
    await requestAndSaveMockInfo(requestConfig, {
      ...options,
      otherContents,
      fullPath: path.resolve(outputDir, relativeFile),
    });
  }
}
