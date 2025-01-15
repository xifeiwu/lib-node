import {DeepEqualConfig} from '../../external';
import {
  GetFileListInfo,
  HttpRequestOptions,
  HttpResponseInfo,
  ParseHttpResponseOptions,
  SendRequestWithResponseInfoResult,
} from '../../types';

/**
 * @deprecated by HttpRequestOptions
 */
export type RequestOptionsForMock = HttpRequestOptions;

export interface RecordHttpOptions extends ParseHttpResponseOptions {
  /** request config for all requestConfig under requestConfigDir */
  defaultRequestOptions?: HttpRequestOptions;
  /** fullpath have high priority than outputDir + getBasename*/
  fullPath?: string;
  outputDir?: string;
  getBasename?: (requestOptions: SendRequestWithResponseInfoResult) => string;
  /** content of mock item passed directly from request config file to mock file */
  moreMockItems?: Partial<Omit<HttpRecordContent, 'requestOptions'>>;
  // getBaseName
}

export interface RecordHttpByDirOptions extends Omit<RecordHttpOptions, 'requestOptions'> {
  // targetDir: string;
  targetDirList: Array<GetFileListInfo>;
}

interface CompareConfig {
  ignore?: boolean;
  includeObjectKeys?: DeepEqualConfig['includeObjectKeys'];
  excludeObjectKeys?: DeepEqualConfig['excludeObjectKeys'];
}
export interface HttpRecordContent<ResData = any> {
  /** Ignore this mock file or not */
  ignore?: boolean;
  requestCompare?: {
    query?: CompareConfig;
    payload?: CompareConfig;
  };
  requestOptions: HttpRequestOptions;
  responseInfo: HttpResponseInfo<ResData>;
}

/**
 * HttpRecordContent and it's related file info, it's useful when get HttpRecordContent from file or dir.
 */
export interface HttpRecordContentWithPathInfo extends HttpRecordContent {
  fullPath: string;
  relativePath: string;
}

export interface HttpRecordInfoForCompare extends Omit<HttpRecordContentWithPathInfo, 'responseInfo'> {
  matchCount?: number;
}

export interface FindRecordFileOptions {
  ignore?: boolean;
  getFileListOptions: Array<GetFileListInfo>;
  // targetDir: string;
  // getFileListOptions?: GetFileListOption;
  /** relative path */
  // includedFileList?: FilterItem[];
  // excludedFileList?: FilterItem[];
  debugCompare?: boolean;
}

export {HttpRequestOptions};
// export type HttpRecordFileFinder = (
//   targetRequestConfig: RequestOptionsForMock
// ) => HttpRecordContent & {relativePath?: string};
