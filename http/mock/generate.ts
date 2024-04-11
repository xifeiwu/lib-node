import fs from 'fs';
import path from 'path';
import {getUrlPropsFromConfig, isPlainObject, toUrlInstance} from '../../external';
import {
  GeneralRequestOptions,
  HttpRequestOptions,
  mergeHttpRequestOptions,
  requestAndGetResponseInfo,
} from '../client';
import {MockFileContent, RequestConfig} from './types';
import {getFileList} from '../../fs';
import {urlPropsToHref} from '../../../fe/url';

export function convertObjectToCjsContent<T extends MockFileContent>(info: T) {
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
    }`;
    return line;
  });

  return lines.join('\n');
}

interface GenerateOneFileOptions extends GenerateByDirOptions {
  fullPath: string;
}
export async function requestAndSaveMockInfo(requestConfig: RequestConfig, options: GenerateOneFileOptions) {
  const {generalRequestConfig} = options;
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
  const {headers, data: resData} = await requestAndGetResponseInfo(mergedOptions);
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
      requestConfig,
      resHeaders: headers,
      resData,
    })
  );
}

interface GenerateByDirOptions {
  generalRequestConfig?: HttpRequestOptions;
  outputDir: string;
}
export async function generateMockInfoByDir(requestConfigDir: string, options: GenerateByDirOptions) {
  const {outputDir} = options;
  if (!fs.existsSync(requestConfigDir)) {
    throw new Error(`Error, config dir not exist: ${requestConfigDir}`);
  }
  if (!fs.existsSync(outputDir)) {
    throw new Error(`Error, output dir not exist: ${requestConfigDir}`);
  }
  const relativeFileList = getFileList(requestConfigDir, {
    fileFilter({relativePath}) {
      return relativePath.endsWith('.ts');
    },
  });
  for (const relativeFile of relativeFileList) {
    console.log(`reqesting using config from file ${relativeFile}`);
    const fullPath = path.resolve(requestConfigDir, relativeFile);
    const {requestConfig} = require(fullPath) as {requestConfig: GeneralRequestOptions};
    await requestAndSaveMockInfo(requestConfig, {
      ...options,
      fullPath: path.resolve(outputDir, relativeFile),
    });
  }
}
