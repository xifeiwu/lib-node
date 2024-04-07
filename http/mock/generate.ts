import fs from 'fs';
import path from 'path';
import {isPlainObject, toUrlInstance} from '../../external';
import {requestAndGetResponseInfo} from '../client';
import {MockFileContent, RequestConfig} from './types';
import {getFileList} from '../../fs';

export function convertObjectToCjsContent<T extends MockFileContent>(info: T) {
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
    }`;
    return line;
  });

  return lines.join('\n');
}

interface GenerateOneFileOptions extends GenerateOptions {
  fileName?: string;
}
export async function requestAndSaveMockInfo(requestConfig: RequestConfig, options: GenerateOneFileOptions) {
  const {basrUrl, mockFileDir} = options;
  if (!fs.existsSync(mockFileDir)) {
    console.log(`Error, dir not exist: ${mockFileDir}`);
    console.log(`You can try to create the dir by command:`);
    console.log(`mkdir -p ${mockFileDir}`);
    throw new Error();
  }
  const {method, data, origin, pathname, pathnameParams, query} = requestConfig;
  const urlProps = {origin, pathname, pathnameParams, query};
  if (basrUrl) {
    urlProps.origin = basrUrl;
  }
  const {href} = toUrlInstance(urlProps);
  const {headers, data: resData} = await requestAndGetResponseInfo({
    url: href,
    method,
    data,
  });
  let {fileName} = options;
  fileName = fileName ?? encodeURIComponent(href);
  if (!fileName.endsWith('.js')) {
    fileName = fileName + '.js';
  }

  const fullPath = path.resolve(mockFileDir, fileName);
  console.log(`writing file ${fullPath}`);
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

interface GenerateOptions {
  basrUrl?: string;
  mockFileDir: string;
}
export async function generateMockInfoByDir(requestConfigDir: string, options: GenerateOptions) {
  if (!fs.existsSync(requestConfigDir)) {
    throw new Error(`Error, dir not exist: ${requestConfigDir}`);
  }
  const relativeFileList = getFileList(requestConfigDir);
  for (const relativeFile of relativeFileList) {
    console.log(`requesting config: ${relativeFile}`);
    const fullPath = path.resolve(requestConfigDir, relativeFile);
    const requestConfig = require(fullPath) as RequestConfig;
    await requestAndSaveMockInfo(requestConfig, {...options, fileName: relativeFile});
  }
}
