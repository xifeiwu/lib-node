import {isPlainObject} from '../../external';
import {MockFileContent, RequestConfig} from './types';

export function convertObjectToCjsContent<T extends MockFileContent>(info: T) {
  return Object.entries(info)
    .map(([key, value]) => {
      return `module.exports.${key} = ${
        isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
      }`;
    })
    .join('\n');
}

// export function toUrlConfig(url: string): UrlConfig {
//   const {pathname, search} = parseUrl(url);
//   return {
//     url: pathname,
//     query: decodeQueryString(search),
//   };
// }

// export async function requestAndSave(requestConfig: RequestConfig, options: {
//   mockFileDir: string;
// }) {
//   const {mockFileDir = __dirname} = options;
//   const dirStat = fs.statSync()
//   if ()
  
// }